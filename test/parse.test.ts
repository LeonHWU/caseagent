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

test("strict parser: loads case with standard format", () => {
  const c = loadCase("test/fixtures/strict");
  assert.equal(c.id, "strict");
  assert.equal(c.layer, "strict");
  assert.equal(c.events.length, 2);
  assert.doesNotMatch(JSON.stringify(c), /Outcome|Overview/);
});

test("lenient parser: loads case with relaxed formatting", () => {
  const c = loadCase("test/fixtures/lenient");
  assert.equal(c.id, "lenient");
  assert.equal(c.layer, "lenient");
  assert.equal(c.events.length, 2);
  assert.doesNotMatch(JSON.stringify(c), /Outcome|Overview/);
});

test("loose parser: loads case from separate files", () => {
  const c = loadCase("test/fixtures/loose");
  assert.equal(c.id, "loose");
  assert.equal(c.layer, "loose");
  assert.equal(c.events.length, 2);
  assert.match(c.events[0].body, /leak/i);
});

test("raw parser: loads case from unstructured content with stripping", () => {
  const c = loadCase("test/fixtures/raw");
  assert.equal(c.id, "raw");
  assert.equal(c.layer, "raw");
  assert.equal(c.events.length, 1);
  assert.doesNotMatch(c.details, /Overview|Resolution|Summary|Status|Completed/);
  assert.doesNotMatch(c.details, /broken pipe|PVC|case is resolved|satisfied|should be hidden/i);
  assert.match(c.details, /Water was found pooling|water damage/i);
});

test("unreadable folder fails with error message", () => {
  assert.throws(
    () => loadCase("test/fixtures/unreadable"),
    (e) => String(e).includes("could not load case")
  );
});

test("case 003: extracts attachment links from events", () => {
  const c = loadCase(`${PM}/003`);
  // Event 4 should have attachment-01
  const e4 = c.events.find((e) => e.n === 4);
  assert.ok(e4);
  assert.deepEqual(e4.attachments, ["attachment-01-checkout-inspection-report.pdf"]);
  // Event 20 should have attachment-02
  const e20 = c.events.find((e) => e.n === 20);
  assert.ok(e20);
  assert.deepEqual(e20.attachments, ["attachment-02-cleaning-invoice.pdf"]);
});
