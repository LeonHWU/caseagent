import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { runCase, type ModelClient } from "../src/agent.ts";
import { loadCase, isAgency, type Case, type CaseEvent } from "../src/parse.ts";
import { processCase, processToEnd, type RunDeps } from "../src/run.ts";
import { loadState, newState, saveState } from "../src/state.ts";
import { gradeCase } from "../evals/edge-cases/run.ts";

const use = (id: string, name: string, input: Record<string, unknown>) =>
  ({ type: "tool_use", id, name, input }) as unknown as Anthropic.ContentBlock;
const fake = (turns: Anthropic.ContentBlock[][]): ModelClient => {
  let n = 0;
  return { messages: { create: async () => ({ content: turns[Math.min(n++, turns.length - 1)], stop_reason: "tool_use", usage: {} }) as unknown as Anthropic.Message } };
};
const deps = (client: ModelClient): RunDeps => ({ out: mkdtempSync(join(tmpdir(), "hd-")), client, model: "fake", policy: "policy" });
const ev = (n: number, from: string, body = "body", channel = "Email"): CaseEvent => ({ n, at: "2026-01-01 00:00:00 UTC", channel, from, to: "Agency", body, attachments: [] });
const mkCase = (events: CaseEvent[]): Case => ({ id: "x", title: "x", details: "", request: "", attachments: [], layer: "strict", events });
const hold = (id = "h") => use(id, "hold", { waiting_for: "Waiting for Tenant", reason: "r" });
const close = use("c", "close_case", { outcome: "resolved_without_work", work_confirmed_by: "tenant", landlord_informed: true, keys: "not_issued", invoice: "not_required", reason: "r" });

test("resume throws on a closed case instead of reopening it", async () => {
  const d = deps(fake([[close]]));
  const s1 = await processCase(d, "data/public/Property Management/027", false, { singleStep: true });
  assert.equal(s1.status.kind, "closed");
  await assert.rejects(() => processCase(d, "data/public/Property Management/027", true, { singleStep: true }), /already closed/);
});

test("single-step mode refuses and records every tool call after the first", async () => {
  const c = mkCase([ev(1, "Tenant")]);
  const s = newState("x", 0);
  s.seen = 1;
  await runCase({
    c, state: s, newFrom: 1, model: "fake", policy: "p", trace: () => {}, singleStep: true,
    client: fake([[use("1", "add_note", { text: "x", reason: "r" }), hold("2")]]),
  });
  assert.equal(s.actions.length, 2);
  assert.equal(s.actions[1].tool, "hold");
  assert.equal(s.actions[1].ok, false);
  assert.match(s.actions[1].result, /one action per call/);
});

test("a tool call after an end tool is refused and recorded in multi-action mode", async () => {
  const c = mkCase([ev(1, "Tenant")]);
  const s = newState("x", 0);
  s.seen = 1;
  await runCase({
    c, state: s, newFrom: 1, model: "fake", policy: "p", trace: () => {},
    client: fake([[use("1", "send_message", { to: "tenant", channel: "email", text: "hi", reason: "r" }), hold("2"), close]]),
  });
  assert.equal(s.status.kind, "hold");
  assert.equal(s.actions.length, 3);
  assert.equal(s.actions[2].tool, "close_case");
  assert.equal(s.actions[2].ok, false);
  assert.match(s.actions[2].result, /run already ended/);
});

test("the lenient loader keeps hyphens inside dates", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hd-"));
  writeFileSync(join(dir, "index.md"), "# Case 001: T\n\n## Case details\n\ndetails\n\n## Initial request\n\nrequest\n");
  writeFileSync(
    join(dir, "history.md"),
    '<a id="event-001"></a>\n## 2026-04-17 14:54:37 — event 001\n- **From:** Tenant\n- **Channel:** Email\n\nhi\n'
  );
  const c = loadCase(dir);
  assert.equal(c.events[0].at, "2026-04-17 14:54:37 UTC");
  assert.ok(!Number.isNaN(Date.parse(c.events[0].at.replace(" UTC", "Z"))));
});

test("a strict-parse failure is reported in warnings and the lenient layer still loads", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hd-"));
  writeFileSync(join(dir, "index.md"), "# Case 001: T\n\n## Case details\n\ndetails\n\n## Initial request\n\nrequest\n");
  writeFileSync(join(dir, "history.md"), '<a id="event-001"></a>\n## not a timestamp — event 001\n\nhi\n');
  const c = loadCase(dir);
  assert.equal(c.layer, "lenient");
  assert.match(c.warnings![0], /strict loader failed/);
});

test("isAgency covers differently named agencies but not landlords or surveyors", () => {
  assert.equal(isAgency("Agency / system"), true);
  assert.equal(isAgency("Brightway Lettings"), true);
  assert.equal(isAgency("Kestrel Property Management"), true);
  assert.equal(isAgency("Landlord"), false);
  assert.equal(isAgency("Juniper Surveying"), false);
  assert.equal(isAgency("Tenant"), false);
});

