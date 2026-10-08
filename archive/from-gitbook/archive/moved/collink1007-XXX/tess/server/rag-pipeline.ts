import { db } from "./db";
import { ragDocuments, ragChunks, type InsertRagDocument, type InsertRagChunk } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "./embedding-service";
import crypto from "crypto";

const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 64;
const MAX_CHUNKS_PER_DOC = 200;

function chunkText(text: string, chunkSize: number = DEFAULT_CHUNK_SIZE, overlap: number = DEFAULT_CHUNK_OVERLAP): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  let overlapBuffer = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    const estimatedTokens = Math.ceil(candidate.length / 4);

    if (estimatedTokens > chunkSize && current) {
      chunks.push(current.trim());
      const words = current.split(" ");
      const overlapWords = words.slice(-Math.floor(overlap));
      overlapBuffer = overlapWords.join(" ");
      current = `${overlapBuffer} ${sentence}`.trim();
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  if (chunks.length === 0 && text.trim()) {
    const words = text.split(" ");
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }
  }

  return chunks.slice(0, MAX_CHUNKS_PER_DOC);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function ingestDocument(
  title: string,
  content: string,
  source: string = "manual",
  metadata?: Record<string, any>
): Promise<{ documentId: string; chunksCreated: number; status: string }> {
  const contentHash = crypto.createHash("sha256").update(content).digest("hex");
  const documentId = crypto.createHash("sha256").update(`${title}::${source}::${contentHash}`).digest("hex").slice(0, 24);

  try {
    const existing = await db.select({ id: ragDocuments.id, status: ragDocuments.status })
      .from(ragDocuments)
      .where(eq(ragDocuments.documentId, documentId))
      .limit(1);

    if (existing.length > 0 && existing[0].status === "indexed") {
      return { documentId, chunksCreated: 0, status: "already_indexed" };
    }

    if (existing.length === 0) {
      await db.insert(ragDocuments).values({
        documentId,
        title: title.slice(0, 500),
        source: source.slice(0, 200),
        contentHash,
        status: "processing",
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    } else {
      await db.update(ragDocuments)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(ragDocuments.documentId, documentId));
    }

    await db.delete(ragChunks).where(eq(ragChunks.documentId, documentId));

    const chunks = chunkText(content);
    let chunksCreated = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const { embedding, model, dim } = await generateEmbedding(chunkContent);

      const embJson = JSON.stringify(embedding);
      const chunkMeta = metadata ? JSON.stringify({ ...metadata, chunkIndex: i, totalChunks: chunks.length }) : null;

      await db.execute(sql`
        INSERT INTO rag_chunks (document_id, chunk_index, content, embedding, embedding_dim, token_count, metadata)
        VALUES (${documentId}, ${i}, ${chunkContent.slice(0, 8000)}, ${embJson}, ${dim}, ${estimateTokens(chunkContent)}, ${chunkMeta})
      `);
      chunksCreated++;
    }

    await db.update(ragDocuments)
      .set({
        status: "indexed",
        totalChunks: chunksCreated,
        updatedAt: new Date(),
      })
      .where(eq(ragDocuments.documentId, documentId));

    console.log(`[RAG] Indexed document "${title}": ${chunksCreated} chunks from ${content.length} chars`);
    return { documentId, chunksCreated, status: "indexed" };
  } catch (err: any) {
    console.warn("[RAG] Failed to ingest document:", err.message);
    try {
      await db.update(ragDocuments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(ragDocuments.documentId, documentId));
    } catch {}
    return { documentId, chunksCreated: 0, status: "failed" };
  }
}

export interface RetrievedChunk {
  documentId: string;
  title: string;
  content: string;
  score: number;
  chunkIndex: number;
  source: string;
}

export async function retrieveRelevantChunks(
  query: string,
  topK: number = 5,
  minScore: number = 0.1
): Promise<RetrievedChunk[]> {
  try {
    const { embedding: queryEmbedding } = await generateEmbedding(query);

    // JS-side cosine similarity search (pgvector not installed — JSON embedding path)
    const rows = await db.select({
      documentId: ragChunks.documentId,
      chunkIndex: ragChunks.chunkIndex,
      content: ragChunks.content,
      embedding: ragChunks.embedding,
    }).from(ragChunks).limit(5000);

    const docTitles = new Map<string, string>();
    const docSources = new Map<string, string>();
    const docs = await db.select({
      documentId: ragDocuments.documentId,
      title: ragDocuments.title,
      source: ragDocuments.source,
    }).from(ragDocuments);
    for (const d of docs) {
      docTitles.set(d.documentId, d.title);
      docSources.set(d.documentId, d.source);
    }

    const scored: { chunk: typeof rows[0]; score: number }[] = [];
    for (const chunk of rows) {
      if (!chunk.embedding) continue;
      try {
        const vec = JSON.parse(chunk.embedding) as number[];
        const score = cosineSimilarity(queryEmbedding, vec);
        if (score >= minScore) {
          scored.push({ chunk, score });
        }
      } catch {
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ chunk, score }) => ({
      documentId: chunk.documentId,
      title: docTitles.get(chunk.documentId) || "Unknown",
      content: chunk.content,
      score,
      chunkIndex: chunk.chunkIndex,
      source: docSources.get(chunk.documentId) || "unknown",
    }));
  } catch (err: any) {
    console.warn("[RAG] Failed to retrieve chunks:", err.message);
    return [];
  }
}

