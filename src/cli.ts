import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { runCase, type Trace } from "./agent.ts";
import { writeAnswer } from "./answers.ts";
import { initialSeen, nextSeen, visibleEvents } from "./cut.ts";
import { loadCase } from "./parse.ts";
import { loadState, newState, saveState, statusLabel } from "./state.ts";

const USAGE = `usage:
  npm run case -- run <case-dir> [--next] [--out <dir>]
  npm run case -- run-all <cases-dir> [--limit N] [--concurrency N] [--out <dir>]`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    next: { type: "boolean", default: false },
    out: { type: "string", default: "." },
    limit: { type: "string" },
    concurrency: { type: "string", default: "4" },
  },
});
const [cmd, target] = positionals;
if (!cmd || !target || !["run", "run-all"].includes(cmd)) {
  console.error(USAGE);
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add the key.");
  process.exit(1);
}

const out = values.out;
const model = process.env.MODEL ?? "claude-sonnet-5-5";
const policy = readFileSync(new URL("../policy.md", import.meta.url), "utf8");
const client = new Anthropic({ timeout: 120_000, maxRetries: 3 });

async function processCase(dir: string, next: boolean): Promise<string> {
  const c = loadCase(dir);
  const statePath = join(out, "state", `${c.id}.json`);
  const tracePath = join(out, "traces", `${c.id}.jsonl`);
  mkdirSync(dirname(tracePath), { recursive: true });

  let state = next ? loadState(statePath) : null;
  let newFrom = 1;
  if (next) {
    if (!state) throw new Error(`case ${c.id} has no saved state. Run it once without --next.`);
    const seen = nextSeen(c, state.seen);
    if (seen === null) throw new Error(`case ${c.id} has no further events from the tenant, landlord or a contractor.`);
    newFrom = state.seen + 1;
    state.seen = seen;
  } else {
    state = newState(c.id, initialSeen(c));
    writeFileSync(tracePath, "");
  }

  const trace: Trace = (kind, data) =>
    appendFileSync(tracePath, JSON.stringify({ t: new Date().toISOString(), kind, ...data }) + "\n");
  let thoughts: string[] = [];
  try {
    thoughts = await runCase({ c, state: state!, newFrom, client, model, policy, trace });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state!.incomplete = true;
    state!.status = { kind: "escalated", summary: `System error: ${message}. A person must review case ${c.id}.` };
    trace("error", { message });
  }
  saveState(statePath, state!);
  writeAnswer(out, c, state!, visibleEvents(c, state!.initialSeen, state!.seen), thoughts);
  return `${c.id}: ${statusLabel(state!.status)}${state!.incomplete ? " [incomplete]" : ""}`;
}

if (cmd === "run") {
  console.log(await processCase(target, values.next));
} else {
  const dirs = readdirSync(target)
    .filter((d) => existsSync(join(target, d, "index.md")))
    .sort()
    .slice(0, values.limit ? Number(values.limit) : undefined);
  const queue = [...dirs];
  const workers = Array.from({ length: Number(values.concurrency) }, async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        console.log(await processCase(join(target, d), false));
      } catch (e) {
        console.error(`${d}: failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`done: ${dirs.length} cases`);
}
