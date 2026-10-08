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

const TSRT_CONTRACT = "REDACTED";
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

async function fetchSovereignMarketData(tokenAddress: string): Promise<BirdeyeTokenData | null> {
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
      statusDetail: "Sovereign mode — using on-chain sources (Jupiter + GeckoTerminal)",
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

  data = await fetchSovereignMarketData(tokenAddress);

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
  return {
    holders: 0,
    source: "sovereign",
    statusDetail: "Sovereign mode — holder analytics sourced from on-chain data only.",
  };
}

export function getBirdeyeStatus(): BirdeyeStatus {
  const rateUsed = rateLimiter.requests.filter((t) => Date.now() - t < 60_000).length;
  return {
    configured: true,
    available: true,
    lastSuccessAt,
    failureCount: consecutiveFailures,
    statusMessage: `Sovereign mode — using on-chain sources (Jupiter + GeckoTerminal). Rate: ${rateUsed}/${rateLimiter.maxPerMinute} req/min`,
  };
}

blog("Sovereign Analytics initialized — using on-chain sources (Jupiter + GeckoTerminal)");
