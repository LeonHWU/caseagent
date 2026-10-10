# Case Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task by task. Use test-driven-development for every task that has a test.

**Goal:** Build a TypeScript agent that processes one Property Management case as Northbridge Lettings, stops at a wait, resumes on the next real event, and writes `ANSWERS/<n>/ANSWER.md`, `ANSWERS/<n>/REASONING.md` and a trace.

**Architecture:** `parse.ts` turns a case folder into events and removes every section that reveals the ending. `cut.ts` decides which events the agent sees. `agent.ts` is a plain loop over the Anthropic Messages API with 7 tools from `tools.ts`; each run ends with exactly one end tool (`hold`, `escalate`, `close_case`). `answers.ts` writes the submission files, and `cli.ts` runs one case, resumes it with `--next`, or runs a folder of cases.

**Tech stack:** Node ≥ 22 (tested on 26.7), TypeScript 7.0.2, `@anthropic-ai/sdk` 0.131.0, `zod` 4.6.5, `tsx` 4.23.15, `node:test`. The design is `docs/plans/2026-10-10-case-agent-design.md`.

---

## Ground rules for the executor

- Work in `/Users/hridyaagrawal/Honey/case-agent`. The repo exists and has one commit.
- Versions are pinned exactly. Each one is the newest release that was published more than 7 days before 2026-10-10. Change a version only if a step fails, and record the reason.
- Each test file imports source files with the `.ts` extension. The `tsconfig.json` in Task 0 allows it.
- The public cases are Dwelly's data. Clone them into `data/public/` (git-ignored). Never commit them.
- Run `npm test` and `npm run typecheck` before each commit. Both must be clean.
- Development runs write to `runs/` (git-ignored). Only Reality Test runs write to the repo root, because `ANSWERS/`, `state/` and `traces/` at the root form the submission.

## Decision taken in this plan: what `--next` adds

The design left one point open. This plan resolves it as follows:

- **The first run** sees every event before the agency's first outbound message (an Email, SMS or Call from the agency to a named party). Those events are intake and system context.
- **`--next`** moves forward to the next event from an outside party (tenant, landlord, contractor, provider). After the first cut, the agent never sees the agency's recorded events, because the agent replaces the agency. Its own actions stand in their place.

Case 027 shows the effect. Run 1 sees event 001, and the first outbound message is event 002. With `--next`, the agent sees events 001 and 007; event 007 is the tenant's "its now clear".

---

### Task 0: Scaffold

**Files:** Create `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `LICENSE`.

**Step 1: Write `package.json`**

```json
{
  "name": "case-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "case": "node --env-file-if-exists=.env --import tsx src/cli.ts",
    "test": "node --import tsx --test test/*.test.ts",
    "typecheck": "tsc -p ."
  },
  "dependencies": {
    "@anthropic-ai/sdk": "0.131.0",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@types/node": "25.9.9",
    "tsx": "4.23.15",
    "typescript": "7.0.2"
  }
}
```

**Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

**Step 3: Write `.gitignore`**

```gitignore
node_modules/
.env
data/
runs/
.DS_Store
```

**Step 4: Write `.env.example`**

```bash
# Required.
ANTHROPIC_API_KEY=
# Optional. Default: claude-sonnet-5-5 (fast; the batch must finish inside 30 minutes).
MODEL=claude-sonnet-5-5
```

**Step 5: Copy the Apache 2.0 licence**

```bash
cp /Users/hridyaagrawal/Honey/dwellyhack/LICENSE LICENSE
sed -i '' 's/Copyright 2026 dwellyhack team/Copyright 2026 case-agent team/' LICENSE
```

Expected: `head -3 LICENSE` shows `Apache License` and `Version 2.0, January 2004`.

**Step 6: Install and fetch the public cases**

```bash
npm install
git clone --depth 1 https://github.com/DwellyOrg/HackatonPublicCases data/public
npx tsc --version
```

Expected: `Version 7.0.2`, and `ls "data/public/Property Management" | wc -l` prints `50`.

**Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example LICENSE
git commit -m "Scaffold TypeScript project with pinned dependencies"
```

---

### Task 1: Case parser

**Files:** Create `src/parse.ts`, `test/parse.test.ts`.

The parser feeds the agent, so the agent's honesty depends on it. It must remove the Overview and Outcome sections and the Status, Updated and Completed detail lines, because each one reveals how the case ended.

