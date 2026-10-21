import axios from "axios";
import { logger } from "./logger";

const blog = (msg: string) => logger.info("Birdeye", msg);

export interface BirdeyeTokenData {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  trades24h: number;
  buys24h: number;
  sells24h: number;
  uniqueWallets24h: number;
  fdv: number;
  source: "birdeye" | "fallback" | "unavailable";
  fetchedAt: string;
  statusDetail?: string;
}

export interface BirdeyeStatus {
  configured: boolean;
  available: boolean;
  lastSuccessAt: string | null;
  failureCount: number;
  statusMessage: string;
}

const TSRT_CONTRACT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const BIRDEYE_BASE_URL = "https://public-api.birdeye.so";
const CACHE_TTL_MS = 5 * 60 * 1000;

const tokenCache = new Map<string, { data: BirdeyeTokenData; fetchedAt: number }>();

let consecutiveFailures = 0;
let lastSuccessAt: string | null = null;

const rateLimiter = {
  requests: [] as number[],
  maxPerMinute: 30,
  canFetch(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < 60_000);
    return this.requests.length < this.maxPerMinute;
  },
  record(): void {
    this.requests.push(Date.now());
  },
};

function getBirdeyeKey(): string | null {
  return process.env.BIRDEYE_API_KEY || null;
}

function isBirdeyeConfigured(): boolean {
  return !!getBirdeyeKey();
}

function getCached(tokenAddress: string): BirdeyeTokenData | null {
  const entry = tokenCache.get(tokenAddress);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    tokenCache.delete(tokenAddress);
    return null;
  }
  return entry.data;
}

function setCache(tokenAddress: string, data: BirdeyeTokenData): void {
  tokenCache.set(tokenAddress, { data, fetchedAt: Date.now() });
  if (tokenCache.size > 100) {
    const oldest = Array.from(tokenCache.entries()).sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) tokenCache.delete(oldest[0]);
  }
}

async function fetchFromBirdeye(tokenAddress: string): Promise<BirdeyeTokenData | null> {
  const apiKey = getBirdeyeKey();
  if (!apiKey) return null;

  if (!rateLimiter.canFetch()) {
    blog(`Rate limit reached (${rateLimiter.maxPerMinute} req/min) — using cache/fallback`);
    return null;
  }

  try {
    rateLimiter.record();
    const [overviewResp, tradeDataResp] = await Promise.allSettled([
      axios.get(`${BIRDEYE_BASE_URL}/defi/token_overview`, {
        params: { address: tokenAddress },
        headers: { "X-API-KEY": apiKey, accept: "application/json" },
        timeout: 8000,
      }),
      axios.get(`${BIRDEYE_BASE_URL}/defi/v3/token/trade-data/single`, {
        params: { address: tokenAddress, type: "24h" },
        headers: { "X-API-KEY": apiKey, accept: "application/json" },
        timeout: 8000,
      }),
    ]);

    const overview = overviewResp.status === "fulfilled" ? overviewResp.value.data?.data : null;
    const tradeData = tradeDataResp.status === "fulfilled" ? tradeDataResp.value.data?.data : null;

    if (!overview) {
      blog(`Birdeye overview fetch failed or no data`);
      return null;
    }

    const result: BirdeyeTokenData = {
      address: tokenAddress,
      symbol: overview.symbol || "TSRT",
      name: overview.name || "Tessera Sovereign",
      price: overview.price || 0,
      priceChange24h: overview.priceChange24hPercent || 0,
      volume24h: overview.v24hUSD || 0,
      marketCap: overview.mc || 0,
      liquidity: overview.liquidity || 0,
      holders: overview.holder || 0,
      trades24h: tradeData?.trade24h || 0,
      buys24h: tradeData?.buy24h || 0,
      sells24h: tradeData?.sell24h || 0,
      uniqueWallets24h: tradeData?.uniqueWallet24h || 0,
      fdv: overview.fdv || 0,
      source: "birdeye",
      fetchedAt: new Date().toISOString(),
    };

    consecutiveFailures = 0;
    lastSuccessAt = new Date().toISOString();
    blog(`Birdeye data fetched: price=$${result.price}, holders=${result.holders}, vol24h=$${result.volume24h}`);
    return result;
  } catch (err: any) {
    consecutiveFailures++;
    blog(`Birdeye API error: ${err.message} (failures: ${consecutiveFailures})`);
    return null;
  }
}

