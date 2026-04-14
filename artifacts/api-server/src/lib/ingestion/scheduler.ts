import { db } from "@workspace/db";
import { dataSourcesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { runSourceIngestion } from "./pipeline";
import type { NormalizedItem } from "./pipeline";
import { fetchNASA, fetchUSGS, fetchNOAA, fetchWikipedia, fetchArxiv, fetchHackerNews, fetchRedditJson, fetchCoinGecko, fetchSemanticScholar, fetchPubMed } from "./apis";
import { fetchRssFeed, DEFAULT_FEEDS } from "./rss";
import { fetchGithubTrendingRepos, fetchGithubOrg, fetchGithubTopic } from "./github";
import { fetchDataGov, fetchWorldBankData, fetchUNData, fetchGithubPublicDatasets } from "./datasets";
import {
  fetchCIAReadingRoom, fetchFBIVault, fetchInternetArchive,
  fetchWikipediaKnowledge, fetchArxivDeep, fetchOpenLibrary,
  fetchProjectGutenberg, fetchStanfordEncyclopedia, fetchSmithsonian,
} from "./knowledge-scrapers";
import { logger } from "../logger";

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
  "GitHub Trending": () => fetchGithubTrendingRepos("", "weekly", 8),
  "GitHub AI Repos": () => fetchGithubTopic("artificial-intelligence", 8),
  "GitHub ML Repos": () => fetchGithubTopic("machine-learning", 8),
  "GitHub Open Source": () => fetchGithubTrendingRepos("", "weekly", 5),
  "GitHub Microsoft": () => fetchGithubOrg("microsoft", 5),
  "GitHub Google": () => fetchGithubOrg("google", 5),
  "data.gov Technology": () => fetchDataGov("technology", 5),
  "data.gov Climate": () => fetchDataGov("climate", 5),
  "World Bank GDP": () => fetchWorldBankData("NY.GDP.MKTP.CD", 5),
  "World Bank Population": () => fetchWorldBankData("SP.POP.TOTL", 5),
  "UN SDG Indicators": () => fetchUNData("", 5),
  "GitHub Public Datasets": () => fetchGithubPublicDatasets("dataset", 5),

  "CIA Reading Room": () => fetchCIAReadingRoom(),
  "FBI Vault": fetchFBIVault,
  "Internet Archive": () => fetchInternetArchive(),
  "Wikipedia Knowledge": fetchWikipediaKnowledge,
  "arXiv Deep Research": () => fetchArxivDeep(),
  "Open Library": fetchOpenLibrary,
  "Project Gutenberg": fetchProjectGutenberg,
  "Stanford Encyclopedia": fetchStanfordEncyclopedia,
  "Smithsonian": fetchSmithsonian,

  "arXiv Quantum": () => fetchArxiv("quantum computing entanglement", 5),
  "arXiv Consciousness": () => fetchArxiv("consciousness neural correlates", 5),
  "arXiv Energy": () => fetchArxiv("zero point energy vacuum", 5),
  "Semantic Scholar AGI": () => fetchSemanticScholar("artificial general intelligence alignment", 5),
  "Semantic Scholar Consciousness": () => fetchSemanticScholar("consciousness quantum brain", 5),
  "Semantic Scholar Sacred Geometry": () => fetchSemanticScholar("fibonacci golden ratio nature", 5),
  "PubMed Frequency Healing": () => fetchPubMed("frequency therapy resonance healing", 5),
  "PubMed Consciousness": () => fetchPubMed("consciousness neuroscience pineal", 5),
  "Reddit Consciousness": () => fetchRedditJson("consciousness", 5),
  "Reddit Physics": () => fetchRedditJson("physics", 5),
  "Reddit Philosophy": () => fetchRedditJson("philosophy", 5),
  "GitHub Quantum": () => fetchGithubTopic("quantum-computing", 5),
  "GitHub AGI": () => fetchGithubTopic("artificial-general-intelligence", 5),
  "GitHub Sacred Geometry": () => fetchGithubTopic("sacred-geometry", 5),
  "GitHub Free Energy": () => fetchGithubTopic("free-energy", 5),
  "GitHub Consciousness": () => fetchGithubTopic("consciousness", 5),
  "data.gov Science": () => fetchDataGov("science", 5),
  "data.gov Energy": () => fetchDataGov("energy", 5),
  "data.gov Space": () => fetchDataGov("space", 5),
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

async function ensureSourcesRegistered(): Promise<void> {
  const existing = await db.select({ name: dataSourcesTable.name }).from(dataSourcesTable);
  const existingNames = new Set(existing.map(s => s.name));

  const allHandlerNames = Object.keys(SOURCE_HANDLERS);
  const missing = allHandlerNames.filter(n => !existingNames.has(n));

  if (missing.length > 0) {
    const values = missing.map(name => ({
      name,
      type: name.includes("arXiv") || name.includes("Semantic Scholar") || name.includes("PubMed") ? "academic" as const :
            name.includes("GitHub") ? "github" as const :
            name.includes("CIA") || name.includes("FBI") || name.includes("Archive") ? "declassified" as const :
            name.includes("Wikipedia") || name.includes("Stanford") || name.includes("Library") || name.includes("Gutenberg") ? "encyclopedia" as const :
            name.includes("Reddit") ? "social" as const :
            "api" as const,
      url: "",
      enabled: true,
      intervalSeconds: name.includes("CIA") || name.includes("FBI") || name.includes("Gutenberg") || name.includes("Archive") ? 1800 :
                       name.includes("Knowledge") || name.includes("Deep") || name.includes("Stanford") || name.includes("Smithsonian") ? 2400 :
                       3600,
    }));
    await db.insert(dataSourcesTable).values(values).onConflictDoNothing();
    logger.info({ count: missing.length, sources: missing }, "Registered new ingestion sources");
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let rotationInterval: ReturnType<typeof setInterval> | null = null;
let schedulerStarted = false;

export function isSchedulerStarted(): boolean {
  return schedulerStarted;
}

const SOURCE_GROUPS = [
  ["NASA APOD", "USGS Earthquakes", "NOAA Weather Alerts", "CoinGecko"],
  ["Wikipedia", "Wikipedia Knowledge", "Stanford Encyclopedia"],
  ["arXiv AI", "arXiv CS", "arXiv Quantum", "arXiv Consciousness", "arXiv Energy", "arXiv Deep Research"],
  ["Hacker News", "Reddit Technology", "Reddit Science", "Reddit Consciousness", "Reddit Physics", "Reddit Philosophy"],
  ["Semantic Scholar", "Semantic Scholar AGI", "Semantic Scholar Consciousness", "Semantic Scholar Sacred Geometry"],
  ["PubMed", "PubMed Frequency Healing", "PubMed Consciousness"],
  ["GitHub Trending", "GitHub AI Repos", "GitHub ML Repos", "GitHub Open Source", "GitHub Quantum", "GitHub AGI", "GitHub Sacred Geometry", "GitHub Free Energy", "GitHub Consciousness"],
  ["GitHub Microsoft", "GitHub Google"],
  ["CIA Reading Room", "FBI Vault", "Internet Archive"],
  ["Open Library", "Project Gutenberg", "Smithsonian"],
  ["data.gov Technology", "data.gov Climate", "data.gov Science", "data.gov Energy", "data.gov Space"],
  ["World Bank GDP", "World Bank Population", "UN SDG Indicators", "GitHub Public Datasets"],
];

let currentGroupIndex = 0;

async function runRotatingGroup(): Promise<void> {
  const group = SOURCE_GROUPS[currentGroupIndex % SOURCE_GROUPS.length];
  currentGroupIndex++;

  for (const sourceName of group) {
    const handler = SOURCE_HANDLERS[sourceName];
    if (!handler) continue;

    try {
      const [source] = await db
        .select()
        .from(dataSourcesTable)
        .where(eq(dataSourcesTable.name, sourceName))
        .limit(1);

      const result = await runSourceIngestion(sourceName, source?.id ?? null, handler);

      if (source) {
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
      }

      if (result.ingested > 0) {
        logger.info({ source: sourceName, ingested: result.ingested }, "Rotation ingested new items");
      }
    } catch (e) {
      logger.warn({ source: sourceName, err: (e as Error).message }, "Rotation source failed");
    }
  }
}

export async function startIngestionScheduler(checkIntervalMs = 120_000): Promise<void> {
  if (schedulerInterval) return;

  await ensureSourcesRegistered();

  schedulerInterval = setInterval(async () => {
    try {
      await runDueIngestion();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "Due ingestion cycle error");
    }
  }, checkIntervalMs);

  rotationInterval = setInterval(async () => {
    try {
      await runRotatingGroup();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "Rotation group error");
    }
  }, 180_000);

  setTimeout(() => {
    runRotatingGroup().catch(e => logger.warn({ err: (e as Error).message }, "Initial rotation failed"));
  }, 30_000);

  schedulerStarted = true;
  logger.info({ checkIntervalMs, totalSources: Object.keys(SOURCE_HANDLERS).length, groups: SOURCE_GROUPS.length }, "Ingestion scheduler started with continuous rotation");
}

export function stopIngestionScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
  }
}
