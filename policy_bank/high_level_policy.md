# High level policy: Northbridge Lettings maintenance

The short version of the policy bank. Each line ends with the rule IDs it comes from, so you can look them up in `policy_bank.md` (readable) or `policy_bank.json` (full evidence, every quote checked). Built from 50 cases; 77 rules.

**How the groups work**
- **A. Certain.** Same behaviour in 3+ cases, or stated outright, and no case disagrees. Do these.
- **B. Contested but important.** Strong evidence, but some cases did it differently. We picked a default.
- **C. Likely.** Seen in 2 cases. Follow unless something in the case says otherwise.
- **D. Situational.** Seen in 1 case. Useful playbook for that situation, not a general rule.
- **E. Our own safety rules.** No case shows these. We added them for the unseen cases.

---

## The lifecycle in one view

1. **Intake:** log the request, ask about access and pets. [P-020]
2. **Landlord approval** before any contractor is chosen. [P-001]
3. **Provider chosen**, tenant told, contractor told to quote only if needed. [P-019, P-058, P-003]
4. **Quote (if any)** goes to the landlord. Contractor starts only after the go-ahead. [P-002, P-031, P-030]
5. **Visit happens.** Chase if no result appears. [P-021, P-029]
6. **Completion:** invoice to the landlord, photos or a skip reason, key return, tell the landlord the outcome. [P-011, P-013, P-017, P-060]
7. **Close:** Result, completed, final checks, closed. [P-010, P-012]

At every wait, put the case on hold and name who you are waiting on. [P-004]

---

## A. Certain (HIGH confidence, no disagreement)

**Waiting and holding**
- After each outbound request, hold with a reason naming who we wait on (landlord, provider, tenant). [P-004]
- If the landlord or tenant has not answered within about 3 days, the system flags it. Re-send, phone, keep chasing, and never proceed without approval. [P-006, P-051]
- A property with no tenant is auto-paused. A human reviews it and continues by hand. [P-007]
- System-flagged inbound messages and provider replies go to a human, who either responds or returns the case to auto mode. [P-005, P-024]

**Approval and scope**
- Tell contractors they must not proceed until we approve the quote. [P-003]
- Send the contractor to attend and quote only if the job needs quoting. A minor fix done on site needs no quote. [P-058]
- A short informal landlord reply ("yes please", a thumbs-up) counts as approval. [P-031]
- After approval, tell the contractor and ask for a start date. Chase if none is given. [P-030]

**Contractors and tenants**
- Give the contractor the check-out report when they quote a clean or clearance. [P-009]
- Keep the tenant informed of the visit and ask them to tell the provider about pets. [P-019]
- For a tenant-reported appliance fault, send a self-help checklist first. Book an engineer only if the fault persists. [P-042]
- If the landlord offers a workaround for a minor fault, relay it to the tenant and close unless the tenant comes back. [P-045]
- External or communal works: the landlord may use their own contractor. We liaise and wait. [P-015]

**Money**
- Forward the contractor's invoice to the landlord for payment. [P-011]
- If the contractor invoices the landlord directly, we forward nothing. Record that as the skip reason. [P-033]
- Landlord invoices may be settled from the rent. Tell the landlord the amount. [P-044]

**Closing**
- Photos or documents are expected. If missing, log a skip reason and still close. [P-013]
- Closing does not wait for the landlord to confirm or pay. [P-012]
- No cost incurred means close as "completed without payment". [P-046]

**When a human takes over (escalation)**
- No work result after the visit date: the system chases and staff check. [P-021]
- Three or more unanswered reminders to a provider: staff check. [P-029]
- A contractor's reply is empty or unreadable: a human takes over. Never invent its content, dates or amounts. [P-050]

---

## B. Contested but important (we decided)

| Question | What the cases show | Our default |
|---|---|---|
| Ask the landlord first, or tell and proceed? [P-001] | Most ask first. A few routine jobs proceeded after telling the landlord. | **Ask and wait**, unless the case already records the landlord's agreement. |
| Quote approval before the contractor proceeds? [P-002] | Most wait for the go-ahead. Case 003 proceeded. | Approval to attend covers diagnosis and a minor on-site fix. **Any quote or extra cost goes back to the landlord.** |
| Tell the landlord the outcome before closing? [P-060] | Many cases close with no outcome message. | **Always send a short outcome message first.** |
| Who pays check-out cleaning? [P-014] | Invoice to the landlord. Report text mentions tenant deposits. | **Invoice the landlord. Never deduct from a deposit alone;** a human decides. |
| Key return check? [P-017] | Mostly on vacated properties; also done on occupied ones. | **Confirm key return on every visit-based job.** |
| SMS with every contractor email? [P-008] | Most do, some don't. | **Send it.** Cheap and harmless. |
| Closing sequence? [P-010, P-041] | Maintenance uses the full sequence; admin tasks close with one "complete". | **Decide by job type.** |
| Contact the tenant? [P-019] | Always for tenanted or vacating properties. | Not for vacant or communal works needing no access. |
| Tenant raises a new problem on an open request? [P-061] | Answered in place. | **Answer, but open a separate request.** Never claim it fixed under the old one. |
| Pass tenant's number to a landlord's contractor? [P-071] | One case passed it without a consent step. | **Get the tenant's consent.** Never send another person's details. |

