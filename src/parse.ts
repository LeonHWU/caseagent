import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export type CaseEvent = { n: number; at: string; channel: string; from: string; to: string; body: string; attachments: string[] };

export type Case = {
  id: string;
  title: string;
  details: string;
  request: string;
  events: CaseEvent[];
  attachments: string[];
  layer: "strict" | "lenient" | "loose" | "raw";
  // Layers that recognised the directory but failed to parse it. The case still loads on a later
  // layer, so these are the only sign that a file was read differently than written.
  warnings?: string[];
};

// Status, Updated and Completed reveal how the case ended, so they never reach the agent.
// The same rule serves the strict detail filter and the raw stripper: optional list marker,
// optional bold, the field name, then a colon on either side of a closing bold marker.
const ENDING_DETAIL = /^\s*(?:[-*•]\s*)?\*{0,2}\s*(Status|Updated|Completed)\s*\*{0,2}\s*:/i;
const HEADER_FIELD = /^- \*\*(Channel|From|To|Stage):\*\* ?(.*)$/;
const EVENT_HEAD = /^## (.+ UTC) — event (\d+)$/;

export function isAgency(from: string): boolean {
  // Corpus agencies: "Agency / system" and "Northbridge Lettings". The suffixes cover an unseen
  // case that names its agency differently; a landlord or contractor org is still not the agency.
  return /^(agency\b|northbridge\b|.*\b(lettings?|estate agents?|letting agents?|property management)\b)/i.test(from.trim());
}

function sections(md: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of md.split(/^## /m).slice(1)) {
    const nl = part.indexOf("\n");
    out.set(part.slice(0, nl).trim(), part.slice(nl + 1).trim());
  }
  return out;
}

function extractAttachmentLinks(text: string): string[] {
  const links: string[] = [];
  const linkPattern = /\[([^\]]+)\]\(attachments\/([^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(text)) !== null) {
    links.push(match[2]);
  }
  return links;
}

export function parseHistory(md: string): CaseEvent[] {
  return md
    .split(/^<a id="event-\d+"><\/a>\n/m)
    .slice(1)
    .map((block) => {
      const lines = block.split("\n");
      const head = lines[0].match(EVENT_HEAD);
      if (!head) throw new Error(`unrecognised event heading: ${lines[0]}`);
      const fields: Record<string, string> = {};
      let i = 1;
      for (; i < lines.length; i++) {
        const m = lines[i].match(HEADER_FIELD);
        if (m) fields[m[1]] = m[2].trim();
        else if (lines[i].trim() !== "") break;
      }
      const body = lines.slice(i).join("\n").trim();
      return {
        n: Number(head[2]),
        at: head[1],
        channel: fields.Channel ?? "",
        from: fields.From ?? "",
        to: fields.To ?? "",
        body,
        attachments: extractAttachmentLinks(body),
      };
    });
}

function parseHistoryLenient(md: string): CaseEvent[] {
  return md
    .split(/^<a id="event-\d+"><\/a>\n/m)
    .slice(1)
    .map((block) => {
      const lines = block.split("\n");
      const headPattern = /^##\s+(.+)\s+—\s+event\s+(\d+)$/;
      let head = lines[0].match(headPattern);
      if (!head) {
        const altPattern = /^##\s+(.+?)\s+event\s+(\d+)$/;
        head = lines[0].match(altPattern);
      }
      if (!head) throw new Error(`unrecognised event heading: ${lines[0]}`);
      let timestamp = head[1].trim();
      if (!timestamp.includes("UTC")) timestamp += " UTC";
      timestamp = timestamp.replace(/–/g, "—");
      const fields: Record<string, string> = {};
      let i = 1;
      for (; i < lines.length; i++) {
        const m = lines[i].match(/^-\s+\*\*([A-Z][a-z]+):\*\*\s?(.*)$/i);
        if (m) fields[m[1].toLowerCase()] = m[2].trim();
        else if (lines[i].trim() !== "") break;
      }
      return {
        n: Number(head[2]),
        at: timestamp,
        channel: fields.channel ?? "",
        from: fields.from ?? "",
        to: fields.to ?? "",
        body: lines.slice(i).join("\n").trim(),
        attachments: extractAttachmentLinks(lines.slice(i).join("\n")),
      };
    });
}

function attachmentNames(dir: string): string[] {
  const attachDir = join(dir, "attachments");
  return existsSync(attachDir) ? readdirSync(attachDir).filter((f) => !f.startsWith(".")).sort() : [];
}

