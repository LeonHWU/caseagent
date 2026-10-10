import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { liveDeps, processCase, processToEnd, summary, type RunDeps } from "./run.ts";

const caseId = { case_id: z.string().regex(/^[\w-]+$/).describe('Case folder name, for example "027".') };

const stepInput = {
  ...caseId,
  step: z.number().int().positive().optional().describe("History event number to expose through (inclusive), for example 7. Never exposes later events."),
  single_action: z.boolean().optional().describe("Execute at most one business tool action and stop, leaving the case open if that action was not hold, escalate or close_case. For step-by-step evaluation. Default: the agent takes every action the stage needs and ends the run itself."),
};

const runCaseInput = { ...stepInput, to_end: z.boolean().optional().describe("Keep resuming after each hold until the case closes, escalates or has no further outside events. Cannot be combined with single_action.") };

export function createServer(opts: { casesDir: string; deps: RunDeps }): McpServer {
  const { casesDir, deps } = opts;
  const server = new McpServer({ name: "case-agent", version: "0.1.0" });

  const caseDir = (id: string) => {
    const dir = join(casesDir, id);
    if (!existsSync(join(dir, "index.md"))) throw new Error(`case ${id} does not exist in ${casesDir}`);
    return dir;
  };
  const answer = (id: string) => readFileSync(join(deps.out, "ANSWERS", id, "ANSWER.md"), "utf8");
  const reply = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
  const replyWith = (id: string, state: Awaited<ReturnType<typeof processCase>>) => reply(`${summary(state)}\n\n${answer(id)}`);
  const run = async (id: string, next: boolean, step?: number, singleAction?: boolean) =>
    replyWith(id, await processCase(deps, caseDir(id), next, { step, singleStep: singleAction ?? false }));
  const runToEnd = async (id: string) => replyWith(id, await processToEnd(deps, caseDir(id)));

  server.registerTool(
    "list_cases",
    { description: "List the case ids this server can run.", inputSchema: {} },
    async () => reply(readdirSync(casesDir).filter((d) => existsSync(join(casesDir, d, "index.md"))).sort().join("\n")),
  );
  server.registerTool(
    "run_case",
    {
      description: "Start or restart a case at optional step (history event number, inclusive); otherwise use the initial decision point. The agent takes the actions this stage needs and ends the run with hold, escalate or close_case; returns the status and ANSWER.md. Replaces saved state. Use resume_case when the next outside reply arrives. With to_end, run the whole case: keep resuming after each hold until it closes, escalates or has no further outside events. With single_action, stop after one business tool action.",
      inputSchema: runCaseInput,
    },
    async ({ case_id, step, to_end, single_action }) => {
      if (to_end && single_action) throw new Error("to_end and single_action cannot be combined.");
      if (to_end && step !== undefined) throw new Error("to_end always starts at the initial decision point; omit step.");
      return to_end ? runToEnd(case_id) : run(case_id, false, step, single_action);
    },
  );
  server.registerTool(
    "resume_case",
    {
      description: "Continue a saved case. Optional step selects the same or a later history event; earlier steps require run_case. Without step, an open case continues at the current event; a held case receives only the next external reply. The agent acts and ends the run as in run_case; with single_action it stops after one business tool action. Returns the status and ANSWER.md.",
      inputSchema: stepInput,
    },
    async ({ case_id, step, single_action }) => run(case_id, true, step, single_action),
  );
  server.registerTool(
    "get_case",
    { description: "Return the saved ANSWER.md and REASONING.md of a case without running it.", inputSchema: caseId },
    async ({ case_id }) => {
      caseDir(case_id);
      const reasoning = join(deps.out, "ANSWERS", case_id, "REASONING.md");
      if (!existsSync(reasoning)) throw new Error(`case ${case_id} has not been run yet. Call run_case first.`);
      return reply(`${answer(case_id)}\n\n${readFileSync(reasoning, "utf8")}`);
    },
  );
  return server;
}

if (import.meta.main) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add the key.");
    process.exit(1);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  const server = createServer({
    casesDir: resolve(root, process.env.CASES_DIR ?? "data/public/Property Management"),
    deps: liveDeps(resolve(root, process.env.OUT_DIR ?? "runs/mcp")),
  });
  await server.connect(new StdioServerTransport());
}
