import OpenAI from "openai";
import { logger } from "./logger";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "_DUMMY_API_KEY_";
    if (!baseURL) {
      throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL not set");
    }
    _client = new OpenAI({ baseURL, apiKey });
  }
  return _client;
}

const EMBEDDING_DIM = 256;
const MAX_BATCH_SIZE = 20;

const embeddingCache = new Map<string, { vec: number[]; ts: number }>();
const EMBEDDING_CACHE_TTL = 300_000;

function hashText(text: string): string {
  let h = 0;
  const t = text.slice(0, 500).toLowerCase().trim();
  for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
  return `emb-${Math.abs(h).toString(36)}`;
}

function localFallbackEmbedding(text: string): number[] {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const vec = new Array(EMBEDDING_DIM).fill(0);
  for (let i = 0; i < tokens.length; i++) {
    let h = 0;
    for (let j = 0; j < tokens[i].length; j++) h = ((h << 5) - h + tokens[i].charCodeAt(j)) | 0;
    const idx = Math.abs(h) % EMBEDDING_DIM;
    vec[idx] += 1 / tokens.length;
    vec[(idx + 1) % EMBEDDING_DIM] += 0.5 / tokens.length;
    vec[(idx + 2) % EMBEDDING_DIM] += 0.25 / tokens.length;
  }
  const mag = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
  if (mag > 0) for (let i = 0; i < vec.length; i++) vec[i] /= mag;
  return vec;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const key = hashText(text);
  const cached = embeddingCache.get(key);
  if (cached && Date.now() - cached.ts < EMBEDDING_CACHE_TTL) {
    return cached.vec;
  }

  try {
    const client = getClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const response = await client.embeddings.create(
      { model: "text-embedding-3-small", input: text.slice(0, 8000) },
      { signal: controller.signal as AbortSignal },
    );
    clearTimeout(timer);

    const vec = response.data[0]?.embedding;
    if (vec && vec.length > 0) {
      embeddingCache.set(key, { vec, ts: Date.now() });
      if (embeddingCache.size > 1000) {
        const oldest = [...embeddingCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) embeddingCache.delete(oldest[0]);
      }
      return vec;
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "NeuralEmbeddings: API call failed, using fallback");
  }

  const fallback = localFallbackEmbedding(text);
  embeddingCache.set(key, { vec: fallback, ts: Date.now() });
  return fallback;
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = new Array(texts.length);
  const uncachedIndices: number[] = [];

  for (let i = 0; i < texts.length; i++) {
    const key = hashText(texts[i]);
    const cached = embeddingCache.get(key);
    if (cached && Date.now() - cached.ts < EMBEDDING_CACHE_TTL) {
      results[i] = cached.vec;
    } else {
      uncachedIndices.push(i);
    }
  }

  if (uncachedIndices.length === 0) return results;

  const batches: number[][] = [];
  for (let i = 0; i < uncachedIndices.length; i += MAX_BATCH_SIZE) {
    batches.push(uncachedIndices.slice(i, i + MAX_BATCH_SIZE));
  }

  for (const batch of batches) {
    const batchTexts = batch.map(idx => texts[idx].slice(0, 8000));
    let embeddings: number[][] | null = null;

    try {
      const client = getClient();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);

      const response = await client.embeddings.create(
        { model: "text-embedding-3-small", input: batchTexts },
        { signal: controller.signal as AbortSignal },
      );
      clearTimeout(timer);

      embeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding);
    } catch (err) {
      logger.debug({ err: (err as Error).message, batchSize: batch.length }, "NeuralEmbeddings: batch API call failed");
    }

    for (let j = 0; j < batch.length; j++) {
      const origIdx = batch[j];
      const vec = embeddings?.[j] ?? localFallbackEmbedding(texts[origIdx]);
      results[origIdx] = vec;
      embeddingCache.set(hashText(texts[origIdx]), { vec, ts: Date.now() });
    }
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function getEmbeddingStats() {
  return {
    cacheSize: embeddingCache.size,
    dimension: EMBEDDING_DIM,
    maxBatchSize: MAX_BATCH_SIZE,
  };
}
