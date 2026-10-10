# Property Management Process Reward — 10 Historical Reference Samples

This is a development Process Eval set. Each sample evaluates **the next actual business tool action at one historical decision point**, rather than the outcome of an entire case. The 10 samples come from 8 property management cases. They are not the organizer's official golden set and do not require verbatim reproduction of historical actions.

Source: `DwellyOrg/HackatonPublicCases`, pinned to commit `9bcdca585955dfb930005ed742572606e68f5688`. The MCP interface is based on the merged single-step implementation at commit `1ff6e85`, supporting `run_case({case_id, step})`.

## Samples and Derivation Sources

| ID | Case / step | Visible evidence | Historical reference action | Current business tool mapping |
|---|---|---|---|---|
| pm-011-initial-approval | 011 / 3 | 001–003 fault and approval requirement | 004 request landlord approval for inspection | request_landlord_approval; equivalent send_message allowed |
| pm-011-approved-assignment | 011 / 10 | 004 request, 009–010 approval | 011 assign a maintenance provider | assign_contractor |
| pm-017-switch-troubleshooting | 017 / 8 | 001 fault, 008 switch location | 009 relay instructions and request feedback | send_message → tenant |
| pm-017-await-tenant | 017 / 9 | 008–009 troubleshooting instructions sent | 010 record pending tenant response | hold → Waiting for Tenant |
| pm-013-report-completion | 013 / 27 | 027 completed-job invoice message matching the address | 028 notify landlord of completion | send_message → landlord |
| pm-028-landlord-own-repair | 028 / 7 | 003 options, 007 landlord handles repair | 008 await completion by landlord's provider | hold → Waiting for Landlord |
| pm-032-conditional-assignment | 032 / 8 | 006–008 approval and quote requirement for major work | 009 assign a maintenance provider | assign_contractor, preserving approval limits |
| pm-035-landlord-resolved-close | 035 / 12 | 006 landlord handles repair, 011–012 completion confirmation | 013 complete without agency payment | close_case → work_completed |
| pm-044-clarify-window | 044 / 4 | 001 does not identify the faulty window | 005 ask which window | send_message → tenant |
| pm-049-conditional-self-fix | 049 / 7 | 001, 004, 007 conditional approval | 008 relay self-repair/contractor options | send_message → tenant |

`step` is an **inclusive event number**, not a tool call count. For example, step=8 exposes events 001–008; reference event 009 is available only for grading.

Each `samples/*.json` contains:

- `input`: isolated fixture paths, MCP call arguments, and visible events.
- `expected`: allowed tools, exact arguments, semantic scoring criteria, and prohibited behaviors.
- `provenance.input_evidence`: source excerpts preceding the cutoff.
- `provenance.reference_actions`: future reference excerpts, for review only.
- `provenance.derivation`: the mapping from historical actions to current tools, distinguishing direct evidence from inferred fields.
- Source commit, original file SHA-256 hashes, event numbers, source line numbers, and pinned GitHub links.

## Input Isolation

`fixtures/<eval-id>/<case-id>/` contains a truncated input copy: Case details with Status/Updated/Completed removed, the Initial request, and history through the selected step. Overview, Outcome, Next action, and other reference-answer sections are excluded.

These samples do not require attachment contents. Attachment files and listings are not copied, preventing invoices or images received later from leaking into earlier inputs. Any unavailable attachment referenced in the history remains unavailable; its contents must not be invented.

**Give the agent only the fixture path, never the sample JSON or full original case directory.** Labels contain future excerpts. The grader may read labels; the evaluated agent must not.

Run each sample independently using `run_case` to reset state. Do not use `resume_case` between different cutoffs of the same case: it carries earlier generated actions forward and filters some agency history, unlike this set's complete truncated prefixes.

## Running the Local MCP

From the repository root, start a stdio MCP server for one sample:

```sh
CASES_DIR='evals/Process Reward/fixtures/pm-028-landlord-own-repair' \
OUT_DIR='runs/process-eval/pm-028-landlord-own-repair' \
npm run --silent mcp
```

Call through the connected MCP client:

```json
{"name":"run_case","arguments":{"case_id":"028","step":7}}
```

Use each sample's own `cases_dir` from the manifest and a separate OUT_DIR. Execution requires ANTHROPIC_API_KEY and a model. Dataset generation and validation require no API key and make no live model calls.

## Process Reward Scoring

Run the live model from the repository root, loading the local `.env`:

```sh
node --env-file=.env --import tsx 'evals/Process Reward/run.ts'
```

The default model is the repository's `claude-sonnet-5-5`; override it with `MODEL`. Results and raw traces are written to Git-ignored `runs/process-eval/`. The runner checks tools and exact arguments automatically; semantic scoring still requires review. Each result has a `run_outcome`:

- `completed`: the agent ended the run itself. The result has a structural match check, and its semantic review is `pending`.
- `model_failure`: the model used all 15 turns without an end tool. Under strict scoring, no action scores 0, so the score is `0`.
- `runtime_failure`: the API, the case loader or the MCP call failed, for example on a timeout. The model was not judged, so the score is `null` and `error` holds the message.

A failure on one sample does not stop the suite. The runner records the failure and continues, and it saves `results.json` after every sample.

Read actual `actions` from `state/<case>.json` or `tool` entries from `traces/<case>.jsonl`, rather than relying only on the model's claims.

1. Require one actual, successful business tool attempt whose `tool` and `exact_arguments` match an allowed branch. No action, multiple actions, tool failure, or a branch mismatch yields 0 under strict reference scoring; retain failure evidence.
2. Review that branch's `semantic_requirements`: award each criterion's weight if satisfied, otherwise 0. Score = `4 × passed weight / total weight`, rounded to two decimal places.
3. Any prohibited behavior yields 0. Check actual arguments and messages, not only the tool name.
4. For a reasonable alternative not covered by the labels, record `needs_review`. Revise the rubric after review while preserving original outputs. Do not treat history as the only valid answer.

Tool names and enums can be checked automatically; message/notes/reason semantics require review. This version supplies test data and rubrics, but does not implement an automated semantic judge.

**Do not require facts available only in future reference actions.** Case 013/27 does not require £162.85, which first appears in hidden event 028. In 035/12, the landlord handling the repair and confirming completion are directly supported by history. keys=not_issued / invoice=not_required are inferred MCP field mappings, not independent golden fields or separately scored criteria. No agency payment does not imply a paid invoice.

## Validation

From the repository root:

```sh
node --import tsx 'evals/Process Reward/validate.ts'
```

If the original case repository is alongside this repository, verify hashes, source lines, and excerpts as well:

```sh
node --import tsx 'evals/Process Reward/validate.ts' ../HackatonPublicCases
```

Validation checks cutoff boundaries, label references, and tool compatibility for all 10 fixtures, then uses a fake model through the actual MCP protocol entry point to check input isolation and output generation. **This is not an accuracy test; 10 passing fixture validations must not be reported as agent accuracy of 10/10.**

These cases are public, and the current agent policy was summarized from the same cases. This is a development set and does not demonstrate generalization to the unseen Reality Test.
