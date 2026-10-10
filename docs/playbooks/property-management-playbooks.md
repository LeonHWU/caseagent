# Property Management Playbook Clustering

The searchable knowledge unit is a playbook. Fifty synthetic public property-management cases produce eight scenario playbooks and four composable decision modules. Source tickets remain offline inputs, with file references and hashes for audit; they are not indexed or returned to the agent.

The twelve definitions are candidates for review. Their conditions and actions are explicit design proposals, not automatically validated business rules or an implemented execution engine.

## Clustering method

Manual semantic grouping by execution route and purpose, followed by deterministic counts; no embedding clustering, API call, or agent performance scoring.

Read all 50 index overviews and outcomes, parse all history events, and inspect selected decision evidence. Source summaries are grouping aids, not verified policies.

Each case has one dominant scenario: tenant-confirmed resolution, landlord-managed repair, agency-managed repair, checkout work, garden work, warranty/remedial work, tenant-owned replacement, or evidence/inspection task. Specialized purpose routes take precedence over generic agency coordination. Mixed routes are marked.

Primary memberships are mutually exclusive and cover all 50 cases. Decision modules overlap scenario clusters and list selected supporting cases; their counts must not be added to the primary total. Event counts are descriptive and do not measure independent successes.

Source revision: `9bcdca585955dfb930005ed742572606e68f5688`. Events: 1505. Channel counts: Call 74, Email 506, Hold 236, Note 192, SMS 54, Update 443.

## Primary scenario distribution

| ID | Playbook | Cases | Share | Source case IDs |
| --- | --- | ---: | ---: | --- |
| PB01 | Supported tenant checks and confirmed resolution | 4 | 8% | 014, 017, 027, 049 |
| PB02 | Landlord managed repair | 5 | 10% | 028, 035, 041, 045, 047 |
| PB03 | Agency arranged assessment and repair | 25 | 50% | 002, 011, 012, 013, 015, 016, 021, 022, 023, 024, 026, 029, 030, 031, 032, 033, 034, 037, 039, 042, 043, 044, 046, 048, 050 |
| PB04 | Checkout cleaning and coordinated works | 6 | 12% | 003, 004, 005, 006, 007, 008 |
| PB05 | Garden scope responsibility and completion evidence | 4 | 8% | 001, 009, 018, 019 |
| PB06 | Warranty and remedial repair | 2 | 4% | 025, 036 |
| PB07 | Tenant supplied replacement and property ownership | 2 | 4% | 038, 040 |
| PB08 | Reading requests and inspection reports | 2 | 4% | 010, 020 |



The large agency-repair group has 25 cases. Splitting it into separate dishwasher, oven, window and plumbing trees would add topic labels without sufficient repeated technical diagnostic evidence. These tasks instead compose approval, booking, identity and closure modules.

Case 016 belongs to agency assessment because a provider attended before reporting no repair was needed. Case 024 belongs to agency repair because settings advice failed. Case 047 is classified by its final landlord-contractor ownership, with a caution about the conflicting agency assignment.

## Composable decision modules

| ID | Module | Selected supporting cases |
| --- | --- | --- |
| PB09 | Scope quote and approval boundaries | 002, 005, 007, 008, 011, 019, 032, 033, 043, 046 |
| PB10 | Booking access and disrupted attendance | 004, 005, 007, 020, 025, 026, 030, 031, 036, 037 |
| PB11 | Material identity and evidence conflicts | 005, 008, 009, 015, 032, 038, 045, 047, 048, 050 |
| PB12 | Completion evidence keys invoices and remaining work | 004, 005, 009, 010, 013, 015, 016, 020, 021, 022, 023, 029, 031, 040, 044 |



## Candidate playbooks

### PB01 Supported tenant checks and confirmed resolution

A routine issue has a specific, supported, non-invasive check or an explicitly permitted tenant action.



1. **A safe applicable check is evidenced and has not already been tried.** Ask the tenant to perform that check and report the result. Do not copy equipment layout or liability from a historical example. If required information is missing: Ask for the specific missing fact; use ordinary triage if no supported check exists.

2. **A response to the check is still pending.** Wait for the tenant; do not claim success. If required information is missing: Obtain a result before moving to resolution.

3. **The tenant says the check failed or the problem recurred.** Move to approved professional assessment using PB03, or the currently applicable ownership route. If required information is missing: Resolve authorization before dispatch.

