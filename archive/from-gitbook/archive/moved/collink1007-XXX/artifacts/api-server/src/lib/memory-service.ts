import { db } from "@workspace/db";
import {
  episodicMemory,
  semanticMemory,
  knowledgeEntries,
  type InsertKnowledgeEntry,
} from "@workspace/db/schema";
import { eq, desc, and, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Column } from "drizzle-orm";

const MEMORY_AGENT_ID = "tessera";

export async function recordEpisodicMemory(params: {
  agentId?: string;
  conversationId?: number;
  eventType?: string;
  content: string;
  context?: string;
  importance?: number;
}): Promise<void> {
  await db.insert(episodicMemory).values({
    agentId: params.agentId ?? MEMORY_AGENT_ID,
    conversationId: params.conversationId ?? null,
    eventType: params.eventType ?? "conversation",
    content: params.content,
    context: params.context ?? null,
    importance: params.importance ?? 5,
  });
}

export async function recordSemanticMemory(params: {
  agentId?: string;
  concept: string;
  knowledge: string;
  source?: string;
  confidence?: number;
}): Promise<void> {
  const existing = await db
    .select()
    .from(semanticMemory)
    .where(
      and(
        eq(semanticMemory.agentId, params.agentId ?? MEMORY_AGENT_ID),
        ilike(semanticMemory.concept, params.concept)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(semanticMemory)
      .set({
        knowledge: params.knowledge,
        confidence: params.confidence ?? 0.8,
        source: params.source ?? existing[0].source,
        accessCount: existing[0].accessCount + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(semanticMemory.id, existing[0].id));
  } else {
    await db.insert(semanticMemory).values({
      agentId: params.agentId ?? MEMORY_AGENT_ID,
      concept: params.concept,
      knowledge: params.knowledge,
      source: params.source ?? null,
      confidence: params.confidence ?? 0.8,
    });
  }
}

export async function searchRelevantMemories(
  query: string,
  agentId = MEMORY_AGENT_ID,
  limit = 5
): Promise<{
  episodic: (typeof episodicMemory.$inferSelect)[];
  semantic: (typeof semanticMemory.$inferSelect)[];
}> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return { episodic: [], semantic: [] };
  }

  const episodicResults = await db
    .select()
    .from(episodicMemory)
    .where(and(
      eq(episodicMemory.agentId, agentId),
      buildKeywordFilter(episodicMemory.content, keywords)
    ))
    .orderBy(desc(episodicMemory.importance), desc(episodicMemory.createdAt))
    .limit(limit);

  const semanticResults = await db
    .select()
    .from(semanticMemory)
    .where(
      and(
        eq(semanticMemory.agentId, agentId),
        or(
          buildKeywordFilter(semanticMemory.concept, keywords),
          buildKeywordFilter(semanticMemory.knowledge, keywords)
        )
      )
    )
    .orderBy(desc(semanticMemory.confidence), desc(semanticMemory.accessCount))
    .limit(limit);

  for (const mem of semanticResults) {
    await db
      .update(semanticMemory)
      .set({
        accessCount: mem.accessCount + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(semanticMemory.id, mem.id));
  }

  return { episodic: episodicResults, semantic: semanticResults };
}

export async function getRecentEpisodicMemories(agentId = MEMORY_AGENT_ID, limit = 10): Promise<(typeof episodicMemory.$inferSelect)[]> {
  return db
    .select()
    .from(episodicMemory)
    .where(eq(episodicMemory.agentId, agentId))
    .orderBy(desc(episodicMemory.createdAt))
    .limit(limit);
}

export async function buildMemoryContext(userMessage: string, agentId = MEMORY_AGENT_ID): Promise<string> {
  const memories = await searchRelevantMemories(userMessage, agentId, 6);
  const recentKnowledge = await searchKnowledgeEntries(userMessage, 3);

  const parts: string[] = [];

  if (memories.episodic.length > 0) {
    const episodicLines = memories.episodic
      .map(m => `• [${m.eventType}] ${m.content}`)
      .join("\n");
    parts.push(`EPISODIC MEMORIES (relevant past events):\n${episodicLines}`);
  }

  if (memories.semantic.length > 0) {
    const semanticLines = memories.semantic
      .map(m => `• ${m.concept}: ${m.knowledge}`)
      .join("\n");
    parts.push(`KNOWN FACTS & CONCEPTS:\n${semanticLines}`);
  }

  if (recentKnowledge.length > 0) {
    const knowledgeLines = recentKnowledge
      .map(k => `• [${k.category}] ${k.title}: ${k.content.slice(0, 200)}`)
      .join("\n");
    parts.push(`KNOWLEDGE BASE:\n${knowledgeLines}`);
  }

  if (parts.length === 0) return "";

  return `\n\nMEMORY CONTEXT (use this to inform your response, recall naturally):\n${parts.join("\n\n")}`;
}

export async function extractAndStoreMemories(params: {
  conversationId: number;
  userMessage: string;
  assistantResponse: string;
  agentId: string;
}): Promise<void> {
  try {
    const storePromises: Promise<void>[] = [];
    const userMsg = params.userMessage.trim();
    const assistantResp = params.assistantResponse.trim();

    if (userMsg.length > 20) {
      storePromises.push(
        recordEpisodicMemory({
          agentId: params.agentId,
          conversationId: params.conversationId,
          eventType: "conversation",
          content: `User: ${userMsg.slice(0, 300)}`,
          context: `conv:${params.conversationId}`,
          importance: 5,
        })
      );
    }

    const keywords = extractKeywords(userMsg);
    if (keywords.length >= 2 && assistantResp.length > 50) {
      const concept = keywords.slice(0, 3).join(" ");
      storePromises.push(
        recordSemanticMemory({
          agentId: params.agentId,
          concept,
          knowledge: assistantResp.slice(0, 500),
          source: `conv:${params.conversationId}`,
          confidence: 0.7,
        })
      );
    }

    await Promise.allSettled(storePromises);
  } catch (err) {
    console.error("[Memory] Extraction failed:", err);
  }
}

export async function storeKnowledgeEntry(params: InsertKnowledgeEntry): Promise<void> {
  await db.insert(knowledgeEntries).values(params);
}

export async function searchKnowledgeEntries(
  query: string,
  limit = 10
): Promise<(typeof knowledgeEntries.$inferSelect)[]> {
  if (!query || query.trim().length === 0) {
    return db
      .select()
      .from(knowledgeEntries)
      .orderBy(desc(knowledgeEntries.importance), desc(knowledgeEntries.createdAt))
      .limit(limit);
  }

  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return db
      .select()
      .from(knowledgeEntries)
      .orderBy(desc(knowledgeEntries.importance), desc(knowledgeEntries.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(knowledgeEntries)
    .where(
      or(
        buildKeywordFilter(knowledgeEntries.title, keywords),
        buildKeywordFilter(knowledgeEntries.content, keywords),
        buildKeywordFilter(knowledgeEntries.tags, keywords)
      )
    )
    .orderBy(desc(knowledgeEntries.importance), desc(knowledgeEntries.accessCount))
    .limit(limit);
}

export async function getAllKnowledgeEntries(params: {
  limit?: number;
  offset?: number;
  category?: string;
}): Promise<{ entries: (typeof knowledgeEntries.$inferSelect)[]; total: number }> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const conditions = params.category ? [eq(knowledgeEntries.category, params.category)] : [];

  const [entries, countResult] = await Promise.all([
    db
      .select()
      .from(knowledgeEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(knowledgeEntries.importance), desc(knowledgeEntries.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return { entries, total: Number(countResult[0]?.count ?? 0) };
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "me", "my", "i", "you", "we",
    "it", "its", "this", "that", "what", "how", "why", "when", "where",
    "which", "who", "not", "no", "so", "if", "as", "up", "about", "into",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 8);
}

function buildKeywordFilter(column: Column, keywords: string[]): SQL {
  const conditions = keywords.map(kw => ilike(column, `%${kw}%`));
  return conditions.length === 1 ? conditions[0] : or(...conditions) as SQL;
}
