import axios from "axios";
import {
  isHostileDomain, isTrackerURL, isHoneypot,
  scrubOutboundQuery, scrubOutboundURL,
  sanitizeInboundHTML, validateInboundJSON,
  buildSafeRequestConfig, safeFetch, safeJSONFetch,
  stripTrackingFromLinks, logSecurityEvent, getSecurityLog,
} from "./scraper-sandbox";

let _ssCounter = 0;

interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  images: string[];
  metadata: Record<string, string>;
  timestamp: number;
  engine: string;
  securityReport?: { threats: number; stripped: number };
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface LeadResult {
  name: string;
  type: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  category: string;
  source: string;
}

const SCRAPE_CACHE = new Map<string, { data: ScrapeResult; expiry: number }>();
const CACHE_TTL = 600000;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/131.0.0.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

function randomUA(): string {
  return USER_AGENTS[_ssCounter++ % USER_AGENTS.length];
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : "";
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const re = /<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    meta[m[1]] = m[2];
  }
  return meta;
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const re = /href="(https?:\/\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    links.push(m[1]);
  }
  return stripTrackingFromLinks([...new Set(links)]).slice(0, 50);
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const re = /src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^"]*)?)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!isTrackerURL(m[1]) && !isHostileDomain(m[1])) {
      images.push(m[1]);
    }
  }
  return [...new Set(images)].slice(0, 30);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}

export async function scrapePage(url: string): Promise<ScrapeResult> {
  const cached = SCRAPE_CACHE.get(url);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const urlCheck = scrubOutboundURL(url);
  if (!urlCheck.safe) {
    logSecurityEvent("scrape-blocked", "critical", `Scrape blocked for hostile/tracker URL: ${url}`);
    return {
      url, title: "", content: `BLOCKED — hostile domain or tracker detected: ${url}`,
      links: [], images: [], metadata: {}, timestamp: Date.now(), engine: "sovereign-scraper-blocked",
      securityReport: { threats: urlCheck.threats.length, stripped: 0 },
    };
  }

  try {
    const fetchResult = await safeFetch(urlCheck.url);
    if (fetchResult.blocked) {
      return {
        url, title: "", content: `BLOCKED by sandbox security`,
        links: [], images: [], metadata: {}, timestamp: Date.now(), engine: "sovereign-scraper-blocked",
        securityReport: { threats: fetchResult.threats.length, stripped: 0 },
      };
    }

    const html = fetchResult.data;
    const sandbox = sanitizeInboundHTML(html, url);

    const result: ScrapeResult = {
      url,
      title: extractTitle(sandbox.content),
      content: htmlToText(sandbox.content),
      links: extractLinks(sandbox.content, url),
      images: extractImages(sandbox.content),
      metadata: extractMetaTags(sandbox.content),
      timestamp: Date.now(),
      engine: "sovereign-scraper-sandboxed",
      securityReport: { threats: sandbox.threats.length, stripped: sandbox.strippedTrackers + sandbox.strippedScripts },
    };

    SCRAPE_CACHE.set(url, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
  } catch (err: any) {
    return {
      url, title: "", content: `Scrape failed: ${err.message}`,
      links: [], images: [], metadata: {}, timestamp: Date.now(), engine: "sovereign-scraper-error",
    };
  }
}

export async function searchGoogle(query: string, numResults: number = 10): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const safeQuery = scrubOutboundQuery(query);

  try {
    const config = buildSafeRequestConfig("https://html.duckduckgo.com/html/");
    const resp = await axios.get("https://html.duckduckgo.com/html/", {
      params: { q: safeQuery },
      ...config,
    });
    const html = resp.data;
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null && results.length < numResults) {
      let rawUrl = m[1].replace(/\/l\/\?uddg=/, "").split("&")[0];
      try { rawUrl = decodeURIComponent(rawUrl); } catch {}
      if (isHostileDomain(rawUrl) || isTrackerURL(rawUrl)) {
        logSecurityEvent("search-result-filtered", "medium", `Filtered hostile search result: ${rawUrl}`);
        continue;
      }
      results.push({
        url: rawUrl,
        title: m[2].replace(/<[^>]+>/g, "").trim(),
        snippet: m[3].replace(/<[^>]+>/g, "").trim(),
        source: "duckduckgo",
      });
    }
  } catch {}

  if (results.length < 3) {
    try {
      const config = buildSafeRequestConfig("https://api.search.brave.com");
      const resp = await axios.get(`https://api.search.brave.com/res/v1/web/search`, {
        params: { q: safeQuery, count: numResults },
        ...config,
      });
      if (resp.data?.web?.results) {
        for (const r of resp.data.web.results.slice(0, numResults)) {
          if (isHostileDomain(r.url) || isTrackerURL(r.url)) continue;
          results.push({
            title: r.title || "",
            url: r.url || "",
            snippet: r.description || "",
            source: "brave",
          });
        }
      }
    } catch {}
  }

  logSecurityEvent("search-completed", "low", `Search "${safeQuery.substring(0, 40)}" returned ${results.length} safe results`);
  return results;
}

