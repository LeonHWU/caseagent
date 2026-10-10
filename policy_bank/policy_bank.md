# Northbridge Lettings policy bank

77 rules from the cases processed so far. Confidence: HIGH = stated or 3+ cases, MEDIUM = 2 cases, LOW = 1 case. Evidence is `case/event`. Figures in cases are examples, not thresholds. Full evidence is in policy_bank.json.

## approval-authority

**P-001** [HIGH] CONFLICT Obtain landlord approval before the provider-selection stage and before instructing a contractor to attend.
- When: New maintenance request on a landlord-owned property. Do: Request landlord approval (email or call); keep the case at the approval step until the system logs approval, then proceed to provider selection.
- Evidence: 001/34 "Landlord approval confirmed"; 004/2 "Landlord approval confirmed"; 007/2 "Landlord approval confirmed"
- Against: 022/3 "Maintenance provider assigned"; 043/8 "Maintenance provider assigned"
- **Our decision:** Default: ask the landlord and wait, unless the case already records their agreement. A defensible alternative for routine no-quote faults is to tell the landlord and proceed (013, 022, 029, 030), but we do not adopt it without evidence of a limit.

**P-002** [HIGH] CONFLICT Send the contractor's quote to the landlord and obtain explicit approval before telling the contractor to proceed.
- When: Contractor quote or estimate received. Do: Email landlord with quote attached, ask whether to proceed, hold as Waiting for Landlord, then instruct contractor only after the go-ahead.
- Evidence: 006/15 "Pls go ahead"; 007/11 "Pls go ahead"; 004/12 "Pls go ahead."
- Against: 003/9 "Please proceed"; 013/28 "I will pass the invoice of"
- **Our decision:** Landlord approval to attend covers diagnosis and a minor on-site fix. Any quote or extra cost goes to the landlord for approval before the contractor proceeds. Case 003 is treated as an outlier.

**P-003** [HIGH] Tell contractors they must not proceed with works until the agency has approved the quote.
- When: Contractor asked to quote. Do: State in the quote request that works only proceed after agency approval.
- Evidence: 011/13 "only proceed after receiving our approval"; 012/15 "only proceed after receiving our approval"; 015/10 "only proceed after receiving our approval"

**P-016** [LOW] Present optional line items in a quote to the landlord as a separate decision.
- When: Quote contains discretionary items (e.g. carpet cleaning). Do: Ask the landlord whether to proceed with or without the optional items; relay the decision to the contractor.
- Evidence: 005/15 "not the carpets"

**P-031** [HIGH] A short informal landlord reply (e.g. 'Pls go ahead') is accepted as quote approval.
- When: Landlord replies to a quote email. Do: Treat the reply as approval and instruct the contractor.
- Evidence: 032/24 "👍"; 024/10 "yes please"; 036/6 "Yes please!"

**P-034** [LOW] If the landlord asks for a comparison quote, assign a second provider, then present all quotes with prices and VAT status and ask the landlord to decide.
- When: Landlord asks for another quote after seeing the first. Do: Assign new provider, hold for the second quote, chase, email both prices, state which charge VAT, ask how to proceed.
- Evidence: 008/9 "for comparison"

**P-037** [MEDIUM] A contractor quote may widen the scope beyond the original request; the whole quote still goes to the landlord for approval.
- When: Quote includes extra works discovered on site. Do: Itemise all lines to the landlord and ask for a single go-ahead.
- Evidence: 006/13 "chrome waste"; 046/15 "can we please do while there"

**P-047** [LOW] If the landlord names a specific contractor, instruct that contractor and notify the tenant and contractor.
- When: Landlord's reply names who should attend. Do: Assign that provider, email the tenant and the contractor.
- Evidence: 015/7 "Please get Imogen to have a look at it"

**P-052** [LOW] If a quote rises after the landlord approved it, get approval again for the new amount; an old approval does not cover a higher price.
- When: Revised quote above the approved figure. Do: Explain the reason and new figure to the landlord; hold until a fresh reply.
- Evidence: 019/19 "the quote is going to be around"

**P-058** [HIGH] Dispatch a contractor to attend and quote only 'if the job requires quotation'; a minor fix done on site needs no quote.
- When: Routine repair (lock, key, small fault) where the landlord has agreed to a contractor attending. Do: Tell the contractor to quote and wait only if a quote is needed; skip the quote step when the fix is made on site.
- Evidence: 029/15 "No quote required"; 023/10 "If the job requires quotation"; 030/8 "If the job requires quotation"
- **Our decision:** Landlord's go-ahead to attend covers a minor on-site fix; anything needing a quote or extra cost goes back to the landlord first.

