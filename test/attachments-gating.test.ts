import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCase } from "../src/parse.ts";
import { renderCase } from "../src/prompt.ts";
import { visibleEvents, initialSeen } from "../src/cut.ts";
import { newState } from "../src/state.ts";

const PM = "data/public/Property Management";
const c = loadCase(`${PM}/003`);
const caseDir = `${PM}/003`;

// Case 003: the agency emails the checkout report at event 4 and the cleaning invoice at event 20.
// Both carrier emails stay hidden; the documents appear once the case reaches their event.
async function promptAt(seen: number) {
  const s = newState("003", initialSeen(c));
  s.seen = seen;
  return renderCase(c, s, visibleEvents(c, s.initialSeen, seen), 1, caseDir);
}

test("case 003 run 1: no document exists yet", async () => {
  const p = await promptAt(initialSeen(c));
  assert.doesNotMatch(p.text, /attachment-0[12]/);
  assert.equal(p.documents.length, 0);
});

test("case 003 at the contractor's reply (event 7): the report is visible, the invoice is not", async () => {
  const p = await promptAt(7);
  assert.match(p.text, /### attachment-01-checkout-inspection-report\.pdf\n\nReceived with event 004/);
  assert.doesNotMatch(p.text, /attachment-02-cleaning-invoice/);
  assert.deepEqual(p.documents.map((d) => d.filename), ["attachment-01-checkout-inspection-report.pdf"]);
});

test("case 003 at the landlord's reply (event 23): both documents are visible, the carrier emails are not", async () => {
  const p = await promptAt(23);
  assert.deepEqual(p.documents.map((d) => d.filename), ["attachment-01-checkout-inspection-report.pdf", "attachment-02-cleaning-invoice.pdf"]);
  assert.doesNotMatch(p.text, /\[event 020\]/);
});
