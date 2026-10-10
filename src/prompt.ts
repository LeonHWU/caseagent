import type { Case, CaseEvent } from "./parse.ts";
import type { CaseState } from "./state.ts";
import { isAgency } from "./parse.ts";

function renderEvent(e: CaseEvent): string {
  return `[event ${String(e.n).padStart(3, "0")}] ${e.at} | ${e.channel} | from ${e.from} | to ${e.to}\n${e.body}`;
}

function list(items: string[], empty: string): string {
  return items.length ? items.join("\n\n") : empty;
}

function parseTimestamp(timestamp: string): Date {
  // Parse timestamps like "2026-04-28 01:36:58 UTC"
  return new Date(timestamp.replace(" UTC", "Z"));
}

function daysSince(laterTimestamp: string, earlierTimestamp: string): number {
  const later = parseTimestamp(laterTimestamp);
  const earlier = parseTimestamp(earlierTimestamp);
  const diffMs = later.getTime() - earlier.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getLastContactDays(visible: CaseEvent[]): string {
  if (visible.length === 0) return "";

  const latestEvent = visible[visible.length - 1];
  const now = latestEvent.at;

  // Get all unique parties (exclude agency)
  const parties = new Set<string>();
  for (const e of visible) {
    if (!isAgency(e.from)) {
      parties.add(e.from);
    }
  }

  // For each party, find the latest message
  const lines: string[] = [];
  const partiesArray = Array.from(parties).sort();

  for (const party of partiesArray) {
    // Find the latest event from this party
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].from.toLowerCase().trim() === party.toLowerCase().trim()) {
        const days = daysSince(now, visible[i].at);
        lines.push(`${party}: ${days} day${days === 1 ? "" : "s"}`);
        break;
      }
    }
  }

  return lines.length > 0 ? lines.join(", ") : "";
}

export function renderCase(c: Case, state: CaseState, visible: CaseEvent[], newFrom: number): string {
  const earlier = visible.filter((e) => e.n < newFrom).map(renderEvent);
  const fresh = visible.filter((e) => e.n >= newFrom).map(renderEvent);
  const actions = state.actions.map(
    (a) => `- run ${a.run}, after event ${a.afterEvent}: ${a.tool} ${JSON.stringify(a.input)} -> ${a.ok ? "ok" : "failed"}: ${a.result}`,
  );
  const attachments = c.attachments.map((a) => `- ${a} (PDF, not read by this version)`);

  const nowLine = visible.length > 0 ? `Now: ${visible[visible.length - 1].at}` : "";
  const daysSinceLines = visible.length > 0 ? getLastContactDays(visible) : "";

  return [
    `# Case ${c.id}: ${c.title}`,
    ...(nowLine ? [nowLine] : []),
    ...(daysSinceLines ? [`Days since last contact: ${daysSinceLines}`] : []),
    `## Case details\n${c.details}`,
    `## Initial request\n${c.request}`,
    `## Attachments\n${attachments.join("\n") || "None."}`,
    `## Earlier events\n${list(earlier, "None.")}`,
    `## Your earlier actions\n${actions.join("\n") || "None. This is the first run on this case."}`,
    `## New events since your last run\n${list(fresh, "None.")}`,
    "Decide the next step as Northbridge Lettings. Act with the tools, then end the run with exactly one of hold, escalate or close_case.",
  ].join("\n\n");
}
