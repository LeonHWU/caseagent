import json, os
D=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{D}/policy_bank.json")); by={r["id"]:r for r in bank}
def E(case,ev,quote,t="OBSERVED",role=None):
    d={"case":case,"event":ev,"quote":quote,"evidence_type":t,"batch":7}
    if role: d["role"]=role
    return d
def add(pid,evs,note=None,flag=None,decision=None):
    r=by[pid]; have={(e["case"],e["event"],e["quote"]) for e in r["evidence"]}
    for e in evs:
        if (e["case"],e["event"],e["quote"]) not in have: r["evidence"].append(e)
    if note: r["notes"]=(r["notes"]+" " if r["notes"] else "")+"[B7] "+note
    if flag: r["flag"]=flag
    if decision: r["decision"]=decision
LL="Please complete landlord approval step first"
add("P-001",[E("031",3,"Landlord approval confirmed. Proceed to provider selection.","EXPLICIT"),E("032",2,LL,"EXPLICIT"),E("033",3,"advise if you wish for me to instruct a contractor to attend"),E("034",2,LL,"EXPLICIT"),E("035",3,LL,"EXPLICIT")],
 "034: approval logged with no landlord correspondence visible (offline or unlogged).")
add("P-002",[E("032",18,"Please let me know if they can proceed"),E("033",20,"advise if you approve for me to raise an order")])
add("P-003",[E("031",6,"only proceed after receiving our approval","EXPLICIT"),E("032",11,"only proceed after receiving our approval","EXPLICIT"),E("033",11,"only proceed after receiving our approval","EXPLICIT"),E("034",7,"only proceed after receiving our approval","EXPLICIT")])
add("P-004",[E("031",18,"Waiting for Provider"),E("032",4,"Waiting for Landlord"),E("033",21,"Held awaiting response from the landlord"),E("035",7,"Waiting for Landlord")])
add("P-005",[E("032",23,"Please check if we need to provide a response","EXPLICIT"),E("033",7,"Please check if we need to provide a response","EXPLICIT"),E("035",8,"Please check if we need to provide a response","EXPLICIT")])
add("P-008",[],"No logged SMS with contractor emails in 022, 024-026 and 030-034 (SMS only to tenants), so this is common practice but not universal.",
 flag="CONFLICT",decision="Send the SMS prompt with contractor emails anyway; it is cheap and harmless, and the logs may simply omit it.")
add("P-010",[E("033",39,"final checks","EXPLICIT"),E("034",13,"final checks","EXPLICIT")],"032 closed 'by supervisor' with no Result/final-checks events (like 015).")
add("P-011",[E("031",26,"Need confirmation from landlord"),E("033",41,"Need confirmation from landlord"),E("034",15,"Need confirmation from landlord")])
add("P-012",[E("031",27,"the request is now closed","INFERRED"),E("034",16,"the request is now closed","INFERRED")],"034: landlord 'Paid today' arrived after closure.")
add("P-013",[E("031",25,"No other docs required"),E("033",40,"Not required"),E("034",14,"Invoice sent to LL")],"033 and 031 closed with an invoice received and no forward logged. Do not copy that silently: forward it or record a real reason.")
add("P-014",[E("034",11,"charged a call out")])
add("P-017",[E("033",42,"check the key return before completing the request","EXPLICIT")])
add("P-019",[E("032",10,"please ensure you inform our provider"),E("033",35,"inform the Maintenance Provider")])
add("P-021",[E("032",17,"No work results","EXPLICIT"),E("033",17,"No work results","EXPLICIT")])
add("P-030",[E("032",25,"please proceed with a new toilet flusher")])
add("P-031",[E("032",24,"\U0001F44D"),E("033",23,"approves the request to proceed with raising an order")],"An emoji-only reply (thumbs-up) to a quote request was accepted as approval in 032, then the agency instructed the contractor at the quoted amount incl. VAT status.")
add("P-050",[E("034",9,"could not be extracted","EXPLICIT")],"The real content arrived in the next event; do not act on the unreadable one.")
add("P-058",[E("031",6,"If the job requires quotation"),E("032",11,"If the job requires quotation"),E("034",7,"If the job requires quotation")])
add("P-060",[E("034",11,"repair this on site")],"034 is a clean example: outcome plus invoice emailed to the landlord before closing.")
add("P-015",[E("035",6,"he is going to get the parts"),E("035",11,"confirmed this is all done")],"035: landlord elected to source parts and fit it himself; his phone confirmation was accepted as completion, with no tenant re-check.")
add("P-046",[E("035",13,"completed without payment")])
add("P-065",[],"Absent in 031, 032, 034, 035 (no tenant fix-confirmation before close).")
m=json.load(open(f"{D}/meta.json"))
for i,(q,a) in enumerate(m["design"]):
    if q.startswith("Urgency, emergencies"):
        m["design"][i][1]=a+" (Cases 031 overflowing cistern with an earlier leak letter, 034 shower too hot, 026 oven, door locks were all handled as routine, so this is our own safety margin.)"
m["design"].append(["An email body names a different property or address from the case.","Trust the case header. If the mismatch could mean the wrong property (33 and 34 closed with one), verify or flag before sending to anyone or closing."])
json.dump(m,open(f"{D}/meta.json","w"),indent=1,ensure_ascii=False)
rank={"LOW":0,"MEDIUM":1,"HIGH":2}
for r in bank:
    if r["id"] in ("P-027","P-028"): continue
    cases={e["case"] for e in r["evidence"] if e.get("role") not in ("contradicts","context")}
    c="HIGH" if len(cases)>=3 else "MEDIUM" if len(cases)==2 else "LOW"
    if rank[c]>rank[r["confidence"]]: r.setdefault("confidence_history",[]).append(f"{r['confidence']}->{c} in batch 7"); r["confidence"]=c
json.dump(bank,open(f"{D}/policy_bank.json","w"),indent=1,ensure_ascii=False)
print(len(bank),"rules")
