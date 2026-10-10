import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Case, CaseEvent } from "./parse.ts";
import { statusLabel, type CaseState } from "./state.ts";

const cell = (v: string) => v.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function answerMd(c: Case, s: CaseState, visible: CaseEvent[]): string {
  const received = visible.map((e) => `- [event ${String(e.n).padStart(3, "0")}] ${e.channel} from ${e.from}`).join("\n");
  const rows = s.actions.map((a) => `| ${a.run} | ${a.afterEvent} | ${a.tool} | ${a.ok ? "ok" : "failed"} | ${cell(a.result)} |`).join("\n");
  const failed = s.actions.filter((a) => !a.ok).map((a) => `- ${a.tool}: ${a.result}`).join("\n");
  return `# Case ${c.id}: ${c.title}

**Final status:** ${statusLabel(s.status)}
**Runs:** ${s.runs} · **Events seen:** up to event ${s.seen}
${s.incomplete ? "\n**Incomplete:** the agent did not finish this run, so the system escalated the case to a person.\n" : ""}
## What the system received

- The case details and the initial request from index.md. The Overview and Outcome sections were withheld.
- Attachments: ${c.attachments.join(", ") || "none"}
${received}

## Actions taken

| Run | After event | Tool | Result | Detail |
|-----|-------------|------|--------|--------|
${rows || "| – | – | – | – | – |"}

## Escalation

${s.status.kind === "escalated" ? s.status.summary : "None."}

## Failed or refused actions

${failed || "None."}
`;
}

function reasoningMd(c: Case, s: CaseState, thoughts: string[]): string {
  const steps = s.actions.map((a) => `### Run ${a.run} · ${a.tool}\n\n${String(a.input.reason ?? "(no reason given)")}`).join("\n\n");
  return `# Reasoning for case ${c.id}

${steps || "No actions."}

## Agent notes from the latest run

${thoughts.join("\n\n") || "None."}
`;
}

export function writeAnswer(outDir: string, c: Case, s: CaseState, visible: CaseEvent[], thoughts: string[]): void {
  const dir = join(outDir, "ANSWERS", c.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ANSWER.md"), answerMd(c, s, visible));
  writeFileSync(join(dir, "REASONING.md"), reasoningMd(c, s, thoughts));
}
