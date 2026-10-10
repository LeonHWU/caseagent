import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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

export async function processCase(deps: RunDeps, dir: string, next: boolean): Promise<CaseState> {
  const { out, client, model, policy } = deps;

  let c: ReturnType<typeof loadCase>;
  let loadError = false;
  try {
    c = loadCase(dir);
  } catch (e) {
    loadError = true;
    const message = e instanceof Error ? e.message : String(e);
    const id = basename(dir);
    const statePath = join(out, "state", `${id}.json`);
    const tracePath = join(out, "traces", `${id}.jsonl`);
    mkdirSync(dirname(tracePath), { recursive: true });
    writeFileSync(tracePath, "");
    const state = newState(id, 0);
    state.incomplete = true;
    state.status = { kind: "escalated", summary: `Loading error: ${message}. A person must review case ${id}.` };
    const trace: Trace = (kind, data) =>
      appendFileSync(tracePath, JSON.stringify({ t: new Date().toISOString(), kind, ...data }) + "\n");
    const emptyCase = { id, title: id, details: "", request: "", events: [], attachments: [], layer: "raw" as const };
    saveState(statePath, state);
    writeAnswer(out, emptyCase, state, [], []);
    trace("error", { message });
    return state;
  }

  const statePath = join(out, "state", `${c.id}.json`);
  const tracePath = join(out, "traces", `${c.id}.jsonl`);
  mkdirSync(dirname(tracePath), { recursive: true });

  let state = next ? loadState(statePath) : null;
  let newFrom = 1;
  if (next) {
    if (!state) throw new Error(`case ${c.id} has no saved state. Run it once without --next.`);
    const seen = nextSeen(c, state.seen);
    if (seen === null) throw new Error(`case ${c.id} has no further events from the tenant, landlord or a contractor.`);
    newFrom = state.seen + 1;
    state.seen = seen;
  } else {
    state = newState(c.id, initialSeen(c));
    writeFileSync(tracePath, "");
  }

  const trace: Trace = (kind, data) =>
    appendFileSync(tracePath, JSON.stringify({ t: new Date().toISOString(), kind, ...data }) + "\n");
  let thoughts: string[] = [];
  try {
    thoughts = await runCase({ c, state: state!, newFrom, client, model, policy, trace });
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
