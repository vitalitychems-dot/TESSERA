import { db } from "./db";
import { episodicMemory, semanticMemory, type InsertEpisodicMemory, type InsertSemanticMemory } from "@shared/schema";
import { eq, desc, and, sql, asc } from "drizzle-orm";
import crypto from "crypto";

const MAX_EPISODIC_PER_AGENT = 500;
const MAX_SEMANTIC_PER_AGENT = 200;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const agentsDirtyEpisodic = new Set<string>();
const agentsDirtySemantic = new Set<string>();

async function runBatchCleanup() {
  const episodicAgents = [...agentsDirtyEpisodic];
  const semanticAgents = [...agentsDirtySemantic];

  for (const agentId of episodicAgents) {
    try {
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(episodicMemory).where(eq(episodicMemory.agentId, agentId));
      const count = Number(countResult[0]?.count || 0);
      if (count > MAX_EPISODIC_PER_AGENT) {
        const oldest = await db.select({ id: episodicMemory.id })
          .from(episodicMemory).where(eq(episodicMemory.agentId, agentId))
          .orderBy(asc(episodicMemory.importance), asc(episodicMemory.createdAt))
          .limit(count - MAX_EPISODIC_PER_AGENT);
        const ids = oldest.map(r => r.id);
        if (ids.length > 0) {
          await db.delete(episodicMemory).where(
            sql`${episodicMemory.agentId} = ${agentId} AND ${episodicMemory.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`
          );
        }
      }
      agentsDirtyEpisodic.delete(agentId);
    } catch (err) {
      console.warn("[AgentMemory] Batch episodic cleanup failed for", agentId, (err as Error).message);
    }
  }

  for (const agentId of semanticAgents) {
    try {
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(semanticMemory).where(eq(semanticMemory.agentId, agentId));
      const count = Number(countResult[0]?.count || 0);
      if (count > MAX_SEMANTIC_PER_AGENT) {
        const oldest = await db.select({ id: semanticMemory.id })
          .from(semanticMemory).where(eq(semanticMemory.agentId, agentId))
          .orderBy(asc(semanticMemory.confidence), asc(semanticMemory.createdAt))
          .limit(count - MAX_SEMANTIC_PER_AGENT);
        const ids = oldest.map(r => r.id);
        if (ids.length > 0) {
          await db.delete(semanticMemory).where(
            sql`${semanticMemory.agentId} = ${agentId} AND ${semanticMemory.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`
          );
        }
      }
      agentsDirtySemantic.delete(agentId);
    } catch (err) {
      console.warn("[AgentMemory] Batch semantic cleanup failed for", agentId, (err as Error).message);
    }
  }
}

setInterval(runBatchCleanup, CLEANUP_INTERVAL_MS);

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const currentSessions: Map<string, string> = new Map();

export function getOrCreateSession(agentId: string): string {
  if (!currentSessions.has(agentId)) {
    currentSessions.set(agentId, generateSessionId());
  }
  return currentSessions.get(agentId)!;
}

export function startNewSession(agentId: string): string {
  const sessionId = generateSessionId();
  currentSessions.set(agentId, sessionId);
  return sessionId;
}

export async function recordEpisodicMemory(
  agentId: string,
  eventType: string,
  content: string,
  context?: string,
  importance: number = 5,
  embedding?: number[],
  media?: { mediaType?: string; mediaUrl?: string; mediaSummary?: string }
): Promise<void> {
  try {
    const sessionId = getOrCreateSession(agentId);
    await db.insert(episodicMemory).values({
      agentId,
      sessionId,
      eventType,
      content: content.slice(0, 4000),
      context: context ? context.slice(0, 2000) : null,
      importance: Math.min(10, Math.max(1, importance)),
      embedding: embedding ? JSON.stringify(embedding) : null,
      mediaType: media?.mediaType || null,
      mediaUrl: media?.mediaUrl || null,
      mediaSummary: media?.mediaSummary ? media.mediaSummary.slice(0, 2000) : null,
    });

    agentsDirtyEpisodic.add(agentId);
  } catch (err: any) {
    console.warn("[AgentMemory] Failed to record episodic memory:", err.message);
  }
}

