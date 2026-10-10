import type Anthropic from "@anthropic-ai/sdk";
import { join } from "node:path";
import type { Case, CaseEvent } from "./parse.ts";
import type { CaseState } from "./state.ts";
import { isAgency } from "./parse.ts";
import type { AttachmentContent } from "./attachments.ts";
import { NATIVE_PDF_MAX_BYTES, readAttachment } from "./attachments.ts";

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
        if (Number.isNaN(days)) break;
        lines.push(`${party}: ${days} day${days === 1 ? "" : "s"}`);
        break;
      }
    }
  }

  return lines.length > 0 ? lines.join(", ") : "";
}

export type CasePrompt = {
  text: string;
  images: Array<{ filename: string; format: "png" | "jpeg"; data: string }>;
  documents: Array<{ filename: string; data: string }>;
};

// A request may be 32 MB and base64 adds a third, so native PDFs share a 20 MB budget per prompt.
const NATIVE_PDF_TOTAL_BYTES = 20 * 1024 * 1024;

export async function renderCase(c: Case, state: CaseState, visible: CaseEvent[], newFrom: number, caseDir?: string, cacheDir = join(caseDir ?? ".", ".attachments-cache")): Promise<CasePrompt> {
  const earlier = visible.filter((e) => e.n < newFrom).map(renderEvent);
  const fresh = visible.filter((e) => e.n >= newFrom).map(renderEvent);
  const actions = state.actions.map(
    (a) => `- run ${a.run}, after event ${a.afterEvent}: ${a.tool} ${JSON.stringify(a.input)} -> ${a.ok ? "ok" : "failed"}: ${a.result}`,
  );

  // Determine visible attachments
  const visibleAttachmentNames = new Set<string>();

  // Collect all attachments linked by ANY event in the case (to determine which are unlinked)
  const allLinkedAttachments = new Set<string>();
  for (const event of c.events) {
    for (const att of event.attachments) {
      allLinkedAttachments.add(att);
    }
  }

  // Attachments visible: (1) those linked by visible events, (2) unlinked files (visible from start)
  for (const event of visible) {
    for (const att of event.attachments) {
      visibleAttachmentNames.add(att);
    }
  }

  // Add unlinked attachments (visible from start)
  for (const att of c.attachments) {
    if (!allLinkedAttachments.has(att)) {
      visibleAttachmentNames.add(att);
    }
  }

  // Build attachment section and collect images
  const attachmentLines: string[] = [];
  const images: CasePrompt["images"] = [];
  const documents: CasePrompt["documents"] = [];
  let nativeBudget = NATIVE_PDF_TOTAL_BYTES;

  if (visibleAttachmentNames.size > 0 && caseDir) {
    for (const filename of Array.from(visibleAttachmentNames).sort()) {
      const content = await readAttachment(caseDir, filename, cacheDir, { nativeMaxBytes: Math.min(NATIVE_PDF_MAX_BYTES, nativeBudget) });
      if (content.type === "document") {
        nativeBudget -= Buffer.byteLength(content.data, "base64");
        documents.push({ filename, data: content.data });
        attachmentLines.push(`### ${filename}\n\n(PDF attached in full: ${content.pages} page${content.pages === 1 ? "" : "s"})`);
      } else if (content.type === "text") {
        attachmentLines.push(`### ${filename}\n\n${content.text}`);
      } else if (content.type === "image") {
        images.push({ filename, format: content.format, data: content.data });
        attachmentLines.push(`### ${filename}\n\n(Image file: ${filename})`);
      } else {
        attachmentLines.push(`### ${filename}\n\nCould not read: ${content.error}`);
      }
    }
  }

  const nowLine = visible.length > 0 ? `Now: ${visible[visible.length - 1].at}` : "";
  const daysSinceLines = getLastContactDays(visible);

  const text = [
    `# Case ${c.id}: ${c.title}`,
    ...(nowLine ? [nowLine] : []),
    ...(daysSinceLines ? [`Days since last contact: ${daysSinceLines}`] : []),
    `## Case details\n${c.details}`,
    `## Initial request\n${c.request}`,
    visibleAttachmentNames.size > 0
      ? `## Attachments\n${attachmentLines.join("\n\n") || "None."}`
      : `## Attachments\nNone.`,
    `## Earlier events\n${list(earlier, "None.")}`,
    `## Your earlier actions\n${actions.join("\n") || "None. This is the first run on this case."}`,
    `## New events since your last run\n${list(fresh, "None.")}`,
    "Decide the next step as Northbridge Lettings. Act with the tools, then end the run with exactly one of hold, escalate or close_case.",
  ].join("\n\n");

  return { text, images, documents };
}
