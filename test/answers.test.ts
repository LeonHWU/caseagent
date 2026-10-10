import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAnswer } from "../src/answers.ts";
import { visibleEvents } from "../src/cut.ts";
import { loadCase } from "../src/parse.ts";
import { newState } from "../src/state.ts";

test("ANSWER.md and REASONING.md cover input, actions, failures and status", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 1;
  s.actions = [
    { run: 1, afterEvent: 1, tool: "close_case", input: { reason: "too early" }, ok: false, result: "refused: keys are outstanding." },
    { run: 1, afterEvent: 1, tool: "send_message", input: { to: "tenant", reason: "Everyday blockage [event 001]." }, ok: true, result: "email to tenant queued in the outbox" },
    { run: 1, afterEvent: 1, tool: "hold", input: { waiting_for: "Waiting for Tenant", reason: "Awaiting the tenant." }, ok: true, result: "case on hold: Waiting for Tenant" },
  ];
  s.status = { kind: "hold", reason: "Waiting for Tenant" };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 1), ["Tenant first."]);

  const answer = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.match(answer, /^# Case 027: Blocked Bath Drain Request/);
  assert.match(answer, /\*\*Final status:\*\* hold \(Waiting for Tenant\)/);
  assert.match(answer, /\[event 001\] Update from Agency \/ system/);
  assert.match(answer, /\| 1 \| 1 \| send_message \| ok \|/);
  assert.match(answer, /## Escalation\n\nNone\./);
  assert.match(answer, /## Failed or refused actions\n\n- close_case: refused: keys are outstanding\./);

  const reasoning = readFileSync(join(out, "ANSWERS/027/REASONING.md"), "utf8");
  assert.match(reasoning, /### Run 1 · send_message\n\nEveryday blockage \[event 001\]\./);
  assert.match(reasoning, /## Agent notes from the latest run\n\nTenant first\./);
});
