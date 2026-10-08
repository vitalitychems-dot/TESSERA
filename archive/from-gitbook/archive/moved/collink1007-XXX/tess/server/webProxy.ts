import axios from "axios";
import * as cheerio from "cheerio";
import { rateLimitedRequest } from "./sovereign-lang";
import { randomHeaders } from "./sovereign-randomizer";

const STEALTH_HEADERS = {
  ...randomHeaders(),
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

const BLOCKED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
  "169.254.",
];

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid",
  "ref", "referrer", "affiliate",
];

export interface BrowseResult {
  title: string;
  content: string;
  links: { text: string; href: string }[];
  images: { alt: string; src: string }[];
  url: string;
  contentType: string;
  statusCode: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  engine: string;
  results: SearchResult[];
}

function isPrivateIP(ip: string): boolean {
  if (ip === "localhost" || ip === "::1") return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts.every(p => p === 255)) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    const hostname = parsed.hostname;
    if (BLOCKED_DOMAINS.some(d => hostname.startsWith(d) || hostname === d)) return true;
    if (isPrivateIP(hostname)) return true;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".arpa")) return true;
    if (parsed.port && !["80", "443", ""].includes(parsed.port)) return true;
    return false;
  } catch {
    return true;
  }
}

function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function extractReadableContent($: cheerio.CheerioAPI): string {
  $("script, style, noscript, iframe, svg, nav, footer, header, aside, [role='banner'], [role='navigation'], [role='complementary'], .ad, .ads, .advertisement, .sidebar, .cookie-banner, .popup, .modal").remove();

  $("[onclick], [onload], [onerror]").each(function () {
    $(this).removeAttr("onclick").removeAttr("onload").removeAttr("onerror");
  });

  const article = $("article, [role='main'], main, .post-content, .article-body, .entry-content, #content, .content").first();
  const target = article.length > 0 ? article : $("body");

  const blocks: string[] = [];
  target.find("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, figcaption, dt, dd").each(function () {
    const tag = ((this as any).tagName || "").toLowerCase();
    const text = $(this).text().replace(/\s+/g, " ").trim();
    if (!text || text.length < 2) return;

    if (tag.startsWith("h")) {
      const level = parseInt(tag[1]) || 1;
      blocks.push("\n" + "#".repeat(level) + " " + text + "\n");
    } else if (tag === "li") {
      blocks.push("- " + text);
    } else if (tag === "blockquote") {
      blocks.push("> " + text);
    } else if (tag === "pre") {
      blocks.push("```\n" + text + "\n```");
    } else {
      blocks.push(text);
    }
  });

  let content = blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (content.length < 100) {
    content = target.text().replace(/\s+/g, " ").trim();
  }

  return content.slice(0, 80000);
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): { text: string; href: string }[] {
  const links: { text: string; href: string }[] = [];
  const seen = new Set<string>();

  $("a[href]").each(function () {
    const href = $(this).attr("href");
    const text = $(this).text().replace(/\s+/g, " ").trim();
    if (!href || !text || text.length < 2 || text.length > 200) return;
    if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;

    let fullUrl = href;
    try {
      fullUrl = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      links.push({ text, href: fullUrl });
    }
  });

  return links.slice(0, 50);
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): { alt: string; src: string }[] {
  const images: { alt: string; src: string }[] = [];
  const seen = new Set<string>();

  $("img[src]").each(function () {
    const src = $(this).attr("src");
    const alt = $(this).attr("alt")?.trim() || "";
    if (!src) return;
    if (src.startsWith("data:") || src.includes("tracking") || src.includes("pixel")) return;

    let fullSrc = src;
    try {
      fullSrc = new URL(src, baseUrl).toString();
    } catch {
      return;
    }

    if (!seen.has(fullSrc)) {
      seen.add(fullSrc);
      images.push({ alt, src: fullSrc });
    }
  });

  return images.slice(0, 30);
}

export async function browseUrl(url: string): Promise<BrowseResult> {
  const cleanUrl = stripTrackingParams(url);

  if (isBlockedUrl(cleanUrl)) {
    throw new Error("Access to internal/private network addresses is blocked for security");
  }

  return await rateLimitedRequest("default", async () => {
    const response = await axios.get(cleanUrl, {
      timeout: 20000,
      maxRedirects: 3,
      headers: STEALTH_HEADERS,
      validateStatus: () => true,
      maxContentLength: 10 * 1024 * 1024,
      responseType: "text",
      beforeRedirect: (options: any) => {
        const redirectUrl = options.href || options.url;
        if (redirectUrl && isBlockedUrl(redirectUrl)) {
          throw new Error("Redirect to internal/private address blocked");
        }
      },
    });

    const contentType = (response.headers["content-type"] || "").toLowerCase();

    if (contentType.includes("application/json")) {
      const jsonStr = typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2);
      return {
        title: "JSON Response",
        content: jsonStr.slice(0, 80000),
        links: [],
        images: [],
        url: cleanUrl,
        contentType,
        statusCode: response.status,
      };
    }

    if (!contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("text")) {
      return {
        title: "Binary Content",
        content: `This URL returned binary content (${contentType}). Cannot extract text.`,
        links: [],
        images: [],
        url: cleanUrl,
        contentType,
        statusCode: response.status,
      };
    }

    const rawHtml = typeof response.data === "string" ? response.data : String(response.data);
    const $ = cheerio.load(rawHtml);

    const title = $("title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("h1").first().text().trim() ||
      "Untitled Page";

    const content = extractReadableContent($);
    const links = extractLinks($, cleanUrl);
    const images = extractImages($, cleanUrl);

    return {
      title,
      content,
      links,
      images,
      url: cleanUrl,
      contentType,
      statusCode: response.status,
    };
  });
}

