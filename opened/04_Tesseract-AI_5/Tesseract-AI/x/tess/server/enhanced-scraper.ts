import axios from "axios";
import { isHostileDomain, safeFetch, logSecurityEvent, stripTrackingFromLinks } from "./scraper-sandbox";
import { resolveAndCheckSSRF } from "./ssrf-guard";
import { getRandomUserAgent } from "./orchestrator-config";

const log = (m: string) => console.log(`[EnhancedScraper] ${m}`);
const warn = (m: string) => console.log(`[EnhancedScraper] WARNING: ${m}`);

interface EnhancedScrapeResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  images: string[];
  metadata: Record<string, string>;
  timestamp: number;
  engine: string;
  respectsRobots: boolean;
  scrapeTimeMs: number;
  contentLength: number;
  securityReport: { ssrfChecked: boolean; sanitized: boolean; threatsBlocked: number };
}

interface RobotsRules {
  allowed: string[];
  disallowed: string[];
  crawlDelay: number;
  sitemaps: string[];
  fetchedAt: number;
}

const robotsCache = new Map<string, RobotsRules>();
const ROBOTS_CACHE_TTL = 3600_000;
const domainLastRequest = new Map<string, number>();
const DEFAULT_CRAWL_DELAY = 2000;

async function fetchRobotsTxt(hostname: string): Promise<RobotsRules> {
  const cached = robotsCache.get(hostname);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL) {
    return cached;
  }

  const rules: RobotsRules = { allowed: [], disallowed: [], crawlDelay: DEFAULT_CRAWL_DELAY, sitemaps: [], fetchedAt: Date.now() };

  try {
    const ssrf = await resolveAndCheckSSRF(hostname);
    if (!ssrf.safe) {
      warn(`SSRF blocked for robots.txt: ${hostname}`);
      return rules;
    }

    const res = await axios.get(`https://${hostname}/robots.txt`, {
      timeout: 5000,
      headers: { "User-Agent": getRandomUserAgent() },
      maxRedirects: 3,
    });

    if (typeof res.data === "string") {
      parseRobotsTxt(res.data, rules);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Could not fetch robots.txt for ${hostname}: ${message}`);
  }

  robotsCache.set(hostname, rules);
  return rules;
}

function parseRobotsTxt(text: string, rules: RobotsRules): void {
  let inUserAgent = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;

    const lower = trimmed.toLowerCase();
    if (lower.startsWith("user-agent:")) {
      const ua = trimmed.slice(11).trim();
      inUserAgent = ua === "*" || ua.toLowerCase().includes("tessera");
    } else if (inUserAgent) {
      if (lower.startsWith("disallow:")) {
        const path = trimmed.slice(9).trim();
        if (path) rules.disallowed.push(path);
      } else if (lower.startsWith("allow:")) {
        const path = trimmed.slice(6).trim();
        if (path) rules.allowed.push(path);
      } else if (lower.startsWith("crawl-delay:")) {
        const delay = parseInt(trimmed.slice(12).trim(), 10);
        if (!isNaN(delay) && delay > 0) rules.crawlDelay = delay * 1000;
      }
    }

    if (lower.startsWith("sitemap:")) {
      rules.sitemaps.push(trimmed.slice(8).trim());
    }
  }
}

function isPathAllowed(urlPath: string, rules: RobotsRules): boolean {
  for (const allowed of rules.allowed) {
    if (urlPath.startsWith(allowed)) return true;
  }
  for (const disallowed of rules.disallowed) {
    if (urlPath.startsWith(disallowed)) return false;
  }
  return true;
}

async function respectRateLimit(hostname: string, crawlDelay: number): Promise<void> {
  const lastReq = domainLastRequest.get(hostname) || 0;
  const elapsed = Date.now() - lastReq;
  if (elapsed < crawlDelay) {
    await new Promise(resolve => setTimeout(resolve, crawlDelay - elapsed));
  }
  domainLastRequest.set(hostname, Date.now());
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

function extractLinks(html: string): string[] {
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
    images.push(m[1]);
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
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}

export async function enhancedScrape(url: string): Promise<EnhancedScrapeResult> {
  const start = Date.now();
  let threatsBlocked = 0;

  const parsed = new URL(url);
  const hostname = parsed.hostname;

  if (isHostileDomain(url)) {
    threatsBlocked++;
    logSecurityEvent("hostile_domain_blocked", "high", `Blocked hostile domain: ${hostname}`);
    throw new Error(`Hostile domain blocked: ${hostname}`);
  }

  const ssrf = await resolveAndCheckSSRF(hostname);
  if (!ssrf.safe) {
    threatsBlocked++;
    logSecurityEvent("ssrf_blocked", "critical", `SSRF blocked: ${hostname} resolves to private IP ${ssrf.ip}`);
    throw new Error(`SSRF blocked: ${hostname} resolves to private IP ${ssrf.ip}`);
  }

  const robots = await fetchRobotsTxt(hostname);
  const pathAllowed = isPathAllowed(parsed.pathname, robots);

  if (!pathAllowed) {
    warn(`Path disallowed by robots.txt: ${parsed.pathname} on ${hostname}`);
    return {
      url, title: "", content: "", links: [], images: [],
      metadata: { "robots-blocked": "true" }, timestamp: Date.now(),
      engine: "enhanced-scraper", respectsRobots: true,
      scrapeTimeMs: Date.now() - start, contentLength: 0,
      securityReport: { ssrfChecked: true, sanitized: false, threatsBlocked },
    };
  }

  await respectRateLimit(hostname, robots.crawlDelay);

  const response = await safeFetch(url);
  if (response.blocked) {
    threatsBlocked += response.threats.length;
    throw new Error(`Fetch blocked by scraper sandbox for ${url}`);
  }
  const html = response.data;
  const content = htmlToText(html);

  return {
    url,
    title: extractTitle(html),
    content,
    links: extractLinks(html),
    images: extractImages(html),
    metadata: extractMetaTags(html),
    timestamp: Date.now(),
    engine: "enhanced-scraper",
    respectsRobots: true,
    scrapeTimeMs: Date.now() - start,
    contentLength: content.length,
    securityReport: { ssrfChecked: true, sanitized: true, threatsBlocked },
  };
}

export async function enhancedSearch(query: string, sources: string[] = ["duckduckgo"]): Promise<Array<{ title: string; url: string; snippet: string; source: string }>> {
  const results: Array<{ title: string; url: string; snippet: string; source: string }> = [];

  for (const source of sources) {
    try {
      if (source === "duckduckgo") {
        const res = await axios.get(`https://api.duckduckgo.com/`, {
          params: { q: query, format: "json", no_html: 1, skip_disambig: 1 },
          timeout: 8000,
          headers: { "User-Agent": getRandomUserAgent() },
        });
        if (res.data?.AbstractText) {
          results.push({ title: res.data.Heading || query, url: res.data.AbstractURL || "", snippet: res.data.AbstractText, source: "duckduckgo" });
        }
        if (res.data?.RelatedTopics) {
          for (const topic of res.data.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              results.push({ title: topic.Text.slice(0, 100), url: topic.FirstURL, snippet: topic.Text, source: "duckduckgo" });
            }
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Search failed for source ${source}: ${message}`);
    }
  }

  return results;
}

export function getScraperStats(): {
  robotsCacheSize: number;
  trackedDomains: number;
} {
  return {
    robotsCacheSize: robotsCache.size,
    trackedDomains: domainLastRequest.size,
  };
}

export type { EnhancedScrapeResult };
