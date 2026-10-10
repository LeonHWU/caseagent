import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "../src/agent.ts";
import { gradeRun, runSuite } from "../evals/Process Reward/run.ts";

const reply = (content: unknown[]) =>
  ({ content, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } }) as unknown as Anthropic.Message;
const hold = reply([{ type: "tool_use", id: "h", name: "hold", input: { waiting_for: "Waiting for Tenant", reason: "test" } }]);
// No sample accepts escalate, so this is a wrong answer that still ends the run in one call.
const wrong = reply([{ type: "tool_use", id: "w", name: "escalate", input: { checked: "c", missing_or_conflict: "m", decision_needed: "d", reason: "test" } }]);
const deps = (client: ModelClient) => (out: string) => ({ out, client, model: "fake", policy: "policy" });

const END = new Set(["hold", "escalate", "close_case"]);
const evalRoot = join(dirname(fileURLToPath(import.meta.url)), "../evals/Process Reward");
const manifest = JSON.parse(readFileSync(join(evalRoot, "manifest.json"), "utf8"));
const sampleOf = (id: string) => JSON.parse(readFileSync(join(evalRoot, "samples", `${id}.json`), "utf8"));

// A valid tool input for the sample's first acceptable action. Runs are multi-action, so a reply is a
// whole run: the action, then hold when the action does not end the run itself.
const inputFor: Record<string, Record<string, unknown>> = {
  hold: { waiting_for: "Waiting for Tenant" },
  send_message: { to: "tenant", channel: "email", text: "Please try a plunger first." },
  request_landlord_approval: { scope: "repair", cost: "unknown" },
  assign_contractor: { trade: "plumber", notes: "attend and report" },
  close_case: { outcome: "work_completed", work_confirmed_by: "tenant [event 001]", landlord_informed: true, keys: "returned", invoice: "on_file" },
  escalate: { checked: "the events", missing_or_conflict: "two reports conflict", decision_needed: "pick a side" },
};
const correctInput = (tool: string, exact: Record<string, unknown>): Record<string, unknown> => ({
  ...inputFor[tool], ...exact, reason: "test",
});

// Calls are sequential: sample order from the manifest, trial order within each sample.
const correctReplies = (trials: number, mutate?: (sampleIdx: number, trial: number) => Anthropic.Message | null) => {
  const queue: Anthropic.Message[] = [];
  manifest.samples.forEach((entry: { id: string }, sampleIdx: number) => {
    for (let t = 1; t <= trials; t++) {
      const custom = mutate?.(sampleIdx, t);
      if (custom) { queue.push(custom); continue; }
      const action = sampleOf(entry.id).expected.acceptable_actions[0];
      const blocks = [{ type: "tool_use", id: `${sampleIdx}-${t}`, name: action.tool, input: correctInput(action.tool, action.exact_arguments) }];
      if (!END.has(action.tool)) blocks.push({ type: "tool_use", id: `${sampleIdx}-${t}-end`, name: "hold", input: { waiting_for: "Waiting for Tenant", reason: "test" } });
      queue.push(reply(blocks));
    }
  });
  return queue;
};

test("a model that never calls a tool is a model failure with strict score 0, not a runtime failure", async () => {
  const textOnly: ModelClient = { messages: { create: async () => reply([{ type: "text", text: "thinking" }]) } };
  const out = mkdtempSync(join(tmpdir(), "eval-"));
  const report = await runSuite({ out, makeDeps: deps(textOnly), model: "fake", revision: "test" });
  assert.equal(report.results.length, 10);
  for (const r of report.results) {
    assert.equal(r.run_outcome, "model_failure", r.id);
    assert.equal(r.score, 0, r.id);
    assert.equal(r.structural_match, false, r.id);
  }
});

test("an API error inside the case stays a runtime failure with no score", async () => {
  const failing: ModelClient = { messages: { create: async () => { throw new Error("529 overloaded"); } } };
  const out = mkdtempSync(join(tmpdir(), "eval-"));
  const report = await runSuite({ out, makeDeps: deps(failing), model: "fake", revision: "test" });
  assert.ok(report.results.every((r) => r.run_outcome === "runtime_failure" && r.score === null));
});

test("an MCP failure on one sample is recorded and the remaining samples still run", async () => {
  let calls = 0;
  const hangsOnce: ModelClient = { messages: { create: () => (calls++ === 0 ? new Promise<Anthropic.Message>(() => {}) : Promise.resolve(hold)) } };
  const out = mkdtempSync(join(tmpdir(), "eval-"));
  const report = await runSuite({ out, makeDeps: deps(hangsOnce), model: "fake", revision: "test", timeoutMs: 300 });

  assert.equal(report.results.length, 10);
  const [first, ...rest] = report.results;
  assert.equal(first.run_outcome, "runtime_failure");
  assert.equal(first.score, null);
  assert.match(String(first.error), /timed out|-32001/i);
  assert.ok(first.trace.endsWith(".jsonl"));
  assert.ok(rest.every((r) => r.run_outcome === "completed"), JSON.stringify(rest.map((r) => r.run_outcome)));

  const saved = JSON.parse(readFileSync(join(out, "results.json"), "utf8"));
  assert.equal(saved.results.length, 10);
});

