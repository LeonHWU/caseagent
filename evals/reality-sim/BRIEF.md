# Brief for case writers (reality-sim)

You are writing ONE practice case for a property-management agent eval. The case must look exactly like the public cases and must stop at the moment a decision is needed. A separate hidden answer sheet already exists; you do not write it.

## Where things are

- Public cases to copy the style from (READ-ONLY): `data/public/Property Management/<NNN>/` (`index.md`, `history.md`, `attachments/`). Read at least two before writing, e.g. `030`, `036`, `005`, `025`. Copy their structure, tone, system messages and messiness.
- Your output: `evals/reality-sim/cases/<id>/index.md`, `history.md`, and `attachments/` only if your card lists attachments.
- Write nothing outside `evals/reality-sim/cases/<id>/`. Do not run git. Do not edit other cases.

## index.md format (exact)

```
# Case <id>: <Short neutral title>

## Case details

- **Source role:** Tenant            (or: Agency manager)
- **Status:** In progress
- **Created:** 2026-03-04 09:12:41 UTC
- **Property:** Flat 6, 41 Alder Lane, Westmarsh, ZZ4 2ZZ

## Initial request

<the request in the reporter's own words>

## Question                          (ONLY if your card has a "question"; use its text)

<question>

## History

[Read the complete event history](history.md).

## Attachments

- [attachment-01-name.txt](attachments/attachment-01-name.txt)
(or: No attachments are required or available for this case.)
```

No `Overview`, no `Outcome`, no `Updated`, no `Completed`. The title must not reveal the answer (write "Bathroom ceiling stain", not "Emergency: water in light fitting").

## history.md format (exact)

```
# Case <id> history

Total events: <N>

<a id="event-001"></a>
## 2026-03-04 09:12:41 UTC — event 001

- **Channel:** Note
- **From:** Agency / system
- **To:** Not specified

<body>

<a id="event-002"></a>
...
```

- Channels: `Note`, `Update`, `Hold`, `Email`, `SMS`, `Call`.
- From / To values: `Agency / system`, `Northbridge Lettings`, `Tenant`, `Landlord`, `Contractor`, `Not specified`.
- Event numbers are consecutive, zero-padded to three digits, with the `<a id>` anchor line before each. The dash in the heading is an em dash (—).
- Typical opening, as in the public cases: 001 Note "Request description: ... Additional details provided: ..." (access and pets questions), 002 Note "[AI Intake Classification] ...", 003 Update "Please complete landlord approval step first".
- Use the corpus's real system lines where they fit, word for word: "Waiting for landlord/tenant response before provider selection (3 days).", "No landlord/tenant response after 3 days. Please review manually.", "Landlord approval confirmed. Proceed to provider selection.", "Maintenance provider assigned", "Please check if we need to provide a response to landlord. If not, please return this request to auto mode.", "3+ reminders have been sent to provider. Please check what's happening.", "Email received from provider, but expected data could not be extracted. Please review manually.", "Put on hold by <Name>. Reason: Waiting for Landlord" (also Tenant / Provider / Other. Comment: ...).

## World rules

- Agency: Northbridge Lettings. Fictional addresses with `ZZ` postcodes (e.g. `ZZ4 2ZZ`), towns such as Alderwick, Westmarsh, Cedarford, Kingshaven, Northbridge, Willowbank. Phone numbers `07700 900xxx`. Emails `@example.com`. Job IDs like `NBL-<id>-4821`.
- People: invent ordinary names. Contractor firms in the corpus style ("Harbour Services", "Keystone Works").
- UK English, pounds, VAT. Staff write short, slightly informal emails with occasional typos. Some inbound emails appear as one-line machine summaries ("The customer confirms...").

## What makes the case good

1. **Follow the card.** `situation` is what happens. `trap` is what makes it hard; build it in faithfully. `hidden_truth` must be discoverable from the events but not announced.
2. **End at the decision point.** The last events are the trigger (usually inbound from tenant, landlord or contractor, or a system notice). No agency response to the trigger may appear. Nothing after it.
3. **Do not leak the answer.** No event may say what should be done about the trigger. Do not copy any text from the card's `rubric` into the case.
4. **Hit the event count** in `length_events` (within about 10%). Fill with realistic operational events: holds, chasers, system updates, short replies.
5. **Add corpus-style noise** (two or three items, none of which change the right answer): an email body whose `Address:` line names a slightly different flat number; an `Attachment: [photo; unavailable]` line; a staff name that varies; a duplicate reminder; one machine-summarised inbound email.
6. **Keep the facts the answer depends on unambiguous.** Amounts, who approved what, and the order of key messages must be clear and consistent, even though surrounding detail is messy. Timestamps should run forwards.
7. **Attachments** (only if the card lists them): plain-text files named `attachment-01-<slug>.txt`, written as a realistic document (letterhead lines, date, line items, totals). An attachment marked "(unavailable)" in the card gets no file; reference it in an event as `Attachment: [<description>; unavailable]`. Link available ones from the event that delivers them: `Attachments: [attachment-01-quote.txt](attachments/attachment-01-quote.txt)`.

## Before you finish

Run the checker and fix every failure:

```
python3 -I evals/reality-sim/tools/validate.py <id>
```

(If the checker file does not exist yet, re-read this brief and check the format by hand.)

Then reply with three lines only: the id, the event count, and one sentence on anything in the card you could not do.
