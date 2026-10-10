import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCase } from "../src/parse.ts";
import { renderCase } from "../src/prompt.ts";
import { visibleEvents } from "../src/cut.ts";
import { newState } from "../src/state.ts";

const c = loadCase("data/public/Property Management/027");

test("prompt shows the current date as 'Now'", () => {
  const s = newState("027", 1);
  const visible = visibleEvents(c, 1, 7);
  const p = renderCase(c, s, visible, 1);
  assert.match(p, /Now: 2026-04-28 01:36:58 UTC/);
});

test("prompt shows days since last contact for each party", () => {
  const s = newState("027", 1);
  const visible = visibleEvents(c, 1, 7);
  const p = renderCase(c, s, visible, 1);
  // Event 7 is the latest visible event at 2026-04-28 01:36:58 UTC
  // Tenant's last message is event 7 (same time), so 0 days
  assert.match(p, /Days since last contact: Tenant: 0 days/);
});
