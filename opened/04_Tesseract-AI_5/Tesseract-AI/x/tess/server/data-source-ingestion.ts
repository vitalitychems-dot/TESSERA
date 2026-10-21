import axios from "axios";
import { loadOrchestratorConfig, getRandomUserAgent } from "./orchestrator-config";
import type { DataSourceSpec } from "./orchestrator-config";
import { resolveAndCheckSSRF } from "./ssrf-guard";
import { enhancedScrape } from "./enhanced-scraper";

const log = (m: string) => console.log(`[DataSourceIngestion] ${m}`);
const warn = (m: string) => console.log(`[DataSourceIngestion] WARNING: ${m}`);

interface IngestedItem {
  sourceId: string;
  sourceName: string;
  title: string;
  content: string;
  url: string;
  domain: string;
  timestamp: number;
  contentHash: string;
}

interface IngestionStats {
  totalIngested: number;
  lastCycleTimestamp: number;
  lastCycleDurationMs: number;
  sourceBreakdown: Record<string, { count: number; lastFetch: number; errors: number }>;
  schedulerRunning: boolean;
}

const ingestedItems: IngestedItem[] = [];
const MAX_INGESTED = 5000;
const sourceStats: Record<string, { count: number; lastFetch: number; errors: number }> = {};
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastCycleTimestamp = 0;
let lastCycleDurationMs = 0;

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function fetchApiSource(source: DataSourceSpec): Promise<IngestedItem[]> {
  const items: IngestedItem[] = [];

  try {
    const parsed = new URL(source.url);
    const ssrf = await resolveAndCheckSSRF(parsed.hostname);
    if (!ssrf.safe) {
      warn(`SSRF blocked for source ${source.id}: ${parsed.hostname}`);
      return items;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`URL parse error for source ${source.id}: ${message}`);
    return items;
  }

  try {
    let response;
    const headers: Record<string, string> = { "User-Agent": getRandomUserAgent() };

    switch (source.id) {
      case "arxiv": {
        response = await axios.get(source.url, {
          params: { search_query: "all:quantum OR all:geometry OR all:consciousness", max_results: 5, sortBy: "submittedDate" },
          headers, timeout: 10000,
        });
        const xmlData = typeof response.data === "string" ? response.data : "";
        const entries = xmlData.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        for (const entry of entries.slice(0, 5)) {
          const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "";
          const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || "";
          const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "";
          if (title && summary) {
            items.push({ sourceId: source.id, sourceName: source.name, title, content: summary.slice(0, 2000), url: link, domain: source.domains[0] || "general", timestamp: Date.now(), contentHash: simpleHash(title + summary) });
          }
        }
        break;
      }
      case "wikipedia": {
        response = await axios.get(source.url, {
          params: { action: "query", list: "random", rnnamespace: 0, rnlimit: 5, format: "json" },
          headers, timeout: 10000,
        });
        const pages = response.data?.query?.random || [];
        for (const page of pages) {
          items.push({ sourceId: source.id, sourceName: source.name, title: page.title, content: `Wikipedia article: ${page.title}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`, domain: "general", timestamp: Date.now(), contentHash: simpleHash(page.title) });
        }
        break;
      }
      case "hackernews": {
        response = await axios.get(`${source.url}/topstories.json`, { headers, timeout: 10000 });
        const ids = (response.data || []).slice(0, 5);
        for (const id of ids) {
          try {
            const item = await axios.get(`${source.url}/item/${id}.json`, { headers, timeout: 5000 });
            if (item.data?.title) {
              items.push({ sourceId: source.id, sourceName: source.name, title: item.data.title, content: item.data.text || item.data.title, url: item.data.url || `https://news.ycombinator.com/item?id=${id}`, domain: "technology", timestamp: Date.now(), contentHash: simpleHash(item.data.title) });
            }
          } catch (_itemErr: unknown) {
            continue;
          }
        }
        break;
      }
      case "gutenberg": {
        response = await axios.get(source.url, { params: { page: 1 }, headers, timeout: 10000 });
        const books = response.data?.results || [];
        for (const book of books.slice(0, 5)) {
          items.push({ sourceId: source.id, sourceName: source.name, title: book.title || "", content: `By ${(book.authors || []).map((a: { name: string }) => a.name).join(", ")}. ${book.title}`, url: `https://www.gutenberg.org/ebooks/${book.id}`, domain: "literature", timestamp: Date.now(), contentHash: simpleHash(String(book.id)) });
        }
        break;
      }
      default: {
        response = await axios.get(source.url, { headers, timeout: 10000 });
        const data = typeof response.data === "object" ? JSON.stringify(response.data).slice(0, 2000) : String(response.data).slice(0, 2000);
        items.push({ sourceId: source.id, sourceName: source.name, title: `${source.name} data`, content: data, url: source.url, domain: source.domains[0] || "general", timestamp: Date.now(), contentHash: simpleHash(data) });
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`API fetch failed for ${source.id}: ${message}`);
    if (!sourceStats[source.id]) sourceStats[source.id] = { count: 0, lastFetch: 0, errors: 0 };
    sourceStats[source.id].errors++;
  }

  return items;
}

async function fetchScrapeSource(source: DataSourceSpec): Promise<IngestedItem[]> {
  try {
    const result = await enhancedScrape(source.url);
    return [{
      sourceId: source.id,
      sourceName: source.name,
      title: result.title || source.name,
      content: result.content.slice(0, 5000),
      url: source.url,
      domain: source.domains[0] || "general",
      timestamp: Date.now(),
      contentHash: simpleHash(result.content),
    }];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`Scrape failed for ${source.id}: ${message}`);
    if (!sourceStats[source.id]) sourceStats[source.id] = { count: 0, lastFetch: 0, errors: 0 };
    sourceStats[source.id].errors++;
    return [];
  }
}

