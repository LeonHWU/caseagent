import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
def E(case,ev,quote,t="OBSERVED",role=None):
    d={"case":case,"event":ev,"quote":quote,"evidence_type":t,"batch":5}
    if role: d["role"]=role
    return d
def add(pid,evs,note=None,flag=None,decision=None,statement=None,action=None):
    r=by[pid]; have={(e["case"],e["event"],e["quote"]) for e in r["evidence"]}
    for e in evs:
        if (e["case"],e["event"],e["quote"]) not in have: r["evidence"].append(e)
    if note: r["notes"]=(r["notes"]+" " if r["notes"] else "")+"[B5] "+note
    if flag: r["flag"]=flag
    if decision: r["decision"]=decision
    if statement: r["statement"]=statement
    if action: r["action"]=action
LL="Please complete landlord approval step first"
add("P-001",[E("021",2,LL,"EXPLICIT"),E("025",9,"Landlord approval confirmed. Proceed to provider selection.","EXPLICIT"),E("022",3,"Maintenance provider assigned",role="contradicts")],
 "022: provider assigned and sent to attend with no landlord contact anywhere in the case (a routine lock fault). Landlord approval was asked first in 021, 023, 024, 025.")
add("P-002",[E("022",16,"he will drop new key off and send invoice",role="contradicts")],
 "021, 022, 023, 024 had no quote step: the contractor attended and fixed on site, with a quote only 'if the job requires quotation' (see P-058).",
 decision="Landlord approval to attend covers diagnosis and a minor on-site fix. Any quote or extra cost goes to the landlord for approval before the contractor proceeds. Case 003 is treated as an outlier.")
