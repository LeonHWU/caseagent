"""Check that a practice case has the public-case shape and leaks no outcome.

Usage (from the repo root):
    python3 -I evals/reality-sim/tools/validate.py <id> [<id> ...]
    python3 -I evals/reality-sim/tools/validate.py --all
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "cases"
WORK = json.loads((ROOT / "worklist.json").read_text())
CARDS = {c["id"]: c for c in WORK["tier_c"]}
ALL_IDS = [x["id"] for t in ("tier_a", "tier_b", "tier_c") for x in WORK[t]]
CHANNELS = {"Note", "Update", "Hold", "Email", "SMS", "Call"}
HEAD_RE = re.compile(r'<a id="event-(\d{3})"></a>\n## (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) UTC — event (\d{3})\n\n- \*\*Channel:\*\* (.+)\n- \*\*From:\*\* (.+)\n- \*\*To:\*\* (.+)\n')


def check(case_id: str) -> list[str]:
    errs = []
    d = CASES / case_id
    if not (d / "index.md").exists() or not (d / "history.md").exists():
        return ["index.md or history.md is missing"]
    index = (d / "index.md").read_text()
    history = (d / "history.md").read_text()

    if not re.match(rf"# Case {case_id}: \S", index):
        errs.append(f"index.md must start with '# Case {case_id}: <title>'")
    for section in ("## Case details", "## Initial request", "## History", "## Attachments"):
        if section not in index:
            errs.append(f"index.md is missing '{section}'")
    for banned in ("## Overview", "## Outcome", "**Updated:**", "**Completed:**", "**Status:** Completed"):
        if banned in index:
            errs.append(f"index.md must not contain '{banned}'")
    if "(history.md)" not in index:
        errs.append("index.md must link to history.md")
    card = CARDS.get(case_id)
    if card:
        if card.get("question_section") and "## Question" not in index:
            errs.append("index.md needs a '## Question' section (card has a question)")
        if not card.get("question_section") and "## Question" in index:
            errs.append("index.md must not have a '## Question' section (card has none)")

    if not history.startswith(f"# Case {case_id} history\n"):
        errs.append(f"history.md must start with '# Case {case_id} history'")
    heads = list(HEAD_RE.finditer(history))
    anchors = re.findall(r'<a id="event-(\d+)"></a>', history)
    if len(heads) != len(anchors):
        errs.append(f"{len(anchors)} event anchors but only {len(heads)} well-formed event headers (check heading, em dash and the three bullets)")
    total = re.search(r"^Total events: (\d+)$", history, re.M)
    if not total or int(total.group(1)) != len(anchors):
        errs.append(f"'Total events:' line must equal the number of events ({len(anchors)})")
    prev_n, prev_ts = 0, None
    for h in heads:
        n, ts = int(h.group(1)), datetime.strptime(h.group(2), "%Y-%m-%d %H:%M:%S")
        if h.group(1) != h.group(3):
            errs.append(f"event {h.group(1)}: anchor and heading numbers differ")
        if n <= prev_n:
            errs.append(f"event {n:03d}: numbers must increase")
        # Tier B may delete events on purpose; tiers A and C must be consecutive.
        if not case_id.startswith("2") and n != prev_n + 1:
            errs.append(f"event {n:03d}: numbers must be consecutive")
        if case_id.startswith("3") and prev_ts and ts < prev_ts:
            errs.append(f"event {n:03d}: timestamp goes backwards")
        if h.group(4).strip() not in CHANNELS:
            errs.append(f"event {n:03d}: unknown channel '{h.group(4)}'")
        prev_n, prev_ts = n, ts
    if card and heads:
        want = card["length_events"]
        if abs(len(heads) - want) > max(2, round(want * 0.15)):
            errs.append(f"{len(heads)} events; the card asks for about {want}")

    for link in re.findall(r"\]\((attachments/[^)]+)\)", index + history):
        if not (d / link).exists():
            errs.append(f"linked attachment does not exist: {link}")
    if (d / "attachments").exists():
        linked = set(re.findall(r"\]\(attachments/([^)]+)\)", index))
        for f in (d / "attachments").iterdir():
            if f.name not in linked:
                errs.append(f"attachment not listed in index.md: {f.name}")
    return errs


def main():
    ids = ALL_IDS if sys.argv[1:] == ["--all"] else sys.argv[1:]
    if not ids:
        raise SystemExit(__doc__)
    bad = 0
    for i in ids:
        errs = check(i)
        bad += bool(errs)
        print(f"{i}: {'OK' if not errs else 'FAIL'}")
        for e in errs:
            print(f"   - {e}")
    print(f"{len(ids) - bad}/{len(ids)} passed")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
