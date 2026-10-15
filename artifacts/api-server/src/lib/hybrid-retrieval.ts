import { logger } from "./logger";
import { searchMemory } from "./vector-memory";
import { recallIngestedKnowledgeWithProvenance } from "./ingested-recall";
import { generateEmbedding, generateEmbeddingsBatch, cosineSimilarity } from "./neural-embeddings";
import type { TesseraAnswerEvidence } from "./tessera-knowledge";
import {
  formatInlineCitation,
  makeSourceProvenance,
  sanitizeCitationText,
  type TesseraSourceProvenance,
} from "./tessera-source-provenance";

export interface RetrievedChunk extends TesseraAnswerEvidence {
  id?: string;
  score: number;
  provenance?: TesseraSourceProvenance;
  vectorScore?: number;
  bm25Score?: number;
  rerankScore?: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

export function bm25Scores(query: string, docs: string[], k1 = 1.5, b = 0.75): number[] {
  const qTerms = Array.from(new Set(tokenize(query)));
  if (qTerms.length === 0 || docs.length === 0) return docs.map(() => 0);
  const tokenized = docs.map(tokenize);
  const lens = tokenized.map((d) => d.length);
  const avgdl = lens.reduce((a, b) => a + b, 0) / lens.length || 1;
  const N = docs.length;
  const qSet = new Set(qTerms);
  const df: Record<string, number> = Object.fromEntries(qTerms.map((t) => [t, 0]));
  for (const d of tokenized) {
    const seen = new Set<string>();
    for (const w of d) {
      if (qSet.has(w) && !seen.has(w)) {
        seen.add(w);
        df[w]++;
      }
    }
  }
  const idf: Record<string, number> = {};
  for (const t of qTerms) {
    idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
  }
  return tokenized.map((d, i) => {
    const counts: Record<string, number> = {};
    for (const w of d) counts[w] = (counts[w] || 0) + 1;
    let s = 0;
    for (const t of qTerms) {
      const f = counts[t] || 0;
      if (!f) continue;
      s += idf[t] * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * lens[i]) / avgdl)));
    }
    return s;
  });
}

function normalize(scores: number[]): number[] {
  const max = Math.max(...scores, 0.0001);
  return scores.map((s) => s / max);
}

export interface HybridRetrievalOpts {
  vectorWeight?: number;
  bm25Weight?: number;
  topK?: number;
  rerankTopK?: number;
}

export async function hybridRetrieve(query: string, opts: HybridRetrievalOpts = {}): Promise<RetrievedChunk[]> {
  const { vectorWeight = 0.6, bm25Weight = 0.4, topK = 8, rerankTopK = 5 } = opts;

  const candidates: RetrievedChunk[] = [];
  try {
    const vectorHits = await searchMemory(query, topK * 2);
    for (const hit of vectorHits as Array<Record<string, unknown>>) {
      const text = String(hit.content ?? hit.text ?? "");
      const memoryId = String(hit.id ?? "unknown");
      const source = sanitizeCitationText(hit.source ?? "memory");
      const vScore = Number(hit.score ?? hit.similarity ?? 0);
      const metadata = hit.metadata && typeof hit.metadata === "object"
        ? hit.metadata as Record<string, unknown>
        : {};
      if (text) candidates.push({
        id: `memory:${memoryId}`,
        text,
        source: `mem:${source}`,
        score: 0,
        vectorScore: vScore,
        provenance: makeSourceProvenance({
          sourceUrl: metadata.url,
          documentReference: `vector-memory:${memoryId}`,
          retrievedAt: metadata.retrievedAt,
          publishedAt: metadata.publishedAt,
          trustStatus: "unverified",
        }),
      });
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "hybrid: vector retrieval failed");
  }

  try {
    const ingested = await recallIngestedKnowledgeWithProvenance(query, topK);
    for (const passage of ingested) {
      candidates.push({
        id: passage.id,
        text: passage.text,
        source: passage.source,
        provenance: passage.provenance,
        score: 0,
        vectorScore: 0,
      });
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "hybrid: ingested recall failed");
  }

  if (candidates.length === 0) return [];

  const docs = candidates.map((c) => c.text);
  const bm25 = bm25Scores(query, docs);
  const bm25N = normalize(bm25);
  const vecN = normalize(candidates.map((c) => c.vectorScore || 0));

  for (let i = 0; i < candidates.length; i++) {
    candidates[i].bm25Score = bm25[i];
    candidates[i].score = vectorWeight * vecN[i] + bm25Weight * bm25N[i];
  }

  candidates.sort((a, b) => b.score - a.score);
  const reranked = await rerankByEmbedding(query, candidates.slice(0, topK));
  return reranked.slice(0, rerankTopK);
}

async function rerankByEmbedding(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  try {
    const qEmb = await generateEmbedding(query);
    if (!qEmb || qEmb.length === 0) return chunks;
    const texts = chunks.map((c) => c.text.slice(0, 800));
    const embeddings = await generateEmbeddingsBatch(texts);
    const scored: RetrievedChunk[] = chunks.map((c, i) => {
      const cEmb = embeddings[i];
      if (!cEmb || cEmb.length === 0) return c;
      const sim = cosineSimilarity(qEmb, cEmb);
      return { ...c, rerankScore: sim, score: 0.5 * c.score + 0.5 * sim };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "hybrid: rerank failed");
    return chunks;
  }
}

export function formatCitations(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map((chunk, index) => {
      const provenance = chunk.provenance ?? makeSourceProvenance({
        documentReference: chunk.id ?? `retrieved:${sanitizeCitationText(chunk.source)}`,
      });
      const details = [
        getCitationTrustStatus(provenance.trustStatus),
        `retrieved ${provenance.retrievedAt ?? "date unavailable"}`,
        provenance.publishedAt ? `published ${provenance.publishedAt}` : null,
        provenance.sourceUrl ?? provenance.documentReference,
      ].filter(Boolean).join("; ");
      return `${formatInlineCitation(index + 1, provenance)} ${sanitizeCitationText(chunk.source)} — ${details} (relevance: ${(chunk.score * 100).toFixed(0)}%)`;
    })
    .join("\n");
}

function getCitationTrustStatus(status: TesseraSourceProvenance["trustStatus"]): string {
  return status === "verified" ? "verified" : status === "stale" ? "outdated note" : "unverified note";
}
