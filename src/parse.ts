import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export type CaseEvent = { n: number; at: string; channel: string; from: string; to: string; body: string };

export type Case = {
  id: string;
  title: string;
  details: string;
  request: string;
  events: CaseEvent[];
  attachments: string[];
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
      return {
        n: Number(head[2]),
        at: head[1],
        channel: fields.Channel ?? "",
        from: fields.From ?? "",
        to: fields.To ?? "",
        body: lines.slice(i).join("\n").trim(),
      };
    });
}

export function loadCase(dir: string): Case {
  const index = readFileSync(join(dir, "index.md"), "utf8");
  const s = sections(index);
  const attachDir = join(dir, "attachments");
  return {
    id: basename(dir),
    title: index.match(/^# Case [^:]+: (.+)$/m)?.[1].trim() ?? basename(dir),
    details: (s.get("Case details") ?? "")
      .split("\n")
      .filter((l) => !ENDING_DETAIL.test(l))
      .join("\n"),
    request: s.get("Initial request") ?? "",
    events: parseHistory(readFileSync(join(dir, "history.md"), "utf8")),
    attachments: existsSync(attachDir) ? readdirSync(attachDir).filter((f) => !f.startsWith(".")).sort() : [],
  };
}
