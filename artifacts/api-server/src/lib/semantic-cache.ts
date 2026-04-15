import * as crypto from "crypto";
import { db } from "@workspace/db";
import { semanticCacheTable } from "@workspace/db/schema";
import { eq, sql, gt } from "drizzle-orm";
import { logger } from "./logger";
import { generateEmbedding, cosineSimilarity } from "./neural-embeddings";

const DEFAULT_TTL_SECONDS = 3600;
const SIMILARITY_THRESHOLD = 0.92;
const MAX_CACHE_SIZE = 5000;

interface CacheStats {
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  cacheSize: number;
  hitRate: number;
}

const stats: CacheStats = {
  totalHits: 0,
  totalMisses: 0,
  totalEvictions: 0,
  cacheSize: 0,
  hitRate: 0,
};

function hashPrompt(messages: Array<{ role: string; content: string }>, model: string): string {
  const key = messages.map(m => `${m.role}:${m.content}`).join("|") + `|model:${model}`;
  return crypto.createHash("sha256").update(key).digest("hex");
}

function updateHitRate(): void {
  const total = stats.totalHits + stats.totalMisses;
  stats.hitRate = total > 0 ? stats.totalHits / total : 0;
}

export async function lookupCache(
  messages: Array<{ role: string; content: string }>,
  model: string,
): Promise<string | null> {
  const hash = hashPrompt(messages, model);

  try {
    const [exact] = await db
      .select()
      .from(semanticCacheTable)
      .where(eq(semanticCacheTable.promptHash, hash))
      .limit(1);

    if (exact && new Date(exact.expiresAt) > new Date()) {
      stats.totalHits++;
      updateHitRate();
      await db.update(semanticCacheTable)
        .set({ hitCount: sql`${semanticCacheTable.hitCount} + 1`, lastHitAt: new Date() })
        .where(eq(semanticCacheTable.id, exact.id));
      logger.info({ hash: hash.slice(0, 12) }, "SemanticCache: exact hit");
      return exact.response;
    }

    const userContent = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
    if (userContent.length < 10) {
      stats.totalMisses++;
      updateHitRate();
      return null;
    }

    const queryEmbedding = await generateEmbedding(userContent);

    const candidates = await db
      .select()
      .from(semanticCacheTable)
      .where(gt(semanticCacheTable.expiresAt, new Date()))
      .limit(200);

    let bestMatch: typeof candidates[0] | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const emb = candidate.embedding as number[];
      if (!Array.isArray(emb) || emb.length === 0) continue;
      const score = cosineSimilarity(queryEmbedding, emb);
      if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch) {
      stats.totalHits++;
      updateHitRate();
      await db.update(semanticCacheTable)
        .set({ hitCount: sql`${semanticCacheTable.hitCount} + 1`, lastHitAt: new Date() })
        .where(eq(semanticCacheTable.id, bestMatch.id));
      logger.info({ score: bestScore.toFixed(3), hash: bestMatch.promptHash.slice(0, 12) }, "SemanticCache: semantic hit");
      return bestMatch.response;
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "SemanticCache: lookup error");
  }

  stats.totalMisses++;
  updateHitRate();
  return null;
}

export async function storeInCache(
  messages: Array<{ role: string; content: string }>,
  model: string,
  response: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const hash = hashPrompt(messages, model);
  const userContent = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    let embedding: number[] = [];
    if (userContent.length >= 10) {
      embedding = await generateEmbedding(userContent);
    }

    await db.insert(semanticCacheTable).values({
      promptHash: hash,
      promptText: userContent.slice(0, 5000),
      embedding,
      response: response.slice(0, 50000),
      model,
      ttlSeconds,
      expiresAt,
    }).onConflictDoNothing();

    const [countRow] = await db.select({ cnt: sql<number>`count(*)::int` }).from(semanticCacheTable);
    stats.cacheSize = countRow?.cnt ?? 0;

    if (stats.cacheSize > MAX_CACHE_SIZE) {
      await evictExpired();
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "SemanticCache: store error");
  }
}

export async function evictExpired(): Promise<number> {
  try {
    const result = await db.delete(semanticCacheTable)
      .where(sql`${semanticCacheTable.expiresAt} < now()`)
      .returning({ id: semanticCacheTable.id });
    const evicted = result.length;
    stats.totalEvictions += evicted;
    if (evicted > 0) {
      logger.info({ evicted }, "SemanticCache: evicted expired entries");
    }
    return evicted;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "SemanticCache: eviction error");
    return 0;
  }
}

export async function invalidateCache(): Promise<void> {
  try {
    await db.delete(semanticCacheTable);
    stats.cacheSize = 0;
    logger.info("SemanticCache: full invalidation");
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "SemanticCache: invalidation error");
  }
}

export function getCacheStats(): CacheStats {
  return { ...stats };
}

export async function initSemanticCache(): Promise<void> {
  try {
    await evictExpired();
    const [countRow] = await db.select({ cnt: sql<number>`count(*)::int` }).from(semanticCacheTable);
    stats.cacheSize = countRow?.cnt ?? 0;
    logger.info({ cacheSize: stats.cacheSize }, "SemanticCache: initialized");
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "SemanticCache: init error");
  }
}