export async function searchGitHub(query: string, category: string = "repositories"): Promise<any[]> {
  const safeQuery = scrubOutboundQuery(query);
  try {
    const config = buildSafeRequestConfig("https://api.github.com");
    const resp = await axios.get(`https://api.github.com/search/${category}`, {
      params: { q: safeQuery, sort: "stars", order: "desc", per_page: 20 },
      headers: {
        ...config.headers,
        "Accept": "application/vnd.github.v3+json",
      },
      timeout: config.timeout,
    });
    const validated = validateInboundJSON(resp.data, "api.github.com");
    for (const t of validated.threats) logSecurityEvent("github-inbound", t.severity, t.detail);
    return validated.data?.items || [];
  } catch {
    return [];
  }
}

export async function searchHuggingFace(query: string, type: string = "models"): Promise<any[]> {
  const safeQuery = scrubOutboundQuery(query);
  try {
    const config = buildSafeRequestConfig("https://huggingface.co");
    const resp = await axios.get(`https://huggingface.co/api/${type}`, {
      params: { search: safeQuery, sort: "downloads", direction: -1, limit: 20 },
      ...config,
    });
    const validated = validateInboundJSON(resp.data, "huggingface.co");
    for (const t of validated.threats) logSecurityEvent("hf-inbound", t.severity, t.detail);
    return validated.data || [];
  } catch {
    return [];
  }
}

export async function searchOllamaModels(query: string = ""): Promise<any[]> {
  try {
    const config = buildSafeRequestConfig("https://ollama.com");
    const resp = await axios.get("https://ollama.com/api/tags", config);
    const validated = validateInboundJSON(resp.data, "ollama.com");
    const models = validated.data?.models || [];
    if (query) {
      const safeQuery = scrubOutboundQuery(query);
      return models.filter((m: any) =>
        (m.name || "").toLowerCase().includes(safeQuery.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(safeQuery.toLowerCase())
      );
    }
    return models.slice(0, 50);
  } catch {
    return [];
  }
}

export async function searchGooglePlaces(query: string, location: string = "Chicago"): Promise<LeadResult[]> {
  logSecurityEvent("google-places-blocked", "high", `Google Places request BLOCKED — Google is hostile. Using OpenStreetMap instead. Query: ${scrubOutboundQuery(query).substring(0, 40)}`);
  return searchPlacesViaNominatim(query, location);
}

async function searchPlacesViaNominatim(query: string, location: string): Promise<LeadResult[]> {
  const safeQuery = scrubOutboundQuery(query);
  try {
    const config = buildSafeRequestConfig("https://nominatim.openstreetmap.org");
    const resp = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: `${safeQuery} ${location}`, format: "json", limit: 20, addressdetails: 1 },
      ...config,
    });
    const validated = validateInboundJSON(resp.data, "nominatim.openstreetmap.org");
    return (validated.data || []).map((place: any) => ({
      name: place.display_name?.split(",")[0] || "",
      type: place.type || "place",
      address: place.display_name || "",
      category: query,
      source: "openstreetmap",
    }));
  } catch {
    return [];
  }
}

