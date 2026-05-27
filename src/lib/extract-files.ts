export const ACCEPTED_EXTS = [".pdf", ".doc", ".docx", ".md", ".markdown", ".txt"];
export const ACCEPT_ATTR =
  ".pdf,.doc,.docx,.md,.markdown,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 60_000;
const MAX_PDF_PAGES_EXTRACTED = 15;
const PDF_PAGE_BATCH_SIZE = 2;
const PDF_EXTRACTION_BUDGET_MS = 25_000;

let pdfWorker: Worker | null = null;
let pdfModulePromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfModule() {
  const pdfjs = await (pdfModulePromise ??= import("pdfjs-dist"));
  if (!pdfWorker) {
    const { default: PdfWorker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?worker");
    pdfWorker = new PdfWorker();
    pdfjs.GlobalWorkerOptions.workerPort = pdfWorker;
  }
  return pdfjs;
}

export function warmPdfTextExtraction() {
  void getPdfModule().catch(() => {
    pdfModulePromise = null;
  });
}

function pdfPagesToRead(totalPages: number) {
  if (totalPages <= MAX_PDF_PAGES_EXTRACTED) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const headPages = Math.ceil(MAX_PDF_PAGES_EXTRACTED * 0.75);
  const tailPages = MAX_PDF_PAGES_EXTRACTED - headPages;
  const pages = new Set<number>();
  for (let page = 1; page <= headPages; page += 1) pages.add(page);
  for (let page = totalPages - tailPages + 1; page <= totalPages; page += 1) pages.add(page);
  return Array.from(pages).sort((a, b) => a - b);
}

function timedOut(startedAt: number) {
  return performance.now() - startedAt > PDF_EXTRACTION_BUDGET_MS;
}

function trimForAssessment(text: string) {
  return text.length > MAX_EXTRACTED_CHARS ? text.slice(0, MAX_EXTRACTED_CHARS) : text;
}

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export async function extractFileText(file: File): Promise<string> {
  const ext = extOf(file.name);
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    return trimForAssessment(await file.text());
  }
  if (ext === ".docx" || ext === ".doc") {
    const { default: mammoth } = await import("mammoth");
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return trimForAssessment(value);
  }
  if (ext === ".pdf") {
    const startedAt = performance.now();
    const log = (label: string) =>
      console.log(`[pdf:${file.name}] ${label} ${Math.round(performance.now() - startedAt)}ms`);

    log("start");
    const pdfjs = await getPdfModule();
    log("module ready");
    const buf = await file.arrayBuffer();
    log(`arraybuffer (${buf.byteLength} bytes)`);
    const pdf = await pdfjs.getDocument({
      data: buf,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
    log(`document loaded (${pdf.numPages} pages)`);
    const pagesToRead = pdfPagesToRead(pdf.numPages);
    const parts: string[] = [];
    let chars = 0;
    try {
      for (
        let start = 0;
        start < pagesToRead.length && chars < MAX_EXTRACTED_CHARS;
        start += PDF_PAGE_BATCH_SIZE
      ) {
        if (timedOut(startedAt)) break;
        const pageNumbers = pagesToRead.slice(start, start + PDF_PAGE_BATCH_SIZE);
        const pageTexts = await Promise.all(
          pageNumbers.map(async (pageNumber) => {
            const page = await pdf.getPage(pageNumber);
            try {
              const content = await page.getTextContent();
              return content.items
                .map((it) => ("str" in it ? (it as { str: string }).str : ""))
                .join(" ");
            } finally {
              page.cleanup();
            }
          }),
        );
        for (const pageText of pageTexts) {
          if (chars >= MAX_EXTRACTED_CHARS) break;
          const remaining = MAX_EXTRACTED_CHARS - chars;
          const text = pageText.slice(0, remaining);
          parts.push(text);
          chars += text.length;
        }
      }
    } finally {
      await pdf.destroy();
    }
    log(`extraction done (${parts.join("\n\n").length} chars)`);
    return parts.join("\n\n");
  }
  throw new Error(`Unsupported file type: ${file.name}`);
}

export function isAcceptedFile(file: File) {
  return ACCEPTED_EXTS.includes(extOf(file.name));
}