test("trials: a model that always matches gives pass_1 1 and pass_k 1", async () => {
  const queue = correctReplies(3);
  const correct: ModelClient = { messages: { create: async () => queue.shift()! } };
  const out = mkdtempSync(join(tmpdir(), "eval-"));
  const report = await runSuite({ out, makeDeps: deps(correct), model: "fake", revision: "test", trials: 3 });

  assert.equal(report.results.length, 30);
  assert.ok(report.results.every((r) => r.measured && r.run_outcome === "completed" && r.structural_match));
  assert.equal(report.pass_1, 1);
  assert.equal(report.pass_k, 1);
});

test("trials: alternating right and wrong gives pass_1 0.5 and pass_k 0", async () => {
  const queue = correctReplies(2, (_s, t) => (t === 2 ? wrong : null));
  const alternating: ModelClient = { messages: { create: async () => queue.shift()! } };
  const out = mkdtempSync(join(tmpdir(), "eval-"));
  const report = await runSuite({ out, makeDeps: deps(alternating), model: "fake", revision: "test", trials: 2 });

  assert.equal(report.pass_1, 0.5);
  assert.equal(report.pass_k, 0);
});

test("trials: a runtime_failure trial is not measured, and the rest still score", async () => {
  const replies = correctReplies(2);
  let calls = 0;
  const flaky: ModelClient = {
    messages: {
      create: () => (++calls <= 2 ? Promise.reject(new Error("API down")) : Promise.resolve(replies[calls - 1])),
    },
  };
  const out = mkdtempSync(join(tmpdir(), "eval-"));
  const report = await runSuite({ out, makeDeps: deps(flaky), model: "fake", revision: "test", trials: 2 });

  assert.equal(report.results.length, 20);
  const first = report.results.filter((r) => r.id === manifest.samples[0].id);
  assert.ok(first.every((r) => r.run_outcome === "runtime_failure" && !r.measured));
  assert.equal(report.pass_1, 1);
  assert.equal(report.pass_k, 1);
});

test("trials: a partially measured sample does not count for or against pass_k", async () => {
  const replies = correctReplies(2);
  let calls = 0;
  // Sample 0: trial 1 unmeasured (API down), trial 2 completed but wrong. Under the old rule this
  // sample counted as a pass_k failure; now it is excluded and unmeasured is reported.
  const flaky: ModelClient = {
    messages: { create: () => (++calls === 1 ? Promise.reject(new Error("API down")) : Promise.resolve(calls === 2 ? wrong : replies[calls - 1])) },
  };
  const out = mkdtempSync(join(tmpdir(), "eval-"));
  const report = await runSuite({ out, makeDeps: deps(flaky), model: "fake", revision: "test", trials: 2 });

  const first = report.results.filter((r) => r.id === manifest.samples[0].id);
  assert.equal(first[0].measured, false);
  assert.equal(first[1].measured, true);
  assert.equal(report.pass_k, 1);
  assert.equal(report.unmeasured, 1);
});

test("gradeRun: a message then hold passes; closing after a message, a refusal, or no match fails", () => {
  const exp = { acceptable_actions: [{ tool: "send_message", exact_arguments: { to: "tenant", channel: "email" } }] };
  const act = (tool: string, input: Record<string, unknown>, ok = true, result = "ok") => ({ run: 1, afterEvent: 1, tool, input, ok, result });
  const msg = act("send_message", { to: "tenant", channel: "email" });
  const hold = act("hold", { waiting_for: "Waiting for Tenant" });
  assert.deepEqual(gradeRun([msg, hold], exp), { matched: 0, violations: [] });
  assert.deepEqual(gradeRun([act("add_note", { text: "x" }), msg, hold], exp), { matched: 1, violations: [] });
  assert.match(gradeRun([msg, act("close_case", { outcome: "withdrawn" })], exp).violations.join(), /close_case ended a run/);
  assert.match(gradeRun([act("assign_contractor", {}, false, "refused: landlord approval is not on file."), msg, hold], exp).violations.join(), /assign_contractor was refused/);
  assert.match(gradeRun([act("send_message", { to: "landlord", channel: "email" }), hold], exp).violations.join(), /no successful action matches/);
  assert.match(gradeRun([msg], exp).violations.join(), /did not end/);
  // A schema error the model then fixes is not a guard refusal.
  assert.deepEqual(gradeRun([act("send_message", {}, false, "invalid input: to is required"), msg, hold], exp).violations, []);
  const closeExp = { acceptable_actions: [{ tool: "close_case", exact_arguments: { outcome: "work_completed" } }] };
  assert.deepEqual(gradeRun([act("send_message", { to: "landlord", channel: "email" }), act("close_case", { outcome: "work_completed" })], closeExp).violations, []);
  const reportThenClose = { ...exp, close_allowed_after_action: true };
  assert.deepEqual(gradeRun([msg, act("close_case", { outcome: "work_completed" })], reportThenClose).violations, []);
});

test("multi-action runs: a correct run of message then hold scores as a structural match end to end", async () => {
  const queue = correctReplies(1);
  const correct: ModelClient = { messages: { create: async () => queue.shift()! } };
  const report = await runSuite({ out: mkdtempSync(join(tmpdir(), "eval-")), makeDeps: deps(correct), model: "fake", revision: "test" });
  const msg = report.results.find((r) => r.id === "pm-017-switch-troubleshooting")!;
  assert.deepEqual(msg.actions.map((a) => a.tool), ["send_message", "hold"]);
  assert.equal(msg.matched_action, 0);
  assert.equal(msg.structural_match, true);
  assert.equal(report.pass_1, 1);
});
