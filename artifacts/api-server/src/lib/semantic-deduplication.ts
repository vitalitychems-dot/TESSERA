import { db } from "@workspace/db";
import { vectorEmbeddingsTable, distilledKnowledgeTable, systemStateTable } from "@workspace/db/schema";
import { eq, sql, desc, gt } from "drizzle-orm";
import { generateEmbedding, generateEmbeddingsBatch, cosineSimilarity } from "./neural-embeddings";
import { logger } from "./logger";

const SIMILARITY_THRESHOLD = 0.92;
const SCAN_BATCH_SIZE = 100;
const REDIRECT_STATE_KEY = "dedup.redirectMap";

interface DuplicateCluster {
  canonicalId: number;
  duplicateIds: number[];
  similarity: number;
  table: "vector_embeddings" | "distilled_knowledge";
}

interface MergeResult {
  canonicalId: number;
  mergedIds: number[];
  contentPreview: string;
}

const redirectMap = new Map<string, number>();

const dedupStats = {
  totalScans: 0,
  duplicatesFound: 0,
  entriesMerged: 0,
  storageSaved: 0,
  lastScanAt: 0,
  lastScanDurationMs: 0,
  vectorDuplicates: 0,
  knowledgeDuplicates: 0,
  ingestDeduped: 0,
  ingestMerged: 0,
};

function makeRedirectKey(table: string, id: number): string {
  return `${table}:${id}`;
}

export function resolveCanonicalId(table: string, id: number): number {
  let resolved = id;
  const visited = new Set<string>();
  while (true) {
    const key = makeRedirectKey(table, resolved);
    if (visited.has(key)) break;
    visited.add(key);
    const next = redirectMap.get(key);
    if (next === undefined || next === resolved) break;
    resolved = next;
  }
  return resolved;
}

async function persistRedirectMap(): Promise<void> {
  try {
    const entries: Array<[string, number]> = [...redirectMap.entries()];
    await db.insert(systemStateTable).values({
      key: REDIRECT_STATE_KEY,
      value: entries,
      description: "Semantic deduplication redirect map (merged → canonical)",
    }).onConflictDoUpdate({
      target: systemStateTable.key,
      set: { value: entries, lastSavedAt: new Date() },
    });
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "SemanticDedup: failed to persist redirect map");
  }
}

export async function loadRedirectMap(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(systemStateTable)
      .where(eq(systemStateTable.key, REDIRECT_STATE_KEY))
      .limit(1);
    if (row && Array.isArray(row.value)) {
      const entries = row.value as Array<[string, number]>;
      for (const [key, canonicalId] of entries) {
        redirectMap.set(key, canonicalId);
      }
      return entries.length;
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "SemanticDedup: failed to load redirect map");
  }
  return 0;
}

async function loadAllVectorEmbeddings(): Promise<Array<{
  id: number;
  content: string;
  embedding: number[];
  accessCount: number;
  source: string;
}>> {
  const all: Array<{ id: number; content: string; embedding: number[]; accessCount: number; source: string }> = [];
  let lastId = 0;

  while (true) {
    const batch = await db
      .select({
        id: vectorEmbeddingsTable.id,
        content: vectorEmbeddingsTable.content,
        embedding: vectorEmbeddingsTable.embedding,
        accessCount: vectorEmbeddingsTable.accessCount,
        source: vectorEmbeddingsTable.source,
      })
      .from(vectorEmbeddingsTable)
      .where(gt(vectorEmbeddingsTable.id, lastId))
      .orderBy(vectorEmbeddingsTable.id)
      .limit(SCAN_BATCH_SIZE);

    if (batch.length === 0) break;

    for (const row of batch) {
      const emb = row.embedding as number[];
      if (Array.isArray(emb) && emb.length > 0) {
        all.push({ ...row, embedding: emb });
      }
    }
    lastId = batch[batch.length - 1].id;
  }

  return all;
}

