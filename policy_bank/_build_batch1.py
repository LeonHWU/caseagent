import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "policy_bank.json")
A3="attachment-01-checkout-inspection-report.pdf"
A5="attachment-01-check-out-inspection-report.pdf"
def E(case, ev, quote, t): return {"case":case,"event":ev,"quote":quote,"evidence_type":t}
R=[]
def rule(id,statement,trigger,action,actor,cat,conf,ev,flag=None,notes=""):
    R.append({"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":flag,"evidence":ev,"notes":notes,"first_batch":1})
rule("P-001","Obtain landlord approval before the provider-selection stage and before instructing a contractor to attend.",
 "New maintenance request on a landlord-owned property.","Request landlord approval (email or call); keep the case at the approval step until the system logs approval, then proceed to provider selection.",
 "agency, landlord","approval-authority","HIGH",
 [E("001",3,"Please complete landlord approval step first","EXPLICIT"),E("001",34,"Landlord approval confirmed","EXPLICIT"),
  E("002",2,"Landlord approval confirmed. Proceed to provider selection.","EXPLICIT"),E("004",2,"Landlord approval confirmed","EXPLICIT")],
 notes="Case 003 and 005 show no visible landlord-approval event before provider assignment (003 ev002 provider assigned directly). Not treated as conflict because absence is not contradiction; see gaps. In 004 ev002 approval precedes the quote, so it is approval-in-principle of the job, not of the quote.")
rule("P-002","Send the contractor's quote to the landlord and obtain explicit approval before telling the contractor to proceed.",
 "Contractor quote or estimate received.","Email landlord with quote attached, ask whether to proceed, hold as Waiting for Landlord, then instruct contractor only after the go-ahead.",
 "agency, landlord, contractor","approval-authority","HIGH",
 [E("002",17,"advise if you approve for me to raise an order for these works","OBSERVED"),E("004",12,"Pls go ahead.","OBSERVED"),
  E("005",16,"Yes please go ahead.","OBSERVED"),E("001",22,"agrees to proceed with the garden maintenance works","OBSERVED"),
  E("003",9,"Please proceed","OBSERVED"),E("003",10,"Estimate approved","OBSERVED")],
 flag="CONFLICT",notes="Cases 002, 004, 005, 001 route the quote to the landlord first. Case 003 (ev009-010): agency approved the estimate and told contractor to proceed with no landlord approval visible; the invoice only went to the landlord afterwards (ev020). Possibly a value-based threshold or a pre-agreed arrangement, but no threshold is stated anywhere. Not resolved.")
rule("P-003","Tell contractors they must not proceed with works until the agency has approved the quote.",
 "Contractor asked to quote.","State in the quote request that works only proceed after agency approval.","agency, contractor","approval-authority","LOW",
 [E("002",8,"you should only proceed after receiving our approval","EXPLICIT")])
rule("P-004","Put the case on hold with a reason naming who the agency is waiting on, plus a comment, after each outbound request.",
 "Agency has sent a request to landlord, provider or tenant and the next step depends on the reply.","Log a Hold with reason (Waiting for Landlord / Waiting for Provider / Other) and a short comment.",
 "agency","process-timing","HIGH",
 [E("001",8,"Waiting for Landlord","OBSERVED"),E("002",18,"Waiting for Landlord","OBSERVED"),E("003",5,"Waiting for Provider","OBSERVED"),E("004",7,"Waiting for Provider","OBSERVED")],
 notes="Reason switches to Waiting for Provider once the landlord has approved (001 ev024 to ev028). Several holds in 005 have no text (comment unavailable).")
rule("P-005","When a provider replies, a human checks whether a response is needed; if not, return the request to auto mode.",
 "Inbound provider email on an open request.","System prompts staff; staff either respond or return the request to auto mode.","system, agency","process-timing","HIGH",
 [E("002",15,"return this request to auto mode","EXPLICIT"),E("003",6,"return this request to auto mode","EXPLICIT"),E("004",8,"return this request to auto mode","EXPLICIT")])
