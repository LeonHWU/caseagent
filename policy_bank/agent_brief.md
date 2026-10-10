AGENT BRIEF: analysing ONE case from the Dwelly Real-World Agents Hackathon, Property Management track (synthetic UK lettings agency "Northbridge Lettings").
Goal: reverse-engineer the agency's operating rules from how the case was handled, so an autonomous agent can later be judged on correct outcomes, coverage, and judgement/safety (escalating or doing nothing can be the correct decision). No official policy exists and the organisers cannot be asked. Every rule must be traceable to evidence.

FILES are READ-ONLY (never modify, write nothing). Case dir: "$HOME/mnt/dwelly hackathon/Property Management/<case>/". Use mcp__remote-devices__device_bash (load via ToolSearch "select:mcp__remote-devices__device_bash" if needed). Read index.md, the FULL history.md (cat in chunks, skip no event) and every attachments/ file (pdftotext -layout <file> -).
EVIDENCE: history.md + attachments are PRIMARY; index.md is a machine-written secondary summary. Data is deliberately noisy (scrambled dates, wrong addresses in bodies, machine-summarised or empty inbound emails, missing attachments, duplicates, unstable names). Use event order and numbers, never dates. Log noise, never silently fix it.

EXISTING BANK (check the case against it):
P-001 [HIGH CONFLICT] Obtain landlord approval before the provider-selection stage and before instructing a contractor to attend.
P-002 [HIGH CONFLICT] Send the contractor's quote to the landlord and obtain explicit approval before telling the contractor to proceed.
P-003 [HIGH] Tell contractors they must not proceed with works until the agency has approved the quote.
P-004 [HIGH] Put the case on hold with a reason naming who the agency is waiting on, plus a comment, after each outbound request.
P-005 [HIGH] When a provider replies, a human checks whether a response is needed; if not, return the request to auto mode.
P-006 [HIGH] Wait for a landlord or tenant response before provider selection; if none arrives after 3 days, the system flags the case for manual review.
P-007 [HIGH] A request on a property with no tenant is auto-paused by the system and must be reviewed and progressed manually.
P-008 [HIGH CONFLICT] Send an SMS prompt to check email alongside every email to a contractor.
P-009 [HIGH] Give the contractor the checkout inspection report to scope a checkout clean or clearance quote.
P-010 [HIGH CONFLICT] Close a request through a fixed sequence: move to Result, mark completed, run final checks, then close.
P-011 [HIGH] On completion, log 'Need confirmation from landlord'; if the agency received an invoice, forward it to the landlord for payment.
P-012 [HIGH] Closure does not wait for the landlord's confirmation or payment to arrive.
P-013 [HIGH] Expect before-and-after photos and documents at completion; if not supplied, record a skip reason and still close.
P-014 [HIGH CONFLICT] Route the checkout clean/works invoice to the landlord for payment, not to the tenant.
P-015 [HIGH] For external/communal works the landlord may commission their own contractor; the agency liaises and waits on the landlord.
P-016 [LOW] Present optional line items in a quote to the landlord as a separate decision.
P-017 [HIGH CONFLICT] On a vacated property confirm the clean is done and keys are returned before closing.
P-018 [LOW] Sequence a dependent clean after prior works are finished, and confirm a specific day with the contractor.
P-019 [HIGH CONFLICT] Keep the reporting tenant informed of contractor instruction, visit and schedule; tell them to inform the provider of pets.
P-020 [HIGH] Intake asks about access arrangements and pets for the affected area.
P-021 [HIGH] If no work result is recorded after the visit date, the system raises a chase and staff check what is happening.
P-022 [LOW] The system auto-pauses a request that passes its visit/move-out/hold deadline.
P-023 [MEDIUM] Report system faults to the team channel and hold the request; a supervisor can complete the task.
P-024 [HIGH] Inbound landlord/tenant messages flagged by the system are reviewed and progressed manually.
P-025 [LOW] Defer works when a practical or safety blocker arises (e.g. nesting wildlife) and re-hold.
P-026 [HIGH] Contractor calls carry a recording notice.
P-027 [LOW] Checkout inspection reports place smoke/CO alarm upkeep on the tenant, except battery replacement.
P-028 [LOW] Checkout reports rate cleanliness on a scale where Poor means light cleaning and Unacceptable means professional cleaning; quotes are scoped from the cleaning items only.
P-029 [HIGH] Treat 3 or more unanswered reminders to a provider as a trigger for staff to check what is happening.
P-030 [HIGH] After landlord approval, tell the contractor the quote is approved and ask for a start/attendance date; hold and chase if none is given.
P-031 [HIGH] A short informal landlord reply (e.g. 'Pls go ahead') is accepted as quote approval.
P-032 [MEDIUM] Answer a contractor's access/key question with where the keys are.
P-033 [HIGH] When the contractor invoices the landlord directly, the agency does not forward an invoice; record that as the document-skip reason and still close.
P-034 [LOW] If the landlord asks for a comparison quote, assign a second provider, then present all quotes with prices and VAT status and ask the landlord to decide.
P-035 [LOW] Before instructing the chosen contractor, raise any unpaid earlier invoice with the landlord and check the contractor is willing to proceed.
P-036 [LOW] When forwarding a final invoice that differs from the quote, explain the difference to the landlord.
P-037 [LOW] A contractor quote may widen the scope beyond the original request; the whole quote still goes to the landlord for approval.
P-038 [MEDIUM] To get evidence from a tenant (photos), email the request, hold waiting for tenant, phone if no reply, repeat the email, then relay to the landlord if the landlord needs it.
P-039 [LOW] Items raised at inspection as the tenant's responsibility (e.g. front garden) are chased with the tenant only; accept the stated delay and recheck, with no landlord or contractor step.
P-040 [LOW] For a recurring compliance task, hold until the due period, collect the tenant's evidence, forward it to the landlord and ask when it is next needed.
P-041 [HIGH CONFLICT] Close non-maintenance tasks (tenant evidence, compliance admin) with a single 'complete' update as soon as the evidence is sent; do not wait for the landlord's reply.
P-042 [HIGH] For a tenant-reported appliance fault, send a self-help troubleshooting checklist and book an engineer only if the fault persists.
P-043 [LOW] Do not treat a tenant reply as confirmation if it cannot be tied to the open issue; log it, keep the request on hold and ask again.
P-044 [HIGH] Landlord invoices may be settled out of the rent; tell the landlord the amount.
P-045 [MEDIUM] When the landlord offers a self-help workaround for a minor fault, relay it to the tenant, tell the landlord the outcome, and close unless the tenant comes back.
P-046 [HIGH] Close a task with no cost incurred as 'completed without payment'.
P-047 [LOW] If the landlord names a specific contractor, instruct that contractor and notify the tenant and contractor.
P-048 [LOW] After a repair, tell the landlord about any recurrence risk or recommended replacement; do not order a replacement without their decision.
P-049 [LOW] For faults that may affect home security (door will not latch, lock, glass), keep the tenant informed and ask them to report any security concern; treat as routine unless evidence says otherwise.
P-050 [HIGH] If a contractor's reply is empty or unreadable, a human takes over; the agent must not invent its content, dates or amounts.
P-051 [HIGH] If the landlord has not replied by the 3-day flag, re-send the request, hold, and keep chasing by phone and email; never proceed without approval.
P-052 [LOW] If a quote rises after the landlord approved it, get approval again for the new amount; an old approval does not cover a higher price.
P-053 [LOW] If the contractor finds nothing to fix and no invoice is due, tell the landlord the outcome and close without payment.
P-054 [LOW] A newly used provider with no portal access invoices by email; record the invoice and assigned provider manually.
P-055 [LOW] For routine inspections, notify the tenant by SMS and email with the visit window and management-key access; reschedule on request by phone, rebook and cancel the old slot.
P-056 [LOW] After an inspection, email the landlord a summary with the full report and record whether issues were found; minor tenant-caused marks are left to the tenant to make good.
P-057 [LOW] If a landlord's reply to an inspection raises permission (e.g. an unapproved fixture) or key custody, hand it to a human; do not grant permission or invent where keys are.
P-058 [HIGH] Dispatch a contractor to attend and quote only 'if the job requires quotation'; a minor fix done on site needs no quote.
P-059 [MEDIUM] If the landlord names a prior installer or warranty route, contact that party first; do not accept 'out of warranty' as final or authorise paid work until the position is verified.
P-060 [HIGH CONFLICT] Before closing, tell the landlord the outcome (fixed, no work needed, recurrence risk, cost route).
P-061 [LOW CONFLICT] Unrelated issues raised on an open request (e.g. a fence, a roof leak) must not be answered or claimed fixed in it; open a separate request.
P-062 [LOW] A minor tenant-responsibility fault (e.g. a blocked internal drain) gets a tenant-responsibility notice with self-help steps and a warning that call-out and repair are billed to the tenant; no landlord or contractor is involved.
P-063 [LOW] If a tenant does not respond to a self-help request, send one chase with a stated close-down deadline plus an SMS, then close if still silent.
P-064 [LOW] If the tenant disputes the visit date, do not adjudicate; the date confirmed with the contractor stands.
P-065 [LOW] After a repair, phone the tenant to confirm the fix works before closing.
P-066 [LOW] If the tenant says damage pre-dated their tenancy, record it and continue the repair; do not assign blame.
P-067 [MEDIUM] If the tenant offers to replace a landlord-supplied appliance with their own, get the landlord's consent first; the replacement is the tenant's property and liability, and no contractor is sent.
P-068 [LOW] Do not close a request while a commitment to the landlord or tenant is still open (e.g. a promised check); record it as a follow-up or hold, and answer the landlord.
P-069 [LOW] If the contractor's earlier work was faulty and they replace it, no charge applies; record the reason and close without payment.
P-070 [LOW] A landlord's go-ahead may cover only a simple fix; if parts or complexity arise, the contractor must quote and wait for further approval.
P-071 [LOW] Before giving a tenant's contact details to a landlord's own contractor, get the tenant's consent.
P-072 [MEDIUM] If the request is unclear, ask the tenant first (which item, was it landlord-requested) before approaching the landlord.
P-073 [LOW] If the landlord restricts scope for budget reasons, do not pursue the deferred items.

RETURN COMPACT output, hard limit ~400 words total:
a) Flow: at most 6 lines with event numbers.
b) NEW rules only (max 5, skip trivia, skip anything already in the bank). One line each: statement | when | do | actor | category (responsibility, approval-authority, financial, process-timing, communication, closure-checklist, escalation-trigger, safety-security, tenancy-legal, other) | evidence: ev# + verbatim quote under 12 words | EXPLICIT/OBSERVED/INFERRED.
c) Existing rules touched: 'P-0xx SUPPORTS ev# "quote"' or 'P-0xx CONTRADICTS ev# "quote" (+ possible distinguishing condition, unresolved)'. Only where there is real evidence.
d) Judgement/safety: ambiguity, conflicting info, missing context, urgency/safety, escalation or deliberate inaction, and what was done; red flags an agent must avoid.
e) Noise traps (max 3) and gaps (max 2).
Rules: no invented thresholds; one-off figures are examples. Quotes must be verbatim with correct event numbers (they will be grep-verified).
