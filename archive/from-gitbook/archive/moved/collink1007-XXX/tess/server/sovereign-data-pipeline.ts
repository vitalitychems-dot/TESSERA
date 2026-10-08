import axios from "axios";
import type { Express, Request, Response } from "express";
import { broadcast } from "./ws-broadcast";
import { logActivity } from "./activity-feed";
import { recordHealEvent } from "./self-heal-monitor";

const plog = (m: string) => console.log(`[SovPipeline] ${m}`);

export interface TessDataSource {
  id: string;
  name: string;
  protocol: "tess" | "http" | "ws" | "internal";
  url: string;
  category: string;
  refreshIntervalMs: number;
  lastFetched: number;
  lastData: any;
  lastError: string | null;
  fetchCount: number;
  successCount: number;
  failCount: number;
  active: boolean;
  parser: "json" | "html" | "text" | "xml" | "csv";
}

export interface TessProtocolRequest {
  uri: string;
  method: "GET" | "POST" | "SUBSCRIBE";
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface TessProtocolResponse {
  uri: string;
  status: number;
  data: any;
  meta: {
    source: string;
    fetchedAt: number;
    cached: boolean;
    latencyMs: number;
    nodeId: string;
  };
}

const dataSources: Map<string, TessDataSource> = new Map();
const dataCache: Map<string, { data: any; fetchedAt: number; ttlMs: number }> = new Map();
const subscriptions: Map<string, { callback: (data: any) => void; interval: ReturnType<typeof setInterval> }[]> = new Map();

const SOVEREIGN_NODE_ID = `TESS-SOVEREIGN-${Date.now().toString(36).toUpperCase()}`;

const BUILT_IN_SOURCES: Omit<TessDataSource, "lastFetched" | "lastData" | "lastError" | "fetchCount" | "successCount" | "failCount">[] = [
  { id: "sol-price", name: "Solana Price Feed", protocol: "http", url: "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,eur,btc&include_24hr_change=true", category: "crypto", refreshIntervalMs: 60000, active: true, parser: "json" },
  { id: "sol-slot", name: "Solana Slot Height", protocol: "http", url: "https://api.mainnet-beta.solana.com", category: "crypto", refreshIntervalMs: 60000, active: true, parser: "json" },
  { id: "currency-rates", name: "Currency Exchange Rates", protocol: "http", url: "https://api.frankfurter.app/latest?from=USD", category: "finance", refreshIntervalMs: 3600000, active: true, parser: "json" },
  { id: "btc-price", name: "Bitcoin Price", protocol: "http", url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur&include_24hr_change=true", category: "crypto", refreshIntervalMs: 90000, active: true, parser: "json" },
  { id: "crypto-market", name: "Top Crypto Market Data", protocol: "http", url: "https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true", category: "crypto", refreshIntervalMs: 180000, active: true, parser: "json" },
  { id: "system-health", name: "System Health Internal", protocol: "internal", url: "internal://health", category: "system", refreshIntervalMs: 15000, active: true, parser: "json" },
  { id: "lattice-status", name: "Lattice Mesh Status", protocol: "internal", url: "internal://lattice", category: "system", refreshIntervalMs: 30000, active: true, parser: "json" },
];

function initSources() {
  for (const src of BUILT_IN_SOURCES) {
    dataSources.set(src.id, {
      ...src,
      lastFetched: 0,
      lastData: null,
      lastError: null,
      fetchCount: 0,
      successCount: 0,
      failCount: 0,
    });
  }
  plog(`Initialized ${dataSources.size} sovereign data sources`);
}

async function fetchHTTPSource(source: TessDataSource): Promise<any> {
  const start = Date.now();
  try {
    let data: any;
    if (source.url.includes("mainnet-beta.solana.com")) {
      const resp = await axios.post(source.url, {
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [{ commitment: "finalized" }],
      }, { timeout: 10000 });
      data = resp.data;
    } else {
      const resp = await axios.get(source.url, { timeout: 10000 });
      data = resp.data;
    }
    source.lastData = data;
    source.lastFetched = Date.now();
    source.lastError = null;
    source.successCount++;
    source.fetchCount++;
    const latency = Date.now() - start;
    dataCache.set(source.id, { data, fetchedAt: Date.now(), ttlMs: source.refreshIntervalMs });
    return data;
  } catch (err: any) {
    source.lastError = err.message?.slice(0, 200) || "Unknown error";
    source.failCount++;
    source.fetchCount++;
    recordHealEvent("connection-retry", `pipeline-${source.id}`, `Data source ${source.name} fetch failed: ${source.lastError}`, "medium", false);
    return null;
  }
}

async function fetchInternalSource(source: TessDataSource): Promise<any> {
  const os = await import("os");
  if (source.url === "internal://health") {
    const mem = process.memoryUsage();
    const data = {
      uptime: process.uptime(),
      memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      cpuLoad: os.loadavg()[0],
      platform: os.platform(),
      nodeVersion: process.version,
      pid: process.pid,
      timestamp: Date.now(),
    };
    source.lastData = data;
    source.lastFetched = Date.now();
    source.successCount++;
    source.fetchCount++;
    dataCache.set(source.id, { data, fetchedAt: Date.now(), ttlMs: source.refreshIntervalMs });
    return data;
  }
  if (source.url === "internal://lattice") {
    const data = {
      nodeId: SOVEREIGN_NODE_ID,
      activeSources: dataSources.size,
      cacheEntries: dataCache.size,
      totalFetches: Array.from(dataSources.values()).reduce((s, d) => s + d.fetchCount, 0),
      totalSuccess: Array.from(dataSources.values()).reduce((s, d) => s + d.successCount, 0),
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
    source.lastData = data;
    source.lastFetched = Date.now();
    source.successCount++;
    source.fetchCount++;
    dataCache.set(source.id, { data, fetchedAt: Date.now(), ttlMs: source.refreshIntervalMs });
    return data;
  }
  return null;
}

export async function resolveTessProtocol(request: TessProtocolRequest): Promise<TessProtocolResponse> {
  const start = Date.now();
  const uri = request.uri.replace(/^tess:\/\//, "");
  const parts = uri.split("/");
  const domain = parts[0];
  const path = parts.slice(1).join("/");

  const cached = dataCache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
    return {
      uri: request.uri,
      status: 200,
      data: cached.data,
      meta: { source: domain, fetchedAt: cached.fetchedAt, cached: true, latencyMs: Date.now() - start, nodeId: SOVEREIGN_NODE_ID },
    };
  }

  const source = dataSources.get(domain);
  if (source) {
    let data: any;
    if (source.protocol === "http") {
      data = await fetchHTTPSource(source);
    } else if (source.protocol === "internal") {
      data = await fetchInternalSource(source);
    }
    if (data) {
      return {
        uri: request.uri,
        status: 200,
        data,
        meta: { source: domain, fetchedAt: Date.now(), cached: false, latencyMs: Date.now() - start, nodeId: SOVEREIGN_NODE_ID },
      };
    }
  }

  if (domain === "price" && path) {
    try {
      const resp = await axios.get(`https://api.jup.ag/price/v2?ids=${path}`, { timeout: 10000 });
      const data = resp.data;
      dataCache.set(`price-${path}`, { data, fetchedAt: Date.now(), ttlMs: 30000 });
      return {
        uri: request.uri,
        status: 200,
        data,
        meta: { source: "jupiter-price", fetchedAt: Date.now(), cached: false, latencyMs: Date.now() - start, nodeId: SOVEREIGN_NODE_ID },
      };
    } catch { }
  }

  if (domain === "currency" && path) {
    try {
      const resp = await axios.get(`https://api.frankfurter.app/latest?from=${path.toUpperCase()}`, { timeout: 10000 });
      dataCache.set(`currency-${path}`, { data: resp.data, fetchedAt: Date.now(), ttlMs: 3600000 });
      return {
        uri: request.uri,
        status: 200,
        data: resp.data,
        meta: { source: "frankfurter", fetchedAt: Date.now(), cached: false, latencyMs: Date.now() - start, nodeId: SOVEREIGN_NODE_ID },
      };
    } catch { }
  }

  if (domain === "health") {
    const internalSrc = dataSources.get("system-health");
    if (internalSrc) {
      const data = await fetchInternalSource(internalSrc);
      return {
        uri: request.uri,
        status: 200,
        data,
        meta: { source: "internal-health", fetchedAt: Date.now(), cached: false, latencyMs: Date.now() - start, nodeId: SOVEREIGN_NODE_ID },
      };
    }
  }

  const staleCached = dataCache.get(domain);
  if (staleCached && staleCached.data) {
    return {
      uri: request.uri,
      status: 200,
      data: staleCached.data,
      meta: { source: domain, fetchedAt: staleCached.fetchedAt, cached: true, latencyMs: Date.now() - start, nodeId: SOVEREIGN_NODE_ID },
    };
  }

  return {
    uri: request.uri,
    status: 404,
    data: { error: `No handler for tess://${domain}`, availableDomains: Array.from(dataSources.keys()) },
    meta: { source: "resolver", fetchedAt: Date.now(), cached: false, latencyMs: Date.now() - start, nodeId: SOVEREIGN_NODE_ID },
  };
}

let pipelineInterval: ReturnType<typeof setInterval> | null = null;

export function startSovereignPipeline() {
  if (pipelineInterval) return;
  initSources();

  const staggerInit = async () => {
    for (const [id, source] of dataSources) {
      if (!source.active) continue;
      try {
        if (source.protocol === "http") {
          await fetchHTTPSource(source);
          if (source.url.includes("coingecko")) await new Promise(r => setTimeout(r, 12000));
        } else if (source.protocol === "internal") {
          await fetchInternalSource(source);
        }
      } catch (err: any) {
        plog(`Init fetch error for ${id}: ${err.message}`);
      }
    }
    plog(`Initial fetch complete — ${dataCache.size} sources cached`);
  };
  setTimeout(() => staggerInit(), 5000);

  pipelineInterval = setInterval(async () => {
    const now = Date.now();
    for (const [id, source] of dataSources) {
      if (!source.active) continue;
      if (now - source.lastFetched < source.refreshIntervalMs) continue;
      try {
        if (source.protocol === "http") {
          await fetchHTTPSource(source);
          if (source.url.includes("coingecko")) await new Promise(r => setTimeout(r, 8000));
        } else if (source.protocol === "internal") {
          await fetchInternalSource(source);
        }
      } catch (err: any) {
        plog(`Pipeline fetch error for ${id}: ${err.message}`);
      }
    }
  }, 20000);

  plog(`Sovereign data pipeline ACTIVE — ${dataSources.size} sources, node ${SOVEREIGN_NODE_ID}`);
  logActivity("sovereign-pipeline", "Sovereign data pipeline activated", "system");
}

export function registerSovereignPipelineRoutes(app: Express) {
  app.get("/api/sov-pipeline/status", (_req: Request, res: Response) => {
    const sources = Array.from(dataSources.values()).map(s => ({
      id: s.id,
      name: s.name,
      protocol: s.protocol,
      category: s.category,
      active: s.active,
      lastFetched: s.lastFetched,
      fetchCount: s.fetchCount,
      successCount: s.successCount,
      failCount: s.failCount,
      lastError: s.lastError,
      hasData: s.lastData !== null,
    }));
    const totalFetches = sources.reduce((s, d) => s + d.fetchCount, 0);
    const totalSuccess = sources.reduce((s, d) => s + d.successCount, 0);
    res.json({
      nodeId: SOVEREIGN_NODE_ID,
      status: "ACTIVE",
      sources,
      totalSources: sources.length,
      cacheEntries: dataCache.size,
      totalFetches,
      totalSuccess,
      successRate: totalFetches > 0 ? `${((totalSuccess / totalFetches) * 100).toFixed(1)}%` : "N/A",
      uptime: process.uptime(),
    });
  });

  app.post("/api/sov-pipeline/tess-resolve", async (req: Request, res: Response) => {
    const { uri, method, params } = req.body;
    if (!uri) return res.status(400).json({ error: "uri required (e.g. tess://sol-price)" });
    const result = await resolveTessProtocol({ uri, method: method || "GET", params });
    res.json(result);
  });

  app.get("/api/sov-pipeline/data/:sourceId", (req: Request, res: Response) => {
    const source = dataSources.get(req.params.sourceId);
    if (!source) return res.status(404).json({ error: "Source not found", available: Array.from(dataSources.keys()) });
    const cached = dataCache.get(source.id);
    res.json({
      source: { id: source.id, name: source.name, category: source.category },
      data: source.lastData,
      cached: cached ? { fetchedAt: cached.fetchedAt, ageMs: Date.now() - cached.fetchedAt, fresh: Date.now() - cached.fetchedAt < cached.ttlMs } : null,
      stats: { fetchCount: source.fetchCount, successCount: source.successCount, failCount: source.failCount },
    });
  });

  app.post("/api/sov-pipeline/source", (req: Request, res: Response) => {
    const { id, name, url, category, refreshIntervalMs, parser } = req.body;
    if (!id || !name || !url) return res.status(400).json({ error: "id, name, url required" });
    const protocol = url.startsWith("internal://") ? "internal" as const : "http" as const;
    const source: TessDataSource = {
      id, name, protocol, url,
      category: category || "custom",
      refreshIntervalMs: refreshIntervalMs || 60000,
      lastFetched: 0, lastData: null, lastError: null,
      fetchCount: 0, successCount: 0, failCount: 0,
      active: true,
      parser: parser || "json",
    };
    dataSources.set(id, source);
    plog(`Registered new data source: ${name} (${id})`);
    res.json({ success: true, source: { id, name, protocol, category: source.category } });
  });

  app.get("/api/sov-pipeline/live-feed", async (_req: Request, res: Response) => {
    const feed: any[] = [];
    for (const [id, source] of dataSources) {
      if (source.lastData && source.active) {
        feed.push({
          sourceId: id,
          sourceName: source.name,
          category: source.category,
          data: source.lastData,
          fetchedAt: source.lastFetched,
          ageSeconds: Math.round((Date.now() - source.lastFetched) / 1000),
        });
      }
    }
    res.json({
      nodeId: SOVEREIGN_NODE_ID,
      feedSize: feed.length,
      feed,
      generatedAt: Date.now(),
    });
  });

  startSovereignPipeline();
  plog("Sovereign pipeline routes registered");
}
