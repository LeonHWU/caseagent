import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp.ts';
import { loadCase } from '../../src/parse.ts';
import { TOOL_SPECS } from '../../src/tools.ts';
import type { ModelClient } from '../../src/agent.ts';
import type { CaseState } from '../../src/state.ts';

type Ref = { event: number; file: string; anchor: string; start_line: number; excerpt: string };
type Sample = {
  id: string; case_id: string; step: number; label_source: string;
  input: { cases_dir: string; case_dir: string; visible_events: number[]; mcp_call: { name: string; arguments: { case_id: string; step: number } } };
  expected: { acceptable_actions: { tool: string; exact_arguments: Record<string, unknown>; semantic_requirements: { weight: number }[] }[] };
  provenance: { source_index: string; source_history: string; source_index_sha256: string; source_history_sha256: string; input_evidence: Ref[]; reference_actions: Ref[]; derivation: string };
};
const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as { sample_count: number; samples: { id: string; sample: string }[] };
const sourceDir = process.argv[2] ? resolve(process.argv[2]) : null;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
assert.equal(manifest.samples.length, 10);
assert.equal(manifest.sample_count, 10);
assert.equal(new Set(manifest.samples.map((x) => x.id)).size, 10);

for (const item of manifest.samples) {
  const sample = JSON.parse(readFileSync(join(root, item.sample), 'utf8')) as Sample;
  assert.equal(sample.id, item.id);
  assert.equal(sample.label_source, 'historical_reference');
  assert.equal(sample.input.mcp_call.name, 'run_case');
  assert.deepEqual(sample.input.mcp_call.arguments, { case_id: sample.case_id, step: sample.step });
  const fixture = join(root, sample.input.case_dir);
  const c = loadCase(fixture);
  assert.equal(c.id, sample.case_id);
  assert.deepEqual(c.events.map((e) => e.n), sample.input.visible_events);
  assert.equal(c.events.at(-1)?.n, sample.step);
  assert.equal(c.attachments.length, 0);
  const inputIndex = readFileSync(join(fixture, 'index.md'), 'utf8');
  assert.doesNotMatch(inputIndex, /^## (Overview|Outcome|Next action at escalation)|\*\*(Status|Updated|Completed):\*\*/m);
  assert.ok(sample.provenance.derivation);
  for (const ref of sample.provenance.input_evidence) {
    assert.ok(ref.event <= sample.step);
    assert.equal(c.events.find((e) => e.n === ref.event)?.body, ref.excerpt);
  }
  for (const ref of sample.provenance.reference_actions) assert.ok(ref.event > sample.step);
  for (const expected of sample.expected.acceptable_actions) {
    const tool = TOOL_SPECS.find((t) => t.name === expected.tool);
    assert.ok(tool, `unknown tool ${expected.tool}`);
    const properties = tool.input_schema.properties as Record<string, { enum?: unknown[] }>;
    for (const [name, value] of Object.entries(expected.exact_arguments)) {
      assert.ok(name in properties);
      if (properties[name].enum) assert.ok(properties[name].enum!.includes(value));
    }
    assert.ok(expected.semantic_requirements.every((r) => r.weight > 0));
  }
  if (sourceDir) {
    const originalIndex = readFileSync(join(sourceDir, sample.provenance.source_index), 'utf8');
    const originalHistory = readFileSync(join(sourceDir, sample.provenance.source_history), 'utf8');
    assert.equal(sha(originalIndex), sample.provenance.source_index_sha256);
    assert.equal(sha(originalHistory), sample.provenance.source_history_sha256);
    for (const ref of [...sample.provenance.input_evidence, ...sample.provenance.reference_actions]) {
      assert.equal(originalHistory.split('\n')[ref.start_line - 1], `<a id="${ref.anchor}"></a>`);
      assert.ok(originalHistory.includes(ref.excerpt));
    }
  }

  // Validate the actual MCP boundary with a fake model. This is NOT an agent accuracy run.
  let calls = 0;
  const fake: ModelClient = { messages: { create: async (p) => {
    calls++;
    const prompt = JSON.stringify(p.messages);
    for (const match of prompt.matchAll(/\[event (\d+)\]/g)) assert.ok(Number(match[1]) <= sample.step);
    assert.ok(!prompt.includes('reference_actions'));
    assert.ok(!prompt.includes('semantic_requirements'));
    return { content: [{ type: 'tool_use', id: 'validation', name: 'hold', input: { waiting_for: 'Waiting for Tenant', reason: 'Fixture validation only.' } }], stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } } as unknown as Anthropic.Message;
  } } };
  const out = mkdtempSync(join(tmpdir(), 'process-eval-validation-'));
  const server = createServer({ casesDir: join(root, sample.input.cases_dir), deps: { out, client: fake, model: 'fixture-validation', policy: 'Fixture validation only.' } });
  const client = new Client({ name: 'process-eval-validation', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    const result = await client.callTool(sample.input.mcp_call);
    assert.ok(!result.isError);
    assert.equal(calls, 1);
    const state = JSON.parse(readFileSync(join(out, 'state', `${sample.case_id}.json`), 'utf8')) as CaseState;
    assert.equal(state.seen, sample.step);
    assert.equal(state.actions.length, 1);
    assert.ok(readFileSync(join(out, 'ANSWERS', sample.case_id, 'ANSWER.md'), 'utf8'));
    assert.ok(readFileSync(join(out, 'ANSWERS', sample.case_id, 'REASONING.md'), 'utf8'));
  } finally {
    await client.close();
    await server.close();
    rmSync(out, { recursive: true, force: true });
  }
  process.stdout.write(`OK ${sample.id}: case ${sample.case_id}, step ${sample.step}\n`);
}
process.stdout.write('10 fixtures validated through MCP; no live model calls or agent accuracy scores.\n');
