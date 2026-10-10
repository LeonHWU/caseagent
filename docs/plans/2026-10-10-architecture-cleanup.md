# Architecture cleanup

Date: 2026-10-10. Status: plan, not built.

The goal is a smaller codebase where each rule has one owner. The behaviour stays the same: the same prompts, the same tools, the same ANSWER.md and REASONING.md. Each step below is one commit, and `npm test` and `npm run typecheck` pass after each one.

Today `src/` has 1,265 lines. The target is about 800.

## What is wrong today

1. **The hidden-ending rule has three owners.** `parse.ts` removes the Status lines, `cut.ts` decides which events are visible, and `prompt.ts` decides which attachments are visible. `answers.ts` then works out which events each run saw by reading `afterEvent` from the actions and notes. A run with no actions and no notes loses its events in the report.
2. **The case state has no single owner.** `agent.ts` changes `runs`, `status` and `notes`. The end tools in `tools.ts` change `status`. `run.ts` changes `seen` and `incomplete`.
3. **`incomplete` is a separate flag.** It is true only when the status is `escalated`, but the type allows `incomplete` with any status.
4. **Action inputs are untyped.** `Action.input` is `Record<string, unknown>`, so `answers.ts` casts it to read `to`, `text`, `scope` and `cost`. The zod schemas already know these types.
5. **`processCase` mixes three flags.** `next`, `step` and `singleStep` combine in one nested ternary. The load-error path repeats the trace and state setup. The function uses `state!` six times, and the variable `loadError` is set but never read.
6. **The parser has four layers, and the real data uses one.** All 200 public cases load with the strict parser. The lenient parser repeats the strict parser with looser patterns. The loose and raw layers have three problems:
   - `run-all` and the MCP server never reach them, because both list only folders that have `index.md`;
   - the loose layer stamps every event with the current time, so the "Now" line and the days-since line in the prompt are wrong;
   - the raw layer puts the same text in both the case details and event 1, so the prompt contains it twice.
7. **Some code is never used.**
   - `runCase` returns `thoughts`, and `writeAnswer` takes them as a parameter but never reads them.
   - The disk cache for pdf.js text adds a `cacheDir` parameter to four functions to save 2 to 52 ms per file.
   - `loadState` has a migration shim for state files that have no `notes`.
8. **The model request is built in two places.** `prompt.ts` returns text, images and documents, and `agent.ts` maps them to API blocks. `agent.ts` then rebuilds the system block and copies every message on every turn to place the cache breakpoints.

## Target layout

```
src/
  parse.ts        loadCase: one tolerant parser for index.md and history.md
  cut.ts          what the agent may see: events, attachments, earlier vs new
  attachments.ts  readAttachments(caseDir, names) -> content blocks; owns the 20 MB PDF budget
  prompt.ts       renderCase(view, state) -> Anthropic.ContentBlockParam[]
  tools.ts        tool schemas, runTool, TOOL_SPECS; typed Action union
  agent.ts        the model and tool loop; returns one Run and the final Status
  state.ts        types, zod-checked loadState, saveState
  answers.ts      pure render: (case, state) -> { answer, reasoning }
  run.ts          processCase, processToEnd, listCases, liveDeps: files, trace, error boundary
  cli.ts, mcp.ts  entry points only
```

The core (`cut`, `prompt`, `tools`, `answers`) does no IO. The shell (`run`, `cli`, `mcp`, `attachments`) reads and writes files and calls the model.

## Steps

### 1. Delete unused code (low risk)

- Remove `thoughts` from `runCase`, `processCase` and `writeAnswer`.
- Remove the pdf.js text cache and the `cacheDir` parameter from `processCase`, `runCase`, `renderCase` and `readAttachment`. The Docling `.md` files remain the only cache.
- Remove the `notes` shim in `loadState` and the unused `loadError` variable.
- Remove the `CasePrompt` type import from `agent.ts`.

### 2. Store one record per run (state format changes)

```ts
type Run = { n: number; events: { from: number; to: number }; notes: string[]; actions: Action[] };
type Status =
  | { kind: "open" }
  | { kind: "hold"; reason: HoldReason }
  | { kind: "escalated"; summary: string; by: "agent" | "system" }
  | { kind: "closed"; checks: CloseChecks };
type CaseState = { caseId: string; initialSeen: number; seen: number; status: Status; runs: Run[] };
```

- `runEvents` in `answers.ts` is no longer needed, because each run records its own event range. A run with no actions keeps its events.
- `escalated` with `by: "system"` replaces `incomplete`. The `[incomplete]` label is derived from it.
- The tools stop changing the state. An end tool returns its `Status`, `runCase` builds the `Run`, and `run.ts` appends it.
- `loadState` checks the file with a zod schema, so a bad file fails when it loads.
- Delete `runs/` once. The old state files do not match the new format, and nothing reads them.

