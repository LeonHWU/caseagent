import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
def E(case,ev,quote,t,role=None):
    d={"case":case,"event":ev,"quote":quote,"evidence_type":t,"batch":2}
    if role: d["role"]=role
    return d
# --- tag batch-1 evidence roles (idempotent)
for r in bank:
    for e in r["evidence"]:
        e.setdefault("batch",1)
def tag(pid,case,ev,role):
    for e in by[pid]["evidence"]:
        if e["case"]==case and e["event"]==ev: e["role"]=role
tag("P-002","003",9,"contradicts"); tag("P-002","003",10,"contradicts")
tag("P-014","003","attachment-01-checkout-inspection-report.pdf","contradicts"); tag("P-014","005","attachment-01-check-out-inspection-report.pdf","contradicts")
tag("P-019","001",36,"contradicts")
def add(pid,evs,note=None,flag=None):
    r=by[pid]; have={(e["case"],e["event"],e["quote"]) for e in r["evidence"]}
    for e in evs:
        if (e["case"],e["event"],e["quote"]) not in have: r["evidence"].append(e)
    if note: r["notes"]=(r["notes"]+" " if r["notes"] else "")+"[B2] "+note
    if flag: r["flag"]=flag
add("P-001",[E("006",16,"confirmed approval for the below quotation","OBSERVED"),E("007",2,"Landlord approval confirmed","EXPLICIT"),E("008",38,"Please go ahead with Eliza","OBSERVED")],
 "Approval appears to be two-stage: job/provider-selection approval (system status), then quote approval. In 006/007/008 a provider was assigned to quote before the landlord saw the quote, so P-001 covers instructing works, not obtaining a quote. 007 ev002 shows approval with no landlord message visible. Cases 009 and 010 are tenant-only tasks with no landlord approval step (distinguishing condition, not used to resolve).")
add("P-002",[E("006",15,"Pls go ahead","OBSERVED"),E("007",9,"Please let me know if he may proceed","OBSERVED"),E("007",11,"Pls go ahead","OBSERVED"),E("008",36,"Please let me know how you wish to proceed","OBSERVED")],
 "Batch 2 adds 3 more cases following the landlord-first pattern (7 supporting cases vs the single case 003 exception). Conflict kept open.")
add("P-003",[E("006",5,"you should only proceed after receiving our approval","EXPLICIT")],"Not present in 007 or 008 contractor requests.")
add("P-004",[E("006",9,"Hold for quote","OBSERVED"),E("007",6,"Waiting for Provider","OBSERVED"),E("007",10,"Waiting for Landlord","OBSERVED"),E("008",35,"Waiting for Landlord","OBSERVED"),E("009",2,"WAITING FOR TENANT","OBSERVED"),E("010",7,"await T reply","OBSERVED")],
 "Reason set also includes Tenant; many holds are free text without a structured reason (006, 008, 010).")
add("P-005",[E("006",11,"return this request to auto mode","EXPLICIT"),E("007",7,"return this request to auto mode","EXPLICIT"),E("008",8,"return this request to auto mode","EXPLICIT")])
add("P-006",[],"008: roughly 20 days of landlord chasing (ev020-038) with no visible 3-day manual-review flag, which is in tension with this rule; the flag may apply only before provider selection (008 had a provider assigned). Not resolved.")
add("P-007",[E("007",15,"NOT TENANTED","EXPLICIT"),E("008",12,"NOT TENANTED","EXPLICIT")],
 "In 007 and 008 work continued after the pause with no unpause event logged. Case 006 (tenant vacating) shows no pause.")
add("P-008",[E("007",4,"Please check your email","OBSERVED"),E("008",4,"Please check your email","OBSERVED")],"SMS appears with contractor emails only, never landlord emails (007, 008). Case 006 shows no SMS (may not be logged).")
add("P-009",[E("007",9,"check out report","OBSERVED"),E("008",3,"attachment-01-check-out-inspection-report.pdf","OBSERVED")],"Extends beyond cleaning: used for repair/refurb quotes (007, 008).")
add("P-010",[E("006",22,"final checks","EXPLICIT"),E("006",27,"All checks have been completed","EXPLICIT"),E("007",34,"final checks","EXPLICIT"),E("007",37,"All checks have been completed","EXPLICIT"),
 E("008",43,"final checks","EXPLICIT"),E("008",48,"All checks have been completed","EXPLICIT"),E("009",23,"complete done","OBSERVED","contradicts"),E("010",14,"done complete","OBSERVED","contradicts")],
 "Tenant-only/admin tasks (009, 010) close with a single 'complete' update and no Result stage or final-checks event. Distinguishing condition: not a maintenance job with a contractor. Flagged, not resolved. See P-041.",flag="CONFLICT")
add("P-011",[E("006",24,"Need confirmation from landlord","OBSERVED"),E("007",33,"Please see attached the invoice for payment","OBSERVED"),E("007",36,"Need confirmation from landlord","OBSERVED"),
 E("008",45,"Please pass this for payment","OBSERVED"),E("008",47,"Need confirmation from landlord","OBSERVED")],
 "In 006 the agency did not forward an invoice because the contractor invoices the landlord directly (see P-033), yet still logged 'Need confirmation from landlord'.")
