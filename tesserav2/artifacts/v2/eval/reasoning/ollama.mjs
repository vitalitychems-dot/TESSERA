/**
 * Same Ollama path as OllamaAdapter in
 * artifacts/api-server/src/lib/local-model-manager.ts:
 *   OLLAMA_ENDPOINT (default http://localhost:11434)
 *   GET  /api/tags
 *   POST /api/chat  { model, messages, stream:false, options.num_predict, options.temperature }
 * Preferred names match that manager's ollama preferredModels.
 * Eval calls pass temperature 0. The chat adapter's own default stays 0.7.
 */

export const PREFERRED_MODELS = ["llama3.2:3b", "llama3.2:1b", "mistral:7b", "phi3:mini"];

export function ollamaEndpoint(env = process.env) {
  return String(env.OLLAMA_ENDPOINT || "http://localhost:11434").replace(/\/$/, "");
}

export async function probeOllama(fetchImpl, endpoint) {
  try {
    const response = await fetchImpl(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, models: [], status: response.status };
    const data = await response.json();
    const models = Array.isArray(data?.models)
      ? data.models.map((row) => row?.name).filter((name) => typeof name === "string" && name.length > 0)
      : [];
    return { ok: true, models };
  } catch (error) {
    return { ok: false, models: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export function chooseModel(models, requested) {
  if (requested) return models.includes(requested) ? requested : null;
  for (const name of PREFERRED_MODELS) {
    if (models.includes(name)) return name;
  }
  return models[0] ?? null;
}

export async function chatOllama(fetchImpl, endpoint, model, content, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const response = await fetchImpl(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      stream: false,
      options: {
        num_predict: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Ollama chat failed: ${response.status}`);
  }
  const data = await response.json();
  return data?.message?.content ?? "";
}
