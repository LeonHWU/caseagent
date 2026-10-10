import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Case, CaseEvent } from "./parse.ts";
import { statusLabel, type CaseState, type Action } from "./state.ts";

function summarizeLine(s: string, maxLen: number = 80): string {
  return s.split("\n")[0].slice(0, maxLen);
}

function answerMd(c: Case, s: CaseState, visible: CaseEvent[]): string {
  // Summary
  const summary =
    `**Final status:** ${statusLabel(s.status)}${s.incomplete ? " [incomplete]" : ""}\n**Runs:** ${s.runs} · **Events seen:** up to event ${s.seen} · **Loaded with:** ${c.layer}` +
    (s.incomplete ? "\n\n**Incomplete:** the agent did not finish this run, so the system escalated the case to a person." : "") +
    (c.layer === "raw" ? "\n\n**Raw mode loaded:** this case was reconstructed from unstructured files. Review for leaks." : "");

  // Timeline: group actions by run
  const runs = new Map<number, Action[]>();
  for (const action of s.actions) {
    if (!runs.has(action.run)) runs.set(action.run, []);
    runs.get(action.run)!.push(action);
  }

  let prevSeen = 0;
  const timelineBlocks = Array.from({ length: s.runs }, (_, i) => {
    const run = i + 1;
    const runActions = runs.get(run) || [];
    const upTo = runActions.length ? Math.max(...runActions.map((a) => a.afterEvent)) : prevSeen;
    const runEvents = visible.filter((e) => e.n > (run === 1 ? 0 : prevSeen) && e.n <= upTo);
    prevSeen = upTo;

    const eventLines = runEvents.map((e) => {
      const excerpt = summarizeLine(e.body, 60);
      return `- event ${String(e.n).padStart(3, "0")}: ${e.channel} from ${e.from} · ${excerpt}`;
    });

    const actionLines = runActions.map((a) => {
      const detail = a.ok ? a.result : `⚠ ${a.result}`;
      return `- ${a.tool}: ${detail}`;
    });

    return `### Run ${run}\n\n${eventLines.join("\n") || "(no events)"}\n\n${actionLines.join("\n") || "(no actions)"}`;
  }).join("\n\n");

  // Outbox: send_message actions with full text
  const messages = s.actions.filter((a) => a.tool === "send_message");
  const outboxLines = messages.map((m) => {
    const input = m.input as Record<string, unknown>;
    return `**Run ${m.run}, to ${input.to}, ${input.channel}:**\n\n${input.text}`;
  });

  // Approvals requested
  const approvals = s.actions.filter((a) => a.tool === "request_landlord_approval");
  const approvalsLines = approvals.map((a) => {
    const input = a.input as Record<string, unknown>;
    return `- Run ${a.run}: **${input.scope}** (${input.cost})`;
  });

  // Notes
  const notes = s.actions.filter((a) => a.tool === "add_note");
  const notesLines = notes.map((n) => {
    const input = n.input as Record<string, unknown>;
    return `- Run ${n.run}: ${input.text}`;
  });

  // Final checks: only show if closed
  let finalChecksSection = "";
  if (s.status.kind === "closed") {
    const checks = s.status.checks;
    finalChecksSection = `
## Final checks

| | |
|---|---|
| **Outcome** | ${checks.outcome} |
| **Confirmed by** | ${checks.work_confirmed_by} |
| **Landlord informed** | ${checks.landlord_informed ? "Yes" : "No"} |
| **Keys** | ${checks.keys} |
| **Invoice** | ${checks.invoice} |
`;
  }

  // Escalation
  const escalation = s.status.kind === "escalated" ? s.status.summary : "None.";

  // Failed, refused or invalid actions
  const failed = s.actions.filter((a) => !a.ok);
  const failedLines = failed.map((f) => {
    const toolName = f.tool;
    const didRecover = s.actions.some((a) => a.tool === toolName && a.ok && s.actions.indexOf(a) > s.actions.indexOf(f));
    const recoveryText = didRecover ? " — agent recovered" : "";
    return `- **${toolName}:** ${f.result}${recoveryText}`;
  });

  return `# Case ${c.id}: ${c.title}

## Summary

${summary}

## Timeline

${timelineBlocks}

## Outbox

${outboxLines.length > 0 ? outboxLines.join("\n\n") : "No messages."}

## Approvals requested

${approvalsLines.length > 0 ? approvalsLines.join("\n") : "None."}
${finalChecksSection}
## Notes

${notesLines.length > 0 ? notesLines.join("\n") : "None."}

## Escalation

${escalation}

## Failed, refused or invalid actions

${failedLines.length > 0 ? failedLines.join("\n") : "None."}
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
