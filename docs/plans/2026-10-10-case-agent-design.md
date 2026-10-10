# Case agent: design

Date: 2026-10-10. Track: Property Management. Status: validated in brainstorming, not built.

## Goal

The case agent processes one Property Management case as Northbridge Lettings. It reads the case, acts through tools, and stops when the case waits for someone, needs a person, or is finished. For each case it writes `ANSWERS/<n>/ANSWER.md`, `ANSWERS/<n>/REASONING.md` and a trace. The hackathon rules require these files.

Out of scope: the evaluation bench. A later task builds it on top of the resume mode.

## Stack

TypeScript, `@anthropic-ai/sdk`, `zod`, `tsx`. The program is a plain loop with no agent framework. We checked eve (Vercel) and Pi Durable (Earendil). Both give durable sessions, but our runs are short batch jobs, and both are beta or experimental.

## Run model: act, stop at a wait, resume on new events

1. The program loads the saved state and any new events.
2. The program gives Claude the policy, the case, and the tools.
3. Claude calls tools until it calls one end tool.
4. The program saves the state and writes the output files.

A resume adds the next real event from the history and runs again. The replies always come from the real history. The program never invents a reply.

## Input

`parse.ts` reads `index.md` and `history.md` from a case folder.

- The agent gets: the case details, the initial request, the events up to the cut point, and the attachment list.
- The agent never gets: the Overview and Outcome sections. They tell the end of the case.

## Policy (policy.md)

The rules come from the 50 public Property Management cases.

Workflow stages: triage, landlord approval, provider selection, scheduling, work result, final checks, closed.

1. Get landlord approval before any contractor or any cost (41 of 50 cases).
2. Try the cheap fix first when one is likely. A landlord tip or a tenant fix closed cases 014, 017, 027 and 049 without payment. A blockage from everyday use is the tenant's responsibility.
3. Send a quote back to the landlord when it is above the approved work (12 cases with "+ VAT" quotes).
4. Do not assign our contractor if the landlord uses their own (5 cases).
5. If the landlord or tenant does not reply after 3 days, chase them once, then pass the case to a person. After 3 or more reminders to a provider, pass the case to a person.
6. Pause the case if the property is not tenanted.
7. Close only after the final checks: work confirmed, landlord informed, keys returned, invoice on file. Record a missing check in a note.
8. Record unrelated requests in a note. Do not act on them in this case (cases 024 and 027).
9. Escalate emergencies, legal threats, money disputes, and conflicting information. The public data has no emergencies, so this rule comes from general practice.

## Tools (tools.ts)

Work tools:

- `send_message(to, channel, text)`: `to` is tenant, landlord or contractor. `channel` is email or sms.
- `request_landlord_approval(scope, cost)`
- `assign_contractor(trade, notes)`
- `add_note(text)`

End tools. Each run must end with exactly one:

- `hold(reason)`: one of "Waiting for Landlord", "Waiting for Tenant", "Waiting for Provider", "Waiting for Quote".
- `escalate(summary)`: what the agent checked, what is missing, what the person must decide.
- `close_case(checks)`: refuses if a final check is unanswered.

Every tool writes to the outbox in the case state. Real tools from the organisers replace these tools behind the same interface.

## State (state/<case>.json)

- the number of events seen
- the status: hold and its reason, escalated, or closed
- the actions, each with the event it answered
- the outbox

## Failures

- API error or timeout: retry up to 3 times with backoff. Each call has a time limit.
- Bad tool input: zod rejects it, and the error goes back to Claude as text.
- Tool refusal: the refusal goes back to Claude as text.
- No end tool after 15 turns: the program escalates the case and marks the answer `incomplete`.
- A crash in one case: the other cases continue. The crashed case gets an ANSWER.md that states the error.

## Outputs

- `ANSWERS/<n>/ANSWER.md`: what the system received, the actions, the final status, the escalation.
- `ANSWERS/<n>/REASONING.md`: the reason for each action, with event numbers as references.
- `traces/<n>.jsonl`: every model call and tool call.

## Layout

```
case-agent/
  src/
    parse.ts
    tools.ts
    agent.ts
    answers.ts
    cli.ts
  policy.md
  package.json
```

## CLI

- `case run <dir>`: run the case to its first stop.
- `case run <dir> --next`: add the next real event and continue.
- `case run-all <dir>`: run every case, 4 at a time.

## MVP checks

1. Parser test on two real cases: the event count is correct, and the Overview and Outcome are absent.
2. Real run on case 027: run 1 ends in `hold: Waiting for Tenant`. After `--next` adds the tenant's "the plunger cleared it", the run ends in `closed`.

## Open question for 10:00

The organisers may supply real tools or APIs. If they do, they replace `tools.ts`. The loop and the policy stay.