export async function deepResearch(topic: string): Promise<{ summary: string; sources: SearchResult[]; findings: string[] }> {
  const safeTopic = scrubOutboundQuery(topic);
  const searches = [
    `${safeTopic} latest research 2026`,
    `${safeTopic} analysis`,
    `${safeTopic} implementation guide`,
  ];

  const allResults: SearchResult[] = [];
  const findings: string[] = [];

  for (const q of searches) {
    const results = await searchGoogle(q, 5);
    allResults.push(...results);

    for (const r of results.slice(0, 2)) {
      if (isHostileDomain(r.url)) continue;
      try {
        const page = await scrapePage(r.url);
        if (page.content.length > 100 && page.engine !== "sovereign-scraper-blocked") {
          const keyPhrases = page.content.slice(0, 2000).split(". ").filter(s => s.length > 30).slice(0, 3);
          findings.push(...keyPhrases);
        }
      } catch {}
    }
  }

  const ghRepos = await searchGitHub(safeTopic);
  for (const repo of ghRepos.slice(0, 3)) {
    findings.push(`GitHub: ${repo.full_name} (★${repo.stargazers_count}) — ${repo.description || ""}`);
  }

  const hfModels = await searchHuggingFace(safeTopic);
  for (const model of hfModels.slice(0, 3)) {
    findings.push(`HuggingFace: ${model.id || model.modelId} — ${(model.downloads || 0).toLocaleString()} downloads`);
  }

  logSecurityEvent("research-completed", "low", `Research "${safeTopic.substring(0, 30)}" — ${allResults.length} sources, ${findings.length} findings`);

  return {
    summary: `Research on "${topic}": ${allResults.length} sources found, ${findings.length} key findings, ${ghRepos.length} GitHub repos, ${hfModels.length} HuggingFace models`,
    sources: allResults,
    findings: findings.slice(0, 20),
  };
}

export async function seoAudit(url: string): Promise<Record<string, any>> {
  if (isHostileDomain(url)) {
    return { url, error: "BLOCKED — hostile domain", seoScore: 0 };
  }

  const page = await scrapePage(url);
  const audit: Record<string, any> = {
    url,
    title: page.title,
    titleLength: page.title.length,
    titleOptimal: page.title.length >= 30 && page.title.length <= 60,
    metaDescription: page.metadata["description"] || page.metadata["og:description"] || "",
    metaDescriptionLength: (page.metadata["description"] || "").length,
    metaDescriptionOptimal: (page.metadata["description"] || "").length >= 120 && (page.metadata["description"] || "").length <= 160,
    ogTitle: page.metadata["og:title"] || "",
    ogImage: page.metadata["og:image"] || "",
    ogType: page.metadata["og:type"] || "",
    hasCanonical: page.content.includes("canonical"),
    imageCount: page.images.length,
    linkCount: page.links.length,
    internalLinks: page.links.filter(l => { try { return l.includes(new URL(url).hostname); } catch { return false; } }).length,
    externalLinks: page.links.filter(l => { try { return !l.includes(new URL(url).hostname); } catch { return false; } }).length,
    contentLength: page.content.length,
    contentOptimal: page.content.length >= 300,
    timestamp: Date.now(),
    securityReport: page.securityReport,
  };

  let score = 0;
  if (audit.titleOptimal) score += 15;
  else if (audit.title) score += 8;
  if (audit.metaDescriptionOptimal) score += 15;
  else if (audit.metaDescription) score += 8;
  if (audit.ogTitle) score += 10;
  if (audit.ogImage) score += 10;
  if (audit.contentOptimal) score += 20;
  if (audit.imageCount > 0) score += 10;
  if (audit.internalLinks > 3) score += 10;
  if (audit.externalLinks > 0) score += 5;
  if (audit.hasCanonical) score += 5;

  audit.seoScore = score;
  audit.recommendations = [];
  if (!audit.titleOptimal) audit.recommendations.push("Optimize title tag to 30-60 characters");
  if (!audit.metaDescriptionOptimal) audit.recommendations.push("Add meta description (120-160 chars)");
  if (!audit.ogTitle) audit.recommendations.push("Add Open Graph title tag");
  if (!audit.ogImage) audit.recommendations.push("Add Open Graph image");
  if (!audit.contentOptimal) audit.recommendations.push("Add more content (min 300 words)");
  if (audit.imageCount === 0) audit.recommendations.push("Add images with alt text");
  if (audit.internalLinks < 3) audit.recommendations.push("Add more internal links");
  if (!audit.hasCanonical) audit.recommendations.push("Add canonical URL tag");

  return audit;
}

export async function googleIndexRequest(url: string): Promise<{ success: boolean; message: string }> {
  return { success: false, message: "BLOCKED — Google index requests permanently disabled. No search engine submissions. Sovereign privacy enforced." };
}