**P-067** [MEDIUM] If the tenant offers to replace a landlord-supplied appliance with their own, get the landlord's consent first; the replacement is the tenant's property and liability, and no contractor is sent.
- When: Tenant proposes their own replacement instead of a repair. Do: Ask the landlord (and whether they will cover removal of the old unit); relay the answer; note ownership and liability.
- Evidence: 038/12 "under tenants liability"; 040/5 "see what they would like to do"
- **Our decision:** Get the landlord's explicit yes on both the swap and any removal-cost cover before telling the tenant.

**P-070** [LOW] A landlord's go-ahead may cover only a simple fix; if parts or complexity arise, the contractor must quote and wait for further approval.
- When: Landlord approves attendance without a price. Do: Pass the conditional scope to the contractor; any quote goes back to the landlord.
- Evidence: 043/11 "needs part or is more complex, please quote it"

**P-074** [LOW] When the landlord's reply or the contractor's findings give alternatives (e.g. handle or lock), relay the priced options with VAT to the landlord rather than choosing; a blanket 'proceed with whatever is needed' then covers either.
- When: Contractor reply is ambiguous on the fault or offers options. Do: Send options and prices to the landlord, then tell the contractor to proceed as approved; do not trust an unreadable summary as the quote.
- Evidence: 050/23 "Please go ahead with whatever needed"

## responsibility

**P-015** [HIGH] For external/communal works the landlord may commission their own contractor; the agency liaises and waits on the landlord.
- When: External or communal area issue (garden, hedge). Do: Ask the landlord how to respond; track quotes and start dates; landlord pays contractor directly.
- Evidence: 001/43 "LL pays directly"; 028/7 "We will sort this issue"; 035/11 "confirmed this is all done"
- **Our decision:** If the landlord says they will arrange the repair, do not dispatch. Chase for an update and close on their written confirmation; ask the tenant to confirm the fix when it is a leak or other damage risk.

**P-028** [LOW] Checkout reports rate cleanliness on a scale where Poor means light cleaning and Unacceptable means professional cleaning; quotes are scoped from the cleaning items only.
- When: Scoping a checkout clean from an inspection report. Do: Map cleanliness ratings to cleaning scope; treat condition defects (repairs) as separate.
- Evidence: 004/doc "Light cleaning required"; 005/doc "professional cleaning required"

**P-039** [LOW] Items raised at inspection as the tenant's responsibility (e.g. front garden) are chased with the tenant only; accept the stated delay and recheck, with no landlord or contractor step.
- When: Inspection flags tenant-maintained garden item. Do: Chase tenant, accept delay explanation, close when evidence arrives.
- Evidence: 009/22 "Thank you it has come through this time"

**P-059** [MEDIUM] If the landlord names a prior installer or warranty route, contact that party first; do not accept 'out of warranty' as final or authorise paid work until the position is verified.
- When: Landlord points to a previous fitter or the appliance may be under warranty. Do: Phone the installer, send the job, chase, relay only the verified warranty position to the landlord.
- Evidence: 025/42 "2-year manufacturer"; 041/21 "new washer fitted by them"

**P-062** [LOW] A minor tenant-responsibility fault (e.g. a blocked internal drain) gets a tenant-responsibility notice with self-help steps and a warning that call-out and repair are billed to the tenant; no landlord or contractor is involved.
- When: Tenant reports a blockage or similar fault that is theirs to clear. Do: Email self-help steps and the cost warning; chase once; close when the tenant confirms it is fixed.
- Evidence: 027/2 "the full cost of the call-out and repair will be billed"
- **Our decision:** Use only for clearly tenant-side minor blockages. If the cause is unclear, or there is a flood or leak risk, ask for details and involve the landlord or escalate.

**P-066** [LOW] If the tenant says damage pre-dated their tenancy, record it and continue the repair; do not assign blame.
- When: Cause of damage asked and tenant denies it. Do: Log the reply, proceed.
- Evidence: 029/10 "at the time I was mooving in"
- **Our decision:** Do not decide liability. Flag any deposit or liability question to a human.

## financial

**P-011** [HIGH] On completion, log 'Need confirmation from landlord'; if the agency received an invoice, forward it to the landlord for payment.
- When: Contractor confirms work done and invoice issued. Do: Email landlord with invoice attached; log the confirmation note; then proceed to close.
- Evidence: 003/20 "Please see invoice from"; 004/37 "please find the invoice"; 008/45 "Please pass this for payment"

