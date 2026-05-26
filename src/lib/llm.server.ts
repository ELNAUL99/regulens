// Server-only LLM + embedding clients for Mistral + Verda (DataCrunch).
// These run inside createServerFn handlers; do not import from client code.

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const MISTRAL_API_KEY = () => process.env.MISTRAL_API_KEY!;
const VERDA_API_KEY = () => process.env.VERDA_API_KEY!;
const VERDA_LLM_BASE_URL = () =>
  (process.env.VERDA_LLM_BASE_URL || "https://containers.datacrunch.io/llama-3-1-8b/").replace(/\/$/, "");
const VERDA_EMBED_BASE_URL = () =>
  (process.env.VERDA_EMBED_BASE_URL || "https://containers.datacrunch.io/bge-m3").replace(/\/$/, "");

/** Mistral chat completion — reasoning tier. Returns parsed JSON if response_format=json. */
export async function mistralChat(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  json?: boolean;
  max_tokens?: number;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model ?? "mistral-large-latest",
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.max_tokens ?? 4096,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mistral error ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Verda LLM (Llama-3.1-8B on DataCrunch, OpenAI-compatible). Used for extraction. */
export async function verdaChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: "meta-llama/Llama-3.1-8B-Instruct",
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.max_tokens ?? 2048,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(`${VERDA_LLM_BASE_URL()}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERDA_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Verda LLM error ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Verda embeddings (bge-m3, 1024-dim). Returns array of vectors aligned with inputs. */
export async function verdaEmbed(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const res = await fetch(`${VERDA_EMBED_BASE_URL()}/v1/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERDA_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "BAAI/bge-m3", input: inputs }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Verda embed error ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

/** Safely parse JSON from an LLM response, stripping ``` fences if present. */
export function safeJSONParse<T = unknown>(s: string): T | null {
  if (!s) return null;
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  // Find first { ... } block if surrounded by prose
  const m = t.match(/\{[\s\S]*\}$/);
  if (m) t = m[0];
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}