export async function buildRagContext(
  query: string,
  topK: number = 5,
  maxContextTokens: number = 2000
): Promise<{ context: string; sources: string[]; chunksUsed: number }> {
  const chunks = await retrieveRelevantChunks(query, topK * 2);
  if (chunks.length === 0) {
    return { context: "", sources: [], chunksUsed: 0 };
  }

  let context = "RELEVANT KNOWLEDGE BASE CONTEXT:\n";
  const sources = new Set<string>();
  let totalTokens = 0;
  let chunksUsed = 0;

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.content);
    if (totalTokens + chunkTokens > maxContextTokens) break;

    context += `\n[${chunk.title} — score: ${chunk.score.toFixed(3)}]\n${chunk.content}\n`;
    sources.add(chunk.title);
    totalTokens += chunkTokens;
    chunksUsed++;
  }

  return { context: context.trim(), sources: Array.from(sources), chunksUsed };
}

export async function augmentPromptWithRag(
  userQuery: string,
  basePrompt: string,
  topK: number = 3,
  agentId?: string
): Promise<string> {
  const { context, sources, chunksUsed } = await buildRagContext(userQuery, topK);

  // Also retrieve relevant memories from episodic/semantic memory
  let memoryContext = "";
  try {
    const { retrieveRelevantMemories } = await import("./memory-ingestion");
    const memories = await retrieveRelevantMemories(userQuery, agentId, 3, 0.15);
    if (memories.length > 0) {
      memoryContext = "\nRELEVANT AGENT MEMORIES:\n";
      for (const mem of memories) {
        memoryContext += `[${mem.type} — score: ${mem.score.toFixed(3)}]\n${mem.content.slice(0, 500)}\n\n`;
      }
    }
  } catch {
  }

  if (!context && !memoryContext) return basePrompt;

  const parts: string[] = [];
  if (context && chunksUsed > 0) parts.push(context);
  if (memoryContext) parts.push(memoryContext.trim());
  parts.push("---");
  parts.push(basePrompt);

  return parts.join("\n\n");
}

export async function getRagStats(): Promise<{
  totalDocuments: number;
  indexedDocuments: number;
  totalChunks: number;
  processingDocuments: number;
  failedDocuments: number;
}> {
  try {
    const [docStats, chunkCount] = await Promise.all([
      db.select({
        status: ragDocuments.status,
        count: sql<number>`count(*)`,
      }).from(ragDocuments).groupBy(ragDocuments.status),
      db.select({ count: sql<number>`count(*)` }).from(ragChunks),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of docStats) {
      byStatus[row.status] = Number(row.count);
    }

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    return {
      totalDocuments: total,
      indexedDocuments: byStatus["indexed"] || 0,
      totalChunks: Number(chunkCount[0]?.count || 0),
      processingDocuments: byStatus["processing"] || 0,
      failedDocuments: byStatus["failed"] || 0,
    };
  } catch (err: any) {
    console.warn("[RAG] Failed to get stats:", err.message);
    return { totalDocuments: 0, indexedDocuments: 0, totalChunks: 0, processingDocuments: 0, failedDocuments: 0 };
  }
}

export async function listDocuments(limit: number = 50): Promise<Array<{
  documentId: string;
  title: string;
  source: string;
  status: string;
  totalChunks: number;
  createdAt: Date;
}>> {
  try {
    return await db.select({
      documentId: ragDocuments.documentId,
      title: ragDocuments.title,
      source: ragDocuments.source,
      status: ragDocuments.status,
      totalChunks: ragDocuments.totalChunks,
      createdAt: ragDocuments.createdAt,
    }).from(ragDocuments)
      .orderBy(desc(ragDocuments.createdAt))
      .limit(limit);
  } catch (err: any) {
    console.warn("[RAG] Failed to list documents:", err.message);
    return [];
  }
}

console.log("[RAG] Pipeline initialized — JSON embedding storage with JS cosine similarity retrieval active");
