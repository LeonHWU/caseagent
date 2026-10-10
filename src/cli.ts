import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { liveDeps, processCase, processToEnd, summary } from "./run.ts";

const USAGE = `usage:
  npm run case -- run <case-dir> [--next|--to-end] [--out <dir>]
  npm run case -- run-all <cases-dir> [--to-end] [--limit N] [--concurrency N] [--out <dir>]`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    next: { type: "boolean", default: false },
    "to-end": { type: "boolean", default: false },
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
const concurrency = Number(values.concurrency);
const limit = values.limit === undefined ? undefined : Number(values.limit);
if (!Number.isInteger(concurrency) || concurrency < 1 || (limit !== undefined && (!Number.isInteger(limit) || limit < 1))) {
  console.error("--concurrency and --limit must be positive integers.");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add the key.");
  process.exit(1);
}

const deps = liveDeps(values.out);

if (cmd === "run") {
  const state = values["to-end"]
    ? await processToEnd(deps, target)
    : await processCase(deps, target, values.next);
  console.log(summary(state));
} else {
  const dirs = readdirSync(target)
    .filter((d) => existsSync(join(target, d, "index.md")))
    .sort()
    .slice(0, limit);
  const queue = [...dirs];
  const workers = Array.from({ length: concurrency }, async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        const state = values["to-end"]
          ? await processToEnd(deps, join(target, d))
          : await processCase(deps, join(target, d), values.next);
        console.log(summary(state));
      } catch (e) {
        console.error(`${d}: failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`done: ${dirs.length} cases`);
}
