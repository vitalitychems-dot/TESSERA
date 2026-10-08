import axios from "axios";
import crypto from "crypto";
import { db } from "./db";
import { knowledgeVectors, type InsertKnowledgeVector } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const EMBEDDING_CACHE: Map<string, number[]> = new Map();
const MAX_CACHE_SIZE = 1000;
const EMBEDDING_DIM_REAL = 1536;
const EMBEDDING_DIM_FALLBACK = 256;

let embeddingModel = "ngram-v1";
let embeddingDim = EMBEDDING_DIM_FALLBACK;
let realEmbeddingsEnabled = false;

async function tryEnableRealEmbeddings(): Promise<boolean> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) return false;

  try {
    const response = await axios.post(
      `${baseUrl}/embeddings`,
      { model: "text-embedding-3-small", input: "test" },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    if (response.data?.data?.[0]?.embedding) {
      const dim = response.data.data[0].embedding.length;
      embeddingModel = "text-embedding-3-small";
      embeddingDim = dim;
      realEmbeddingsEnabled = true;
      console.log(`[EmbeddingService] Real embeddings enabled via Replit AI proxy (dim=${dim})`);
      return true;
    }
  } catch {
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/embeddings",
        { model: "openai/text-embedding-3-small", input: "test" },
        {
          headers: { Authorization: `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
          timeout: 10000,
        }
      );
      if (response.data?.data?.[0]?.embedding) {
        const dim = response.data.data[0].embedding.length;
        embeddingModel = "openai/text-embedding-3-small";
        embeddingDim = dim;
        realEmbeddingsEnabled = true;
        console.log(`[EmbeddingService] Real embeddings enabled via OpenRouter (dim=${dim})`);
        return true;
      }
    } catch {
    }
  }

  console.log("[EmbeddingService] Real embeddings unavailable — using enhanced n-gram fallback");
  return false;
}

setTimeout(() => tryEnableRealEmbeddings().catch(() => {}), 5000);

async function generateRealEmbedding(text: string): Promise<number[] | null> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (baseUrl && apiKey) {
    try {
      const response = await axios.post(
        `${baseUrl}/embeddings`,
        { model: "text-embedding-3-small", input: text.slice(0, 8191) },
        {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          timeout: 15000,
        }
      );
      if (response.data?.data?.[0]?.embedding) {
        return response.data.data[0].embedding as number[];
      }
    } catch {
    }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/embeddings",
        { model: "openai/text-embedding-3-small", input: text.slice(0, 8191) },
        {
          headers: { Authorization: `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
          timeout: 15000,
        }
      );
      if (response.data?.data?.[0]?.embedding) {
        return response.data.data[0].embedding as number[];
      }
    } catch {
    }
  }

  return null;
}

function buildNgrams(text: string, n: number = 3): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const ngrams: string[] = [];
  const words = normalized.split(" ").filter(w => w.length > 0);
  for (const word of words) {
    const padded = `^${word}$`;
    for (let i = 0; i <= padded.length - n; i++) {
      ngrams.push(padded.slice(i, i + n));
    }
  }
  for (let i = 0; i + n <= normalized.length; i++) {
    const chunk = normalized.slice(i, i + n);
    if (!chunk.includes(" ")) ngrams.push(chunk);
  }
  return ngrams;
}