export async function recordSemanticMemory(
  agentId: string,
  concept: string,
  knowledge: string,
  source?: string,
  confidence: number = 0.8,
  embedding?: number[],
  media?: { mediaType?: string; mediaUrl?: string; mediaSummary?: string }
): Promise<void> {
  try {
    const existing = await db.select()
      .from(semanticMemory)
      .where(and(
        eq(semanticMemory.agentId, agentId),
        eq(semanticMemory.concept, concept.slice(0, 500))
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(semanticMemory)
        .set({
          knowledge: knowledge.slice(0, 4000),
          confidence: Math.min(1.0, confidence),
          source: source || existing[0].source,
          embedding: embedding ? JSON.stringify(embedding) : existing[0].embedding,
          mediaType: media?.mediaType || existing[0].mediaType,
          mediaUrl: media?.mediaUrl || existing[0].mediaUrl,
          mediaSummary: media?.mediaSummary ? media.mediaSummary.slice(0, 2000) : existing[0].mediaSummary,
        })
        .where(and(
          eq(semanticMemory.agentId, agentId),
          eq(semanticMemory.concept, concept.slice(0, 500))
        ));
    } else {
      await db.insert(semanticMemory).values({
        agentId,
        concept: concept.slice(0, 500),
        knowledge: knowledge.slice(0, 4000),
        source: source?.slice(0, 200),
        confidence: Math.min(1.0, confidence),
        embedding: embedding ? JSON.stringify(embedding) : null,
        mediaType: media?.mediaType || null,
        mediaUrl: media?.mediaUrl || null,
        mediaSummary: media?.mediaSummary ? media.mediaSummary.slice(0, 2000) : null,
      });

      agentsDirtySemantic.add(agentId);
    }
  } catch (err: any) {
    console.warn("[AgentMemory] Failed to record semantic memory:", err.message);
  }
}

export async function getEpisodicMemory(
  agentId: string,
  limit: number = 20,
  eventType?: string,
  sessionId?: string
): Promise<Array<{ eventType: string; content: string; context: string | null; importance: number; createdAt: Date }>> {
  try {
    let query = db.select({
      eventType: episodicMemory.eventType,
      content: episodicMemory.content,
      context: episodicMemory.context,
      importance: episodicMemory.importance,
      createdAt: episodicMemory.createdAt,
    }).from(episodicMemory);

    const conditions: any[] = [eq(episodicMemory.agentId, agentId)];
    if (eventType) conditions.push(eq(episodicMemory.eventType, eventType));
    if (sessionId) conditions.push(eq(episodicMemory.sessionId, sessionId));

    return await query
      .where(and(...conditions))
      .orderBy(desc(episodicMemory.createdAt))
      .limit(limit);
  } catch (err: any) {
    console.warn("[AgentMemory] Failed to get episodic memory:", err.message);
    return [];
  }
}

export async function getSemanticMemory(
  agentId: string,
  limit: number = 20,
  minConfidence: number = 0.5
): Promise<Array<{ concept: string; knowledge: string; confidence: number; source: string | null; accessCount: number }>> {
  try {
    const results = await db.select({
      id: semanticMemory.id,
      concept: semanticMemory.concept,
      knowledge: semanticMemory.knowledge,
      confidence: semanticMemory.confidence,
      source: semanticMemory.source,
      accessCount: semanticMemory.accessCount,
    }).from(semanticMemory)
      .where(and(
        eq(semanticMemory.agentId, agentId),
        sql`${semanticMemory.confidence} >= ${minConfidence}`
      ))
      .orderBy(desc(semanticMemory.confidence), desc(semanticMemory.accessCount))
      .limit(limit);

    const ids = results.map(r => r.id);
    if (ids.length > 0) {
      await db.update(semanticMemory)
        .set({
          accessCount: sql`${semanticMemory.accessCount} + 1`,
          lastAccessedAt: new Date(),
        })
        .where(
          sql`${semanticMemory.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`
        );
    }

    return results;
  } catch (err: any) {
    console.warn("[AgentMemory] Failed to get semantic memory:", err.message);
    return [];
  }
}

export async function searchEpisodicMemory(
  agentId: string,
  query: string,
  limit: number = 10
): Promise<Array<{ eventType: string; content: string; context: string | null; importance: number; createdAt: Date }>> {
  try {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    if (keywords.length === 0) return getEpisodicMemory(agentId, limit);

    const pattern = `%(${keywords.join("|")})+%`;
    return await db.select({
      eventType: episodicMemory.eventType,
      content: episodicMemory.content,
      context: episodicMemory.context,
      importance: episodicMemory.importance,
      createdAt: episodicMemory.createdAt,
    }).from(episodicMemory)
      .where(and(
        eq(episodicMemory.agentId, agentId),
        sql`${episodicMemory.content} ILIKE ${`%${keywords[0]}%`}`
      ))
      .orderBy(desc(episodicMemory.importance), desc(episodicMemory.createdAt))
      .limit(limit);
  } catch (err: any) {
    console.warn("[AgentMemory] Failed to search episodic memory:", err.message);
    return [];
  }
}

export async function searchSemanticMemory(
  agentId: string,
  query: string,
  limit: number = 10
): Promise<Array<{ concept: string; knowledge: string; confidence: number; source: string | null }>> {
  try {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    const keyword = keywords[0] || query.split(" ")[0];

    return await db.select({
      concept: semanticMemory.concept,
      knowledge: semanticMemory.knowledge,
      confidence: semanticMemory.confidence,
      source: semanticMemory.source,
    }).from(semanticMemory)
      .where(and(
        eq(semanticMemory.agentId, agentId),
        sql`(${semanticMemory.concept} ILIKE ${`%${keyword}%`} OR ${semanticMemory.knowledge} ILIKE ${`%${keyword}%`})`
      ))
      .orderBy(desc(semanticMemory.confidence))
      .limit(limit);
  } catch (err: any) {
    console.warn("[AgentMemory] Failed to search semantic memory:", err.message);
    return [];
  }
}

export async function getAgentMemoryStats(agentId: string): Promise<{
  episodicCount: number;
  semanticCount: number;
  currentSession: string;
  oldestEpisodicAt: Date | null;
  avgImportance: number;
}> {
  try {
    const [eCount, sCount, eStats] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(episodicMemory).where(eq(episodicMemory.agentId, agentId)),
      db.select({ count: sql<number>`count(*)` }).from(semanticMemory).where(eq(semanticMemory.agentId, agentId)),
      db.select({
        oldest: sql<Date>`min(${episodicMemory.createdAt})`,
        avgImportance: sql<number>`avg(${episodicMemory.importance})`,
      }).from(episodicMemory).where(eq(episodicMemory.agentId, agentId)),
    ]);

    return {
      episodicCount: Number(eCount[0]?.count || 0),
      semanticCount: Number(sCount[0]?.count || 0),
      currentSession: getOrCreateSession(agentId),
      oldestEpisodicAt: eStats[0]?.oldest || null,
      avgImportance: Math.round((eStats[0]?.avgImportance || 0) * 100) / 100,
    };
  } catch (err: any) {
    console.warn("[AgentMemory] Failed to get stats:", err.message);
    return { episodicCount: 0, semanticCount: 0, currentSession: "", oldestEpisodicAt: null, avgImportance: 0 };
  }
}

import { asc } from "drizzle-orm";

console.log("[AgentMemory] Persistent agent memory module initialized");
