import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp.ts';
import { liveDeps } from '../../src/run.ts';
import type { CaseState } from '../../src/state.ts';

if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../..');
const out = resolve(process.argv[2] ?? join(repo, 'runs/process-eval', new Date().toISOString().replaceAll(':', '-')));
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const report: { model: string; code_revision: string; started_at: string; results: unknown[] } = {
  model: process.env.MODEL ?? 'claude-sonnet-5-5',
  code_revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  started_at: new Date().toISOString(), results: [],
};
for (const entry of manifest.samples) {
  const sample = JSON.parse(readFileSync(join(root, entry.sample), 'utf8'));
  const sampleOut = join(out, sample.id);
  const server = createServer({ casesDir: join(root, sample.input.cases_dir), deps: liveDeps(sampleOut) });
  const client = new Client({ name: 'process-eval-live', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    const response = await client.callTool(sample.input.mcp_call, undefined, { timeout: 600_000 });
    const state = JSON.parse(readFileSync(join(sampleOut, 'state', `${sample.case_id}.json`), 'utf8')) as CaseState;
    const action = state.actions[0];
    const branch = !state.incomplete && state.actions.length === 1 && action?.ok
      ? sample.expected.acceptable_actions.find((e: { tool: string; exact_arguments: Record<string, unknown> }) =>
        action.tool === e.tool && Object.entries(e.exact_arguments).every(([k, v]) => action.input[k] === v))
      : undefined;
    const record = { id: sample.id, case_id: sample.case_id, step: sample.step, incomplete: state.incomplete,
      status: state.status, actions: state.actions, structural_match: Boolean(branch),
      run_outcome: state.incomplete ? 'runtime_failure' : 'completed',
      semantic_review: state.incomplete ? 'not_run' : 'pending', score: null, expected: sample.expected,
      trace: join(sample.id, 'traces', `${sample.case_id}.jsonl`), mcp_error: Boolean(response.isError) };
    report.results.push(record);
    console.log(JSON.stringify({ id: sample.id, tool: action?.tool ?? null, structural_match: Boolean(branch), incomplete: state.incomplete }));
  } finally {
    await client.close();
    await server.close();
    writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
console.log(`Results: ${join(out, 'results.json')}`);
