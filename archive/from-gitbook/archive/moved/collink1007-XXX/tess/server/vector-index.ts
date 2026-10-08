import fs from "fs";
import path from "path";
import crypto from "crypto";
import { generateEmbedding, cosineSimilarity, generateNgramEmbedding, upsertKnowledgeVector, semanticSearch, getEmbeddingServiceStatus } from "./embedding-service";

const VECTOR_INDEX_PATH = path.join(process.cwd(), "server/vector-knowledge-index.json");
const VECTOR_DIM = 256;

interface VectorEntry {
  id: string;
  source: string;
  title: string;
  content: string;
  tags: string[];
  url?: string;
  vector: number[];
  indexedAt: string;
}

interface VectorIndex {
  entries: VectorEntry[];
  version: number;
  lastBuilt: string;
}

let vectorIndex: VectorIndex = { entries: [], version: 1, lastBuilt: "" };

function entryId(source: string, title: string, content: string): string {
  const key = `${source}::${title}::${content.slice(0, 200)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function textToVector(text: string, dim: number = VECTOR_DIM): number[] {
  return generateNgramEmbedding(text, dim);
}

export { cosineSimilarity };

export function loadVectorIndex(): number {
  try {
    if (fs.existsSync(VECTOR_INDEX_PATH)) {
      const raw = fs.readFileSync(VECTOR_INDEX_PATH, "utf8");
      vectorIndex = JSON.parse(raw);
      console.log(`[VectorIndex] Loaded ${vectorIndex.entries.length} vectorized entries`);
      return vectorIndex.entries.length;
    }
  } catch (e: any) {
    console.warn(`[VectorIndex] Load failed: ${e?.message}`);
  }
  vectorIndex = { entries: [], version: 1, lastBuilt: "" };
  return 0;
}

export function saveVectorIndex() {
  try {
    fs.writeFileSync(VECTOR_INDEX_PATH, JSON.stringify(vectorIndex));
  } catch (e: any) {
    console.warn(`[VectorIndex] Save failed: ${e?.message}`);
  }
}

export async function buildVectorIndex(rawEntries: { source: string; title: string; content: string; tags: string[]; url?: string }[]): Promise<number> {
  const existingIds = new Set(vectorIndex.entries.map(e => e.id));
  let added = 0;

  for (const entry of rawEntries) {
    const id = entryId(entry.source, entry.title, entry.content);
    if (existingIds.has(id)) continue;

    const text = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`;
    const { embedding: vector } = await generateEmbedding(text);

    vectorIndex.entries.push({
      id,
      source: entry.source,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      url: entry.url,
      vector,
      indexedAt: new Date().toISOString(),
    });
    added++;

    try {
      await upsertKnowledgeVector(entry);
    } catch {}
  }

  if (vectorIndex.entries.length > 10000) {
    vectorIndex.entries = vectorIndex.entries.slice(-8000);
  }
  vectorIndex.lastBuilt = new Date().toISOString();
  saveVectorIndex();
  console.log(`[VectorIndex] Built: ${added} new entries, ${vectorIndex.entries.length} total`);
  return vectorIndex.entries.length;
}

export interface VectorSearchResult {
  source: string;
  title: string;
  content: string;
  tags: string[];
  url?: string;
  score: number;
}

export async function vectorSearch(query: string, topK: number = 5, minScore: number = 0.05): Promise<VectorSearchResult[]> {
  let dbResults: VectorSearchResult[] = [];
  try {
    const semantic = await semanticSearch(query, topK, minScore);
    if (semantic.length > 0) {
      dbResults = semantic.map(r => ({
        source: r.source,
        title: r.title,
        content: r.content,
        tags: r.tags,
        url: r.url || undefined,
        score: r.score,
      }));
    }
  } catch {}

  if (dbResults.length >= topK) return dbResults;

  if (vectorIndex.entries.length === 0) return dbResults;

  const { embedding: queryVec } = await generateEmbedding(query);
  const scored: { entry: VectorEntry; score: number }[] = [];
  for (const entry of vectorIndex.entries) {
    const score = cosineSimilarity(queryVec, entry.vector);
    if (score >= minScore) {
      scored.push({ entry, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const inMemoryResults = scored.slice(0, topK).map(({ entry, score }) => ({
    source: entry.source,
    title: entry.title,
    content: entry.content,
    tags: entry.tags,
    url: entry.url,
    score,
  }));

  const seen = new Set(dbResults.map(r => r.title));
  const combined = [...dbResults];
  for (const r of inMemoryResults) {
    if (!seen.has(r.title)) {
      combined.push(r);
      seen.add(r.title);
    }
  }
  combined.sort((a, b) => b.score - a.score);
  return combined.slice(0, topK);
}

export function vectorSearchSync(query: string, topK: number = 5, minScore: number = 0.05): VectorSearchResult[] {
  if (vectorIndex.entries.length === 0) return [];
  const queryVec = generateNgramEmbedding(query);
  const scored: { entry: VectorEntry; score: number }[] = [];
  for (const entry of vectorIndex.entries) {
    const score = cosineSimilarity(queryVec, entry.vector);
    if (score >= minScore) {
      scored.push({ entry, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(({ entry, score }) => ({
    source: entry.source,
    title: entry.title,
    content: entry.content,
    tags: entry.tags,
    url: entry.url,
    score,
  }));
}

export function getVectorIndexStats() {
  const embeddingStatus = getEmbeddingServiceStatus();
  return {
    totalEntries: vectorIndex.entries.length,
    lastBuilt: vectorIndex.lastBuilt,
    version: vectorIndex.version,
    embeddingModel: embeddingStatus.model,
    embeddingDim: embeddingStatus.dim,
    realEmbeddingsEnabled: embeddingStatus.realEmbeddingsEnabled,
    cacheSize: embeddingStatus.cacheSize,
  };
}

console.log("[VectorIndex] Vector search engine initialized with semantic embedding support");
