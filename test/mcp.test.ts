import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ModelClient } from "../src/agent.ts";
import { createServer } from "../src/mcp.ts";

type Input = Record<string, unknown>;

function scripted(endings: [string, Input][]): ModelClient {
  let i = 0;
  return {
    messages: {
      create: async () => {
        const [name, input] = endings[i++];
        const content = [{ type: "tool_use", id: `t${i}`, name, input }];
        return { id: "m", type: "message", role: "assistant", model: "fake", content, stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as unknown as Anthropic.Message;
      },
    },
  };
}

async function connect(client: ModelClient) {
  const out = mkdtempSync(join(tmpdir(), "mcp-"));
  const server = createServer({ casesDir: "data/public/Property Management", deps: { out, client, model: "fake", policy: "policy" } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

function text(r: Awaited<ReturnType<Client["callTool"]>>): string {
  return (r.content as { type: string; text: string }[]).map((c) => c.text).join("\n");
}

test("lists the four case tools", async () => {
  const mcp = await connect(scripted([]));
  const { tools } = await mcp.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["get_case", "list_cases", "resume_case", "run_case"]);
});

test("list_cases returns the public case ids", async () => {
  const mcp = await connect(scripted([]));
  const ids = text(await mcp.callTool({ name: "list_cases", arguments: {} })).split("\n");
  assert.equal(ids.length, 50);
  assert.equal(ids[0], "001");
});

test("run_case, resume_case and get_case drive case 027 end to end", async () => {
  const mcp = await connect(
    scripted([
      ["hold", { waiting_for: "Waiting for Tenant", reason: "Asked tenant to try a plunger [event 001]." }],
      ["close_case", { outcome: "resolved_without_work", work_confirmed_by: "tenant [event 007]", landlord_informed: false, keys: "not_issued", invoice: "not_required", reason: "Drain clear [event 007]." }],
    ]),
  );
  assert.match(text(await mcp.callTool({ name: "run_case", arguments: { case_id: "027" } })), /^027: hold \(Waiting for Tenant\)/);
  assert.match(text(await mcp.callTool({ name: "resume_case", arguments: { case_id: "027" } })), /^027: closed \(resolved_without_work\)/);
  assert.match(text(await mcp.callTool({ name: "get_case", arguments: { case_id: "027" } })), /\*\*Final status:\*\* closed \(resolved_without_work\)/);
});

test("errors come back as tool errors, not crashes", async () => {
  const mcp = await connect(scripted([]));
  const bad = await mcp.callTool({ name: "run_case", arguments: { case_id: "../secrets" } });
  assert.equal(bad.isError, true);
  const missing = await mcp.callTool({ name: "get_case", arguments: { case_id: "999" } });
  assert.equal(missing.isError, true);
  assert.match(text(missing), /case 999 does not exist/);
  const unrun = await mcp.callTool({ name: "resume_case", arguments: { case_id: "001" } });
  assert.equal(unrun.isError, true);
  assert.match(text(unrun), /no saved state/);
});