**P-014** [HIGH] CONFLICT Route the checkout clean/works invoice to the landlord for payment, not to the tenant.
- When: Checkout cleaning or maintenance invoice received. Do: Send the invoice to the landlord; the landlord pays (the agency does not pay or recharge in these cases).
- Evidence: 003/23 "Paid"; 001/43 "LL pays directly"; 034/11 "charged a call out"
- Against: 007/doc "deducted from the tenant"; 008/doc "deducted from the tenant"
- **Our decision:** Send invoices to the landlord for payment. Never deduct from a tenant deposit autonomously; if the report shows tenant-caused damage or poor cleaning, flag to a human for the deposit decision.

**P-033** [HIGH] When the contractor invoices the landlord directly, the agency does not forward an invoice; record that as the document-skip reason and still close.
- When: Contractor bills the landlord directly. Do: Log skip reason; no invoice relay; landlord pays contractor.
- Evidence: 001/43 "LL pays directly"; 006/23 "invoices landlord directly"; 030/40 "LL pays contractor directly"

**P-035** [LOW] Before instructing the chosen contractor, raise any unpaid earlier invoice with the landlord and check the contractor is willing to proceed.
- When: Contractor is owed money by the same landlord. Do: Ask landlord about the earlier invoice; ask contractor if willing; hold Waiting for Provider.
- Evidence: 008/24 "has that been paid"

**P-036** [LOW] When forwarding a final invoice that differs from the quote, explain the difference to the landlord.
- When: Invoice total differs from quote. Do: State the reason in the covering email.
- Evidence: 008/45 "cheaper then the original quote"

**P-044** [HIGH] Landlord invoices may be settled out of the rent; tell the landlord the amount.
- When: Contractor invoice received on a rent-managed property. Do: Email landlord that the invoice will come from the rent.
- Evidence: 013/28 "to come from the rent"; 018/13 "invoiced off the rent"; 019/38 "deduct it off the rental amount"

**P-069** [LOW] If the contractor's earlier work was faulty and they replace it, no charge applies; record the reason and close without payment.
- When: Repeat visit for a defect in the contractor's own earlier work or an item under guarantee. Do: Chase for photos and confirmation; close as completed without payment once the contractor confirms.
- Evidence: 036/43 "guarantee"

**P-073** [LOW] If the landlord restricts scope for budget reasons, do not pursue the deferred items.
- When: Landlord approves part of the work only. Do: Instruct or track only the approved part; note the deferred item.
- Evidence: 045/11 "budget for the windows for now"

## process-timing

**P-004** [HIGH] Put the case on hold with a reason naming who the agency is waiting on, plus a comment, after each outbound request.
- When: Agency has sent a request to landlord, provider or tenant and the next step depends on the reply. Do: Log a Hold with reason (Waiting for Landlord / Waiting for Provider / Other) and a short comment.
- Evidence: 010/7 "await T reply"; 006/9 "Hold for quote"; 009/2 "WAITING FOR TENANT"

**P-005** [HIGH] When a provider replies, a human checks whether a response is needed; if not, return the request to auto mode.
- When: Inbound provider email on an open request. Do: System prompts staff; staff either respond or return the request to auto mode.
- Evidence: 002/15 "return this request to auto mode"; 003/6 "return this request to auto mode"; 004/8 "return this request to auto mode"

**P-018** [LOW] Sequence a dependent clean after prior works are finished, and confirm a specific day with the contractor.
- When: Cleaning depends on other checkout works. Do: Tell landlord and contractor the clean will be actioned once works finish; later propose a day and get confirmation.
- Evidence: 004/29 "you will be going on Friday"

**P-038** [MEDIUM] To get evidence from a tenant (photos), email the request, hold waiting for tenant, phone if no reply, repeat the email, then relay to the landlord if the landlord needs it.
- When: Evidence needed from a tenant (garden condition, meter reading). Do: Email request; Hold; call; resend; acknowledge receipt; forward or close.
- Evidence: 009/1 "provide some photos to confirm this is done"; 010/9 "await photos"

**P-040** [LOW] For a recurring compliance task, hold until the due period, collect the tenant's evidence, forward it to the landlord and ask when it is next needed.
- When: Periodic task such as a solar meter reading. Do: Hold with a waiting-for-month note; request photo; forward to landlord; ask next due date.
- Evidence: 010/1 "Not yet relevant"

**P-042** [HIGH] For a tenant-reported appliance fault, send a self-help troubleshooting checklist and book an engineer only if the fault persists.
- When: Tenant reports an appliance not working. Do: Email the checklist, wait for the tenant's reply, then instruct an engineer if still failing.
- Evidence: 012/5 "avoid the risk of being liable for an unnecessary call-out"; 027/2 "plunger"; 024/3 "manual explaining the settings"