### 3. One module for the hidden-ending rule

`cut.ts` exports `view(c, state, newFrom) -> { earlier, fresh, attachments: { name, receivedWith? }[], now }`. The attachment visibility rule moves from `prompt.ts` into this function. `prompt.ts` and `answers.ts` both use `view`, so neither one repeats the rule. `test/cut.test.ts` and `test/attachments-gating.test.ts` merge into one test of `view`.

### 4. `renderCase` returns the API blocks

- `readAttachments(caseDir, names)` returns the content blocks and owns the PDF budget. `NATIVE_PDF_TOTAL_BYTES` moves from `prompt.ts` to `attachments.ts`.
- The extension `if` chain becomes a map from extension to reader.
- `renderCase` returns `Anthropic.ContentBlockParam[]`, and `agent.ts` sends it as it is.
- Caching: if the SDK supports automatic caching at the request level, use that one field. If it does not, keep one small helper that marks the last block. In both cases, build the system block and the tool list once, before the loop. Check `cache_read_input_tokens` in a live trace, as the harness plan describes.
- Shorten `getLastContactDays` to one pass over the visible events.

### 5. Typed actions

The `Action` union comes from the tool schemas:

```ts
type Action = { [K in ToolName]: { tool: K; input: z.infer<(typeof TOOLS)[K]["schema"]>; ok: boolean; result: string } }[ToolName];
```

`runTool` returns the parsed input, so the state stores trusted values. `answers.ts` filters with `a.tool === "send_message"` and reads `a.input.text` without a cast. A failed action that never parsed keeps its raw input under a separate `{ tool, raw, ok: false }` variant.

### 6. Flatten `processCase`

```ts
type Mode = { kind: "start"; step?: number } | { kind: "resume"; step?: number; singleStep: boolean };

export async function processCase(deps: RunDeps, dir: string, mode: Mode): Promise<CaseState> {
  const files = caseFiles(deps.out, basename(dir), mode.kind === "start");
  let c: Case | undefined;
  let state: CaseState;
  try {
    c = loadCase(dir);
    state = mode.kind === "start" ? startState(c, mode.step) : resumeState(c, files.loadState(), mode);
    state.runs.push(await runCase({ ...deps, c, state, trace: files.trace }));
  } catch (e) {
    state = escalateBySystem(state ?? newState(basename(dir)), e);
  }
  files.save(c, state);
  return state;
}
```

- `caseFiles` owns the state path, the trace path, trace rotation and the writes. The trace and state setup no longer appears twice.
- `resumeState` holds the `seen` and `newFrom` rules and their two errors, as guard clauses.
- `singleStep` belongs only to a resume. The MCP server is its only caller.

### 7. Two loaders: history and files

The test set will contain cases made of loose files, so the fallback stays, as one loader.

- **History loader.** Merge `tryStrict` and `tryLenient` into one parser that accepts both heading forms. The strict fixture and the lenient fixture both pass through it.
- **Files loader.** Merge loose and raw into one reader for a folder of files. Each readable file becomes one event. The date comes from an email `Date:` header, else from a timestamp in the text, else from the file's modified time. It never comes from the current time. Events sort by date, then by file name. A file named like a call or a transcript becomes a Call event. The ending sections and the Status, Updated and Completed lines are removed before the text reaches the agent. The text appears once, as events, and not again in the case details.
- `Case.layer` becomes `"history" | "files"`. ANSWER.md flags `files` for review.
- `listCases` accepts any folder that has `index.md`, `history.md`, or a readable file, so `run-all` and the MCP server reach these cases.

### 8. Entry points and docs

- `listCases(dir)` and the `ANTHROPIC_API_KEY` check move to `run.ts`. Today `cli.ts` and `mcp.ts` each have a copy.
- In `mcp.ts`, `run` and `runToEnd` become one function that takes the mode.
- Update the README architecture section to the new layout.
- Optional: delete `docs/plans/2026-10-10-case-agent.md`. It is the 1,318-line build script for code that now exists, and git history keeps it.

## What stays

- The tool adapter seam. It has two implementations, the built-in tools and the failing fakes in the tests, so the seam is real.
- The plain loop with no agent framework.
- `processToEnd`, the cap of 15 turns and the cap of 10 stages.
- Tests at the stable boundaries: `loadCase`, `view`, `renderCase`, `runTool`, and `processCase` with the fake client. Delete tests of helpers that no longer exist.

## Order and risk

Steps 1, 4, 6 and 8 do not change any output, and the tests prove it. Step 2 changes the state format, so do it before any `--next` runs you want to keep. Step 7 changes which folders load, so it waits for the decision.
