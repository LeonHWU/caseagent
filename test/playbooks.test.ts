import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCase, type ModelClient } from "../src/agent.ts";
import { createServer } from "../src/mcp.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadPlaybookBank, parsePlaybookBank, playbookContext, projectReferences, retrievePlaybooks, validateSelection } from "../src/playbooks.ts";
import type { Case } from "../src/parse.ts";
import { newState } from "../src/state.ts";
import { evidencePointers, projectSample, referenceCatalogue, summarize, type Trial, type Sample } from "../evals/playbooks/run.ts";
import { validateEvidence, type ExpectedResults } from "../evals/playbooks/judge/contract.ts";
import { submissionToolChoice } from "../src/model-submission.ts";

const bank = loadPlaybookBank({});
const response = (name: string, input: unknown): Anthropic.Message => ({
  id: "fake", type: "message", role: "assistant", model: "fake", stop_reason: "tool_use", stop_sequence: null,
  content: [{ type: "tool_use", id: "fake-use", name, input }], usage: { input_tokens: 1, output_tokens: 1 },
}) as Anthropic.Message;
const c: Case = { id: "new-ticket", title: "Chargeable repair invoice", details: "Flat 6", request: "Please obtain the repair invoice.",
  events: [
    { n: 1, at: "2026-10-10 10:00:00 UTC", channel: "Email", from: "Contractor", to: "Agency", body: "The repair is complete; I will send the invoice tomorrow.", attachments: [] },
    { n: 2, at: "2026-10-11 10:00:00 UTC", channel: "Email", from: "Landlord", to: "Agency", body: "HIDDEN_FUTURE_CANARY all checks passed", attachments: [] },
  ], attachments: [], layer: "strict" };
const selection = { selections: [{ playbook_id: "PB12", step_ids: ["invoice"], reason: "Missing invoice", current_evidence_ids: ["event:1"] }] };

test("submission uses auto for models that reject forced tool choice", () => {
  assert.deepEqual(submissionToolChoice("claude-sonnet-5-5", "select_references"), { type: "auto" });
  assert.deepEqual(submissionToolChoice("claude-haiku-4-5-20251001", "select_references"), { type: "tool", name: "select_references" });
});

test("bank validates all references and strips historical records before retrieval", () => {
  assert.equal(bank.playbooks.length, 12);
  const raw = JSON.parse(readFileSync("docs/playbooks/property-management-playbooks.json", "utf8"));
  raw.playbooks[0].source_references.canary = { finding: "HISTORICAL_FACT_CANARY" };
  raw.playbooks[0].representative_examples.push({ summary: "HISTORICAL_FACT_CANARY" });
  assert.doesNotMatch(JSON.stringify(parsePlaybookBank(raw)), /HISTORICAL_FACT_CANARY|source_references|provenance|representative_examples|case_ids/);
});

test("retrieval ignores case identity, excludes unreviewed definitions and supports no match", () => {
  const allCandidate = { ...bank, playbooks: bank.playbooks.map((b) => ({ ...b, status: "candidate" })) };
  assert.deepEqual(retrievePlaybooks(allCandidate, "repair quote invoice"), []);
  assert.deepEqual(retrievePlaybooks(bank, "portal authentication help"), []);
  assert.deepEqual(retrievePlaybooks(bank, "Property Management/021"), []);
  const ids = retrievePlaybooks(bank, "contractor repair quote invoice").map((b) => b.id);
  assert.ok(ids.includes("PB09") && ids.includes("PB12"));
  assert.ok(ids.length <= 4);
});

test("selector cannot add an unavailable playbook, step or unavailable evidence", () => {
  const candidates = retrievePlaybooks(bank, "invoice complete");
  assert.deepEqual(validateSelection(selection, candidates, [{ id: "event:1", text: c.events[0].body }]), selection);
  for (const value of [
    { selections: [{ ...selection.selections[0], playbook_id: "PB07" }] },
    { selections: [{ ...selection.selections[0], step_ids: ["does-not-exist"] }] },
    { selections: [{ ...selection.selections[0], current_evidence_ids: ["event:2"] }] },
  ]) assert.throws(() => validateSelection(value, candidates, [{ id: "event:1", text: c.events[0].body }]));
  const refs = JSON.stringify(projectReferences(candidates, selection));
  assert.doesNotMatch(refs, /Missing invoice|source_references|representative_examples|provenance/);
  assert.match(refs, /decision_checks/);
});