// The index-file and attachment reading is shared; the layers differ only in the title and event grammar.
function tryMarkdown(dir: string, strict: boolean): Case | null {
  if (!existsSync(join(dir, "index.md")) || !existsSync(join(dir, "history.md"))) return null;
  const index = readFileSync(join(dir, "index.md"), "utf8");
  const s = sections(index);
  let title: string;
  if (strict) {
    const match = index.match(/^# Case [^:]+: (.+)$/m);
    if (!match) return null;
    title = match[1].trim();
  } else {
    title = basename(dir);
    const titleMatch = index.match(/^#\s+(?:Case\s+)?([^:]+?)(?:\s*:\s*(.+))?$/m);
    if (titleMatch?.[2]) title = titleMatch[2].trim();
    else if (titleMatch?.[1]) title = titleMatch[1].trim();
  }
  return {
    id: basename(dir),
    title,
    details: (s.get("Case details") ?? "")
      .split("\n")
      .filter((l) => !ENDING_DETAIL.test(l))
      .join("\n"),
    request: s.get("Initial request") ?? "",
    events: strict ? parseHistory(readFileSync(join(dir, "history.md"), "utf8")) : parseHistoryLenient(readFileSync(join(dir, "history.md"), "utf8")),
    attachments: attachmentNames(dir),
    layer: strict ? "strict" : "lenient",
  };
}

const fileStamp = (path: string) => statSync(path).mtime.toISOString().slice(0, 19).replace("T", " ") + " UTC";

function tryLoose(dir: string): Case | null {
  if (existsSync(join(dir, "history.md"))) return null;
  const files = readdirSync(dir).filter(
    (f) => !f.startsWith(".") && f !== "index.md" && /\.(eml|txt|json|csv)$/.test(f)
  );
  if (files.length === 0) return null;
  const events: CaseEvent[] = files.map((f, i) => {
    const path = join(dir, f);
    const content = readFileSync(path, "utf8");
    const isCall = /call|transcript/i.test(f);
    return {
      n: i + 1,
      at: fileStamp(path),
      channel: isCall ? "Call" : "Email",
      from: "",
      to: "",
      body: content,
      attachments: extractAttachmentLinks(content),
    };
  });
  return {
    id: basename(dir),
    title: basename(dir),
    details: "",
    request: "",
    events,
    attachments: attachmentNames(dir),
    layer: "loose",
  };
}

function stripHiddenContent(text: string): string {
  let result = text;
  result = result.replace(/^#{1,6}\s+(Overview|Outcome|Resolution|Summary)\b[^\n]*\n(?:(?!^#{1,6}\s)[\s\S])*/gim, "");
  result = result.split("\n").filter((line) => !ENDING_DETAIL.test(line)).join("\n");
  return result;
}

function tryRaw(dir: string): Case | null {
  const files = readdirSync(dir).filter((f) => !f.startsWith(".") && f !== "index.md" && f !== "history.md");
  let content = "";
  let latest = 0;
  for (const f of files.sort()) {
    if (!/\.(txt|md|json|csv|eml)$/i.test(f)) continue;
    const path = join(dir, f);
    try {
      content += readFileSync(path, "utf8") + "\n\n";
      latest = Math.max(latest, statSync(path).mtimeMs);
    } catch {
      /* skip unreadable files */
    }
  }
  if (content.trim().length === 0) return null;
  content = stripHiddenContent(content);
  const at = latest > 0 ? new Date(latest).toISOString().slice(0, 19).replace("T", " ") + " UTC" : "";
  return {
    id: basename(dir),
    title: basename(dir),
    details: content.trim(),
    request: "",
    events: [{ n: 1, at, channel: "Email", from: "", to: "", body: content.trim(), attachments: [] }],
    attachments: attachmentNames(dir),
    layer: "raw",
  };
}

export function loadCase(dir: string): Case {
  const warnings: string[] = [];
  const attempt = (name: string, fn: () => Case | null): Case | null => {
    try {
      return fn();
    } catch (e) {
      warnings.push(`${name} loader failed on ${dir}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };
  const c =
    attempt("strict", () => tryMarkdown(dir, true)) ??
    attempt("lenient", () => tryMarkdown(dir, false)) ??
    attempt("loose", () => tryLoose(dir)) ??
    attempt("raw", () => tryRaw(dir));
  if (!c) throw new Error(`could not load case from ${dir}: ${warnings.length ? warnings.join("; ") : "no parser recognised the directory"}`);
  if (warnings.length) c.warnings = warnings;
  return c;
}
