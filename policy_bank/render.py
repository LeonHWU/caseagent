import json, os
d=os.path.dirname(os.path.abspath(__file__))
bank=json.load(open(f"{d}/policy_bank.json")); meta=json.load(open(f"{d}/meta.json"))
order=["approval-authority","responsibility","financial","process-timing","communication","closure-checklist","escalation-trigger","safety-security","tenancy-legal","other"]
def loc(e): return f"{e['case']}/{e['event']}" if isinstance(e['event'],int) else f"{e['case']}/doc"
def ev(r,role):
    xs=[e for e in r["evidence"] if (e.get("role")=="contradicts")==(role=="against") and e.get("role")!="context"]
    xs=sorted(xs,key=lambda e:(e["evidence_type"]!="EXPLICIT",len(e["quote"])))
    seen=set();out=[]
    for e in xs:
        if e["case"] in seen: continue
        seen.add(e["case"]); out.append(f'{loc(e)} "{e["quote"]}"')
        if len(out)>=(3 if role!="against" else 2): break
    return out
L=["# Northbridge Lettings policy bank","",f"{len(bank)} rules from the cases processed so far. Confidence: HIGH = stated or 3+ cases, MEDIUM = 2 cases, LOW = 1 case. Evidence is `case/event`. Figures in cases are examples, not thresholds. Full evidence is in policy_bank.json.",""]
for c in order:
    rs=[r for r in bank if r["category"]==c]
    if not rs: continue
    L+=[f"## {c}",""]
    for r in rs:
        L.append(f"**{r['id']}** [{r['confidence']}]"+(" CONFLICT" if r.get("flag") else "")+f" {r['statement']}")
        L.append(f"- When: {r['trigger']} Do: {r['action']}")
        L.append("- Evidence: "+"; ".join(ev(r,"for")))
        ag=ev(r,"against")
        if ag: L.append("- Against: "+"; ".join(ag))
        if r.get("decision"): L.append(f"- **Our decision:** {r['decision']}")
        L.append("")
L+=["## Escalation triggers",""]+[f"- {r['id']}: {r['statement']}" for r in bank if r["category"]=="escalation-trigger"]
L+=["","## Conflicts and our resolution",""]+[f"- {r['id']}: {r['decision']}" for r in bank if r.get("flag") and r.get("decision")]
L+=["","## Design decisions (no organiser contact, so these are our calls)",""]+[f"- **{q}** {a}" for q,a in meta["design"]]
L+=["","## Data traps",""]+[f"- {n}" for n in meta["noise"]]
open(f"{d}/policy_bank.md","w").write("\n".join(L)+"\n")