**P-045** [HIGH] When the landlord offers a self-help workaround for a minor fault, relay it to the tenant, tell the landlord the outcome, and close unless the tenant comes back.
- When: Minor fault; landlord suggests trying a fix first and a contractor only if needed. Do: Do not instruct a contractor; relay workaround; close; reopen on recurrence.
- Evidence: 014/13 "I will close this down unless she comes back to us"; 017/12 "we will close this job down now"; 049/7 "approves the tenant to fix the door"
- **Our decision:** Follow the landlord's lead on minor faults, but if the fault affects door/window/lock security, flag to a human instead of closing (see P-049).

**P-051** [HIGH] If the landlord has not replied by the 3-day flag, re-send the request, hold, and keep chasing by phone and email; never proceed without approval.
- When: Landlord silent after the first request. Do: Re-email (trim to the fault), call, remind; hold Waiting for Landlord.
- Evidence: 041/5 "If not, chase via phone"; 019/12 "unable to leave a voicemail"; 016/6 "Please advise if you would like us to send one of our contractors"
- **Our decision:** After repeated unanswered chasers, escalate to a human with a case summary; never decide spend or scope for the landlord (case 019 chased for about two months).

**P-054** [LOW] A newly used provider with no portal access invoices by email; record the invoice and assigned provider manually.
- When: Provider not set up on the portal. Do: Note it, set provider via manual mode change, forward invoice.
- Evidence: 019/33 "no access to the portal"

**P-061** [LOW] CONFLICT Unrelated issues raised on an open request (e.g. a fence, a roof leak) must not be answered or claimed fixed in it; open a separate request.
- When: Tenant raises another problem on an open or closed case. Do: Log it as its own request; closing message covers only what this request fixed.
- Evidence: 024/15 "fence"
- Against: 027/12 "contacted block management on your behalf"
- **Our decision:** Answer the tenant's new point, but log it as its own request; never claim it fixed under the old one.

**P-063** [LOW] If a tenant does not respond to a self-help request, send one chase with a stated close-down deadline plus an SMS, then close if still silent.
- When: Self-help request unanswered. Do: Chase email and SMS naming the deadline, hold, close if no reply.
- Evidence: 027/4 "Should we not hear back from you within the next 24hrs"

**P-075** [LOW] Ask the contractor to send the invoice as a PDF.
- When: Visit date has passed and the invoice is outstanding. Do: Ask whether the job was done and request a PDF invoice.
- Evidence: 046/38 "send it in PDF"

**P-077** [LOW] For a minor fault the tenant offers to fix, ask the landlord whether the tenant may self-fix or a contractor is wanted; relay it, chase once for confirmation, and close without payment if fixed or no reply.
- When: Tenant reports a minor fault and is willing to fix it. Do: No contractor until the tenant says they cannot; one chase stating the job will close without a reply.
- Evidence: 049/4 "Are you happy for them to do this"

## communication

**P-008** [HIGH] CONFLICT Send an SMS prompt to check email alongside every email to a contractor.
- When: Any outbound contractor email. Do: Send SMS saying to check email and not to reply, then the email carrying job details.
- Evidence: 004/5 "Please do not reply."; 003/3 "Please check your email"; 007/4 "Please check your email"
- **Our decision:** Send the SMS prompt with contractor emails anyway; it is cheap and harmless, and the logs may simply omit it.

**P-009** [HIGH] Give the contractor the checkout inspection report to scope a checkout clean or clearance quote.
- When: Checkout cleaning or clearance quote requested. Do: Attach the checkout report to the quote request (or send it when the contractor asks).
- Evidence: 007/9 "check out report"; 004/6 "as per the checkout report"; 003/4 "Attachment: attachment-54-document"

**P-019** [HIGH] CONFLICT Keep the reporting tenant informed of contractor instruction, visit and schedule; tell them to inform the provider of pets.
- When: Contractor instructed or visit booked for a tenanted property. Do: Email (and SMS) tenant with visit details; ask them to tell the provider about any pets.
- Evidence: 001/25 "has been instructed"; 025/12 "inform our provider"; 039/11 "inform our provider"
- Against: 001/36 "no contact needed"
- **Our decision:** Contact the tenant when the property is tenanted or vacating and access/pets matter. No tenant contact for vacant properties or external/communal works that need no access.

**P-026** [HIGH] Contractor calls carry a recording notice.
- When: Agency phones a contractor. Do: Call opens with a recording notice.
- Evidence: 025/33 "may be recorded"; 030/36 "recorded for training and monitoring purposes"; 001/41 "may be recorded for training and monitoring purposes"

