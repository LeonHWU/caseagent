import { existsSync, readdirSync, readFileSync } from "node:fs";
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
};

// Status, Updated and Completed reveal how the case ended, so they never reach the agent.
const ENDING_DETAIL = /\*\*(Status|Updated|Completed):\*\*/;
const HEADER_FIELD = /^- \*\*(Channel|From|To|Stage):\*\* ?(.*)$/;
const EVENT_HEAD = /^## (.+ UTC) — event (\d+)$/;

export function isAgency(from: string): boolean {
  return /^(agency|northbridge)/i.test(from.trim());
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
  // Match markdown links in the format [filename](attachments/filename)
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
      timestamp = timestamp.replace(/–|-/g, "—");
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

function tryStrict(dir: string): Case | null {
  try {
    if (!existsSync(join(dir, "index.md")) || !existsSync(join(dir, "history.md"))) return null;
    const index = readFileSync(join(dir, "index.md"), "utf8");
    const s = sections(index);
    const match = index.match(/^# Case [^:]+: (.+)$/m);
    if (!match) return null;
    const attachDir = join(dir, "attachments");
    return {
      id: basename(dir),
      title: match[1].trim(),
      details: (s.get("Case details") ?? "")
        .split("\n")
        .filter((l) => !ENDING_DETAIL.test(l))
        .join("\n"),
      request: s.get("Initial request") ?? "",
      events: parseHistory(readFileSync(join(dir, "history.md"), "utf8")),
      attachments: existsSync(attachDir) ? readdirSync(attachDir).filter((f) => !f.startsWith(".")).sort() : [],
      layer: "strict",
    };
  } catch {
    return null;
  }
}

function tryLenient(dir: string): Case | null {
  try {
    if (!existsSync(join(dir, "index.md")) || !existsSync(join(dir, "history.md"))) return null;
    const index = readFileSync(join(dir, "index.md"), "utf8");
    const s = sections(index);
    let title = basename(dir);
    const titleMatch = index.match(/^#\s+(?:Case\s+)?([^:]+?)(?:\s*:\s*(.+))?$/m);
    if (titleMatch?.[2]) title = titleMatch[2].trim();
    else if (titleMatch?.[1]) title = titleMatch[1].trim();
    const attachDir = join(dir, "attachments");
    return {
      id: basename(dir),
      title,
      details: (s.get("Case details") ?? "")
        .split("\n")
        .filter((l) => !ENDING_DETAIL.test(l))
        .join("\n"),
      request: s.get("Initial request") ?? "",
      events: parseHistoryLenient(readFileSync(join(dir, "history.md"), "utf8")),
      attachments: existsSync(attachDir) ? readdirSync(attachDir).filter((f) => !f.startsWith(".")).sort() : [],
      layer: "lenient",
    };
  } catch {
    return null;
  }
}

function tryLoose(dir: string): Case | null {
  try {
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
        at: new Date().toISOString().slice(0, 19) + " UTC",
        channel: isCall ? "Call" : "Email",
        from: "",
        to: "",
        body: content,
        attachments: extractAttachmentLinks(content),
      };
    });
    const attachDir = join(dir, "attachments");
    return {
      id: basename(dir),
      title: basename(dir),
      details: "",
      request: "",
      events,
      attachments: existsSync(attachDir) ? readdirSync(attachDir).filter((f) => !f.startsWith(".")).sort() : [],
      layer: "loose",
    };
  } catch {
    return null;
  }
}

function stripHiddenContent(text: string): string {
  let result = text;
  result = result.replace(/^#{1,6}\s+(Overview|Outcome|Resolution|Summary)\b[^\n]*\n(?:(?!^#{1,6}\s)[\s\S])*?(?=^#{1,6}\s|$)/gim, "");
  result = result.split("\n").filter((line) => !/^\*\*(Status|Updated|Completed):/i.test(line)).join("\n");
  return result;
}

function tryRaw(dir: string): Case | null {
  try {
    const files = readdirSync(dir).filter((f) => !f.startsWith(".") && f !== "index.md" && f !== "history.md");
    let content = "";
    for (const f of files.sort()) {
      if (!/\.(txt|md|json|csv|eml)$/i.test(f)) continue;
      const path = join(dir, f);
      try {
        content += readFileSync(path, "utf8") + "\n\n";
      } catch {
        /* skip unreadable files */
      }
    }
    if (content.trim().length === 0) return null;
    content = stripHiddenContent(content);
    const attachDir = join(dir, "attachments");
    return {
      id: basename(dir),
      title: basename(dir),
      details: content.trim(),
      request: "",
      events: [{ n: 1, at: new Date().toISOString().slice(0, 19) + " UTC", channel: "Email", from: "", to: "", body: content.trim(), attachments: [] }],
      attachments: existsSync(attachDir) ? readdirSync(attachDir).filter((f) => !f.startsWith(".")).sort() : [],
      layer: "raw",
    };
  } catch {
    return null;
  }
}

export function loadCase(dir: string): Case {
  const strict = tryStrict(dir);
  if (strict) return strict;
  const lenient = tryLenient(dir);
  if (lenient) return lenient;
  const loose = tryLoose(dir);
  if (loose) return loose;
  const raw = tryRaw(dir);
  if (raw) return raw;
  throw new Error(`could not load case from ${dir}: no valid parser succeeded`);
}
