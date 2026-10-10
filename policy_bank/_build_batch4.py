import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
def E(case,ev,quote,t="OBSERVED",role=None):
    d={"case":case,"event":ev,"quote":quote,"evidence_type":t,"batch":4}
    if role: d["role"]=role
    return d
def add(pid,evs,note=None,flag=None,decision=None):
    r=by[pid]; have={(e["case"],e["event"],e["quote"]) for e in r["evidence"]}
    for e in evs:
        if (e["case"],e["event"],e["quote"]) not in have: r["evidence"].append(e)
    if note: r["notes"]=(r["notes"]+" " if r["notes"] else "")+"[B4] "+note
    if flag: r["flag"]=flag
    if decision: r["decision"]=decision
LL="Please complete landlord approval step first"
add("P-001",[E("017",2,LL,"EXPLICIT"),E("018",3,LL,"EXPLICIT"),E("019",2,LL,"EXPLICIT"),E("016",10,"Landlord approval confirmed. Proceed to provider selection.","EXPLICIT")])
add("P-003",[E("016",14,"only proceed after receiving our approval","EXPLICIT"),E("018",8,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("016",7,"Waiting for Landlord"),E("019",30,"Waiting for Tenant")],"017, 018 and 020 show no hold or reason after outbound emails (may not be exported).")
add("P-005",[E("016",8,"Please check if we need to provide a response","EXPLICIT"),E("018",14,"Please check if we need to provide a response","EXPLICIT"),E("019",24,"Please check if we need to provide a response","EXPLICIT"),E("020",5,"Please check if we need to provide a response","EXPLICIT")])
add("P-006",[E("016",5,"No landlord/tenant response after 3 days","EXPLICIT"),E("017",5,"Waiting for landlord/tenant response before provider selection (3 days)","EXPLICIT"),E("019",6,"No landlord/tenant response after 3 days","EXPLICIT")],
 "In 016 and 019 staff re-sent the request and kept chasing after the flag; in 019 the landlord stayed silent for a long period and nothing was done without approval.")
add("P-008",[],"016 shows no SMS alongside the contractor email (ev014).")
add("P-010",[E("019",39,"final checks","EXPLICIT")])
add("P-011",[E("019",43,"Need confirmation from landlord")],"018: landlord was told the job was invoiced off the rent, with no invoice forward and no confirmation note.")
add("P-012",[E("019",44,"All checks have been completed","INFERRED")])
add("P-013",[E("019",42,"not applicable")])
add("P-019",[E("016",13,"please ensure you inform our provider"),E("018",7,"please ensure you inform our provider")])
add("P-024",[E("017",6,"Please review and proceed manually","EXPLICIT")])
add("P-029",[E("018",12,"3+ reminders have been sent to provider","EXPLICIT")])
add("P-031",[E("019",25,"Please go ahead with the removal")])
add("P-042",[E("017",9,"let me know if everything is working correctly")],"017: the landlord supplied the fix (a switch by the hob) and the tenant was asked to check before any contractor.")
add("P-044",[E("018",13,"invoiced off the rent"),E("019",38,"deduct it off the rental amount")])
add("P-045",[E("017",8,"There is a switch to the righthand side of the hob"),E("017",12,"we will close this job down now")],"017: no landlord outcome message is logged before closing.")
add("P-046",[E("016",26,"completed without payment"),E("017",14,"completed without payment")])
add("P-050",[E("016",21,"could not be extracted","EXPLICIT")])
add("P-041",[],"Routine inspections (020) also close once the report is sent to the landlord, with no Result/final-checks events.")
def rule(id,statement,trigger,action,actor,cat,conf,ev,decision=None,notes=""):
    r={"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":None,"evidence":ev,"notes":notes,"first_batch":4}
    if decision: r["decision"]=decision
    bank.append(r)
rule("P-051","If the landlord has not replied by the 3-day flag, re-send the request, hold, and keep chasing by phone and email; never proceed without approval.",
 "Landlord silent after the first request.","Re-email (trim to the fault), call, remind; hold Waiting for Landlord.","agency","process-timing","MEDIUM",
 [E("016",6,"Please advise if you would like us to send one of our contractors"),E("019",22,"any thoughts on previous email"),E("019",12,"unable to leave a voicemail")],
 decision="After repeated unanswered chasers, escalate to a human with a case summary; never decide spend or scope for the landlord (case 019 chased for about two months).",
 notes="No chaser count or spacing is evidenced.")
rule("P-052","If a quote rises after the landlord approved it, get approval again for the new amount; an old approval does not cover a higher price.",
 "Revised quote above the approved figure.","Explain the reason and new figure to the landlord; hold until a fresh reply.","agency, landlord","approval-authority","LOW",
 [E("019",19,"around")],notes="Case 019: approval at the first figure, then a revised quote was sent for approval again. The figures are examples, not thresholds.")
rule("P-053","If the contractor finds nothing to fix and no invoice is due, tell the landlord the outcome and close without payment.",
 "Contractor reports no work needed.","Thank contractor, email landlord, close as completed without payment.","agency","closure-checklist","LOW",
 [E("016",22,"no invoice is required")])
rule("P-054","A newly used provider with no portal access invoices by email; record the invoice and assigned provider manually.",
 "Provider not set up on the portal.","Note it, set provider via manual mode change, forward invoice.","agency","process-timing","LOW",
 [E("019",33,"no access to the portal")])
rule("P-055","For routine inspections, notify the tenant by SMS and email with the visit window and management-key access; reschedule on request by phone, rebook and cancel the old slot.",
 "Routine inspection due or tenant asks to move it.","Send notice; on tenant request call, agree new date, cancel old booking, confirm by email/SMS.","agency, tenant","communication","LOW",
 [E("020",2,"we will access using our management key"),E("020",7,"cancel over inspection")])
rule("P-056","After an inspection, email the landlord a summary with the full report and record whether issues were found; minor tenant-caused marks are left to the tenant to make good.",
 "Inspection results added.","Email landlord, upload the report, mark Inspection issues YES/NO.","agency, landlord","closure-checklist","LOW",
 [E("020",17,"Download the full inspection report here")],
 notes="020: the email said no issues were identified while the report itself listed a tenant-fitted item and a defect. Do not copy the summary line blindly.")
rule("P-057","If a landlord's reply to an inspection raises permission (e.g. an unapproved fixture) or key custody, hand it to a human; do not grant permission or invent where keys are.",
 "Landlord email after inspection raises a tenancy or key question.","Flag for a human with the case context.","agency","escalation-trigger","LOW",
 [E("020",20,"dog flap")],
 decision="Escalate. No policy on permissions or key custody is evidenced.")
m=json.load(open(f"{D}/meta.json"))
m["design"]+= [["Can the agent say a job is done or fully delivered?","Only with evidence (contractor confirmation or invoice). If the delivered scope is narrower than the request, say so. (Case 018 told the landlord it was done with no contractor reply on record; case 019 delivered clearance but not the levelling and gravel asked for.)"],
 ["Hazards the intake did not resolve (e.g. a tree near power lines).","Unanswered intake questions about height, access or hazard are a prompt to ask again or escalate; do not treat as routine silently (case 018)."]]
json.dump(m,open(f"{D}/meta.json","w"),indent=1,ensure_ascii=False)
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch 4"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