**P-030** [HIGH] After landlord approval, tell the contractor the quote is approved and ask for a start/attendance date; hold and chase if none is given.
- When: Landlord has approved a quote. Do: Email (and SMS) the contractor confirming approval, ask for dates; chase if no date.
- Evidence: 006/17 "If not, chase"; 032/25 "please proceed with a new toilet flusher"; 007/17 "Your quote for this job has been approved"

**P-032** [MEDIUM] Answer a contractor's access/key question with where the keys are.
- When: Contractor asks about keys or access. Do: Reply by email and SMS with key location.
- Evidence: 030/22 "will someone be home"; 007/25 "The keys for the studio will be with the caretaker"

**P-048** [LOW] After a repair, tell the landlord about any recurrence risk or recommended replacement; do not order a replacement without their decision.
- When: Contractor reports an underlying condition. Do: Email the landlord the finding.
- Evidence: 015/16 "issue may reoccur"

**P-055** [LOW] For routine inspections, notify the tenant by SMS and email with the visit window and management-key access; reschedule on request by phone, rebook and cancel the old slot.
- When: Routine inspection due or tenant asks to move it. Do: Send notice; on tenant request call, agree new date, cancel old booking, confirm by email/SMS.
- Evidence: 020/7 "cancel over inspection"

**P-060** [HIGH] CONFLICT Before closing, tell the landlord the outcome (fixed, no work needed, recurrence risk, cost route).
- When: Work finished or no work needed. Do: Short email to the landlord, then close.
- Evidence: 037/23 "FYI"; 043/17 "re-fitted"; 042/25 "for a cost of"
- Against: 048/36 "the request is now closed"; 047/36 "completed without payment"
- **Our decision:** Always send the landlord a short outcome message before closing. Cases 021-025 closed without one and we treat that as a gap, not a pattern to copy.

**P-064** [LOW] If the tenant disputes the visit date, do not adjudicate; the date confirmed with the contractor stands.
- When: Tenant's date differs from the booked visit. Do: Tell the tenant to go by the contractor-confirmed date and hold waiting for the provider.
- Evidence: 026/23 "if Keystone Compliance have confirmed a date with you"

**P-072** [MEDIUM] If the request is unclear, ask the tenant first (which item, was it landlord-requested) before approaching the landlord.
- When: Tenant report lacks the detail needed to brief the landlord. Do: Email the tenant, hold Waiting for Tenant, then write to the landlord with the detail.
- Evidence: 044/5 "Which window is this please?"; 045/3 "Was this requested by your landlord?"

**P-076** [LOW] If a tenant withdraws part of a multi-issue request, tell the landlord and tenant and continue only with what remains.
- When: Tenant says one of several faults is fixed. Do: Email landlord the narrowed scope, confirm to tenant, hold. If the landlord replies about a different scope or address, restate what remains.
- Evidence: 047/6 "My mother managed to fix the toilet."

## closure-checklist

**P-010** [HIGH] CONFLICT Close a request through a fixed sequence: move to Result, mark completed, run final checks, then close.
- When: Provider reports the work complete. Do: Move to Result, mark completed, do final checks, system closes with 'All checks have been completed'.
- Evidence: 002/36 "final checks"; 003/19 "final checks"; 004/39 "final checks"
- Against: 009/23 "complete done"; 010/14 "done complete"
- **Our decision:** Maintenance with a contractor: full sequence (Result, completed, final checks, close). Tenant-evidence/admin tasks and no-works cases: one 'complete' update (P-041). A supervisor can also close manually (P-023). Decide by job type.

**P-012** [HIGH] Closure does not wait for the landlord's confirmation or payment to arrive.
- When: Invoice forwarded to landlord and checklist note logged. Do: Close the case once checks are complete even though no landlord reply is on record.
- Evidence: 003/23 "Paid"; 008/49 "Ok to pay."; 010/14 "done complete"

**P-013** [HIGH] Expect before-and-after photos and documents at completion; if not supplied, record a skip reason and still close.
- When: Completion checklist reached. Do: Request photos with the invoice; otherwise log 'Skipped uploading one or more documents' with a reason.
- Evidence: 002/24 "before and after"; 012/27 "not needed"; 033/40 "Not required"

**P-017** [HIGH] CONFLICT On a vacated property confirm the clean is done and keys are returned before closing.
- When: Checkout clean on a vacated property. Do: Hold to check clean completed and keys returned; record key return before closure.
- Evidence: 006/25 "check the key return before completing"; 013/32 "check the key return before completing"; 023/25 "check the key return before completing the request"
- Against: 007/37 "All checks have been completed"; 008/48 "All checks have been completed"
- **Our decision:** Treat key return as a standard closure step on every visit-based job; skip only when no keys or access were involved. Cases 007/008 are the outliers.

