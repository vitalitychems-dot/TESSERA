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

function llmEndpoint(path: string): { url: string; apiKey: string } {
  const baseURL = process.env.TESSERA_LLM_BASE_URL?.replace(/\/$/, "");
  if (!baseURL) {
    throw new Error("TESSERA_LLM_BASE_URL not set");
  }
  const apiKey = process.env.TESSERA_LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TESSERA_LLM_API_KEY not set");
  }
  return { url: `${baseURL}${path}`, apiKey };
}

async function llmPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const { url, apiKey } = llmEndpoint(path);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
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
    messages: TesseraChatMessage[];
  },
  signal?: AbortSignal,
): Promise<TesseraChatCompletionResponse> {
  return llmPost<TesseraChatCompletionResponse>("/chat/completions", body, signal);
}

export function tesseraEmbeddings(
  body: { model: string; input: string | string[] },
  signal?: AbortSignal,
): Promise<TesseraEmbeddingResponse> {
  return llmPost<TesseraEmbeddingResponse>("/embeddings", body, signal);
}
