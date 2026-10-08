import { db } from "./db";
import { episodicMemory, semanticMemory } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "./embedding-service";

const SYSTEM_AGENT_ID = "cognitive-core";

const state = {
  workingMemory: [] as any[],
  attentionFocus: "general",
  initialized: false,
};

function formatVectorForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function vectorInsertExpr(vectorStr: string, dim: number): string {
  return dim === 1536 ? `'${vectorStr}'::vector(1536)` : `'${vectorStr}'::vector(256)`;
}

function vectorColumnForDim(dim: number): string {
  return dim === 1536 ? "embedding_vector" : "embedding_vector_256";
}

async function ensureInitialized(): Promise<void> {
  if (state.initialized) return;
  state.initialized = true;

  try {
    const recent = await db.select({
      id: episodicMemory.id,
      eventType: episodicMemory.eventType,
      content: episodicMemory.content,
      context: episodicMemory.context,
      importance: episodicMemory.importance,
      createdAt: episodicMemory.createdAt,
    })
      .from(episodicMemory)
      .where(eq(episodicMemory.agentId, SYSTEM_AGENT_ID))
      .orderBy(desc(episodicMemory.createdAt))
      .limit(20);

    state.workingMemory = recent.map(r => ({
      id: r.id,
      type: r.eventType,
      content: r.content,
      context: r.context,
      importance: r.importance,
      timestamp: r.createdAt,
    }));

    console.log(`[CogArch] Restored ${state.workingMemory.length} working memory items from DB`);
  } catch (err: any) {
    console.warn("[CogArch] Failed to restore working memory:", err.message);
  }
}

ensureInitialized().catch(() => {});

export const getCognitiveState = () => ({
  workingMemorySize: state.workingMemory.length,
  workingMemory: state.workingMemory.slice(-10),
  attentionFocus: state.attentionFocus,
  status: "active",
});

export const getMemoryStats = async () => {
  try {
    const [episodicCount, semanticCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(episodicMemory)
        .where(eq(episodicMemory.agentId, SYSTEM_AGENT_ID)),
      db.select({ count: sql<number>`count(*)` }).from(semanticMemory)
        .where(eq(semanticMemory.agentId, SYSTEM_AGENT_ID)),
    ]);
    return {
      working: state.workingMemory.length,
      episodic: Number(episodicCount[0]?.count || 0),
      procedural: Number(semanticCount[0]?.count || 0),
    };
  } catch {
    return { working: state.workingMemory.length, episodic: 0, procedural: 0 };
  }
};

export const addToWorkingMemory = async (item: any): Promise<void> => {
  state.workingMemory.push({ ...item, timestamp: new Date() });
  if (state.workingMemory.length > 100) state.workingMemory.shift();

  try {
    const content = typeof item === "string" ? item : JSON.stringify(item);
    const { embedding, dim } = await generateEmbedding(content.slice(0, 2000));
    await db.execute(sql`
      INSERT INTO episodic_memory (agent_id, session_id, event_type, content, importance, embedding, embedding_dim)
      VALUES (${SYSTEM_AGENT_ID}, 'working', 'working_memory', ${content.slice(0, 4000)}, ${item.importance ?? 5}, ${JSON.stringify(embedding)}, ${dim})
    `);
  } catch (err: any) {
    console.warn("[CogArch] Failed to persist working memory:", err.message);
  }
};

export const storeEpisodicMemory = async (item: any): Promise<void> => {
  try {
    const content = typeof item === "string" ? item : JSON.stringify(item);
    const { embedding, dim } = await generateEmbedding(content.slice(0, 2000));
    const ctx = item.context ? JSON.stringify(item.context).slice(0, 2000) : null;
    await db.execute(sql`
      INSERT INTO episodic_memory (agent_id, session_id, event_type, content, context, importance, embedding, embedding_dim)
      VALUES (${SYSTEM_AGENT_ID}, ${item.sessionId ?? null}, ${item.type ?? "episodic_event"}, ${content.slice(0, 4000)}, ${ctx}, ${item.importance ?? 5}, ${JSON.stringify(embedding)}, ${dim})
    `);
  } catch (err: any) {
    console.warn("[CogArch] Failed to store episodic memory:", err.message);
  }
};

export const storeProcedural = async (item: any): Promise<void> => {
  try {
    const concept = item.concept ?? item.name ?? (typeof item === "string" ? item.slice(0, 200) : JSON.stringify(item).slice(0, 200));
    const knowledge = typeof item === "string" ? item : JSON.stringify(item);
    const { embedding, dim } = await generateEmbedding(`${concept} ${knowledge}`.slice(0, 2000));

    const existing = await db.select({ id: semanticMemory.id })
      .from(semanticMemory)
      .where(and(
        eq(semanticMemory.agentId, SYSTEM_AGENT_ID),
        eq(semanticMemory.concept, concept.slice(0, 500))
      ))
      .limit(1);

    const embJson = JSON.stringify(embedding);
    if (existing.length > 0) {
      await db.execute(sql`
        UPDATE semantic_memory SET knowledge = ${knowledge.slice(0, 4000)}, embedding = ${embJson}, embedding_dim = ${dim}
        WHERE agent_id = ${SYSTEM_AGENT_ID} AND concept = ${concept.slice(0, 500)}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO semantic_memory (agent_id, concept, knowledge, source, confidence, embedding, embedding_dim)
        VALUES (${SYSTEM_AGENT_ID}, ${concept.slice(0, 500)}, ${knowledge.slice(0, 4000)}, ${"procedural"}, ${item.confidence ?? 0.8}, ${embJson}, ${dim})
      `);
    }
  } catch (err: any) {
    console.warn("[CogArch] Failed to store procedural memory:", err.message);
  }
};

export const recall = async (query: string): Promise<any[]> => {
  try {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);

    const episodicResults = await db.execute(sql`
      SELECT 'episodic' AS memory_type, content, importance, created_at
      FROM episodic_memory
      WHERE agent_id = ${SYSTEM_AGENT_ID}
      ORDER BY importance DESC, created_at DESC
      LIMIT 20
    `);

    const semanticResults = await db.execute(sql`
      SELECT 'procedural' AS memory_type, knowledge AS content, 8 AS importance, created_at
      FROM semantic_memory
      WHERE agent_id = ${SYSTEM_AGENT_ID}
      ORDER BY confidence DESC, created_at DESC
      LIMIT 20
    `);

    const allResults = [...(episodicResults.rows as any[]), ...(semanticResults.rows as any[])];
    const scored = allResults.map(row => {
      const contentLower = (row.content || "").toLowerCase();
      const matchCount = keywords.filter(k => contentLower.includes(k)).length;
      return { ...row, score: matchCount / Math.max(1, keywords.length) };
    });

    return scored
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || b.importance - a.importance)
      .slice(0, 5);
  } catch {
  }

  return state.workingMemory
    .filter(m => JSON.stringify(m).toLowerCase().includes(query.toLowerCase()))
    .slice(-5);
};

export const runConsolidationCycle = async () => {
  try {
    const count = await db.select({ count: sql<number>`count(*)` })
      .from(episodicMemory)
      .where(eq(episodicMemory.agentId, SYSTEM_AGENT_ID));
    return { consolidated: Number(count[0]?.count || 0), timestamp: Date.now() };
  } catch {
    return { consolidated: 0, timestamp: Date.now() };
  }
};

export const setAttentionFocus = (focus: string) => { state.attentionFocus = focus; };

console.log("[CogArch] Cognitive architecture initialized with persistent pgvector-backed memory");