rule("P-006","Wait for a landlord or tenant response before provider selection; if none arrives after 3 days, the system flags the case for manual review.",
 "Landlord/tenant response outstanding before provider selection.","System raises a 3-day wait notice, then a manual-review notice.","system, agency","escalation-trigger","LOW",
 [E("001",5,"before provider selection","EXPLICIT"),E("001",19,"No landlord/tenant response after 3 days","EXPLICIT")],
 notes="Single case. The 3 days is stated in a system notice but in 001 the case sat in a chase loop for weeks afterwards (ev009-020).")
rule("P-007","A request on a property with no tenant is auto-paused by the system and must be reviewed and progressed manually.",
 "Property status is NOT TENANTED (e.g. checkout cleans on vacated flats).","Agency staff review the pause and continue by hand (they went on to contact the contractor).","system, agency","escalation-trigger","MEDIUM",
 [E("004",4,"NOT TENANTED","EXPLICIT"),E("005",2,"NOT TENANTED","EXPLICIT"),E("005",2,"Please solve this manually","EXPLICIT")],
 notes="How the pause is formally cleared is not shown in either case.")
rule("P-008","Send an SMS prompt to check email alongside every email to a contractor.",
 "Any outbound contractor email.","Send SMS saying to check email and not to reply, then the email carrying job details.","agency","communication","MEDIUM",
 [E("003",3,"Please check your email","OBSERVED"),E("004",5,"Please do not reply.","OBSERVED"),E("004",15,"Please do not reply.","OBSERVED")],
 notes="In 004 the SMS/email pairing recurs at 005/006, 015/016, 022/023, 025/026, 028/029, 033/034.")
rule("P-009","Give the contractor the checkout inspection report to scope a checkout clean or clearance quote.",
 "Checkout cleaning or clearance quote requested.","Attach the checkout report to the quote request (or send it when the contractor asks).","agency","communication","HIGH",
 [E("003",4,"Attachment: attachment-54-document","OBSERVED"),E("004",6,"as per the checkout report","OBSERVED"),E("005",7,"please see attached the check out report","OBSERVED")])
rule("P-010","Close a request through a fixed sequence: move to Result, mark completed, run final checks, then close.",
 "Provider reports the work complete.","Move to Result, mark completed, do final checks, system closes with 'All checks have been completed'.","agency, system","closure-checklist","HIGH",
 [E("002",36,"final checks","EXPLICIT"),E("002",40,"All checks have been completed","EXPLICIT"),E("003",19,"final checks","EXPLICIT"),E("003",22,"All checks have been completed","EXPLICIT"),
  E("004",39,"final checks","EXPLICIT"),E("004",42,"All checks have been completed","EXPLICIT"),E("005",22,"final checks","EXPLICIT"),E("005",37,"All checks have been completed","EXPLICIT")],
 notes="The checklist items themselves are never listed. Seen items: photos/documents (P-013), keys returned (P-017), landlord confirmation (P-011).")
rule("P-011","On completion, forward the contractor's invoice to the landlord and log 'Need confirmation from landlord'.",
 "Contractor confirms work done and invoice issued.","Email landlord with invoice attached; log the confirmation note; then proceed to close.","agency, landlord","financial","HIGH",
 [E("003",20,"Please see invoice from","OBSERVED"),E("003",21,"Need confirmation from landlord","OBSERVED"),E("004",37,"please find the invoice","OBSERVED"),
  E("004",41,"Need confirmation from landlord","OBSERVED"),E("005",34,"Need confirmation from landlord","OBSERVED"),E("002",39,"Need confirmation from landlord","OBSERVED")])
