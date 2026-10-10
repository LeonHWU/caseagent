import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Case, CaseEvent } from "./parse.ts";
import { statusLabel, type CaseState, type Action } from "./state.ts";

function summarizeLine(s: string): string {
  return s.split("\n")[0].slice(0, 60);
}

// Events a run received: those after the previous run's last seen event, up to its own last seen event.
function runEvents(s: CaseState, visible: CaseEvent[], run: number): CaseEvent[] {
  const seenIn = (r: number) => Math.max(0, ...s.actions.filter((a) => a.run === r).map((a) => a.afterEvent), ...s.notes.filter((n) => n.run === r).map((n) => n.afterEvent));
  let from = 0;
  for (let r = run - 1; r >= 1 && from === 0; r--) from = seenIn(r);
  const to = seenIn(run) || from;
  return visible.filter((e) => e.n > from && e.n <= to);
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

  const timelineBlocks = Array.from({ length: s.runs }, (_, i) => {
    const run = i + 1;
    const runActions = runs.get(run) || [];
    const runEvts = runEvents(s, visible, run);
    const eventLines = runEvts.map((e) => {
      const excerpt = summarizeLine(e.body);
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

  // Escalation: an agent escalation shows its three fields; a system escalation shows plain text.
  const st = s.status;
  const escalation =
    st.kind !== "escalated" ? "None."
    : st.checked ? `- **Checked:** ${st.checked}\n- **Missing or in conflict:** ${st.missing_or_conflict}\n- **Decision needed:** ${st.decision_needed}`
    : st.summary;

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

function reasoningMd(c: Case, s: CaseState, visible: CaseEvent[]): string {
  // Group actions and notes by run
  const runs = Math.max(0, ...s.actions.map((a) => a.run), ...s.notes.map((n) => n.run));

  const runSections: string[] = [];
  for (let run = 1; run <= runs; run++) {
    const runActions = s.actions.filter((a) => a.run === run);
    const runNotes = s.notes.filter((n) => n.run === run);

    if (runActions.length === 0 && runNotes.length === 0) continue;

    const eventsInRun = runEvents(s, visible, run)
      .map((e) => `- [event ${String(e.n).padStart(3, "0")}]`)
      .join("\n");

    const actions = runActions
      .map((a) => `- **${a.tool}** (${a.ok ? "ok" : "failed"}): ${String(a.input.reason ?? "(no reason given)")}`)
      .join("\n");

    const notes = runNotes.map((n) => n.text).join("\n\n");

    const runSection = `## Run ${run}

### Events received

${eventsInRun || "None."}

### Agent notes

${notes || "None."}

### Actions

${actions || "None."}
`;
    runSections.push(runSection);
  }

  return `# Reasoning for case ${c.id}

${runSections.join("\n")}`;
}

export function writeAnswer(outDir: string, c: Case, s: CaseState, visible: CaseEvent[]): void {
  const dir = join(outDir, "ANSWERS", c.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ANSWER.md"), answerMd(c, s, visible));
  writeFileSync(join(dir, "REASONING.md"), reasoningMd(c, s, visible));
}