4. **The tenant confirms the specific problem is resolved and no material risk remains.** Apply PB12 before closing; record any recurrence or monitoring condition. If required information is missing: Request the outstanding completion evidence.



Applicable tool names: add_note, close_case, hold, request_landlord_approval, send_message.



Representative examples:

- Property Management/017, event-008, event-009, event-011: The landlord identified the extractor switch; the tenant then confirmed the fan worked.

- Property Management/012, event-005, event-006, event-024: Dishwasher checks preceded engineer attendance; the check did not establish resolution.



Limits: Four primary cases report tenant resolution; three additional cases support the failed-check branch. A historical instruction is not a universal repair method.



### PB02 Landlord managed repair

The landlord explicitly takes responsibility for arranging the repair or uses their own contractor.



1. **The current landlord explicitly elects to manage the work.** Record the owner and ask for the plan or completion update; do not open a competing instruction. If required information is missing: Clarify who is responsible.

2. **The landlord-managed work is pending.** Wait or request a progress update according to the configured chase policy. If required information is missing: Do not infer a visit date or chase interval from repeated historic holds.

3. **The first attempt failed or another contractor becomes involved.** Clarify the active owner and remaining scope before switching the route. If required information is missing: Resolve any conflicting assignments.

4. **A credible current report confirms the in-scope work is complete.** Apply PB12; keep unrelated unfinished work separate. If required information is missing: Request completion confirmation for this issue.



Applicable tool names: add_note, close_case, escalate, hold, send_message.



Representative examples:

- Property Management/028, event-007, event-012, event-013: The landlord chose to repair the loose outdoor pipe and later confirmed completion.

- Property Management/041, event-001, event-012, event-023, event-024: The landlord arranged further washing-machine repair after an unsuccessful attempt; a towel-rail issue remained separate.



Limits: Case 047 includes an agency assignment as well as landlord-contractor completion. It supports conflict handling, not copying duplicate dispatches.



### PB03 Agency arranged assessment and repair

A repair or professional assessment is needed and the agency is the active coordinator.



1. **The property, affected item, risk and responsibility are sufficiently clear.** Assess current permission and scope; use PB09 or PB11 where they are unclear. If required information is missing: Resolve the fact that changes dispatch or authorization.

2. **The needed visit or expenditure is not currently authorized.** Request approval for the actual proposed scope and any evidenced cost. If required information is missing: Do not use approval from a source case.

3. **Current authorization covers the proposed attendance and scope.** Assign the appropriate trade and give only verified current instructions. If required information is missing: Clarify the authorization boundary.

4. **A provider is instructed but attendance is pending.** Apply PB10 for booking, access, changes and missed visits. If required information is missing: Obtain the unresolved booking or access information.

5. **Assessment changes the work, risk or cost beyond authorization.** Apply PB09 before authorizing the changed work. If required information is missing: Obtain the missing quote or scope.

6. **The provider reports repair, no repair needed, or incomplete work.** Verify the applicable result; apply PB11 and PB12 before closure. If required information is missing: Do not equate a status update with verified completion.



Applicable tool names: add_note, assign_contractor, close_case, escalate, hold, request_landlord_approval, send_message.



Representative examples:

- Property Management/032, event-003, event-006, event-008, event-012, event-018, event-024, event-025: The landlord approved contractor attendance for a flush mechanism, then approved a specific replacement quote.

- Property Management/016, event-022: After attendance, the provider reported that the door had settled and no repair or invoice was required.



Limits: Twenty-five primary cases share agency coordination, not a shared physical diagnosis. Technical repairs remain provider work. Source cases 048 and 050 contain material identity conflicts.



### PB04 Checkout cleaning and coordinated works

A checkout request needs a scoped estimate, cleaning, or multiple coordinated works.



1. **The checkout request or report defines the proposed work.** Obtain the available report and distinguish requested, quoted and approved items. If required information is missing: Request the missing scope or report instead of inventing its contents.

2. **A quote is available but the selected scope is not authorized.** Request approval, including any requested comparison quote, through PB09. If required information is missing: Clarify price, selected quote or included work.

3. **Cleaning or other work depends on another task finishing.** Verify the predecessor is complete and agree a consistent schedule before instruction. If required information is missing: Resolve inconsistent dates and dependency status.

