import json,re,os
D=os.path.dirname(os.path.abspath(__file__))
b=json.load(open(f"{D}/policy_bank.json"))
s=open(f"{D}/agent_brief.md").read()
bank="\n".join(f"{r['id']} [{r['confidence']}{' CONFLICT' if r.get('flag') else ''}] {r['statement']}" for r in b)
s=re.sub(r"EXISTING BANK \(check the case against it\):\n.*?\n\nRETURN COMPACT","EXISTING BANK (check the case against it):\n"+bank.replace("\\","\\\\")+"\n\nRETURN COMPACT",s,flags=re.S)
open(f"{D}/agent_brief.md","w").write(s); print(len(s))
