/**
 * Long-Term Memory Engine — Real Implementation
 * Stores and retrieves conversation insights, knowledge crystals, and learned
 * patterns across sessions using the database.
 * Replaces in-memory mocks with persistent PostgreSQL-backed storage.
 */

import { db } from "./db";
import { agentMemories } from "@shared/schema";
import { eq, desc, and, sql, like, or } from "drizzle-orm";
import { recordEpisodicMemory, recordSemanticMemory, searchEpisodicMemory, searchSemanticMemory } from "./agent-memory";
import { storeMemory, recallMemory } from "./memory-hierarchy";

const log = (msg: string) => console.log(`[LongTermMemory] ${msg}`);

export interface KnowledgeCrystal {
  id: string;
  topic: string;
  insight: string;
  confidence: number;
  domain: string;
  learnedAt: number;
  reinforcedAt: number;
  reinforcedCount: number;
  agentId: string;
  sourceContext?: string;
}

export interface ConversationInsight {
  id: string;
  sessionId: string;
  agentId: string;
  summary: string;
  keyPoints: string[];
  sentiment: "positive" | "neutral" | "negative";
  importance: number;
  timestamp: number;
  topics: string[];
}

export interface LearnedPattern {
  id: string;
  agentId: string;
  pattern: string;
  domain: string;
  frequency: number;
  successRate: number;
  firstSeen: number;
  lastSeen: number;
  examples: string[];
}

export interface MemoryRetrievalResult {
  crystals: KnowledgeCrystal[];
  insights: ConversationInsight[];
  patterns: LearnedPattern[];
  relevanceScore: number;
  totalFound: number;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function scoreRelevance(query: string, content: string): number {
  const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const contentLower = content.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (contentLower.includes(token)) score += 1;
  }
  return Math.min(1, score / Math.max(1, queryTokens.length));
}

export async function storeKnowledgeCrystal(params: {
  agentId: string;
  topic: string;
  insight: string;
  confidence?: number;
  domain?: string;
  sourceContext?: string;
}): Promise<KnowledgeCrystal> {
  const { agentId, topic, insight, confidence = 0.8, domain = "general", sourceContext } = params;
  const id = generateId("crystal");
  const now = Date.now();

  const crystal: KnowledgeCrystal = {
    id,
    topic,
    insight,
    confidence,
    domain,
    learnedAt: now,
    reinforcedAt: now,
    reinforcedCount: 1,
    agentId,
    sourceContext,
  };

  try {
    await db.insert(agentMemories).values({
      agentId,
      memoryType: "knowledge_crystal",
      content: JSON.stringify(crystal),
      importance: Math.round(confidence * 10),
      dimension: domain,
      metadata: JSON.stringify({ topic, domain, sourceContext }),
    });

    await recordSemanticMemory(agentId, topic, insight, sourceContext || "knowledge_crystal", confidence);

    storeMemory({
      content: `[Crystal] ${topic}: ${insight}`,
      type: "knowledge",
      tags: [domain, topic.toLowerCase().replace(/\s+/g, "_")],
      importance: confidence,
      source: agentId,
    });

    log(`Stored knowledge crystal for ${agentId}: "${topic}"`);
  } catch (err: any) {
    console.warn("[LongTermMemory] Failed to store crystal:", err.message);
  }

  return crystal;
}

export async function reinforceCrystal(agentId: string, topic: string): Promise<boolean> {
  try {
    const existing = await db.select()
      .from(agentMemories)
      .where(and(
        eq(agentMemories.agentId, agentId),
        eq(agentMemories.memoryType, "knowledge_crystal"),
        sql`${agentMemories.metadata}::jsonb->>'topic' = ${topic}`
      ))
      .limit(1);

    if (existing.length > 0) {
      const crystal = JSON.parse(existing[0].content || "{}") as KnowledgeCrystal;
      crystal.reinforcedAt = Date.now();
      crystal.reinforcedCount = (crystal.reinforcedCount || 1) + 1;
      crystal.confidence = Math.min(1.0, crystal.confidence + 0.05);

      await db.update(agentMemories)
        .set({
          content: JSON.stringify(crystal),
          importance: Math.round(crystal.confidence * 10),
        })
        .where(eq(agentMemories.id, existing[0].id));

      return true;
    }
  } catch (err: any) {
    console.warn("[LongTermMemory] Failed to reinforce crystal:", err.message);
  }
  return false;
}