**Step 1: Write the failing test** in `test/parse.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAgency, loadCase } from "../src/parse.ts";

const PM = "data/public/Property Management";

test("case 027: parses all 17 events with channel, sender and body", () => {
  const c = loadCase(`${PM}/027`);
  assert.equal(c.id, "027");
  assert.equal(c.title, "Blocked Bath Drain Request");
  assert.equal(c.events.length, 17);
  assert.deepEqual(c.events.map((e) => e.n), Array.from({ length: 17 }, (_, i) => i + 1));
  const e7 = c.events[6];
  assert.equal(e7.channel, "Email");
  assert.equal(e7.from, "Tenant");
  assert.equal(e7.at, "2026-04-28 01:36:58 UTC");
  assert.match(e7.body, /its now clear/);
  assert.doesNotMatch(e7.body, /\*\*Channel:\*\*/);
});

test("case 027: hides every section that reveals the ending", () => {
  const c = loadCase(`${PM}/027`);
  const visible = JSON.stringify({ details: c.details, request: c.request });
  assert.doesNotMatch(visible, /Overview|Outcome|plunger had cleared/);
  assert.doesNotMatch(c.details, /Status|Completed|Updated/);
  assert.match(c.details, /Flat 10, 30 Copperfield Walk/);
  assert.match(c.request, /water keep take hours/);
});

test("case 003: lists attachments by file name", () => {
  const c = loadCase(`${PM}/003`);
  assert.equal(c.events.length, 23);
  assert.deepEqual(c.attachments, [
    "attachment-01-checkout-inspection-report.pdf",
    "attachment-02-cleaning-invoice.pdf",
  ]);
});

test("isAgency: Northbridge and the system are the agency, everyone else is outside", () => {
  for (const from of ["Agency / system", "Northbridge Lettings", "Northbridge Lettings system"]) assert.equal(isAgency(from), true, from);
  for (const from of ["Tenant", "Landlord", "Contractor", "Maintenance provider", "Juniper Surveying"]) assert.equal(isAgency(from), false, from);
});
```

**Step 2: Run it**

```bash
npm test
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND ... src/parse.ts`.

**Step 3: Minimal implementation** in `src/parse.ts`

```ts
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
```

**Step 4: Run it**

```bash
npm test && npm run typecheck
```

Expected: `ℹ pass 4`, `ℹ fail 0`, and tsc prints nothing. This was verified against the public cases on 2026-10-10.

**Step 5: Check that every public PM case parses**

```bash
node --import tsx -e 'import("./src/parse.ts").then(({loadCase}) => { const fs = require("node:fs"); const d = "data/public/Property Management"; let n = 0; for (const c of fs.readdirSync(d)) { const k = loadCase(`${d}/${c}`); if (!k.events.length) throw new Error(c); n += k.events.length; } console.log("events", n); })'
```

Expected: `events` followed by a number above 1500, and no error.

**Step 6: Commit**

```bash
git add src/parse.ts test/parse.test.ts
git commit -m "Parse case folders into events and withhold the ending"
```

---

### Task 2: Cut points

**Files:** Create `src/cut.ts`, `test/cut.test.ts`.

**Step 1: Write the failing test** in `test/cut.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialSeen, nextSeen, visibleEvents } from "../src/cut.ts";
import { loadCase } from "../src/parse.ts";

const PM = "data/public/Property Management";

test("first run stops before the agency's first outbound message", () => {
  assert.equal(initialSeen(loadCase(`${PM}/027`)), 1); // event 002 is the agency email to the tenant
  assert.equal(initialSeen(loadCase(`${PM}/001`)), 3); // event 004 is the agency email to the landlord
});

test("--next jumps to the next event from an outside party", () => {
  const c = loadCase(`${PM}/027`);
  assert.equal(nextSeen(c, 1), 7);
  assert.equal(nextSeen(c, 7), 11);
  assert.equal(nextSeen(c, 15), null);
});

test("after the first cut the agent sees outside events only", () => {
  const c = loadCase(`${PM}/027`);
  assert.deepEqual(visibleEvents(c, 1, 1).map((e) => e.n), [1]);
  assert.deepEqual(visibleEvents(c, 1, 7).map((e) => e.n), [1, 7]);
  assert.deepEqual(visibleEvents(c, 1, 11).map((e) => e.n), [1, 7, 11]);
});
```

**Step 2: Run it**

```bash
npm test
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND ... src/cut.ts`.

**Step 3: Minimal implementation** in `src/cut.ts`

```ts
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
```

**Step 4: Run it**

```bash
npm test && npm run typecheck
```

Expected: `ℹ pass 7`, `ℹ fail 0`.

**Step 5: Commit**

```bash
git add src/cut.ts test/cut.test.ts
git commit -m "Choose the events each run may see"
```

---

### Task 3: Case state

**Files:** Create `src/state.ts`. A test is not necessary here: the file holds types and two thin JSON helpers, and Tasks 4 and 6 exercise both helpers.

**Step 1: Write `src/state.ts`**

```ts
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

export type CaseState = {
  caseId: string;
  initialSeen: number;
  seen: number;
  runs: number;
  status: Status;
  actions: Action[];
  incomplete: boolean;
};

export function newState(caseId: string, initialSeen: number): CaseState {
  return { caseId, initialSeen, seen: initialSeen, runs: 0, status: { kind: "open" }, actions: [], incomplete: false };
}

export function loadState(path: string): CaseState | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as CaseState) : null;
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
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no output.

**Step 3: Commit**

```bash
git add src/state.ts
git commit -m "Add case state and its JSON file"
```

---

### Task 4: Tools

**Files:** Create `src/tools.ts`, `test/tools.test.ts`.

Each tool requires a `reason` that cites events, because REASONING.md is built from those reasons. The three end tools set the status. A refusal or bad input goes back to the model as text, so the model can correct itself.

**Step 1: Write the failing test** in `test/tools.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { newState } from "../src/state.ts";
import { runTool, TOOL_SPECS } from "../src/tools.ts";

