import { test } from "node:test";
import assert from "node:assert/strict";
import { isAgency, loadCase } from "../src/parse.ts";

const PM = "data/public/Property Management";

test("case 027: parses all 17 events with channel, sender and body", () => {
  const c = loadCase(`${PM}/027`);
  assert.equal(c.id, "027");
  assert.equal(c.title, "Blocked Bath Drain Request");
  assert.equal(c.events.length, 17);
  assert.deepEqual(c.events.map((e) => e.n), Array.from({ length: 17 }, (_, i) => i + 1));
  const e7 = c.events[6];
  assert.equal(e7.channel, "Email");
  assert.equal(e7.from, "Tenant");
  assert.equal(e7.at, "2026-04-28 01:36:58 UTC");
  assert.match(e7.body, /its now clear/);
  assert.doesNotMatch(e7.body, /\*\*Channel:\*\*/);
});

test("case 027: hides every section that reveals the ending", () => {
  const c = loadCase(`${PM}/027`);
  const visible = JSON.stringify({ details: c.details, request: c.request });
  assert.doesNotMatch(visible, /Overview|Outcome|plunger had cleared/);
  assert.doesNotMatch(c.details, /Status|Completed|Updated/);
  assert.match(c.details, /Flat 10, 30 Copperfield Walk/);
  assert.match(c.request, /water keep take hours/);
});

test("case 003: lists attachments by file name", () => {
  const c = loadCase(`${PM}/003`);
  assert.equal(c.events.length, 23);
  assert.deepEqual(c.attachments, [
    "attachment-01-checkout-inspection-report.pdf",
    "attachment-02-cleaning-invoice.pdf",
  ]);
});

test("isAgency: Northbridge and the system are the agency, everyone else is outside", () => {
  for (const from of ["Agency / system", "Northbridge Lettings", "Northbridge Lettings system"]) assert.equal(isAgency(from), true, from);
  for (const from of ["Tenant", "Landlord", "Contractor", "Maintenance provider", "Juniper Surveying"]) assert.equal(isAgency(from), false, from);
});