async function loadAllDistilledKnowledge(): Promise<Array<{
  id: number;
  fact: string;
  confidence: number;
  accessCount: number;
  category: string;
  embedding: number[];
}>> {
  const all: Array<{ id: number; fact: string; confidence: number; accessCount: number; category: string }> = [];
  let lastId = 0;

  while (true) {
    const batch = await db
      .select({
        id: distilledKnowledgeTable.id,
        fact: distilledKnowledgeTable.fact,
        confidence: distilledKnowledgeTable.confidence,
        accessCount: distilledKnowledgeTable.accessCount,
        category: distilledKnowledgeTable.category,
      })
      .from(distilledKnowledgeTable)
      .where(gt(distilledKnowledgeTable.id, lastId))
      .orderBy(distilledKnowledgeTable.id)
      .limit(SCAN_BATCH_SIZE);

    if (batch.length === 0) break;
    all.push(...batch);
    lastId = batch[batch.length - 1].id;
  }

  const texts = all.map(r => r.fact);
  const embeddings = await generateEmbeddingsBatch(texts);

  return all.map((row, i) => ({
    ...row,
    embedding: embeddings[i] ?? [],
  }));
}

function findDuplicateClusters<T extends { id: number; embedding: number[] }>(
  rows: T[],
  table: "vector_embeddings" | "distilled_knowledge",
): DuplicateCluster[] {
  const clusters: DuplicateCluster[] = [];
  const merged = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    if (merged.has(rows[i].id)) continue;
    if (rows[i].embedding.length === 0) continue;

    const duplicateIds: number[] = [];
    let bestSim = 0;

    for (let j = i + 1; j < rows.length; j++) {
      if (merged.has(rows[j].id)) continue;
      if (rows[j].embedding.length === 0) continue;

      const sim = cosineSimilarity(rows[i].embedding, rows[j].embedding);
      if (sim >= SIMILARITY_THRESHOLD) {
        duplicateIds.push(rows[j].id);
        merged.add(rows[j].id);
        if (sim > bestSim) bestSim = sim;
      }
    }

    if (duplicateIds.length > 0) {
      clusters.push({
        canonicalId: rows[i].id,
        duplicateIds,
        similarity: bestSim,
        table,
      });
      merged.add(rows[i].id);
    }
  }

  return clusters;
}

