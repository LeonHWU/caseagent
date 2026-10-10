import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAnswer } from "../src/answers.ts";
import { visibleEvents } from "../src/cut.ts";
import { loadCase } from "../src/parse.ts";
import { newState } from "../src/state.ts";

test("full message text appears in outbox", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 1;
  s.actions = [
    {
      run: 1,
      afterEvent: 1,
      tool: "send_message",
      input: { to: "tenant", channel: "email", text: "Please confirm receipt of this message.", reason: "Testing" },
      ok: true,
      result: "email to tenant queued in the outbox",
    },
  ];
  s.notes = [{ run: 1, afterEvent: 1, text: "Tenant first." }];
  s.status = { kind: "hold", reason: "Waiting for Tenant" };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 1));

  const answer = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.match(answer, /## Outbox/);
  assert.match(answer, /Please confirm receipt of this message\./);
  assert.match(answer, /Run 1, to tenant, email/);
});

test("final checks appear only for closed cases", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 1;
  s.actions = [
    {
      run: 1,
      afterEvent: 1,
      tool: "close_case",
      input: {
        outcome: "work_completed",
        work_confirmed_by: "tenant [event 001]",
        landlord_informed: true,
        keys: "returned",
        invoice: "on_file",
        reason: "All done",
      },
      ok: true,
      result: "case closed",
    },
  ];
  s.status = {
    kind: "closed",
    checks: {
      outcome: "work_completed",
      work_confirmed_by: "tenant [event 001]",
      landlord_informed: true,
      keys: "returned",
      invoice: "on_file",
    },
  };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 1));

  const answer = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.match(answer, /## Final checks/);
  assert.match(answer, /\*\*Outcome\*\* \| work_completed/);
  assert.match(answer, /\*\*Keys\*\* \| returned/);
});

test("final checks do not appear for open cases", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 1;
  s.actions = [];
  s.status = { kind: "open" };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 1));

  const answer = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.doesNotMatch(answer, /## Final checks/);
});

test("each run has its own timeline block", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 2;
  s.actions = [
    { run: 1, afterEvent: 1, tool: "send_message", input: { to: "tenant", channel: "email", text: "First message", reason: "First" }, ok: true, result: "queued" },
    { run: 2, afterEvent: 2, tool: "send_message", input: { to: "tenant", channel: "email", text: "Second message", reason: "Second" }, ok: true, result: "queued" },
  ];
  s.status = { kind: "hold", reason: "Waiting for Tenant" };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 2));

  const answer = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.match(answer, /### Run 1/);
  assert.match(answer, /### Run 2/);
  assert.match(answer, /First message/);
  assert.match(answer, /Second message/);
});

test("REASONING.md groups notes by run: two runs give two note blocks", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 2;
  s.actions = [
    { run: 1, afterEvent: 1, tool: "hold", input: { waiting_for: "Waiting for Tenant", reason: "Awaiting response." }, ok: true, result: "case on hold: Waiting for Tenant" },
    { run: 2, afterEvent: 2, tool: "hold", input: { waiting_for: "Waiting for Landlord", reason: "Awaiting landlord approval." }, ok: true, result: "case on hold: Waiting for Landlord" },
  ];
  s.notes = [
    { run: 1, afterEvent: 1, text: "Tenant contacted for information." },
    { run: 2, afterEvent: 2, text: "Tenant provided details." },
  ];
  s.status = { kind: "hold", reason: "Waiting for Landlord" };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 2));
  const reasoning = readFileSync(join(out, "ANSWERS/027/REASONING.md"), "utf8");
  assert.match(reasoning, /## Run 1\n[\s\S]*Tenant contacted for information[\s\S]*## Run 2\n[\s\S]*Tenant provided details/);
  assert.doesNotMatch(reasoning.split("## Run 2")[0], /Tenant provided details/);
});

test("ANSWER.md shows the three escalation fields for an agent escalation, plain text for a system one", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 1;
  s.status = {
    kind: "escalated",
    by: "agent",
    summary: "Checked: the events [event 001]\nMissing or in conflict: two reports conflict\nDecision needed: pick a side",
    checked: "the events [event 001]",
    missing_or_conflict: "two reports conflict",
    decision_needed: "pick a side",
  };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 1));
  const answer = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.match(answer, /## Escalation\n\n- \*\*Checked:\*\* the events \[event 001\]\n- \*\*Missing or in conflict:\*\* two reports conflict\n- \*\*Decision needed:\*\* pick a side/);

  s.status = { kind: "escalated", by: "system", summary: "System error: API down. A person must review case 027." };
  writeAnswer(out, c, s, visibleEvents(c, 1, 1));
  const answer2 = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.match(answer2, /## Escalation\n\nSystem error: API down/);
});
