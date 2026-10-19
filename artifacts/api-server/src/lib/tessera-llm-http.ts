export interface TesseraChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TesseraChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface TesseraEmbeddingItem {
  index?: number;
  embedding?: number[];
}

export interface TesseraEmbeddingResponse {
  data?: TesseraEmbeddingItem[];
}

export function resolveTesseraLlmModel(explicit?: string): string {
  const model = explicit?.trim() || process.env.TESSERA_LLM_MODEL?.trim();
  if (!model) {
    throw new Error("TESSERA_LLM_MODEL not set");
  }
  return model;
}

/** Same kill switch as `isLLMAvailable`. Default on. Does not echo configuration. */
export function isSovereignNoExternalLlm(env: NodeJS.ProcessEnv = process.env): boolean {
  const killed = (env.SOVEREIGN_NO_EXTERNAL_LLM ?? "1").trim();
  return killed === "1" || killed.toLowerCase() === "true";
}

export const CHAT_LLM_URL_REFUSED = "Chat language model URL was refused.";

export type ChatLlmUrlDecision =
  | { ok: true; href: string }
  | { ok: false; code: "missing" | "refused" };

/**
 * Chat and embeddings may call only the written literals 127.0.0.1 and [::1].
 * localhost is not trusted. http and https only. No userinfo.
 * When SOVEREIGN_NO_EXTERNAL_LLM is set, a non-loopback URL is refused.
 * Both stay loopback-only when that guard is off. Failures are generic.
 */
export function decideChatLlmBaseUrl(
  raw: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ChatLlmUrlDecision {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { ok: false, code: "missing" };
  const loopback = classifyChatLoopbackBase(trimmed);
  if (loopback.ok) return loopback;
  return { ok: false, code: "refused" };
}

export function resolveChatLlmBaseUrl(
  raw: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const decision = decideChatLlmBaseUrl(raw, env);
  if (!decision.ok) {
    if (decision.code === "missing") throw new Error("TESSERA_LLM_BASE_URL not set");
    throw new Error(CHAT_LLM_URL_REFUSED);
  }
  return decision.href;
}

/** Null when the chat base URL is missing or refused. Never returns the raw value. */
export function acceptedChatLlmBaseUrl(
  raw: string | undefined = process.env.TESSERA_LLM_BASE_URL,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const decision = decideChatLlmBaseUrl(raw, env);
  return decision.ok ? decision.href : null;
}

export function isChatRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function classifyChatLoopbackBase(raw: string): { ok: true; href: string } | { ok: false } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
  if (url.username !== "" || url.password !== "") return { ok: false };
  if (!isLiteralLoopback(raw, url)) return { ok: false };
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const href = url.href.replace(/\/$/, "");
  return { ok: true, href };
}

function isLiteralLoopback(raw: string, url: URL): boolean {
  const match = /^https?:\/\/([^/?#]*)/i.exec(raw.trim());
  const authority = match?.[1];
  if (!authority || authority.includes("@") || authority.includes("\\")) return false;
  if (/^127\.0\.0\.1(?::\d+)?$/.test(authority)) return url.hostname === "127.0.0.1";
  if (/^\[::1\](?::\d+)?$/i.test(authority)) {
    return url.hostname.replace(/^\[|\]$/g, "").toLowerCase() === "::1";
  }
  return false;
}

function llmEndpoint(path: string): { url: string; apiKey: string } {
  const baseURL = resolveChatLlmBaseUrl(process.env.TESSERA_LLM_BASE_URL);
  const apiKey = process.env.TESSERA_LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TESSERA_LLM_API_KEY not set");
  }
  return { url: `${baseURL}${path}`, apiKey };
}

async function llmPost<T>(
  resolveEndpoint: () => { url: string; apiKey: string },
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<T> {
  const endpoint = resolveEndpoint();
  const response = await fetch(endpoint.url, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${endpoint.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (response.redirected || isChatRedirectStatus(response.status) || response.type === "opaqueredirect") {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(CHAT_LLM_URL_REFUSED);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Tessera LLM request failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

export function tesseraChatCompletion(
  body: {
    model: string;
    max_completion_tokens: number;
    temperature?: number;
    stream?: boolean;
    messages: TesseraChatMessage[];
  },
  signal?: AbortSignal,
): Promise<TesseraChatCompletionResponse> {
  return llmPost<TesseraChatCompletionResponse>(() => llmEndpoint("/chat/completions"), body, signal);
}

export function tesseraEmbeddings(
  body: { model: string; input: string | string[] },
  signal?: AbortSignal,
): Promise<TesseraEmbeddingResponse> {
  return llmPost<TesseraEmbeddingResponse>(() => llmEndpoint("/embeddings"), body, signal);
}
