import axios from "axios";

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
  return [...new Set(links)].slice(0, 50);
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
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}

export async function scrapePage(url: string): Promise<ScrapeResult> {
  const cached = SCRAPE_CACHE.get(url);
  if (cached && cached.expiry > Date.now()) return cached.data;

  try {
    const resp = await axios.get(url, {
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
    const result: ScrapeResult = {
      url,
      title: extractTitle(html),
      content: htmlToText(html),
      links: extractLinks(html, url),
      images: extractImages(html),
      metadata: extractMetaTags(html),
      timestamp: Date.now(),
      engine: "sovereign-scraper",
    };

    SCRAPE_CACHE.set(url, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
  } catch (err: any) {
    return {
      url,
      title: "",
      content: `Scrape failed: ${err.message}`,
      links: [],
      images: [],
      metadata: {},
      timestamp: Date.now(),
      engine: "sovereign-scraper-error",
    };
  }
}

export async function searchGoogle(query: string, numResults: number = 10): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const resp = await axios.get("https://html.duckduckgo.com/html/", {
      params: { q: query },
      headers: { "User-Agent": randomUA() },
      timeout: 10000,
    });
    const html = resp.data;
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null && results.length < numResults) {
      results.push({
        url: m[1].replace(/\/l\/\?uddg=/, "").split("&")[0],
        title: m[2].replace(/<[^>]+>/g, "").trim(),
        snippet: m[3].replace(/<[^>]+>/g, "").trim(),
        source: "duckduckgo",
      });
    }
  } catch {}

  if (results.length < 3) {
    try {
      const resp = await axios.get(`https://api.search.brave.com/res/v1/web/search`, {
        params: { q: query, count: numResults },
        headers: {
          "Accept": "application/json",
          "User-Agent": randomUA(),
        },
        timeout: 10000,
      });
      if (resp.data?.web?.results) {
        for (const r of resp.data.web.results.slice(0, numResults)) {
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

  return results;
}

export async function searchGitHub(query: string, category: string = "repositories"): Promise<any[]> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const resp = await axios.get(`https://api.github.com/search/${category}`, {
      params: { q: query, sort: "stars", order: "desc", per_page: 20 },
      headers: {
        "Accept": "application/vnd.github.v3+json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        "User-Agent": "Tessera-Sovereign/1.0",
      },
      timeout: 10000,
    });
    return resp.data.items || [];
  } catch {
    return [];
  }
}

export async function searchHuggingFace(query: string, type: string = "models"): Promise<any[]> {
  try {
    const resp = await axios.get(`https://huggingface.co/api/${type}`, {
      params: { search: query, sort: "downloads", direction: -1, limit: 20 },
      headers: { "User-Agent": "Tessera-Sovereign/1.0" },
      timeout: 10000,
    });
    return resp.data || [];
  } catch {
    return [];
  }
}

export async function searchOllamaModels(query: string = ""): Promise<any[]> {
  try {
    const resp = await axios.get("https://ollama.com/api/tags", {
      headers: { "User-Agent": "Tessera-Sovereign/1.0" },
      timeout: 10000,
    });
    const models = resp.data?.models || [];
    if (query) {
      return models.filter((m: any) => 
        (m.name || "").toLowerCase().includes(query.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(query.toLowerCase())
      );
    }
    return models.slice(0, 50);
  } catch {
    return [];
  }
}

export async function searchGooglePlaces(query: string, location: string = "Chicago"): Promise<LeadResult[]> {
  const apifyToken = process.env.APIFY_API_KEY;
  if (!apifyToken) {
    return searchPlacesViaNominatim(query, location);
  }

  try {
    const resp = await axios.post(
      "https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items",
      { searchStringsArray: [`${query} ${location}`], maxCrawledPlacesPerSearch: 20 },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apifyToken}`,
        },
        timeout: 60000,
        params: { token: apifyToken },
      }
    );

    return (resp.data || []).map((place: any) => ({
      name: place.title || place.name || "",
      type: "business",
      address: place.address || "",
      phone: place.phone || "",
      website: place.website || "",
      rating: place.totalScore || 0,
      category: query,
      source: "apify-google-places",
    }));
  } catch {
    return searchPlacesViaNominatim(query, location);
  }
}

async function searchPlacesViaNominatim(query: string, location: string): Promise<LeadResult[]> {
  try {
    const resp = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: `${query} ${location}`, format: "json", limit: 20, addressdetails: 1 },
      headers: { "User-Agent": "Tessera-Sovereign/1.0" },
      timeout: 10000,
    });
    return (resp.data || []).map((place: any) => ({
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
  const searches = [
    `${topic} latest research 2026`,
    `${topic} analysis`,
    `${topic} implementation guide`,
  ];

  const allResults: SearchResult[] = [];
  const findings: string[] = [];

  for (const q of searches) {
    const results = await searchGoogle(q, 5);
    allResults.push(...results);

    for (const r of results.slice(0, 2)) {
      try {
        const page = await scrapePage(r.url);
        if (page.content.length > 100) {
          const keyPhrases = page.content.slice(0, 2000).split(". ").filter(s => s.length > 30).slice(0, 3);
          findings.push(...keyPhrases);
        }
      } catch {}
    }
  }

  const ghRepos = await searchGitHub(topic);
  for (const repo of ghRepos.slice(0, 3)) {
    findings.push(`GitHub: ${repo.full_name} (★${repo.stargazers_count}) — ${repo.description || ""}`);
  }

  const hfModels = await searchHuggingFace(topic);
  for (const model of hfModels.slice(0, 3)) {
    findings.push(`HuggingFace: ${model.id || model.modelId} — ${(model.downloads || 0).toLocaleString()} downloads`);
  }

  return {
    summary: `Research on "${topic}": ${allResults.length} sources found, ${findings.length} key findings, ${ghRepos.length} GitHub repos, ${hfModels.length} HuggingFace models`,
    sources: allResults,
    findings: findings.slice(0, 20),
  };
}

export async function seoAudit(url: string): Promise<Record<string, any>> {
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
    internalLinks: page.links.filter(l => l.includes(new URL(url).hostname)).length,
    externalLinks: page.links.filter(l => !l.includes(new URL(url).hostname)).length,
    contentLength: page.content.length,
    contentOptimal: page.content.length >= 300,
    timestamp: Date.now(),
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
  return { success: false, message: "BLOCKED — Google index requests disabled for sovereign privacy. No search engine submissions allowed." };
}

export function getScraperStats() {
  return {
    cacheSize: SCRAPE_CACHE.size,
    engines: ["sovereign-scraper", "duckduckgo", "brave-search", "github-api", "huggingface-api", "ollama-registry", "apify", "openstreetmap", "nominatim"],
    capabilities: [
      "web-scraping",
      "search-aggregation",
      "github-repo-search",
      "huggingface-model-search",
      "ollama-model-search",
      "google-places-search",
      "lead-generation",
      "deep-research",
      "seo-audit",
      "google-index-ping",
      "content-extraction",
      "metadata-extraction",
      "link-analysis",
      "image-extraction",
    ],
    repoKnowledge: [
      "firecrawl (web crawler)",
      "scrapegraph-ai (AI scraping)",
      "deep-research (multi-source research)",
      "google-maps-scraper (places/leads)",
      "awesome-web-scraping (technique library)",
      "google-indexing-script (SEO indexing)",
      "lead-generation (business leads)",
    ],
  };
}

console.log("[SovereignScraper] Sovereign Scraper Engine initialized — web scraping, search, research, SEO, lead gen active");
