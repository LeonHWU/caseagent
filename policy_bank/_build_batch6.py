import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
def E(case,ev,quote,t="OBSERVED",role=None):
    d={"case":case,"event":ev,"quote":quote,"evidence_type":t,"batch":6}
    if role: d["role"]=role
    return d
def add(pid,evs,note=None,flag=None,decision=None,statement=None):
    r=by[pid]; have={(e["case"],e["event"],e["quote"]) for e in r["evidence"]}
    for e in evs:
        if (e["case"],e["event"],e["quote"]) not in have: r["evidence"].append(e)
    if note: r["notes"]=(r["notes"]+" " if r["notes"] else "")+"[B6] "+note
    if flag: r["flag"]=flag
    if decision: r["decision"]=decision
    if statement: r["statement"]=statement
add("P-001",[E("026",4,"can i send out Keystone Compliance","OBSERVED"),E("028",2,"Please complete landlord approval step first","EXPLICIT"),
 E("030",4,"I have raised a job for Riverside Works to sort.",role="contradicts"),E("029",4,"will be attending your property",role="contradicts")],
 "Tell-and-proceed (landlord informed or never contacted) now appears in 013, 022, 029, 030 against ask-first in 15+ cases. All four are routine, low-cost, no-quote-expected faults, but nothing states that as the rule.",
 decision="Default: ask the landlord and wait, unless the case already records their agreement. A defensible alternative for routine no-quote faults is to tell the landlord and proceed (013, 022, 029, 030), but we do not adopt it without evidence of a limit.")
add("P-003",[E("026",14,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("026",7,"Waiting for Landlord"),E("027",3,"Has the tenant responded?"),E("028",5,"Held awaiting response from landlord"),E("030",23,"Waiting for Tenant")])
add("P-005",[E("028",6,"Please check if we need to provide a response","EXPLICIT"),E("030",9,"Please check if we need to provide a response","EXPLICIT")])
add("P-006",[],"030: approval was logged seconds after an informational email with no wait.")
add("P-008",[E("029",6,"Please check your email")],"026, 028 and 030 show no logged SMS to the contractor.")
add("P-010",[E("029",17,"final checks","EXPLICIT")])
add("P-011",[E("026",35,"Need confirmation from landlord"),E("029",19,"Need confirmation from landlord")])
add("P-013",[E("026",34,"Skipped uploading one or more documents"),E("029",18,"Skipped uploading one or more documents")])
add("P-015",[E("028",3,"arrange your own contractor"),E("028",7,"We will sort this issue"),E("028",13,"Landlord confirmed job complete")],
 "028 extends this beyond communal works: when the landlord says they will sort a tenant-reported repair, the agency does not dispatch, holds naming the landlord, chases for an update (P-051), and closes on the landlord's written confirmation.",
 decision="If the landlord says they will arrange the repair, do not dispatch. Chase for an update and close on their written confirmation; ask the tenant to confirm the fix when it is a leak or other damage risk.")
add("P-017",[E("026",37,"Keys return confirmed"),E("029",20,"check the key return before completing the request","EXPLICIT")],
 "The key-return step appears on almost every visit-based job, vacated or not (012, 013, 021, 023, 024, 026, 029).",
 decision="Treat key return as a standard closure step on every visit-based job; skip only when no keys or access were involved. Cases 007/008 are the outliers.")
add("P-019",[E("029",4,"please ensure you inform our provider"),E("030",7,"please ensure you inform our provider")],"028: after the first email the tenant was told nothing further, even on completion.")
add("P-021",[E("030",34,"No work results","EXPLICIT"),E("030",37,"missed the confirmed date")],"030: contractor missed a confirmed visit; staff phoned both parties, held, accepted a rebook, did not reassign.")
add("P-026",[E("030",36,"recorded for training and monitoring purposes")])
add("P-029",[E("030",15,"3+ reminders have been sent to provider","EXPLICIT")],"030: staff sent a personal nudge, then phoned; no alternative provider was chosen.")
add("P-031",[E("026",9,"Yes go ahead")])
add("P-032",[E("030",22,"will someone be home")],"030: when the provider proposed a slot, staff asked the tenant about being home or collecting keys before confirming.")
add("P-033",[E("030",40,"LL pays contractor directly")])
add("P-042",[E("027",2,"plunger")],"026: the tenant had already tested the fault and an engineer was booked straight away.")
add("P-046",[E("027",17,"completed without payment"),E("028",14,"completed without payment"),E("030",41,"completed without payment")])
add("P-058",[E("029",5,"If the job requires quotation"),E("029",15,"No quote required"),E("030",8,"If the job requires quotation")])
add("P-060",[],"Most cases (021-030) close with no landlord outcome message, including 026-030. Flagged as a conflict between our decision and the common practice.",
 flag="CONFLICT")
add("P-061",[E("027",12,"contacted block management on your behalf",role="contradicts")],
 "027: a new parking query on a closed task was answered in the same record.",
 flag="CONFLICT",decision="Answer the tenant's new point, but log it as its own request; never claim it fixed under the old one.")
def rule(id,statement,trigger,action,actor,cat,conf,ev,decision=None,notes=""):
    r={"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":None,"evidence":ev,"notes":notes,"first_batch":6}
    if decision: r["decision"]=decision
    bank.append(r)
rule("P-062","A minor tenant-responsibility fault (e.g. a blocked internal drain) gets a tenant-responsibility notice with self-help steps and a warning that call-out and repair are billed to the tenant; no landlord or contractor is involved.",
 "Tenant reports a blockage or similar fault that is theirs to clear.","Email self-help steps and the cost warning; chase once; close when the tenant confirms it is fixed.","agency, tenant","responsibility","LOW",
 [E("027",2,"the full cost of the call-out and repair will be billed","EXPLICIT"),E("027",2,"plunger","OBSERVED")],
 decision="Use only for clearly tenant-side minor blockages. If the cause is unclear, or there is a flood or leak risk, ask for details and involve the landlord or escalate.",
 notes="The tenancy clause is asserted by the agency only; no tenancy terms are visible. Cause was assumed before any inspection.")
rule("P-063","If a tenant does not respond to a self-help request, send one chase with a stated close-down deadline plus an SMS, then close if still silent.",
 "Self-help request unanswered.","Chase email and SMS naming the deadline, hold, close if no reply.","agency, tenant","process-timing","LOW",
 [E("027",4,"Should we not hear back from you within the next 24hrs","EXPLICIT")],notes="The 24-hour figure is an example, not a policy.")
rule("P-064","If the tenant disputes the visit date, do not adjudicate; the date confirmed with the contractor stands.",
 "Tenant's date differs from the booked visit.","Tell the tenant to go by the contractor-confirmed date and hold waiting for the provider.","agency, tenant","communication","LOW",
 [E("026",23,"if Keystone Compliance have confirmed a date with you")])
rule("P-065","After a repair, phone the tenant to confirm the fix works before closing.",
 "Work reported complete.","Call the tenant; close on their confirmation.","agency, tenant","closure-checklist","LOW",
 [E("026",29,"working properly after the recent repair")])
rule("P-066","If the tenant says damage pre-dated their tenancy, record it and continue the repair; do not assign blame.",
 "Cause of damage asked and tenant denies it.","Log the reply, proceed.","agency, tenant","responsibility","LOW",
 [E("029",10,"at the time I was mooving in")],
 decision="Do not decide liability. Flag any deposit or liability question to a human.")
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch 6"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
