# case-agent

Real-World Agents Hackathon (Dwelly), London, 10 October 2026. Track: Property Management.

## What we built

An agent that processes property-maintenance cases as the letting agency, Northbridge Lettings. It reads a case, acts through tools (messages, landlord approval requests, contractor assignment, notes), and ends each run in one of three states: on hold for a named party, escalated to a person with a handover, or closed after the final checks. When the next real reply arrives, the agent resumes the case.

## The operational problem

Letting agencies spend most of their time waiting for approval from landlords, replies from tenants, and contractor reports. This agent handles each step, and it passes a case to a person when the case needs judgement: an emergency, a legal threat, a money dispute, or facts that conflict.

## Architecture

```
case folder (index.md, history.md, attachments/)
  -> parse.ts    events; Overview, Outcome and Status removed
  -> cut.ts      the events this run may see
  -> agent.ts    Claude tool loop, at most 15 turns, ends with hold | escalate | close_case
  -> tools.ts    7 tools with zod schemas; every action has a cited reason
  -> answers.ts  ANSWERS/<n>/ANSWER.md and REASONING.md
state/<n>.json saves the case between runs; traces/<n>.jsonl logs every model call and tool call.
```

The rules for the agent are in `policy.md`. They come from 50 public Property Management cases.

## How to run

```bash
npm install
cp .env.example .env                                   # add ANTHROPIC_API_KEY
npm run case -- run <case-dir>                         # first run
npm run case -- run <case-dir> --next                  # resume on the next reply
npm run case -- run-all <cases-dir> --concurrency 4    # every case in a folder
npm test
```

## Models, APIs and services

- Anthropic Claude (`claude-sonnet-5-5` by default; set `MODEL` to change it) through `@anthropic-ai/sdk`.
- No other external service. Messages and assignments go to the outbox in the case state.

## Assumptions

- The agent acts as the agency. After the first run it sees only events from outside parties; its own actions take the place of the agency's recorded events.
- The tools are simulated, because the event provides no live systems. Each tool is one entry in `src/tools.ts`, so a real API can replace it.

## Known limitations

- PDF attachments are listed but not read.
- The agent sees time only through event timestamps, so "3 days without reply" works only when a later event shows the gap.

## Next steps

- An evaluation bench that replays the public cases event by event and grades each decision against the real history.
- PDF text extraction for quotes and invoices.
- Real adapters for email, SMS and the agency's job system.
