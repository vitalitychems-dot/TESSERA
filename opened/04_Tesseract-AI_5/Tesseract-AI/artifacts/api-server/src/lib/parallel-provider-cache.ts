import { providerRegistry, type ProviderConfig } from "./provider-registry";
import { runInSandbox } from "./external-call-sandbox";
import { logExternalCall } from "./external-call-logger";

const LOG_PREFIX = "[ParallelProvider]";

interface CacheEntry {
  key: string;
  response: string;
  timestamp: number;
  model: string;
  hitCount: number;
}

interface ParallelQueryResult {
  providerId: string;
  model: string;
  response: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

interface ParallelQuerySummary {
  results: ParallelQueryResult[];
  fastest: ParallelQueryResult | null;
  bestResponse: string;
  totalTimeMs: number;
  fromCache: boolean;
  cacheKey?: string;
}

const responseCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 500;
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;

let cacheHits = 0;
let cacheMisses = 0;
let parallelQueryCount = 0;
let totalResponsesGenerated = 0;

function computeCacheKey(prompt: string, model?: string): string {
  const normalized = prompt.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 500);
  return `${model ?? "any"}:${Buffer.from(normalized).toString("base64").slice(0, 64)}`;
}

function getFromCache(key: string, ttlMs: number = DEFAULT_CACHE_TTL_MS): string | null {
  const entry = responseCache.get(key);
  if (!entry) { cacheMisses++; return null; }
  if (Date.now() - entry.timestamp > ttlMs) {
    responseCache.delete(key);
    cacheMisses++;
    return null;
  }
  entry.hitCount++;
  cacheHits++;
  return entry.response;
}

function setCache(key: string, response: string, model: string): void {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldest = Array.from(responseCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 50)
      .map(e => e[0]);
    oldest.forEach(k => responseCache.delete(k));
  }
  responseCache.set(key, { key, response, timestamp: Date.now(), model, hitCount: 0 });
}

