import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  | { kind: "escalated"; summary: string }
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
};

export function newState(caseId: string, initialSeen: number): CaseState {
  return { caseId, initialSeen, seen: initialSeen, runs: 0, status: { kind: "open" }, actions: [], notes: [], incomplete: false };
}

export function loadState(path: string): CaseState | null {
  if (!existsSync(path)) return null;
  const state = JSON.parse(readFileSync(path, "utf8")) as CaseState;
  return state;
}

export function saveState(path: string, state: CaseState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function statusLabel(s: Status): string {
  if (s.kind === "hold") return `hold (${s.reason})`;
  if (s.kind === "closed") return `closed (${s.checks.outcome})`;
  return s.kind;
}
