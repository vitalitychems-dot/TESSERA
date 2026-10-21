import { db } from "./db";
import { episodicMemory, semanticMemory } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { generateEmbedding } from "./embedding-service";
import { ingestDocument } from "./rag-pipeline";

const INGESTION_BATCH_SIZE = 5;
const ingestionQueue: Array<{
  type: "conversation" | "decision" | "interaction" | "learning";
  agentId: string;
  content: string;
  context?: string;
  importance?: number;
  metadata?: Record<string, any>;
}> = [];

let isProcessing = false;

function formatVectorForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function vecColForDim(dim: number): string {
  return dim === 1536 ? "embedding_vector" : "embedding_vector_256";
}

export async function ingestMemory(entry: {
  type: "conversation" | "decision" | "interaction" | "learning";
  agentId: string;
  content: string;
  context?: string;
  importance?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  ingestionQueue.push(entry);
  if (!isProcessing) {
    processIngestionQueue().catch(err =>
      console.warn("[MemoryIngestion] Queue processing error:", err.message)
    );
  }
}

async function processIngestionQueue(): Promise<void> {
  if (isProcessing || ingestionQueue.length === 0) return;
  isProcessing = true;

  try {
    while (ingestionQueue.length > 0) {
      const batch = ingestionQueue.splice(0, INGESTION_BATCH_SIZE);
      await Promise.allSettled(batch.map(entry => persistMemoryEntry(entry)));
    }
  } finally {
    isProcessing = false;
  }
}

async function persistMemoryEntry(entry: typeof ingestionQueue[0]): Promise<void> {
  try {
    const { embedding, dim } = await generateEmbedding(entry.content.slice(0, 2000));
    const importance = entry.importance ?? (entry.type === "decision" ? 8 : 5);
    await db.execute(sql`
      INSERT INTO episodic_memory (agent_id, event_type, content, context, importance, embedding, embedding_dim)
      VALUES (${entry.agentId}, ${entry.type}, ${entry.content.slice(0, 4000)}, ${entry.context ? entry.context.slice(0, 2000) : null}, ${importance}, ${JSON.stringify(embedding)}, ${dim})
    `);
  } catch (err: any) {
    console.warn("[MemoryIngestion] Failed to persist entry:", err.message);
  }
}

export async function ingestConversationTurn(
  agentId: string,
  userMessage: string,
  agentResponse: string,
  sessionId?: string
): Promise<void> {
  const content = `User: ${userMessage}\nAgent: ${agentResponse}`;
  try {
    const { embedding, dim } = await generateEmbedding(content.slice(0, 2000));
    await db.execute(sql`
      INSERT INTO episodic_memory (agent_id, session_id, event_type, content, importance, embedding, embedding_dim)
      VALUES (${agentId}, ${sessionId ?? null}, ${"conversation"}, ${content.slice(0, 4000)}, ${5}, ${JSON.stringify(embedding)}, ${dim})
    `);
    const title = `Conversation: ${agentId} — ${new Date().toISOString().slice(0, 10)}`;
    await ingestDocument(title, content, `agent:${agentId}`, {
      agentId, sessionId, type: "conversation", timestamp: new Date().toISOString(),
    }).catch(() => {});
  } catch (err: any) {
    console.warn("[MemoryIngestion] Failed to ingest conversation turn:", err.message);
  }
}

export async function ingestCouncilDecision(
  agentId: string,
  topic: string,
  decision: string,
  rationale?: string
): Promise<void> {
  const content = `Decision on "${topic}": ${decision}${rationale ? `\nRationale: ${rationale}` : ""}`;
  try {
    const { embedding, dim } = await generateEmbedding(content.slice(0, 2000));
    await db.execute(sql`
      INSERT INTO episodic_memory (agent_id, event_type, content, importance, embedding, embedding_dim)
      VALUES (${agentId}, ${"council_decision"}, ${content.slice(0, 4000)}, ${9}, ${JSON.stringify(embedding)}, ${dim})
    `);

    const knowledgeContent = decision;
    const { embedding: kEmb, dim: kDim } = await generateEmbedding(`${topic} ${knowledgeContent}`.slice(0, 2000));
    const existing = await db.select({ id: semanticMemory.id })
      .from(semanticMemory)
      .where(eq(semanticMemory.concept, topic.slice(0, 500)))
      .limit(1);

    if (existing.length > 0) {
      await db.execute(sql`
        UPDATE semantic_memory SET knowledge = ${knowledgeContent.slice(0, 4000)}, embedding = ${JSON.stringify(kEmb)}, embedding_dim = ${kDim}, confidence = ${0.9}
        WHERE concept = ${topic.slice(0, 500)}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO semantic_memory (agent_id, concept, knowledge, source, confidence, embedding, embedding_dim)
        VALUES (${agentId}, ${topic.slice(0, 500)}, ${knowledgeContent.slice(0, 4000)}, ${"council_decision"}, ${0.9}, ${JSON.stringify(kEmb)}, ${kDim})
      `);
    }
  } catch (err: any) {
    console.warn("[MemoryIngestion] Failed to ingest council decision:", err.message);
  }
}

export async function retrieveRelevantMemories(
  query: string,
  agentId?: string,
  topK: number = 5,
  minScore: number = 0.1
): Promise<Array<{
  type: string;
  content: string;
  score: number;
  importance: number;
  createdAt: Date;
}>> {
  try {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const agentSql = agentId ? sql`AND agent_id = ${agentId}` : sql``;

    const episodicRows = await db.execute(sql`
      SELECT event_type AS type, content, importance, created_at
      FROM episodic_memory WHERE 1=1 ${agentSql}
      ORDER BY importance DESC, created_at DESC LIMIT ${topK * 3}
    `);
    const semanticRows = await db.execute(sql`
      SELECT 'semantic' AS type, knowledge AS content, 8 AS importance, created_at
      FROM semantic_memory WHERE 1=1 ${agentSql}
      ORDER BY confidence DESC, created_at DESC LIMIT ${topK * 2}
    `);

    const allRows = [...(episodicRows.rows as any[]), ...(semanticRows.rows as any[])];
    const scored = allRows.map(r => {
      const contentLower = (r.content || "").toLowerCase();
      const matchCount = keywords.filter(k => contentLower.includes(k)).length;
      return {
        type: r.type,
        content: r.content,
        score: keywords.length > 0 ? matchCount / keywords.length : 0.5,
        importance: Number(r.importance) || 5,
        createdAt: r.created_at,
      };
    });

    return scored
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score || b.importance - a.importance)
      .slice(0, topK);
  } catch (err: any) {
    console.warn("[MemoryIngestion] Recall failed:", err.message);
    return [];
  }
}

export async function getMemoryIngestionStats(): Promise<{
  totalEpisodic: number;
  totalSemantic: number;
  queueSize: number;
  isProcessing: boolean;
}> {
  try {
    const [episodicCount, semanticCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(episodicMemory),
      db.select({ count: sql<number>`count(*)` }).from(semanticMemory),
    ]);
    return {
      totalEpisodic: Number(episodicCount[0]?.count || 0),
      totalSemantic: Number(semanticCount[0]?.count || 0),
      queueSize: ingestionQueue.length,
      isProcessing,
    };
  } catch {
    return { totalEpisodic: 0, totalSemantic: 0, queueSize: ingestionQueue.length, isProcessing };
  }
}

console.log("[MemoryIngestion] Real-time memory ingestion service initialized");