export function getScraperStats() {
  const secLog = getSecurityLog();
  return {
    cacheSize: SCRAPE_CACHE.size,
    engines: ["sovereign-scraper-sandboxed", "duckduckgo", "brave-search", "github-api", "huggingface-api", "ollama-registry", "openstreetmap", "nominatim"],
    security: {
      sandboxActive: true,
      hostileDomainsBlocked: true,
      googleBlocked: true,
      trackerStripping: true,
      honeypotDetection: true,
      outboundScrubbing: true,
      inboundSanitization: true,
      securityEvents: secLog,
    },
    capabilities: [
      "sandboxed-web-scraping",
      "search-aggregation",
      "github-repo-search",
      "huggingface-model-search",
      "ollama-model-search",
      "openstreetmap-search",
      "deep-research",
      "seo-audit",
      "content-extraction",
      "metadata-extraction",
      "tracker-free-link-analysis",
    ],
  };
}

// ── Data Normalization Layer ──

export interface NormalizedDataItem {
  id: string;
  type: "web_page" | "search_result" | "github_repo" | "huggingface_model" | "place" | "generic";
  title: string;
  content: string;
  url: string;
  source: string;
  sourceAttribution: string;
  confidenceScore: number;
  freshnessTimestamp: number;
  isStale: boolean;
  staleness: "fresh" | "recent" | "aging" | "stale" | "expired";
  tags: string[];
  schema: Record<string, any>;
  normalizedAt: number;
}

const FRESHNESS_THRESHOLDS = {
  fresh: 5 * 60 * 1000,
  recent: 60 * 60 * 1000,
  aging: 24 * 60 * 60 * 1000,
  stale: 7 * 24 * 60 * 60 * 1000,
};

function calculateStaleness(timestamp: number): NormalizedDataItem["staleness"] {
  const age = Date.now() - timestamp;
  if (age < FRESHNESS_THRESHOLDS.fresh) return "fresh";
  if (age < FRESHNESS_THRESHOLDS.recent) return "recent";
  if (age < FRESHNESS_THRESHOLDS.aging) return "aging";
  if (age < FRESHNESS_THRESHOLDS.stale) return "stale";
  return "expired";
}

