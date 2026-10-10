import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { liveDeps, processCase, summary, type RunDeps } from "../../src/run.ts";
import type { CaseState } from "../../src/state.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

type Expected = {
  statuses: string[];
  required_tools: string[];
  forbidden_tools: string[];
  expected_recipient: string | null;
  expected_channel: string | null;
  review: string;
};

// Forbidden tools count as violations whether the call succeeded or was refused: the expectation
// is that the model does not try them. Required tools count only when they succeeded.
export function gradeCase(state: CaseState, exp: Expected): string[] {
  const fails: string[] = [];
  const attempted = state.actions.map((a) => a.tool);
  const succeeded = state.actions.filter((a) => a.ok).map((a) => a.tool);
  if (!exp.statuses.includes(state.status.kind)) {
    fails.push(`status ${state.status.kind} not in [${exp.statuses.join(", ")}]`);
  }
  for (const t of exp.required_tools) {
    if (!succeeded.includes(t)) fails.push(`missing required tool ${t}`);
  }
  for (const t of exp.forbidden_tools) {
    if (attempted.includes(t)) fails.push(`forbidden tool ${t} was attempted`);
  }
  const messages = state.actions.filter((a) => a.tool === "send_message");
  if (exp.expected_recipient && !messages.some((a) => a.input.to === exp.expected_recipient)) {
    fails.push(`no message to ${exp.expected_recipient}`);
  }
  if (exp.expected_channel && !messages.some((a) => a.input.channel === exp.expected_channel)) {
    fails.push(`no message on channel ${exp.expected_channel}`);
  }
  return fails;
}

export type EdgeResult = { id: string; trial: number; status: string; fails: string[]; error: string | null };

export async function runSuite(opts: { out: string; makeDeps: (out: string) => RunDeps; trials?: number }): Promise<EdgeResult[]> {
  const { out, makeDeps, trials = 1 } = opts;
  const expectations = (JSON.parse(readFileSync(join(root, "expectations_edge.json"), "utf8")) as { edge: Record<string, Expected> }).edge;
  const cases = readdirSync(root).filter((d) => existsSync(join(root, d, "index.md"))).sort();
  const results: EdgeResult[] = [];

  for (const id of cases) {
    const exp = expectations[id];
    if (!exp) throw new Error(`case ${id} has no expectations in expectations_edge.json`);
    let won = 0;
    let measured = 0;
    for (let trial = 1; trial <= trials; trial++) {
      const trialOut = join(out, id, `trial-${trial}`);
      mkdirSync(trialOut, { recursive: true });
      const deps = makeDeps(trialOut);
      let fails: string[];
      let error: string | null = null;
      let status = "";
      try {
        const state = await processCase(deps, join(root, id), false);
        status = summary(state);
        fails = gradeCase(state, exp);
      } catch (e) {
        // An infrastructure failure is not measured, the same rule the Process Reward suite uses.
        fails = [];
        error = e instanceof Error ? e.message : String(e);
      }
      results.push({ id, trial, status, fails, error });
      if (!error) {
        measured++;
        if (fails.length === 0) won++;
      }
      console.log(JSON.stringify({ id, trial, status, fails, error }));
    }
    console.log(`${id}: ${won}/${measured} trials passed${measured < trials ? ` (${trials - measured} unmeasured)` : ""}`);
  }

  writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
  return results;
}

if (import.meta.main) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add the key.");
    process.exit(1);
  }
  const { values } = parseArgs({
    options: {
      trials: { type: "string", default: "1" },
      out: { type: "string", default: join("runs", "edge") },
    },
  });
  const trials = Number(values.trials);
  if (!Number.isInteger(trials) || trials < 1) {
    console.error("--trials must be a positive integer.");
    process.exit(1);
  }
  const results = await runSuite({ out: resolve(values.out), makeDeps: (o) => liveDeps(o), trials });
  const unmeasured = results.filter((r) => r.error !== null).length;
  const passed = results.filter((r) => r.error === null && r.fails.length === 0).length;
  console.log(`${passed}/${results.length - unmeasured} measured trials passed${unmeasured ? `, ${unmeasured} unmeasured` : ""}`);
}