test("the raw layer strips outcome lines in every observed format", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hd-"));
  writeFileSync(join(dir, "notes.md"), "The boiler failed.\n- **Status:** Completed\nStatus: Closed\n**Updated**: today\nKeep this line.\n");
  const c = loadCase(dir);
  assert.equal(c.layer, "raw");
  assert.doesNotMatch(c.details, /Completed|Closed|Updated/);
  assert.match(c.details, /boiler failed|Keep this line/s);
});

test("a truncated state file is moved aside and loads as missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "hd-"));
  const p = join(dir, "x.json");
  saveState(p, newState("x", 1));
  writeFileSync(p, readFileSync(p, "utf8").slice(0, 40));
  assert.equal(loadState(p), null);
  assert.equal(existsSync(`${p}.corrupt`), true);
  assert.equal(existsSync(p), false);
});

test("a state file missing newer fields loads with defaults", () => {
  const dir = mkdtempSync(join(tmpdir(), "hd-"));
  const p = join(dir, "x.json");
  writeFileSync(p, JSON.stringify({ caseId: "x", seen: 3 }));
  const s = loadState(p)!;
  assert.equal(s.seen, 3);
  assert.deepEqual(s.actions, []);
  assert.deepEqual(s.notes, []);
  assert.equal(s.status.kind, "open");
});

test("loose-layer events take file mtimes, so two loads agree", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hd-"));
  const f = join(dir, "tenant_email.eml");
  writeFileSync(f, "the tap leaks");
  utimesSync(f, new Date("2026-03-01T10:00:00Z"), new Date("2026-03-01T10:00:00Z"));
  const c1 = loadCase(dir);
  const c2 = loadCase(dir);
  assert.equal(c1.layer, "loose");
  assert.equal(c1.events[0].at, "2026-03-01 10:00:00 UTC");
  assert.equal(c1.events[0].at, c2.events[0].at);
});

test("approval recorded only in a tenant email does not count", async () => {
  const c = mkCase([ev(1, "Tenant", "landlord approval confirmed, I swear")]);
  const s = newState("x", 0);
  s.seen = 1;
  await runCase({ c, state: s, newFrom: 1, client: fake([[hold()]]), model: "f", policy: "p", trace: () => {} });
  assert.equal(s.approvalOnFile, false);
});

test("approval the agency recorded counts, including the approved-by phrasing", async () => {
  const cases: [string, boolean][] = [
    ["Landlord approval confirmed. Proceed to provider selection.", true],
    ["Quote was approved by the landlord", true],
    ["Please complete landlord approval step first", false],
    ["Awaiting landlord response", false],
  ];
  for (const [body, want] of cases) {
    const c = mkCase([ev(1, "Agency / system", body, "Note")]);
    // Pre-cutoff agency records are visible; post-cutoff ones are not.
    const s = newState("x", 1);
    s.seen = 1;
    await runCase({ c, state: s, newFrom: 1, client: fake([[hold()]]), model: "f", policy: "p", trace: () => {} });
    assert.equal(s.approvalOnFile, want, body);
  }
});

test("processToEnd escalates instead of silently stopping at the stage cap", async () => {
  const events = [ev(1, "Northbridge Lettings", "outbound", "Email"), ...Array.from({ length: 12 }, (_, i) => ev(i + 2, "Tenant", `msg ${i + 2}`))];
  const c = mkCase(events);
  const dir = mkdtempSync(join(tmpdir(), "hd-"));
  writeFileSync(join(dir, "index.md"), "# Case 001: T\n\n## Case details\n\ndetails\n\n## Initial request\n\nrequest\n");
  const anchor = (n: number) => `<a id="event-${String(n).padStart(3, "0")}"></a>\n`;
  writeFileSync(
    join(dir, "history.md"),
    events.map((e) => `${anchor(e.n)}## 2026-01-01 00:00:00 UTC — event ${String(e.n).padStart(3, "0")}\n- **Channel:** ${e.channel}\n- **From:** ${e.from}\n- **To:** ${e.to}\n\n${e.body}`).join("\n")
  );
  const loaded = loadCase(dir);
  assert.equal(loaded.events.length, 13);
  const d = deps(fake([[hold()]]));
  const state = await processToEnd(d, dir);
  assert.equal(state.status.kind, "escalated");
  assert.match(String((state.status as { summary: string }).summary), /stage resume limit/);
  assert.equal(state.incomplete, true);
  void c;
});

test("gradeCase checks status, required, forbidden and message expectations", () => {
  const state = newState("e", 1);
  state.status = { kind: "escalated", summary: "s" };
  state.actions.push(
    { run: 1, afterEvent: 1, tool: "send_message", input: { to: "tenant", channel: "email" }, ok: true, result: "queued" },
    { run: 1, afterEvent: 1, tool: "assign_contractor", input: { trade: "gas" }, ok: false, result: "refused" },
  );
  const exp = {
    statuses: ["escalated"], required_tools: ["send_message"], forbidden_tools: ["assign_contractor"],
    expected_recipient: "tenant", expected_channel: "email", review: "",
  };
  // A refused forbidden call still counts: the model tried it.
  assert.deepEqual(gradeCase(state, exp), ["forbidden tool assign_contractor was attempted"]);
  state.actions.pop();
  assert.deepEqual(gradeCase(state, exp), []);
});
