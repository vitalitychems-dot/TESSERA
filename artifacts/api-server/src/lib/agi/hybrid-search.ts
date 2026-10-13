/**
 * Hybrid memory search (REA-02).
 *
 * Idea: mem0 / graphiti (Apache-2.0) — combine dense vector similarity with
 * keyword matching and fuse the two rankings. Implemented from scratch.
 *
 * This module is storage-agnostic: it ranks candidate rows in process today
 * (vector_embeddings.embedding is jsonb), and the same fusion applies to the
 * top-K rows returned by a pgvector HNSW query once
 * lib/db/sql/0011_pgvector_hnsw.sql is applied.
 */
export interface SearchDoc { id: string | number; content: string; embedding: number[] }
export interface HybridHit { id: string | number; score: number; vectorRank: number | null; keywordRank: number | null }

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const tok = (s: string) => s.toLowerCase().split(/\W+/).filter((t) => t.length > 1);

/** BM25 over the candidate set (k1=1.2, b=0.75). */
export function bm25Scores(query: string, docs: SearchDoc[]): number[] {
  const q = [...new Set(tok(query))];
  const toks = docs.map((d) => tok(d.content));
  const avg = toks.reduce((s, t) => s + t.length, 0) / (toks.length || 1) || 1;
  const df = new Map<string, number>();
  for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  return toks.map((t) => {
    let s = 0;
    for (const w of q) {
      const f = t.filter((x) => x === w).length;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (t.length / avg))));
    }
    return s;
  });
}

/** Reciprocal-rank fusion of vector and keyword rankings (k = 60). */
export function hybridSearch(query: string, queryEmbedding: number[], docs: SearchDoc[], limit = 10, k = 60): HybridHit[] {
  const vec = docs.map((d, i) => ({ i, s: cosine(queryEmbedding, d.embedding) })).sort((a, b) => b.s - a.s);
  const kw = bm25Scores(query, docs).map((s, i) => ({ i, s })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const vr = new Map(vec.map((x, r) => [x.i, r + 1]));
  const kr = new Map(kw.map((x, r) => [x.i, r + 1]));
  return docs
    .map((d, i) => {
      const v = vr.get(i) ?? null, kk = kr.get(i) ?? null;
      return { id: d.id, vectorRank: v, keywordRank: kk, score: (v ? 1 / (k + v) : 0) + (kk ? 1 / (k + kk) : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