rule("P-012","Closure does not wait for the landlord's confirmation or payment to arrive.",
 "Invoice forwarded to landlord and checklist note logged.","Close the case once checks are complete even though no landlord reply is on record.","agency","closure-checklist","MEDIUM",
 [E("003",22,"All checks have been completed","INFERRED"),E("003",23,"Paid","INFERRED"),E("004",42,"All checks have been completed","INFERRED"),E("002",40,"All checks have been completed","INFERRED")],
 notes="INFERRED from event order only. Landlord 'Paid' (003 ev023) arrives after closure; no landlord reply between 004 ev041 and ev042.")
rule("P-013","Expect before-and-after photos and documents at completion; if not supplied, record a skip reason and still close.",
 "Completion checklist reached.","Request photos with the invoice; otherwise log 'Skipped uploading one or more documents' with a reason.","agency, contractor","closure-checklist","MEDIUM",
 [E("002",24,"before and after","EXPLICIT"),E("002",38,"Skipped uploading one or more documents","OBSERVED"),E("004",40,"Skipped uploading one or more documents","OBSERVED"),E("004",40,"No before and after photos","OBSERVED")],
 notes="Whether a skip needs approval is not shown. 002 later adds an invoice (ev048) after skipping at ev038.")
rule("P-014","Route the checkout clean/works invoice to the landlord for payment, not to the tenant.",
 "Checkout cleaning or maintenance invoice received.","Send the invoice to the landlord; the landlord pays (the agency does not pay or recharge in these cases).","agency, landlord","financial","MEDIUM",
 [E("003",20,"Please see invoice from","OBSERVED"),E("003",23,"Paid","OBSERVED"),E("004",37,"please find the invoice","OBSERVED"),E("001",43,"LL pays directly","OBSERVED"),
  E("003",A3,"potentially deducted from the deposit","EXPLICIT"),E("005",A5,"may be deducted from the tenant","EXPLICIT")],
 flag="CONFLICT",notes="Observed handling: landlord receives and pays. The inspection reports (template text) say cleaning cost may be deducted from the tenant's deposit. No case shows a deposit deduction or says when each route applies. Not resolved. 004 ev010 'The clean will be for the tenant' is ambiguous.")
rule("P-015","For external/communal works the landlord may commission their own contractor; the agency liaises and waits on the landlord.",
 "External or communal area issue (garden, hedge).","Ask the landlord how to respond; track quotes and start dates; landlord pays contractor directly.","landlord, agency, contractor","responsibility","LOW",
 [E("001",7,"awaiting quotes for various works","OBSERVED"),E("001",33,"landlord contractor","OBSERVED"),E("001",43,"LL pays directly","OBSERVED")])
rule("P-016","Present optional line items in a quote to the landlord as a separate decision.",
 "Quote contains discretionary items (e.g. carpet cleaning).","Ask the landlord whether to proceed with or without the optional items; relay the decision to the contractor.","agency, landlord","approval-authority","LOW",
 [E("005",15,"not the carpets","OBSERVED"),E("005",16,"Let them do the carpets too","OBSERVED")])
rule("P-017","On a vacated property confirm the clean is done and keys are returned before closing.",
 "Checkout clean on a vacated property.","Hold to check clean completed and keys returned; record key return before closure.","agency","closure-checklist","LOW",
 [E("005",25,"keys returned","OBSERVED"),E("005",36,"Keys return confirmed","OBSERVED")])
rule("P-018","Sequence a dependent clean after prior works are finished, and confirm a specific day with the contractor.",
 "Cleaning depends on other checkout works.","Tell landlord and contractor the clean will be actioned once works finish; later propose a day and get confirmation.","agency, contractor","process-timing","LOW",
 [E("004",13,"once the check out works are completed","OBSERVED"),E("004",29,"you will be going on Friday","OBSERVED")])
rule("P-019","Keep the reporting tenant informed of contractor instruction, visit and schedule; tell them to inform the provider of pets.",
 "Contractor instructed or visit booked for a tenanted property.","Email (and SMS) tenant with visit details; ask them to tell the provider about any pets.","agency, tenant","communication","MEDIUM",
 [E("002",7,"If you have any pets, please ensure you inform our provider.","OBSERVED"),E("001",25,"has been instructed","OBSERVED"),E("001",31,"hoping to start the gardening works","OBSERVED"),E("001",36,"no contact needed","OBSERVED")],
 flag="CONFLICT",notes="Within case 001 the agency updated tenants (ev025, ev031) but later held with 'no contact needed' for the external job (ev036). Not resolved.")
