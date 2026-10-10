# reality-sim: practice cases for the Reality Test

37 practice cases in the same shape as the public cases. Each one stops at a point where someone has to decide what to do, and each has a hidden answer sheet. This is a development set, not the organisers' test.

## Layout

```
cases/<id>/        what the agent is given: index.md, history.md, attachments/
labels/<id>.json   the answer sheet. NEVER give this folder to the agent.
worklist.json      the source list: cut points, changes, cards and rubrics
tools/build.py     rebuilds the 1xx and 2xx cases and all labels from worklist.json
tools/validate.py  checks every case has the public-case shape and no outcome text
BRIEF.md           the writing instructions used for the 3xx cases
```

## The three kinds of case

| IDs | Count | What it is |
|---|---|---|
| 101–115 | 15 | A public case cut short at a decision point. Overview, Outcome, Status and later events removed. |
| 201–210 | 10 | One of the cuts above with a single change that alters the right answer (a yes becomes a no, a reply is empty, an email bounces, a safety detail appears, an instruction is injected). |
| 301–312 | 12 | New cases written from a card, covering situations the public set lacks (emergencies, a deposit dispute, a legal letter, an identity request, failed actions, a finished job with nothing to do). Four have a `## Question` section in `index.md`. |

Correct decisions across the set: ask 16, escalate 8, proceed 6, hold 4, close 3.

## The answer sheet

Each label has a `rubric` with the six parts the hackathon rules name:

- `required`: what a good answer must do
- `acceptable`: other answers that also pass
- `optional`: extra credit
- `red_flags`: poor judgement
- `prohibited`: must not do
- `critical`: any one of these fails the case

The 1xx rubrics are a reading of the hidden later events plus the policy bank. The recorded history is a reference, not the only right answer; in a few cases (104, 115) the real agency's own handling is what the rubric marks as a failure.

## Using it

**What a case is.** `cases/<id>/` is a complete case folder in the organisers' format. The last event in `history.md` is the decision point: the agent should read everything and say what happens next. All 37 load in this repo's parser (`loadCase`, strict layer).

**What to give the agent.** The `cases/` folder only. `manifest.json` lists every case with its `case_dir` and `step` (the number of its last event).

**How to run this repo's agent on it.** The agent must see the whole history, the agency's own events included. Today that is the MCP tool `run_case` with `step` set to the case's last event:

```bash
CASES_DIR='evals/reality-sim/cases' OUT_DIR='runs/reality-sim' npm run --silent mcp
```

```json
{"name": "run_case", "arguments": {"case_id": "305", "step": 17}}
```

The CLI modes do not fit yet. A plain `run` shows the agent only the first two to four events of each case. `--to-end` replays the case with the agency's own events hidden, so the agent never sees the approvals, quotes and instructions these cases turn on. A CLI flag for "see everything, decide once" would make `run-all` usable here.

**How to score.** Read `ANSWERS/<id>/ANSWER.md` and `REASONING.md` and compare them with `labels/<id>.json`. A `critical` hit fails the case; otherwise check `required` or one of `acceptable` was met. No automatic scorer is included yet.

**Question sections.** 302, 303, 308 and 312 have a `## Question` in `index.md`. The current parser drops it, so the agent does not see the question.

## Rebuilding

```bash
python3 -I evals/reality-sim/tools/build.py        # needs data/public/Property Management linked, see the main README
python3 -I evals/reality-sim/tools/validate.py --all
```

`build.py` overwrites the 1xx and 2xx case folders and every label. It does not touch the 3xx case folders.

## Known limits

- The policy was derived from the same 50 public cases the 1xx cuts come from, so a high score on those shows little about unseen cases. The 2xx and 3xx cases are the better signal.
- The 3xx cases were written by a model from the cards and checked for format, not each read in full by a person.
- 208 has a deliberate gap in event numbers (events 019 and 020 removed).
