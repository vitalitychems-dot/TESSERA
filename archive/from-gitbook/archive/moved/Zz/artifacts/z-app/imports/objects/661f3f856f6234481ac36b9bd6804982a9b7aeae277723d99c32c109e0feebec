import { db } from "@workspace/db";
import { vectorEmbeddingsTable, decisionHistoryTable, systemStateTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function buildTfidfVector(tokens: string[], vocab: string[]): number[] {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return vocab.map(term => {
    const count = tf[term] || 0;
    return count > 0 ? count / tokens.length : 0;
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

const VOCAB_CACHE: { terms: string[]; updatedAt: number } = { terms: [], updatedAt: 0 };
const VOCAB_TTL_MS = 60_000;

async function getVocab(): Promise<string[]> {
  const now = Date.now();
  if (VOCAB_CACHE.terms.length > 0 && now - VOCAB_CACHE.updatedAt < VOCAB_TTL_MS) {
    return VOCAB_CACHE.terms;
  }
  const rows = await db.select({ content: vectorEmbeddingsTable.content }).from(vectorEmbeddingsTable).limit(500);
  const termSet = new Set<string>();
  for (const row of rows) {
    for (const t of tokenize(row.content)) termSet.add(t);
  }
  VOCAB_CACHE.terms = Array.from(termSet).slice(0, 2000);
  VOCAB_CACHE.updatedAt = now;
  return VOCAB_CACHE.terms;
}

export function embedText(text: string, vocab: string[]): number[] {
  const tokens = tokenize(text);
  return buildTfidfVector(tokens, vocab);
}

export async function storeMemory(opts: {
  content: string;
  source?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  VOCAB_CACHE.updatedAt = 0;
  const vocab = await getVocab();
  const allTokens = tokenize(opts.content);
  const updatedTermSet = new Set([...vocab, ...allTokens]);
  VOCAB_CACHE.terms = Array.from(updatedTermSet).slice(0, 2000);
  VOCAB_CACHE.updatedAt = Date.now();
  const embedding = embedText(opts.content, VOCAB_CACHE.terms);

  const [row] = await db.insert(vectorEmbeddingsTable).values({
    content: opts.content,
    embedding,
    source: opts.source ?? "system",
    category: opts.category ?? "general",
    metadata: opts.metadata ?? {},
    accessCount: 0,
  }).returning({ id: vectorEmbeddingsTable.id });

  return row.id;
}

export async function searchMemory(query: string, topK = 10, category?: string): Promise<Array<{
  id: number;
  content: string;
  score: number;
  source: string;
  category: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}>> {
  const vocab = await getVocab();
  if (vocab.length === 0) return [];

  const queryVec = embedText(query, vocab);
  const rows = await db.select().from(vectorEmbeddingsTable).orderBy(desc(vectorEmbeddingsTable.createdAt)).limit(1000);

  const scored = rows
    .filter(r => !category || r.category === category)
    .map(r => {
      const emb = r.embedding as number[];
      let score = 0;
      if (Array.isArray(emb) && emb.length === queryVec.length) {
        score = cosineSimilarity(queryVec, emb);
      } else {
        const contentTokens = tokenize(r.content);
        const queryTokens = tokenize(query);
        const overlap = queryTokens.filter(t => contentTokens.includes(t)).length;
        score = overlap / Math.max(queryTokens.length, 1) * 0.5;
      }
      return { ...r, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (scored.length > 0) {
    const ids = scored.map(r => r.id);
    for (const id of ids) {
      await db.update(vectorEmbeddingsTable)
        .set({ accessCount: sql`${vectorEmbeddingsTable.accessCount} + 1` })
        .where(eq(vectorEmbeddingsTable.id, id));
    }
  }

  return scored.map(r => ({
    id: r.id,
    content: r.content,
    score: r.score,
    source: r.source,
    category: r.category,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}

export async function getMemoryStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  vocabSize: number;
  recentlyAdded: number;
}> {
  const rows = await db.select({
    category: vectorEmbeddingsTable.category,
    createdAt: vectorEmbeddingsTable.createdAt,
  }).from(vectorEmbeddingsTable);

  const byCategory: Record<string, number> = {};
  let recentlyAdded = 0;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    if (r.createdAt.getTime() > cutoff) recentlyAdded++;
  }

  const vocab = await getVocab();

  return {
    total: rows.length,
    byCategory,
    vocabSize: vocab.length,
    recentlyAdded,
  };
}

export async function logDecision(opts: {
  action: string;
  category?: string;
  rationale: string;
  context?: Record<string, unknown>;
  outcome?: string;
  significance?: "low" | "medium" | "high" | "critical";
  source?: string;
  sessionId?: string;
}): Promise<number> {
  const [row] = await db.insert(decisionHistoryTable).values({
    action: opts.action,
    category: opts.category ?? "system",
    rationale: opts.rationale,
    context: opts.context ?? {},
    outcome: opts.outcome,
    significance: opts.significance ?? "low",
    source: opts.source ?? "system",
    sessionId: opts.sessionId,
  }).returning({ id: decisionHistoryTable.id });

  await storeMemory({
    content: `Decision: ${opts.action}. Rationale: ${opts.rationale}`,
    source: opts.source ?? "system",
    category: "decision",
    metadata: { decisionId: row.id, significance: opts.significance ?? "low" },
  });

  return row.id;
}

export async function getDecisions(opts: { limit?: number; category?: string; significance?: string } = {}): Promise<typeof decisionHistoryTable.$inferSelect[]> {
  let query = db.select().from(decisionHistoryTable).orderBy(desc(decisionHistoryTable.decidedAt));
  const rows = await query.limit(opts.limit ?? 50);
  return rows.filter(r => {
    if (opts.category && r.category !== opts.category) return false;
    if (opts.significance && r.significance !== opts.significance) return false;
    return true;
  });
}

export async function saveState(key: string, value: unknown, description?: string): Promise<void> {
  await db.insert(systemStateTable).values({
    key,
    value,
    description,
  }).onConflictDoUpdate({
    target: systemStateTable.key,
    set: { value, lastSavedAt: new Date(), description },
  });
}

export async function restoreState(key: string): Promise<unknown | null> {
  const [row] = await db.select().from(systemStateTable).where(eq(systemStateTable.key, key)).limit(1);
  if (!row) return null;
  await db.update(systemStateTable).set({ restoredAt: new Date() }).where(eq(systemStateTable.key, key));
  return row.value;
}

export async function getAllState(): Promise<typeof systemStateTable.$inferSelect[]> {
  return db.select().from(systemStateTable).orderBy(desc(systemStateTable.lastSavedAt));
}

const STARTUP_DONE: { done: boolean } = { done: false };

export async function initializeMemoryOnStartup(): Promise<{ loaded: string[]; errors: string[] }> {
  if (STARTUP_DONE.done) return { loaded: [], errors: [] };
  STARTUP_DONE.done = true;

  const loaded: string[] = [];
  const errors: string[] = [];

  try {
    const stats = await getMemoryStats();
    await saveState("memory.lastStartup", {
      timestamp: new Date().toISOString(),
      totalEmbeddings: stats.total,
      vocabSize: stats.vocabSize,
    }, "Last startup state of the memory system");
    loaded.push("memory.lastStartup");
  } catch (e) {
    errors.push(`Failed to save startup state: ${(e as Error).message}`);
  }

  try {
    const recentDecisions = await getDecisions({ limit: 10 });
    await saveState("decisions.recent", recentDecisions.map(d => ({
      id: d.id,
      action: d.action,
      significance: d.significance,
      decidedAt: d.decidedAt,
    })), "Last 10 significant decisions");
    loaded.push("decisions.recent");
  } catch (e) {
    errors.push(`Failed to restore decisions: ${(e as Error).message}`);
  }

  try {
    await logDecision({
      action: "system.startup",
      category: "lifecycle",
      rationale: "API server started, memory system initialized",
      significance: "medium",
      source: "system",
    });
    loaded.push("startup decision logged");
  } catch (e) {
    errors.push(`Failed to log startup decision: ${(e as Error).message}`);
  }

  return { loaded, errors };
}