async function mergeVectorCluster(cluster: DuplicateCluster): Promise<MergeResult> {
  const allIds = [cluster.canonicalId, ...cluster.duplicateIds];

  const rows = await db
    .select()
    .from(vectorEmbeddingsTable)
    .where(sql`${vectorEmbeddingsTable.id} IN (${sql.join(allIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(vectorEmbeddingsTable.accessCount));

  if (rows.length === 0) {
    return { canonicalId: cluster.canonicalId, mergedIds: [], contentPreview: "" };
  }

  const canonical = rows[0];
  const longestContent = rows.reduce((a, b) => a.content.length >= b.content.length ? a : b);
  const totalAccess = rows.reduce((sum, r) => sum + r.accessCount, 0);

  const mergedMetadata: Record<string, unknown> = {};
  const sources = new Set<string>();
  for (const row of rows) {
    sources.add(row.source);
    if (row.metadata && typeof row.metadata === "object") {
      Object.assign(mergedMetadata, row.metadata);
    }
  }
  mergedMetadata.mergedFrom = cluster.duplicateIds;
  mergedMetadata.mergedSources = [...sources];
  mergedMetadata.mergedAt = Date.now();

  const bestContent = longestContent.content;

  await db
    .update(vectorEmbeddingsTable)
    .set({
      content: bestContent,
      accessCount: totalAccess,
      metadata: mergedMetadata,
      updatedAt: new Date(),
    })
    .where(eq(vectorEmbeddingsTable.id, canonical.id));

  let storageSaved = 0;
  for (const dupId of cluster.duplicateIds) {
    if (dupId === canonical.id) continue;
    const dup = rows.find(r => r.id === dupId);
    if (dup) storageSaved += dup.content.length;

    redirectMap.set(makeRedirectKey("vector_embeddings", dupId), canonical.id);

    await db
      .delete(vectorEmbeddingsTable)
      .where(eq(vectorEmbeddingsTable.id, dupId));
  }

  dedupStats.storageSaved += storageSaved;
  dedupStats.vectorDuplicates += cluster.duplicateIds.length;

  return {
    canonicalId: canonical.id,
    mergedIds: cluster.duplicateIds.filter(id => id !== canonical.id),
    contentPreview: bestContent.slice(0, 100),
  };
}

async function mergeKnowledgeCluster(cluster: DuplicateCluster): Promise<MergeResult> {
  const allIds = [cluster.canonicalId, ...cluster.duplicateIds];

  const rows = await db
    .select()
    .from(distilledKnowledgeTable)
    .where(sql`${distilledKnowledgeTable.id} IN (${sql.join(allIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(distilledKnowledgeTable.confidence));

  if (rows.length === 0) {
    return { canonicalId: cluster.canonicalId, mergedIds: [], contentPreview: "" };
  }

  const canonical = rows[0];
  const longestFact = rows.reduce((a, b) => a.fact.length >= b.fact.length ? a : b);
  const maxConfidence = Math.max(...rows.map(r => r.confidence));
  const totalAccess = rows.reduce((sum, r) => sum + r.accessCount, 0);
  const anyVerified = rows.some(r => r.verified);

  await db
    .update(distilledKnowledgeTable)
    .set({
      fact: longestFact.fact,
      confidence: maxConfidence,
      accessCount: totalAccess,
      verified: anyVerified,
      updatedAt: new Date(),
    })
    .where(eq(distilledKnowledgeTable.id, canonical.id));

  let storageSaved = 0;
  for (const dupId of cluster.duplicateIds) {
    if (dupId === canonical.id) continue;
    const dup = rows.find(r => r.id === dupId);
    if (dup) storageSaved += dup.fact.length;

    redirectMap.set(makeRedirectKey("distilled_knowledge", dupId), canonical.id);

    await db
      .delete(distilledKnowledgeTable)
      .where(eq(distilledKnowledgeTable.id, dupId));
  }

  dedupStats.storageSaved += storageSaved;
  dedupStats.knowledgeDuplicates += cluster.duplicateIds.length;

  return {
    canonicalId: canonical.id,
    mergedIds: cluster.duplicateIds.filter(id => id !== canonical.id),
    contentPreview: longestFact.fact.slice(0, 100),
  };
}

export async function runDeduplicationScan(): Promise<{
  vectorClusters: number;
  knowledgeClusters: number;
  totalMerged: number;
  storageSaved: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  dedupStats.totalScans++;
  dedupStats.lastScanAt = startTime;

  let totalMerged = 0;
  let vectorClusters = 0;
  let knowledgeClusters = 0;

  const vectorRows = await loadAllVectorEmbeddings();
  const vectorDupClusters = findDuplicateClusters(vectorRows, "vector_embeddings");

  for (const cluster of vectorDupClusters) {
    const result = await mergeVectorCluster(cluster);
    totalMerged += result.mergedIds.length;
    vectorClusters++;
    logger.info({
      canonicalId: result.canonicalId,
      merged: result.mergedIds.length,
      preview: result.contentPreview,
    }, "SemanticDedup: merged vector embedding cluster");
  }

  const knowledgeRows = await loadAllDistilledKnowledge();
  const knowledgeDupClusters = findDuplicateClusters(knowledgeRows, "distilled_knowledge");

  for (const cluster of knowledgeDupClusters) {
    const result = await mergeKnowledgeCluster(cluster);
    totalMerged += result.mergedIds.length;
    knowledgeClusters++;
    logger.info({
      canonicalId: result.canonicalId,
      merged: result.mergedIds.length,
      preview: result.contentPreview,
    }, "SemanticDedup: merged knowledge cluster");
  }

  dedupStats.entriesMerged += totalMerged;
  dedupStats.duplicatesFound += totalMerged;

  if (totalMerged > 0) {
    await persistRedirectMap();
  }

  const durationMs = Date.now() - startTime;
  dedupStats.lastScanDurationMs = durationMs;

  logger.info({
    vectorClusters,
    knowledgeClusters,
    totalMerged,
    storageSaved: dedupStats.storageSaved,
    durationMs,
  }, "SemanticDedup: full scan complete");

  return {
    vectorClusters,
    knowledgeClusters,
    totalMerged,
    storageSaved: dedupStats.storageSaved,
    durationMs,
  };
}

export async function checkDuplicateBeforeIngest(
  content: string,
  table: "vector_embeddings" | "distilled_knowledge" = "vector_embeddings",
): Promise<{
  isDuplicate: boolean;
  canonicalId?: number;
  similarity?: number;
  action?: "merged" | "skipped";
}> {
  try {
    const newEmbedding = await generateEmbedding(content);

    if (table === "vector_embeddings") {
      const rows = await db
        .select({
          id: vectorEmbeddingsTable.id,
          content: vectorEmbeddingsTable.content,
          embedding: vectorEmbeddingsTable.embedding,
          accessCount: vectorEmbeddingsTable.accessCount,
        })
        .from(vectorEmbeddingsTable)
        .orderBy(desc(vectorEmbeddingsTable.createdAt))
        .limit(200);

      for (const row of rows) {
        const emb = row.embedding as number[];
        if (!Array.isArray(emb) || emb.length === 0) continue;

        const sim = cosineSimilarity(newEmbedding, emb);
        if (sim >= SIMILARITY_THRESHOLD) {
          const bestContent = content.length > row.content.length ? content : row.content;
          await db
            .update(vectorEmbeddingsTable)
            .set({
              content: bestContent,
              accessCount: sql`${vectorEmbeddingsTable.accessCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(vectorEmbeddingsTable.id, row.id));

          dedupStats.ingestMerged++;
          return { isDuplicate: true, canonicalId: row.id, similarity: sim, action: "merged" };
        }
      }
    } else {
      const rows = await db
        .select({
          id: distilledKnowledgeTable.id,
          fact: distilledKnowledgeTable.fact,
          confidence: distilledKnowledgeTable.confidence,
        })
        .from(distilledKnowledgeTable)
        .orderBy(desc(distilledKnowledgeTable.confidence))
        .limit(200);

      const texts = rows.map(r => r.fact);
      const embeddings = await generateEmbeddingsBatch(texts);

      for (let i = 0; i < rows.length; i++) {
        if (!embeddings[i] || embeddings[i].length === 0) continue;
        const sim = cosineSimilarity(newEmbedding, embeddings[i]);
        if (sim >= SIMILARITY_THRESHOLD) {
          const bestFact = content.length > rows[i].fact.length ? content : rows[i].fact;
          await db
            .update(distilledKnowledgeTable)
            .set({
              fact: bestFact,
              accessCount: sql`${distilledKnowledgeTable.accessCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(distilledKnowledgeTable.id, rows[i].id));

          dedupStats.ingestMerged++;
          return { isDuplicate: true, canonicalId: rows[i].id, similarity: sim, action: "merged" };
        }
      }
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message }, "SemanticDedup: pre-ingest check failed");
  }

  return { isDuplicate: false };
}

export function getDeduplicationStats() {
  return {
    ...dedupStats,
    redirectMapSize: redirectMap.size,
    deduplicationRate: dedupStats.totalScans > 0
      ? dedupStats.duplicatesFound / Math.max(dedupStats.totalScans, 1)
      : 0,
  };
}

export function resetDeduplicationStats(): void {
  dedupStats.totalScans = 0;
  dedupStats.duplicatesFound = 0;
  dedupStats.entriesMerged = 0;
  dedupStats.storageSaved = 0;
  dedupStats.lastScanAt = 0;
  dedupStats.lastScanDurationMs = 0;
  dedupStats.vectorDuplicates = 0;
  dedupStats.knowledgeDuplicates = 0;
  dedupStats.ingestDeduped = 0;
  dedupStats.ingestMerged = 0;
  redirectMap.clear();
}
