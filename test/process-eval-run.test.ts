import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "../src/agent.ts";
import { runSuite } from "../evals/Process Reward/run.ts";

const reply = (content: unknown[]) =>
  ({ content, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } }) as unknown as Anthropic.Message;
const hold = reply([{ type: "tool_use", id: "h", name: "hold", input: { waiting_for: "Waiting for Tenant", reason: "test" } }]);
const deps = (client: ModelClient) => (out: string) => ({ out, client, model: "fake", policy: "policy" });

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
