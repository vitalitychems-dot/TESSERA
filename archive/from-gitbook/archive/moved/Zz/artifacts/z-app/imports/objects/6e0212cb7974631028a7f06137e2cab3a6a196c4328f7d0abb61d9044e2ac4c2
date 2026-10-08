import * as crypto from "crypto";
import { db } from "@workspace/db";
import { ingestedDataTable, ingestionJobsTable, dataSourcesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { storeMemory } from "../vector-memory";

export interface NormalizedItem {
  source: string;
  sourceType: string;
  title?: string;
  content: string;
  url?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  publishedAt?: Date;
}

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}

export async function isDuplicate(contentHash: string): Promise<boolean> {
  const existing = await db
    .select({ id: ingestedDataTable.id })
    .from(ingestedDataTable)
    .where(eq(ingestedDataTable.contentHash, contentHash))
    .limit(1);
  return existing.length > 0;
}

export async function ingestItem(item: NormalizedItem): Promise<{ ingested: boolean; id?: number; reason?: string }> {
  const text = [item.title, item.content].filter(Boolean).join(" ").trim();
  if (!text) return { ingested: false, reason: "empty content" };

  const contentHash = hashContent(text);
  if (await isDuplicate(contentHash)) {
    return { ingested: false, reason: "duplicate" };
  }

  let embeddingId: number | undefined;
  try {
    embeddingId = await storeMemory({
      content: text.slice(0, 8000),
      source: item.source,
      category: item.sourceType,
      metadata: { url: item.url, tags: item.tags, ...(item.metadata || {}) },
    });
  } catch (_e) {
  }

  const [row] = await db.insert(ingestedDataTable).values({
    source: item.source,
    sourceType: item.sourceType,
    title: item.title,
    content: item.content.slice(0, 20000),
    url: item.url,
    contentHash,
    embeddingId: embeddingId ?? null,
    tags: item.tags ?? [],
    metadata: item.metadata ?? {},
    publishedAt: item.publishedAt ?? null,
  }).returning({ id: ingestedDataTable.id });

  return { ingested: true, id: row.id };
}

export async function runSourceIngestion(
  sourceName: string,
  sourceId: number | null,
  fetchFn: () => Promise<NormalizedItem[]>
): Promise<{ ingested: number; skipped: number; errors: string[]; jobId: number }> {
  const [job] = await db.insert(ingestionJobsTable).values({
    sourceId,
    sourceName,
    status: "running",
    itemsIngested: 0,
    itemsSkipped: 0,
    errors: [],
    metadata: {},
  }).returning({ id: ingestionJobsTable.id });

  let ingested = 0;
  let skipped = 0;
  const errors: string[] = [];
  const start = Date.now();

  try {
    const items = await fetchFn();
    for (const item of items) {
      try {
        const result = await ingestItem(item);
        if (result.ingested) ingested++;
        else skipped++;
      } catch (e) {
        errors.push(`Item error: ${(e as Error).message}`);
        skipped++;
      }
    }
  } catch (e) {
    errors.push(`Fetch error: ${(e as Error).message}`);
  }

  const durationMs = Date.now() - start;
  await db.update(ingestionJobsTable)
    .set({
      status: errors.length > 0 && ingested === 0 ? "failed" : "completed",
      itemsIngested: ingested,
      itemsSkipped: skipped,
      errors,
      completedAt: new Date(),
      durationMs,
    })
    .where(eq(ingestionJobsTable.id, job.id));

  if (sourceId) {
    await db.update(dataSourcesTable)
      .set({
        lastRunAt: new Date(),
        lastSuccessAt: ingested > 0 ? new Date() : undefined,
        lastError: errors.length > 0 ? errors[0] : null,
        totalRuns: undefined,
      })
      .where(eq(dataSourcesTable.id, sourceId));
  }

  return { ingested, skipped, errors, jobId: job.id };
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
