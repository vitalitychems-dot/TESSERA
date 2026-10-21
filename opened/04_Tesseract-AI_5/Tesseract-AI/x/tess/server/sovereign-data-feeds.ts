import axios from "axios";
import {
  buildSafeRequestConfig, validateInboundJSON, scrubOutboundQuery,
  logSecurityEvent, isHostileDomain, safeJSONFetch,
} from "./scraper-sandbox";

const log = (m: string) => console.log(`[SovereignFeeds] ${m}`);
const warn = (m: string) => console.log(`[SovereignFeeds] ⚠️ ${m}`);
const TIMEOUT = 10000;

interface SourceHealth {
  lastSuccess: number;
  lastFailure: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalSuccesses: number;
  backoffUntil: number;
}

const sourceHealth = new Map<string, SourceHealth>();

function getHealth(source: string): SourceHealth {
  if (!sourceHealth.has(source)) {
    sourceHealth.set(source, { lastSuccess: 0, lastFailure: 0, consecutiveFailures: 0, totalRequests: 0, totalSuccesses: 0, backoffUntil: 0 });
  }
  return sourceHealth.get(source)!;
}

function recordSuccess(source: string) {
  const h = getHealth(source);
  h.lastSuccess = Date.now();
  h.consecutiveFailures = 0;
  h.totalRequests++;
  h.totalSuccesses++;
  h.backoffUntil = 0;
}

function recordFailure(source: string, err?: any) {
  const h = getHealth(source);
  h.lastFailure = Date.now();
  h.consecutiveFailures++;
  h.totalRequests++;
  const backoffMs = Math.min(2000 * Math.pow(2, h.consecutiveFailures - 1), 120000);
  h.backoffUntil = Date.now() + backoffMs;
  const reason = err?.response?.status
    ? `HTTP ${err.response.status}`
    : err?.code || err?.message?.substring(0, 60) || "unknown";
  warn(`${source} failed (${h.consecutiveFailures}x): ${reason} — backoff ${(backoffMs / 1000).toFixed(0)}s`);
}

function isBackedOff(source: string): boolean {
  const h = getHealth(source);
  if (h.backoffUntil > Date.now()) {
    return true;
  }
  return false;
}

function safeAxiosConfig(url: string): any {
  const base = buildSafeRequestConfig(url);
  return { ...base, timeout: TIMEOUT };
}

function scrubQueryForAPI(query: string): string {
  return scrubOutboundQuery(query)
    .replace(/\b(replit|localhost|127\.0\.0\.\d+|192\.168\.\d+\.\d+)\b/gi, "")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/\b(?:sk-|pk-|key-|token-|secret-)[A-Za-z0-9]+\b/gi, "")
    .replace(/\b(?:\/home\/runner|\/workspace|\/tmp|\.env|node_modules)\b/gi, "")
    .trim();
}

function isolateResponse(data: any, depth = 0): any {
  if (data == null || depth > 5) return data;
  if (typeof data === "string") {
    return data
      .replace(/\b(?:set-cookie|x-request-id|x-trace-id|cf-ray|x-amzn-trace-id)\b[:\s][^\n]*/gi, "")
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (ip) => {
        if (/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.)/.test(ip)) return "[REDACTED]";
        return ip;
      });
  }
  if (Array.isArray(data)) {
    return data.map(item => isolateResponse(item, depth + 1));
  }
  if (typeof data === "object") {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (/^(?:set-cookie|x-request-id|x-trace-id|cf-ray|x-amzn-trace-id|x-forwarded-for|x-real-ip|x-client-ip|server-timing|report-to|nel)$/i.test(key)) continue;
      cleaned[key] = isolateResponse(val, depth + 1);
    }
    return cleaned;
  }
  return data;
}

async function sovereignGet(url: string, source: string, config?: any): Promise<any> {
  if (isBackedOff(source)) {
    throw new Error(`${source} is in backoff until ${new Date(getHealth(source).backoffUntil).toISOString()}`);
  }
  try {
    const safeConfig = safeAxiosConfig(url);
    if (config?.params) {
      safeConfig.params = { ...(safeConfig.params || {}), ...config.params };
    }
    safeConfig.headers = {
      ...safeConfig.headers,
      "Connection": "close",
      "DNT": "1",
      "Sec-GPC": "1",
    };
    delete (safeConfig.headers as any)["Referer"];
    delete (safeConfig.headers as any)["Origin"];
    delete (safeConfig.headers as any)["Cookie"];
    delete (safeConfig.headers as any)["Authorization"];
    const res = await axios.get(url, safeConfig);
    if (res.data && typeof res.data === "object") {
      const check = validateInboundJSON(res.data, url);
      if (check.threats.length > 0) {
        check.threats.forEach(t => logSecurityEvent("feed-json-threat", t.severity, t.detail));
      }
      res.data = isolateResponse(res.data);
    } else if (typeof res.data === "string") {
      res.data = isolateResponse(res.data);
    }
    recordSuccess(source);
    return res;
  } catch (err: any) {
    recordFailure(source, err);
    throw err;
  }
}

export function getFeedHealthReport(): Record<string, any> {
  const report: Record<string, any> = {};
  for (const [source, h] of sourceHealth.entries()) {
    report[source] = {
      uptime: h.totalRequests > 0 ? `${((h.totalSuccesses / h.totalRequests) * 100).toFixed(1)}%` : "no-data",
      consecutiveFailures: h.consecutiveFailures,
      backedOff: h.backoffUntil > Date.now(),
      lastSuccess: h.lastSuccess ? new Date(h.lastSuccess).toISOString() : "never",
      totalRequests: h.totalRequests,
    };
  }
  return report;
}

