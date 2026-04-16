import { db } from "@workspace/db";
import { vectorEmbeddingsTable, distilledKnowledgeTable } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { generateEmbedding, generateEmbeddingsBatch, cosineSimilarity } from "./neural-embeddings";
import { logger } from "./logger";

const SIMILARITY_THRESHOLD = 0.92;
const SCAN_BATCH_SIZE = 50;
const MAX_COMPARISONS_PER_BATCH = 2500;

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
};

function makeRedirectKey(table: string, id: number): string {
  return `${table}:${id}`;
}

export function resolveCanonicalId(table: string, id: number): number {
  const key = makeRedirectKey(table, id);
  return redirectMap.get(key) ?? id;
}

async function scanVectorEmbeddingDuplicates(offset: number): Promise<DuplicateCluster[]> {
  const rows = await db
    .select({
      id: vectorEmbeddingsTable.id,
      content: vectorEmbeddingsTable.content,
      embedding: vectorEmbeddingsTable.embedding,
      accessCount: vectorEmbeddingsTable.accessCount,
      source: vectorEmbeddingsTable.source,
    })
    .from(vectorEmbeddingsTable)
    .orderBy(vectorEmbeddingsTable.id)
    .limit(SCAN_BATCH_SIZE)
    .offset(offset);

  if (rows.length < 2) return [];

  const clusters: DuplicateCluster[] = [];
  const merged = new Set<number>();

  for (let i = 0; i < rows.length && clusters.length < MAX_COMPARISONS_PER_BATCH; i++) {
    if (merged.has(rows[i].id)) continue;

    const embA = rows[i].embedding as number[];
    if (!Array.isArray(embA) || embA.length === 0) continue;

    const duplicateIds: number[] = [];
    let bestSim = 0;

    for (let j = i + 1; j < rows.length; j++) {
      if (merged.has(rows[j].id)) continue;

      const embB = rows[j].embedding as number[];
      if (!Array.isArray(embB) || embB.length === 0) continue;

      const sim = cosineSimilarity(embA, embB);
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
        table: "vector_embeddings",
      });
      merged.add(rows[i].id);
    }
  }

  return clusters;
}

async function scanDistilledKnowledgeDuplicates(offset: number): Promise<DuplicateCluster[]> {
  const rows = await db
    .select({
      id: distilledKnowledgeTable.id,
      fact: distilledKnowledgeTable.fact,
      confidence: distilledKnowledgeTable.confidence,
      accessCount: distilledKnowledgeTable.accessCount,
      category: distilledKnowledgeTable.category,
    })
    .from(distilledKnowledgeTable)
    .orderBy(distilledKnowledgeTable.id)
    .limit(SCAN_BATCH_SIZE)
    .offset(offset);

  if (rows.length < 2) return [];

  const texts = rows.map(r => r.fact);
  const embeddings = await generateEmbeddingsBatch(texts);

  const clusters: DuplicateCluster[] = [];
  const merged = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    if (merged.has(rows[i].id)) continue;
    if (!embeddings[i] || embeddings[i].length === 0) continue;

    const duplicateIds: number[] = [];
    let bestSim = 0;

    for (let j = i + 1; j < rows.length; j++) {
      if (merged.has(rows[j].id)) continue;
      if (!embeddings[j] || embeddings[j].length === 0) continue;

      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
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
        table: "distilled_knowledge",
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
  let totalStorageSaved = 0;

  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const clusters = await scanVectorEmbeddingDuplicates(offset);
    if (clusters.length === 0) {
      hasMore = false;
      break;
    }

    for (const cluster of clusters) {
      const result = await mergeVectorCluster(cluster);
      totalMerged += result.mergedIds.length;
      vectorClusters++;
      logger.info({
        canonicalId: result.canonicalId,
        merged: result.mergedIds.length,
        preview: result.contentPreview,
      }, "SemanticDedup: merged vector embedding cluster");
    }

    offset += SCAN_BATCH_SIZE;
  }

  offset = 0;
  hasMore = true;
  while (hasMore) {
    const clusters = await scanDistilledKnowledgeDuplicates(offset);
    if (clusters.length === 0) {
      hasMore = false;
      break;
    }

    for (const cluster of clusters) {
      const result = await mergeKnowledgeCluster(cluster);
      totalMerged += result.mergedIds.length;
      knowledgeClusters++;
      logger.info({
        canonicalId: result.canonicalId,
        merged: result.mergedIds.length,
        preview: result.contentPreview,
      }, "SemanticDedup: merged knowledge cluster");
    }

    offset += SCAN_BATCH_SIZE;
  }

  dedupStats.entriesMerged += totalMerged;
  dedupStats.duplicatesFound += totalMerged;
  totalStorageSaved = dedupStats.storageSaved;

  const durationMs = Date.now() - startTime;
  dedupStats.lastScanDurationMs = durationMs;

  logger.info({
    vectorClusters,
    knowledgeClusters,
    totalMerged,
    storageSaved: totalStorageSaved,
    durationMs,
  }, "SemanticDedup: full scan complete");

  return { vectorClusters, knowledgeClusters, totalMerged, storageSaved: totalStorageSaved, durationMs };
}

export async function checkDuplicateBeforeIngest(
  content: string,
  table: "vector_embeddings" | "distilled_knowledge" = "vector_embeddings",
): Promise<{ isDuplicate: boolean; canonicalId?: number; similarity?: number }> {
  try {
    const newEmbedding = await generateEmbedding(content);

    if (table === "vector_embeddings") {
      const rows = await db
        .select({
          id: vectorEmbeddingsTable.id,
          embedding: vectorEmbeddingsTable.embedding,
        })
        .from(vectorEmbeddingsTable)
        .orderBy(desc(vectorEmbeddingsTable.createdAt))
        .limit(200);

      for (const row of rows) {
        const emb = row.embedding as number[];
        if (!Array.isArray(emb) || emb.length === 0) continue;

        const sim = cosineSimilarity(newEmbedding, emb);
        if (sim >= SIMILARITY_THRESHOLD) {
          dedupStats.ingestDeduped++;
          return { isDuplicate: true, canonicalId: row.id, similarity: sim };
        }
      }
    } else {
      const rows = await db
        .select({
          id: distilledKnowledgeTable.id,
          fact: distilledKnowledgeTable.fact,
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
          dedupStats.ingestDeduped++;
          return { isDuplicate: true, canonicalId: rows[i].id, similarity: sim };
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
  redirectMap.clear();
}
