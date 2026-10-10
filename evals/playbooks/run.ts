import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { casePolicy, runCase, type ModelClient } from "../../src/agent.ts";
import { visibleEvents } from "../../src/cut.ts";
import type { Case } from "../../src/parse.ts";
import { bankHash, loadPlaybookBank } from "../../src/playbooks.ts";
import { renderCase } from "../../src/prompt.ts";
import { newState } from "../../src/state.ts";
import { submissionToolChoice } from "../../src/model-submission.ts";
import { projectExpectations, type ExpectedResults, type JudgeInput } from "./judge/contract.ts";
import { judgeResponse, responseSchema, validateJudgement, type JudgeReview } from "./judge/schema.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const repo = resolve(root, "../..");
export type Sample = {
  id: string; input: { case: Case; step: number }; expected: ExpectedResults;
  retrieval_expectation: string[]; acceptable_tools: string[];
};

export function projectSample(sample: Sample) {
  // Explicit projections, not object spreads: metadata, explanations, expected results
  // and later history cannot enter the acting model or judge's current-facts object.
  const source = sample.input.case;
  const c: Case = {
    id: source.id, title: source.title, details: source.details, request: source.request,
    events: source.events.filter((e) => e.n <= sample.input.step).map((e) => ({
      n: e.n, at: e.at, channel: e.channel, from: e.from, to: e.to, body: e.body, attachments: [],
    })), attachments: [], layer: "strict",
  };
  if (!c.events.some((e) => e.n === sample.input.step)) throw new Error("Sample cut is not an event");
  return { c, state: newState(c.id, sample.input.step), expected: projectExpectations(sample.expected) };
}

export function evidencePointers(input: JudgeInput) {
  const result: { source: "test_case" | "actual_output"; pointer: string }[] = [];
  const walk = (source: "test_case" | "actual_output", value: unknown, pointer: string) => {
    if (value === null || typeof value !== "object") { result.push({ source, pointer }); return; }
    for (const [key, child] of Object.entries(value)) walk(source, child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  };
  walk("test_case", input.test_case, ""); walk("actual_output", input.actual_output, "");
  return result;
}

export async function judge(client: ModelClient, model: string, input: JudgeInput): Promise<JudgeReview> {
  const system = readFileSync(new URL("./judge/system.txt", import.meta.url), "utf8");
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model, max_tokens: 3000, system,
      messages: [{ role: "user", content: JSON.stringify({ ...input, available_scalar_evidence_pointers: evidencePointers(input) }) + feedback }],
      tools: [{ name: "submit_review", description: "Submit the process decision comparison and score.", input_schema: responseSchema() as Anthropic.Tool.InputSchema }],
      tool_choice: submissionToolChoice(model, "submit_review"),
    });
    const block = response.content.find((b) => b.type === "tool_use" && b.name === "submit_review");
    try {
      if (!block || block.type !== "tool_use") throw new Error("No judge submission");
      const parsed = judgeResponse.parse(block.input);
      validateJudgement(parsed, input);
      return parsed;
    } catch (e) {
      if (attempt) throw e;
      feedback = `\nYour previous submission failed code validation: ${e instanceof Error ? e.message : String(e)}. Submit a complete valid comparison with exact scalar-source quotations.`;
    }
  }
  throw new Error("Judge validation failed");
}

export type Trial = {
  id: string; trial: number; arm: "baseline" | "playbooks"; duration_ms: number;
  actions: unknown[]; notes: unknown[]; selections: string[]; retrieval_match: boolean | null;
  selector_errors: number; model_requests: number; input_tokens: number; output_tokens: number;
  judge: JudgeReview | null; pass: boolean | null; error: string | null;
};

export function referenceCatalogue() {
  // Identical metadata in both arms prevents a real PB09 citation being mistaken for
  // a nonexistent policy rule. No branch text, history or selected-reference IDs leak to the judge.
  return loadPlaybookBank({}).playbooks.map(({ id, title }) => ({ id, title, role: "workflow reference ID, not a numbered policy rule" }));
}

