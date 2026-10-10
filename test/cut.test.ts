import { test } from "node:test";
import assert from "node:assert/strict";
import { initialSeen, nextSeen, visibleEvents } from "../src/cut.ts";
import { loadCase } from "../src/parse.ts";

const PM = "data/public/Property Management";

test("first run stops before the agency's first outbound message", () => {
  assert.equal(initialSeen(loadCase(`${PM}/027`)), 1); // event 002 is the agency email to the tenant
  assert.equal(initialSeen(loadCase(`${PM}/001`)), 3); // event 004 is the agency email to the landlord
});

test("--next jumps to the next event from an outside party", () => {
  const c = loadCase(`${PM}/027`);
  assert.equal(nextSeen(c, 1), 7);
  assert.equal(nextSeen(c, 7), 11);
  assert.equal(nextSeen(c, 15), null);
});

test("after the first cut the agent sees outside events only", () => {
  const c = loadCase(`${PM}/027`);
  assert.deepEqual(visibleEvents(c, 1, 1).map((e) => e.n), [1]);
  assert.deepEqual(visibleEvents(c, 1, 7).map((e) => e.n), [1, 7]);
  assert.deepEqual(visibleEvents(c, 1, 11).map((e) => e.n), [1, 7, 11]);
});
