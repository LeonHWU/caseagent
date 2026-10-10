# Harness improvements

Seven changes, in build order. Each change gets its own commit, and each has a test unless it says otherwise. No change alters the hidden-ending rule: the agent never sees the Overview, the Outcome, the Status lines, or anything from an event it has not reached.

## 1. Fallback loading for messy cases

Today `loadCase` runs before the error boundary, so a case that does not parse gets no ANSWER.md and scores zero. The fix has four layers. The loader tries each layer in order and records the layer it used in the case, so ANSWER.md can say "loaded with: raw fallback".

1. **Strict parser.** This is the current `index.md` and `history.md` parser.
2. **Lenient parser.** This layer accepts the variants a person makes when writing a case by hand:
   - a missing `<a id>` anchor;
   - `-` or `–` in place of `—`;
   - a missing `UTC`;
   - `**From:**` fields in a different order or case;
   - a missing `index.md`, where the title comes from the folder name and the details are empty;
   - a missing "Initial request", where event 1 serves as the request.
3. **Loose-file parser.** A folder that has no `history.md` but has `.eml`, `.txt`, `.md`, `.json` or `.csv` files becomes one event per file. Email headers give the sender, recipient and date. A `.txt` whose name contains "call" or "transcript" becomes a Call event. Files without a date sort by file name.
4. **Raw fallback.** All readable text in the folder goes to the agent as one document, with a single run and no cut points. Before the text goes to the agent, the loader removes any section headed Overview, Outcome, Resolution or Summary, and any Status, Updated or Completed line. Raw mode has the highest risk of leaking the ending, so ANSWER.md flags it.

If all four layers fail, the case still gets an `escalated [incomplete]` ANSWER.md that contains the error. To make this possible, `loadCase` moves inside the error boundary in `processCase`. The batch loop then has nothing left that can skip a case.

Tests: one fixture folder per layer under `test/fixtures/`. The fixtures are small hand-written cases, not Dwelly data. Each test checks the layer that was used, the event count, and that a planted "Outcome" sentence is absent. One more test checks that an unreadable folder produces an ANSWER.md.

## 2. A better ANSWER.md

The rules ask that a judge can see what the system received, did, produced, escalated and failed, and the final result. Today the email text exists only in the state JSON. The new layout, top to bottom:

- **Summary.** The final status, a one-line outcome, the number of runs, and the loader layer.
- **Timeline.** One block per run. Each block names the events it received, with a short excerpt of each, and the actions it took.
- **Outbox.** Every message in full, with the run, recipient and channel.
- **Approvals requested.** The scope and cost of each request.
- **Final checks.** This table appears only when the case is closed: who confirmed the result, whether the landlord was informed, the keys, and the invoice.
- **Notes.** The `add_note` entries, which include any unrelated requests the agent recorded.
- **Escalation.** The handover summary, or "None".
- **Failed, refused or invalid actions.** Each one with its error text, and whether the agent recovered.

Tests: extend `answers.test.ts`. Check that the full message text appears, that the final checks show only for closed cases, and that each run has its own block.

## 3. The current date in the prompt

`renderCase` adds a "Now" line before the events. Its value is the timestamp of the latest event the agent can see. Below it, a computed line gives the days since the last message from each outside party, for example "landlord: 4 days, tenant: 0 days". The timestamps are already parsed, so the computation is a date difference.

Limit: the date helps when a case arrives already stale, as a Reality Test case may. It cannot make the agent chase on its own, because time moves forward only when a real event arrives. A "time tick" resume is out of scope.

Tests: one prompt test that checks the Now value and the days-since line for case 027 at event 7.

## 4. Attachment text

- An attachment becomes visible when the event that links it becomes visible. The parser records the attachment links of each event. Files that no event links count as visible from the start.
- PDF text comes from `unpdf@1.8.1`, pinned exactly. The package has no dependencies, is 2 MB, bundles pdf.js, and was released on 2026-08-13. Its `extractText(..., { mergePages: true })` read all 25 public PDFs in 2–52 ms each, and it kept the money totals. pypdf lost one: it read "Total:" with no amount on the case 003 invoice, where unpdf read "Total: £125". The PDFs contain text, not scans; their "Image evidence" blocks hold text captions only. OCR is therefore not needed.
- The text is extracted once per file and cached next to the state. Each file is capped at about 8,000 characters, with a note when the text is cut. Most invoices and quotes are 0.9–1.7k characters. The inspection reports are 9–15k characters, so they get cut. The cut keeps the start of the report, which holds the summary and the defects.
- `.txt`, `.csv` and `.md` files are included as text.
- PNG and JPEG files become image blocks in the model call. Only the other tracks have images today.
- A file that fails to extract shows as "could not read", with the error, and the run continues.

Tests: case 003 with the extracted invoice text (it contains `NBL-003-2766`), the gating rule (the invoice is hidden before its event), and the failure path with a corrupt fixture PDF.

## 5. `--to-end`

A new loop around `processCase`: run the first stage, then keep resuming while the status is `hold` and `nextSeen` finds another outside event. The loop stops on `closed`, `escalated` or `incomplete`, or when no events remain. The CLI gets `run --to-end` and `run-all --to-end`. The MCP `run_case` gets an optional `to_end` flag. Every stage appends to the same trace and state, so the timeline in ANSWER.md shows the whole path.

A safety cap of 10 stages per case stops a case that keeps going back on hold.

Tests: case 027 with the scripted fake model. Hold, then close, then a stop: the parking-space events after the close never run.

## 6. Tool failures

- **Failure type.** Tools gain a third failure kind next to "invalid" and "refused": "failed", for example a timeout or a provider error. The model sees it as `is_error`, with the text `failed: <error>`. ANSWER.md lists it.
- **Adapter seam.** `runCase` accepts optional tool adapters that override a tool's `apply`. This is the seam where Dwelly's supplied tools plug in at 16:30. It is also how the tests inject a failure. It is the one new abstraction, and the supplied tools justify it.
- **Policy rule.** Add to `policy.md`: "If a tool fails, retry it once with the same input. If it fails again, escalate and name the action that failed. Never tell anyone that a failed action happened."

Tests: a fake adapter that fails once and then succeeds, so the run completes and records both attempts. A second fake adapter fails twice. With a scripted model that escalates, the escalation and the failure both appear in ANSWER.md.

## 7. Per-run reasoning and prompt caching

- **Per-run notes.** The state gains `notes: {run, afterEvent, text}[]`, so the agent's notes survive every run. REASONING.md groups by run: the events received, then the notes, then each action with its reason. Old state files without `notes` still load. Test: two runs give two note blocks.
- **Prompt caching.** Add `cache_control` breakpoints on the system policy and on the last tool definition. These are the same for every call. Add a third breakpoint on the latest message, so each turn reuses the previous turns. Each model minimum for a cacheable prefix is checked against the Anthropic docs during the build; if the policy plus the tools is below the Haiku minimum, the first two breakpoints do nothing and only the message breakpoint helps. Verification: no unit test. Run case 027 live twice, and check that `cache_read_input_tokens` in the trace is above zero on later turns.

## After the build

Run `run-all --to-end --limit 10` on the Property Management cases and time it. Compare the first decision in each case with the next real agency event. Fix crashes first, then policy misses.