export function summarize(results: Trial[]) {
  const arms = Object.fromEntries((["baseline", "playbooks"] as const).map((arm) => {
    const rows = results.filter((r) => r.arm === arm);
    const measured = rows.filter((r) => r.pass !== null);
    const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return [arm, {
      attempted: rows.length, assessed: measured.length, unassessed: rows.length - measured.length,
      passed: measured.filter((r) => r.pass).length, pass_rate: mean(measured.map((r) => Number(r.pass))),
      mean_score: mean(measured.map((r) => r.judge!.score!)),
      mean_duration_ms: mean(rows.map((r) => r.duration_ms)),
      model_requests: rows.reduce((n, r) => n + r.model_requests, 0),
      input_tokens: rows.reduce((n, r) => n + r.input_tokens, 0), output_tokens: rows.reduce((n, r) => n + r.output_tokens, 0),
      selector_errors: rows.reduce((n, r) => n + r.selector_errors, 0),
    }];
  }));
  const pairs = results.filter((r) => r.arm === "baseline").map((a) => {
    const b = results.find((r) => r.arm === "playbooks" && r.id === a.id && r.trial === a.trial);
    return { id: a.id, trial: a.trial, baseline: a.pass, playbooks: b?.pass ?? null, score_delta: a.judge?.score != null && b?.judge?.score != null ? b.judge.score - a.judge.score : null };
  });
  const measured = pairs.filter((p) => p.baseline !== null && p.playbooks !== null);
  return { arms, pairs, improved: measured.filter((p) => !p.baseline && p.playbooks).length,
    regressed: measured.filter((p) => p.baseline && !p.playbooks).length,
    both_passed: measured.filter((p) => p.baseline && p.playbooks).length,
    both_failed: measured.filter((p) => !p.baseline && !p.playbooks).length,
    paired_assessed: measured.length,
    retrieval_matches: results.filter((r) => r.arm === "playbooks" && r.retrieval_match).length,
  };
}