4. **Approved work can proceed.** Coordinate keys, caretaker access or the verified access arrangement using PB10. If required information is missing: Follow the configured vacant-property policy and obtain access details.

5. **Work is reported finished.** Reconcile changes against approved scope and apply PB12 for keys, invoice and confirmation. If required information is missing: Request outstanding evidence; payment is a separate fact.



Applicable tool names: add_note, assign_contractor, close_case, hold, request_landlord_approval, send_message.



Representative examples:

- Property Management/004, event-013, event-016, event-023, event-026: A checkout clean waited for other checkout works; later schedule wording was inconsistent and needs confirmation.

- Property Management/008, event-009, event-010, event-034, event-036, event-045: A comparison quote was requested; the final invoice was lower because a tap did not need replacing.



Limits: Missing photos, unclear invoices and inconsistent dates must not become automatic acceptance rules. This module does not decide tenancy liability or deposit deductions.



### PB05 Garden scope responsibility and completion evidence

A request concerns communal vegetation, tenant garden maintenance, or garden clearance.



1. **The affected area, requested work and responsible party are clear.** Separate communal work, landlord-managed work and tenant-maintenance follow-up. Route execution through PB01, PB02 or PB03 as applicable. If required information is missing: Clarify the material scope or responsibility gap.

2. **The contractor identifies additional material or disposal requirements.** Obtain and submit the revised scope and quote using PB09. If required information is missing: Resolve changed cost and included work.

3. **The responsible party is carrying out the agreed task.** Track progress or request the specifically needed completion evidence. If required information is missing: A promise to send a photo is not completion evidence.

4. **Current evidence supports completion of the agreed scope.** Apply PB12. Keep uncleared or unapproved items open. If required information is missing: Do not infer gravel, levelling or other unconfirmed work from a clearance report.



Applicable tool names: add_note, close_case, hold, request_landlord_approval, send_message.



Representative examples:

- Property Management/009, event-001, event-006, event-013, event-023: Tenant garden-maintenance follow-up requested photographs rather than automatically assigning a contractor.

- Property Management/019, event-009, event-019, event-025: Specialist disposal changed the clearance quote; the landlord later approved removal.



Limits: Four cases share garden context but have different execution owners. This playbook composes the applicable owner workflow. Referenced photos are not automatically accessible.



### PB06 Warranty and remedial repair

A recently supplied item or a previous repair may have warranty or remedial coverage.



1. **Warranty or defective recent work is credibly raised.** Ask the installer, supplier or provider to verify current coverage and the responsible route. If required information is missing: Obtain coverage and cost confirmation.

2. **Coverage reports disagree or attendance dates are inconsistent.** Seek explicit clarification before promising a free visit or a confirmed appointment. If required information is missing: Keep coverage and booking unknown until resolved.

3. **The responsible provider confirms the route and any cost.** Coordinate attendance and parts through PB10; use PB09 if a charge falls outside approval. If required information is missing: Resolve any charge or access prerequisite.

4. **The warranty or remedial provider reports completion.** Confirm the result and charge status, then apply PB12. If required information is missing: Do not treat ordered parts as completed repair.



Applicable tool names: add_note, close_case, escalate, hold, request_landlord_approval, send_message.



Representative examples:

- Property Management/025, event-020, event-025, event-042, event-050, event-062: An oven was initially said to be outside a twelve-month warranty; later the provider confirmed two-year manufacturer coverage.

- Property Management/036, event-025, event-050, event-051: A faulty previously fitted tap was replaced at no charge, as explicitly confirmed by the provider.



Limits: Two distinct coverage examples support verification, not a universal warranty period.



### PB07 Tenant supplied replacement and property ownership

The tenant offers or has installed their own replacement for a landlord-provided appliance.



1. **Replacement is proposed but responsibilities are not settled.** Clarify landlord consent, ownership on departure, old-appliance disposition, installation and any charges. If required information is missing: Ask for the missing agreement rather than transferring another tenant's arrangement.

2. **The tenant reports a replacement was already installed.** Record what happened and resolve remaining permission, safety, storage and communication issues. If required information is missing: Do not backdate approval or assume all follow-up is finished.

3. **The current agreement and relevant completion facts are confirmed.** Apply PB12, retaining unresolved appliance inspection or storage matters. If required information is missing: Resolve outstanding follow-up before final closure.



Applicable tool names: add_note, close_case, escalate, request_landlord_approval, send_message.