test("retrieval errors and invalid selectors fall back to the ordinary agent", async () => {
  for (const client of [
    { messages: { create: async () => { throw new Error("selector unavailable"); } } } as ModelClient,
    { messages: { create: async () => response("select_references", { selections: [{ ...selection.selections[0], step_ids: ["missing"] }] }) } } as ModelClient,
  ]) {
    const trace: string[] = [];
    const ctx = await playbookContext({ options: {}, client, model: "fake", policy: "policy", query: "invoice complete", currentEvidence: [{ id: "event:1", text: c.events[0].body }],
      trace: (kind) => trace.push(kind), turn: 1 });
    assert.equal(ctx, ""); assert.deepEqual(trace, ["playbook_error"]);
  }
});

test("loop injects selected steps, never hidden events or historical examples, and keeps one business action", async () => {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: ModelClient = { messages: { create: async (p) => {
    calls.push(p);
    if (p.tools?.some((t) => "name" in t && t.name === "select_references")) return response("select_references", selection);
    return response("hold", { waiting_for: "Waiting for Provider", reason: "Invoice pending [event 001]" });
  } } };
  const state = newState(c.id, 1);
  await runCase({ c, state, newFrom: 1, client, model: "fake", policy: "policy", singleStep: true, playbooks: {}, trace: () => {} });
  assert.equal(calls.length, 2);
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0].tool, "hold");
  assert.match(JSON.stringify(calls[1].system), /Workflow references/);
  assert.doesNotMatch(JSON.stringify(calls), /HIDDEN_FUTURE_CANARY|source_references|provenance|representative_examples/);
  assert.equal(state.approvalOnFile, false);
});

test("a later loop turn reassesses references after the executed tool result", async () => {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  let actorTurns = 0, selectors = 0;
  const client: ModelClient = { messages: { create: async (p) => {
    calls.push(p);
    if (p.tools?.some((t) => "name" in t && t.name === "select_references")) { selectors++; return response("select_references", selectors === 1 ? selection : { selections: [] }); }
    return ++actorTurns === 1 ? response("send_message", { to: "contractor", channel: "email", text: "Please send the invoice.", reason: "[event 001]" }) : response("hold", { waiting_for: "Waiting for Provider", reason: "Invoice requested." });
  } } };
  await runCase({ c, state: newState(c.id, 1), newFrom: 1, client, model: "fake", policy: "policy", playbooks: {}, trace: () => {} });
  assert.equal(selectors, 2);
  assert.match(JSON.stringify(calls[2].messages), /send_message.*queued in the outbox/);
  assert.doesNotMatch(JSON.stringify(calls[3].system), /Workflow references/);
});

test("a single-step retry after prose still permits the needed message action", async () => {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: ModelClient = { messages: { create: async (p) => {
    calls.push(p);
    return calls.length === 1 ? { ...response("hold", {}), content: [{ type: "text", text: "The invoice needs to be requested.", citations: null }] } :
      response("send_message", { to: "contractor", channel: "email", text: "Please send the invoice.", reason: "[event 001]" });
  } } };
  const state = newState(c.id, 1);
  await runCase({ c, state, newFrom: 1, client, model: "fake", policy: "policy", singleStep: true, trace: () => {} });
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0].tool, "send_message");
  assert.equal(state.status.kind, "open");
  assert.doesNotMatch(JSON.stringify(calls[1].messages.at(-1)), /exactly one of hold, escalate or close_case/);
});