add("P-012",[E("006",27,"All checks have been completed","INFERRED"),E("007",37,"All checks have been completed","INFERRED"),E("008",48,"All checks have been completed","INFERRED"),E("008",49,"Ok to pay.","INFERRED"),E("010",14,"done complete","INFERRED"),E("010",15,"15th September","INFERRED")],
 "In 008 and 010 the landlord's reply arrived after the case closed.")
add("P-013",[E("006",23,"Skipped uploading one or more documents","OBSERVED"),E("007",35,"Skipped uploading one or more documents","OBSERVED"),E("008",46,"No photos attached","OBSERVED")],
 "Skip reasons seen: contractor invoices landlord directly (006), no before/after photos (007), no photos attached (008). Note 007 ev031 says the contractor sent photos while ev035 says none.")
add("P-014",[E("006",23,"invoices landlord directly","OBSERVED"),E("007",33,"invoice for payment","OBSERVED"),E("008",45,"Please pass this for payment","OBSERVED"),
 E("007","attachment-01-check-out-inspection-report.pdf","deducted from the tenant","EXPLICIT","contradicts"),E("008","attachment-03-check-out-inspection-report.pdf","deducted from the tenant","EXPLICIT","contradicts")],
 "Landlord-pays handling now in 6 cases; no case shows a deposit deduction or discusses one. Template conflict still open. Possible distinguishing conditions (not used): defect not tenant-caused, property already vacated.")
add("P-017",[E("006",25,"check the key return before completing","EXPLICIT"),E("006",26,"Keys return confirmed","OBSERVED"),E("007",37,"All checks have been completed","OBSERVED","contradicts"),E("008",48,"All checks have been completed","OBSERVED","contradicts")],
 "006 gates closure on key return; 007 and 008 (vacated properties, repair jobs) closed with no key-return step visible (007 keys were held by a caretaker). Distinguishing condition may be the job type (works vs clean) or key handling; not resolved.",flag="CONFLICT")
add("P-019",[E("006",4,"please ensure you inform our provider","OBSERVED"),E("007",15,"currently not tenanted","OBSERVED","context")],
 "006 emailed the tenant (who was vacating); 007 and 008 are vacated properties with no tenant contact at all. Pattern 'tenanted/vacating = inform, vacant = no contact' is an INFERRED reading only; case 001 ev036 'no contact needed' remains the contrary observation.")
# --- new rules
def rule(id,statement,trigger,action,actor,cat,conf,ev,flag=None,notes=""):
    bank.append({"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":flag,"evidence":ev,"notes":notes,"first_batch":2})
rule("P-029","Treat 3 or more unanswered reminders to a provider as a trigger for staff to check what is happening.",
 "Contractor has not booked an appointment after repeated reminders.","System flags the case; staff check and hold for the quote.","system, agency","escalation-trigger","LOW",
 [E("006",8,"3+ reminders have been sent to provider","EXPLICIT")],notes="Single case. Staff held for the quote rather than reassigning the provider (006 ev009).")
rule("P-030","After landlord approval, tell the contractor the quote is approved and ask for a start/attendance date; hold and chase if none is given.",
 "Landlord has approved a quote.","Email (and SMS) the contractor confirming approval, ask for dates; chase if no date.","agency, contractor","communication","HIGH",
 [E("004",16,"Your quote for this clean has been approved","OBSERVED"),E("005",17,"please proceed with the quote for cleaning","OBSERVED"),E("006",16,"Can you confirm a start and completion date please?","OBSERVED"),
  E("006",17,"If not, chase","EXPLICIT"),E("007",17,"Your quote for this job has been approved","OBSERVED"),E("007",20,"Please let me know when you will be able to attend","OBSERVED")])
rule("P-031","A short informal landlord reply (e.g. 'Pls go ahead') is accepted as quote approval.",
 "Landlord replies to a quote email.","Treat the reply as approval and instruct the contractor.","landlord, agency","approval-authority","HIGH",
 [E("004",12,"Pls go ahead.","OBSERVED"),E("006",15,"Pls go ahead","OBSERVED"),E("007",11,"Pls go ahead","OBSERVED"),E("005",16,"Yes please go ahead.","OBSERVED")],
 notes="No formal approval format is required in any case. No evidence of a value limit above which more is needed.")
rule("P-032","Answer a contractor's access/key question with where the keys are.",
 "Contractor asks about keys or access.","Reply by email and SMS with key location.","agency","communication","LOW",
 [E("007",25,"The keys for the studio will be with the caretaker","OBSERVED")])
rule("P-033","When the contractor invoices the landlord directly, the agency does not forward an invoice; record that as the document-skip reason and still close.",
 "Contractor bills the landlord directly.","Log skip reason; no invoice relay; landlord pays contractor.","contractor, landlord, agency","financial","MEDIUM",
 [E("006",23,"invoices landlord directly","OBSERVED"),E("001",43,"LL pays directly","OBSERVED")])
