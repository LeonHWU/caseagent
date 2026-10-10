import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp.ts';
import { liveDeps, type RunDeps } from '../../src/run.ts';
import type { CaseState } from '../../src/state.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../..');

type Expected = { acceptable_actions: { tool: string; exact_arguments: Record<string, unknown> }[] };
// completed: the agent ended the run itself; the record still needs semantic review.
// model_failure: the model never ended the run (turn exhaustion); strict score 0.
// runtime_failure: the API, the loader or the MCP call failed; no score, because the model was not judged.
export type RunOutcome = 'completed' | 'model_failure' | 'runtime_failure';
export type SampleResult = {
  id: string; case_id: string; step: number; run_outcome: RunOutcome; incomplete: boolean;
  status: CaseState['status'] | null; actions: CaseState['actions']; structural_match: boolean;
  semantic_review: 'pending' | 'not_required' | 'not_run'; score: 0 | null; error: string | null;
  expected: Expected; trace: string; mcp_error: boolean;
};
export type Report = { model: string; code_revision: string; started_at: string; results: SampleResult[] };

// The trace says why a run is incomplete: `error` from src/run.ts, `auto_escalate` from src/agent.ts.
function traceKinds(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).kind as string));
}

function classify(state: CaseState | null, kinds: Set<string>, error: string | null): RunOutcome {
  if (error || !state || kinds.has('error')) return 'runtime_failure';
  if (state.incomplete) return kinds.has('auto_escalate') ? 'model_failure' : 'runtime_failure';
  return 'completed';
}

export async function runSuite(opts: {
  out: string; makeDeps: (out: string) => RunDeps; model: string; revision: string; timeoutMs?: number;
}): Promise<Report> {
  const { out, makeDeps, timeoutMs = 600_000 } = opts;
  mkdirSync(out, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const report: Report = { model: opts.model, code_revision: opts.revision, started_at: new Date().toISOString(), results: [] };

  for (const entry of manifest.samples) {
    const sample = JSON.parse(readFileSync(join(root, entry.sample), 'utf8'));
    const sampleOut = join(out, sample.id);
    const trace = join(sample.id, 'traces', `${sample.case_id}.jsonl`);
    const server = createServer({ casesDir: join(root, sample.input.cases_dir), deps: makeDeps(sampleOut) });
    const client = new Client({ name: 'process-eval-live', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();

    let error: string | null = null;
    let mcpError = false;
    try {
      await Promise.all([server.connect(a), client.connect(b)]);
      const response = await client.callTool(sample.input.mcp_call, undefined, { timeout: timeoutMs });
      if (response.isError) {
        mcpError = true;
        error = (response.content as { text?: string }[]).map((c) => c.text ?? '').join('\n') || 'MCP tool error';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      await client.close();
      await server.close();
    }

    const statePath = join(sampleOut, 'state', `${sample.case_id}.json`);
    // A timed-out call may still be running in the background, so its state file is not this sample's result.
    const state = !error && existsSync(statePath) ? (JSON.parse(readFileSync(statePath, 'utf8')) as CaseState) : null;
    const outcome = classify(state, traceKinds(join(out, trace)), error);
    const action = state?.actions[0];
    const branch = outcome === 'completed' && state!.actions.length === 1 && action?.ok
      ? (sample.expected as Expected).acceptable_actions.find((e) =>
        action.tool === e.tool && Object.entries(e.exact_arguments).every(([k, v]) => action.input[k] === v))
      : undefined;

    report.results.push({
      id: sample.id, case_id: sample.case_id, step: sample.step, run_outcome: outcome,
      incomplete: state?.incomplete ?? true, status: state?.status ?? null, actions: state?.actions ?? [],
      structural_match: Boolean(branch),
      semantic_review: outcome === 'completed' ? 'pending' : outcome === 'model_failure' ? 'not_required' : 'not_run',
      score: outcome === 'model_failure' ? 0 : null,
      error, expected: sample.expected, trace, mcp_error: mcpError,
    });
    writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ id: sample.id, outcome, tool: action?.tool ?? null, structural_match: Boolean(branch), error }));
  }
  return report;
}

if (import.meta.main) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
  const out = resolve(process.argv[2] ?? join(repo, 'runs/process-eval', new Date().toISOString().replaceAll(':', '-')));
  await runSuite({
    out,
    makeDeps: liveDeps,
    model: process.env.MODEL ?? 'claude-sonnet-5-5',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  });
  console.log(`Results: ${join(out, 'results.json')}`);
}