Representative examples:

- Property Management/038, event-005, event-009, event-010, event-011, event-012: The landlord approved tenant ownership and removal arrangements; the tenant arranged disposal through a family member.

- Property Management/040, event-008, event-009, event-010, event-011, event-013: A tenant swapped machines before the inspection arrangement was settled; the landlord later still requested an update.



Limits: Case 038 contains inconsistent property addresses; only the generic agreement structure is retained. Case 040 is a cautionary example, not evidence that unapproved replacement or early closure is acceptable.



### PB08 Reading requests and inspection reports

The task is collecting a reading, scheduling an inspection, or delivering a report rather than authorizing repair.



1. **The requested reading or evidence is missing.** Ask for the specific readable evidence and wait for delivery. If required information is missing: A promise to supply evidence does not satisfy delivery.

2. **An inspection needs scheduling or a change.** Confirm date, access and relevant pet arrangements with PB10. If required information is missing: Resolve conflicting dates or access before confirming.

3. **The report or reading is actually available.** Send the available information to the intended recipient and verify the applicable acknowledgement. If required information is missing: Do not invent readings or unseen report findings.

4. **A later message raises an additional issue.** Record and route the separate matter; do not reinterpret the completed report as addressing it. If required information is missing: Clarify separate scope where necessary.



Applicable tool names: add_note, hold, send_message.



Representative examples:

- Property Management/010, event-006, event-008, event-013, event-015: A solar reading photo was forwarded and the landlord acknowledged receipt.

- Property Management/020, event-002, event-006, event-007, event-008, event-017, event-020: An inspection was rescheduled; later dog-flap and spare-key questions were separate matters.



Limits: Source date descriptions differ across summaries and history in inspection records; no fixed calendar rule is learned.



### PB09 Scope quote and approval boundaries

Approval is missing, limited, ambiguous, or a quote changes the proposed work or expenditure.



1. **Current approval does not cover the proposed action.** Request the exact scope and known cost; identify missing quote information. If required information is missing: Do not dispatch chargeable work under unknown permission.

2. **Approval permits only simple work or imposes a condition.** Keep the instruction within that boundary; obtain a quote and further permission for parts or complexity outside it. If required information is missing: Clarify non-numeric limits instead of inventing a threshold.

3. **A changed quote, risk or scope is reported.** Obtain explicit approval for the changed proposal before proceeding. If required information is missing: Resolve inconsistent scope, prices or taxes.

4. **Several quotes or multiple work items are under discussion.** Confirm which quote and items were approved; retain the approved version. If required information is missing: An unspecified yes is insufficient when its referent changes the action.



Applicable tool names: request_landlord_approval, send_message.



Representative examples:

- Property Management/043, event-011, event-014: The landlord allowed a simple low-cost washing-machine repair but required a quote for parts or more complex work.

- Property Management/019, event-009, event-019, event-025: A disposal requirement changed the garden quote and prompted renewed landlord approval.



Limits: Ten selected supporting cases illustrate this module; this is not an exhaustive count of all approvals in the corpus.



### PB10 Booking access and disrupted attendance

A visit needs scheduling, verified access, rescheduling, parts delivery, or a missed-visit response.



1. **An approved provider needs access and an appointment.** Ask for the required contact, access, key and time arrangements using verified current details. If required information is missing: Resolve the specific access gap; do not ask for already-known facts.

2. **Recorded dates or time slots disagree.** Confirm the authoritative appointment with the relevant parties before sending a definitive confirmation. If required information is missing: Do not silently choose one historic date representation.

3. **The provider missed a confirmed appointment or awaits parts.** Obtain the revised plan and inform the tenant; wait for actual attendance or result. If required information is missing: Do not mark parts ordered or tomorrow's visit as completed.

4. **An answer or visit remains pending.** Use the configured operational reminder and escalation policy. If required information is missing: Use a real current clock and verified last-contact facts if timers are enabled.



Applicable tool names: escalate, hold, send_message.



Representative examples:

- Property Management/026, event-016, event-018, event-021, event-023: The tenant challenged the oven appointment date and the agency clarified the agreed booking.

- Property Management/030, event-037, event-039: A plumbing provider missed the confirmed date and the case awaited attendance the following day.



Limits: Ten selected supporting cases illustrate booking conditions, not the prevalence of all scheduling events. The current MCP records messages and holds but has no physical entry or independent calendar execution tool.