rule("P-034","If the landlord asks for a comparison quote, assign a second provider, then present all quotes with prices and VAT status and ask the landlord to decide.",
 "Landlord asks for another quote after seeing the first.","Assign new provider, hold for the second quote, chase, email both prices, state which charge VAT, ask how to proceed.","agency, landlord, contractor","approval-authority","LOW",
 [E("008",9,"for comparison","OBSERVED"),E("008",11,"New provider has been assigned","OBSERVED"),E("008",34,"doesn't charge VAT","OBSERVED"),E("008",36,"Please let me know how you wish to proceed","OBSERVED")],
 notes="In 008 the landlord took ~20 days of chasing to decide; no rule on how long to wait or whether the agency may choose.")
rule("P-035","Before instructing the chosen contractor, raise any unpaid earlier invoice with the landlord and check the contractor is willing to proceed.",
 "Contractor is owed money by the same landlord.","Ask landlord about the earlier invoice; ask contractor if willing; hold Waiting for Provider.","agency, landlord, contractor","financial","LOW",
 [E("008",24,"has that been paid","OBSERVED"),E("008",39,"took a long time to pay","OBSERVED"),E("008",41,"proceeding with works","OBSERVED")])
rule("P-036","When forwarding a final invoice that differs from the quote, explain the difference to the landlord.",
 "Invoice total differs from quote.","State the reason in the covering email.","agency","financial","LOW",
 [E("008",45,"cheaper then the original quote","OBSERVED")],
 notes="Not consistently applied: in 007 the invoice (240 inc VAT) differed slightly from the quote (198.37 + VAT) and no variance was noted or checked. Figures are examples, not thresholds.")
rule("P-037","A contractor quote may widen the scope beyond the original request; the whole quote still goes to the landlord for approval.",
 "Quote includes extra works discovered on site.","Itemise all lines to the landlord and ask for a single go-ahead.","agency, landlord","approval-authority","LOW",
 [E("006",13,"chrome waste","OBSERVED"),E("006",13,"give the go ahead","OBSERVED")],
 notes="008 shows scope reductions (carpet kept, tap not replaced) without separate landlord sign-off visible. Who authorises scope change is a gap.")
rule("P-038","To get evidence from a tenant (photos), email the request, hold waiting for tenant, phone if no reply, repeat the email, then relay to the landlord if the landlord needs it.",
 "Evidence needed from a tenant (garden condition, meter reading).","Email request; Hold; call; resend; acknowledge receipt; forward or close.","agency, tenant","process-timing","MEDIUM",
 [E("009",1,"provide some photos to confirm this is done","EXPLICIT"),E("009",2,"WAITING FOR TENANT","OBSERVED"),E("010",6,"clear photo of your solar panel readings","OBSERVED"),E("010",9,"await photos","OBSERVED"),E("010",10,"clear photo of your solar panel readings","OBSERVED")],
 notes="No stated number of chasers or interval; dates are scrambled. Photo adequacy is never checked in the visible record.")
rule("P-039","Items raised at inspection as the tenant's responsibility (e.g. front garden) are chased with the tenant only; accept the stated delay and recheck, with no landlord or contractor step.",
 "Inspection flags tenant-maintained garden item.","Chase tenant, accept delay explanation, close when evidence arrives.","agency, tenant","responsibility","LOW",
 [E("009",1,"provide some photos to confirm this is done","OBSERVED"),E("009",22,"Thank you it has come through this time","OBSERVED")],
 notes="No deadline, sanction or escalation to landlord appears. If the tenant's email is not arriving, fall back to a call and a follow-up email (009 ev021).")
rule("P-040","For a recurring compliance task, hold until the due period, collect the tenant's evidence, forward it to the landlord and ask when it is next needed.",
 "Periodic task such as a solar meter reading.","Hold with a waiting-for-month note; request photo; forward to landlord; ask next due date.","agency, tenant, landlord","process-timing","LOW",
 [E("010",1,"Not yet relevant","OBSERVED"),E("010",4,"waiting for mid june","OBSERVED"),E("010",13,"Let us know when you next need these","OBSERVED")],
 notes="The next date the landlord gave (15 September) differs from the assumed mid-June cadence and nothing shows a follow-on task being created.")
rule("P-041","Close non-maintenance tasks (tenant evidence, compliance admin) with a single 'complete' update as soon as the evidence is sent; do not wait for the landlord's reply.",
 "Tenant evidence received and, where relevant, forwarded to landlord.","Log 'complete'; no contractor, approval or Result stage.","agency","closure-checklist","MEDIUM",
 [E("009",23,"complete done","OBSERVED"),E("010",14,"done complete","OBSERVED")],flag="CONFLICT",
 notes="Differs from the maintenance closure sequence in P-010 (Result, final checks). Distinguishing condition is job type; recorded, not resolved.")
# --- recompute confidence from distinct supporting cases
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch 2"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
