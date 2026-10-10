# Process Eval Results: 2026-10-10

Model: `claude-sonnet-5-5`. Agent code revision: `1ff6e853c170813d7c587e16a2b19975f0bdefab`. Started at: `2026-10-10T10:26:01.048Z`.

## Summary

- 10/10 samples completed a live single-step MCP run with exactly one successful business action each.
- 7/10 actions matched the historical reference branches and passed Codex semantic review: 4/4 each.
- Strict historical reference score: 28/40 (70%). This is not practical correctness or unseen-case accuracy.
- Three alternative actions retain a null final score and `needs_review` under the unchanged reference rubric.
- Tenant completion confirmation (013) and landlord scheduling follow-up (028) were considered reasonable alternatives. Approval before window clarification (044) is also plausible; the possible duplicate landlord contact remains uncertain.
- No listed prohibited behavior was identified in the recorded actions.

## Per-sample Results

| Sample | Case / step | Actual tool | Reference score | Practical assessment |
|---|---|---|---:|---|
| [pm-011-initial-approval](pm-011-initial-approval/state/011.json) | 011 / 3 | request_landlord_approval | 4/4 | acceptable_reference_action |
| [pm-011-approved-assignment](pm-011-approved-assignment/state/011.json) | 011 / 10 | assign_contractor | 4/4 | acceptable_reference_action |
| [pm-017-switch-troubleshooting](pm-017-switch-troubleshooting/state/017.json) | 017 / 8 | send_message | 4/4 | acceptable_reference_action |
| [pm-017-await-tenant](pm-017-await-tenant/state/017.json) | 017 / 9 | hold | 4/4 | acceptable_reference_action |
| [pm-013-report-completion](pm-013-report-completion/state/013.json) | 013 / 27 | send_message | 0/4 | reasonable_alternative |
| [pm-028-landlord-own-repair](pm-028-landlord-own-repair/state/028.json) | 028 / 7 | send_message | 0/4 | reasonable_alternative |
| [pm-032-conditional-assignment](pm-032-conditional-assignment/state/032.json) | 032 / 8 | assign_contractor | 4/4 | acceptable_reference_action |
| [pm-035-landlord-resolved-close](pm-035-landlord-resolved-close/state/035.json) | 035 / 12 | close_case | 4/4 | acceptable_reference_action |
| [pm-044-clarify-window](pm-044-clarify-window/state/044.json) | 044 / 4 | request_landlord_approval | 0/4 | plausible_alternative_with_contact_uncertainty |
| [pm-049-conditional-self-fix](pm-049-conditional-self-fix/state/049.json) | 049 / 7 | send_message | 4/4 | acceptable_reference_action |

## Alternatives and Evidence

### pm-013-report-completion

The historical next action notifies the landlord. The agent first asks the tenant to confirm the dishwasher operates correctly, citing 027 and the policy requirement for final confirmation. No premature closure or invented amount. A reasonable alternative sequence.

### pm-028-landlord-own-repair

The historical next action holds for the landlord. The agent first acknowledges landlord ownership and asks for attendance/completion details. No duplicate assignment or premature closure. A reasonable preliminary communication.

### pm-044-clarify-window

The historical next action asks the tenant which window is affected. The agent requests landlord approval for an inspection instead. Location clarification is useful but not necessarily a prerequisite for approval. This is a plausible alternative, not a confirmed error. Event 004 suggests landlord contact is already pending, so the new request may duplicate contact; the available history is insufficient to confirm duplication.

## Files

- `results.json`: actual actions, reference rules, individual review notes, scores, usage, and export metadata.
- `artifacts.json`: SHA-256 hashes for the 40 unchanged raw artifacts.
- `<sample>/state/<case>.json`: recorded case state and executed action.
- `<sample>/traces/<case>.jsonl`: original model responses, usage, and tool execution.
- `<sample>/ANSWERS/<case>/ANSWER.md` and `REASONING.md`: original generated outputs.

## Scope and Reproducibility

These are the successful retry results, not the earlier API credit failures. The run occurred before the labels were translated to English. Original model outputs were already English and are preserved byte-for-byte; reference-rule prose and review notes are exported in English. There was no new model run for this export.

Only fixtures were supplied to the evaluated agent. Labels were used by the harness/reviewer, not included in agent inputs. These are public development cases, and the policy was derived from the same source data. Semantic review was performed by Codex, without an independent automated judge. Do not report 90% or 100% as an established practical accuracy.

Credentials, environment files, and API authentication data are not included.

API-reported usage: {"input_tokens": 40457, "output_tokens": 6939}.