export async function runIngestionCycle(): Promise<{ itemsIngested: number; sourcesQueried: number; durationMs: number }> {
  const start = Date.now();
  const config = loadOrchestratorConfig();
  let totalIngested = 0;
  let sourcesQueried = 0;

  const shuffled = [...config.dataSources].sort(() => Math.random() - 0.5);
  const batch = shuffled.slice(0, 10);

  for (const source of batch) {
    sourcesQueried++;
    let items: IngestedItem[] = [];

    if (source.type === "scrape") {
      items = await fetchScrapeSource(source);
    } else {
      items = await fetchApiSource(source);
    }

    for (const item of items) {
      const existing = ingestedItems.find(i => i.contentHash === item.contentHash);
      if (!existing) {
        ingestedItems.push(item);
        totalIngested++;
      }
    }

    if (!sourceStats[source.id]) sourceStats[source.id] = { count: 0, lastFetch: 0, errors: 0 };
    sourceStats[source.id].count += items.length;
    sourceStats[source.id].lastFetch = Date.now();
  }

  if (ingestedItems.length > MAX_INGESTED) {
    ingestedItems.splice(0, ingestedItems.length - MAX_INGESTED);
  }

  const duration = Date.now() - start;
  lastCycleTimestamp = Date.now();
  lastCycleDurationMs = duration;

  log(`Cycle complete: ${totalIngested} new items from ${sourcesQueried} sources in ${duration}ms (total: ${ingestedItems.length})`);
  return { itemsIngested: totalIngested, sourcesQueried, durationMs: duration };
}

export function startScheduler(intervalMs: number = 7_200_000): void {
  if (schedulerInterval) {
    log("Scheduler already running");
    return;
  }
  schedulerInterval = setInterval(() => {
    runIngestionCycle().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      warn(`Scheduled ingestion cycle failed: ${message}`);
    });
  }, intervalMs);
  log(`Scheduler started (${Math.round(intervalMs / 60000)}-minute cycle)`);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("Scheduler stopped");
  }
}

export function getIngestionStats(): IngestionStats {
  return {
    totalIngested: ingestedItems.length,
    lastCycleTimestamp,
    lastCycleDurationMs,
    sourceBreakdown: { ...sourceStats },
    schedulerRunning: schedulerInterval !== null,
  };
}

export function getRecentIngested(limit: number = 50): IngestedItem[] {
  return ingestedItems.slice(-limit);
}

export function getIngestedByDomain(domain: string, limit: number = 20): IngestedItem[] {
  return ingestedItems.filter(i => i.domain === domain).slice(-limit);
}

export type { IngestedItem, IngestionStats };
