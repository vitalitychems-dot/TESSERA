import { db } from "@workspace/db";
import { vectorEmbeddingsTable, decisionHistoryTable, systemStateTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { generateEmbedding, generateEmbeddingsBatch, cosineSimilarity as neuralCosineSimilarity, getEmbeddingStats } from "./neural-embeddings";
import { evictExpired } from "./semantic-cache";
import { logger } from "./logger";

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

export function embedText(text: string, _vocab?: string[]): number[] {
  const tokens = tokenize(text);
  const vec = new Array(256).fill(0);
  for (let i = 0; i < tokens.length; i++) {
    let h = 0;
    for (let j = 0; j < tokens[i].length; j++) h = ((h << 5) - h + tokens[i].charCodeAt(j)) | 0;
    const idx = Math.abs(h) % 256;
    vec[idx] += 1 / tokens.length;
  }
  const mag = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
  if (mag > 0) for (let i = 0; i < vec.length; i++) vec[i] /= mag;
  return vec;
}

export async function storeMemory(opts: {
  content: string;
  source?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const embedding = await generateEmbedding(opts.content);

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
  const queryVec = await generateEmbedding(query);
  const rows = await db.select().from(vectorEmbeddingsTable).orderBy(desc(vectorEmbeddingsTable.createdAt)).limit(1000);

  const scored = rows
    .filter(r => !category || r.category === category)
    .map(r => {
      const emb = r.embedding as number[];
      let score = 0;
      if (Array.isArray(emb) && emb.length > 0) {
        score = neuralCosineSimilarity(queryVec, emb);
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
  embeddingStats: { cacheSize: number; dimension: number; maxBatchSize: number };
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

  const embStats = getEmbeddingStats();

  return {
    total: rows.length,
    byCategory,
    vocabSize: embStats.cacheSize,
    recentlyAdded,
    embeddingStats: embStats,
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

  scheduleBackgroundReembedding();

  return { loaded, errors };
}

const REEMBED_BATCH_SIZE = 20;
const REEMBED_INTERVAL_MS = 60_000;
let reembedTimer: ReturnType<typeof setInterval> | null = null;
const reembedStats = { processed: 0, remaining: 0, running: false };

async function reembedBatch(): Promise<number> {
  if (reembedStats.running) return 0;
  reembedStats.running = true;

  try {
    const rows = await db
      .select({ id: vectorEmbeddingsTable.id, content: vectorEmbeddingsTable.content, embedding: vectorEmbeddingsTable.embedding })
      .from(vectorEmbeddingsTable)
      .limit(REEMBED_BATCH_SIZE);

    const needsReembed = rows.filter(r => {
      const emb = r.embedding as number[];
      return !Array.isArray(emb) || emb.length === 0 || emb.length > 256;
    });

    if (needsReembed.length === 0) {
      reembedStats.remaining = 0;
      return 0;
    }

    const texts = needsReembed.map(r => r.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    for (let i = 0; i < needsReembed.length; i++) {
      await db
        .update(vectorEmbeddingsTable)
        .set({ embedding: embeddings[i] })
        .where(eq(vectorEmbeddingsTable.id, needsReembed[i].id));
    }

    reembedStats.processed += needsReembed.length;
    logger.info({ batch: needsReembed.length, total: reembedStats.processed }, "VectorMemory: re-embedded batch");

    evictExpired().catch(() => {});

    return needsReembed.length;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "VectorMemory: re-embed error");
    return 0;
  } finally {
    reembedStats.running = false;
  }
}

function scheduleBackgroundReembedding(): void {
  if (reembedTimer) return;
  reembedTimer = setInterval(async () => {
    const count = await reembedBatch();
    if (count === 0 && reembedTimer) {
      clearInterval(reembedTimer);
      reembedTimer = null;
      logger.info({ totalProcessed: reembedStats.processed }, "VectorMemory: background re-embedding complete");
    }
  }, REEMBED_INTERVAL_MS);
  logger.info("VectorMemory: background re-embedding scheduled");
}

export function getReembedStats() {
  return { ...reembedStats };
}