add("P-003",[E("021",12,"only proceed after receiving our approval","EXPLICIT"),E("024",13,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("024",4,"Awaiting TT response"),E("024",9,"Awaiting landlord response"),E("025",4,"Held awaiting response from landlord")],"022 and 023 show holds only late in the case.")
add("P-005",[E("021",14,"Please check if we need to provide a response","EXPLICIT"),E("022",17,"Please check if we need to provide a response","EXPLICIT"),E("023",13,"Please check if we need to provide a response","EXPLICIT"),E("024",5,"Please check if we need to provide a response","EXPLICIT"),E("025",41,"return this request to auto mode","EXPLICIT")])
add("P-006",[E("021",4,"Waiting for landlord/tenant response before provider selection (3 days)","EXPLICIT")],"021 and 023: the landlord replied well inside the 3 days, so no flag was needed.")
add("P-008",[E("023",11,"Please check your email")],"Not universal: 022, 024 and 025 show no logged SMS with contractor emails or used phone calls.")
add("P-010",[E("022",15,"final checks","EXPLICIT"),E("023",22,"final checks","EXPLICIT"),E("024",19,"final checks","EXPLICIT")])
add("P-011",[E("021",26,"Need confirmation from landlord"),E("022",22,"Need confirmation from landlord"),E("023",24,"Need confirmation from landlord"),E("024",21,"Need confirmation from landlord")],
 "The 'Need confirmation from landlord' note is logged at closure even when the agency holds no invoice (021-024), so it is a closure step, not tied to an invoice forward.",
 statement="On completion, log 'Need confirmation from landlord'; if the agency received an invoice, forward it to the landlord for payment.")
add("P-012",[E("022",23,"All checks have been completed","INFERRED")])
add("P-013",[E("021",25,"No quote required, repaired on site"),E("022",21,"Reason provided"),E("023",23,"No further documents to add"),E("024",20,"Skipped uploading one or more documents")])
add("P-017",[E("021",28,"Keys return confirmed"),E("023",25,"check the key return before completing the request","EXPLICIT"),E("024",22,"check the key return before completing the request","EXPLICIT"),E("022",20,"added to keys and copied")],
 "Also required on occupied tenancies and lock/key repairs. 021: confirmation was logged within hours of a promised next-day key drop with no receipt evidence; do not confirm without evidence.")
add("P-019",[E("021",11,"please ensure you inform our provider"),E("024",12,"please ensure you inform our provider"),E("025",12,"inform our provider")])
add("P-021",[E("022",12,"No work results","EXPLICIT"),E("025",30,"No work results","EXPLICIT")])
add("P-024",[E("021",5,"Please review and proceed manually","EXPLICIT")])
add("P-026",[E("025",33,"may be recorded")])
add("P-031",[E("021",6,"approves the maintenance action regarding the broken key"),E("023",6,"sounds like it needs sorting"),E("024",10,"yes please")])
add("P-042",[E("024",3,"manual explaining the settings")],"024: manual and dial settings sent first; engineer only after the tenant said it persisted. 025 sent an engineer straight away (prior-fitter warranty route).")
add("P-046",[E("025",64,"completed without payment")],"024 used the same label although an invoice was received, so the label does not prove nothing was spent; 025 was a free warranty repair.")
add("P-049",[],"021, 022, 023: stiff or broken door locks and a snapped key were all handled as routine with no urgency or security advice. Our escalate-same-day default for unsecurable doors still stands.")
def rule(id,statement,trigger,action,actor,cat,conf,ev,decision=None,notes=""):
    r={"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":None,"evidence":ev,"notes":notes,"first_batch":5}
    if decision: r["decision"]=decision
    bank.append(r)
rule("P-058","Dispatch a contractor to attend and quote only 'if the job requires quotation'; a minor fix done on site needs no quote.",
 "Routine repair (lock, key, small fault) where the landlord has agreed to a contractor attending.","Tell the contractor to quote and wait only if a quote is needed; skip the quote step when the fix is made on site.","agency, contractor","approval-authority","MEDIUM",
 [E("021",25,"No quote required, repaired on site"),E("023",10,"If the job requires quotation")],
 decision="Landlord's go-ahead to attend covers a minor on-site fix; anything needing a quote or extra cost goes back to the landlord first.",
 notes="Cost of such on-site fixes was never discussed in 021-024.")
rule("P-059","If the landlord names a prior installer or warranty route, contact that party first; do not accept 'out of warranty' as final or authorise paid work until the position is verified.",
 "Landlord points to a previous fitter or the appliance may be under warranty.","Phone the installer, send the job, chase, relay only the verified warranty position to the landlord.","agency, landlord, contractor","responsibility","LOW",
 [E("025",42,"2-year manufacturer"),E("025",20,"no longer under warranty")],
 notes="025: the first 'out of warranty' answer was later contradicted; the tenant went about a month without an oven. Correct the landlord if an earlier update proves wrong.")
rule("P-060","Before closing, tell the landlord the outcome (fixed, no work needed, recurrence risk, cost route).",
 "Work finished or no work needed.","Short email to the landlord, then close.","agency, landlord","communication","HIGH",
 [E("014",13,"I just wanted to let you know"),E("015",16,"issue may reoccur"),E("016",22,"no invoice is required"),E("018",13,"invoiced off the rent")],
 decision="Always send the landlord a short outcome message before closing. Cases 021-025 closed without one and we treat that as a gap, not a pattern to copy.")
rule("P-061","Unrelated issues raised on an open request (e.g. a fence, a roof leak) must not be answered or claimed fixed in it; open a separate request.",
 "Tenant raises another problem on an open or closed case.","Log it as its own request; closing message covers only what this request fixed.","agency","process-timing","LOW",
 [E("024",15,"fence"),E("024",16,"have both been fixed and everything")],
 notes="024: the closing email claimed the fence was fixed with nothing in the case supporting it; a later leak report after closing got no reply.")
m=json.load(open(f"{D}/meta.json"))
m["design"].append(["May the agent close while the repair is untested or the landlord has not been told?","No. Close only when the contractor has confirmed completion, and send the landlord an outcome message first (P-060). Case 025 closed with 'not been fully tested yet' on record."])
json.dump(m,open(f"{D}/meta.json","w"),indent=1,ensure_ascii=False)
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch 5"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