function hashToSlot(ngram: string, dim: number): number {
  let h = 5381;
  for (let i = 0; i < ngram.length; i++) {
    h = ((h << 5) + h + ngram.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % dim;
}

export function generateNgramEmbedding(text: string, dim: number = EMBEDDING_DIM_FALLBACK): number[] {
  const vec = new Float32Array(dim);
  const ngrams = buildNgrams(text, 3);
  const counts = new Map<string, number>();
  for (const ng of ngrams) {
    counts.set(ng, (counts.get(ng) || 0) + 1);
  }
  const total = ngrams.length || 1;
  for (const [ng, count] of counts) {
    const slot = hashToSlot(ng, dim);
    const slot2 = hashToSlot(ng + "_", dim);
    vec[slot] += (count / total);
    vec[slot2] -= (count / total) * 0.3;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return Array.from(vec).map(v => v / norm);
}

export async function generateEmbedding(text: string): Promise<{ embedding: number[]; model: string; dim: number }> {
  const cacheKey = crypto.createHash("md5").update(text.slice(0, 500)).digest("hex");
  if (EMBEDDING_CACHE.has(cacheKey)) {
    return { embedding: EMBEDDING_CACHE.get(cacheKey)!, model: embeddingModel, dim: embeddingDim };
  }

  if (realEmbeddingsEnabled) {
    const real = await generateRealEmbedding(text);
    if (real) {
      if (EMBEDDING_CACHE.size >= MAX_CACHE_SIZE) {
        const firstKey = EMBEDDING_CACHE.keys().next().value;
        if (firstKey) EMBEDDING_CACHE.delete(firstKey);
      }
      EMBEDDING_CACHE.set(cacheKey, real);
      return { embedding: real, model: embeddingModel, dim: embeddingDim };
    }
  }

  const fallback = generateNgramEmbedding(text);
  if (EMBEDDING_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = EMBEDDING_CACHE.keys().next().value;
    if (firstKey) EMBEDDING_CACHE.delete(firstKey);
  }
  EMBEDDING_CACHE.set(cacheKey, fallback);
  return { embedding: fallback, model: "ngram-v1", dim: EMBEDDING_DIM_FALLBACK };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    if (a.length === 0 || b.length === 0) return 0;
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < shorter.length; i++) {
      dot += shorter[i] * longer[i];
      na += shorter[i] * shorter[i];
    }
    for (let i = 0; i < longer.length; i++) {
      nb += longer[i] * longer[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function formatVectorForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function upsertKnowledgeVector(entry: {
  source: string;
  title: string;
  content: string;
  tags: string[];
  url?: string;
}): Promise<string> {
  const contentHash = crypto.createHash("sha256").update(`${entry.source}::${entry.title}::${entry.content.slice(0, 200)}`).digest("hex").slice(0, 16);

  const existing = await db.select({ id: knowledgeVectors.id })
    .from(knowledgeVectors)
    .where(eq(knowledgeVectors.contentHash, contentHash))
    .limit(1);

  const text = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`;
  const { embedding, model, dim } = await generateEmbedding(text);
  const vectorStr = formatVectorForPg(embedding);

  if (existing.length === 0) {
    await db.execute(sql`
      INSERT INTO knowledge_vectors (source, title, content, tags, url, content_hash, embedding, embedding_vector, embedding_model, embedding_dim)
      VALUES (
        ${entry.source},
        ${entry.title},
        ${entry.content.slice(0, 8000)},
        ${JSON.stringify(entry.tags)},
        ${entry.url ?? null},
        ${contentHash},
        ${JSON.stringify(embedding)},
        ${sql.raw(`'${vectorStr}'::vector(1536)`)},
        ${model},
        ${dim}
      )
    `);
  } else {
    await db.execute(sql`
      UPDATE knowledge_vectors SET
        embedding = ${JSON.stringify(embedding)},
        embedding_vector = ${sql.raw(`'${vectorStr}'::vector(1536)`)},
        embedding_model = ${model},
        embedding_dim = ${dim},
        updated_at = NOW()
      WHERE content_hash = ${contentHash}
    `);
  }

  return contentHash;
}

export interface VectorSearchResult {
  source: string;
  title: string;
  content: string;
  tags: string[];
  url: string | null;
  score: number;
}

export async function semanticSearch(query: string, topK: number = 5, minScore: number = 0.05): Promise<VectorSearchResult[]> {
  try {
    const { embedding: queryEmbedding, dim } = await generateEmbedding(query);
    const vectorStr = formatVectorForPg(queryEmbedding);

    // Try pgvector native search first
    try {
      const rows = await db.execute(sql`
        SELECT
          source, title, content, tags, url,
          (1 - (embedding_vector <=> ${sql.raw(`'${vectorStr}'::vector(${dim})`)})) AS score
        FROM knowledge_vectors
        WHERE embedding_vector IS NOT NULL
          AND embedding_dim = ${dim}
        ORDER BY embedding_vector <=> ${sql.raw(`'${vectorStr}'::vector(${dim})`)}
        LIMIT ${topK * 2}
      `);

      const results: VectorSearchResult[] = [];
      for (const row of rows.rows as any[]) {
        const score = parseFloat(row.score);
        if (score >= minScore) {
          results.push({
            source: row.source,
            title: row.title,
            content: row.content,
            tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
            url: row.url,
            score,
          });
        }
      }

      if (results.length > 0) {
        return results.slice(0, topK);
      }
    } catch (pgErr: any) {
      console.warn("[EmbeddingService] pgvector search failed, falling back to JS cosine:", pgErr.message);
    }

    // JS fallback
    const rows = await db.select({
      source: knowledgeVectors.source,
      title: knowledgeVectors.title,
      content: knowledgeVectors.content,
      tags: knowledgeVectors.tags,
      url: knowledgeVectors.url,
      embedding: knowledgeVectors.embedding,
    }).from(knowledgeVectors).limit(2000);

    const scored: { row: typeof rows[0]; score: number }[] = [];
    for (const row of rows) {
      if (!row.embedding) continue;
      try {
        const vec = JSON.parse(row.embedding) as number[];
        const score = cosineSimilarity(queryEmbedding, vec);
        if (score >= minScore) {
          scored.push({ row, score });
        }
      } catch {
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ row, score }) => ({
      source: row.source,
      title: row.title,
      content: row.content,
      tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
      url: row.url,
      score,
    }));
  } catch (err: any) {
    console.warn("[EmbeddingService] Semantic search failed:", err.message);
    return [];
  }
}

export function getEmbeddingServiceStatus() {
  return {
    realEmbeddingsEnabled,
    model: embeddingModel,
    dim: embeddingDim,
    cacheSize: EMBEDDING_CACHE.size,
    maxCacheSize: MAX_CACHE_SIZE,
  };
}

console.log("[EmbeddingService] Embedding service initialized (real embeddings probe scheduled)");
