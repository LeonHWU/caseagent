import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
B=8
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
add("P-001",[E("038",3,LL,"EXPLICIT"),E("040",3,LL,"EXPLICIT"),E("039",9,"asked Ava Fletcher to get in touch",role="contradicts")],
 "039: provider assigned about three days after the landlord hold with no landlord reply recorded (offline approval or tell-and-proceed).")
add("P-003",[E("036",11,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("036",4,"Waiting for Landlord"),E("037",5,"LL to approve contractor"),E("039",8,"Waiting for Landlord")])
add("P-005",[E("036",5,"return this request to auto mode","EXPLICIT"),E("037",6,"Please check if we need to provide a response","EXPLICIT"),E("039",5,"return this request to auto mode","EXPLICIT")])
add("P-006",[E("038",7,"Waiting for landlord/tenant response before provider selection (3 days)","EXPLICIT"),E("040",6,"Waiting for landlord/tenant response before provider selection (3 days)","EXPLICIT")])
add("P-008",[E("036",10,"Please check your email")])
add("P-011",[E("039",27,"Need confirmation from landlord")])
add("P-012",[E("039",28,"the request is now closed","INFERRED")])
add("P-013",[E("039",26,"Skipped uploading one or more documents")],"Skip reasons seen: 'no quotes needed' (039), supervisor completion with no reason (037).")
add("P-019",[E("036",19,"inform the Maintenance Provider"),E("037",10,"please ensure you inform our provider"),E("039",11,"inform our provider")])
add("P-020",[E("038",2,"Are there any pets at the property?")])
add("P-021",[E("036",21,"No work results","EXPLICIT")])
add("P-024",[E("038",8,"Please review and proceed manually","EXPLICIT"),E("040",7,"Please review and proceed manually","EXPLICIT")])
add("P-031",[E("036",6,"Yes please!"),E("037",7,"Please get the shower hose replaced."),E("038",9,"Yes this is fine.")])
add("P-042",[E("039",3,"nothing inside the machine hitting the sides")])
add("P-046",[E("036",52,"completed without payment"),E("038",13,"completed without payment"),E("040",12,"completed without payment")])
add("P-058",[E("037",11,"If the job requires quotation"),E("039",12,"If the job requires quotation")])
add("P-060",[E("037",23,"FYI"),E("038",10,"Your landlord said it's fine to replace it with your own"),E("040",11,"Completed- no further action",role="contradicts")],
 "040 is the clearest failure: the landlord agreed to a check, was never answered, closed with 'no further action', and chased afterwards.")
add("P-059",[],"036: the landlord said the taps were under guarantee; the same contractor then replaced the faulty tap at no charge. Nothing contradicts the rule.")
add("P-049",[],"037: a leaking shower hose was handled as routine with no interim advice.")
def rule(id,statement,trigger,action,actor,cat,conf,ev,decision=None,notes=""):
    r={"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":None,"evidence":ev,"notes":notes,"first_batch":B}
    if decision: r["decision"]=decision
    bank.append(r)
rule("P-067","If the tenant offers to replace a landlord-supplied appliance with their own, get the landlord's consent first; the replacement is the tenant's property and liability, and no contractor is sent.",
 "Tenant proposes their own replacement instead of a repair.","Ask the landlord (and whether they will cover removal of the old unit); relay the answer; note ownership and liability.","agency, landlord, tenant","approval-authority","MEDIUM",
 [E("038",5,"willing to replaced the machine with her own"),E("038",12,"under tenants liability","EXPLICIT"),E("040",5,"see what they would like to do")],
 notes="038: removal cost cover was offered to the tenant by the agency on the landlord's brief 'Yes this is fine'; the landlord never confirmed the cost cover explicitly.",
 decision="Get the landlord's explicit yes on both the swap and any removal-cost cover before telling the tenant.")
rule("P-068","Do not close a request while a commitment to the landlord or tenant is still open (e.g. a promised check); record it as a follow-up or hold, and answer the landlord.",
 "Landlord has agreed to an action or asked for an update and the agency has promised something later.","Keep the case open on hold, or create the follow-up, and reply to the landlord.","agency","closure-checklist","LOW",
 [E("040",10,"check this when you're back"),E("040",13,"seeking an update on the washing machine repair request")],
 decision="Our rule. In 040 the agency promised a later check, closed with 'no further action', and the landlord had to chase.",
 notes="Single case; counted as a failure example, not an agency rule.")
rule("P-069","If the contractor's earlier work was faulty and they replace it, no charge applies; record the reason and close without payment.",
 "Repeat visit for a defect in the contractor's own earlier work or an item under guarantee.","Chase for photos and confirmation; close as completed without payment once the contractor confirms.","contractor, agency","financial","LOW",
 [E("036",50,"faulty tap"),E("036",43,"guarantee")],
 notes="036: about six weeks of chasing; the landlord complained of delay and missing photos; the agency kept holding and never reassigned the job.")
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch {B}"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