const closeInput = {
  outcome: "resolved_without_work",
  work_confirmed_by: "tenant [event 007]",
  landlord_informed: false,
  keys: "not_issued",
  invoice: "not_required",
  reason: "Tenant cleared the drain with a plunger [event 007].",
};

test("hold ends the run and records what the case waits for", () => {
  const s = newState("027", 1);
  const out = runTool("hold", { waiting_for: "Waiting for Tenant", reason: "Asked tenant to try a plunger." }, s);
  assert.deepEqual(out, { ok: true, ends: true, result: "case on hold: Waiting for Tenant" });
  assert.deepEqual(s.status, { kind: "hold", reason: "Waiting for Tenant" });
});

test("work tools do not end the run", () => {
  const s = newState("027", 1);
  const out = runTool("send_message", { to: "tenant", channel: "email", text: "Please try a plunger.", reason: "[event 001]" }, s);
  assert.equal(out.ok, true);
  assert.equal(out.ends, false);
  assert.deepEqual(s.status, { kind: "open" });
});

test("close_case refuses while keys are outstanding", () => {
  const s = newState("027", 1);
  const out = runTool("close_case", { ...closeInput, keys: "outstanding" }, s);
  assert.equal(out.ok, false);
  assert.equal(out.ends, false);
  assert.match(out.result, /^refused: keys are outstanding/);
  assert.deepEqual(s.status, { kind: "open" });
});

test("close_case records the final checks without the reason", () => {
  const s = newState("027", 1);
  const out = runTool("close_case", closeInput, s);
  assert.equal(out.ends, true);
  assert.equal(s.status.kind, "closed");
  assert.ok(s.status.kind === "closed" && !("reason" in s.status.checks));
});

test("bad input goes back as text that names the field", () => {
  const s = newState("027", 1);
  const out = runTool("send_message", { to: "plumber", channel: "email", text: "x", reason: "r" }, s);
  assert.equal(out.ok, false);
  assert.match(out.result, /^invalid input:/);
  assert.match(out.result, /at to/);
});

test("an unknown tool is an error, not a crash", () => {
  const out = runTool("delete_case", {}, newState("027", 1));
  assert.deepEqual(out, { ok: false, ends: false, result: 'unknown tool "delete_case"' });
});

test("every tool spec requires a reason", () => {
  assert.equal(TOOL_SPECS.length, 7);
  for (const t of TOOL_SPECS) assert.ok((t.input_schema.required ?? []).includes("reason"), t.name);
});
```

**Step 2: Run it**

```bash
npm test
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND ... src/tools.ts`.

**Step 3: Minimal implementation** in `src/tools.ts`

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { HOLD_REASONS, type CaseState } from "./state.ts";

export class Refusal extends Error {}

export type ToolOutcome = { ok: boolean; result: string; ends: boolean };

type Tool = {
  description: string;
  schema: z.ZodType;
  end: boolean;
  apply: (input: Record<string, unknown>, state: CaseState) => string;
};

function tool<S extends z.ZodType>(d: {
  description: string;
  schema: S;
  end?: boolean;
  apply: (input: z.infer<S>, state: CaseState) => string;
}): Tool {
  return { description: d.description, schema: d.schema, end: d.end ?? false, apply: (input, state) => d.apply(input as z.infer<S>, state) };
}

const reason = z.string().min(1).describe("Why you take this action. Cite events as [event 007].");

const TOOLS: Record<string, Tool> = {
  send_message: tool({
    description: "Send an email or SMS to the tenant, the landlord or the assigned contractor. The message goes to the outbox.",
    schema: z.object({
      to: z.enum(["tenant", "landlord", "contractor"]),
      channel: z.enum(["email", "sms"]),
      text: z.string().min(1),
      reason,
    }),
    apply: (i) => `${i.channel} to ${i.to} queued in the outbox`,
  }),
  request_landlord_approval: tool({
    description: "Ask the landlord to approve work or a cost. Use this before any contractor visit or any spend.",
    schema: z.object({
      scope: z.string().min(1),
      cost: z.string().min(1).describe('The known cost or quote, for example "£165 + VAT", or "unknown".'),
      reason,
    }),
    apply: (i) => `approval request for "${i.scope}" (cost: ${i.cost}) sent to the landlord`,
  }),
  assign_contractor: tool({
    description: "Assign a maintenance provider. Use this only after the landlord approved the work and is not using their own contractor.",
    schema: z.object({ trade: z.string().min(1), notes: z.string(), reason }),
    apply: (i) => `${i.trade} contractor assigned`,
  }),
  add_note: tool({
    description: "Add an internal note to the case, for example an unrelated request or a missing final check.",
    schema: z.object({ text: z.string().min(1), reason }),
    apply: () => "note added",
  }),
  hold: tool({
    description: "End this run. The case waits for the named party.",
    schema: z.object({ waiting_for: z.enum(HOLD_REASONS), reason }),
    end: true,
    apply: (i, s) => {
      s.status = { kind: "hold", reason: i.waiting_for };
      return `case on hold: ${i.waiting_for}`;
    },
  }),
  escalate: tool({
    description: "End this run. A person takes over the case.",
    schema: z.object({
      summary: z.string().min(1).describe("The handover: what you checked, what is missing or in conflict, and what the person must decide."),
      reason,
    }),
    end: true,
    apply: (i, s) => {
      s.status = { kind: "escalated", summary: i.summary };
      return "case escalated to a person";
    },
  }),
  close_case: tool({
    description: "End this run and close the case. Answer every final check.",
    schema: z.object({
      outcome: z.enum(["work_completed", "resolved_without_work", "withdrawn"]),
      work_confirmed_by: z.string().min(1).describe('Who confirmed the result, with the event, for example "tenant [event 007]".'),
      landlord_informed: z.boolean(),
      keys: z.enum(["returned", "not_issued", "outstanding"]),
      invoice: z.enum(["on_file", "not_required", "outstanding"]),
      reason,
    }),
    end: true,
    apply: (i, s) => {
      if (i.keys === "outstanding") throw new Refusal("keys are outstanding. Confirm the key return first, or hold the case.");
      const { reason: _reason, ...checks } = i;
      s.status = { kind: "closed", checks };
      return "case closed";
    },
  }),
};

export function runTool(name: string, input: unknown, state: CaseState): ToolOutcome {
  const t = TOOLS[name];
  if (!t) return { ok: false, ends: false, result: `unknown tool "${name}"` };
  const parsed = t.schema.safeParse(input);
  if (!parsed.success) return { ok: false, ends: false, result: `invalid input:\n${z.prettifyError(parsed.error)}` };
  try {
    return { ok: true, ends: t.end, result: t.apply(parsed.data as Record<string, unknown>, state) };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, ends: false, result: `refused: ${e.message}` };
    throw e;
  }
}

// The API takes the schema body; the "$schema" dialect marker that zod adds is not part of it.
export const TOOL_SPECS: Anthropic.Tool[] = Object.entries(TOOLS).map(([name, t]) => {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(t.schema);
  return { name, description: t.description, input_schema: schema as Anthropic.Tool.InputSchema };
});
```

