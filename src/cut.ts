import { isAgency, type Case, type CaseEvent } from "./parse.ts";

const OUTBOUND = new Set(["Email", "SMS", "Call"]);

export function initialSeen(c: Case): number {
  const first = c.events.find((e) => isAgency(e.from) && OUTBOUND.has(e.channel) && e.to !== "Not specified");
  return first ? first.n - 1 : c.events.length;
}

export function nextSeen(c: Case, seen: number): number | null {
  return c.events.find((e) => e.n > seen && !isAgency(e.from))?.n ?? null;
}

export function visibleEvents(c: Case, initial: number, seen: number): CaseEvent[] {
  return c.events.filter((e) => e.n <= seen && (e.n <= initial || !isAgency(e.from)));
}
