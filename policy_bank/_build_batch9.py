import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
B=9
def E(case,ev,quote,t="OBSERVED",role=None):
    d={"case":case,"event":ev,"quote":quote,"evidence_type":t,"batch":B}
    if role: d["role"]=role
    return d
def add(pid,evs,note=None,flag=None,decision=None):
    r=by[pid]; have={(e["case"],e["event"],e["quote"]) for e in r["evidence"]}
    for e in evs:
        if (e["case"],e["event"],e["quote"]) not in have: r["evidence"].append(e)
    if note: r["notes"]=(r["notes"]+" " if r["notes"] else "")+f"[B{B}] "+note
    if flag: r["flag"]=flag
    if decision: r["decision"]=decision
LL="Please complete landlord approval step first"
add("P-001",[E("041",3,"Can you please advise if you are happy for us to arrange this"),E("042",3,LL,"EXPLICIT"),E("044",12,"Please go ahead"),E("045",2,LL,"EXPLICIT"),E("043",8,"Maintenance provider assigned",role="contradicts")],
 "043: provider assigned after about five days of landlord silence, before the landlord's later yes (a human acted).")
add("P-003",[E("042",13,"only proceed after receiving our approval","EXPLICIT"),E("044",15,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("042",6,"Waiting for Landlord"),E("043",7,"Waiting for landlord response"),E("044",10,"waiting to hear from LL"),E("045",4,"Waiting for Tenant")],"041: a hold named the contractor when the request had gone to the landlord, so hold reasons are not always accurate; name the right party.")
add("P-005",[E("041",13,"Please check if we need to provide a response","EXPLICIT"),E("042",7,"return this request to auto mode","EXPLICIT"),E("043",12,"return this request to auto mode","EXPLICIT"),E("044",11,"Please check if we need to provide a response","EXPLICIT"),E("045",5,"Please check if we need to provide a response","EXPLICIT")])
add("P-010",[E("043",20,"final checks","EXPLICIT"),E("044",22,"final checks","EXPLICIT")])
add("P-011",[E("043",22,"Need confirmation from landlord"),E("044",24,"Need confirmation from landlord")],"042, 044: an invoice was received but only the cost (042) or nothing (044) was passed to the landlord.")
add("P-012",[E("044",27,"the request is now closed","INFERRED")])
add("P-013",[E("042",29,"Skipped uploading one or more documents"),E("043",21,"Skipped uploading one or more documents"),E("044",23,"Skipped uploading one or more documents")])
add("P-015",[E("041",11,"I have sent the details to"),E("045",18,"keep this job open until its finished")],
 "041 and 045: landlord-led repairs stayed open for weeks on hold with periodic chasing and closed on the landlord's confirmation.")
add("P-017",[E("043",23,"check the key return before completing the request","EXPLICIT"),E("044",25,"check the key return before completing the request","EXPLICIT")])
add("P-019",[E("042",12,"please ensure you inform our provider"),E("043",9,"please ensure you inform our provider"),E("044",14,"please ensure you inform our provider")])
add("P-021",[E("042",20,"No work results","EXPLICIT")])
add("P-029",[E("044",20,"3+ reminders have been sent to provider","EXPLICIT")])
add("P-031",[E("042",8,"Yes please arrange an engineer"),E("043",13,"fine to send out a contractor"),E("044",12,"Please go ahead")])
add("P-042",[E("041",9,"Please advise once this has been done")],"042 and 043 sent an engineer at once: in 043 the tenant had already cleaned the filter; in 042 nothing explains it.")
add("P-046",[E("041",25,"completed without payment"),E("045",37,"completed without payment")])
add("P-051",[E("041",5,"If not, chase via phone")])
add("P-058",[E("043",10,"If the job requires quotation"),E("044",15,"If the job requires quotation","OBSERVED")])
add("P-059",[E("041",21,"new washer fitted by them")],"041: the landlord went to the original installer himself.")
add("P-060",[E("042",25,"for a cost of"),E("043",17,"re-fitted")],"042 and 043 told the landlord the fix and the cost before closing.")
add("P-036",[],"042: invoice 75.11 against 'about 75 + VAT' told to the landlord, with no explanation of the small difference (figures are examples).")
def rule(id,statement,trigger,action,actor,cat,conf,ev,decision=None,notes=""):
    r={"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":None,"evidence":ev,"notes":notes,"first_batch":B}
    if decision: r["decision"]=decision
    bank.append(r)
rule("P-070","A landlord's go-ahead may cover only a simple fix; if parts or complexity arise, the contractor must quote and wait for further approval.",
 "Landlord approves attendance without a price.","Pass the conditional scope to the contractor; any quote goes back to the landlord.","agency, landlord, contractor","approval-authority","LOW",
 [E("043",11,"needs part or is more complex, please quote it","EXPLICIT")],notes="Supports P-002/P-058; no spend limit is stated.")
rule("P-071","Before giving a tenant's contact details to a landlord's own contractor, get the tenant's consent.",
 "Landlord's contractor asks for the tenant's contact details.","Phone the tenant, get authorisation, then pass them on.","agency, tenant","safety-security","LOW",
 [E("045",12,"gave authorisation to pass on her details")])
rule("P-072","If the request is unclear, ask the tenant first (which item, was it landlord-requested) before approaching the landlord.",
 "Tenant report lacks the detail needed to brief the landlord.","Email the tenant, hold Waiting for Tenant, then write to the landlord with the detail.","agency, tenant","communication","MEDIUM",
 [E("044",5,"Which window is this please?"),E("045",3,"Was this requested by your landlord?")])
rule("P-073","If the landlord restricts scope for budget reasons, do not pursue the deferred items.",
 "Landlord approves part of the work only.","Instruct or track only the approved part; note the deferred item.","landlord, agency","financial","LOW",
 [E("045",11,"budget for the windows for now")])
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch {B}"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
