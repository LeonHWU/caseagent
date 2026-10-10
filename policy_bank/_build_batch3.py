import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
def E(case,ev,quote,t="OBSERVED",role=None):
    d={"case":case,"event":ev,"quote":quote,"evidence_type":t,"batch":3}
    if role: d["role"]=role
    return d
def add(pid,evs,note=None,flag=None,decision=None):
    r=by[pid]; have={(e["case"],e["event"],e["quote"]) for e in r["evidence"]}
    for e in evs:
        if (e["case"],e["event"],e["quote"]) not in have: r["evidence"].append(e)
    if note: r["notes"]=(r["notes"]+" " if r["notes"] else "")+"[B3] "+note
    if flag: r["flag"]=flag
    if decision: r["decision"]=decision
add("P-001",[E("011",3,"Please complete landlord approval step first","EXPLICIT"),E("014",3,"Please complete landlord approval step first","EXPLICIT"),
 E("015",3,"Please confirm if you would like us to instruct a contractor to attend","EXPLICIT"),E("013",2,"I will proceed and send an appliance engineer",role="contradicts"),E("012",8,"LL already agreed for GS to go out",role="context")],
 "013: landlord was told, not asked, for an appliance repair (no quote step). 012: a note records a prior landlord agreement, so no new request was made.",
 flag="CONFLICT",decision="Ask the landlord before dispatching a contractor. Proceed without a fresh request only if the case already records the landlord's agreement (as in 012). Case 013's tell-not-ask handling is not adopted (no threshold is evidenced).")
add("P-002",[E("011",20,"Are you happy to go ahead with this?"),E("011",22,"Please go ahead"),E("013",28,"I will pass the invoice of",role="contradicts")],
 "013: no quote step at all; the invoice was passed to the landlord to come out of the rent.")
