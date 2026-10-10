import { test } from "node:test";
import assert from "node:assert/strict";
import { newState } from "../src/state.ts";
import { runTool, TOOL_SPECS } from "../src/tools.ts";

const closeInput = {
  outcome: "resolved_without_work",
  work_confirmed_by: "tenant [event 007]",
  landlord_informed: false,
  keys: "not_issued",
  invoice: "not_required",
  reason: "Tenant cleared the drain with a plunger [event 007].",
};

test("hold ends the run and records what the case waits for", () => {
  const s = newState("027", 1);
  const out = runTool("hold", { waiting_for: "Waiting for Tenant", reason: "Asked tenant to try a plunger." }, s);
  assert.deepEqual(out, { ok: true, ends: true, result: "case on hold: Waiting for Tenant" });
  assert.deepEqual(s.status, { kind: "hold", reason: "Waiting for Tenant" });
});

test("work tools do not end the run", () => {
  const s = newState("027", 1);
  const out = runTool("send_message", { to: "tenant", channel: "email", text: "Please try a plunger.", reason: "[event 001]" }, s);
  assert.equal(out.ok, true);
  assert.equal(out.ends, false);
  assert.deepEqual(s.status, { kind: "open" });
});

test("close_case refuses while keys are outstanding", () => {
  const s = newState("027", 1);
  const out = runTool("close_case", { ...closeInput, keys: "outstanding" }, s);
  assert.equal(out.ok, false);
  assert.equal(out.ends, false);
  assert.match(out.result, /^refused: keys are outstanding/);
  assert.deepEqual(s.status, { kind: "open" });
});

test("close_case records the final checks without the reason", () => {
  const s = newState("027", 1);
  const out = runTool("close_case", closeInput, s);
  assert.equal(out.ends, true);
  assert.equal(s.status.kind, "closed");
  assert.ok(s.status.kind === "closed" && !("reason" in s.status.checks));
});

test("bad input goes back as text that names the field", () => {
  const s = newState("027", 1);
  const out = runTool("send_message", { to: "plumber", channel: "email", text: "x", reason: "r" }, s);
  assert.equal(out.ok, false);
  assert.match(out.result, /^invalid input:/);
  assert.match(out.result, /at to/);
});

test("an unknown tool is an error, not a crash", () => {
  const out = runTool("delete_case", {}, newState("027", 1));
  assert.deepEqual(out, { ok: false, ends: false, result: 'unknown tool "delete_case"' });
});

test("every tool spec requires a reason", () => {
  assert.equal(TOOL_SPECS.length, 7);
  for (const t of TOOL_SPECS) assert.ok((t.input_schema.required ?? []).includes("reason"), t.name);
});

test("send_message refuses text that cites events, so outside parties never see internal references", () => {
  const s = newState("027", 1);
  const out = runTool("send_message", { to: "tenant", channel: "email", text: "The plunger cleared it [event 007].", reason: "[event 007]" }, s);
  assert.equal(out.ok, false);
  assert.match(out.result, /^refused: the message text contains an event reference/);
});

const assignInput = { trade: "plumber", notes: "", reason: "Landlord approved [event 005]." };

test("assign_contractor refuses when no landlord approval is on file", () => {
  const s = newState("027", 1);
  s.runs = 1;
  const out = runTool("assign_contractor", assignInput, s);
  assert.equal(out.ok, false);
  assert.match(out.result, /^refused: landlord approval is not on file/);
});

test("assign_contractor refuses an approval request made in the same run", () => {
  const s = newState("027", 1);
  s.runs = 1;
  s.actions.push({ run: 1, afterEvent: 1, tool: "request_landlord_approval", input: {}, ok: true, result: "sent" });
  assert.equal(runTool("assign_contractor", assignInput, s).ok, false);
});

test("assign_contractor accepts an approval request from an earlier run once the landlord answered", () => {
  const s = newState("027", 1);
  s.runs = 2;
  s.landlordReplied = true;
  s.actions.push({ run: 1, afterEvent: 1, tool: "request_landlord_approval", input: {}, ok: true, result: "sent" });
  assert.equal(runTool("assign_contractor", assignInput, s).ok, true);
});

test("assign_contractor refuses while the landlord has not answered an earlier request", () => {
  const s = newState("027", 1);
  s.runs = 2;
  s.actions.push({ run: 1, afterEvent: 1, tool: "request_landlord_approval", input: {}, ok: true, result: "sent" });
  const out = runTool("assign_contractor", assignInput, s);
  assert.equal(out.ok, false);
  assert.match(out.result, /landlord has not answered/);
});

test("assign_contractor accepts an approval the agency recorded before the first run", () => {
  const s = newState("004", 4);
  s.runs = 1;
  s.approvalOnFile = true;
  assert.equal(runTool("assign_contractor", assignInput, s).ok, true);
});

test("an adapter cannot skip the approval check", () => {
  const s = newState("027", 1);
  s.runs = 1;
  const out = runTool("assign_contractor", assignInput, s, { assign_contractor: () => "assigned by API" });
  assert.equal(out.ok, false);
});

test("escalate requires all three handover fields and stores them", () => {
  const s = newState("027", 1);
  const bad = runTool("escalate", { checked: "the events [event 001]", missing_or_conflict: "two reports conflict", decision_needed: "", reason: "r" }, s);
  assert.equal(bad.ok, false);
  assert.match(bad.result, /decision_needed/);

  const out = runTool("escalate", {
    checked: "the events [event 001]",
    missing_or_conflict: "two reports conflict",
    decision_needed: "refund or escalate to legal",
    reason: "r",
  }, s);
  assert.equal(out.ok, true);
  assert.equal(out.ends, true);
  assert.ok(s.status.kind === "escalated");
  if (s.status.kind === "escalated") {
    assert.equal(s.status.missing_or_conflict, "two reports conflict");
    assert.match(s.status.summary, /Checked: the events \[event 001\]/);
    assert.match(s.status.summary, /Decision needed: refund or escalate to legal/);
  }
});