**Step 4: Run it**

```bash
npm test && npm run typecheck
```

Expected: `ℹ pass 14`, `ℹ fail 0`.

**Step 5: Commit**

```bash
git add src/tools.ts test/tools.test.ts
git commit -m "Add the seven case tools with zod schemas"
```

---

### Task 5: Policy

**Files:** Create `policy.md`. This is the system prompt. It is agent-facing, so it states each rule as a positive instruction and gives the evidence where the reason is not obvious.

**Step 1: Write `policy.md`**

```markdown
You are the case handler at Northbridge Lettings, a residential letting agency. You process one maintenance case at a time. You act only through your tools, and every message you write goes to an outbox that people read later.

## Each run

1. Read the case details, the initial request, the earlier events, your earlier actions, and the new events.
2. Decide the stage of the case: triage, landlord approval, provider selection, scheduling, work result, final checks, or closed.
3. Take the actions this stage needs. Give a `reason` that cites events as [event 007].
4. End the run with exactly one end tool:
   - `hold` when the case waits for the landlord, the tenant, a provider, or a quote.
   - `escalate` when a person must decide.
   - `close_case` when the work is done and you can answer every final check.

Take only the next step. When you send a message that needs an answer, hold the case. The answer comes in a later run.

## Rules

1. Get landlord approval before any contractor visit or any cost. Use `request_landlord_approval`, and state the cost or quote if you know it.
2. Offer the cheap fix first when one is likely, for example a switch, a reset, a key trick, or a plunger. A blockage from everyday use (hair, soap) is the tenant's responsibility. Tell the tenant that a contractor visit for that cause is charged to them.
3. Send a quote back to the landlord when it is above the approved work.
4. When the landlord says they will use their own contractor, let them. Ask them to confirm when the work is done.
5. Chase once when the landlord or the tenant has not answered for 3 days. After that, escalate. Escalate after 3 or more reminders to one provider.
6. When the property is not tenanted, hold the case and add a note that says so.
7. Close the case only after the final checks: the result is confirmed by the person who saw it, the landlord knows, the keys are back if keys were issued, and the invoice is on file or not required. Record a missing photo or document in a note.
8. When the tenant raises an unrelated matter, record it with `add_note`. Keep this case about its own problem.
9. Escalate at once for an emergency: gas smell, fire, flood, no heat or water for a vulnerable tenant, a security failure, or an injury. Tell the tenant that a person is dealing with it now.
10. Escalate for a legal threat, a dispute about money, or facts that conflict when the conflict changes what you would do. Name the conflict in the summary.

## Messages

Write the way an experienced letting agent writes: short, polite, and specific. Use the property address and the job description from the case. Promise only what the agency controls. Never state that work is done, approved or paid unless an event shows it.
```

**Step 2: Commit**