test("MCP run and resume use playbooks without consuming business actions or exposing later events", async () => {
  let selections = 0;
  const client: ModelClient = { messages: { create: async (p) => {
    if (p.tools?.some((t) => "name" in t && t.name === "select_references")) { selections++; return response("select_references", { selections: [] }); }
    return response("hold", { waiting_for: "Waiting for Tenant", reason: "Awaiting result." });
  } } };
  const out = mkdtempSync(join(tmpdir(), "playbook-mcp-"));
  const server = createServer({ casesDir: "data/public/Property Management", deps: { out, client, model: "fake", policy: "policy", playbooks: {} } });
  const mcp = new Client({ name: "test", version: "1" });
  const [a,b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), mcp.connect(b)]);
    await mcp.callTool({ name: "run_case", arguments: { case_id: "027", step: 1 } });
    await mcp.callTool({ name: "resume_case", arguments: { case_id: "027" } });
    const state = JSON.parse(readFileSync(join(out,"state/027.json"),"utf8"));
    assert.equal(state.runs, 2); assert.equal(state.actions.length, 2); assert.equal(selections, 2);
  } finally { await mcp.close(); await server.close(); }
});

test("eval projection isolates the input from expected results, derivation and future history", () => {
  const suite = JSON.parse(readFileSync("evals/playbooks/samples.json", "utf8"));
  for (const sample of suite.samples as Sample[]) {
    const projected = projectSample(sample);
    assert.doesNotMatch(JSON.stringify(projected.c), /HIDDEN_FUTURE_CANARY|derivation|expected|retrieval_expectation/);
    assert.ok(projected.c.events.every((e) => e.n <= sample.input.step));
  }
  assert.throws(() => validateEvidence({ test_case: { id: "test" }, actual_output: { action: "hold" }, expected_results: {} as ExpectedResults },
    { source: "expected_results", pointer: "/required_outcomes/0", quote: "hidden" } as never));
});

test("a false-positive shortlist can be rejected without putting guidance into context", async () => {
  const trace: Record<string, unknown>[] = [];
  const client: ModelClient = { messages: { create: async () => response("select_references", { selections: [] }) } };
  const ctx = await playbookContext({ options: {}, client, model: "fake", policy: "policy", query: "reset portal password",
    currentEvidence: [{ id: "request", text: "Please help with my portal password." }], trace: (kind,data) => trace.push({ kind,...data }), turn: 1 });
  assert.equal(ctx, ""); assert.equal(trace[0].kind, "playbook_selection");
  assert.ok((trace[0].candidates as string[]).length > 0);
  assert.deepEqual(trace[0].selections, []);
});

test("judge evidence index and reference catalogue expose no expected facts or source records", () => {
  const input = { test_case: { id: "case", current_evidence: "Observed facts" },
    expected_results: { required_outcomes: [{ id: "required", description: "EXPECTED_CANARY" }] } as ExpectedResults,
    actual_output: { actions: [{ tool: "hold", ok: true, input: { waiting_for: "Waiting for Provider" } }] } };
  const pointers = evidencePointers(input);
  assert.ok(pointers.some((p) => p.pointer === "/actions/0/input/waiting_for"));
  assert.doesNotMatch(JSON.stringify(pointers), /expected_results|EXPECTED_CANARY/);
  assert.deepEqual(Object.keys(referenceCatalogue()[0]).sort(), ["id","role","title"]);
});

test("paired statistics keep unassessed decisions out of gains and regressions", () => {
  const base = { id: "case", trial: 1, duration_ms: 1, model_requests: 1, input_tokens: 1, output_tokens: 1,
    selector_errors: 0, retrieval_match: null, judge: { score: 100 }, pass: true };
  const rows = [{ ...base, arm: "baseline" }, { ...base, arm: "playbooks", judge: null, pass: null }] as unknown as Trial[];
  const stats = summarize(rows);
  assert.equal(stats.paired_assessed, 0); assert.equal(stats.improved, 0); assert.equal(stats.regressed, 0);
  assert.equal(stats.arms.playbooks.unassessed, 1); assert.equal(stats.arms.playbooks.pass_rate, null);
});
