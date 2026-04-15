import { db } from "@workspace/db";
import { distilledKnowledgeTable } from "@workspace/db/schema";
import { eq, sql, desc, gt } from "drizzle-orm";
import { logger } from "./logger";

const CONFIDENCE_THRESHOLD = 0.6;
const STALE_DAYS = 7;
const MAX_FACTS = 10000;

const distillStats = {
  totalExtracted: 0,
  totalLookups: 0,
  lookupHits: 0,
  staleRefreshes: 0,
};

function extractFacts(response: string, category: string): Array<{ fact: string; confidence: number }> {
  const facts: Array<{ fact: string; confidence: number }> = [];
  const sentences = response
    .split(/[.!?\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500);

  const factPatterns = [
    { pattern: /\b(?:is|are|was|were|equals?|means?|refers? to|defined as)\b/i, boost: 0.15 },
    { pattern: /\b(?:always|never|must|shall|every|all|no)\b/i, boost: 0.1 },
    { pattern: /\b(?:because|therefore|thus|hence|consequently)\b/i, boost: 0.1 },
    { pattern: /\b\d+(?:\.\d+)?(?:%|hz|km|kg|mb|gb)\b/i, boost: 0.2 },
  ];

  for (const sentence of sentences) {
    let confidence = 0.5;
    let isFactual = false;

    for (const { pattern, boost } of factPatterns) {
      if (pattern.test(sentence)) {
        confidence += boost;
        isFactual = true;
      }
    }

    if (isFactual && confidence >= CONFIDENCE_THRESHOLD) {
      facts.push({
        fact: sentence.slice(0, 500),
        confidence: Math.min(confidence, 1.0),
      });
    }
  }

  return facts.slice(0, 5);
}

export async function distillFromResponse(
  response: string,
  sourcePrompt: string,
  category = "general",
): Promise<number> {
  const facts = extractFacts(response, category);
  if (facts.length === 0) return 0;

  let stored = 0;
  for (const { fact, confidence } of facts) {
    try {
      const [existing] = await db
        .select()
        .from(distilledKnowledgeTable)
        .where(eq(distilledKnowledgeTable.fact, fact))
        .limit(1);

      if (existing) {
        await db
          .update(distilledKnowledgeTable)
          .set({
            confidence: Math.max(existing.confidence, confidence),
            accessCount: sql`${distilledKnowledgeTable.accessCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(distilledKnowledgeTable.id, existing.id));
      } else {
        await db.insert(distilledKnowledgeTable).values({
          fact,
          category,
          source: "llm",
          sourcePrompt: sourcePrompt.slice(0, 2000),
          confidence,
        });
        stored++;
      }
    } catch (err) {
      logger.debug({ err: (err as Error).message }, "KnowledgeDistillation: store error");
    }
  }

  distillStats.totalExtracted += stored;
  if (stored > 0) {
    logger.info({ stored, category }, "KnowledgeDistillation: facts extracted");
  }
  return stored;
}

export async function lookupKnowledge(
  query: string,
  category?: string,
  limit = 5,
): Promise<Array<{ fact: string; confidence: number; category: string }>> {
  distillStats.totalLookups++;

  try {
    const queryTerms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 2);

    if (queryTerms.length === 0) return [];

    const rows = await db
      .select()
      .from(distilledKnowledgeTable)
      .where(gt(distilledKnowledgeTable.confidence, CONFIDENCE_THRESHOLD))
      .orderBy(desc(distilledKnowledgeTable.confidence))
      .limit(500);

    const scored = rows
      .filter(r => !category || r.category === category)
      .map(r => {
        const factLower = r.fact.toLowerCase();
        const matches = queryTerms.filter(t => factLower.includes(t)).length;
        const relevance = matches / queryTerms.length;
        return { ...r, relevance };
      })
      .filter(r => r.relevance > 0.3)
      .sort((a, b) => b.relevance * b.confidence - a.relevance * a.confidence)
      .slice(0, limit);

    if (scored.length > 0) {
      distillStats.lookupHits++;
      for (const r of scored) {
        await db
          .update(distilledKnowledgeTable)
          .set({ accessCount: sql`${distilledKnowledgeTable.accessCount} + 1` })
          .where(eq(distilledKnowledgeTable.id, r.id));
      }
    }

    return scored.map(r => ({
      fact: r.fact,
      confidence: r.confidence,
      category: r.category,
    }));
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "KnowledgeDistillation: lookup error");
    return [];
  }
}

export async function refreshStaleKnowledge(): Promise<number> {
  try {
    const staleDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    const staleRows = await db
      .select()
      .from(distilledKnowledgeTable)
      .where(sql`${distilledKnowledgeTable.updatedAt} < ${staleDate}`)
      .limit(50);

    let refreshed = 0;
    for (const row of staleRows) {
      await db
        .update(distilledKnowledgeTable)
        .set({
          confidence: Math.max(row.confidence * 0.9, 0.3),
          verified: false,
          updatedAt: new Date(),
        })
        .where(eq(distilledKnowledgeTable.id, row.id));
      refreshed++;
    }

    distillStats.staleRefreshes += refreshed;
    return refreshed;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "KnowledgeDistillation: refresh error");
    return 0;
  }
}

export async function getDistillationStats() {
  try {
    const [countRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(distilledKnowledgeTable);
    const [verifiedRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(distilledKnowledgeTable)
      .where(eq(distilledKnowledgeTable.verified, true));

    return {
      ...distillStats,
      totalFacts: countRow?.cnt ?? 0,
      verifiedFacts: verifiedRow?.cnt ?? 0,
      hitRate: distillStats.totalLookups > 0
        ? distillStats.lookupHits / distillStats.totalLookups
        : 0,
    };
  } catch {
    return { ...distillStats, totalFacts: 0, verifiedFacts: 0, hitRate: 0 };
  }
}
