import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { MAX_TURNS, runCase, type ModelClient } from "../src/agent.ts";
import { loadCase } from "../src/parse.ts";
import { renderCase } from "../src/prompt.ts";
import { visibleEvents } from "../src/cut.ts";
import { processCase, processToEnd } from "../src/run.ts";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newState } from "../src/state.ts";

const c = loadCase("data/public/Property Management/027");

function use(id: string, name: string, input: Record<string, unknown>): Anthropic.ContentBlock {
  return { type: "tool_use", id, name, input } as unknown as Anthropic.ContentBlock;
}

function text(t: string): Anthropic.ContentBlock {
  return { type: "text", text: t } as unknown as Anthropic.ContentBlock;
}

function fake(turns: Anthropic.ContentBlock[][]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: ModelClient = {
    messages: {
      create: async (p) => {
        calls.push(structuredClone(p));
        const content = turns[Math.min(calls.length - 1, turns.length - 1)];
        return { id: "m", type: "message", role: "assistant", model: "fake", content, stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as unknown as Anthropic.Message;
      },
    },
  };
  return { calls, client };
}

const base = { c, newFrom: 1, model: "fake", policy: "policy", trace: () => {} };

test("prompt for run 1 shows the request and event 001 only", async () => {
  const s = newState("027", 1);
  const p = await renderCase(c, s, visibleEvents(c, 1, 1), 1);
  assert.match(p.text, /water keep take hours/);
  assert.match(p.text, /\[event 001\]/);
  assert.doesNotMatch(p.text, /\[event 002\]/);
  assert.match(p.text, /None\. This is the first run on this case\./);
});

test("the run stops at the first end tool", async () => {
  const s = newState("027", 1);
  const { calls, client } = fake([[
    text("Everyday blockage, tenant first."),
    use("a", "send_message", { to: "tenant", channel: "email", text: "Please try a plunger.", reason: "[event 001]" }),
    use("b", "hold", { waiting_for: "Waiting for Tenant", reason: "Awaiting the tenant's answer." }),
  ]]);
  await runCase({ ...base, state: s, client });
  assert.equal(calls.length, 1);
  assert.deepEqual(s.status, { kind: "hold", reason: "Waiting for Tenant" });
  assert.deepEqual(s.actions.map((a) => a.tool), ["send_message", "hold"]);
  assert.deepEqual(s.notes.map((n) => n.text), ["Everyday blockage, tenant first."]);
  assert.equal(s.runs, 1);
});

test("a refused tool goes back to the model as an error and the model recovers", async () => {
  const s = newState("027", 1);
  const { calls, client } = fake([
    [use("a", "close_case", { outcome: "work_completed", work_confirmed_by: "provider", landlord_informed: true, keys: "outstanding", invoice: "on_file", reason: "r" })],
    [use("b", "hold", { waiting_for: "Waiting for Provider", reason: "Keys not back yet." })],
  ]);
  await runCase({ ...base, state: s, client });
  assert.equal(calls.length, 2);
  const last = calls[1].messages.at(-1)!;
  assert.ok(Array.isArray(last.content));
  const block = last.content[0] as Anthropic.ToolResultBlockParam;
  assert.equal(block.is_error, true);
  assert.match(String(block.content), /refused: keys are outstanding/);
  assert.deepEqual(s.status, { kind: "hold", reason: "Waiting for Provider" });
});

test("a model that never ends the run is escalated to a person", async () => {
  const s = newState("027", 1);
  const { calls, client } = fake([[text("Thinking about it.")]]);
  await runCase({ ...base, state: s, client });
  assert.equal(calls.length, MAX_TURNS);
  assert.equal(s.incomplete, true);
  assert.equal(s.status.kind, "escalated");
  assert.match(String(calls[1].messages.at(-1)!.content), /End the run now/);
});

test("processToEnd: hold, then close, then stop before the later events", async () => {
  const f = fake([
    [use("a", "hold", { waiting_for: "Waiting for Tenant", reason: "Asked the tenant to try a plunger." })],
    [use("b", "close_case", { outcome: "resolved_without_work", work_confirmed_by: "tenant", landlord_informed: false, keys: "not_issued", invoice: "not_required", reason: "Tenant resolved it." })],
    [use("c", "hold", { waiting_for: "Waiting for Tenant", reason: "Should never run." })],
  ]);
  const out = mkdtempSync(join(tmpdir(), "to-end-"));
  const state = await processToEnd({ out, client: f.client, model: "fake", policy: "policy" }, "data/public/Property Management/027");
  assert.equal(state.status.kind, "closed");
  assert.equal(state.runs, 2);
  assert.equal(f.calls.length, 2);
  assert.ok(state.seen < c.events.length, "events after the close must not run");
  const trace = readFileSync(join(out, "traces", "027.jsonl"), "utf8");
  assert.equal(trace.match(/"kind":"run_start"/g)?.length, 2);
  assert.match(readFileSync(join(out, "ANSWERS", "027", "ANSWER.md"), "utf8"), /Run 2/);
});

test("a failing tool comes back as an error; the model retries and the run completes", async () => {
  const s = newState("027", 1);
  let calls = 0;
  const adapters = {
    send_message: (input: Record<string, unknown>) => {
      if (++calls === 1) throw new Error("timeout");
      return `${input.channel} to ${input.to} queued in the outbox`;
    },
  };
  const send = { to: "tenant", channel: "email", text: "Please try a plunger.", reason: "[event 001]" };
  const f = fake([
    [use("a", "send_message", send)],
    [use("b", "send_message", send)],
    [use("c", "hold", { waiting_for: "Waiting for Tenant", reason: "Awaiting the tenant." })],
  ]);
  await runCase({ ...base, state: s, client: f.client, adapters });
  assert.deepEqual(s.actions.map((a) => [a.tool, a.ok]), [["send_message", false], ["send_message", true], ["hold", true]]);
  assert.equal(s.actions[0].result, "failed: timeout");
  const back = f.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
  assert.equal(back[0].is_error, true);
  assert.equal(back[0].content, "failed: timeout");
  assert.equal(s.status.kind, "hold");
});

test("a tool that fails twice is escalated by the model, and both failures are recorded", async () => {
  const s = newState("027", 1);
  const adapters = { send_message: () => { throw new Error("provider error"); } };
  const send = { to: "tenant", channel: "email", text: "Please try a plunger.", reason: "[event 001]" };
  const f = fake([
    [use("a", "send_message", send)],
    [use("b", "send_message", send)],
    [use("c", "escalate", { checked: "the outbox and the tool errors", missing_or_conflict: "send_message failed twice (provider error)", decision_needed: "a person must contact the tenant", reason: "Tool failed twice." })],
  ]);
  await runCase({ ...base, state: s, client: f.client, adapters });
  assert.deepEqual(s.actions.map((a) => a.ok), [false, false, true]);
  assert.ok(s.status.kind === "escalated");
  assert.match(s.status.summary, /send_message failed twice/);
});

test("a fresh run keeps the previous trace instead of overwriting it", async () => {
  const out = mkdtempSync(join(tmpdir(), "trace-"));
  const hold = () => fake([[use("a", "hold", { waiting_for: "Waiting for Tenant", reason: "Waiting." })]]).client;
  for (let i = 0; i < 2; i++) await processCase({ out, client: hold(), model: "fake", policy: "policy" }, "data/public/Property Management/027", false);
  const files = readdirSync(join(out, "traces")).sort();
  assert.equal(files.length, 2);
  assert.ok(files.includes("027.jsonl"));
  for (const f of files) assert.match(readFileSync(join(out, "traces", f), "utf8"), /"kind":"run_start"/);
});