async function fetchFallbackMarketData(tokenAddress: string): Promise<BirdeyeTokenData | null> {
  if (!rateLimiter.canFetch()) {
    blog(`Rate limit reached — returning unavailable for fallback fetch`);
    return null;
  }

  try {
    rateLimiter.record();
    const [jupResp, geckoResp] = await Promise.allSettled([
      axios.get(`https://api.jup.ag/price/v2?ids=${tokenAddress}`, { timeout: 6000 }),
      axios.get(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${tokenAddress}`, {
        headers: { accept: "application/json" },
        timeout: 6000,
      }),
    ]);

    const jupData = jupResp.status === "fulfilled" ? jupResp.value.data?.data?.[tokenAddress] : null;
    const geckoData = geckoResp.status === "fulfilled" ? geckoResp.value.data?.data?.attributes : null;

    const price = parseFloat(jupData?.price || geckoData?.price_usd || "0");
    const marketCap = parseFloat(geckoData?.fdv_usd || geckoData?.market_cap_usd || "0") ||
      (price * 1_000_000_000);

    return {
      address: tokenAddress,
      symbol: geckoData?.symbol || "TSRT",
      name: geckoData?.name || "Tessera Sovereign",
      price,
      priceChange24h: parseFloat(geckoData?.price_change_percentage?.h24 || "0"),
      volume24h: parseFloat(geckoData?.volume_usd?.h24 || "0"),
      marketCap,
      liquidity: 0,
      holders: 0,
      trades24h: 0,
      buys24h: parseInt(geckoData?.transactions?.h24?.buys || "0"),
      sells24h: parseInt(geckoData?.transactions?.h24?.sells || "0"),
      uniqueWallets24h: 0,
      fdv: parseFloat(geckoData?.fdv_usd || "0") || marketCap,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      statusDetail: "Birdeye API key not configured — using public fallback sources (Jupiter + GeckoTerminal)",
    };
  } catch (err: any) {
    blog(`Fallback market data fetch failed: ${err.message}`);
    return null;
  }
}

export async function getTokenAnalytics(tokenAddress: string = TSRT_CONTRACT): Promise<BirdeyeTokenData> {
  const cached = getCached(tokenAddress);
  if (cached) return cached;

  let data: BirdeyeTokenData | null = null;

  if (isBirdeyeConfigured()) {
    data = await fetchFromBirdeye(tokenAddress);
  }

  if (!data) {
    data = await fetchFallbackMarketData(tokenAddress);
  }

  if (!data) {
    const unavailable: BirdeyeTokenData = {
      address: tokenAddress,
      symbol: "TSRT",
      name: "Tessera Sovereign",
      price: 0,
      priceChange24h: 0,
      volume24h: 0,
      marketCap: 0,
      liquidity: 0,
      holders: 0,
      trades24h: 0,
      buys24h: 0,
      sells24h: 0,
      uniqueWallets24h: 0,
      fdv: 0,
      source: "unavailable",
      fetchedAt: new Date().toISOString(),
      statusDetail: "All market data sources temporarily unavailable. Check network connectivity.",
    };
    return unavailable;
  }

  setCache(tokenAddress, data);
  return data;
}

export async function getHolderAnalytics(tokenAddress: string = TSRT_CONTRACT): Promise<{
  holders: number;
  topHolders?: Array<{ address: string; amount: number; percentage: number }>;
  source: string;
  statusDetail?: string;
}> {
  const apiKey = getBirdeyeKey();

  if (!apiKey) {
    return {
      holders: 0,
      source: "unavailable",
      statusDetail: "Birdeye API key required for holder analytics. Set BIRDEYE_API_KEY environment variable.",
    };
  }

  if (!rateLimiter.canFetch()) {
    return {
      holders: 0,
      source: "rate-limited",
      statusDetail: "Request rate limit reached — please retry in a moment.",
    };
  }

  try {
    rateLimiter.record();
    const resp = await axios.get(`${BIRDEYE_BASE_URL}/defi/v3/token/holder`, {
      params: { address: tokenAddress, offset: 0, limit: 10 },
      headers: { "X-API-KEY": apiKey, accept: "application/json" },
      timeout: 8000,
    });

    const data = resp.data?.data;
    if (!data) return { holders: 0, source: "birdeye", statusDetail: "No holder data returned" };

    return {
      holders: data.total || 0,
      topHolders: (data.items || []).map((h: any) => ({
        address: h.address,
        amount: h.uiAmount || 0,
        percentage: h.percentage || 0,
      })),
      source: "birdeye",
    };
  } catch (err: any) {
    blog(`Holder analytics error: ${err.message}`);
    return {
      holders: 0,
      source: "error",
      statusDetail: `Holder analytics temporarily unavailable: ${err.message}`,
    };
  }
}

export function getBirdeyeStatus(): BirdeyeStatus {
  const configured = isBirdeyeConfigured();
  const rateUsed = rateLimiter.requests.filter((t) => Date.now() - t < 60_000).length;
  return {
    configured,
    available: configured && consecutiveFailures < 5,
    lastSuccessAt,
    failureCount: consecutiveFailures,
    statusMessage: !configured
      ? "Birdeye API not configured — set BIRDEYE_API_KEY environment variable to enable deep analytics. Currently using free fallback sources (Jupiter + GeckoTerminal)."
      : consecutiveFailures >= 5
      ? "Birdeye API experiencing issues — using fallback sources"
      : consecutiveFailures > 0
      ? `Birdeye API: ${consecutiveFailures} recent failure(s), retrying (rate: ${rateUsed}/${rateLimiter.maxPerMinute} req/min)`
      : `Birdeye API: operational (rate: ${rateUsed}/${rateLimiter.maxPerMinute} req/min)`,
  };
}

blog("Birdeye Analytics initialized — will use Birdeye if BIRDEYE_API_KEY configured, otherwise falls back to public APIs");