export async function storeConversationInsight(params: {
  agentId: string;
  sessionId: string;
  summary: string;
  keyPoints?: string[];
  sentiment?: "positive" | "neutral" | "negative";
  importance?: number;
  topics?: string[];
}): Promise<ConversationInsight> {
  const {
    agentId, sessionId, summary, keyPoints = [], sentiment = "neutral",
    importance = 5, topics = []
  } = params;

  const insight: ConversationInsight = {
    id: generateId("insight"),
    sessionId,
    agentId,
    summary,
    keyPoints,
    sentiment,
    importance,
    timestamp: Date.now(),
    topics,
  };

  try {
    await db.insert(agentMemories).values({
      agentId,
      memoryType: "conversation_insight",
      content: JSON.stringify(insight),
      importance,
      dimension: "conversation",
      metadata: JSON.stringify({ sessionId, sentiment, topics }),
    });

    await recordEpisodicMemory(
      agentId,
      "conversation_summary",
      summary + (keyPoints.length ? "\n\nKey points: " + keyPoints.join("; ") : ""),
      sessionId,
      importance,
    );

    storeMemory({
      content: `[Session ${sessionId}] ${summary}`,
      type: "conversation",
      tags: ["conversation", ...topics],
      importance: importance / 10,
      source: agentId,
    });

    log(`Stored conversation insight for ${agentId}, session ${sessionId}`);
  } catch (err: any) {
    console.warn("[LongTermMemory] Failed to store insight:", err.message);
  }

  return insight;
}

export async function storeLearnedPattern(params: {
  agentId: string;
  pattern: string;
  domain: string;
  example?: string;
  successRate?: number;
}): Promise<LearnedPattern> {
  const { agentId, pattern, domain, example, successRate = 0.8 } = params;
  const now = Date.now();

  try {
    const existing = await db.select()
      .from(agentMemories)
      .where(and(
        eq(agentMemories.agentId, agentId),
        eq(agentMemories.memoryType, "learned_pattern"),
        sql`${agentMemories.metadata}::jsonb->>'pattern_key' = ${pattern.slice(0, 50)}`
      ))
      .limit(1);

    if (existing.length > 0) {
      const existingPattern = JSON.parse(existing[0].content || "{}") as LearnedPattern;
      existingPattern.frequency = (existingPattern.frequency || 1) + 1;
      existingPattern.lastSeen = now;
      existingPattern.successRate = (existingPattern.successRate * 0.8 + successRate * 0.2);
      if (example && !existingPattern.examples.includes(example)) {
        existingPattern.examples = [...existingPattern.examples.slice(-4), example];
      }

      await db.update(agentMemories)
        .set({ content: JSON.stringify(existingPattern) })
        .where(eq(agentMemories.id, existing[0].id));

      return existingPattern;
    }

    const lp: LearnedPattern = {
      id: generateId("pattern"),
      agentId,
      pattern,
      domain,
      frequency: 1,
      successRate,
      firstSeen: now,
      lastSeen: now,
      examples: example ? [example] : [],
    };

    await db.insert(agentMemories).values({
      agentId,
      memoryType: "learned_pattern",
      content: JSON.stringify(lp),
      importance: 6,
      dimension: domain,
      metadata: JSON.stringify({ pattern_key: pattern.slice(0, 50), domain }),
    });

    log(`Stored learned pattern for ${agentId}: "${pattern.slice(0, 60)}"`);
    return lp;
  } catch (err: any) {
    console.warn("[LongTermMemory] Failed to store pattern:", err.message);
    return {
      id: generateId("pattern"),
      agentId, pattern, domain,
      frequency: 1, successRate,
      firstSeen: now, lastSeen: now,
      examples: example ? [example] : [],
    };
  }
}

export async function retrieveMemories(params: {
  agentId: string;
  query: string;
  limit?: number;
  types?: Array<"crystal" | "insight" | "pattern">;
}): Promise<MemoryRetrievalResult> {
  const { agentId, query, limit = 10, types = ["crystal", "insight", "pattern"] } = params;

  const crystals: KnowledgeCrystal[] = [];
  const insights: ConversationInsight[] = [];
  const patterns: LearnedPattern[] = [];

  try {
    const memTypes: string[] = [];
    if (types.includes("crystal")) memTypes.push("knowledge_crystal");
    if (types.includes("insight")) memTypes.push("conversation_insight");
    if (types.includes("pattern")) memTypes.push("learned_pattern");

    if (memTypes.length > 0) {
      const keyword = query.split(/\s+/).filter(w => w.length > 3)[0] || query.slice(0, 20);

      const rows = await db.select()
        .from(agentMemories)
        .where(and(
          eq(agentMemories.agentId, agentId),
          sql`${agentMemories.memoryType} = ANY(${sql`ARRAY[${sql.join(memTypes.map(t => sql`${t}`), sql`, `)}]`})`,
          or(
            like(agentMemories.content, `%${keyword}%`),
            like(agentMemories.dimension, `%${keyword}%`),
          )
        ))
        .orderBy(desc(agentMemories.importance), desc(agentMemories.createdAt))
        .limit(limit * 2);

      for (const row of rows) {
        try {
          const data = JSON.parse(row.content || "{}");
          if (row.memoryType === "knowledge_crystal") crystals.push(data as KnowledgeCrystal);
          else if (row.memoryType === "conversation_insight") insights.push(data as ConversationInsight);
          else if (row.memoryType === "learned_pattern") patterns.push(data as LearnedPattern);
        } catch {}
      }
    }

    const episodic = await searchEpisodicMemory(agentId, query, 5);
    if (episodic.length > 0) {
      insights.push({
        id: generateId("insight"),
        sessionId: "retrieved",
        agentId,
        summary: episodic.map(e => e.content).join(" | "),
        keyPoints: episodic.slice(0, 3).map(e => e.content.slice(0, 100)),
        sentiment: "neutral",
        importance: Math.round(episodic[0]?.importance || 5),
        timestamp: episodic[0]?.createdAt?.getTime() || Date.now(),
        topics: [query.split(" ")[0]],
      });
    }

    const semantic = await searchSemanticMemory(agentId, query, 5);
    for (const s of semantic) {
      const relevance = scoreRelevance(query, s.concept + " " + s.knowledge);
      if (relevance > 0) {
        crystals.push({
          id: generateId("crystal"),
          topic: s.concept,
          insight: s.knowledge,
          confidence: s.confidence,
          domain: "semantic",
          learnedAt: Date.now(),
          reinforcedAt: Date.now(),
          reinforcedCount: 1,
          agentId,
          sourceContext: s.source || undefined,
        });
      }
    }

  } catch (err: any) {
    console.warn("[LongTermMemory] Retrieval failed:", err.message);
  }

  const allRelevance = [
    ...crystals.map(c => scoreRelevance(query, c.topic + " " + c.insight)),
    ...insights.map(i => scoreRelevance(query, i.summary)),
    ...patterns.map(p => scoreRelevance(query, p.pattern)),
  ];
  const avgRelevance = allRelevance.length > 0
    ? allRelevance.reduce((a, b) => a + b, 0) / allRelevance.length
    : 0;

  return {
    crystals: crystals.slice(0, limit),
    insights: insights.slice(0, limit),
    patterns: patterns.slice(0, limit),
    relevanceScore: Math.round(avgRelevance * 100) / 100,
    totalFound: crystals.length + insights.length + patterns.length,
  };
}

