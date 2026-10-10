import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runCase, type ModelClient, type Trace } from "./agent.ts";
import { writeAnswer } from "./answers.ts";
import { initialSeen, nextSeen, visibleEvents } from "./cut.ts";
import { loadCase } from "./parse.ts";
import { loadState, newState, saveState, statusLabel, type CaseState } from "./state.ts";

export type RunDeps = { out: string; client: ModelClient; model: string; policy: string };

export function liveDeps(out: string): RunDeps {
  return {
    out,
    client: new Anthropic({ timeout: 120_000, maxRetries: 3 }),
    model: process.env.MODEL ?? "claude-sonnet-5-5",
    policy: readFileSync(new URL("../policy.md", import.meta.url), "utf8"),
  };
}

export function summary(state: CaseState): string {
  return `${state.caseId}: ${statusLabel(state.status)}${state.incomplete ? " [incomplete]" : ""}`;
}

export async function processCase(deps: RunDeps, dir: string, next: boolean, options: { step?: number; singleStep?: boolean } = {}): Promise<CaseState> {
  const { out, client, model, policy } = deps;
  const c = loadCase(dir);
  const statePath = join(out, "state", `${c.id}.json`);
  const tracePath = join(out, "traces", `${c.id}.jsonl`);
  if (options.step !== undefined && (!Number.isInteger(options.step) || !c.events.some((e) => e.n === options.step))) {
    throw new Error(`step ${options.step} is not an event in case ${c.id}`);
  }
  mkdirSync(dirname(tracePath), { recursive: true });

  let state = next ? loadState(statePath) : null;
  let newFrom = 1;
  if (next) {
    if (!state) throw new Error(`case ${c.id} has no saved state. Run it once without --next.`);
    const seen = options.step ?? (options.singleStep && state.status.kind === "open" ? state.seen : nextSeen(c, state.seen));
    if (seen === null) throw new Error(`case ${c.id} has no further events from the tenant, landlord or a contractor.`);
    if (seen < state.seen) throw new Error(`step ${seen} precedes saved step ${state.seen}. Use run_case to restart.`);
    newFrom = seen === state.seen ? seen : state.seen + 1;
    state.seen = seen;
  } else {
    state = newState(c.id, options.step ?? initialSeen(c));
    writeFileSync(tracePath, "");
  }

  const trace: Trace = (kind, data) =>
    appendFileSync(tracePath, JSON.stringify({ t: new Date().toISOString(), kind, ...data }) + "\n");
  let thoughts: string[] = [];
  try {
    thoughts = await runCase({ c, state: state!, newFrom, client, model, policy, trace, singleStep: options.singleStep });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state!.incomplete = true;
    state!.status = { kind: "escalated", summary: `System error: ${message}. A person must review case ${c.id}.` };
    trace("error", { message });
  }
  saveState(statePath, state!);
  writeAnswer(out, c, state!, visibleEvents(c, state!.initialSeen, state!.seen), thoughts);
  return state!;
}