add("P-003",[E("011",13,"only proceed after receiving our approval","EXPLICIT"),E("012",15,"only proceed after receiving our approval","EXPLICIT"),E("015",10,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("011",17,"Waiting for Provider"),E("014",7,"Waiting for Landlord")])
add("P-005",[E("011",16,"Please check if we need to provide a response","EXPLICIT"),E("012",10,"return this request to auto mode","EXPLICIT"),E("014",8,"return this request to auto mode","EXPLICIT"),E("015",6,"Please check if we need to provide a response","EXPLICIT")])
add("P-006",[E("011",6,"No landlord/tenant response after 3 days","EXPLICIT")],"In 011 the landlord replied after the flag and a provider was only assigned after approval (consistent with 001).")
add("P-008",[E("013",13,"Please check your email")],"012 and 015 show no logged SMS to the contractor (may not be logged).")
add("P-010",[E("011",27,"final checks","EXPLICIT"),E("012",26,"final checks","EXPLICIT"),E("013",30,"final checks","EXPLICIT"),E("015",18,"completed by supervisor",role="contradicts")],
 "015 closed by a supervisor with one update and no Result/final-checks events.",
 decision="Maintenance with a contractor: full sequence (Result, completed, final checks, close). Tenant-evidence/admin tasks and no-works cases: one 'complete' update (P-041). A supervisor can also close manually (P-023). Decide by job type.")
add("P-012",[E("013",34,"All checks have been completed","INFERRED")])
add("P-013",[E("011",30,"Reason provided"),E("012",27,"not needed")])
add("P-014",[E("013",28,"I will pass the invoice of")],"013: invoice 'to come from the rent' (landlord's rent), which is not a tenant-deposit deduction.")
add("P-017",[E("012",30,"Keys return confirmed"),E("013",32,"check the key return before completing","EXPLICIT")],
 "012 and 013 are occupied tenancies and also check key return, so the check is not specific to vacated properties.",
 decision="Confirm keys are back before closing whenever a visit/access took place (tenanted or vacant). Skip only when no keys were involved. Cases 007/008 (keys with a caretaker) are the outliers.")
add("P-019",[E("011",12,"please ensure you inform our provider"),E("012",14,"please ensure you inform our provider"),E("013",5,"please ensure you inform our provider"),E("015",9,"please ensure you inform our provider")])
add("P-021",[E("012",22,"No work results","EXPLICIT"),E("013",25,"No work results","EXPLICIT")])
add("P-029",[E("013",16,"3+ reminders have been sent to provider","EXPLICIT")])
add("P-031",[E("011",9,"Yes please go ahead"),E("011",22,"Please go ahead"),E("015",7,"Please get Imogen to have a look at it")])
add("P-041",[E("014",14,"COMPLETE")],"014: no works done (landlord workaround), closed with one update.")
add("P-023",[E("015",18,"completed by supervisor")])
def rule(id,statement,trigger,action,actor,cat,conf,ev,decision=None,notes=""):
    r={"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":None,"evidence":ev,"notes":notes,"first_batch":3}
    if decision: r["decision"]=decision
    bank.append(r)
rule("P-042","For a tenant-reported appliance fault, send a self-help troubleshooting checklist and book an engineer only if the fault persists.",
 "Tenant reports an appliance not working.","Email the checklist, wait for the tenant's reply, then instruct an engineer if still failing.","agency, tenant","process-timing","LOW",
 [E("012",5,"avoid the risk of being liable for an unnecessary call-out","EXPLICIT")],notes="Single case. Wording ties it to avoiding no-fault-found call-out charges.")
rule("P-043","Do not treat a tenant reply as confirmation if it cannot be tied to the open issue; log it, keep the request on hold and ask again.",
 "Tenant reply is ambiguous or stale.","Note it, re-send the request, wait.","agency","escalation-trigger","LOW",
 [E("012",4,"unable to ascertain this was re the dishwasher","EXPLICIT")])
rule("P-044","Landlord invoices may be settled out of the rent; tell the landlord the amount.",
 "Contractor invoice received on a rent-managed property.","Email landlord that the invoice will come from the rent.","agency, landlord","financial","LOW",
 [E("013",28,"to come from the rent")],notes="Only case. Not evidenced whether landlord consent is needed or any limit applies.")
rule("P-045","When the landlord offers a self-help workaround for a minor fault, relay it to the tenant, tell the landlord the outcome, and close unless the tenant comes back.",
 "Minor fault; landlord suggests trying a fix first and a contractor only if needed.","Do not instruct a contractor; relay workaround; close; reopen on recurrence.","agency, landlord, tenant","process-timing","LOW",
 [E("014",13,"I will close this down unless she comes back to us","EXPLICIT"),E("014",10,"Can they try this first","OBSERVED")],
 decision="Follow the landlord's lead on minor faults, but if the fault affects door/window/lock security, flag to a human instead of closing (see P-049).")
rule("P-046","Close a task with no cost incurred as 'completed without payment'.",
 "Case closed with no contractor work or no payment due.","Complete with the without-payment status.","agency","closure-checklist","MEDIUM",
 [E("001",44,"completed without payment"),E("014",15,"completed without payment")])
rule("P-047","If the landlord names a specific contractor, instruct that contractor and notify the tenant and contractor.",
 "Landlord's reply names who should attend.","Assign that provider, email the tenant and the contractor.","landlord, agency","approval-authority","LOW",
 [E("015",7,"Please get Imogen to have a look at it")])
rule("P-048","After a repair, tell the landlord about any recurrence risk or recommended replacement; do not order a replacement without their decision.",
 "Contractor reports an underlying condition.","Email the landlord the finding.","agency, landlord","communication","LOW",
 [E("015",16,"issue may reoccur")])
rule("P-049","For faults that may affect home security (door will not latch, lock, glass), keep the tenant informed and ask them to report any security concern; treat as routine unless evidence says otherwise.",
 "Door/lock/window fault.","Interim email to tenant while waiting on the landlord; do not close with the fault unresolved.","agency, tenant","safety-security","LOW",
 [E("015",4,"any security concerns")],
 decision="No emergency handling is evidenced. Escalate to a human the same day if a door/window/lock cannot be secured, glass is cracked, or the tenant reports a security risk; do not wait for landlord approval in that case.",
 notes="014: tenant relayed a warning that the door could shatter glass; the agency still applied the landlord's workaround and closed. 015: handled as routine.")
rule("P-050","If a contractor's reply is empty or unreadable, a human takes over; the agent must not invent its content, dates or amounts.",
 "Inbound contractor email has no usable text.","Flag for manual handling.","agency","escalation-trigger","LOW",
 [E("015",12,"Manually updated via Change Mode")],notes="Same empty-email pattern in 013 ev011/017.")
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch 3"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
m=json.load(open(f"{D}/meta.json"))
m["noise"].append("Contractor emails are sometimes empty or unreadable and system prompts can be mis-ordered; never invent missing content.")
json.dump(m,open(f"{D}/meta.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