export async function getMemoryStats(agentId?: string): Promise<{
  totalCrystals: number;
  totalInsights: number;
  totalPatterns: number;
  topDomains: string[];
  avgConfidence: number;
}> {
  try {
    const conditions = agentId ? [eq(agentMemories.agentId, agentId)] : [];

    const [crystalCount, insightCount, patternCount, domainStats, avgImportance] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(agentMemories)
        .where(and(...conditions, eq(agentMemories.memoryType, "knowledge_crystal"))),
      db.select({ count: sql<number>`count(*)` })
        .from(agentMemories)
        .where(and(...conditions, eq(agentMemories.memoryType, "conversation_insight"))),
      db.select({ count: sql<number>`count(*)` })
        .from(agentMemories)
        .where(and(...conditions, eq(agentMemories.memoryType, "learned_pattern"))),
      db.select({
        domain: agentMemories.dimension,
        count: sql<number>`count(*)`,
      })
        .from(agentMemories)
        .where(and(...conditions))
        .groupBy(agentMemories.dimension)
        .orderBy(sql`count(*) desc`)
        .limit(5),
      db.select({ avg: sql<number>`coalesce(avg(importance), 0)` })
        .from(agentMemories)
        .where(and(...conditions, eq(agentMemories.memoryType, "knowledge_crystal"))),
    ]);

    const rawAvg = Number(avgImportance[0]?.avg || 0);
    const avgConfidence = rawAvg > 0 ? Math.min(rawAvg / 10, 1) : 0;

    return {
      totalCrystals: Number(crystalCount[0]?.count || 0),
      totalInsights: Number(insightCount[0]?.count || 0),
      totalPatterns: Number(patternCount[0]?.count || 0),
      topDomains: domainStats.map(d => d.domain || "unknown"),
      avgConfidence,
    };
  } catch (err: any) {
    console.warn("[LongTermMemory] Stats failed:", err.message);
    return { totalCrystals: 0, totalInsights: 0, totalPatterns: 0, topDomains: [], avgConfidence: 0 };
  }
}

export async function consolidateMemories(agentId: string): Promise<{
  consolidated: number;
  promoted: number;
}> {
  let consolidated = 0;
  let promoted = 0;

  try {
    const oldInsights = await db.select()
      .from(agentMemories)
      .where(and(
        eq(agentMemories.agentId, agentId),
        eq(agentMemories.memoryType, "conversation_insight"),
        sql`${agentMemories.createdAt} < NOW() - INTERVAL '7 days'`,
        sql`${agentMemories.importance} >= 7`,
      ))
      .limit(20);

    for (const row of oldInsights) {
      try {
        const insight = JSON.parse(row.content || "{}") as ConversationInsight;
        const topicSummary = insight.topics?.join(", ") || "general";
        await storeKnowledgeCrystal({
          agentId,
          topic: `Session insight: ${topicSummary}`,
          insight: insight.summary,
          confidence: 0.75,
          domain: "episodic_promotion",
        });
        promoted++;
        consolidated++;
      } catch {}
    }

    log(`Consolidation for ${agentId}: ${consolidated} consolidated, ${promoted} promoted`);
  } catch (err: any) {
    console.warn("[LongTermMemory] Consolidation failed:", err.message);
  }

  return { consolidated, promoted };
}

log("Long-Term Memory Engine initialized — database-backed knowledge crystals, insights, and patterns");
