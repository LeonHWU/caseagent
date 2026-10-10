import json, re, subprocess, sys, os
BASE=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","Property Management")
def norm(s): return re.sub(r"\s+"," ",s.replace("’","'").replace("‘","'").replace("“",'"').replace("”",'"')).strip()
cache={}
def hist(case):
    if case not in cache: cache[case]=open(f"{BASE}/{case}/history.md",encoding="utf-8").read()
    return cache[case]
def section(case,ev):
    t=hist(case); m=re.search(r'<a id="event-%03d"></a>(.*?)(?=<a id="event-\d{3}"></a>|\Z)'%int(ev),t,re.S)
    return m.group(1) if m else None
def pdf(case,name):
    k=(case,name)
    if k not in cache: cache[k]=subprocess.run(["pdftotext","-layout",f"{BASE}/{case}/attachments/{name}","-"],capture_output=True,text=True).stdout
    return cache[k]
bank=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"policy_bank.json")))
bad=0;tot=0
for r in bank:
    for e in r["evidence"]:
        tot+=1
        txt=pdf(e["case"],e["event"]) if isinstance(e["event"],str) else section(e["case"],e["event"])
        ok = txt is not None and norm(e["quote"]) in norm(txt)
        e["verified"]=ok
        if not ok:
            bad+=1; print("FAIL",r["id"],e["case"],e["event"],repr(e["quote"]), "(no event)" if txt is None else "")
json.dump(bank,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"policy_bank.json"),"w"),indent=1,ensure_ascii=False)
print(f"{tot-bad}/{tot} verified")