async function queryProvider(config: ProviderConfig, prompt: string, maxTokens: number): Promise<ParallelQueryResult> {
  const start = Date.now();
  const requestPayload = config.type === "ollama"
    ? { model: config.model, prompt: prompt.slice(0, 500), stream: false, options: { num_predict: maxTokens } }
    : { model: config.model, messages: [{ role: "user", content: prompt.slice(0, 500) }], max_tokens: maxTokens };

  const sandboxResult = await runInSandbox({
    providerId: config.id,
    providerType: "llm",
    taskType: "general",
    payload: requestPayload,
    fn: async (sanitized) => {
      const s = sanitized as Record<string, unknown>;
      const safeModel = typeof s.model === "string" ? s.model : config.model;
      const safePrompt = Array.isArray((s.messages as Array<unknown>)?.[0])
        ? (s.messages as Array<Record<string, unknown>>)[0]?.content as string ?? prompt
        : typeof s.prompt === "string" ? s.prompt : prompt;

      if (config.type === "ollama") {
        const resp = await fetch(`${config.endpoint}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: safeModel, prompt: safePrompt, stream: false, options: { num_predict: maxTokens } }),
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
        const data = await resp.json() as { response: string };
        return { response: data.response || "", choices: null };
      }

      const apiKey = config.apiKeyEnvVar ? process.env[config.apiKeyEnvVar] : undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      const resp = await fetch(`${config.endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: safeModel, messages: [{ role: "user", content: safePrompt }], max_tokens: maxTokens }),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
      return { response: data.choices?.[0]?.message?.content ?? "", choices: data.choices };
    },
  });

  const latencyMs = Date.now() - start;

  if (!sandboxResult.success || sandboxResult.blocked) {
    logExternalCall({
      providerId: config.id,
      providerType: "llm",
      taskType: "general",
      requestPayload,
      latencyMs,
      success: false,
      errorMessage: sandboxResult.blocked ?? sandboxResult.error,
      metadata: { source: "parallel-provider-cache", model: config.model, blocked: Boolean(sandboxResult.blocked) },
    });
    return { providerId: config.id, model: config.model, response: "", latencyMs, success: false, error: sandboxResult.blocked ?? sandboxResult.error };
  }

  const responseText = sandboxResult.data?.response ?? "";
  logExternalCall({
    providerId: config.id,
    providerType: "llm",
    taskType: "general",
    requestPayload,
    responsePayload: { response: responseText.slice(0, 1000) },
    responseText: responseText.slice(0, 2000),
    latencyMs,
    success: true,
    metadata: { source: "parallel-provider-cache", model: config.model },
  });
  return { providerId: config.id, model: config.model, response: responseText, latencyMs, success: true };
}

export async function queryProvidersParallel(options: {
  prompt: string;
  maxTokens?: number;
  useCache?: boolean;
  cacheTtlMs?: number;
  providerIds?: string[];
  selectBest?: boolean;
}): Promise<ParallelQuerySummary> {
  parallelQueryCount++;
  const start = Date.now();
  const maxTokens = options.maxTokens ?? 512;
  const useCache = options.useCache ?? true;

  const cacheKey = computeCacheKey(options.prompt);
  if (useCache) {
    const cached = getFromCache(cacheKey, options.cacheTtlMs);
    if (cached) {
      console.log(`${LOG_PREFIX} Cache hit for query #${parallelQueryCount}`);
      return {
        results: [],
        fastest: null,
        bestResponse: cached,
        totalTimeMs: 0,
        fromCache: true,
        cacheKey,
      };
    }
  }

  const providers = options.providerIds
    ? options.providerIds.map(id => providerRegistry.getById(id)).filter(Boolean) as ProviderConfig[]
    : providerRegistry.getAll();

  if (providers.length === 0) {
    return { results: [], fastest: null, bestResponse: "", totalTimeMs: 0, fromCache: false };
  }

  const queryPromises = providers.map(p => queryProvider(p, options.prompt, maxTokens));
  const results = await Promise.allSettled(queryPromises);

  const resolved: ParallelQueryResult[] = results
    .map(r => r.status === "fulfilled" ? r.value : null)
    .filter(Boolean) as ParallelQueryResult[];

  const successful = resolved.filter(r => r.success && r.response.length > 0);
  totalResponsesGenerated += successful.length;

  const fastest = successful.length > 0
    ? successful.reduce((a, b) => a.latencyMs < b.latencyMs ? a : b)
    : null;

  let bestResponse = "";

  if (options.selectBest && successful.length > 1) {
    const scored = successful.map(r => {
      const profile = providerRegistry.getProfile(r.providerId);
      const score = (profile?.overallScore ?? 50) + (r.response.length > 200 ? 10 : 0) - r.latencyMs / 1000;
      return { result: r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    bestResponse = scored[0]?.result.response ?? "";
  } else {
    bestResponse = fastest?.response ?? successful[0]?.response ?? "";
  }

  if (useCache && bestResponse) {
    setCache(cacheKey, bestResponse, fastest?.model ?? "");
  }

  console.log(`${LOG_PREFIX} Parallel query #${parallelQueryCount}: ${successful.length}/${providers.length} providers succeeded, fastest: ${fastest?.latencyMs ?? 0}ms`);

  return {
    results: resolved,
    fastest,
    bestResponse,
    totalTimeMs: Date.now() - start,
    fromCache: false,
    cacheKey,
  };
}

export function clearCache(pattern?: string): number {
  if (!pattern) {
    const count = responseCache.size;
    responseCache.clear();
    return count;
  }
  let count = 0;
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) {
      responseCache.delete(key);
      count++;
    }
  }
  return count;
}

export function getCacheStats() {
  const entries = Array.from(responseCache.values());
  const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0);
  const hitRate = (cacheHits + cacheMisses) > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

  return {
    size: responseCache.size,
    maxSize: MAX_CACHE_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: Math.round(hitRate * 100),
    totalEntryHits: totalHits,
    parallelQueryCount,
    totalResponsesGenerated,
    ttlMs: DEFAULT_CACHE_TTL_MS,
  };
}

export function getParallelProviderStatus() {
  return {
    cacheStats: getCacheStats(),
    providerCount: providerRegistry.getAll().length,
    parallelQueryCount,
  };
}
