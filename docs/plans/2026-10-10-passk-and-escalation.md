# Plan: pass^k trials, structured escalation, and the approval-guard gap

Base every change on `origin/main`, in a separate worktree, on its own branch. The main checkout has uncommitted edits, and that checkout is 12 commits behind `origin/main`. Each part gets its own commit, and each part has a test. All tests use fake models; no part needs an API key.

## 0. First, commit the work that exists only as uncommitted edits

The approval guard and the `<case_data>` wrapper exist only as uncommitted edits in the main checkout. They are not on `origin/main`. Rule 12 in `policy.md` is already on `origin/main`. Commit those edits, or rebase them onto `origin/main`, before Part 3 starts. Part 3 changes the same guard.

## 1. pass^k trials in the process eval runner

File: `evals/Process Reward/run.ts`. Test: `test/process-eval-run.test.ts`.

- `runSuite` gets a `trials` option, with a default of 1. The CLI gets `--trials N`.
- Each trial is a full, independent run of the sample, in its own folder: `<out>/<sample>/trial-<k>/`. `run_case` starts each trial from fresh state, so trials cannot share state.
- A trial passes when `run_outcome` is `completed` and `structural_match` is true. A `model_failure` trial fails.
- A `runtime_failure` trial is not measured. Its sample reports `measured: false`, and that sample does not count toward pass^k. A failure of our infrastructure must not count as a failure of the model.
- The report has `pass_1`: the mean pass rate over all measured trials. It also has `pass_k`: the share of measured samples where every trial passed. The report keeps each trial's record as it is now.
- The console prints one line per sample, for example `pm-028: 3/3`.

Tests:
- A fake model that always picks the expected action, with 3 trials: `pass_1` is 1 and `pass_k` is 1.
- A fake model whose answer alternates between the expected action and a wrong action: `pass_1` is near 0.5 and `pass_k` is 0.
- A fake model that throws on one trial: that sample has `measured: false`, and the other samples still have a score.

Cost: 10 samples × 3 trials makes 30 live runs. Each run is one stage. Run this check once before the demo, not on every change.

## 2. Structured escalation

Files: `src/tools.ts`, `src/state.ts`, `src/answers.ts`. Tests: `test/tools.test.ts`, `test/answers.test.ts`.

- The `escalate` tool replaces its free-text `summary` with three required, non-empty fields:
  - `checked`: what the agent looked at, with event references.
  - `missing_or_conflict`: what is missing, unclear or in conflict.
  - `decision_needed`: the one decision the person must make.
- The escalated status keeps `summary` as text that the code builds from the three fields, so the MCP replies, `summary()` and the edge-case suite keep working. The status also stores the three fields.
- Escalations that the system makes itself (turn exhaustion, a load error, a system error) keep a plain `summary` and have no fields. Those three code paths do not change.
- The ANSWER.md "Escalation" section shows the three fields under labels when they exist, and the plain summary when they do not.
- `policy.md` rule 10 says: "Name the conflict in the summary". Change "summary" to `missing_or_conflict`.

Tests:
- `escalate` with an empty `decision_needed` returns `invalid input`, and the error names the field.
- A valid escalation stores all three fields and a built `summary`.
- ANSWER.md shows the three labels for an agent escalation, and the plain text for a system escalation.

Check: no eval sample uses `escalate` with exact arguments, so the eval set needs no change. Re-run `validate.ts` to confirm.

## 3. Close the approval-guard gap (needs your decision)

The current guard in `src/tools.ts`, `requireApproval`, accepts either of two things. One is an approval that the agency recorded in a visible event. The other is a successful `request_landlord_approval` from an earlier run. The second condition does not check that the landlord said yes. A resume can come from any outside party, so these two cases still allow `assign_contractor`:

- The tenant writes after the request, and the landlord has not answered.
- The landlord answers no. Edge case `edge_010` ("Landlord refuses works, damp spreading") tests this exact case.

Proposed fix: accept a request only when a visible event from the landlord comes after it. The policy still decides whether the landlord's answer is a yes or a no. The code makes sure that the landlord answered. Tests: the tenant replies after the request, so the guard refuses. The landlord replies after the request, so the guard allows.

## Already covered

- **Trap cases**: `evals/edge-cases` (12 cases, merged in PR #4) covers gas, a vulnerable tenant, a landlord refusal, data fishing, a duplicate ticket and an ambiguous identity. No new trap set is necessary.

## Done when

- `npm test` and `npm run typecheck` pass.
- `validate.ts data/public` passes for all 10 samples.
- One live `--trials 3` run reports pass^1 and pass^3. The numbers go in the demo notes.
