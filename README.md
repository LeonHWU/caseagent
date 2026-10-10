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

The tests read the public cases from `data/public/Property Management` (gitignored). Link them once:

```bash
git clone https://github.com/DwellyOrg/HackatonPublicCases.git ../HackatonPublicCases
mkdir -p data/public && ln -s "$(cd ../HackatonPublicCases && pwd)/Property Management" "data/public/Property Management"
```

### Attachments (optional Docling step)

The agent picks one form for each visible attachment, in this order:

1. **A PDF at or under `NATIVE_PDF_MAX_MB`** (default 5) **with at most 100 pages goes to Claude as the PDF itself.** Claude then reads its text and its page images, scanned pages included. All the native PDFs in one prompt share a 20 MB budget; when the budget runs out, the rest of the PDFs use text.
2. **Docling markdown** in `<case>/attachments/.docling/<file>.md`, when the file exists.
3. **The built-in readers.** These are pdf.js for PDF text, raw text for CSV, TXT and MD files, and image input for PNG and JPEG files.

[Docling](https://github.com/docling-project/docling) runs once, before the agent, and needs [uv](https://docs.astral.sh/uv/):

```bash
npm run extract -- <cases-dir>    # writes <case>/attachments/.docling/<file>.md
```

Docling keeps tables and headings as markdown and also reads `.docx`, `.xlsx`, `.pptx` and `.html` files. It runs OCR on scanned pages. On macOS it uses the system Vision engine through `ocrmac`; on other systems it uses RapidOCR. Re-runs skip files that are already converted. `scripts/extract.py.lock` pins every Python dependency, and uv ignores packages published after 2026-10-03.

- The first run installs Docling 2.132.0 and its models, about 4 GB in the uv cache.
- On the public data, all 28 PDF and CSV files convert in about 2 minutes, including the OCR setup.

### As an MCP server

`src/mcp.ts` serves the same agent over stdio, with four tools: `list_cases`, `run_case`, `resume_case` and `get_case`. `run_case`, `resume_case` and `get_case` take a case id such as `027`; `list_cases` takes no arguments. `run_case` and `resume_case` execute at most one business tool action per call (including a failed/refused action), even if the model requests multiple tools. The CLI retains its full-run behavior.

Both execution tools accept optional `step`, an inclusive history event number, for example `{ "case_id": "027", "step": 7 }`. `run_case` starts fresh with history through that event and replaces saved state. `resume_case` keeps previous actions and accepts the current or a later event; backward jumps are rejected. Without `step`, `run_case` uses the initial decision point; `resume_case` keeps the current event while status is `open`, or exposes the next external reply after a hold. Later events remain hidden. Calls return the status plus `ANSWER.md`; use `get_case` for `REASONING.md`. The server reads cases from `CASES_DIR` (default `data/public/Property Management`) and writes to `OUT_DIR` (default `runs/mcp`). Both paths are relative to the repo.

Add this entry to the MCP config of the client, for example `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "case-agent": {
      "command": "npm",
      "args": ["--prefix", "/absolute/path/to/case-agent", "run", "--silent", "mcp"]
    }
  }
}
```

Keep `--silent`. Without it, npm prints a banner to stdout and breaks the MCP protocol.

## Models, APIs and services

- Anthropic Claude (`claude-sonnet-5-5` by default; set `MODEL` to change it) through `@anthropic-ai/sdk`.
- Docling 2.132.0 (local, optional) converts attachments to markdown. pdf.js (`pdfjs-dist`) is the built-in fallback.
- No other external service. Messages and assignments go to the outbox in the case state.

## Assumptions

- The agent acts as the agency. After the first run it sees only events from outside parties; its own actions take the place of the agency's recorded events.
- The tools are simulated, because the event provides no live systems. Each tool is one entry in `src/tools.ts`, so a real API can replace it.

## Known limitations

- Attachment text is capped at 8,000 characters per file, so long inspection reports are cut.
- A native PDF costs about 4 to 7 times the tokens of its Docling markdown: 3.7k against 0.6k for a 2-page invoice, and 24k against 6k for a 12-page report. Lower `NATIVE_PDF_MAX_MB` to send more PDFs as text.
- OCR can misread characters, for example "0ZZ" as "OZZ" in a postcode.
- The agent sees time only through event timestamps, so "3 days without reply" works only when a later event shows the gap.

## Next steps

- An evaluation bench that replays the public cases event by event and grades each decision against the real history.
- Real adapters for email, SMS and the agency's job system.
