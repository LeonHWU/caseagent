import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { runCase, type ModelClient, type Trace } from "./agent.ts";
import { writeAnswer } from "./answers.ts";
import { initialSeen, nextSeen, visibleEvents } from "./cut.ts";
import { loadCase } from "./parse.ts";
import { loadState, newState, saveState, statusLabel, type CaseState } from "./state.ts";
import type { PlaybookOptions } from "./playbooks.ts";

const MAX_STAGES = 50;

// A fresh run keeps the previous trace under a timestamped name instead of overwriting it.
function startTrace(tracePath: string): void {
  if (existsSync(tracePath) && statSync(tracePath).size > 0) {
    const stamp = statSync(tracePath).mtime.toISOString().replace(/[:.]/g, "-");
    renameSync(tracePath, tracePath.replace(/\.jsonl$/, `.${stamp}.jsonl`));
  }
  writeFileSync(tracePath, "");
}

export type RunDeps = { out: string; client: ModelClient; model: string; policy: string; playbooks?: PlaybookOptions | false };

export function liveDeps(out: string): RunDeps {
  return {
    out,
    client: new Anthropic({ timeout: 120_000, maxRetries: 3 }),
    model: process.env.MODEL ?? "claude-sonnet-5-5",
    policy: readFileSync(new URL("../policy.md", import.meta.url), "utf8"),
    playbooks: process.env.PLAYBOOKS === "off" ? false : { model: process.env.PLAYBOOK_MODEL ?? process.env.MODEL ?? "claude-sonnet-5-5" },
  };
}

export function summary(state: CaseState): string {
  return `${state.caseId}: ${statusLabel(state.status)}`;
}

// Failures the agent cannot fix end the case on a person: a load failure, an API error, or a stage cap.
function markSystemFailure(state: CaseState, label: string, message: string, caseId: string): void {
  state.status = { kind: "escalated", by: "system", summary: `${label}: ${message}. A person must review case ${caseId}.` };
}

export async function processCase(deps: RunDeps, dir: string, next: boolean, options: { step?: number; singleStep?: boolean } = {}): Promise<CaseState> {
  const { out, client, model, policy } = deps;

  let c: ReturnType<typeof loadCase>;
  try {
    c = loadCase(dir);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const id = basename(dir);
    const statePath = join(out, "state", `${id}.json`);
    const tracePath = join(out, "traces", `${id}.jsonl`);
    mkdirSync(dirname(tracePath), { recursive: true });
    startTrace(tracePath);
    const state = newState(id, 0);
    markSystemFailure(state, "Loading error", message, id);
    const trace: Trace = (kind, data) =>
      appendFileSync(tracePath, JSON.stringify({ t: new Date().toISOString(), kind, ...data }) + "\n");
    const emptyCase = { id, title: id, details: "", request: "", events: [], attachments: [], layer: "raw" as const };
    saveState(statePath, state);
    writeAnswer(out, emptyCase, state, []);
    trace("error", { message });
    return state;
  }

  const statePath = join(out, "state", `${c.id}.json`);
  const tracePath = join(out, "traces", `${c.id}.jsonl`);
  if (options.step !== undefined && (!Number.isInteger(options.step) || !c.events.some((e) => e.n === options.step))) {
    throw new Error(`step ${options.step} is not an event in case ${c.id}`);
  }
  mkdirSync(dirname(tracePath), { recursive: true });
  if (!next) startTrace(tracePath);
  const trace: Trace = (kind, data) =>
    appendFileSync(tracePath, JSON.stringify({ t: new Date().toISOString(), kind, ...data }) + "\n");
  if (c.warnings?.length) trace("parse_warnings", { warnings: c.warnings });

  let state = next ? loadState(statePath) : null;
  let newFrom = 1;
  if (next) {
    if (!state) throw new Error(`case ${c.id} has no saved state. Run it once without --next.`);
    if (state.status.kind === "closed" || state.status.kind === "escalated") {
      throw new Error(`case ${c.id} is already ${state.status.kind}. Run it once without --next to restart.`);
    }
    // An open case was stopped mid-stage by a single-action call, so it continues at the same event.
    const seen = options.step ?? (state.status.kind === "open" ? state.seen : nextSeen(c, state.seen));
    if (seen === null) throw new Error(`case ${c.id} has no further events from the tenant, landlord or a contractor.`);
    if (seen < state.seen) throw new Error(`step ${seen} precedes saved step ${state.seen}. Use run_case to restart.`);
    newFrom = seen === state.seen ? seen : state.seen + 1;
    state.seen = seen;
  } else {
    state = newState(c.id, options.step ?? initialSeen(c));
  }

  try {
    await runCase({ c, state: state!, newFrom, client, model, policy, trace, singleStep: options.singleStep, caseDir: dir, playbooks: deps.playbooks });
  } catch (e) {
    markSystemFailure(state!, "System error", e instanceof Error ? e.message : String(e), c.id);
    trace("error", { message: e instanceof Error ? e.message : String(e) });
  }
  saveState(statePath, state!);
  writeAnswer(out, c, state!, visibleEvents(c, state!.initialSeen, state!.seen));
  return state!;
}

// Runs the first stage, then resumes while the case is on hold and an outside event remains.
// A case that still has outside events after MAX_STAGES stages did not finish; it escalates
// instead of reporting the same "hold" as a case that is genuinely waiting.
export async function processToEnd(deps: RunDeps, dir: string): Promise<CaseState> {
  let state = await processCase(deps, dir, false);
  for (let stage = 1; stage < MAX_STAGES && state.status.kind === "hold"; stage++) {
    if (nextSeen(loadCase(dir), state.seen) === null) break;
    state = await processCase(deps, dir, true);
  }
  if (state.status.kind === "hold" && nextSeen(loadCase(dir), state.seen) !== null) {
    const c = loadCase(dir);
    markSystemFailure(state, `Stopped at the ${MAX_STAGES}-stage resume limit`, "the case still has outside events", c.id);
    saveState(join(deps.out, "state", `${c.id}.json`), state);
    writeAnswer(deps.out, c, state, visibleEvents(c, state.initialSeen, state.seen));
  }
  return state;
}