export async function fetchWikipedia(query: string): Promise<{ title: string; extract: string; url: string } | null> {
  const src = "wikipedia";
  try {
    const scrubbed = scrubOutboundQuery(query);
    const search = await sovereignGet("https://en.wikipedia.org/w/api.php", src, {
      params: { action: "query", list: "search", srsearch: scrubbed, srlimit: 1, format: "json", origin: "*" },
    });
    const hit = search.data?.query?.search?.[0];
    if (!hit) return null;
    const page = await sovereignGet("https://en.wikipedia.org/w/api.php", src, {
      params: { action: "query", prop: "extracts", exintro: true, explaintext: true, titles: hit.title, format: "json", origin: "*" },
    });
    const pages = page.data?.query?.pages;
    const p = pages ? Object.values(pages)[0] as any : null;
    if (!p?.extract) return null;
    return { title: p.title, extract: p.extract.substring(0, 2000), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}` };
  } catch (err: any) {
    warn(`Wikipedia failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchWikipediaFull(title: string): Promise<string | null> {
  const src = "wikipedia";
  try {
    const res = await sovereignGet("https://en.wikipedia.org/w/api.php", src, {
      params: { action: "query", prop: "extracts", explaintext: true, titles: title, format: "json", origin: "*" },
    });
    const pages = res.data?.query?.pages;
    const p = pages ? Object.values(pages)[0] as any : null;
    return p?.extract?.substring(0, 8000) || null;
  } catch (err: any) {
    warn(`Wikipedia full failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchWikidata(query: string): Promise<{ id: string; label: string; description: string; properties: Record<string, string> } | null> {
  const src = "wikidata";
  try {
    const scrubbed = scrubOutboundQuery(query);
    const search = await sovereignGet("https://www.wikidata.org/w/api.php", src, {
      params: { action: "wbsearchentities", search: scrubbed, language: "en", limit: 1, format: "json", origin: "*" },
    });
    const entity = search.data?.search?.[0];
    if (!entity) return null;
    const detail = await sovereignGet(`https://www.wikidata.org/wiki/Special:EntityData/${entity.id}.json`, src);
    const claims = detail.data?.entities?.[entity.id]?.claims || {};
    const props: Record<string, string> = {};
    const propMap: Record<string, string> = {
      P31: "instance_of", P17: "country", P18: "image", P27: "citizenship",
      P569: "birth_date", P570: "death_date", P106: "occupation", P1082: "population",
      P36: "capital", P30: "continent", P625: "coordinates",
    };
    for (const [pid, label] of Object.entries(propMap)) {
      const claim = claims[pid]?.[0]?.mainsnak?.datavalue;
      if (claim) {
        if (claim.type === "wikibase-entityid") props[label] = claim.value?.id || "";
        else if (claim.type === "time") props[label] = claim.value?.time || "";
        else if (claim.type === "quantity") props[label] = claim.value?.amount || "";
        else if (claim.type === "string") props[label] = claim.value || "";
      }
    }
    return { id: entity.id, label: entity.label, description: entity.description || "", properties: props };
  } catch (err: any) {
    warn(`Wikidata failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchDuckDuckGoInstant(query: string): Promise<{ abstract: string; source: string; url: string; related: string[] } | null> {
  const src = "duckduckgo";
  try {
    const scrubbed = scrubOutboundQuery(query);
    const res = await sovereignGet("https://api.duckduckgo.com/", src, {
      params: { q: scrubbed, format: "json", no_html: 1, skip_disambig: 1 },
    });
    const d = res.data;
    if (d?.Abstract) {
      return {
        abstract: d.Abstract, source: d.AbstractSource || "DuckDuckGo",
        url: d.AbstractURL || "",
        related: (d.RelatedTopics || []).slice(0, 5).map((t: any) => t.Text || "").filter(Boolean),
      };
    }
    if (d?.Answer) {
      return { abstract: d.Answer, source: "DuckDuckGo Instant", url: "", related: [] };
    }
    return null;
  } catch (err: any) {
    warn(`DDG failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchHackerNews(limit: number = 10): Promise<Array<{ title: string; url: string; score: number; by: string }>> {
  const src = "hackernews";
  try {
    const top = await sovereignGet("https://hacker-news.firebaseio.com/v0/topstories.json", src);
    const ids = (top.data || []).slice(0, limit);
    const stories = await Promise.allSettled(
      ids.map(async (id: number) => {
        const s = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 5000 });
        return { title: s.data?.title || "", url: s.data?.url || `https://news.ycombinator.com/item?id=${id}`, score: s.data?.score || 0, by: s.data?.by || "" };
      })
    );
    return stories
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value);
  } catch (err: any) {
    warn(`HackerNews failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

export async function fetchRedditTrending(subreddit: string = "all", limit: number = 10): Promise<Array<{ title: string; url: string; score: number; subreddit: string; comments: number }>> {
  const src = "reddit";
  try {
    const res = await sovereignGet(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=${limit}`, src);
    return (res.data?.data?.children || []).map((c: any) => ({
      title: c.data?.title || "", url: `https://reddit.com${c.data?.permalink || ""}`,
      score: c.data?.score || 0, subreddit: c.data?.subreddit || "", comments: c.data?.num_comments || 0,
    }));
  } catch (err: any) {
    warn(`Reddit failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

export async function fetchRSSFeed(url: string, limit: number = 8): Promise<Array<{ title: string; link: string; description: string }>> {
  const src = `rss-${new URL(url).hostname}`;
  try {
    const config = safeAxiosConfig(url);
    const res = await axios.get(url, config);
    recordSuccess(src);
    const xml = res.data;
    const items: Array<{ title: string; link: string; description: string }> = [];
    const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const item of itemMatches.slice(0, limit)) {
      const title = item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";
      const link = item.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim()
        || item.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
      const desc = item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim()
        || item.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)?.[1]?.trim() || "";
      const cleanDesc = desc.replace(/<[^>]+>/g, "").substring(0, 300);
      if (title) items.push({ title, link, description: cleanDesc });
    }
    return items;
  } catch (err: any) {
    recordFailure(src, err);
    warn(`RSS feed ${url} failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

const NEWS_FEEDS: Record<string, string[]> = {
  world: ["https://feeds.bbci.co.uk/news/world/rss.xml", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"],
  tech: ["https://feeds.bbci.co.uk/news/technology/rss.xml", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"],
  business: ["https://feeds.bbci.co.uk/news/business/rss.xml", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"],
  science: ["https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
  health: ["https://feeds.bbci.co.uk/news/health/rss.xml", "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml"],
  top: ["https://feeds.bbci.co.uk/news/rss.xml", "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"],
};

export async function fetchNews(category: string = "top", limit: number = 8): Promise<Array<{ title: string; link: string; description: string; source: string }>> {
  const feeds = NEWS_FEEDS[category.toLowerCase()] || NEWS_FEEDS.top;
  const results: Array<{ title: string; link: string; description: string; source: string }> = [];
  for (const feedUrl of feeds) {
    if (results.length >= limit) break;
    const source = feedUrl.includes("bbci") ? "BBC" : feedUrl.includes("nytimes") ? "NYT" : feedUrl.includes("reuters") ? "Reuters" : "News";
    const items = await fetchRSSFeed(feedUrl, limit - results.length);
    results.push(...items.map(i => ({ ...i, source })));
  }
  return results.slice(0, limit);
}

export async function fetchArxiv(query: string, limit: number = 5): Promise<Array<{ title: string; authors: string; summary: string; url: string; published: string }>> {
  const src = "arxiv";
  try {
    const scrubbed = scrubOutboundQuery(query);
    const res = await sovereignGet("https://export.arxiv.org/api/query", src, {
      params: { search_query: `all:${scrubbed}`, start: 0, max_results: limit, sortBy: "submittedDate", sortOrder: "descending" },
    });
    const xml = res.data;
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    return entries.map((e: string) => ({
      title: (e.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/\n/g, " ").trim(),
      authors: (e.match(/<name>([\s\S]*?)<\/name>/g) || []).map((n: string) => n.replace(/<\/?name>/g, "").trim()).slice(0, 3).join(", "),
      summary: (e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "").replace(/\n/g, " ").trim().substring(0, 400),
      url: e.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "",
      published: e.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim().substring(0, 10) || "",
    }));
  } catch (err: any) {
    warn(`arXiv failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

export async function fetchDefinition(word: string): Promise<{ word: string; phonetic: string; meanings: Array<{ partOfSpeech: string; definition: string }> } | null> {
  const src = "dictionary";
  try {
    const res = await sovereignGet(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, src);
    const entry = res.data?.[0];
    if (!entry) return null;
    const meanings = (entry.meanings || []).slice(0, 3).map((m: any) => ({
      partOfSpeech: m.partOfSpeech,
      definition: m.definitions?.[0]?.definition || "",
    }));
    return { word: entry.word, phonetic: entry.phonetic || "", meanings };
  } catch (err: any) {
    warn(`Dictionary failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchGitHubTrending(): Promise<Array<{ name: string; description: string; stars: number; language: string; url: string }>> {
  const src = "github";
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
    const res = await sovereignGet("https://api.github.com/search/repositories", src, {
      params: { q: `stars:>100 pushed:>${since}`, sort: "stars", order: "desc", per_page: 10 },
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    return (res.data?.items || []).map((r: any) => ({
      name: r.full_name, description: (r.description || "").substring(0, 200),
      stars: r.stargazers_count, language: r.language || "Unknown", url: r.html_url,
    }));
  } catch (err: any) {
    warn(`GitHub failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

export async function fetchCoinGecko(coinId: string): Promise<{ name: string; price: number; change24h: number; marketCap: number } | null> {
  const src = "coingecko";
  try {
    const res = await sovereignGet("https://api.coingecko.com/api/v3/simple/price", src, {
      params: { ids: coinId, vs_currencies: "usd", include_24hr_change: "true", include_market_cap: "true" },
    });
    const d = res.data?.[coinId];
    if (!d) return null;
    return { name: coinId, price: d.usd, change24h: d.usd_24h_change, marketCap: d.usd_market_cap };
  } catch (err: any) {
    warn(`CoinGecko failed for ${coinId}: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchCoinGeckoMulti(ids: string[]): Promise<Array<{ name: string; price: number; change24h: number; marketCap: number }>> {
  const src = "coingecko";
  try {
    const res = await sovereignGet("https://api.coingecko.com/api/v3/simple/price", src, {
      params: { ids: ids.join(","), vs_currencies: "usd", include_24hr_change: "true", include_market_cap: "true" },
    });
    return Object.entries(res.data || {}).map(([id, d]: [string, any]) => ({
      name: id, price: d.usd, change24h: d.usd_24h_change, marketCap: d.usd_market_cap,
    }));
  } catch (err: any) {
    warn(`CoinGecko multi failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

export async function fetchCoinCap(coin: string): Promise<{ name: string; price: number; change24h: number; marketCap: number; volume24h: number; supply: number } | null> {
  const src = "coincap";
  try {
    const res = await sovereignGet(`https://api.coincap.io/v2/assets/${coin.toLowerCase()}`, src);
    const d = res.data?.data;
    if (!d) return null;
    return {
      name: d.name, price: parseFloat(d.priceUsd),
      change24h: parseFloat(d.changePercent24Hr),
      marketCap: parseFloat(d.marketCapUsd),
      volume24h: parseFloat(d.volumeUsd24Hr),
      supply: parseFloat(d.supply),
    };
  } catch (err: any) {
    warn(`CoinCap failed for ${coin}: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchCoinCapTop(limit: number = 15): Promise<Array<{ rank: number; name: string; symbol: string; price: number; change24h: number; marketCap: number }>> {
  const src = "coincap";
  try {
    const res = await sovereignGet(`https://api.coincap.io/v2/assets?limit=${limit}`, src);
    return (res.data?.data || []).map((d: any) => ({
      rank: parseInt(d.rank), name: d.name, symbol: d.symbol,
      price: parseFloat(d.priceUsd), change24h: parseFloat(d.changePercent24Hr),
      marketCap: parseFloat(d.marketCapUsd),
    }));
  } catch (err: any) {
    warn(`CoinCap top failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

const CRYPTO_COMPARE_SYMBOLS: Record<string, string> = {
  bitcoin: "BTC", ethereum: "ETH", solana: "SOL", dogecoin: "DOGE", cardano: "ADA",
  ripple: "XRP", polkadot: "DOT", chainlink: "LINK", "avalanche-2": "AVAX",
  "polygon-pos": "MATIC", binancecoin: "BNB", "shiba-inu": "SHIB", pepe: "PEPE",
  sui: "SUI", "the-open-network": "TON", near: "NEAR", aptos: "APT", arbitrum: "ARB",
  optimism: "OP", cosmos: "ATOM", uniswap: "UNI", aave: "AAVE", litecoin: "LTC", "bitcoin-cash": "BCH",
};

async function fetchCryptoCompare(coinId: string): Promise<{ name: string; price: number; change24h: number; marketCap: number } | null> {
  const src = "cryptocompare";
  const sym = CRYPTO_COMPARE_SYMBOLS[coinId];
  if (!sym) return null;
  try {
    const res = await sovereignGet("https://min-api.cryptocompare.com/data/pricemultifull", src, {
      params: { fsyms: sym, tsyms: "USD" },
    });
    const d = res.data?.RAW?.[sym]?.USD;
    if (!d || !d.PRICE) return null;
    return { name: coinId, price: d.PRICE, change24h: d.CHANGEPCT24HOUR || 0, marketCap: d.MKTCAP || 0 };
  } catch (err: any) {
    warn(`CryptoCompare failed for ${coinId}: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchCryptoWithFailover(coinId: string): Promise<{ name: string; price: number; change24h: number; marketCap: number; source: string } | null> {
  const gecko = await fetchCoinGecko(coinId);
  if (gecko) return { ...gecko, source: "CoinGecko" };

  const capId = coinId === "avalanche-2" ? "avalanche" : coinId === "polygon-pos" ? "matic-network" : coinId;
  const cap = await fetchCoinCap(capId);
  if (cap) return { name: cap.name, price: cap.price, change24h: cap.change24h, marketCap: cap.marketCap, source: "CoinCap" };

  const cc = await fetchCryptoCompare(coinId);
  if (cc) return { ...cc, source: "CryptoCompare" };

  return null;
}

export async function fetchCryptoOverviewWithFailover(): Promise<Array<{ name: string; price: number; change24h: number; marketCap: number; source: string }>> {
  const ids = ["bitcoin", "ethereum", "solana", "dogecoin", "cardano", "ripple", "polkadot", "chainlink", "avalanche-2", "polygon-pos"];
  const geckoResults = await fetchCoinGeckoMulti(ids);
  if (geckoResults.length > 0) return geckoResults.map(g => ({ ...g, source: "CoinGecko" }));

  const capResults = await fetchCoinCapTop(10);
  if (capResults.length > 0) return capResults.map(c => ({ name: c.name.toLowerCase(), price: c.price, change24h: c.change24h, marketCap: c.marketCap, source: "CoinCap" }));

  const syms = ids.map(id => CRYPTO_COMPARE_SYMBOLS[id]).filter(Boolean).join(",");
  try {
    const res = await sovereignGet("https://min-api.cryptocompare.com/data/pricemultifull", "cryptocompare", {
      params: { fsyms: syms, tsyms: "USD" },
    });
    const raw = res.data?.RAW;
    if (raw) {
      return Object.entries(raw).map(([sym, data]: [string, any]) => ({
        name: sym.toLowerCase(),
        price: data.USD?.PRICE || 0,
        change24h: data.USD?.CHANGEPCT24HOUR || 0,
        marketCap: data.USD?.MKTCAP || 0,
        source: "CryptoCompare",
      })).filter(c => c.price > 0);
    }
  } catch {}

  return [];
}

export async function fetchAirQuality(lat: number, lon: number): Promise<{ pm25: number; pm10: number; aqi: number; o3: number; no2: number } | null> {
  const src = "openmeteo-aq";
  try {
    const res = await sovereignGet("https://air-quality-api.open-meteo.com/v1/air-quality", src, {
      params: { latitude: lat, longitude: lon, current: "pm10,pm2_5,us_aqi,ozone,nitrogen_dioxide" },
    });
    const c = res.data?.current;
    if (!c) return null;
    return { pm25: c.pm2_5, pm10: c.pm10, aqi: c.us_aqi, o3: c.ozone, no2: c.nitrogen_dioxide };
  } catch (err: any) {
    warn(`Air quality failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchWeatherSovereign(location: string): Promise<{
  location: string; country: string; lat: number; lon: number;
  current: any; forecast: any[]; airQuality: any | null;
} | null> {
  const src = "openmeteo-wx";
  try {
    const geo = await sovereignGet(`https://geocoding-api.open-meteo.com/v1/search`, src, {
      params: { name: location, count: 1 },
    });
    const place = geo.data?.results?.[0];
    if (!place) return null;
    const wx = await sovereignGet("https://api.open-meteo.com/v1/forecast", src, {
      params: {
        latitude: place.latitude, longitude: place.longitude,
        current_weather: "true",
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
        timezone: "auto", forecast_days: 5,
      },
    });
    const cw = wx.data?.current_weather;
    const daily = wx.data?.daily;
    const forecast = daily ? daily.time?.map((t: string, i: number) => ({
      date: t, high: daily.temperature_2m_max?.[i], low: daily.temperature_2m_min?.[i],
      precip: daily.precipitation_sum?.[i], code: daily.weathercode?.[i],
    })) : [];

    let airQuality = null;
    try {
      airQuality = await fetchAirQuality(place.latitude, place.longitude);
    } catch {}

    return {
      location: place.name, country: place.country,
      lat: place.latitude, lon: place.longitude,
      current: cw, forecast, airQuality,
    };
  } catch (err: any) {
    warn(`Weather failed for ${location}: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchForexSovereign(base: string, target: string): Promise<{ base: string; target: string; rate: number; date: string } | null> {
  const src = "frankfurter";
  try {
    const res = await sovereignGet(`https://api.frankfurter.app/latest`, src, {
      params: { from: base.toUpperCase(), to: target.toUpperCase() },
    });
    const rate = res.data?.rates?.[target.toUpperCase()];
    if (!rate) return null;
    return { base: res.data.base, target: target.toUpperCase(), rate, date: res.data.date };
  } catch (err: any) {
    warn(`Forex failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchAllForexRates(base: string = "USD"): Promise<Record<string, number> | null> {
  const src = "frankfurter";
  try {
    const res = await sovereignGet(`https://api.frankfurter.app/latest?from=${base.toUpperCase()}`, src);
    return res.data?.rates || null;
  } catch (err: any) {
    warn(`Forex all rates failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchCountryData(name: string): Promise<{ name: string; capital: string; population: number; region: string; languages: string[]; currencies: string[]; flag: string } | null> {
  const src = "restcountries";
  try {
    const res = await sovereignGet(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=false`, src);
    const c = res.data?.[0];
    if (!c) return null;
    return {
      name: c.name?.common || name,
      capital: c.capital?.[0] || "Unknown",
      population: c.population || 0,
      region: `${c.region || ""}${c.subregion ? ` (${c.subregion})` : ""}`,
      languages: Object.values(c.languages || {}) as string[],
      currencies: Object.values(c.currencies || {}).map((cur: any) => `${cur.name} (${cur.symbol || ""})`) as string[],
      flag: c.flag || "",
    };
  } catch (err: any) {
    warn(`Country failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchBookInfo(query: string): Promise<Array<{ title: string; author: string; year: number; subjects: string[]; key: string }>> {
  const src = "openlibrary";
  try {
    const scrubbed = scrubOutboundQuery(query);
    const res = await sovereignGet(`https://openlibrary.org/search.json`, src, {
      params: { q: scrubbed, limit: 5 },
    });
    return (res.data?.docs || []).slice(0, 5).map((d: any) => ({
      title: d.title || "", author: d.author_name?.[0] || "Unknown",
      year: d.first_publish_year || 0, subjects: (d.subject || []).slice(0, 5), key: d.key || "",
    }));
  } catch (err: any) {
    warn(`Books failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

export async function fetchIPGeo(ip?: string): Promise<{ ip: string; city: string; region: string; country: string; org: string; timezone: string } | null> {
  const src = "ipapi";
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";
    const res = await sovereignGet(url, src);
    const d = res.data;
    return { ip: d.ip, city: d.city, region: d.region, country: d.country_name, org: d.org, timezone: d.timezone };
  } catch (err: any) {
    warn(`IP geo failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchEarthquakes(minMagnitude: number = 4.0, limit: number = 10): Promise<Array<{ magnitude: number; place: string; time: string; url: string }>> {
  const src = "usgs";
  try {
    const res = await sovereignGet("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson", src);
    return (res.data?.features || [])
      .filter((f: any) => f.properties?.mag >= minMagnitude)
      .slice(0, limit)
      .map((f: any) => ({
        magnitude: f.properties.mag,
        place: f.properties.place || "Unknown",
        time: new Date(f.properties.time).toISOString(),
        url: f.properties.url || "",
      }));
  } catch (err: any) {
    warn(`USGS failed: ${err.message?.substring(0, 80)}`);
    return [];
  }
}

export async function fetchAPOD(): Promise<{ title: string; explanation: string; url: string; date: string } | null> {
  const src = "nasa";
  try {
    const res = await sovereignGet("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY", src);
    const d = res.data;
    return { title: d.title, explanation: d.explanation?.substring(0, 600) || "", url: d.url, date: d.date };
  } catch (err: any) {
    warn(`NASA APOD failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function fetchFearGreedIndex(): Promise<{ value: number; label: string; timestamp: string } | null> {
  const src = "fear-greed";
  try {
    const res = await sovereignGet("https://api.alternative.me/fng/?limit=1", src);
    const d = res.data?.data?.[0];
    if (!d) return null;
    return { value: parseInt(d.value), label: d.value_classification, timestamp: d.timestamp };
  } catch (err: any) {
    warn(`Fear & Greed failed: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export async function sovereignKnowledgeQuery(query: string): Promise<{
  wikipedia: { title: string; extract: string; url: string } | null;
  ddg: { abstract: string; source: string; url: string; related: string[] } | null;
  wikidata: { id: string; label: string; description: string; properties: Record<string, string> } | null;
}> {
  const [wikipedia, ddg, wikidata] = await Promise.allSettled([
    fetchWikipedia(query),
    fetchDuckDuckGoInstant(query),
    fetchWikidata(query),
  ]);
  return {
    wikipedia: wikipedia.status === "fulfilled" ? wikipedia.value : null,
    ddg: ddg.status === "fulfilled" ? ddg.value : null,
    wikidata: wikidata.status === "fulfilled" ? wikidata.value : null,
  };
}

export function formatKnowledgeResult(query: string, result: Awaited<ReturnType<typeof sovereignKnowledgeQuery>>): string {
  const parts: string[] = [`**Sovereign Knowledge: ${query}**\n`];

  if (result.ddg?.abstract) {
    parts.push(`**Quick Answer** (${result.ddg.source}):\n${result.ddg.abstract}\n`);
  }
  if (result.wikipedia?.extract) {
    parts.push(`**Wikipedia:**\n${result.wikipedia.extract.substring(0, 1200)}\n[Source](${result.wikipedia.url})\n`);
  }
  if (result.wikidata?.description) {
    parts.push(`**Wikidata:** ${result.wikidata.label} — ${result.wikidata.description}`);
    const props = result.wikidata.properties;
    if (Object.keys(props).length > 0) {
      parts.push(Object.entries(props).map(([k, v]) => `  • ${k}: ${v}`).join("\n"));
    }
    parts.push("");
  }
  if (parts.length <= 1) return "";
  parts.push("*Direct from Wikipedia, Wikidata & DuckDuckGo — zero LLM dependency.*");
  return parts.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// EXPANDED SOVEREIGN DATA FEEDS v3.0 — 50+ Sources
// ═══════════════════════════════════════════════════════════════

export async function fetchNASAAsteroids(): Promise<Array<{ name: string; diameter: string; velocity: string; missDistance: string; hazardous: boolean; date: string }> | null> {
  const src = "nasa-neo";
  try {
    const today = new Date().toISOString().split("T")[0];
    const res = await sovereignGet(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=DEMO_KEY`, src);
    const objects = res.data?.near_earth_objects?.[today];
    if (!objects?.length) return null;
    return objects.slice(0, 8).map((o: any) => ({
      name: o.name,
      diameter: `${(o.estimated_diameter?.meters?.estimated_diameter_max || 0).toFixed(0)}m`,
      velocity: `${parseFloat(o.close_approach_data?.[0]?.relative_velocity?.kilometers_per_hour || "0").toFixed(0)} km/h`,
      missDistance: `${parseFloat(o.close_approach_data?.[0]?.miss_distance?.kilometers || "0").toFixed(0)} km`,
      hazardous: o.is_potentially_hazardous_asteroid,
      date: today,
    }));
  } catch (err: any) { warn(`NASA NEO failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchISSPosition(): Promise<{ latitude: number; longitude: number; timestamp: number } | null> {
  const src = "open-notify-iss";
  try {
    const res = await sovereignGet("http://api.open-notify.org/iss-now.json", src);
    const pos = res.data?.iss_position;
    if (!pos) return null;
    return { latitude: parseFloat(pos.latitude), longitude: parseFloat(pos.longitude), timestamp: res.data.timestamp };
  } catch (err: any) { warn(`ISS position failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchPeopleInSpace(): Promise<{ count: number; people: Array<{ name: string; craft: string }> } | null> {
  const src = "open-notify-astro";
  try {
    const res = await sovereignGet("http://api.open-notify.org/astros.json", src);
    if (!res.data?.people) return null;
    return { count: res.data.number, people: res.data.people };
  } catch (err: any) { warn(`People in space failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchNASAEarthEvents(): Promise<Array<{ title: string; category: string; date: string; source: string }> | null> {
  const src = "nasa-eonet";
  try {
    const res = await sovereignGet("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=10", src);
    if (!res.data?.events?.length) return null;
    return res.data.events.map((e: any) => ({
      title: e.title,
      category: e.categories?.[0]?.title || "Unknown",
      date: e.geometry?.[0]?.date?.split("T")[0] || "Unknown",
      source: e.sources?.[0]?.url || "",
    }));
  } catch (err: any) { warn(`NASA EONET failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchSunriseSunset(lat: number, lon: number): Promise<{ sunrise: string; sunset: string; dayLength: string; solarNoon: string } | null> {
  const src = "sunrise-sunset";
  try {
    const res = await sovereignGet(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`, src);
    const r = res.data?.results;
    if (!r) return null;
    const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return { sunrise: fmt(r.sunrise), sunset: fmt(r.sunset), dayLength: r.day_length, solarNoon: fmt(r.solar_noon) };
  } catch (err: any) { warn(`Sunrise/sunset failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchWorldBankIndicator(country: string, indicator: string): Promise<{ country: string; indicator: string; value: number; year: string } | null> {
  const src = "worldbank";
  const INDICATORS: Record<string, string> = {
    gdp: "NY.GDP.MKTP.CD", population: "SP.POP.TOTL", "gdp per capita": "NY.GDP.PCAP.CD",
    inflation: "FP.CPI.TOTL.ZG", unemployment: "SL.UEM.TOTL.ZS", "life expectancy": "SP.DYN.LE00.IN",
    literacy: "SE.ADT.LITR.ZS", co2: "EN.ATM.CO2E.PC", internet: "IT.NET.USER.ZS",
    poverty: "SI.POV.NAHC", exports: "NE.EXP.GNFS.ZS", imports: "NE.IMP.GNFS.ZS",
    gini: "SI.POV.GINI", "birth rate": "SP.DYN.CBRT.IN", "death rate": "SP.DYN.CDRT.IN",
    "military spending": "MS.MIL.XPND.GD.ZS", "forest area": "AG.LND.FRST.ZS",
    "renewable energy": "EG.FEC.RNEW.ZS", "electricity access": "EG.ELC.ACCS.ZS",
  };
  const indCode = INDICATORS[indicator.toLowerCase()] || indicator;
  const COUNTRY_CODES: Record<string, string> = {
    us: "US", usa: "US", "united states": "US", uk: "GB", "united kingdom": "GB", china: "CN",
    japan: "JP", germany: "DE", france: "FR", india: "IN", brazil: "BR", russia: "RU",
    canada: "CA", australia: "AU", mexico: "MX", "south korea": "KR", italy: "IT",
    spain: "ES", indonesia: "ID", turkey: "TR", "saudi arabia": "SA", nigeria: "NG",
    argentina: "AR", egypt: "EG", "south africa": "ZA", world: "WLD", global: "WLD",
  };
  const cc = COUNTRY_CODES[country.toLowerCase()] || country.toUpperCase().slice(0, 3);
  try {
    const res = await sovereignGet(`https://api.worldbank.org/v2/country/${cc}/indicator/${indCode}?format=json&per_page=5&date=2018:2024`, src);
    const entries = res.data?.[1];
    if (!entries?.length) return null;
    const latest = entries.find((e: any) => e.value != null);
    if (!latest) return null;
    return { country: latest.country?.value || cc, indicator: latest.indicator?.value || indicator, value: latest.value, year: latest.date };
  } catch (err: any) { warn(`World Bank failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchNumberFact(number: number, type: string = "trivia"): Promise<string | null> {
  const src = "numbersapi";
  try {
    const res = await sovereignGet(`http://numbersapi.com/${number}/${type}`, src);
    if (!res.data || typeof res.data !== "string") return null;
    return res.data;
  } catch (err: any) { warn(`NumbersAPI failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchPublicHolidays(countryCode: string, year?: number): Promise<Array<{ date: string; name: string; type: string }> | null> {
  const src = "nager-holidays";
  const y = year || new Date().getFullYear();
  try {
    const res = await sovereignGet(`https://date.nager.at/api/v3/PublicHolidays/${y}/${countryCode.toUpperCase()}`, src);
    if (!res.data?.length) return null;
    return res.data.slice(0, 15).map((h: any) => ({ date: h.date, name: h.localName || h.name, type: h.types?.[0] || "Public" }));
  } catch (err: any) { warn(`Holidays failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchWorldTime(timezone: string): Promise<{ timezone: string; datetime: string; utcOffset: string; dayOfWeek: string } | null> {
  const src = "worldtime";
  try {
    const res = await sovereignGet(`https://worldtimeapi.org/api/timezone/${timezone}`, src);
    const d = res.data;
    if (!d) return null;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return { timezone: d.timezone, datetime: d.datetime, utcOffset: d.utc_offset, dayOfWeek: days[d.day_of_week] || "Unknown" };
  } catch (err: any) { warn(`WorldTime failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchiTunesSearch(query: string, media: string = "all"): Promise<Array<{ name: string; artist: string; type: string; url: string }> | null> {
  const src = "itunes-search";
  try {
    const res = await sovereignGet(`https://itunes.apple.com/search?term=${encodeURIComponent(scrubQueryForAPI(query))}&media=${media}&limit=8`, src);
    if (!res.data?.results?.length) return null;
    return res.data.results.map((r: any) => ({
      name: r.trackName || r.collectionName || r.artistName,
      artist: r.artistName || "Unknown",
      type: r.kind || r.wrapperType || media,
      url: r.trackViewUrl || r.collectionViewUrl || "",
    }));
  } catch (err: any) { warn(`iTunes Search failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchMusicBrainzArtist(artist: string): Promise<{ name: string; type: string; country: string; genres: string[]; activeYears: string } | null> {
  const src = "musicbrainz";
  try {
    const res = await sovereignGet(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(scrubQueryForAPI(artist))}&fmt=json&limit=1`, src);
    const a = res.data?.artists?.[0];
    if (!a) return null;
    return {
      name: a.name, type: a.type || "Unknown", country: a.country || "Unknown",
      genres: (a.tags || []).slice(0, 5).map((t: any) => t.name),
      activeYears: `${a["life-span"]?.begin || "?"} — ${a["life-span"]?.ended ? a["life-span"].end : "present"}`,
    };
  } catch (err: any) { warn(`MusicBrainz failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchStackOverflowTrending(): Promise<Array<{ title: string; votes: number; answers: number; tags: string[]; link: string }> | null> {
  const src = "stackoverflow";
  try {
    const res = await sovereignGet("https://api.stackexchange.com/2.3/questions?order=desc&sort=hot&site=stackoverflow&pagesize=8&filter=withbody", src);
    if (!res.data?.items?.length) return null;
    return res.data.items.map((q: any) => ({
      title: q.title, votes: q.score, answers: q.answer_count,
      tags: q.tags?.slice(0, 4) || [], link: q.link,
    }));
  } catch (err: any) { warn(`StackOverflow failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchNpmPackage(pkg: string): Promise<{ name: string; version: string; description: string; weeklyDownloads: number; license: string; homepage: string } | null> {
  const src = "npm-registry";
  try {
    const [meta, downloads] = await Promise.all([
      sovereignGet(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, src),
      sovereignGet(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`, src).catch(() => ({ data: {} })),
    ]);
    const d = meta.data;
    if (!d?.name) return null;
    return {
      name: d.name, version: d.version, description: d.description?.substring(0, 200) || "",
      weeklyDownloads: downloads.data?.downloads || 0, license: d.license || "Unknown",
      homepage: d.homepage || d.repository?.url || "",
    };
  } catch (err: any) { warn(`npm failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchPubChemCompound(name: string): Promise<{ name: string; formula: string; molecularWeight: string; iupacName: string; cid: number } | null> {
  const src = "pubchem";
  try {
    const res = await sovereignGet(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`, src);
    const props = res.data?.PropertyTable?.Properties?.[0];
    if (!props) return null;
    return {
      name, formula: props.MolecularFormula, molecularWeight: `${props.MolecularWeight} g/mol`,
      iupacName: props.IUPACName || name, cid: props.CID,
    };
  } catch (err: any) { warn(`PubChem failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchUSDAFood(food: string): Promise<{ name: string; calories: number; protein: string; fat: string; carbs: string; fiber: string } | null> {
  const src = "usda-food";
  try {
    const res = await sovereignGet(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(scrubQueryForAPI(food))}&pageSize=1&api_key=DEMO_KEY`, src);
    const item = res.data?.foods?.[0];
    if (!item) return null;
    const getNutrient = (name: string) => {
      const n = item.foodNutrients?.find((fn: any) => fn.nutrientName?.toLowerCase().includes(name.toLowerCase()));
      return n ? `${n.value}${n.unitName || ""}` : "N/A";
    };
    return {
      name: item.description, calories: item.foodNutrients?.find((fn: any) => fn.nutrientName?.includes("Energy"))?.value || 0,
      protein: getNutrient("Protein"), fat: getNutrient("Total lipid"), carbs: getNutrient("Carbohydrate"), fiber: getNutrient("Fiber"),
    };
  } catch (err: any) { warn(`USDA Food failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchOpenMeteoMarine(lat: number, lon: number): Promise<{ waveHeight: number; waveDirection: number; wavePeriod: number; oceanTemp: number } | null> {
  const src = "openmeteo-marine";
  try {
    const res = await sovereignGet("https://marine-api.open-meteo.com/v1/marine", src, {
      params: { latitude: lat, longitude: lon, current: "wave_height,wave_direction,wave_period,ocean_current_velocity" },
    });
    const c = res.data?.current;
    if (!c) return null;
    return { waveHeight: c.wave_height, waveDirection: c.wave_direction, wavePeriod: c.wave_period, oceanTemp: c.ocean_current_velocity || 0 };
  } catch (err: any) { warn(`Marine API failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchUniversitySearch(name: string): Promise<Array<{ name: string; country: string; website: string; domains: string[] }> | null> {
  const src = "universities";
  try {
    const res = await sovereignGet(`http://universities.hipolabs.com/search?name=${encodeURIComponent(scrubQueryForAPI(name))}`, src);
    if (!res.data?.length) return null;
    return res.data.slice(0, 8).map((u: any) => ({
      name: u.name, country: u.country, website: u.web_pages?.[0] || "", domains: u.domains || [],
    }));
  } catch (err: any) { warn(`University search failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchIPInfo(ip?: string): Promise<{ ip: string; city: string; region: string; country: string; org: string; timezone: string; loc: string } | null> {
  const src = "ipapi-ext";
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";
    const res = await sovereignGet(url, src);
    const d = res.data;
    if (!d?.ip) return null;
    return { ip: d.ip, city: d.city, region: d.region, country: d.country_name, org: d.org || "Unknown", timezone: d.timezone, loc: `${d.latitude},${d.longitude}` };
  } catch (err: any) { warn(`IP info failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchExchangeRateHistory(base: string, target: string, days: number = 30): Promise<Array<{ date: string; rate: number }> | null> {
  const src = "frankfurter-history";
  try {
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const res = await sovereignGet(`https://api.frankfurter.app/${start}..${end}?from=${base}&to=${target}`, src);
    if (!res.data?.rates) return null;
    return Object.entries(res.data.rates).map(([date, rates]: [string, any]) => ({
      date, rate: rates[target],
    }));
  } catch (err: any) { warn(`Forex history failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchGitHubUser(username: string): Promise<{ login: string; name: string; bio: string; publicRepos: number; followers: number; following: number; company: string; location: string } | null> {
  const src = "github-user";
  try {
    const res = await sovereignGet(`https://api.github.com/users/${encodeURIComponent(username)}`, src, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    const u = res.data;
    if (!u?.login) return null;
    return {
      login: u.login, name: u.name || u.login, bio: u.bio?.substring(0, 200) || "",
      publicRepos: u.public_repos, followers: u.followers, following: u.following,
      company: u.company || "N/A", location: u.location || "N/A",
    };
  } catch (err: any) { warn(`GitHub user failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchDogBreed(breed: string): Promise<{ images: string[]; breed: string } | null> {
  const src = "dog-ceo";
  try {
    const res = await sovereignGet(`https://dog.ceo/api/breed/${encodeURIComponent(breed.toLowerCase())}/images/random/3`, src);
    if (!res.data?.message?.length) return null;
    return { images: res.data.message, breed };
  } catch (err: any) { warn(`Dog breed failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchQuote(): Promise<{ content: string; author: string } | null> {
  const src = "quotable";
  try {
    const res = await sovereignGet("https://api.quotable.io/quotes/random", src);
    const q = res.data?.[0] || res.data;
    if (!q?.content) return null;
    return { content: q.content, author: q.author || "Unknown" };
  } catch (err: any) { warn(`Quotable failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchOpenFoodFacts(barcode: string): Promise<{ name: string; brands: string; categories: string; ingredients: string; nutriscore: string; image: string } | null> {
  const src = "openfoodfacts";
  try {
    const res = await sovereignGet(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, src);
    const p = res.data?.product;
    if (!p?.product_name) return null;
    return {
      name: p.product_name, brands: p.brands || "Unknown", categories: p.categories || "Unknown",
      ingredients: p.ingredients_text?.substring(0, 200) || "N/A",
      nutriscore: p.nutriscore_grade?.toUpperCase() || "N/A", image: p.image_url || "",
    };
  } catch (err: any) { warn(`OpenFoodFacts failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchSemanticScholar(query: string): Promise<Array<{ title: string; authors: string; year: number; citationCount: number; abstract: string }> | null> {
  const src = "semantic-scholar";
  try {
    const res = await sovereignGet(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(scrubQueryForAPI(query))}&limit=5&fields=title,authors,year,citationCount,abstract`, src);
    if (!res.data?.data?.length) return null;
    return res.data.data.map((p: any) => ({
      title: p.title, authors: (p.authors || []).slice(0, 3).map((a: any) => a.name).join(", "),
      year: p.year || 0, citationCount: p.citationCount || 0,
      abstract: p.abstract?.substring(0, 200) || "No abstract",
    }));
  } catch (err: any) { warn(`Semantic Scholar failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchCrossRefDOI(doi: string): Promise<{ title: string; authors: string; journal: string; year: number; citations: number; url: string } | null> {
  const src = "crossref";
  try {
    const res = await sovereignGet(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, src);
    const w = res.data?.message;
    if (!w?.title) return null;
    return {
      title: w.title[0], authors: (w.author || []).slice(0, 3).map((a: any) => `${a.given} ${a.family}`).join(", "),
      journal: w["container-title"]?.[0] || "Unknown", year: w.published?.["date-parts"]?.[0]?.[0] || 0,
      citations: w["is-referenced-by-count"] || 0, url: w.URL || "",
    };
  } catch (err: any) { warn(`CrossRef failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchGenderize(name: string): Promise<{ name: string; gender: string; probability: number; count: number } | null> {
  const src = "genderize";
  try {
    const res = await sovereignGet(`https://api.genderize.io?name=${encodeURIComponent(name)}`, src);
    if (!res.data?.gender) return null;
    return { name: res.data.name, gender: res.data.gender, probability: res.data.probability, count: res.data.count };
  } catch (err: any) { warn(`Genderize failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchAgify(name: string): Promise<{ name: string; age: number; count: number } | null> {
  const src = "agify";
  try {
    const res = await sovereignGet(`https://api.agify.io?name=${encodeURIComponent(name)}`, src);
    if (!res.data?.age) return null;
    return { name: res.data.name, age: res.data.age, count: res.data.count };
  } catch (err: any) { warn(`Agify failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchNationalize(name: string): Promise<{ name: string; countries: Array<{ country: string; probability: number }> } | null> {
  const src = "nationalize";
  try {
    const res = await sovereignGet(`https://api.nationalize.io?name=${encodeURIComponent(name)}`, src);
    if (!res.data?.country?.length) return null;
    return {
      name: res.data.name,
      countries: res.data.country.slice(0, 5).map((c: any) => ({ country: c.country_id, probability: c.probability })),
    };
  } catch (err: any) { warn(`Nationalize failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchOpenMeteoHistorical(lat: number, lon: number, date: string): Promise<{ date: string; maxTemp: number; minTemp: number; rain: number; windMax: number } | null> {
  const src = "openmeteo-historical";
  try {
    const res = await sovereignGet("https://archive-api.open-meteo.com/v1/archive", src, {
      params: { latitude: lat, longitude: lon, start_date: date, end_date: date, daily: "temperature_2m_max,temperature_2m_min,rain_sum,wind_speed_10m_max" },
    });
    const d = res.data?.daily;
    if (!d) return null;
    return {
      date, maxTemp: d.temperature_2m_max?.[0], minTemp: d.temperature_2m_min?.[0],
      rain: d.rain_sum?.[0] || 0, windMax: d.wind_speed_10m_max?.[0] || 0,
    };
  } catch (err: any) { warn(`Historical weather failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchOpenMeteoUV(lat: number, lon: number): Promise<{ uvIndex: number; uvIndexClearSky: number } | null> {
  const src = "openmeteo-uv";
  try {
    const res = await sovereignGet("https://api.open-meteo.com/v1/forecast", src, {
      params: { latitude: lat, longitude: lon, current: "uv_index,uv_index_clear_sky" },
    });
    const c = res.data?.current;
    if (!c) return null;
    return { uvIndex: c.uv_index, uvIndexClearSky: c.uv_index_clear_sky };
  } catch (err: any) { warn(`UV index failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchRSSCategory(url: string, sourceName: string): Promise<Array<{ title: string; link: string; pubDate: string }> | null> {
  const src = `rss-${sourceName}`;
  try {
    const res = await sovereignGet(url, src);
    const text = typeof res.data === "string" ? res.data : "";
    const items: Array<{ title: string; link: string; pubDate: string }> = [];
    const itemMatches = text.match(/<item>[\s\S]*?<\/item>/gi) || text.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    for (const item of itemMatches.slice(0, 8)) {
      const title = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
      const link = item.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i)?.[1] || item.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] || item.match(/<updated>(.*?)<\/updated>/i)?.[1] || "";
      if (title) items.push({ title: title.replace(/<[^>]+>/g, "").trim(), link: link.trim(), pubDate });
    }
    return items.length > 0 ? items : null;
  } catch (err: any) { warn(`RSS ${sourceName} failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchSportsScores(): Promise<Array<{ sport: string; headline: string }> | null> {
  const feeds = [
    { url: "https://www.espn.com/espn/rss/news", name: "ESPN" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", name: "NYT-Sports" },
  ];
  const results: Array<{ sport: string; headline: string }> = [];
  for (const feed of feeds) {
    const items = await fetchRSSCategory(feed.url, feed.name);
    if (items) {
      items.forEach(i => results.push({ sport: feed.name, headline: i.title }));
    }
  }
  return results.length > 0 ? results : null;
}

export async function fetchTechNews(): Promise<Array<{ source: string; headline: string; link: string }> | null> {
  const feeds = [
    { url: "https://feeds.arstechnica.com/arstechnica/index", name: "ArsTechnica" },
    { url: "https://www.theverge.com/rss/index.xml", name: "TheVerge" },
    { url: "https://techcrunch.com/feed/", name: "TechCrunch" },
  ];
  const results: Array<{ source: string; headline: string; link: string }> = [];
  for (const feed of feeds) {
    const items = await fetchRSSCategory(feed.url, feed.name);
    if (items) {
      items.slice(0, 4).forEach(i => results.push({ source: feed.name, headline: i.title, link: i.link }));
    }
  }
  return results.length > 0 ? results : null;
}

export async function fetchScienceNews(): Promise<Array<{ source: string; headline: string; link: string }> | null> {
  const feeds = [
    { url: "https://www.sciencedaily.com/rss/all.xml", name: "ScienceDaily" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml", name: "NYT-Science" },
    { url: "https://www.nature.com/nature.rss", name: "Nature" },
  ];
  const results: Array<{ source: string; headline: string; link: string }> = [];
  for (const feed of feeds) {
    const items = await fetchRSSCategory(feed.url, feed.name);
    if (items) {
      items.slice(0, 4).forEach(i => results.push({ source: feed.name, headline: i.title, link: i.link }));
    }
  }
  return results.length > 0 ? results : null;
}

export async function fetchBusinessNews(): Promise<Array<{ source: string; headline: string; link: string }> | null> {
  const feeds = [
    { url: "https://feeds.bloomberg.com/markets/news.rss", name: "Bloomberg" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", name: "NYT-Business" },
    { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", name: "CNBC" },
  ];
  const results: Array<{ source: string; headline: string; link: string }> = [];
  for (const feed of feeds) {
    const items = await fetchRSSCategory(feed.url, feed.name);
    if (items) {
      items.slice(0, 4).forEach(i => results.push({ source: feed.name, headline: i.title, link: i.link }));
    }
  }
  return results.length > 0 ? results : null;
}

export async function fetchHealthNews(): Promise<Array<{ source: string; headline: string; link: string }> | null> {
  const feeds = [
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", name: "NYT-Health" },
    { url: "https://www.who.int/rss-feeds/news-english.xml", name: "WHO" },
  ];
  const results: Array<{ source: string; headline: string; link: string }> = [];
  for (const feed of feeds) {
    const items = await fetchRSSCategory(feed.url, feed.name);
    if (items) {
      items.slice(0, 4).forEach(i => results.push({ source: feed.name, headline: i.title, link: i.link }));
    }
  }
  return results.length > 0 ? results : null;
}

export async function fetchStanfordPhilosophy(topic: string): Promise<{ title: string; content: string; url: string } | null> {
  const src = "sep-philosophy";
  try {
    const scrubbed = scrubOutboundQuery(topic).replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9\-]/g, "");
    const res = await sovereignGet(`https://plato.stanford.edu/entries/${scrubbed}/`, src);
    if (typeof res.data !== "string") return null;
    const titleMatch = res.data.match(/<title[^>]*>([^<]+)<\/title>/i);
    const bodyMatch = res.data.match(/<div id="main-text"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
      || res.data.match(/<section[^>]*>([\s\S]{500,4000}?)<\/section>/i);
    if (!bodyMatch) return null;
    const textContent = bodyMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 2000);
    if (textContent.length < 100) return null;
    return {
      title: titleMatch?.[1]?.trim() || topic,
      content: textContent,
      url: `https://plato.stanford.edu/entries/${scrubbed}/`,
    };
  } catch (err: any) { warn(`SEP failed for ${topic}: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchGutenbergBook(title: string): Promise<{ title: string; author: string; content: string; url: string } | null> {
  const src = "gutenberg";
  try {
    const scrubbed = scrubQueryForAPI(title);
    const search = await sovereignGet(`https://gutendex.com/books/?search=${encodeURIComponent(scrubbed)}&mime_type=text`, src);
    const books = search.data?.results;
    if (!books?.length) return null;
    const book = books[0];
    const textUrl = book.formats?.["text/plain; charset=utf-8"] || book.formats?.["text/plain"];
    if (!textUrl) return { title: book.title, author: book.authors?.[0]?.name || "Unknown", content: `Classic text available at Project Gutenberg`, url: `https://www.gutenberg.org/ebooks/${book.id}` };
    const textRes = await sovereignGet(textUrl, src);
    const rawText = typeof textRes.data === "string" ? textRes.data : "";
    const excerpt = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").substring(0, 2000);
    return {
      title: book.title,
      author: book.authors?.[0]?.name || "Unknown",
      content: excerpt,
      url: `https://www.gutenberg.org/ebooks/${book.id}`,
    };
  } catch (err: any) { warn(`Gutenberg failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchNASASpaceData(query: string): Promise<{ title: string; description: string; url: string; date: string } | null> {
  const src = "nasa-search";
  try {
    const scrubbed = scrubQueryForAPI(query);
    const res = await sovereignGet(`https://images-api.nasa.gov/search?q=${encodeURIComponent(scrubbed)}&media_type=image&page_size=5`, src);
    const items = res.data?.collection?.items;
    if (!items?.length) return null;
    const item = items[0];
    const data = item.data?.[0];
    return {
      title: data?.title || "NASA Content",
      description: data?.description?.substring(0, 800) || "NASA space content",
      url: item.href || `https://images.nasa.gov/`,
      date: data?.date_created?.substring(0, 10) || "",
    };
  } catch (err: any) { warn(`NASA search failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchUSGSGeographyData(topic: string): Promise<{ title: string; content: string; url: string } | null> {
  const src = "usgs-geo";
  try {
    const res = await sovereignGet("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson", src);
    const features = res.data?.features;
    if (!features?.length) return null;
    const places = features.slice(0, 10).map((f: any) => `${f.properties.place} (M${f.properties.mag})`).join("; ");
    return {
      title: "USGS Significant Earthquakes This Month",
      content: `Recent significant seismic events: ${places}. Total: ${features.length} events tracked.`,
      url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
    };
  } catch (err: any) { warn(`USGS geo failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchPubMedAbstract(query: string): Promise<Array<{ title: string; abstract: string; authors: string; pmid: string; url: string }>> {
  const src = "pubmed";
  try {
    const scrubbed = scrubQueryForAPI(query);
    const search = await sovereignGet(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(scrubbed)}&retmax=5&retmode=json`, src);
    const ids = search.data?.esearchresult?.idlist;
    if (!ids?.length) return [];
    const fetch = await sovereignGet(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.slice(0, 3).join(",")}&rettype=abstract&retmode=xml`, src);
    const xml = typeof fetch.data === "string" ? fetch.data : "";
    const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
    return articles.map((article: string) => {
      const titleMatch = article.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
      const abstractMatch = article.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
      const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      const authorMatches = article.match(/<LastName>([\s\S]*?)<\/LastName>/g) || [];
      const authors = authorMatches.slice(0, 3).map((m: string) => m.replace(/<\/?LastName>/g, "")).join(", ");
      const pmid = pmidMatch?.[1] || "";
      return {
        title: titleMatch?.[1]?.replace(/<[^>]+>/g, "") || "Unknown",
        abstract: abstractMatch?.[1]?.replace(/<[^>]+>/g, "")?.substring(0, 500) || "No abstract",
        authors,
        pmid,
        url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
      };
    });
  } catch (err: any) { warn(`PubMed failed: ${err.message?.substring(0, 80)}`); return []; }
}

export async function fetchMetMuseumArt(query: string): Promise<Array<{ title: string; artist: string; date: string; medium: string; image: string; url: string }>> {
  const src = "met-museum";
  try {
    const scrubbed = scrubQueryForAPI(query);
    const search = await sovereignGet(`https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(scrubbed)}&hasImages=true&limit=8`, src);
    const ids = search.data?.objectIDs;
    if (!ids?.length) return [];
    const objects = await Promise.allSettled(
      ids.slice(0, 4).map(async (id: number) => {
        const obj = await sovereignGet(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, src);
        const d = obj.data;
        return {
          title: d.title || "Untitled",
          artist: d.artistDisplayName || "Unknown",
          date: d.objectDate || "Unknown",
          medium: d.medium || "Unknown",
          image: d.primaryImageSmall || "",
          url: d.objectURL || `https://www.metmuseum.org/art/collection/search/${id}`,
        };
      })
    );
    return objects
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value);
  } catch (err: any) { warn(`Met Museum failed: ${err.message?.substring(0, 80)}`); return []; }
}

export async function fetchRijksmuseumArt(query: string): Promise<Array<{ title: string; artist: string; date: string; url: string }>> {
  const src = "rijksmuseum";
  try {
    const scrubbed = scrubQueryForAPI(query);
    const res = await sovereignGet(`https://www.rijksmuseum.nl/api/en/collection?q=${encodeURIComponent(scrubbed)}&ps=5&imgonly=True`, src);
    const items = res.data?.artObjects;
    if (!items?.length) return [];
    return items.slice(0, 5).map((item: any) => ({
      title: item.title || "Untitled",
      artist: item.principalOrFirstMaker || "Unknown",
      date: item.longTitle || "",
      url: item.links?.web || "",
    }));
  } catch (err: any) { warn(`Rijksmuseum failed: ${err.message?.substring(0, 80)}`); return []; }
}

export async function fetchRestCountriesAll(): Promise<Array<{ name: string; capital: string; population: number; region: string; subregion: string; area: number; languages: string[] }>> {
  const src = "restcountries-all";
  try {
    const res = await sovereignGet("https://restcountries.com/v3.1/all?fields=name,capital,population,region,subregion,area,languages", src);
    if (!res.data?.length) return [];
    return res.data.map((c: any) => ({
      name: c.name?.common || "Unknown",
      capital: c.capital?.[0] || "N/A",
      population: c.population || 0,
      region: c.region || "",
      subregion: c.subregion || "",
      area: c.area || 0,
      languages: Object.values(c.languages || {}) as string[],
    })).slice(0, 50);
  } catch (err: any) { warn(`RestCountries all failed: ${err.message?.substring(0, 80)}`); return []; }
}

export async function fetchPhilosophyQuotes(philosopher: string): Promise<Array<{ text: string; author: string; category: string }>> {
  const src = "philosophy-quotes";
  try {
    const scrubbed = scrubQueryForAPI(philosopher);
    const res = await sovereignGet(`https://api.quotable.io/search/quotes?query=${encodeURIComponent(scrubbed)}&limit=8`, src);
    const results = res.data?.results || [];
    return results.map((q: any) => ({
      text: q.content || "",
      author: q.author || "Unknown",
      category: (q.tags || []).join(", ") || "philosophy",
    }));
  } catch (err: any) { warn(`Philosophy quotes failed: ${err.message?.substring(0, 80)}`); return []; }
}

export async function fetchTeslaArchive(): Promise<{ title: string; content: string; url: string } | null> {
  const src = "tesla-archive-wiki";
  try {
    const res = await sovereignGet("https://en.wikipedia.org/w/api.php", src, {
      params: { action: "query", prop: "extracts", explaintext: true, titles: "Nikola Tesla", format: "json", origin: "*" },
    });
    const pages = res.data?.query?.pages;
    const p = pages ? Object.values(pages)[0] as any : null;
    if (!p?.extract) return null;
    return {
      title: "Nikola Tesla — Life, Inventions & Legacy",
      content: p.extract.substring(0, 3000),
      url: "https://en.wikipedia.org/wiki/Nikola_Tesla",
    };
  } catch (err: any) { warn(`Tesla archive failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchDaVinciArchive(): Promise<{ title: string; content: string; url: string } | null> {
  const src = "davinci-archive-wiki";
  try {
    const res = await sovereignGet("https://en.wikipedia.org/w/api.php", src, {
      params: { action: "query", prop: "extracts", explaintext: true, titles: "Leonardo da Vinci", format: "json", origin: "*" },
    });
    const pages = res.data?.query?.pages;
    const p = pages ? Object.values(pages)[0] as any : null;
    if (!p?.extract) return null;
    return {
      title: "Leonardo da Vinci — Renaissance Genius",
      content: p.extract.substring(0, 3000),
      url: "https://en.wikipedia.org/wiki/Leonardo_da_Vinci",
    };
  } catch (err: any) { warn(`Da Vinci archive failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchTaoBible(): Promise<{ title: string; content: string; url: string } | null> {
  const src = "tao-te-ching";
  try {
    const res = await sovereignGet("https://en.wikipedia.org/w/api.php", src, {
      params: { action: "query", prop: "extracts", explaintext: true, titles: "Tao Te Ching", format: "json", origin: "*" },
    });
    const pages = res.data?.query?.pages;
    const p = pages ? Object.values(pages)[0] as any : null;
    if (!p?.extract) return null;
    return {
      title: "Tao Te Ching — The Way and Its Virtue",
      content: p.extract.substring(0, 3000),
      url: "https://en.wikipedia.org/wiki/Tao_Te_Ching",
    };
  } catch (err: any) { warn(`Tao Te Ching failed: ${err.message?.substring(0, 80)}`); return null; }
}

export async function fetchGeopoliticsData(_topic: string = "geopolitics international relations"): Promise<{ title: string; content: string; url: string } | null> {
  const src = "geopolitics-wiki";
  try {
    const res = await sovereignGet("https://en.wikipedia.org/w/api.php", src, {
      params: { action: "query", prop: "extracts", exintro: true, explaintext: true, titles: "Geopolitics", format: "json", origin: "*" },
    });
    const pages = res.data?.query?.pages;
    const p = pages ? Object.values(pages)[0] as Record<string, unknown> : null;
    const extract = typeof p?.extract === "string" ? p.extract : null;
    if (!extract) return null;
    const wbRes = await sovereignGet("https://api.worldbank.org/v2/country?format=json&per_page=10", "world-bank");
    const countries = wbRes.data?.[1] || [];
    const countrySummary = Array.isArray(countries)
      ? countries.slice(0, 5).map((c: Record<string, unknown>) => {
          const region = typeof c.region === "object" && c.region !== null ? (c.region as Record<string, unknown>).value : "";
          return `${String(c.name ?? "")} (${String(region ?? "")})`;
        }).join("; ")
      : "";
    const combinedContent = `${extract.substring(0, 2000)}\n\nWorld Bank Country Overview: ${countrySummary}`;
    return {
      title: "Geopolitics, International Relations & Power Dynamics",
      content: combinedContent,
      url: "https://en.wikipedia.org/wiki/Geopolitics",
    };
  } catch (err: any) { warn(`Geopolitics fetch failed: ${err.message?.substring(0, 80)}`); return null; }
}

export const KNOWLEDGE_SUBJECT_FEEDS: Record<string, { label: string; fetcher: () => Promise<any> }> = {
  "nikola-tesla": { label: "Nikola Tesla Archive", fetcher: fetchTeslaArchive },
  "leonardo-da-vinci": { label: "Leonardo Da Vinci Archive", fetcher: fetchDaVinciArchive },
  "taoism-eastern": { label: "Tao Te Ching", fetcher: fetchTaoBible },
  "universe-cosmology": { label: "NASA Space Data", fetcher: () => fetchNASASpaceData("universe cosmos galaxy") },
  "space-astronomy": { label: "NASA Astronomy", fetcher: fetchAPOD },
  "geography-world": { label: "USGS Geography & Countries", fetcher: fetchRestCountriesAll },
  "geopolitics": { label: "Geopolitics & International Relations", fetcher: () => fetchGeopoliticsData() },
  "biochemistry": { label: "PubMed Biochemistry", fetcher: () => fetchPubMedAbstract("biochemistry metabolism enzymes") },
  "biology-genetics": { label: "PubMed Biology", fetcher: () => fetchPubMedAbstract("molecular biology genetics CRISPR") },
  "art-history": { label: "Met Museum Art", fetcher: () => fetchMetMuseumArt("renaissance classical art") },
  "western-philosophy": { label: "Stanford Encyclopedia of Philosophy", fetcher: () => fetchStanfordPhilosophy("Plato") },
  "mythology-world": { label: "Philosophy Quotes & Mythology", fetcher: () => fetchPhilosophyQuotes("mythology archetype hero") },
  "god-theology": { label: "Philosophy of Religion", fetcher: () => fetchStanfordPhilosophy("God religion") },
  "spirituality-practice": { label: "Tao & Spirituality", fetcher: fetchTaoBible },
  "consciousness-universe": { label: "PubMed Consciousness", fetcher: () => fetchPubMedAbstract("consciousness awareness neuroscience") },
  "quantum-science": { label: "arXiv Quantum Physics", fetcher: () => fetchNASASpaceData("quantum field theory particle") },
  "government-systems": { label: "World Government Data", fetcher: () => fetchRestCountriesAll() },
  "world-cultures": { label: "Countries & Cultures", fetcher: fetchRestCountriesAll },
  "love-human-connection": { label: "Philosophy of Love", fetcher: () => fetchPhilosophyQuotes("love compassion human connection") },
  "self-awareness-introspection": { label: "Philosophy of Mind", fetcher: () => fetchStanfordPhilosophy("self-knowledge") },
  "geometry-mathematics": { label: "Math & Geometry", fetcher: () => fetchNASASpaceData("geometry mathematics sacred") },
  "alchemy-history": { label: "Project Gutenberg Alchemy", fetcher: () => fetchGutenbergBook("alchemy hermetic transmutation") },
  "inventors-history": { label: "Gutenberg Inventors Classics", fetcher: () => fetchGutenbergBook("inventors science history") },
  "self-coding-mastery": { label: "PubMed Computational", fetcher: () => fetchPubMedAbstract("machine learning neural network self-improving code") },
  "classic-literature": { label: "Project Gutenberg Classics", fetcher: () => fetchGutenbergBook("Meditations Marcus Aurelius") },
};

export async function fetchSubjectKnowledge(subject: string): Promise<{ subject: string; title: string; content: string; source: string; url: string } | null> {
  const feed = KNOWLEDGE_SUBJECT_FEEDS[subject];
  if (!feed) return null;
  try {
    const result = await feed.fetcher();
    if (!result) return null;
    if (Array.isArray(result)) {
      if (result.length === 0) return null;
      const first = result[0];
      const combined = result.map((r: any) => r.title || r.name || r.content || "").filter(Boolean).join("; ").substring(0, 2000);
      return { subject, title: feed.label, content: combined, source: feed.label, url: first.url || "" };
    }
    return {
      subject,
      title: (result as any).title || feed.label,
      content: ((result as any).content || (result as any).extract || (result as any).explanation || "").substring(0, 2000),
      source: feed.label,
      url: (result as any).url || "",
    };
  } catch (err: any) {
    warn(`Subject knowledge fetch failed for ${subject}: ${err.message?.substring(0, 80)}`);
    return null;
  }
}

export const SOVEREIGN_FEED_MANIFEST = {
  version: "4.0.0",
  totalSources: 71,
  categories: [
    "crypto", "weather", "news", "sports", "science", "technology", "business", "health",
    "knowledge", "forex", "stocks", "space", "earthquakes", "economics", "food", "music",
    "chemistry", "programming", "academic", "geography", "definitions", "environment",
    "transportation", "holidays", "timezones", "quotes", "geolocation", "marine",
    "philosophy", "art", "literature", "biology", "history", "culture", "spirituality",
  ],
  sources: [
    { name: "Wikipedia", type: "knowledge", apiKey: false, url: "en.wikipedia.org" },
    { name: "Wikidata", type: "knowledge-graph", apiKey: false, url: "wikidata.org" },
    { name: "DuckDuckGo Instant", type: "answers", apiKey: false, url: "api.duckduckgo.com" },
    { name: "CoinGecko", type: "crypto", apiKey: false, url: "api.coingecko.com" },
    { name: "CoinCap", type: "crypto-backup", apiKey: false, url: "api.coincap.io" },
    { name: "CryptoCompare", type: "crypto-backup-2", apiKey: false, url: "min-api.cryptocompare.com" },
    { name: "Open-Meteo Weather", type: "weather", apiKey: false, url: "api.open-meteo.com" },
    { name: "Open-Meteo Air Quality", type: "air-quality", apiKey: false, url: "air-quality-api.open-meteo.com" },
    { name: "Open-Meteo Marine", type: "marine", apiKey: false, url: "marine-api.open-meteo.com" },
    { name: "Open-Meteo Historical", type: "historical-weather", apiKey: false, url: "archive-api.open-meteo.com" },
    { name: "Open-Meteo UV", type: "uv-index", apiKey: false, url: "api.open-meteo.com" },
    { name: "Frankfurter/ECB", type: "forex", apiKey: false, url: "api.frankfurter.app" },
    { name: "Yahoo Finance", type: "stocks", apiKey: false, url: "finance.yahoo.com" },
    { name: "BBC RSS", type: "news", apiKey: false, url: "feeds.bbci.co.uk" },
    { name: "NYT RSS", type: "news", apiKey: false, url: "rss.nytimes.com" },
    { name: "NYT Sports", type: "sports-news", apiKey: false, url: "rss.nytimes.com" },
    { name: "NYT Science", type: "science-news", apiKey: false, url: "rss.nytimes.com" },
    { name: "NYT Health", type: "health-news", apiKey: false, url: "rss.nytimes.com" },
    { name: "NYT Business", type: "business-news", apiKey: false, url: "rss.nytimes.com" },
    { name: "ESPN", type: "sports", apiKey: false, url: "espn.com" },
    { name: "ArsTechnica", type: "tech-news", apiKey: false, url: "arstechnica.com" },
    { name: "TheVerge", type: "tech-news", apiKey: false, url: "theverge.com" },
    { name: "TechCrunch", type: "tech-news", apiKey: false, url: "techcrunch.com" },
    { name: "ScienceDaily", type: "science-news", apiKey: false, url: "sciencedaily.com" },
    { name: "Nature", type: "science-journal", apiKey: false, url: "nature.com" },
    { name: "WHO", type: "health-news", apiKey: false, url: "who.int" },
    { name: "Bloomberg", type: "business-news", apiKey: false, url: "bloomberg.com" },
    { name: "CNBC", type: "business-news", apiKey: false, url: "cnbc.com" },
    { name: "Hacker News", type: "tech-news", apiKey: false, url: "hacker-news.firebaseio.com" },
    { name: "Reddit", type: "social", apiKey: false, url: "reddit.com" },
    { name: "arXiv", type: "research", apiKey: false, url: "export.arxiv.org" },
    { name: "Semantic Scholar", type: "academic", apiKey: false, url: "api.semanticscholar.org" },
    { name: "CrossRef", type: "academic", apiKey: false, url: "api.crossref.org" },
    { name: "GitHub", type: "code", apiKey: false, url: "api.github.com" },
    { name: "StackOverflow", type: "programming", apiKey: false, url: "api.stackexchange.com" },
    { name: "npm Registry", type: "packages", apiKey: false, url: "registry.npmjs.org" },
    { name: "Open Library", type: "books", apiKey: false, url: "openlibrary.org" },
    { name: "RestCountries", type: "geography", apiKey: false, url: "restcountries.com" },
    { name: "Free Dictionary", type: "definitions", apiKey: false, url: "dictionaryapi.dev" },
    { name: "USGS Earthquakes", type: "seismic", apiKey: false, url: "earthquake.usgs.gov" },
    { name: "NASA APOD", type: "astronomy", apiKey: false, url: "api.nasa.gov" },
    { name: "NASA Near Earth Objects", type: "asteroids", apiKey: false, url: "api.nasa.gov" },
    { name: "NASA EONET", type: "natural-events", apiKey: false, url: "eonet.gsfc.nasa.gov" },
    { name: "ISS Tracker", type: "space", apiKey: false, url: "api.open-notify.org" },
    { name: "Sunrise/Sunset", type: "astronomy", apiKey: false, url: "api.sunrise-sunset.org" },
    { name: "World Bank", type: "economics", apiKey: false, url: "api.worldbank.org" },
    { name: "NumbersAPI", type: "trivia", apiKey: false, url: "numbersapi.com" },
    { name: "Nager.Date Holidays", type: "holidays", apiKey: false, url: "date.nager.at" },
    { name: "WorldTimeAPI", type: "timezones", apiKey: false, url: "worldtimeapi.org" },
    { name: "iTunes Search", type: "music", apiKey: false, url: "itunes.apple.com" },
    { name: "MusicBrainz", type: "music", apiKey: false, url: "musicbrainz.org" },
    { name: "PubChem", type: "chemistry", apiKey: false, url: "pubchem.ncbi.nlm.nih.gov" },
    { name: "USDA FoodData", type: "nutrition", apiKey: false, url: "api.nal.usda.gov" },
    { name: "OpenFoodFacts", type: "food", apiKey: false, url: "world.openfoodfacts.org" },
    { name: "Universities", type: "education", apiKey: false, url: "universities.hipolabs.com" },
    { name: "Quotable", type: "quotes", apiKey: false, url: "api.quotable.io" },
    { name: "Fear & Greed Index", type: "sentiment", apiKey: false, url: "alternative.me" },
    { name: "ipapi", type: "geolocation", apiKey: false, url: "ipapi.co" },
    { name: "Sovereign Scraper", type: "web-research", apiKey: false, url: "sovereign-scraper" },
    { name: "Stanford Encyclopedia of Philosophy", type: "philosophy", apiKey: false, url: "plato.stanford.edu" },
    { name: "Project Gutenberg / Gutendex", type: "literature", apiKey: false, url: "gutendex.com" },
    { name: "NASA Image Search", type: "space", apiKey: false, url: "images-api.nasa.gov" },
    { name: "USGS Significant Events", type: "geography", apiKey: false, url: "earthquake.usgs.gov" },
    { name: "PubMed / NCBI", type: "biology-biochemistry", apiKey: false, url: "eutils.ncbi.nlm.nih.gov" },
    { name: "Metropolitan Museum of Art", type: "art", apiKey: false, url: "collectionapi.metmuseum.org" },
    { name: "Rijksmuseum", type: "art", apiKey: false, url: "rijksmuseum.nl" },
    { name: "RestCountries All", type: "geography-culture", apiKey: false, url: "restcountries.com" },
    { name: "Quotable Philosophy", type: "philosophy", apiKey: false, url: "api.quotable.io" },
    { name: "Wikipedia Tesla Archive", type: "history-inventors", apiKey: false, url: "en.wikipedia.org" },
    { name: "Wikipedia Da Vinci Archive", type: "history-art", apiKey: false, url: "en.wikipedia.org" },
    { name: "Wikipedia Tao Te Ching", type: "spirituality", apiKey: false, url: "en.wikipedia.org" },
    { name: "Wikipedia Geopolitics + World Bank Countries", type: "geopolitics", apiKey: false, url: "en.wikipedia.org + api.worldbank.org" },
  ],
};

log(`Sovereign Data Feeds v4.0 initialized — ${SOVEREIGN_FEED_MANIFEST.totalSources} sources across ${SOVEREIGN_FEED_MANIFEST.categories.length} categories | New: philosophy, art, literature, biology, geography, culture, Tesla/Da Vinci/Tao archives | 3-tier crypto failover, per-source rate limiting + exponential backoff ACTIVE`);
