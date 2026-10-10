import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const HOLD_REASONS = ["Waiting for Landlord", "Waiting for Tenant", "Waiting for Provider", "Waiting for Quote"] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export type CloseChecks = {
  outcome: "work_completed" | "resolved_without_work" | "withdrawn";
  work_confirmed_by: string;
  landlord_informed: boolean;
  keys: "returned" | "not_issued" | "outstanding";
  invoice: "on_file" | "not_required" | "outstanding";
};

// An agent escalation is a handover with three fields. A system escalation (load error, API error,
// turn limit, stage limit) means the agent did not finish; that is what "incomplete" reports.
export type Status =
  | { kind: "open" }
  | { kind: "hold"; reason: HoldReason }
  | { kind: "escalated"; by: "agent"; summary: string; checked: string; missing_or_conflict: string; decision_needed: string }
  | { kind: "escalated"; by: "system"; summary: string }
  | { kind: "closed"; checks: CloseChecks };

export const isIncomplete = (s: { status: Status }): boolean => s.status.kind === "escalated" && s.status.by === "system";

// The landlord's reply to the latest approval request, classified once per new landlord event.
export type LandlordAnswer = { answer: "approved" | "refused" | "unclear"; requestAfter: number; throughEvent: number };

export type Action = {
  run: number;
  afterEvent: number;
  tool: string;
  input: Record<string, unknown>;
  ok: boolean;
  result: string;
};

export type Note = {
  run: number;
  afterEvent: number;
  text: string;
};

export type CaseState = {
  caseId: string;
  initialSeen: number;
  seen: number;
  runs: number;
  status: Status;
  actions: Action[];
  notes: Note[];
  approvalOnFile?: boolean;
  landlordAnswer?: LandlordAnswer;
};

export function newState(caseId: string, initialSeen: number): CaseState {
  return { caseId, initialSeen, seen: initialSeen, runs: 0, status: { kind: "open" }, actions: [], notes: [] };
}

// State files written before escalations carried `by`: the old `incomplete` flag marked system escalations.
function migrateStatus(status: unknown, incomplete: unknown): Status {
  const s = status as (Status & { checked?: string }) | undefined;
  if (!s) return { kind: "open" };
  if (s.kind !== "escalated" || "by" in s) return s;
  const legacy = s as { summary: string; checked?: string; missing_or_conflict?: string; decision_needed?: string };
  if (incomplete === true || legacy.checked === undefined) return { kind: "escalated", by: "system", summary: legacy.summary };
  return { kind: "escalated", by: "agent", summary: legacy.summary, checked: legacy.checked, missing_or_conflict: legacy.missing_or_conflict ?? "", decision_needed: legacy.decision_needed ?? "" };
}

export function loadState(path: string): CaseState | null {
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // A truncated or corrupt state file is moved aside so resume reports "no saved state"
    // instead of crashing on the same bytes every time.
    try {
      renameSync(path, `${path}.corrupt`);
    } catch {
      /* nothing to preserve */
    }
    return null;
  }
  // Fields absent in older or partial files get their defaults rather than reaching callers as undefined.
  const state = parsed as Partial<CaseState> & { incomplete?: boolean };
  return {
    caseId: state.caseId ?? "unknown",
    initialSeen: state.initialSeen ?? state.seen ?? 0,
    seen: state.seen ?? 0,
    runs: state.runs ?? 0,
    status: migrateStatus(state.status, state.incomplete),
    actions: state.actions ?? [],
    notes: state.notes ?? [],
    approvalOnFile: state.approvalOnFile,
    landlordAnswer: state.landlordAnswer,
  };
}

export function saveState(path: string, state: CaseState): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  renameSync(tmp, path);
}

export function statusLabel(s: Status): string {
  if (s.kind === "hold") return `hold (${s.reason})`;
  if (s.kind === "closed") return `closed (${s.checks.outcome})`;
  if (s.kind === "escalated" && s.by === "system") return "escalated [incomplete]";
  return s.kind;
}
