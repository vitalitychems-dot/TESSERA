export interface PenChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PenChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface PenEmbeddingItem {
  index?: number;
  embedding?: number[];
}

export interface PenEmbeddingResponse {
  data?: PenEmbeddingItem[];
}

function penEndpoint(path: string): { url: string; apiKey: string } {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "_DUMMY_API_KEY_";
  if (!baseURL) {
    throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL not set");
  }
  return { url: `${baseURL}${path}`, apiKey };
}

async function penPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const { url, apiKey } = penEndpoint(path);
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
    throw new Error(`Pen provider request failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

export function penChatCompletion(
  body: {
    model: string;
    max_completion_tokens: number;
    messages: PenChatMessage[];
  },
  signal?: AbortSignal,
): Promise<PenChatCompletionResponse> {
  return penPost<PenChatCompletionResponse>("/chat/completions", body, signal);
}

export function penEmbeddings(
  body: { model: string; input: string | string[] },
  signal?: AbortSignal,
): Promise<PenEmbeddingResponse> {
  return penPost<PenEmbeddingResponse>("/embeddings", body, signal);
}
