import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
B=10
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
add("P-001",[E("046",2,LL,"EXPLICIT"),E("048",2,LL,"EXPLICIT"),E("050",3,LL,"EXPLICIT"),E("049",3,"complete landlord approval step first","EXPLICIT")])
add("P-002",[E("046",16,"Are you happy to go ahead?"),E("046",20,"Yes, go ahead please."),E("050",21,"Yes please proceed")])
add("P-003",[E("046",12,"only proceed after receiving our approval","EXPLICIT"),E("048",11,"only proceed after receiving our approval","EXPLICIT"),E("047",18,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("046",5,"Waiting for Landlord"),E("048",4,"Waiting for Landlord"),E("050",7,"Waiting for Landlord"),E("049",10,"Waiting for Tenant")])
add("P-005",[E("046",6,"return this request to auto mode","EXPLICIT"),E("048",5,"return this request to auto mode","EXPLICIT"),E("050",8,"return this request to auto mode","EXPLICIT")])
add("P-010",[E("046",46,"final checks","EXPLICIT"),E("048",30,"final checks","EXPLICIT")])
add("P-011",[E("046",49,"Need confirmation from landlord"),E("048",33,"Need confirmation from landlord"),E("050",42,"Need confirmation from landlord")])
add("P-012",[E("046",52,"the request is now closed"),E("048",36,"the request is now closed"),E("050",43,"the request is now closed")],"048, 050: closed with no landlord reply to the final-confirmation prompt.")
add("P-013",[E("046",48,"Skipped uploading one or more documents"),E("048",32,"Skipped uploading one or more documents"),E("050",41,"Skipped uploading one or more documents")])
add("P-015",[E("047",10,"I have arranged plumber to visit"),E("047",35,"Landlord's contractor confirmed job complete.")],"047: the agency also assigned its own provider (ev16) and never logged cancelling it; avoid double-dispatch once the landlord says he has arranged someone.")
add("P-017",[E("046",50,"check the key return before completing the request","EXPLICIT"),E("048",35,"Keys return confirmed")],"046, 048: key return was checked on occupied properties too, supporting our decision to confirm on every visit-based job.")
add("P-019",[E("046",31,"Maintenance Provider Name"),E("048",10,"please ensure you inform our provider"),E("050",30,"Maintenance Provider Name")])
add("P-021",[E("046",36,"No work results","EXPLICIT"),E("048",21,"No work results","EXPLICIT")])
add("P-024",[E("049",6,"Please review and proceed manually","EXPLICIT")])
add("P-031",[E("046",18,"happy to ahead with that"),E("048",6,"Yes please get that sorted"),E("050",21,"Yes please proceed")])
add("P-037",[E("046",15,"can we please do while there")])
add("P-045",[E("049",7,"approves the tenant to fix the door")])
add("P-046",[E("047",36,"Task has been completed without payment"),E("049",14,"completed without payment")])
add("P-050",[E("046",32,"Please review manually","EXPLICIT"),E("050",17,"Please review manually","EXPLICIT")])
add("P-058",[E("046",12,"If the job requires quotation"),E("048",11,"If the job requires quotation"),E("050",14,"If the job requires quotation")])
add("P-060",[E("046",42,"the window issue was now resolved"),E("050",36,"the window repair is now complete"),E("048",36,"the request is now closed",role="contradicts"),E("047",36,"completed without payment",role="contradicts")],"047, 048: closed with no outcome message to the landlord logged.")
add("P-071",[E("046",24,"requesting the tenant's mobile number",role="contradicts"),E("046",25,"07700 900298",role="contradicts")],"046: tenant's number was emailed to the contractor with no consent step logged; 050 ev24 also sent tenant details (a different name) to the contractor. Consent is our safer default.",flag="CONFLICT",decision="Our decision: get tenant consent (or confirm on the thread that the tenant agreed) before passing a number to a contractor; never send another person's details.")
def rule(id,statement,trigger,action,actor,cat,conf,ev,decision=None,notes=""):
    r={"id":id,"statement":statement,"trigger":trigger,"action":action,"actor":actor,"category":cat,"confidence":conf,"flag":None,"evidence":ev,"notes":notes,"first_batch":B}
    if decision: r["decision"]=decision
    bank.append(r)
rule("P-074","When the landlord's reply or the contractor's findings give alternatives (e.g. handle or lock), relay the priced options with VAT to the landlord rather than choosing; a blanket 'proceed with whatever is needed' then covers either.",
 "Contractor reply is ambiguous on the fault or offers options.","Send options and prices to the landlord, then tell the contractor to proceed as approved; do not trust an unreadable summary as the quote.","agency, landlord, contractor","approval-authority","LOW",
 [E("050",19,"A new handle would be"),E("050",23,"Please go ahead with whatever needed","EXPLICIT")],notes="Closing note records a quote given (49.40 incl VAT) that matches neither option; figures are examples.")
rule("P-075","Ask the contractor to send the invoice as a PDF.",
 "Visit date has passed and the invoice is outstanding.","Ask whether the job was done and request a PDF invoice.","agency, contractor","process-timing","LOW",
 [E("046",38,"send it in PDF","EXPLICIT")])
rule("P-076","If a tenant withdraws part of a multi-issue request, tell the landlord and tenant and continue only with what remains.",
 "Tenant says one of several faults is fixed.","Email landlord the narrowed scope, confirm to tenant, hold. If the landlord replies about a different scope or address, restate what remains.","agency, tenant, landlord","communication","LOW",
 [E("047",6,"My mother managed to fix the toilet."),E("047",11,"It is just the window issue that needs to be assessed now.")])
rule("P-077","For a minor fault the tenant offers to fix, ask the landlord whether the tenant may self-fix or a contractor is wanted; relay it, chase once for confirmation, and close without payment if fixed or no reply.",
 "Tenant reports a minor fault and is willing to fix it.","No contractor until the tenant says they cannot; one chase stating the job will close without a reply.","agency, landlord, tenant","process-timing","LOW",
 [E("049",4,"Are you happy for them to do this"),E("049",8,"Please let me know if not and I will then get a contractor"),E("049",12,"if no reply will close off the job")],notes="Extends P-045. 049 logged 'Proceed to provider selection' but no provider was assigned.")
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch {B}"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