**P-041** [HIGH] CONFLICT Close non-maintenance tasks (tenant evidence, compliance admin) with a single 'complete' update as soon as the evidence is sent; do not wait for the landlord's reply.
- When: Tenant evidence received and, where relevant, forwarded to landlord. Do: Log 'complete'; no contractor, approval or Result stage.
- Evidence: 014/14 "COMPLETE"; 009/23 "complete done"; 010/14 "done complete"
- **Our decision:** Same as P-010: apply by job type.

**P-046** [HIGH] Close a task with no cost incurred as 'completed without payment'.
- When: Case closed with no contractor work or no payment due. Do: Complete with the without-payment status.
- Evidence: 001/44 "completed without payment"; 014/15 "completed without payment"; 016/26 "completed without payment"

**P-053** [LOW] If the contractor finds nothing to fix and no invoice is due, tell the landlord the outcome and close without payment.
- When: Contractor reports no work needed. Do: Thank contractor, email landlord, close as completed without payment.
- Evidence: 016/22 "no invoice is required"

**P-056** [LOW] After an inspection, email the landlord a summary with the full report and record whether issues were found; minor tenant-caused marks are left to the tenant to make good.
- When: Inspection results added. Do: Email landlord, upload the report, mark Inspection issues YES/NO.
- Evidence: 020/17 "Download the full inspection report here"

**P-065** [LOW] After a repair, phone the tenant to confirm the fix works before closing.
- When: Work reported complete. Do: Call the tenant; close on their confirmation.
- Evidence: 026/29 "working properly after the recent repair"

**P-068** [LOW] Do not close a request while a commitment to the landlord or tenant is still open (e.g. a promised check); record it as a follow-up or hold, and answer the landlord.
- When: Landlord has agreed to an action or asked for an update and the agency has promised something later. Do: Keep the case open on hold, or create the follow-up, and reply to the landlord.
- Evidence: 040/10 "check this when you're back"
- **Our decision:** Our rule. In 040 the agency promised a later check, closed with 'no further action', and the landlord had to chase.

## escalation-trigger

**P-006** [HIGH] Wait for a landlord or tenant response before provider selection; if none arrives after 3 days, the system flags the case for manual review.
- When: Landlord/tenant response outstanding before provider selection. Do: System raises a 3-day wait notice, then a manual-review notice.
- Evidence: 001/5 "before provider selection"; 011/6 "No landlord/tenant response after 3 days"; 016/5 "No landlord/tenant response after 3 days"

**P-007** [HIGH] A request on a property with no tenant is auto-paused by the system and must be reviewed and progressed manually.
- When: Property status is NOT TENANTED (e.g. checkout cleans on vacated flats). Do: Agency staff review the pause and continue by hand (they went on to contact the contractor).
- Evidence: 004/4 "NOT TENANTED"; 005/2 "NOT TENANTED"; 007/15 "NOT TENANTED"

**P-021** [HIGH] If no work result is recorded after the visit date, the system raises a chase and staff check what is happening.
- When: Visit date passed with no result recorded. Do: Staff check whether a provider response is needed, else return to auto mode.
- Evidence: 002/14 "No work results"; 012/22 "No work results"; 013/25 "No work results"

**P-022** [LOW] The system auto-pauses a request that passes its visit/move-out/hold deadline.
- When: Deadline exceeded. Do: Pause automatically; staff must intervene.
- Evidence: 002/43 "exceeded visit/move-out/hold deadline"

**P-023** [MEDIUM] Report system faults to the team channel and hold the request; a supervisor can complete the task.
- When: Closed job reappears or system misbehaves. Do: Post to the Slack questions channel, hold 'system issues', supervisor completes.
- Evidence: 002/49 "completed by supervisor"; 015/18 "completed by supervisor"

**P-024** [HIGH] Inbound landlord/tenant messages flagged by the system are reviewed and progressed manually.
- When: System flags an inbound landlord or tenant message. Do: Staff read and act by hand.
- Evidence: 001/6 "Please review and proceed manually"; 017/6 "Please review and proceed manually"; 021/5 "Please review and proceed manually"

**P-029** [HIGH] Treat 3 or more unanswered reminders to a provider as a trigger for staff to check what is happening.
- When: Contractor has not booked an appointment after repeated reminders. Do: System flags the case; staff check and hold for the quote.
- Evidence: 006/8 "3+ reminders have been sent to provider"; 013/16 "3+ reminders have been sent to provider"; 018/12 "3+ reminders have been sent to provider"