export async function searchWeb(query: string, engine: "duckduckgo" | "google" = "duckduckgo"): Promise<SearchResponse> {
  let result: SearchResponse | null = null;
  if (engine === "duckduckgo") {
    try {
      result = await searchDuckDuckGo(query);
    } catch {
      try { result = await searchDuckDuckGoHtml(query); } catch {}
    }
  } else {
    try {
      result = await searchGoogleScrape(query);
    } catch {
      try { result = await searchDuckDuckGo(query); } catch {}
    }
  }

  if (result && result.results.length > 0) {
    try {
      const { indexSearchDocument, absorbResponse } = await import("./sovereign-engine");
      for (const r of result.results.slice(0, 5)) {
        indexSearchDocument(r.url, r.title, r.snippet);
      }
      absorbResponse(query, JSON.stringify(result.results.slice(0, 3)), "search-external", "search");
    } catch {}
    return result;
  }

  try {
    const { localSearch } = await import("./sovereign-engine");
    const localResults = localSearch(query);
    if (localResults.length > 0) {
      return { results: localResults.map(r => ({ ...r, snippet: r.snippet })), source: "sovereign-local" as any };
    }
  } catch {}

  return result || { results: [], source: "none" as any };
}

async function searchDuckDuckGo(query: string): Promise<SearchResponse> {
  return await rateLimitedRequest("duckduckgo", async () => {
    const res = await axios.get(`https://api.duckduckgo.com/`, {
      params: { q: query, format: "json", no_html: 1, skip_disambig: 1 },
      timeout: 10000,
      headers: STEALTH_HEADERS,
    });

    const results: SearchResult[] = [];

    if (res.data.Abstract) {
      results.push({
        title: res.data.Heading || query,
        url: res.data.AbstractURL || "",
        snippet: res.data.Abstract,
      });
    }

    if (res.data.RelatedTopics) {
      for (const topic of res.data.RelatedTopics) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.slice(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
        if (topic.Topics) {
          for (const sub of topic.Topics) {
            if (sub.Text && sub.FirstURL) {
              results.push({
                title: sub.Text.slice(0, 100),
                url: sub.FirstURL,
                snippet: sub.Text,
              });
            }
          }
        }
      }
    }

    if (res.data.Results) {
      for (const r of res.data.Results) {
        if (r.Text && r.FirstURL) {
          results.push({
            title: r.Text.slice(0, 100),
            url: r.FirstURL,
            snippet: r.Text,
          });
        }
      }
    }

    if (results.length === 0) {
      return await searchDuckDuckGoHtml(query);
    }

    return { query, engine: "duckduckgo", results: results.slice(0, 15) };
  });
}

async function searchDuckDuckGoHtml(query: string): Promise<SearchResponse> {
  return await rateLimitedRequest("duckduckgo", async () => {
    const res = await axios.get(`https://html.duckduckgo.com/html/`, {
      params: { q: query },
      timeout: 10000,
      headers: {
        ...STEALTH_HEADERS,
        "Accept": "text/html",
      },
    });

    const $ = cheerio.load(res.data);
    const results: SearchResult[] = [];

    $(".result").each(function () {
      const titleEl = $(this).find(".result__title a, .result__a");
      const snippetEl = $(this).find(".result__snippet");
      const title = titleEl.text().trim();
      let url = titleEl.attr("href") || "";

      if (url.startsWith("//duckduckgo.com/l/")) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
      }

      const snippet = snippetEl.text().trim();
      if (title && url) {
        results.push({ title, url, snippet });
      }
    });

    return { query, engine: "duckduckgo-html", results: results.slice(0, 15) };
  });
}

async function searchGoogleScrape(query: string): Promise<SearchResponse> {
  return await rateLimitedRequest("default", async () => {
    const res = await axios.get(`https://www.google.com/search`, {
      params: { q: query, num: 15, hl: "en" },
      timeout: 10000,
      headers: {
        ...STEALTH_HEADERS,
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    const $ = cheerio.load(res.data);
    const results: SearchResult[] = [];

    $("div.g, div[data-sokoban-container]").each(function () {
      const linkEl = $(this).find("a[href^='http']").first();
      const titleEl = $(this).find("h3").first();
      const snippetEl = $(this).find("[data-sncf], .VwiC3b, .lEBKkf, span.st").first();

      const url = linkEl.attr("href") || "";
      const title = titleEl.text().trim();
      const snippet = snippetEl.text().trim();

      if (title && url && !url.includes("google.com/search")) {
        results.push({ title, url, snippet });
      }
    });

    return { query, engine: "google", results: results.slice(0, 15) };
  });
}

export function detectUrlsInMessage(message: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = message.match(urlRegex) || [];
  return Array.from(new Set(matches)).filter(url => !isBlockedUrl(url));
}
