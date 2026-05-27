// Server-side URL fetcher: turns a pasted http(s) URL into the same kind of
// extracted text the client-side PDF upload would produce. Lets users paste
// a vendor case-study URL and have the council reason about the actual
// document, not just the URL string.
//
// Safety:
// - http/https only (no file://, no chrome://, no data:)
// - Block private network targets so a hostile prompt can't be used for SSRF
//   against localhost / link-local / RFC1918 / IMDS.
// - Hard byte cap (matches the client MAX_FILE_BYTES) and a 15s fetch timeout.
// - Content-type whitelist: PDF, plain text, markdown, HTML.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_EXTRACTED_CHARS = 60_000;

// IPv4 literal / hostname patterns we refuse to fetch.
const PRIVATE_HOST = /^(?:localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?|\[?fc00:|\[?fd[0-9a-f]{2}:)/i;

function isSafeUrl(u: URL): boolean {
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) return false;
  if (PRIVATE_HOST.test(u.hostname)) return false;
  return true;
}

/** Find http(s) URLs in a free-text submission. Crude but covers vendor case-study links. */
export function findUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)<>"'\]]+/gi);
  // Trim common trailing punctuation that often clings to URLs.
  const cleaned = (matches ?? []).map((u) => u.replace(/[.,;:!?)]+$/, ""));
  return Array.from(new Set(cleaned));
}

export type FetchResult =
  | { ok: true; url: string; text: string; bytes: number; contentType: string }
  | { ok: false; url: string; reason: string };

export async function fetchAndExtract(rawUrl: string): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, url: rawUrl, reason: "invalid URL" };
  }
  if (!isSafeUrl(url)) {
    return { ok: false, url: rawUrl, reason: "URL not allowed (must be public http/https)" };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "ReguLens/1.0 (EU AI Act compliance triage)",
        Accept: "application/pdf,text/html,text/plain,text/markdown,*/*;q=0.5",
      },
    });
    if (!res.ok) return { ok: false, url: rawUrl, reason: `HTTP ${res.status}` };

    const lenHeader = res.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > MAX_BYTES) {
      return { ok: false, url: rawUrl, reason: `response too large (${lenHeader} bytes)` };
    }

    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return { ok: false, url: rawUrl, reason: "response too large" };
    }

    if (ct.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf")) {
      const text = await extractPdfText(buf);
      return { ok: true, url: rawUrl, text, bytes: buf.byteLength, contentType: "application/pdf" };
    }
    if (ct.startsWith("text/html")) {
      const text = stripHtml(new TextDecoder().decode(buf));
      return { ok: true, url: rawUrl, text, bytes: buf.byteLength, contentType: "text/html" };
    }
    if (ct.startsWith("text/")) {
      return {
        ok: true,
        url: rawUrl,
        text: new TextDecoder().decode(buf).slice(0, MAX_EXTRACTED_CHARS),
        bytes: buf.byteLength,
        contentType: ct,
      };
    }
    return { ok: false, url: rawUrl, reason: `unsupported content type: ${ct || "unknown"}` };
  } catch (err) {
    return {
      ok: false,
      url: rawUrl,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(t);
  }
}

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  // `unpdf` is a Node/serverless-friendly wrapper around pdfjs that handles
  // the GlobalWorkerOptions / no-Worker dance for us. pdfjs-dist itself does
  // not work cleanly in Node — it requires a Web Worker.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const joined = Array.isArray(text) ? text.join("\n\n") : text;
  return joined.slice(0, MAX_EXTRACTED_CHARS);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}
