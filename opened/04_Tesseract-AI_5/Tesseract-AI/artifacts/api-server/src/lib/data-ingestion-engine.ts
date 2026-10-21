import { db } from "@workspace/db";
import { knowledge_graph, data_sources } from "@workspace/db";
import { searchKnowledgeEntries, storeKnowledgeEntry } from "./memory-service";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { runInSandbox } from "./external-call-sandbox";
import { logExternalCall } from "./external-call-logger";

const LOG_PREFIX = "[DataIngestion]";

export interface NormalizedDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceType: "web" | "api" | "dataset" | "manual";
  url?: string;
  domain?: string;
  tags: string[];
  language: string;
  wordCount: number;
  contentHash: string;
  ingestedAt: Date;
  metadata: Record<string, unknown>;
}

export interface IngestionResult {
  documentsProcessed: number;
  documentsIngested: number;
  duplicatesSkipped: number;
  errors: string[];
  domains: string[];
}

const seenHashes = new Set<string>();
let ingestionCycleCount = 0;
let totalIngestedCount = 0;

function normalizeDocument(
  title: string,
  content: string,
  source: string,
  sourceType: NormalizedDocument["sourceType"],
  extra: Partial<NormalizedDocument> = {}
): NormalizedDocument {
  const contentHash = crypto.createHash("sha256").update(content.slice(0, 1000)).digest("hex").slice(0, 16);
  const words = content.trim().split(/\s+/).filter(Boolean);

  return {
    id: `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.slice(0, 500),
    content: content.slice(0, 50000),
    source,
    sourceType,
    language: "en",
    wordCount: words.length,
    contentHash,
    ingestedAt: new Date(),
    tags: extra.tags ?? [],
    metadata: extra.metadata ?? {},
    ...extra,
  };
}

async function isDuplicate(contentHash: string): Promise<boolean> {
  if (seenHashes.has(contentHash)) return true;
  seenHashes.add(contentHash);
  return false;
}

async function storeDocumentToKnowledgeBase(doc: NormalizedDocument): Promise<void> {
  const nodeId = `ing-${doc.contentHash}`;

  try {
    await db.insert(knowledge_graph).values({
      nodeId,
      nodeType: "document",
      label: doc.title,
      content: doc.content.slice(0, 8000),
      embedding: [],
      edges: [],
      dimensionTags: doc.tags as unknown as string[],
      temporalContext: { ingestedAt: doc.ingestedAt.toISOString(), sourceType: doc.sourceType } as Record<string, string>,
      confidence: 0.8,
      sourceType: doc.sourceType,
      metadata: { source: doc.source, url: doc.url, domain: doc.domain, wordCount: doc.wordCount, ...doc.metadata } as Record<string, unknown>,
    }).onConflictDoNothing();
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} DB insert failed: ${err?.message}`);
  }

  try {
    await storeKnowledgeEntry({
      title: doc.title,
      content: doc.content.slice(0, 4000),
      source: doc.source,
      tags: doc.tags,
      importance: 5,
    });
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Knowledge store failed: ${err?.message}`);
  }
}

export class WebScraper {
  async fetchPage(url: string): Promise<{ title: string; content: string } | null> {
    const domain = (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })();
    const start = Date.now();
    try {
      const sandboxResult = await runInSandbox({
        providerId: domain,
        providerType: "knowledge-ingestion",
        taskType: "knowledge_synthesis",
        payload: { url },
        fn: async (sanitized) => {
          const s = sanitized as Record<string, unknown>;
          const safeUrl = typeof s.url === "string" ? s.url : url;
          const resp = await fetch(safeUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; TesseraSovereign/1.0)" },
            signal: AbortSignal.timeout(10000),
          });
          if (!resp.ok) return null;
          const html = await resp.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const title = titleMatch?.[1]?.trim() ?? safeUrl;
          const textContent = html
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return { title, content: textContent.slice(0, 20000) };
        },
      });
      const result: { title: string; content: string } | null = sandboxResult.success && sandboxResult.data
        ? sandboxResult.data
        : null;
      logExternalCall({
        providerId: domain,
        providerType: "knowledge-ingestion",
        taskType: "knowledge_synthesis",
        requestPayload: { url },
        responsePayload: result ? { title: result.title, contentLength: result.content?.length } : null,
        latencyMs: Date.now() - start,
        success: result !== null,
        metadata: { source: "web-scraper", blocked: sandboxResult.blocked },
      });
      return result;
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} Fetch failed for ${url}: ${err?.message}`);
      logExternalCall({
        providerId: domain,
        providerType: "knowledge-ingestion",
        taskType: "knowledge_synthesis",
        requestPayload: { url },
        latencyMs: Date.now() - start,
        success: false,
        errorMessage: err?.message,
        metadata: { source: "web-scraper" },
      });
      return null;
    }
  }

  async scrapeUrls(urls: string[]): Promise<IngestionResult> {
    const result: IngestionResult = { documentsProcessed: 0, documentsIngested: 0, duplicatesSkipped: 0, errors: [], domains: [] };

    for (const url of urls) {
      result.documentsProcessed++;
      try {
        const page = await this.fetchPage(url);
        if (!page || page.content.length < 100) {
          result.errors.push(`${url}: insufficient content`);
          continue;
        }

        const domain = new URL(url).hostname;
        const doc = normalizeDocument(page.title, page.content, url, "web", {
          url,
          domain,
          tags: [domain, "web-scraped"],
        });

        if (await isDuplicate(doc.contentHash)) {
          result.duplicatesSkipped++;
          continue;
        }

        await storeDocumentToKnowledgeBase(doc);
        result.documentsIngested++;
        if (!result.domains.includes(domain)) result.domains.push(domain);
        totalIngestedCount++;
      } catch (err: any) {
        result.errors.push(`${url}: ${err?.message}`);
      }
    }

    return result;
  }
}

