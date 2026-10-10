import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/mcp.ts';
import { liveDeps, type RunDeps } from '../../src/run.ts';
import { isIncomplete, type CaseState } from '../../src/state.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(root, '../..');

type Expected = { acceptable_actions: { tool: string; exact_arguments: Record<string, unknown> }[] };
// completed: the agent ended the run itself; the record still needs semantic review.
// model_failure: the model never ended the run (turn exhaustion); strict score 0.
// runtime_failure: the API, the loader or the MCP call failed; no score, because the model was not judged.
export type RunOutcome = 'completed' | 'model_failure' | 'runtime_failure';
export type SampleResult = {
  id: string; case_id: string; step: number; trial: number; run_outcome: RunOutcome; incomplete: boolean;
  status: CaseState['status'] | null; actions: CaseState['actions']; structural_match: boolean;
  semantic_review: 'pending' | 'not_required' | 'not_run'; score: 0 | null; error: string | null;
  expected: Expected; trace: string; mcp_error: boolean; measured: boolean;
};
export type Report = {
  model: string; code_revision: string; started_at: string; trials: number;
  // pass_1: mean pass rate over measured trials. pass_k: share of fully measured samples where
  // every trial passed; a sample with unmeasured trials does not count, so flaky infrastructure
  // cannot inflate the score. A runtime_failure trial is not measured: it fails our
  // infrastructure, not the model.
  pass_1: number | null; pass_k: number | null; unmeasured: number; results: SampleResult[];
};

const passed = (r: Pick<SampleResult, 'run_outcome' | 'structural_match'>) => r.run_outcome === 'completed' && r.structural_match;

// The trace says why a run is incomplete: `error` from src/run.ts, `auto_escalate` from src/agent.ts.
function traceKinds(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).kind as string));
}

function classify(state: CaseState | null, kinds: Set<string>, error: string | null): RunOutcome {
  if (error || !state || kinds.has('error')) return 'runtime_failure';
  if (isIncomplete(state)) return kinds.has('auto_escalate') ? 'model_failure' : 'runtime_failure';
  return 'completed';
}

export async function runSuite(opts: {
  out: string; makeDeps: (out: string) => RunDeps; model: string; revision: string; timeoutMs?: number; trials?: number;
}): Promise<Report> {
  const { out, makeDeps, timeoutMs = 600_000, trials = 1 } = opts;
  mkdirSync(out, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const report: Report = {
    model: opts.model, code_revision: opts.revision, started_at: new Date().toISOString(),
    trials, pass_1: null, pass_k: null, unmeasured: 0, results: [],
  };

  for (const entry of manifest.samples) {
    const sample = JSON.parse(readFileSync(join(root, entry.sample), 'utf8'));
    let won = 0;
    let measured = 0;
    for (let trial = 1; trial <= trials; trial++) {
      const sampleOut = trials > 1 ? join(out, sample.id, `trial-${trial}`) : join(out, sample.id);
      const trace = trials > 1 ? join(sample.id, `trial-${trial}`, 'traces', `${sample.case_id}.jsonl`) : join(sample.id, 'traces', `${sample.case_id}.jsonl`);
      const server = createServer({ casesDir: join(root, sample.input.cases_dir), deps: makeDeps(sampleOut) });
      const client = new Client({ name: 'process-eval-live', version: '1' });
      const [a, b] = InMemoryTransport.createLinkedPair();

      let error: string | null = null;
      let mcpError = false;
      try {
        await Promise.all([server.connect(a), client.connect(b)]);
        // Each sample grades the next single business action, so the call runs in single-action mode.
        const call = { ...sample.input.mcp_call, arguments: { ...sample.input.mcp_call.arguments, single_action: true } };
        const response = await client.callTool(call, undefined, { timeout: timeoutMs });
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

      // A runtime_failure is a failure of our infrastructure, so the trial is not measured.
      const isMeasured = outcome !== 'runtime_failure';
      const result: SampleResult = {
        id: sample.id, case_id: sample.case_id, step: sample.step, trial, run_outcome: outcome,
        incomplete: state ? isIncomplete(state) : true, status: state?.status ?? null, actions: state?.actions ?? [],
        structural_match: Boolean(branch),
        semantic_review: outcome === 'completed' ? 'pending' : outcome === 'model_failure' ? 'not_required' : 'not_run',
        score: outcome === 'model_failure' ? 0 : null,
        error, expected: sample.expected, trace, mcp_error: mcpError, measured: isMeasured,
      };
      report.results.push(result);
      if (isMeasured) {
        measured++;
        if (passed(result)) won++;
      }
      writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({ id: sample.id, trial, outcome, tool: action?.tool ?? null, structural_match: Boolean(branch), error }));
    }
    console.log(`${sample.id}: ${won}/${measured} trials passed${measured < trials ? ` (${trials - measured} unmeasured)` : ''}`);
  }

  const measuredTrials = report.results.filter((r) => r.measured);
  report.pass_1 = measuredTrials.length ? measuredTrials.filter(passed).length / measuredTrials.length : null;
  const bySample = new Map<string, SampleResult[]>();
  for (const r of report.results) {
    const list = bySample.get(r.id) ?? [];
    list.push(r);
    bySample.set(r.id, list);
  }
  const fullyMeasuredSamples = [...bySample.values()].filter((rs) => rs.length === trials && rs.every((r) => r.measured));
  report.pass_k = fullyMeasuredSamples.length
    ? fullyMeasuredSamples.filter((rs) => rs.every(passed)).length / fullyMeasuredSamples.length
    : null;
  report.unmeasured = report.results.filter((r) => !r.measured).length;
  if (report.unmeasured > 0) console.log(`unmeasured trials (infrastructure failures, not scored): ${report.unmeasured}`);
  writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (import.meta.main) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
  const args = process.argv.slice(2);
  const ti = args.indexOf('--trials');
  const trials = ti > -1 ? Number(args[ti + 1]) : 1;
  if (!Number.isInteger(trials) || trials < 1) throw new Error('--trials must be a positive integer');
  const positional = args.filter((a, i) => i !== ti && i !== ti + 1 && !a.startsWith('--'));
  const out = resolve(positional[0] ?? join(repo, 'runs/process-eval', new Date().toISOString().replaceAll(':', '-')));
  await runSuite({
    out,
    makeDeps: liveDeps,
    model: process.env.MODEL ?? 'claude-sonnet-5-5',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    trials,
  });
  console.log(`Results: ${join(out, 'results.json')}`);
}
