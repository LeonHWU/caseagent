import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { MAX_TURNS, runCase, type ModelClient } from "../src/agent.ts";
import { loadCase } from "../src/parse.ts";
import { renderCase } from "../src/prompt.ts";
import { visibleEvents } from "../src/cut.ts";
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
  const thoughts = await runCase({ ...base, state: s, client });
  assert.equal(calls.length, 1);
  assert.deepEqual(s.status, { kind: "hold", reason: "Waiting for Tenant" });
  assert.deepEqual(s.actions.map((a) => a.tool), ["send_message", "hold"]);
  assert.deepEqual(thoughts, ["Everyday blockage, tenant first."]);
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