export class APIIngestor {
  async fetchJSON(endpoint: string, headers: Record<string, string> = {}): Promise<unknown> {
    const domain = (() => { try { return new URL(endpoint).hostname; } catch { return "api"; } })();
    const start = Date.now();
    try {
      const sandboxResult = await runInSandbox({
        providerId: domain,
        providerType: "knowledge-ingestion",
        taskType: "knowledge_synthesis",
        payload: { url: endpoint },
        fn: async (sanitized) => {
          const s = sanitized as Record<string, unknown>;
          const safeEndpoint = typeof s.url === "string" ? s.url : endpoint;
          const resp = await fetch(safeEndpoint, {
            headers: { "Content-Type": "application/json", ...headers },
            signal: AbortSignal.timeout(10000),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.json();
        },
      });
      if (!sandboxResult.success || sandboxResult.blocked) {
        throw new Error(sandboxResult.blocked ?? sandboxResult.error ?? "Sandbox blocked request");
      }
      const data = sandboxResult.data;
      logExternalCall({
        providerId: domain,
        providerType: "knowledge-ingestion",
        taskType: "knowledge_synthesis",
        requestPayload: { endpoint },
        responsePayload: { type: typeof data, hasData: data !== null },
        latencyMs: Date.now() - start,
        success: true,
        metadata: { source: "api-ingestor" },
      });
      return data;
    } catch (err: any) {
      logExternalCall({
        providerId: domain,
        providerType: "knowledge-ingestion",
        taskType: "knowledge_synthesis",
        requestPayload: { endpoint },
        latencyMs: Date.now() - start,
        success: false,
        errorMessage: err?.message,
        metadata: { source: "api-ingestor" },
      });
      throw err;
    }
  }

  async ingestPublicAPIs(): Promise<IngestionResult> {
    const result: IngestionResult = { documentsProcessed: 0, documentsIngested: 0, duplicatesSkipped: 0, errors: [], domains: [] };

    const PUBLIC_SOURCES = [
      {
        name: "WikiData Entity",
        url: "https://www.wikidata.org/wiki/Special:EntityData/Q42.json",
        transform: (data: any) => ({
          title: "WikiData: Douglas Adams",
          content: JSON.stringify(data?.entities?.Q42?.descriptions ?? {}).slice(0, 3000),
          tags: ["wikidata", "knowledge-base"],
        }),
      },
    ];

    for (const source of PUBLIC_SOURCES) {
      result.documentsProcessed++;
      try {
        const data = await this.fetchJSON(source.url);
        const { title, content, tags } = source.transform(data);

        const doc = normalizeDocument(title, content, source.url, "api", { tags, domain: "api" });
        if (await isDuplicate(doc.contentHash)) { result.duplicatesSkipped++; continue; }

        await storeDocumentToKnowledgeBase(doc);
        result.documentsIngested++;
        result.domains.push("api");
        totalIngestedCount++;
      } catch (err: any) {
        result.errors.push(`${source.name}: ${err?.message}`);
      }
    }

    return result;
  }
}

export class DatasetLoader {
  async loadTextDataset(records: Array<{ title: string; content: string; source?: string; tags?: string[] }>): Promise<IngestionResult> {
    const result: IngestionResult = { documentsProcessed: 0, documentsIngested: 0, duplicatesSkipped: 0, errors: [], domains: [] };

    for (const record of records) {
      result.documentsProcessed++;
      try {
        const doc = normalizeDocument(
          record.title,
          record.content,
          record.source ?? "dataset",
          "dataset",
          { tags: record.tags ?? ["dataset"] }
        );

        if (await isDuplicate(doc.contentHash)) { result.duplicatesSkipped++; continue; }

        await storeDocumentToKnowledgeBase(doc);
        result.documentsIngested++;
        if (!result.domains.includes("dataset")) result.domains.push("dataset");
        totalIngestedCount++;
      } catch (err: any) {
        result.errors.push(`${record.title}: ${err?.message}`);
      }
    }

    return result;
  }

  async loadSovereignKnowledge(): Promise<IngestionResult> {
    const SOVEREIGN_DATASET = [
      {
        title: "Sovereign AI Principles",
        content: "A sovereign AI system operates independently of external dependencies. It maintains its own knowledge base, training infrastructure, and decision-making frameworks. Sovereignty requires: (1) internal model hosting, (2) local knowledge storage, (3) autonomous reasoning capabilities, (4) secure encrypted communications, (5) self-improvement through continuous learning.",
        tags: ["sovereignty", "ai-principles", "core"],
      },
      {
        title: "AGI Evaluation Framework",
        content: "Genuine AGI evaluation requires multi-domain testing across: reasoning (logical deduction, causal inference), knowledge (factual accuracy, cross-domain synthesis), planning (multi-step goal achievement, resource allocation), creativity (novel problem solving, analogy generation), self-correction (error detection, strategy revision). Metrics must go beyond keyword matching to include hallucination rates, solution quality, and time-to-correct-answer.",
        tags: ["agi", "evaluation", "benchmarks"],
      },
      {
        title: "Swarm Coordination Protocols",
        content: "Effective swarm coordination requires: (1) Task decomposition — break complex goals into parallelizable subtasks. (2) Agent specialization — assign tasks based on agent capabilities. (3) Proposal collection — gather multiple solution candidates. (4) Weighted voting — aggregate by expertise and historical accuracy. (5) Consensus threshold — 2/3 majority for critical decisions. (6) Result synthesis — merge best elements from approved proposals.",
        tags: ["swarm", "coordination", "protocols"],
      },
      {
        title: "Transfer Learning in Sovereign Systems",
        content: "Transfer learning allows a sovereign AI to apply knowledge from one domain to solve problems in another. Key patterns: (1) Structural analogy — map problem structure across domains. (2) Procedure transfer — apply known procedures to new contexts. (3) Constraint relaxation — adapt strict domain rules to flexible cross-domain applications. (4) Embedding similarity — use vector proximity to find relevant prior experience. Measuring transfer quality requires testing on held-out cross-domain tasks.",
        tags: ["transfer-learning", "training", "cross-domain"],
      },
      {
        title: "Self-Correction Mechanisms",
        content: "Self-correction in AI requires: (1) Error detection — identify inconsistencies in outputs against known facts. (2) Source triangulation — verify claims across multiple independent sources. (3) Confidence calibration — quantify uncertainty in each claim. (4) Revision strategy — decide whether to refine, reject, or escalate a response. (5) Learning from corrections — store correction patterns to prevent recurrence. Evaluation: measure correction rate on intentionally seeded errors.",
        tags: ["self-correction", "training", "quality"],
      },
    ];

    return this.loadTextDataset(SOVEREIGN_DATASET);
  }
}

export const webScraper = new WebScraper();
export const apiIngestor = new APIIngestor();
export const datasetLoader = new DatasetLoader();

export async function runIngestionCycle(): Promise<{
  cycleNumber: number;
  totalIngested: number;
  results: Record<string, IngestionResult>;
}> {
  ingestionCycleCount++;
  console.log(`${LOG_PREFIX} Ingestion cycle #${ingestionCycleCount} starting`);

  const results: Record<string, IngestionResult> = {};

  try {
    results.dataset = await datasetLoader.loadSovereignKnowledge();
    console.log(`${LOG_PREFIX} Dataset loaded: ${results.dataset.documentsIngested} docs`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Dataset load failed:`, err?.message);
    results.dataset = { documentsProcessed: 0, documentsIngested: 0, duplicatesSkipped: 0, errors: [err?.message], domains: [] };
  }

  try {
    results.api = await apiIngestor.ingestPublicAPIs();
    console.log(`${LOG_PREFIX} API ingested: ${results.api.documentsIngested} docs`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} API ingestion failed:`, err?.message);
    results.api = { documentsProcessed: 0, documentsIngested: 0, duplicatesSkipped: 0, errors: [err?.message], domains: [] };
  }

  return {
    cycleNumber: ingestionCycleCount,
    totalIngested: totalIngestedCount,
    results,
  };
}

export function getIngestionStatus() {
  return {
    cycleCount: ingestionCycleCount,
    totalIngested: totalIngestedCount,
    uniqueHashes: seenHashes.size,
    components: {
      webScraper: "active",
      apiIngestor: "active",
      datasetLoader: "active",
    },
  };
}

export async function initializeDataIngestionEngine(): Promise<void> {
  console.log(`${LOG_PREFIX} Initializing data ingestion engine`);
  runIngestionCycle().catch(err =>
    console.error(`${LOG_PREFIX} Initial ingestion cycle failed:`, err?.message)
  );
}
