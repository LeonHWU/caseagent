# Batch log

## Batch 1: cases 001-005
- Processed: 001 (communal garden, 44 events, no attachments), 002 (blocked toilet, 49 events, no attachments), 003 (checkout cleaning, 23 events, 2 PDFs), 004 (checkout clean, 42 events, 3 PDFs), 005 (checkout clean, 37 events, 3 PDFs).
- New rules: 28 (P-001 to P-028). Strengthened: 0 (first batch).
- Confidence: HIGH 7 (P-001, 002, 004, 005, 009, 010, 011), MEDIUM 6, LOW 15.
- Conflicts flagged (not resolved): P-002 (case 003 approved estimate without visible landlord approval), P-014 (landlord pays vs deposit deduction text), P-019 (tenant updates vs 'no contact needed' in 001).
- Verification: all 86 evidence quotes grep-verified against the cited event section or PDF text (verify.py).
- Gaps and noise: see policy_bank.md sections.
- Note: a first sub-agent call for 001 was sent with a placeholder prompt by mistake; it did nothing and 001 was re-run properly.
- Files: _build_batch1.py (rule definitions), verify.py, render.py, meta.json.

## Batch 2: cases 006-010
- Processed: 006 (carpet+repaint after vacate, 27 events), 007 (spotlights/ceiling tile, 37 events, 2 PDFs), 008 (check-out works, two quotes, 49 events, 4 PDFs), 009 (tenant garden evidence, 23 events), 010 (solar meter photo, 15 events, 1 PDF).
- New rules: 13 (P-029 to P-041). Total now 41.
- Strengthened (new supporting evidence): P-001, 002, 003, 004, 005, 006(note), 007, 008, 009, 010, 011, 012, 013, 014, 017, 019. Confidence raised: P-003 L>M, P-007 M>H, P-008 M>H, P-012 M>H, P-013 M>H, P-014 M>H, P-017 L>M, P-019 M>H, P-020 L>M. (Confidence counts distinct supporting cases; contradicting evidence is excluded.)
- NEW conflicts flagged: P-010 (cases 009/010 close with one 'complete' update, no Result/final checks), P-017 (key return gated closure in 006 but not in 007/008), P-041 (companion to P-010). Existing conflicts updated: P-002 (now 7 cases vs case 003), P-014 (4 report templates vs landlord-pays handling in 6 cases), P-019 (vacated properties show no tenant contact).
- Tension noted, not flagged: P-006 (3-day manual-review flag absent during ~20 days of landlord chasing in 008).
- Verification: 178/178 evidence quotes verified (two quotes corrected after the first pass failed one and two were too weak).
- Gaps and noise: appended to policy_bank.md sections.

## Batch 3: cases 011-015
- Processed: 011 dishwasher dial, 012 dishwasher door, 013 dishwasher light, 014 front door (landlord workaround), 015 sticking front door.
- New rules: 9 (P-042 to P-050). Total 50. All 230 evidence quotes verified.
- New conflict: P-001 (013 told the landlord instead of asking; 012 relied on a recorded earlier agreement). Updated: P-002 (013 no quote step), P-010 (015 supervisor close), P-017 (key check also in occupied tenancies).
- Our decisions added for P-001, P-010, P-017, P-045, P-049.
- Safety note: 014/015 are door-security faults handled as routine; no emergency handling evidenced, so P-049 sets our own escalate-same-day default.

## Batch 4: cases 016-020
- Processed: 016 door misaligned, 017 extractor fan (landlord fix), 018 communal garden, 019 garden clearance (landlord silent, revised quote), 020 routine inspection.
- New rules: 7 (P-051 to P-057). Total 57. 272/272 quotes verified.
- No new contradictions. Strengthened: P-044 (rent-settled invoices, now 3 cases), P-046, P-045, P-006.
- Our decisions added: P-051 (escalate after repeated silence), P-057 (inspection permission/key questions go to a human); design decisions on completion claims and unresolved hazards.

## Batch 5: cases 021-025
- Processed: 021 key replacement, 022 stiff lock (no landlord contact), 023 balcony door lock, 024 oven (tenant self-help first), 025 oven warranty dispute.
- New rules: 4 (P-058 to P-061). Total 61. 326/326 quotes verified (two quotes corrected after the first pass).
- Contradictions: P-001 reinforced (022 dispatched with no landlord contact). P-002 resolved by our decision: landlord's go-ahead to attend covers a minor on-site fix (P-058); quotes/extra cost still go to the landlord. P-011 reworded: the 'Need confirmation from landlord' note is a closure step logged even with no invoice.
- New P-060 (HIGH, our decision): tell the landlord the outcome before closing; 021-025 closed without one.

## Batch 6: cases 026-030
- Processed: 026 oven (date dispute), 027 blocked drain (tenant responsibility), 028 garden pipe (landlord self-arranged), 029 cracked basin, 030 toilet/tap (missed visit).
- New rules: 5 (P-062 to P-066). Total 66. All 371 quotes verified (one corrected).
- Conflicts: P-001 strengthened (tell-and-proceed in 013, 022, 029, 030 vs ask-first in 15+ cases; we keep ask-first). New flags: P-060 (our outcome-message decision vs common practice) and P-061 (027 answered a new query in the same record).
- P-015 broadened (landlord self-arranged repairs), P-017 now treated as a standard closure step on every visit-based job.

## Batch 7: cases 031-035
- Processed: 031 cistern overfill, 032 toilet flush (quote approved by thumbs-up), 033 tap, 034 shower (fixed on site), 035 shower hose (landlord self-fix).
- New rules: 0 (all behaviour matched the bank). 416/416 quotes verified (one corrected). Total 66.
- New conflict flag: P-008 (SMS with contractor email absent in most recent cases; our decision: send anyway). P-015 broadened to landlord phone confirmation as completion evidence.
- Design decisions added: wrong-address email bodies (verify before closing); safety margin note for leak/lock/door faults handled as routine.

## Batch 8: cases 036-040
- Processed: 036 shower tap (six weeks of chasing, free replacement), 037 leaking shower hose, 038 washing machine (tenant-funded replacement), 039 washing machine noise, 040 washing machine (closed with open commitment).
- New rules: 3 (P-067 to P-069). Total 69. 458/458 quotes verified.
- Notable: P-067 tenant-funded replacement needs landlord consent; P-068 (our rule) do not close with an open commitment (040 failure); P-001 tell-and-proceed seen again in 039.

## Batch 9: cases 041-045
- New rules: P-070 (conditional landlord approval for simple fixes; parts/complexity need a quote), P-071 (tenant consent before passing contact details to landlord's contractor), P-072 (ask tenant first when request unclear), P-073 (landlord budget limits scope; don't pursue deferred items).
- Strengthened: P-001,003,004,005,010,011,012,013,015,017,019,021,029,031,036,042,046,051,058,059,060.
- 508/508 quotes verified.

## Batch 10: cases 046-050
- New rules: P-074 (relay priced alternatives; blanket go-ahead), P-075 (invoice as PDF), P-076 (partial withdrawal of multi-issue request), P-077 (tenant self-fix route).
- P-071 now CONFLICT (046 passed tenant number without consent step; our decision: get consent).
- Strengthened: P-001-005,010-013,015,017,019,021,024,031,037,045,046,050,058,060.
- 572/572 quotes verified. All 50 cases processed.
