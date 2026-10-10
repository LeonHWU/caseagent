import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
// The legacy build carries polyfills (Promise.try, Uint8Array.toHex, ...) that the modern build
// assumes from Node 24+. On Node 22 the modern build crashes the process on any PDF.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Set up the worker for pdfjs
const pdfjsWorkerPath = new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerPath.href;

const MAX_CHARS = 8000;
const TRUNCATION_NOTE = "\n\n[Text truncated due to length]";

// Small PDFs go to Claude as the PDF itself, so it sees the layout, tables and any scanned pages.
// Larger ones fall back to extracted text. The page limit is the Messages API limit for PDF input.
export const NATIVE_PDF_MAX_BYTES = Number(process.env.NATIVE_PDF_MAX_MB ?? 5) * 1024 * 1024;
const NATIVE_PDF_MAX_PAGES = 100;

export type AttachmentContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; format: "png" | "jpeg" }
  | { type: "document"; data: string; pages: number }
  | { type: "error"; error: string };

async function nativePdf(path: string, maxBytes: number): Promise<AttachmentContent | null> {
  if (statSync(path).size > maxBytes) return null;
  const data = readFileSync(path);
  try {
    const { numPages } = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
    return numPages <= NATIVE_PDF_MAX_PAGES ? { type: "document", data: data.toString("base64"), pages: numPages } : null;
  } catch {
    return null;
  }
}

// Extracted text is cached per file modification time, so resumes of the same case do not parse
// the same PDF again.
const pdfTextCache = new Map<string, { mtimeMs: number; text: string }>();

async function extractPdfText(pdfPath: string): Promise<string> {
  const { mtimeMs } = statSync(pdfPath);
  const hit = pdfTextCache.get(pdfPath);
  if (hit && hit.mtimeMs === mtimeMs) return hit.text;

  const buffer = readFileSync(pdfPath);
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const texts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    texts.push(pageText);
  }

  const text = texts.join("\n");
  pdfTextCache.set(pdfPath, { mtimeMs, text });
  return text;
}

function truncateText(text: string): string {
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS - TRUNCATION_NOTE.length) + TRUNCATION_NOTE;
  }
  return text;
}

export async function readAttachment(
  caseDir: string,
  filename: string,
  opts: { nativeMaxBytes?: number } = {},
): Promise<AttachmentContent> {
  const filepath = join(caseDir, "attachments", filename);

  try {
    if (filename.toLowerCase().endsWith(".pdf")) {
      const native = await nativePdf(filepath, opts.nativeMaxBytes ?? NATIVE_PDF_MAX_BYTES);
      if (native) return native;
    }

    // `npm run extract` (Docling) writes structured markdown here; it beats the built-in readers when present.
    const docling = join(caseDir, "attachments", ".docling", `${filename}.md`);
    if (existsSync(docling)) return { type: "text", text: truncateText(readFileSync(docling, "utf8")) };

    const ext = filename.split(".").pop()?.toLowerCase();

    // Handle different file types
    if (ext === "pdf") {
      const text = await extractPdfText(filepath);
      const truncated = truncateText(text);
      return { type: "text", text: truncated };
    } else if (ext === "txt" || ext === "csv" || ext === "md") {
      const text = readFileSync(filepath, "utf8");
      const truncated = truncateText(text);
      return { type: "text", text: truncated };
    } else if (ext === "png") {
      const data = readFileSync(filepath).toString("base64");
      return { type: "image", data, format: "png" };
    } else if (ext === "jpg" || ext === "jpeg") {
      const data = readFileSync(filepath).toString("base64");
      return { type: "image", data, format: "jpeg" };
    } else {
      return { type: "error", error: `Unsupported file type: .${ext}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: "error", error: message };
  }
}