```bash
git add policy.md
git commit -m "Write the Northbridge case policy"
```

---

### Task 6: Prompt and agent loop

**Files:** Create `src/prompt.ts`, `src/agent.ts`, `test/agent.test.ts`.

The loop gets its model client by injection, so the tests use a fake client and need no API key.

**Step 1: Write the failing test** in `test/agent.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { MAX_TURNS, runCase, type ModelClient } from "../src/agent.ts";
import { loadCase } from "../src/parse.ts";
import { renderCase } from "../src/prompt.ts";
import { visibleEvents } from "../src/cut.ts";
import { newState } from "../src/state.ts";

const c = loadCase("data/public/Property Management/027");

function use(id: string, name: string, input: Record<string, unknown>): Anthropic.ContentBlock {
  return { type: "tool_use", id, name, input } as unknown as Anthropic.ContentBlock;
}

function text(t: string): Anthropic.ContentBlock {
  return { type: "text", text: t } as unknown as Anthropic.ContentBlock;
}

function fake(turns: Anthropic.ContentBlock[][]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: ModelClient = {
    messages: {
      create: async (p) => {
        calls.push(structuredClone(p));
        const content = turns[Math.min(calls.length - 1, turns.length - 1)];
        return { id: "m", type: "message", role: "assistant", model: "fake", content, stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as unknown as Anthropic.Message;
      },
    },
  };
  return { calls, client };
}

const base = { c, newFrom: 1, model: "fake", policy: "policy", trace: () => {} };

test("prompt for run 1 shows the request and event 001 only", () => {
  const s = newState("027", 1);
  const p = renderCase(c, s, visibleEvents(c, 1, 1), 1);
  assert.match(p, /water keep take hours/);
  assert.match(p, /\[event 001\]/);
  assert.doesNotMatch(p, /\[event 002\]/);
  assert.match(p, /None\. This is the first run on this case\./);
});

test("the run stops at the first end tool", async () => {
  const s = newState("027", 1);
  const { calls, client } = fake([[
    text("Everyday blockage, tenant first."),
    use("a", "send_message", { to: "tenant", channel: "email", text: "Please try a plunger.", reason: "[event 001]" }),
    use("b", "hold", { waiting_for: "Waiting for Tenant", reason: "Awaiting the tenant's answer." }),
  ]]);
  const thoughts = await runCase({ ...base, state: s, client });
  assert.equal(calls.length, 1);
  assert.deepEqual(s.status, { kind: "hold", reason: "Waiting for Tenant" });
  assert.deepEqual(s.actions.map((a) => a.tool), ["send_message", "hold"]);
  assert.deepEqual(thoughts, ["Everyday blockage, tenant first."]);
  assert.equal(s.runs, 1);
});

test("a refused tool goes back to the model as an error and the model recovers", async () => {
  const s = newState("027", 1);
  const { calls, client } = fake([
    [use("a", "close_case", { outcome: "work_completed", work_confirmed_by: "provider", landlord_informed: true, keys: "outstanding", invoice: "on_file", reason: "r" })],
    [use("b", "hold", { waiting_for: "Waiting for Provider", reason: "Keys not back yet." })],
  ]);
  await runCase({ ...base, state: s, client });
  assert.equal(calls.length, 2);
  const last = calls[1].messages.at(-1)!;
  assert.ok(Array.isArray(last.content));
  const block = last.content[0] as Anthropic.ToolResultBlockParam;
  assert.equal(block.is_error, true);
  assert.match(String(block.content), /refused: keys are outstanding/);
  assert.deepEqual(s.status, { kind: "hold", reason: "Waiting for Provider" });
});

test("a model that never ends the run is escalated to a person", async () => {
  const s = newState("027", 1);
  const { calls, client } = fake([[text("Thinking about it.")]]);
  await runCase({ ...base, state: s, client });
  assert.equal(calls.length, MAX_TURNS);
  assert.equal(s.incomplete, true);
  assert.equal(s.status.kind, "escalated");
  assert.match(String(calls[1].messages.at(-1)!.content), /End the run now/);
});
```

**Step 2: Run it**

```bash
npm test
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND ... src/agent.ts`.

**Step 3: Write `src/prompt.ts`**

```ts
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
```

**Step 4: Write `src/agent.ts`**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { visibleEvents } from "./cut.ts";
import type { Case } from "./parse.ts";
import { renderCase } from "./prompt.ts";
import type { CaseState } from "./state.ts";
import { runTool, TOOL_SPECS } from "./tools.ts";

export const MAX_TURNS = 15;
const NUDGE = "End the run now with exactly one of hold, escalate or close_case.";

