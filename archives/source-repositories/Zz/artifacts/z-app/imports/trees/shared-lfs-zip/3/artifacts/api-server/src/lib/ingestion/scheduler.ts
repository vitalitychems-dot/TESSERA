import { db } from "@workspace/db";
import { dataSourcesTable } from "@workspace/db/schema";
import { eq, lte, and } from "drizzle-orm";
import { runSourceIngestion } from "./pipeline";
import type { NormalizedItem } from "./pipeline";
import { fetchNASA, fetchUSGS, fetchNOAA, fetchWikipedia, fetchArxiv, fetchHackerNews, fetchRedditJson, fetchCoinGecko, fetchSemanticScholar, fetchPubMed } from "./apis";
import { fetchRssFeed, DEFAULT_FEEDS } from "./rss";

export type SourceHandler = () => Promise<NormalizedItem[]>;

const SOURCE_HANDLERS: Record<string, SourceHandler> = {
  "NASA APOD": fetchNASA,
  "USGS Earthquakes": fetchUSGS,
  "NOAA Weather Alerts": fetchNOAA,
  "Wikipedia": () => fetchWikipedia(),
  "arXiv AI": () => fetchArxiv("artificial intelligence", 5),
  "arXiv CS": () => fetchArxiv("computer science neural networks", 5),
  "Hacker News": () => fetchHackerNews("topstories", 10),
  "Reddit Technology": () => fetchRedditJson("technology", 10),
  "Reddit Science": () => fetchRedditJson("science", 10),
  "CoinGecko": () => fetchCoinGecko(["bitcoin", "ethereum", "solana"]),
  "Semantic Scholar": () => fetchSemanticScholar("large language models", 5),
  "PubMed": () => fetchPubMed("artificial intelligence medicine", 5),
};

for (const feed of DEFAULT_FEEDS) {
  SOURCE_HANDLERS[feed.name] = () => fetchRssFeed(feed.name, feed.url);
}

export function getSourceHandlers(): string[] {
  return Object.keys(SOURCE_HANDLERS);
}

export async function runIngestionForSource(sourceName: string): Promise<{ ingested: number; skipped: number; errors: string[]; jobId: number }> {
  const handler = SOURCE_HANDLERS[sourceName];
  if (!handler) throw new Error(`No handler for source: ${sourceName}`);

  const [source] = await db
    .select()
    .from(dataSourcesTable)
    .where(eq(dataSourcesTable.name, sourceName))
    .limit(1);

  return runSourceIngestion(sourceName, source?.id ?? null, handler);
}

export async function runRssIngestion(feedName: string, feedUrl: string): Promise<{ ingested: number; skipped: number; errors: string[]; jobId: number }> {
  const [source] = await db
    .select()
    .from(dataSourcesTable)
    .where(eq(dataSourcesTable.name, feedName))
    .limit(1);

  return runSourceIngestion(feedName, source?.id ?? null, () => fetchRssFeed(feedName, feedUrl));
}

export async function runAllIngestion(): Promise<Record<string, { ingested: number; skipped: number; errors: string[] }>> {
  const results: Record<string, { ingested: number; skipped: number; errors: string[] }> = {};

  const sources = await db.select().from(dataSourcesTable).where(eq(dataSourcesTable.enabled, true));

  for (const source of sources) {
    const handler = SOURCE_HANDLERS[source.name];
    if (!handler) continue;
    try {
      const result = await runSourceIngestion(source.name, source.id, handler);
      results[source.name] = { ingested: result.ingested, skipped: result.skipped, errors: result.errors };
      await db.update(dataSourcesTable)
        .set({
          lastRunAt: new Date(),
          lastSuccessAt: result.ingested > 0 ? new Date() : undefined,
          lastError: result.errors.length > 0 ? result.errors[0] : null,
          totalRuns: (source.totalRuns || 0) + 1,
          totalIngested: (source.totalIngested || 0) + result.ingested,
          updatedAt: new Date(),
        })
        .where(eq(dataSourcesTable.id, source.id));
    } catch (e) {
      results[source.name] = { ingested: 0, skipped: 0, errors: [(e as Error).message] };
    }
  }

  return results;
}

export async function runDueIngestion(): Promise<Record<string, { ingested: number; skipped: number; errors: string[] }>> {
  const now = new Date();
  const sources = await db.select().from(dataSourcesTable).where(eq(dataSourcesTable.enabled, true));
  const due = sources.filter(s => {
    if (!s.lastRunAt) return true;
    const nextRun = new Date(s.lastRunAt.getTime() + (s.intervalSeconds || 3600) * 1000);
    return now >= nextRun;
  });

  const results: Record<string, { ingested: number; skipped: number; errors: string[] }> = {};
  for (const source of due) {
    const handler = SOURCE_HANDLERS[source.name];
    if (!handler) continue;
    try {
      const result = await runSourceIngestion(source.name, source.id, handler);
      results[source.name] = { ingested: result.ingested, skipped: result.skipped, errors: result.errors };
      await db.update(dataSourcesTable)
        .set({
          lastRunAt: new Date(),
          lastSuccessAt: result.ingested > 0 ? new Date() : undefined,
          lastError: result.errors.length > 0 ? result.errors[0] : null,
          totalRuns: (source.totalRuns || 0) + 1,
          totalIngested: (source.totalIngested || 0) + result.ingested,
          updatedAt: new Date(),
        })
        .where(eq(dataSourcesTable.id, source.id));
    } catch (e) {
      results[source.name] = { ingested: 0, skipped: 0, errors: [(e as Error).message] };
    }
  }
  return results;
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startIngestionScheduler(checkIntervalMs = 300_000): void {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(async () => {
    try {
      await runDueIngestion();
    } catch (_e) {
    }
  }, checkIntervalMs);
}

export function stopIngestionScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