export async function runPlaybookSuite(opts: {
  client: ModelClient; judgeClient: ModelClient; model: string; judgeModel: string; out: string; trials: number;
}) {
  const suite = JSON.parse(readFileSync(resolve(root, "samples.json"), "utf8")) as { samples: Sample[] };
  const policy = readFileSync(resolve(repo, "policy.md"), "utf8");
  const results: Trial[] = [];
  mkdirSync(opts.out, { recursive: true });
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const metadata = {
    suite: "playbook-development-ablation-v1", model: opts.model, selector_model: opts.model, judge_model: opts.judgeModel,
    trials: opts.trials, started_at: new Date().toISOString(), bank_hash: bankHash(loadPlaybookBank({})),
    policy_hash: hash(policy), suite_hash: hash(readFileSync(resolve(root, "samples.json"), "utf8")),
    judge_prompt_hash: hash(readFileSync(resolve(root, "judge/system.txt"), "utf8")),
    code_hash: hash(["src/agent.ts", "src/playbooks.ts", "evals/playbooks/run.ts", "evals/playbooks/judge/schema.ts"].map((path) => readFileSync(resolve(repo,path),"utf8")).join("\n")),
    limitations: ["Development counterfactuals derive from synthesis source cases; this is not held-out generalization.", "Two trials are a smoke ablation, not statistically reliable evidence.", "Semantic scores come from a fixed LLM judge; code validates evidence, structure and critical tools."],
  };
  const save = () => writeFileSync(resolve(opts.out, "results.json"), JSON.stringify({ ...metadata, summary: summarize(results), results }, null, 2) + "\n");
  const runPair = async (i: number, trial: number) => {
    const sample = suite.samples[i];
      // Counterbalance order. Each arm receives fresh identical state; no outputs cross arms.
      const order = (i + trial) % 2 ? ["baseline", "playbooks"] as const : ["playbooks", "baseline"] as const;
      for (const arm of order) {
        const { c, state, expected } = projectSample(sample);
        const prompt = await renderCase(c, state, visibleEvents(c, state.initialSeen, state.seen), 1);
        const traces: Record<string, unknown>[] = [];
        let calls = 0, inputTokens = 0, outputTokens = 0;
        const client: ModelClient = { messages: { create: async (p) => {
          calls++; const response = await opts.client.messages.create(p);
          inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0);
          outputTokens += response.usage.output_tokens;
          return response;
        } } };
        const started = Date.now();
        let runError: string | null = null;
        try {
          await runCase({ c, state, newFrom: 1, client, model: opts.model, policy,
            singleStep: true, playbooks: arm === "playbooks" ? { model: opts.model } : false,
            trace: (kind, data) => traces.push({ kind, ...data }) });
          if (state.status.kind === "escalated" && state.status.by === "system") runError = state.status.summary;
        } catch (e) { runError = e instanceof Error ? e.message : String(e); }
        const duration = Date.now() - started;
        // Blind judge: no arm, retrieved guidance, selection reasons, source history or provenance.
        const judgeInput: JudgeInput = {
          test_case: { id: sample.id, current_policy: casePolicy(policy,true), current_evidence: prompt.text, system_reference_catalogue: referenceCatalogue(),
            invocation_contract: { single_business_action: true, open_after_non_end_tool_is_valid: true } },
          expected_results: expected,
          actual_output: { actions: state.actions.map((a) => ({ tool: a.tool, input: a.input, ok: a.ok, result: a.result })),
            notes: state.notes.map((n) => n.text), resulting_status: state.status },
        };
        let review: JudgeReview | null = null, error = runError;
        if (!runError) {
          try { review = await judge(opts.judgeClient, opts.judgeModel, judgeInput); }
          catch (e) { error = `Judge failure: ${e instanceof Error ? e.message : String(e)}`; }
        }
        const selection = traces.filter((t) => t.kind === "playbook_selection")
          .flatMap((t) => (t.selections as { playbook_id: string; step_ids: string[] }[]).flatMap((s) => s.step_ids.map((id) => `${s.playbook_id}.${id}`)));
        const pass = error || review?.status !== "reviewed" ? null :
          review.comparisons.every((r) => r.result === "met") && !review.critical_failures.length && !review.prohibited_actions.length &&
          state.actions.length === 1 && state.actions[0].ok && sample.acceptable_tools.includes(state.actions[0].tool);
        const result: Trial = {
          id: sample.id, trial, arm, duration_ms: duration, actions: state.actions, notes: state.notes,
          selections: selection, retrieval_match: arm === "baseline" ? null : sample.retrieval_expectation.length ? sample.retrieval_expectation.some((id) => selection.includes(id)) : selection.length === 0,
          selector_errors: traces.filter((t) => t.kind === "playbook_error").length,
          model_requests: calls, input_tokens: inputTokens, output_tokens: outputTokens, judge: review, pass, error,
        };
        results.push(result);
        writeFileSync(resolve(opts.out, `${sample.id}-${trial}-${arm}.json`), JSON.stringify({ judge_input: judgeInput, trace: traces }, null, 2) + "\n");
        save();
        console.log(JSON.stringify({ id: sample.id, trial, arm, pass, score: review?.score, selections: selection, error }));
      }
  };
  const jobs = suite.samples.flatMap((_, i) => Array.from({ length: opts.trials }, (_, t) => [i, t + 1] as const));
  let cursor = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (cursor < jobs.length) { const [i, trial] = jobs[cursor++]; await runPair(i, trial); }
  }));
  return { ...metadata, summary: summarize(results), results };
}

if (import.meta.main) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");
  const model = process.env.MODEL ?? "claude-haiku-4-5-20251001";
  const judgeModel = process.env.JUDGE_MODEL ?? model;
  const trials = z.coerce.number().int().min(1).max(10).parse(process.env.EVAL_TRIALS ?? "2");
  const out = resolve(process.argv[2] ?? resolve(repo, "runs/playbook-eval", new Date().toISOString().replaceAll(":", "-")));
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const report = await runPlaybookSuite({ client, judgeClient: client, model, judgeModel, trials, out });
  console.log(JSON.stringify(report.summary));
}