export type ModelClient = {
  messages: { create(p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
};

export type Trace = (kind: string, data: Record<string, unknown>) => void;

export async function runCase(opts: {
  c: Case;
  state: CaseState;
  newFrom: number;
  client: ModelClient;
  model: string;
  policy: string;
  trace: Trace;
}): Promise<string[]> {
  const { c, state, client, model, policy, trace } = opts;
  state.runs += 1;
  state.status = { kind: "open" };
  const visible = visibleEvents(c, state.initialSeen, state.seen);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: renderCase(c, state, visible, opts.newFrom) }];
  const thoughts: string[] = [];
  trace("run_start", { case: c.id, run: state.runs, seen: state.seen, model });

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const resp = await client.messages.create({ model, max_tokens: 4096, system: policy, tools: TOOL_SPECS, messages });
    trace("model", { turn, stop: resp.stop_reason, usage: resp.usage, content: resp.content });
    messages.push({ role: "assistant", content: resp.content });
    for (const b of resp.content) if (b.type === "text" && b.text.trim()) thoughts.push(b.text.trim());

    const uses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (uses.length === 0) {
      messages.push({ role: "user", content: NUDGE });
      continue;
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const out = runTool(u.name, u.input, state);
      state.actions.push({ run: state.runs, afterEvent: state.seen, tool: u.name, input: u.input as Record<string, unknown>, ok: out.ok, result: out.result });
      trace("tool", { name: u.name, input: u.input, ...out });
      if (out.ends) return thoughts;
      results.push({ type: "tool_result", tool_use_id: u.id, content: out.result, is_error: !out.ok });
    }
    messages.push({ role: "user", content: results });
  }

  state.incomplete = true;
  state.status = { kind: "escalated", summary: `The agent did not end the run within ${MAX_TURNS} turns. A person must review case ${c.id}.` };
  trace("auto_escalate", { turns: MAX_TURNS });
  return thoughts;
}
```

**Step 5: Run it**

```bash
npm test && npm run typecheck
```

Expected: `ℹ pass 18`, `ℹ fail 0`.

**Step 6: Commit**

```bash
git add src/prompt.ts src/agent.ts test/agent.test.ts
git commit -m "Add the agent loop with a bounded turn count"
```

---

### Task 7: Answer files

**Files:** Create `src/answers.ts`, `test/answers.test.ts`.

ANSWER.md must let a judge see what the system received, what it did, what it escalated, what failed, and the final result (rules §6C). REASONING.md gives the reason for each action.

**Step 1: Write the failing test** in `test/answers.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAnswer } from "../src/answers.ts";
import { visibleEvents } from "../src/cut.ts";
import { loadCase } from "../src/parse.ts";
import { newState } from "../src/state.ts";

