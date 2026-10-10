import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist";

// Set up the worker for pdfjs
const pdfjsWorkerPath = new URL("../node_modules/pdfjs-dist/build/pdf.worker.mjs", import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerPath.href;

const MAX_CHARS = 8000;
const TRUNCATION_NOTE = "\n\n[Text truncated due to length]";

export type AttachmentContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; format: "png" | "jpeg" }
  | { type: "error"; error: string };

function getCachePath(cacheDir: string, filename: string): string {
  return join(cacheDir, `${filename}.txt`);
}

async function extractPdfText(pdfPath: string): Promise<string> {
  const buffer = readFileSync(pdfPath);
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const texts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    texts.push(pageText);
  }

  return texts.join("\n");
}

function truncateText(text: string): string {
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS - TRUNCATION_NOTE.length) + TRUNCATION_NOTE;
  }
  return text;
}

export async function readAttachment(caseDir: string, filename: string, cacheDir: string): Promise<AttachmentContent> {
  const filepath = join(caseDir, "attachments", filename);

  try {
    const ext = filename.split(".").pop()?.toLowerCase();

    // Check if it's already cached (for PDFs)
    if (ext === "pdf") {
      const cachePath = getCachePath(cacheDir, filename);
      if (existsSync(cachePath)) {
        const cached = readFileSync(cachePath, "utf8");
        return { type: "text", text: cached };
      }
    }

    // Handle different file types
    if (ext === "pdf") {
      const text = await extractPdfText(filepath);
      const truncated = truncateText(text);
      // Cache the extracted text
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(getCachePath(cacheDir, filename), truncated, "utf8");
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