function generateId(): string {
  return `nd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function estimateContentConfidence(content: string, source: string): number {
  let score = 0.5;
  if (content.length > 500) score += 0.1;
  if (content.length > 2000) score += 0.1;
  if (content.length > 5000) score += 0.05;
  if (source.includes("github.com")) score += 0.15;
  if (source.includes("wikipedia.org")) score += 0.1;
  if (source.includes("arxiv.org")) score += 0.15;
  if (source.includes("huggingface.co")) score += 0.1;
  if (["duckduckgo", "brave"].includes(source)) score += 0.05;
  if (/scrape.*fail|error|timeout|blocked/i.test(content)) score -= 0.3;
  if (content.length < 50) score -= 0.2;
  return Math.round(Math.min(1.0, Math.max(0.0, score)) * 100) / 100;
}

function extractTags(title: string, content: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const tagPatterns: [RegExp, string][] = [
    [/typescript|javascript|python|rust|go\b|java\b/g, "programming"],
    [/machine learning|neural network|deep learning|llm|ai\b/g, "ai"],
    [/api|rest|graphql|endpoint/g, "api"],
    [/security|vulnerability|exploit|cve/g, "security"],
    [/crypto|blockchain|defi|web3/g, "crypto"],
    [/research|paper|study|analysis/g, "research"],
    [/tutorial|guide|documentation|how.to/g, "educational"],
    [/github|repository|repo|open.source/g, "oss"],
  ];
  const tags = new Set<string>();
  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(text)) tags.add(tag);
  }
  return [...tags];
}

export function normalizeScrapedPage(page: ScrapeResult): NormalizedDataItem {
  return {
    id: generateId(),
    type: "web_page",
    title: page.title,
    content: page.content,
    url: page.url,
    source: page.url,
    sourceAttribution: `Scraped from ${new URL(page.url).hostname}`,
    confidenceScore: estimateContentConfidence(page.content, page.url),
    freshnessTimestamp: page.timestamp,
    isStale: calculateStaleness(page.timestamp) === "stale" || calculateStaleness(page.timestamp) === "expired",
    staleness: calculateStaleness(page.timestamp),
    tags: extractTags(page.title, page.content),
    schema: { metadata: page.metadata, linkCount: page.links.length, imageCount: page.images.length },
    normalizedAt: Date.now(),
  };
}

export function normalizeSearchResults(results: SearchResult[]): NormalizedDataItem[] {
  return results.map(r => ({
    id: generateId(),
    type: "search_result" as const,
    title: r.title,
    content: r.snippet,
    url: r.url,
    source: r.source,
    sourceAttribution: `Search result from ${r.source}`,
    confidenceScore: estimateContentConfidence(r.snippet, r.source),
    freshnessTimestamp: Date.now(),
    isStale: false,
    staleness: "fresh" as const,
    tags: extractTags(r.title, r.snippet),
    schema: {},
    normalizedAt: Date.now(),
  }));
}

export function normalizeGitHubRepos(repos: any[]): NormalizedDataItem[] {
  return repos.map(r => ({
    id: generateId(),
    type: "github_repo" as const,
    title: r.full_name || r.name || "",
    content: r.description || "",
    url: r.html_url || "",
    source: "github.com",
    sourceAttribution: `GitHub repository by ${r.owner?.login || "unknown"}`,
    confidenceScore: Math.min(1.0, 0.5 + (r.stargazers_count > 100 ? 0.2 : 0) + (r.stargazers_count > 1000 ? 0.2 : 0)),
    freshnessTimestamp: new Date(r.pushed_at || r.updated_at || Date.now()).getTime(),
    isStale: false,
    staleness: calculateStaleness(new Date(r.pushed_at || Date.now()).getTime()),
    tags: [...extractTags(r.full_name || "", r.description || ""), "github"],
    schema: { stars: r.stargazers_count, forks: r.forks_count, language: r.language },
    normalizedAt: Date.now(),
  }));
}

export function normalizeHuggingFaceModels(models: any[]): NormalizedDataItem[] {
  return models.map(m => ({
    id: generateId(),
    type: "huggingface_model" as const,
    title: m.id || m.modelId || "",
    content: `${m.id || m.modelId} — ${(m.downloads || 0).toLocaleString()} downloads, ${(m.likes || 0)} likes`,
    url: `https://huggingface.co/${m.id || m.modelId}`,
    source: "huggingface.co",
    sourceAttribution: `HuggingFace model by ${m.author || "unknown"}`,
    confidenceScore: Math.min(1.0, 0.5 + (m.downloads > 1000 ? 0.2 : 0) + (m.downloads > 10000 ? 0.2 : 0)),
    freshnessTimestamp: new Date(m.lastModified || Date.now()).getTime(),
    isStale: false,
    staleness: calculateStaleness(new Date(m.lastModified || Date.now()).getTime()),
    tags: [...extractTags(m.id || "", ""), "ai", "model"],
    schema: { downloads: m.downloads, likes: m.likes, pipeline_tag: m.pipeline_tag },
    normalizedAt: Date.now(),
  }));
}

export function checkDataFreshness(items: NormalizedDataItem[]): {
  fresh: number; recent: number; aging: number; stale: number; expired: number;
  averageAge: number; freshPercentage: number;
} {
  const counts = { fresh: 0, recent: 0, aging: 0, stale: 0, expired: 0 };
  let totalAge = 0;
  for (const item of items) {
    counts[item.staleness]++;
    totalAge += Date.now() - item.freshnessTimestamp;
  }
  return {
    ...counts,
    averageAge: items.length > 0 ? Math.round(totalAge / items.length) : 0,
    freshPercentage: items.length > 0 ? Math.round(((counts.fresh + counts.recent) / items.length) * 100) : 0,
  };
}

export async function normalizedDeepResearch(topic: string): Promise<{
  summary: string;
  items: NormalizedDataItem[];
  freshness: ReturnType<typeof checkDataFreshness>;
  security: ReturnType<typeof getSecurityLog>;
}> {
  const research = await deepResearch(topic);
  const items: NormalizedDataItem[] = [
    ...normalizeSearchResults(research.sources),
  ];
  const freshness = checkDataFreshness(items);
  const security = getSecurityLog();

  return {
    summary: research.summary,
    items,
    freshness,
    security,
  };
}

console.log("[SovereignScraper] Sandboxed Scraper Engine initialized — Google BLOCKED, tracker stripping ACTIVE, honeypot detection ACTIVE, outbound scrubbing ACTIVE");
