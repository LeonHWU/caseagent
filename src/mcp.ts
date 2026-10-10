import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { liveDeps, processCase, summary, type RunDeps } from "./run.ts";

const caseId = { case_id: z.string().regex(/^[\w-]+$/).describe('Case folder name, for example "027".') };

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
  const run = async (id: string, next: boolean) => {
    const state = await processCase(deps, caseDir(id), next);
    return reply(`${summary(state)}\n\n${answer(id)}`);
  };

  server.registerTool(
    "list_cases",
    { description: "List the case ids this server can run.", inputSchema: {} },
    async () => reply(readdirSync(casesDir).filter((d) => existsSync(join(casesDir, d, "index.md"))).sort().join("\n")),
  );
  server.registerTool(
    "run_case",
    {
      description: "Run a case from the start as Northbridge Lettings, up to its first hold, escalation or close. Replaces any saved run of this case. Returns the status and ANSWER.md.",
      inputSchema: caseId,
    },
    async ({ case_id }) => run(case_id, false),
  );
  server.registerTool(
    "resume_case",
    {
      description: "Give a held case the next reply from the tenant, landlord or contractor, and continue it. Returns the status and ANSWER.md.",
      inputSchema: caseId,
    },
    async ({ case_id }) => run(case_id, true),
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