**P-043** [LOW] Do not treat a tenant reply as confirmation if it cannot be tied to the open issue; log it, keep the request on hold and ask again.
- When: Tenant reply is ambiguous or stale. Do: Note it, re-send the request, wait.
- Evidence: 012/4 "unable to ascertain this was re the dishwasher"

**P-050** [HIGH] If a contractor's reply is empty or unreadable, a human takes over; the agent must not invent its content, dates or amounts.
- When: Inbound contractor email has no usable text. Do: Flag for manual handling.
- Evidence: 016/21 "could not be extracted"; 034/9 "could not be extracted"; 046/32 "Please review manually"

**P-057** [LOW] If a landlord's reply to an inspection raises permission (e.g. an unapproved fixture) or key custody, hand it to a human; do not grant permission or invent where keys are.
- When: Landlord email after inspection raises a tenancy or key question. Do: Flag for a human with the case context.
- Evidence: 020/20 "dog flap installation that was not approved"
- **Our decision:** Escalate. No policy on permissions or key custody is evidenced.

## safety-security

**P-020** [HIGH] Intake asks about access arrangements and pets for the affected area.
- When: New request intake. Do: Ask clarifying questions on access codes/alarms and pets.
- Evidence: 002/7 "pets"; 001/2 "Are there any pets at the property?"; 038/2 "Are there any pets at the property?"

**P-025** [LOW] Defer works when a practical or safety blocker arises (e.g. nesting wildlife) and re-hold.
- When: Contractor reports a blocker. Do: Hold and re-schedule; keep waiting for provider confirmation.
- Evidence: 001/37 "Pigeon nesting in tree"

**P-049** [LOW] For faults that may affect home security (door will not latch, lock, glass), keep the tenant informed and ask them to report any security concern; treat as routine unless evidence says otherwise.
- When: Door/lock/window fault. Do: Interim email to tenant while waiting on the landlord; do not close with the fault unresolved.
- Evidence: 015/4 "any security concerns"
- **Our decision:** No emergency handling is evidenced. Escalate to a human the same day if a door/window/lock cannot be secured, glass is cracked, or the tenant reports a security risk; do not wait for landlord approval in that case.

**P-071** [LOW] CONFLICT Before giving a tenant's contact details to a landlord's own contractor, get the tenant's consent.
- When: Landlord's contractor asks for the tenant's contact details. Do: Phone the tenant, get authorisation, then pass them on.
- Evidence: 045/12 "gave authorisation to pass on her details"
- Against: 046/25 "07700 900298"
- **Our decision:** Our decision: get tenant consent (or confirm on the thread that the tenant agreed) before passing a number to a contractor; never send another person's details.

## tenancy-legal

**P-027** [LOW] Checkout inspection reports place smoke/CO alarm upkeep on the tenant, except battery replacement.
- When: Inspection report template. Do: Document states tenant responsibility.
- Evidence: 003/doc "other than battery replacement"; 005/doc "other than battery replacement"; 004/doc "other than battery replacement"

## Escalation triggers

- P-006: Wait for a landlord or tenant response before provider selection; if none arrives after 3 days, the system flags the case for manual review.
- P-007: A request on a property with no tenant is auto-paused by the system and must be reviewed and progressed manually.
- P-021: If no work result is recorded after the visit date, the system raises a chase and staff check what is happening.
- P-022: The system auto-pauses a request that passes its visit/move-out/hold deadline.
- P-023: Report system faults to the team channel and hold the request; a supervisor can complete the task.
- P-024: Inbound landlord/tenant messages flagged by the system are reviewed and progressed manually.
- P-029: Treat 3 or more unanswered reminders to a provider as a trigger for staff to check what is happening.
- P-043: Do not treat a tenant reply as confirmation if it cannot be tied to the open issue; log it, keep the request on hold and ask again.
- P-050: If a contractor's reply is empty or unreadable, a human takes over; the agent must not invent its content, dates or amounts.
- P-057: If a landlord's reply to an inspection raises permission (e.g. an unapproved fixture) or key custody, hand it to a human; do not grant permission or invent where keys are.

## Conflicts and our resolution