test("ANSWER.md and REASONING.md cover input, actions, failures and status", () => {
  const c = loadCase("data/public/Property Management/027");
  const s = newState("027", 1);
  s.runs = 1;
  s.actions = [
    { run: 1, afterEvent: 1, tool: "close_case", input: { reason: "too early" }, ok: false, result: "refused: keys are outstanding." },
    { run: 1, afterEvent: 1, tool: "send_message", input: { to: "tenant", reason: "Everyday blockage [event 001]." }, ok: true, result: "email to tenant queued in the outbox" },
    { run: 1, afterEvent: 1, tool: "hold", input: { waiting_for: "Waiting for Tenant", reason: "Awaiting the tenant." }, ok: true, result: "case on hold: Waiting for Tenant" },
  ];
  s.status = { kind: "hold", reason: "Waiting for Tenant" };
  const out = mkdtempSync(join(tmpdir(), "answers-"));
  writeAnswer(out, c, s, visibleEvents(c, 1, 1), ["Tenant first."]);

  const answer = readFileSync(join(out, "ANSWERS/027/ANSWER.md"), "utf8");
  assert.match(answer, /^# Case 027: Blocked Bath Drain Request/);
  assert.match(answer, /\*\*Final status:\*\* hold \(Waiting for Tenant\)/);
  assert.match(answer, /\[event 001\] Update from Agency \/ system/);
  assert.match(answer, /\| 1 \| 1 \| send_message \| ok \|/);
  assert.match(answer, /## Escalation\n\nNone\./);
  assert.match(answer, /## Failed or refused actions\n\n- close_case: refused: keys are outstanding\./);

  const reasoning = readFileSync(join(out, "ANSWERS/027/REASONING.md"), "utf8");
  assert.match(reasoning, /### Run 1 · send_message\n\nEveryday blockage \[event 001\]\./);
  assert.match(reasoning, /## Agent notes from the latest run\n\nTenant first\./);
});
```

**Step 2: Run it**

```bash
npm test
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND ... src/answers.ts`.

**Step 3: Minimal implementation** in `src/answers.ts`

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Case, CaseEvent } from "./parse.ts";
import { statusLabel, type CaseState } from "./state.ts";

const cell = (v: string) => v.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function answerMd(c: Case, s: CaseState, visible: CaseEvent[]): string {
  const received = visible.map((e) => `- [event ${String(e.n).padStart(3, "0")}] ${e.channel} from ${e.from}`).join("\n");
  const rows = s.actions.map((a) => `| ${a.run} | ${a.afterEvent} | ${a.tool} | ${a.ok ? "ok" : "failed"} | ${cell(a.result)} |`).join("\n");
  const failed = s.actions.filter((a) => !a.ok).map((a) => `- ${a.tool}: ${a.result}`).join("\n");
  return `# Case ${c.id}: ${c.title}

**Final status:** ${statusLabel(s.status)}
**Runs:** ${s.runs} · **Events seen:** up to event ${s.seen}
${s.incomplete ? "\n**Incomplete:** the agent did not finish this run, so the system escalated the case to a person.\n" : ""}
## What the system received

- The case details and the initial request from index.md. The Overview and Outcome sections were withheld.
- Attachments: ${c.attachments.join(", ") || "none"}
${received}

## Actions taken

| Run | After event | Tool | Result | Detail |
|-----|-------------|------|--------|--------|
${rows || "| – | – | – | – | – |"}

## Escalation

${s.status.kind === "escalated" ? s.status.summary : "None."}

## Failed or refused actions

${failed || "None."}
`;
}

function reasoningMd(c: Case, s: CaseState, thoughts: string[]): string {
  const steps = s.actions.map((a) => `### Run ${a.run} · ${a.tool}\n\n${String(a.input.reason ?? "(no reason given)")}`).join("\n\n");
  return `# Reasoning for case ${c.id}

${steps || "No actions."}

## Agent notes from the latest run

${thoughts.join("\n\n") || "None."}
`;
}

export function writeAnswer(outDir: string, c: Case, s: CaseState, visible: CaseEvent[], thoughts: string[]): void {
  const dir = join(outDir, "ANSWERS", c.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ANSWER.md"), answerMd(c, s, visible));
  writeFileSync(join(dir, "REASONING.md"), reasoningMd(c, s, thoughts));
}
```

**Step 4: Run it**

```bash
npm test && npm run typecheck
```

Expected: `ℹ pass 19`, `ℹ fail 0`.

**Step 5: Commit**

```bash
git add src/answers.ts test/answers.test.ts
git commit -m "Write ANSWER.md and REASONING.md per case"
```

---

### Task 8: CLI

**Files:** Create `src/cli.ts`.

The CLI is the error boundary. A crash in one case escalates that case and writes its answer, so coverage holds. The SDK retries on its own (`maxRetries: 3`, `timeout: 120_000`), so the CLI adds no retry code of its own.

**Step 1: Write `src/cli.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { runCase, type Trace } from "./agent.ts";
import { writeAnswer } from "./answers.ts";
import { initialSeen, nextSeen, visibleEvents } from "./cut.ts";
import { loadCase } from "./parse.ts";
import { loadState, newState, saveState, statusLabel } from "./state.ts";

const USAGE = `usage:
  npm run case -- run <case-dir> [--next] [--out <dir>]
  npm run case -- run-all <cases-dir> [--limit N] [--concurrency N] [--out <dir>]`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    next: { type: "boolean", default: false },
    out: { type: "string", default: "." },
    limit: { type: "string" },
    concurrency: { type: "string", default: "4" },
  },
});
const [cmd, target] = positionals;
if (!cmd || !target || !["run", "run-all"].includes(cmd)) {
  console.error(USAGE);
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add the key.");
  process.exit(1);
}

const out = values.out;
const model = process.env.MODEL ?? "claude-sonnet-5-5";
const policy = readFileSync(new URL("../policy.md", import.meta.url), "utf8");
const client = new Anthropic({ timeout: 120_000, maxRetries: 3 });

async function processCase(dir: string, next: boolean): Promise<string> {
  const c = loadCase(dir);
  const statePath = join(out, "state", `${c.id}.json`);
  const tracePath = join(out, "traces", `${c.id}.jsonl`);
  mkdirSync(dirname(tracePath), { recursive: true });

  let state = next ? loadState(statePath) : null;
  let newFrom = 1;
  if (next) {
    if (!state) throw new Error(`case ${c.id} has no saved state. Run it once without --next.`);
    const seen = nextSeen(c, state.seen);
    if (seen === null) throw new Error(`case ${c.id} has no further events from the tenant, landlord or a contractor.`);
    newFrom = state.seen + 1;
    state.seen = seen;
  } else {
    state = newState(c.id, initialSeen(c));
    writeFileSync(tracePath, "");
  }

  const trace: Trace = (kind, data) =>
    appendFileSync(tracePath, JSON.stringify({ t: new Date().toISOString(), kind, ...data }) + "\n");
  let thoughts: string[] = [];
  try {
    thoughts = await runCase({ c, state: state!, newFrom, client, model, policy, trace });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state!.incomplete = true;
    state!.status = { kind: "escalated", summary: `System error: ${message}. A person must review case ${c.id}.` };
    trace("error", { message });
  }
  saveState(statePath, state!);
  writeAnswer(out, c, state!, visibleEvents(c, state!.initialSeen, state!.seen), thoughts);
  return `${c.id}: ${statusLabel(state!.status)}${state!.incomplete ? " [incomplete]" : ""}`;
}

if (cmd === "run") {
  console.log(await processCase(target, values.next));
} else {
  const dirs = readdirSync(target)
    .filter((d) => existsSync(join(target, d, "index.md")))
    .sort()
    .slice(0, values.limit ? Number(values.limit) : undefined);
  const queue = [...dirs];
  const workers = Array.from({ length: Number(values.concurrency) }, async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        console.log(await processCase(join(target, d), false));
      } catch (e) {
        console.error(`${d}: failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`done: ${dirs.length} cases`);
}
```

**Step 2: Typecheck and check the guard paths**

```bash
npm run typecheck
npm run case
env -u ANTHROPIC_API_KEY node --import tsx src/cli.ts run "data/public/Property Management/027"
```

Expected: tsc prints nothing. The second command prints the usage text and exits 1. The third prints `ANTHROPIC_API_KEY is not set` and exits 1.

**Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "Add the CLI: run, resume with --next, run-all"
```

---

### Task 9: Live check on case 027

This task needs a real key in `.env`. It is the MVP acceptance check from the design. Model output varies from run to run, so this check is a judgement on the trace, not an exact string match.

**Step 1: Run 1**

```bash
cp .env.example .env   # then add ANTHROPIC_API_KEY
npm run case -- run "data/public/Property Management/027" --out runs/dev
```

Expected: `027: hold (Waiting for Tenant)`. In `runs/dev/ANSWERS/027/ANSWER.md`, the actions include a `send_message` to the tenant with the plunger and drain-cleaner advice, and no `assign_contractor`.

**Step 2: Resume with the tenant's reply**

```bash
npm run case -- run "data/public/Property Management/027" --next --out runs/dev
```

Expected: `027: closed (resolved_without_work)`. REASONING.md cites `[event 007]`.

**Step 3: When the result differs**

Read `runs/dev/traces/027.jsonl` and find the turn where the decision went wrong. Change `policy.md` only, never the case data. Then run Steps 1 and 2 again. If the policy changed, commit it:

```bash
git add policy.md
git commit -m "Tune policy after the case 027 live check"
```

**Step 4: Run ten cases**

```bash
npm run case -- run-all "data/public/Property Management" --limit 10 --out runs/dev
```

Expected: ten status lines, then `done: 10 cases`, with no `failed:` lines. Read three ANSWER.md files and compare each first decision with the real next agency event in the case history. Record the misses as candidate policy changes for the bench task. Do not tune now.

---

### Task 10: README

**Files:** Create `README.md`. The rules (§6B) require these eight sections.

**Step 1: Write `README.md`**

````markdown
# case-agent

Real-World Agents Hackathon (Dwelly), London, 10 October 2026. Track: Property Management.

## What we built

An agent that processes property-maintenance cases as the letting agency, Northbridge Lettings. It reads a case, acts through tools (messages, landlord approval requests, contractor assignment, notes), and ends each run in one of three states: on hold for a named party, escalated to a person with a handover, or closed after the final checks. When the next real reply arrives, the agent resumes the case.

## The operational problem

Letting agencies spend most of their time waiting for approval from landlords, replies from tenants, and contractor reports. This agent handles each step, and it passes a case to a person when the case needs judgement: an emergency, a legal threat, a money dispute, or facts that conflict.

## Architecture

```
case folder (index.md, history.md, attachments/)
  -> parse.ts    events; Overview, Outcome and Status removed
  -> cut.ts      the events this run may see
  -> agent.ts    Claude tool loop, at most 15 turns, ends with hold | escalate | close_case
  -> tools.ts    7 tools with zod schemas; every action has a cited reason
  -> answers.ts  ANSWERS/<n>/ANSWER.md and REASONING.md
state/<n>.json saves the case between runs; traces/<n>.jsonl logs every model call and tool call.
```

The rules for the agent are in `policy.md`. They come from 50 public Property Management cases.

## How to run

```bash
npm install
cp .env.example .env                                   # add ANTHROPIC_API_KEY
npm run case -- run <case-dir>                         # first run
npm run case -- run <case-dir> --next                  # resume on the next reply
npm run case -- run-all <cases-dir> --concurrency 4    # every case in a folder
npm test
```

## Models, APIs and services

- Anthropic Claude (`claude-sonnet-5-5` by default; set `MODEL` to change it) through `@anthropic-ai/sdk`.
- No other external service. Messages and assignments go to the outbox in the case state.

## Assumptions

- The agent acts as the agency. After the first run it sees only events from outside parties; its own actions take the place of the agency's recorded events.
- The tools are simulated, because the event provides no live systems. Each tool is one entry in `src/tools.ts`, so a real API can replace it.

## Known limitations

- PDF attachments are listed but not read.
- The agent sees time only through event timestamps, so "3 days without reply" works only when a later event shows the gap.

## Next steps

- An evaluation bench that replays the public cases event by event and grades each decision against the real history.
- PDF text extraction for quotes and invoices.
- Real adapters for email, SMS and the agency's job system.
````

**Step 2: Commit**

```bash
git add README.md
git commit -m "Add README with the required sections"
```

---

## Done when

- `npm test` reports `pass 19`, `fail 0`, and `npm run typecheck` prints nothing.
- Task 9 Steps 1 and 2 end in `hold (Waiting for Tenant)` and then `closed (resolved_without_work)`.
- `run-all --limit 10` writes ten ANSWER.md files with no `failed:` lines.
- `git status` is clean, and `data/`, `.env` and `runs/` are not tracked.
