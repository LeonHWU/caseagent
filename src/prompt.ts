import type { Case, CaseEvent } from "./parse.ts";
import type { CaseState } from "./state.ts";

function renderEvent(e: CaseEvent): string {
  return `[event ${String(e.n).padStart(3, "0")}] ${e.at} | ${e.channel} | from ${e.from} | to ${e.to}\n${e.body}`;
}

function list(items: string[], empty: string): string {
  return items.length ? items.join("\n\n") : empty;
}

export function renderCase(c: Case, state: CaseState, visible: CaseEvent[], newFrom: number): string {
  const earlier = visible.filter((e) => e.n < newFrom).map(renderEvent);
  const fresh = visible.filter((e) => e.n >= newFrom).map(renderEvent);
  const actions = state.actions.map(
    (a) => `- run ${a.run}, after event ${a.afterEvent}: ${a.tool} ${JSON.stringify(a.input)} -> ${a.ok ? "ok" : "failed"}: ${a.result}`,
  );
  const attachments = c.attachments.map((a) => `- ${a} (PDF, not read by this version)`);
  return [
    `# Case ${c.id}: ${c.title}`,
    `## Case details\n${c.details}`,
    `## Initial request\n${c.request}`,
    `## Attachments\n${attachments.join("\n") || "None."}`,
    `## Earlier events\n${list(earlier, "None.")}`,
    `## Your earlier actions\n${actions.join("\n") || "None. This is the first run on this case."}`,
    `## New events since your last run\n${list(fresh, "None.")}`,
    "Decide the next step as Northbridge Lettings. Act with the tools, then end the run with exactly one of hold, escalate or close_case.",
  ].join("\n\n");
}