- P-001: Default: ask the landlord and wait, unless the case already records their agreement. A defensible alternative for routine no-quote faults is to tell the landlord and proceed (013, 022, 029, 030), but we do not adopt it without evidence of a limit.
- P-002: Landlord approval to attend covers diagnosis and a minor on-site fix. Any quote or extra cost goes to the landlord for approval before the contractor proceeds. Case 003 is treated as an outlier.
- P-008: Send the SMS prompt with contractor emails anyway; it is cheap and harmless, and the logs may simply omit it.
- P-010: Maintenance with a contractor: full sequence (Result, completed, final checks, close). Tenant-evidence/admin tasks and no-works cases: one 'complete' update (P-041). A supervisor can also close manually (P-023). Decide by job type.
- P-014: Send invoices to the landlord for payment. Never deduct from a tenant deposit autonomously; if the report shows tenant-caused damage or poor cleaning, flag to a human for the deposit decision.
- P-017: Treat key return as a standard closure step on every visit-based job; skip only when no keys or access were involved. Cases 007/008 are the outliers.
- P-019: Contact the tenant when the property is tenanted or vacating and access/pets matter. No tenant contact for vacant properties or external/communal works that need no access.
- P-041: Same as P-010: apply by job type.
- P-060: Always send the landlord a short outcome message before closing. Cases 021-025 closed without one and we treat that as a gap, not a pattern to copy.
- P-061: Answer the tenant's new point, but log it as its own request; never claim it fixed under the old one.
- P-071: Our decision: get tenant consent (or confirm on the thread that the tenant agreed) before passing a number to a contractor; never send another person's details.

## Design decisions (no organiser contact, so these are our calls)

- **How long to wait on a slow landlord, and may the agency ever decide alone?** Never decide for the landlord on spend or scope. Chase by email/phone; after repeated unanswered chasers, escalate to a human with the case summary. (Evidence: case 008 chased ~20 days with no auto-decision.)
- **Approval threshold or spend limit?** None is evidenced. Default: every quote goes to the landlord; no autonomous approval.
- **Who bears checkout cleaning cost (landlord vs tenant deposit)?** Invoice goes to the landlord; deposit deduction is a human decision (see P-014).
- **Is a quote-vs-invoice variance checked?** Compare them; if the invoice exceeds the quote, say so to the landlord and ask before payment is passed. Evidence is mixed (007 unchecked, 008 explained).
- **Who authorises a scope change after approval?** Landlord. If scope shrinks or grows, tell the landlord before closing.
- **What are the 'final checks'?** Not stated. Use: completion confirmed, invoice routed, photos/documents or skip reason logged, keys back if relevant, landlord informed.
- **How is the NOT TENANTED auto-pause cleared?** Not shown. Treat as a prompt to continue manually; never contact a tenant on a vacant property.
- **Urgency, emergencies, safety?** No emergency case seen yet. Default: anything involving gas, fire, flooding, no heating/water, security or injury is escalated to a human immediately and never held for landlord approval. (Cases 031 overflowing cistern with an earlier leak letter, 034 shower too hot, 026 oven, door locks were all handled as routine, so this is our own safety margin.)
- **How many tenant chasers, and what if evidence never comes?** Not stated. Email, then a call, then repeat; escalate to a human after repeated silence.
- **Photo adequacy and missing documents?** Not checked in any case. Ask for them; if missing, log the skip reason and still close (P-013).
- **Can the agent say a job is done or fully delivered?** Only with evidence (contractor confirmation or invoice). If the delivered scope is narrower than the request, say so. (Case 018 told the landlord it was done with no contractor reply on record; case 019 delivered clearance but not the levelling and gravel asked for.)
- **Hazards the intake did not resolve (e.g. a tree near power lines).** Unanswered intake questions about height, access or hazard are a prompt to ask again or escalate; do not treat as routine silently (case 018).
- **May the agent close while the repair is untested or the landlord has not been told?** No. Close only when the contractor has confirmed completion, and send the landlord an outcome message first (P-060). Case 025 closed with 'not been fully tested yet' on record.
- **An email body names a different property or address from the case.** Trust the case header. If the mismatch could mean the wrong property (33 and 34 closed with one), verify or flag before sending to anyone or closing.

## Data traps

- Dates are scrambled between index.md and history.md and inside attachments; use event order only.
- Names are unstable: landlord, staff and contractor names swap or collide within a case.
- Email bodies often carry the wrong property address or 'synthetic-...' placeholders; trust the case header.
- Attachments are often missing, 'unavailable', or named differently in history vs on disk.
- Duplicated emails, SMS and holds; inbound emails are machine-summarised and sometimes empty.
- Event order and system status can lag reality (e.g. approval logged after work started).
- Quote and invoice amounts, supplier names and scope often differ slightly with no explanation.
- Inspection-report text is template boilerplate (e.g. deposit wording) and is not a case-specific decision.
- Contractor emails are sometimes empty or unreadable and system prompts can be mis-ordered; never invent missing content.