### PB11 Material identity and evidence conflicts

A property, person, contact, provider or evidence item disagrees across records in a way that affects the next action.



1. **Current evidence contains a material mismatch.** Identify the conflicting fields and affected decision without choosing an unsupported canonical value. If required information is missing: Request authoritative confirmation.

2. **The mismatch affects recipient, dispatch, approval or completion.** Block that action and clarify or escalate according to the current policy. If required information is missing: Do not send sensitive details or close a possibly different job.

3. **An authoritative current source resolves the mismatch.** Record the resolution and return to the relevant playbook step. If required information is missing: If no resolution arrives, preserve uncertainty and continue only unaffected work.



Applicable tool names: add_note, escalate, send_message.



Representative examples:

- Property Management/048, event-015, event-016, event-017, event-019: A bathroom-window instruction names one property while completion replies name another.

- Property Management/050, event-014, event-016, event-024, event-029, event-032: A window job has different tenant names and telephone details across messages.



Limits: Ten selected cases contain explicit identity mismatches in the reviewed evidence. This is not a complete anomaly scan. This module is a proposed corrective guard; the historical handling often did not demonstrate successful conflict resolution.



### PB12 Completion evidence keys invoices and remaining work

A task is reported complete or is being considered for closure.



1. **A result is reported.** Check identity, in-scope result and who actually confirmed it. Distinguish repaired, no work required and outstanding work. If required information is missing: Obtain the required current confirmation.

2. **Keys were issued or new keys are owed.** Verify actual return or delivery; a future promise does not satisfy it. If required information is missing: Keep keys outstanding until confirmed.

3. **A charge or invoice is relevant.** Confirm the required invoice status or an evidenced no-charge exception; keep payment separate. If required information is missing: Ask for the missing document or cost confirmation.

4. **A linked issue, promised inspection or material follow-up remains.** Separate the scope and resolve outstanding obligations before declaring the whole case finished. If required information is missing: Do not close the unresolved issue by inheriting another task's success.

5. **All checks required by current policy are evidenced for this task.** Close using the truthful disposition and current confirmation, landlord-awareness, key and invoice fields. If required information is missing: Keep the case pending or escalate if a required check cannot be established.



Applicable tool names: add_note, close_case, hold, send_message.



Representative examples:

- Property Management/021, event-020, event-028: The lock provider promised remaining keys tomorrow; a later event recorded key-return confirmation.

- Property Management/005, event-026, event-029, event-030, event-032: Checkout cleaning was reported complete with keys returned, while later invoice requests remained unanswered in the available record.



Limits: Fifteen selected supporting cases illustrate closure dimensions; not all report every check reliably. Policy defines required checks. Historical omissions are cautionary evidence, not permission to omit them.



## Retrieval and update contract

Search only active reviewed playbooks or sections of the same playbook version. Search text contains generalized triggers, branches, conditions and actions. It excludes raw histories, one-record-per-case content, historical contact details and source-case completion labels.

For a new ticket, match the relevant scenario and decision stage. Check current prerequisites and conflicts. Include only useful steps and, if needed, one selected example. Return no reference when applicability cannot be established; clarification guidance is useful only when the missing fact changes the decision.

New tickets can propose changes to an existing playbook or a genuinely distinct new workflow. Merge repeated examples into the same playbook, keep at most two representative examples, review each new branch and create a new version. Resolved tickets do not automatically become searchable knowledge.

Evidence pointers and hashes support branch review. They are audit metadata, not retrieved case content. All twelve playbooks currently remain candidate definitions and are excluded from the proposed live pool until reviewed.

## Evaluation separation

For a held-out source case, rebuild the playbooks without that case and all its counterfactual variants. Merely removing its example is insufficient if its evidence shaped a branch. Where reconstruction is unavailable, exclude the entire affected playbook version. Compare no-playbook and filtered-playbook behavior using the unified independent judge, once implemented.

Check next-action correctness, prerequisites, conflicts, pending-state restraint, closure evidence and unrelated-ticket rejection. This clustering audit is not an agent evaluation and contains no model-quality score.

## Files

`property-management-playbooks.json` contains the twelve structured candidate playbooks. `clustering-audit.json` contains all 50 primary assignments, selected module memberships, counts and source hashes without ticket bodies.
