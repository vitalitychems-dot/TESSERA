import { logger } from "./logger";
import { logProviderCall } from "./provider-call-logger";
import { queryWikipedia, type WikipediaSummary } from "./providers/wikipedia-provider";
import { queryArxiv, type ArxivPaper } from "./providers/arxiv-provider";

export type SovereignDomain =
  | "knowledge"
  | "quantum"
  | "bio"
  | "mesh"
  | "finance";

export interface SovereignRequest {
  domain: SovereignDomain;
  query: string;
  options?: Record<string, unknown>;
}

export interface KnowledgeResult {
  type: "knowledge";
  topic: string;
  found: boolean;
  content: string | null;
  description?: string;
  url?: string;
  pageId?: number;
  papers?: ArxivPaper[];
}

export interface StubResult {
  type: string;
  status: "stub";
  message: string;
  query: string;
}

export type SovereignResult = KnowledgeResult | StubResult;

export interface SovereignResponse {
  ok: boolean;
  domain: SovereignDomain;
  query: string;
  result: SovereignResult | null;
  source: string;
  latencyMs: number;
  error?: string;
}

export async function runThroughSovereignEngine(
  req: SovereignRequest,
): Promise<SovereignResponse> {
  const start = Date.now();
  logger.info({ domain: req.domain, query: req.query.slice(0, 80) }, "SovereignEngineRouter: routing request");

  try {
    const result = await routeToDomain(req);
    const latencyMs = Date.now() - start;

    await logProviderCall({
      providerId: `sovereign-${req.domain}`,
      providerName: `Sovereign Engine [${req.domain}]`,
      model: "internal",
      requestMessages: [{ role: "user", content: req.query }],
      responseText: JSON.stringify(result).slice(0, 500),
      latencyMs,
      isExternal: false,
    }).catch(() => {});

    logger.info(
      { domain: req.domain, latencyMs },
      "SovereignEngineRouter: request fulfilled",
    );

    return {
      ok: true,
      domain: req.domain,
      query: req.query,
      result,
      source: domainSource(req.domain),
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);

    logger.error(
      { domain: req.domain, err: errMsg, latencyMs },
      "SovereignEngineRouter: error",
    );

    await logProviderCall({
      providerId: `sovereign-${req.domain}`,
      providerName: `Sovereign Engine [${req.domain}]`,
      model: "internal",
      requestMessages: [{ role: "user", content: req.query }],
      latencyMs,
      isExternal: false,
      error: errMsg,
    }).catch(() => {});

    return {
      ok: false,
      domain: req.domain,
      query: req.query,
      result: null,
      source: domainSource(req.domain),
      latencyMs,
      error: errMsg,
    };
  }
}

async function routeToDomain(req: SovereignRequest): Promise<SovereignResult> {
  switch (req.domain) {
    case "knowledge":
      return handleKnowledgeDomain(req.query);
    case "quantum":
      return stubDomain("quantum", req.query);
    case "bio":
      return stubDomain("bio", req.query);
    case "mesh":
      return stubDomain("mesh", req.query);
    case "finance":
      return stubDomain("finance", req.query);
    default: {
      const _exhaustive: never = req.domain;
      throw new Error(`Unknown domain: ${String(_exhaustive)}`);
    }
  }
}

async function handleKnowledgeDomain(query: string): Promise<KnowledgeResult> {
  const topic = extractTopic(query);

  const [wikiSummary, arxivPapers] = await Promise.allSettled([
    queryWikipedia(topic),
    queryArxiv(topic, 3),
  ]);

  const summary: WikipediaSummary | null =
    wikiSummary.status === "fulfilled" ? wikiSummary.value : null;
  const papers: ArxivPaper[] =
    arxivPapers.status === "fulfilled" ? arxivPapers.value : [];

  if (!summary && papers.length === 0) {
    return {
      type: "knowledge",
      topic,
      found: false,
      content: null,
      papers,
    };
  }

  const content = summary?.extract ?? (papers[0] ? `${papers[0].title}: ${papers[0].summary}` : null);

  return {
    type: "knowledge",
    topic: summary?.title ?? topic,
    found: true,
    content,
    description: summary?.description,
    url: summary?.url,
    pageId: summary?.pageId,
    papers: papers.length > 0 ? papers : undefined,
  };
}

function stubDomain(domain: string, query: string): StubResult {
  return {
    type: domain,
    status: "stub",
    message: `${domain} domain routing is not yet implemented`,
    query,
  };
}

function extractTopic(query: string): string {
  const cleaned = query
    .replace(/^(tell me about|explain|what is|describe|summarize)\s+/i, "")
    .replace(/\?+$/, "")
    .trim();
  return cleaned.slice(0, 200) || query;
}

function domainSource(domain: SovereignDomain): string {
  const sources: Record<SovereignDomain, string> = {
    knowledge: "wikipedia+arxiv",
    quantum: "stub",
    bio: "stub",
    mesh: "stub",
    finance: "stub",
  };
  return sources[domain] ?? "unknown";
}