rule("P-020","Intake asks about access arrangements and pets for the affected area.",
 "New request intake.","Ask clarifying questions on access codes/alarms and pets.","system","safety-security","LOW",
 [E("001",2,"Are there any pets at the property?","OBSERVED"),E("002",7,"pets","OBSERVED")])
rule("P-021","If no work result is recorded after the visit date, the system raises a chase and staff check what is happening.",
 "Visit date passed with no result recorded.","Staff check whether a provider response is needed, else return to auto mode.","system, agency","escalation-trigger","LOW",
 [E("002",14,"No work results","EXPLICIT"),E("002",32,"No work results","EXPLICIT")])
rule("P-022","The system auto-pauses a request that passes its visit/move-out/hold deadline.",
 "Deadline exceeded.","Pause automatically; staff must intervene.","system","escalation-trigger","LOW",
 [E("002",43,"exceeded visit/move-out/hold deadline","EXPLICIT")],notes="The 2-day figure in the message is an example, not a threshold.")
rule("P-023","Report system faults to the team channel and hold the request; a supervisor can complete the task.",
 "Closed job reappears or system misbehaves.","Post to the Slack questions channel, hold 'system issues', supervisor completes.","agency, supervisor","escalation-trigger","LOW",
 [E("002",44,"Can somebody please assist","OBSERVED"),E("002",49,"completed by supervisor","OBSERVED")])
rule("P-024","Inbound landlord/tenant messages flagged by the system are reviewed and progressed manually.",
 "System flags an inbound landlord or tenant message.","Staff read and act by hand.","system, agency","escalation-trigger","LOW",
 [E("001",6,"Please review and proceed manually","EXPLICIT"),E("001",21,"Please review and proceed manually","EXPLICIT")])
rule("P-025","Defer works when a practical or safety blocker arises (e.g. nesting wildlife) and re-hold.",
 "Contractor reports a blocker.","Hold and re-schedule; keep waiting for provider confirmation.","contractor, agency","safety-security","LOW",
 [E("001",37,"Pigeon nesting in tree","OBSERVED")])
rule("P-026","Contractor calls carry a recording notice.",
 "Agency phones a contractor.","Call opens with a recording notice.","agency","communication","LOW",
 [E("001",41,"may be recorded for training and monitoring purposes","OBSERVED")])
rule("P-027","Checkout inspection reports place smoke/CO alarm upkeep on the tenant, except battery replacement.",
 "Inspection report template.","Document states tenant responsibility.","tenant","tenancy-legal","LOW",
 [E("003",A3,"other than battery replacement","EXPLICIT"),E("005",A5,"other than battery replacement","EXPLICIT"),E("004","attachment-01-checkout-inspection-report.pdf","other than battery replacement","EXPLICIT")],
 notes="Template text in three reports (so listed MEDIUM-worthy in count, but it is document boilerplate, not agency behaviour); kept LOW until exercised in a case.")
rule("P-028","Checkout reports rate cleanliness on a scale where Poor means light cleaning and Unacceptable means professional cleaning; quotes are scoped from the cleaning items only.",
 "Scoping a checkout clean from an inspection report.","Map cleanliness ratings to cleaning scope; treat condition defects (repairs) as separate.","agency","responsibility","LOW",
 [E("004","attachment-01-checkout-inspection-report.pdf","Light cleaning required","EXPLICIT"),E("005",A5,"professional cleaning required","EXPLICIT")],
 notes="Exclusion of repair defects from the clean is INFERRED from case 004 (the quote covered the three cleaning items only).")
json.dump(R,open(OUT,"w"),indent=1,ensure_ascii=False)
print(len(R),"rules")
