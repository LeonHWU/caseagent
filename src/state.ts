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

export type Status =
  | { kind: "open" }
  | { kind: "hold"; reason: HoldReason }
  | { kind: "escalated"; summary: string; checked?: string; missing_or_conflict?: string; decision_needed?: string }
  | { kind: "closed"; checks: CloseChecks };

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
  incomplete: boolean;
  approvalOnFile?: boolean;
  landlordReplied?: boolean;
};

export function newState(caseId: string, initialSeen: number): CaseState {
  return { caseId, initialSeen, seen: initialSeen, runs: 0, status: { kind: "open" }, actions: [], notes: [], incomplete: false };
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
  const state = parsed as Partial<CaseState>;
  return {
    caseId: state.caseId ?? "unknown",
    initialSeen: state.initialSeen ?? state.seen ?? 0,
    seen: state.seen ?? 0,
    runs: state.runs ?? 0,
    status: state.status ?? { kind: "open" },
    actions: state.actions ?? [],
    notes: state.notes ?? [],
    incomplete: state.incomplete ?? false,
    approvalOnFile: state.approvalOnFile,
    landlordReplied: state.landlordReplied,
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
  return s.kind;
}
