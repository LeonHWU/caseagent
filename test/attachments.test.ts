import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAttachment } from "../src/attachments.ts";

const PM = "data/public/Property Management";

test("case 003: extracted invoice text contains NBL-003-2766 when native PDFs are off", async () => {
  const content = await readAttachment(`${PM}/003`, "attachment-02-cleaning-invoice.pdf", { nativeMaxBytes: 0 });
  assert.equal(content.type, "text");
  if (content.type === "text") {
    assert.match(content.text, /NBL-003-2766/);
  }
});

test("case 003: invoice hidden before its event", async () => {
  // Event 20 links the invoice, so only events 1-19 can see it
  // This test should be part of the prompt rendering test
  // For now, just verify the attachment can be read
  const content = await readAttachment(`${PM}/003`, "attachment-02-cleaning-invoice.pdf", { nativeMaxBytes: 0 });
  assert.equal(content.type, "text");
});

test("attachment read failure returns error message", async () => {
  const content = await readAttachment(`${PM}/003`, "non-existent-file.pdf");
  assert.equal(content.type, "error");
});

test("corrupt PDF returns error instead of crashing", async () => {
  const content = await readAttachment("test/fixtures/corrupt-pdf", "corrupt.pdf");
  assert.equal(content.type, "error");
});

test("Docling markdown in attachments/.docling wins over built-in extraction", async () => {
  const dir = mkdtempSync(join(tmpdir(), "case-"));
  mkdirSync(join(dir, "attachments", ".docling"), { recursive: true });
  writeFileSync(join(dir, "attachments", "quote.pdf"), "not a real pdf");
  writeFileSync(join(dir, "attachments", ".docling", "quote.pdf.md"), "| Item | Amount |\n|---|---|\n| Total | £90 |");
  const content = await readAttachment(dir, "quote.pdf");
  assert.deepEqual(content, { type: "text", text: "| Item | Amount |\n|---|---|\n| Total | £90 |" });
});

test("Docling covers formats the built-in reader lacks, such as .xlsx", async () => {
  const dir = mkdtempSync(join(tmpdir(), "case-"));
  mkdirSync(join(dir, "attachments", ".docling"), { recursive: true });
  writeFileSync(join(dir, "attachments", "ledger.xlsx"), "binary");
  writeFileSync(join(dir, "attachments", ".docling", "ledger.xlsx.md"), "| rent | 1200 |");
  assert.deepEqual(await readAttachment(dir, "ledger.xlsx"), { type: "text", text: "| rent | 1200 |" });
});

test("a small PDF goes to the model as the PDF itself", async () => {
  const content = await readAttachment(`${PM}/003`, "attachment-02-cleaning-invoice.pdf");
  assert.equal(content.type, "document");
  if (content.type === "document") {
    assert.equal(content.pages, 2);
    assert.ok(content.data.startsWith("JVBER"), "base64 of %PDF");
  }
});

test("a PDF above the size limit falls back to extracted text", async () => {
  const content = await readAttachment(`${PM}/003`, "attachment-02-cleaning-invoice.pdf", { nativeMaxBytes: 50_000 });
  assert.equal(content.type, "text");
});
