# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["docling==2.132.0"]
# ///
"""Convert every case attachment to markdown with Docling, once, before the agent runs.

Usage: uv run scripts/extract.py <cases-dir> [<cases-dir> ...]

Writes <case>/attachments/.docling/<file>.md. The agent reads that file when it exists
and falls back to its built-in readers when it does not, so this step is optional.
Images are skipped: the agent sends them to Claude as images.
"""

import sys
from pathlib import Path

from docling.document_converter import DocumentConverter

FORMATS = {".pdf", ".csv", ".docx", ".xlsx", ".pptx", ".html", ".htm"}

todo = [
    f
    for root in sys.argv[1:]
    for f in sorted(Path(root).glob("*/attachments/*"))
    if f.suffix.lower() in FORMATS and not (f.parent / ".docling" / f"{f.name}.md").exists()
]
if not todo:
    print("nothing to convert")
    sys.exit(0)

ok = 0
for result in DocumentConverter().convert_all(todo, raises_on_error=False):
    src = Path(result.input.file)
    if result.document is None or result.status.name not in ("SUCCESS", "PARTIAL_SUCCESS"):
        print(f"FAILED {src}: {result.status.name}", file=sys.stderr)
        continue
    out = src.parent / ".docling" / f"{src.name}.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text(result.document.export_to_markdown())
    ok += 1
print(f"converted {ok}/{len(todo)}")