---

## C. Likely (2 cases)

- Report system faults to the team channel and hold; a supervisor can complete the task. [P-023]
- Answer a contractor's key or access question with where the keys are. [P-032]
- A quote may widen scope. The whole quote still goes to the landlord. [P-037]
- To get tenant evidence (photos): email, hold, phone if no reply, resend, then forward. [P-038]
- If the landlord cites a prior installer or warranty, contact that party first. Do not accept "out of warranty" or approve paid work until verified. [P-059]
- If a tenant wants to replace a landlord's appliance with their own, get landlord consent first. No contractor is sent. [P-067]
- If a request is unclear, ask the tenant first, then write to the landlord. [P-072]

---

## D. Situational (1 case each)

**Approvals and money**
- Optional quote items are a separate landlord decision. [P-016]
- If a quote rises after approval, get approval again. [P-052]
- If the landlord wants a comparison quote, get a second provider and present both with VAT status. [P-034]
- If the contractor has an unpaid earlier invoice, raise it with the landlord first. [P-035]
- If the final invoice differs from the quote, explain why to the landlord. [P-036]
- A landlord's go-ahead may cover only a simple fix. Parts or complexity need a new quote. [P-070]
- If the landlord limits the budget, do not pursue the deferred items. [P-073]
- When alternatives exist (e.g. handle or lock), relay priced options. Never choose for the landlord. [P-074]
- If the landlord names a contractor, use that one. [P-047]
- Free replacement of faulty earlier work: close without payment. [P-069]

**Tenant situations**
- Tenant-responsibility fault: send self-help steps and a cost warning, no landlord or contractor. [P-062]
- Silent tenant: one chase with a stated deadline plus SMS, then close. [P-063]
- Visit-date dispute: the date confirmed with the contractor stands. [P-064]
- Tenant says damage pre-dated them: log it, continue, assign no blame. [P-066]
- Tenant withdraws part of a request: narrow the scope and tell both sides. [P-076]
- Tenant offers a self-fix: ask the landlord, no contractor, one chase, close if fixed or silent. [P-077]
- Phone the tenant to confirm the fix before closing. [P-065]
- Need tenant consent before sharing their details. [P-071]

**Process**
- Dependent clean waits until earlier works finish. [P-018]
- Ask contractors for invoices as PDF. [P-075]
- Compliance tasks: hold until due, collect evidence, forward, ask next due date. [P-040]
- Inspections: notify tenant, send landlord the summary, hand permission or key questions to a human. [P-055, P-056, P-057]
- A reply that cannot be tied to the open issue is not confirmation. Log it and ask again. [P-043]
- Defer works for practical or safety blockers (e.g. nesting wildlife). [P-025]
- Recurrence risk or a recommended replacement goes to the landlord, never ordered by us. [P-048]
- No fault found and no invoice: tell the landlord and close without payment. [P-053]
- Do not close with an open promise. Record a follow-up. [P-068]
- New provider without a portal invoices by email. Record it manually. [P-054]
- Tenant-responsibility items (e.g. garden) are chased with the tenant only. [P-039]
- Security-related faults: keep the tenant informed and do not close with the fault unresolved. [P-049]

---

## E. Our own safety rules (not shown in any case)

The cases handled leaks, locks and an oven as routine, so these are our margin for the unseen cases:
1. **Urgent hazards go to a human at once.** Gas, fire, flooding, no heating or water, an unsecurable door, window or lock, or injury. Never hold these for landlord approval. [P-049 and design decisions]
2. **Never decide for the landlord** on spend or scope. No spend limit is evidenced, so every quote goes to the landlord.
3. **Never state a job is done without evidence** (contractor confirmation or invoice). If less was delivered than asked, say so.
4. **Never invent** quotes, dates, approvals or what an unreadable message said. [P-050]
5. **Wrong address or name in a message:** trust the case header. If the mismatch could mean the wrong property, flag it before sending or closing.
6. **Do not close** while a repair is untested or the landlord has not been told. [P-060, P-068]
7. **Doing nothing can be correct:** a tenant-responsibility fault, a self-fix, a silent landlord (chase, don't act), or a conflict with an earlier approval. Escalate instead of acting.
8. **No tenant contact on a vacant property.** [P-007]

---

Full detail: `policy_bank.md` (rules with evidence, conflicts, design decisions, data traps) and `policy_bank.json` (all 572 verified quotes).
