import axios from "axios";
import { logger } from "./logger";
import { broadcast } from "./ws-broadcast";
import type { Express, Request, Response } from "express";

const cplog = (msg: string) => logger.info("SovCryptoPipeline", msg);

const TSRT_CONTRACT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";

const SOLANA_RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
];

export interface SovereignTokenData {
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
  source: "solana-rpc" | "jupiter-direct" | "geckoterminal-direct" | "dexscreener-direct" | "cache" | "unavailable";
  fetchedAt: string;
  rpcLatencyMs?: number;
  statusDetail?: string;
}

interface CacheEntry {
  data: SovereignTokenData;
  fetchedAt: number;
}

const tokenCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000;
const holderCache = new Map<string, { count: number; fetchedAt: number }>();
const HOLDER_CACHE_TTL_MS = 5 * 60 * 1000;

const pipelineStats = {
  totalFetches: 0,
  rpcFetches: 0,
  jupiterFetches: 0,
  geckoFetches: 0,
  dexscreenerFetches: 0,
  cacheHits: 0,
  failures: 0,
  avgLatencyMs: 0,
  lastFetch: 0,
};
let totalLatency = 0;

function getCached(address: string): SovereignTokenData | null {
  const entry = tokenCache.get(address);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    tokenCache.delete(address);
    return null;
  }
  return entry.data;
}

function setCache(address: string, data: SovereignTokenData): void {
  tokenCache.set(address, { data, fetchedAt: Date.now() });
  if (tokenCache.size > 200) {
    const oldest = Array.from(tokenCache.entries()).sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) tokenCache.delete(oldest[0]);
  }
}

async function rpcCall(endpoint: string, method: string, params: any[]): Promise<any | null> {
  try {
    const resp = await axios.post(
      endpoint,
      { jsonrpc: "2.0", id: 1, method, params },
      { timeout: 8000, headers: { "Content-Type": "application/json" } }
    );
    return resp.data?.result ?? null;
  } catch {
    return null;
  }
}

async function getSolanaRpcEndpoint(): Promise<string> {
  for (const endpoint of SOLANA_RPC_ENDPOINTS) {
    const result = await rpcCall(endpoint, "getHealth", []);
    if (result === "ok" || result !== null) return endpoint;
  }
  return SOLANA_RPC_ENDPOINTS[0];
}

async function fetchTokenAccountsFromRpc(tokenMint: string, rpcEndpoint: string): Promise<number> {
  try {
    const result = await rpcCall(rpcEndpoint, "getTokenSupply", [tokenMint]);
    if (!result) return 0;

    const holderResult = await rpcCall(rpcEndpoint, "getTokenLargestAccounts", [tokenMint]);
    if (holderResult?.value) {
      return holderResult.value.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function fetchTokenSupplyFromRpc(tokenMint: string, rpcEndpoint: string): Promise<{
  supply: number;
  decimals: number;
} | null> {
  const result = await rpcCall(rpcEndpoint, "getTokenSupply", [tokenMint]);
  if (!result) return null;
  return {
    supply: parseFloat(result.value?.uiAmount || "0"),
    decimals: result.value?.decimals || 9,
  };
}

async function fetchPriceFromJupiterDirect(tokenMint: string): Promise<{
  price: number;
  extraInfo?: any;
} | null> {
  try {
    const resp = await axios.get(
      `https://api.jup.ag/price/v2?ids=${tokenMint}&showExtraInfo=true`,
      { timeout: 6000 }
    );
    const tokenData = resp.data?.data?.[tokenMint];
    if (!tokenData) return null;
    return {
      price: parseFloat(tokenData.price || "0"),
      extraInfo: tokenData.extraInfo,
    };
  } catch {
    return null;
  }
}

async function fetchFromGeckoTerminalDirect(tokenMint: string): Promise<Partial<SovereignTokenData> | null> {
  try {
    const [tokenResp, poolsResp] = await Promise.allSettled([
      axios.get(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${tokenMint}`, {
        headers: { accept: "application/json" },
        timeout: 6000,
      }),
      axios.get(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${tokenMint}/pools?page=1`, {
        headers: { accept: "application/json" },
        timeout: 6000,
      }),
    ]);

    const tokenAttrs = tokenResp.status === "fulfilled"
      ? tokenResp.value.data?.data?.attributes
      : null;
    const pools = poolsResp.status === "fulfilled"
      ? poolsResp.value.data?.data?.slice(0, 3)
      : [];

    if (!tokenAttrs) return null;

    let volume24h = parseFloat(tokenAttrs.volume_usd?.h24 || "0");
    let liquidity = 0;
    let buys24h = parseInt(tokenAttrs.transactions?.h24?.buys || "0");
    let sells24h = parseInt(tokenAttrs.transactions?.h24?.sells || "0");
    let trades24h = buys24h + sells24h;

    if (pools && pools.length > 0) {
      liquidity = pools.reduce((sum: number, p: any) => sum + parseFloat(p.attributes?.reserve_in_usd || "0"), 0);
    }

    return {
      symbol: tokenAttrs.symbol || "TSRT",
      name: tokenAttrs.name || "Tessera Sovereign",
      price: parseFloat(tokenAttrs.price_usd || "0"),
      priceChange24h: parseFloat(tokenAttrs.price_change_percentage?.h24 || "0"),
      volume24h,
      marketCap: parseFloat(tokenAttrs.market_cap_usd || "0") || 0,
      liquidity,
      fdv: parseFloat(tokenAttrs.fdv_usd || "0") || 0,
      buys24h,
      sells24h,
      trades24h,
      source: "geckoterminal-direct" as const,
    };
  } catch {
    return null;
  }
}

async function fetchFromDexScreenerDirect(tokenMint: string): Promise<Partial<SovereignTokenData> | null> {
  try {
    const resp = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`,
      { timeout: 6000, headers: { accept: "application/json" } }
    );
    const pair = resp.data?.pairs?.[0];
    if (!pair) return null;

    return {
      symbol: pair.baseToken?.symbol || "TSRT",
      name: pair.baseToken?.name || "Tessera Sovereign",
      price: parseFloat(pair.priceUsd || "0"),
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      marketCap: pair.marketCap || 0,
      liquidity: pair.liquidity?.usd || 0,
      fdv: pair.fdv || 0,
      buys24h: pair.txns?.h24?.buys || 0,
      sells24h: pair.txns?.h24?.sells || 0,
      trades24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      source: "dexscreener-direct" as const,
    };
  } catch {
    return null;
  }
}

export async function fetchSovereignTokenData(tokenAddress: string = TSRT_CONTRACT): Promise<SovereignTokenData> {
  const start = Date.now();

  const cached = getCached(tokenAddress);
  if (cached) {
    pipelineStats.cacheHits++;
    return { ...cached, source: "cache" };
  }

  pipelineStats.totalFetches++;
  pipelineStats.lastFetch = Date.now();

  let price = 0;
  let priceChange24h = 0;
  let volume24h = 0;
  let marketCap = 0;
  let liquidity = 0;
  let fdv = 0;
  let buys24h = 0;
  let sells24h = 0;
  let trades24h = 0;
  let symbol = "TSRT";
  let name = "Tessera Sovereign";
  let source: SovereignTokenData["source"] = "unavailable";

  let rpcData: { supply: number; decimals: number } | null = null;
  let holderCount = 0;

  try {
    const rpcEndpoint = await getSolanaRpcEndpoint();
    rpcData = await fetchTokenSupplyFromRpc(tokenAddress, rpcEndpoint);

    const cachedHolders = holderCache.get(tokenAddress);
    if (cachedHolders && Date.now() - cachedHolders.fetchedAt < HOLDER_CACHE_TTL_MS) {
      holderCount = cachedHolders.count;
    } else {
      holderCount = await fetchTokenAccountsFromRpc(tokenAddress, rpcEndpoint);
      holderCache.set(tokenAddress, { count: holderCount, fetchedAt: Date.now() });
    }
    pipelineStats.rpcFetches++;

    if (rpcData && rpcData.supply > 0) {
      source = "solana-rpc";
    }
  } catch {}

  if (source !== "solana-rpc" || price === 0) {
    const jupData = await fetchPriceFromJupiterDirect(tokenAddress).catch(() => null);
    if (jupData?.price) {
      price = jupData.price;
      if (source === "unavailable") source = "jupiter-direct";
      pipelineStats.jupiterFetches++;
    }

    if (!price || volume24h === 0) {
      const geckoData = await fetchFromGeckoTerminalDirect(tokenAddress).catch(() => null);
      if (geckoData) {
        if (!price && geckoData.price) price = geckoData.price;
        priceChange24h = geckoData.priceChange24h || priceChange24h;
        volume24h = geckoData.volume24h || volume24h;
        marketCap = geckoData.marketCap || marketCap;
        liquidity = geckoData.liquidity || liquidity;
        fdv = geckoData.fdv || fdv;
        buys24h = geckoData.buys24h || buys24h;
        sells24h = geckoData.sells24h || sells24h;
        trades24h = geckoData.trades24h || trades24h;
        symbol = geckoData.symbol || symbol;
        name = geckoData.name || name;
        if (source === "unavailable" || source === "solana-rpc") source = "geckoterminal-direct";
        pipelineStats.geckoFetches++;
      }

      if (!price) {
        const dexData = await fetchFromDexScreenerDirect(tokenAddress).catch(() => null);
        if (dexData) {
          price = dexData.price || 0;
          priceChange24h = priceChange24h || dexData.priceChange24h || 0;
          volume24h = volume24h || dexData.volume24h || 0;
          marketCap = marketCap || dexData.marketCap || 0;
          liquidity = liquidity || dexData.liquidity || 0;
          fdv = fdv || dexData.fdv || 0;
          buys24h = buys24h || dexData.buys24h || 0;
          sells24h = sells24h || dexData.sells24h || 0;
          trades24h = trades24h || dexData.trades24h || 0;
          symbol = symbol || dexData.symbol || "TSRT";
          name = name || dexData.name || "Tessera Sovereign";
          if (source === "unavailable") source = "dexscreener-direct";
          pipelineStats.dexscreenerFetches++;
        }
      }
    }
  }

  if (rpcData && rpcData.supply > 0 && price > 0) {
    const circulatingSupply = rpcData.supply;
    if (!marketCap) marketCap = price * circulatingSupply;
    if (!fdv) fdv = price * circulatingSupply;
    source = "solana-rpc";
  }

  const latencyMs = Date.now() - start;
  totalLatency += latencyMs;
  pipelineStats.avgLatencyMs = Math.round(totalLatency / pipelineStats.totalFetches);

  const result: SovereignTokenData = {
    address: tokenAddress,
    symbol,
    name,
    price,
    priceChange24h,
    volume24h,
    marketCap,
    liquidity,
    holders: holderCount || 0,
    trades24h,
    buys24h,
    sells24h,
    uniqueWallets24h: 0,
    fdv,
    source,
    fetchedAt: new Date().toISOString(),
    rpcLatencyMs: latencyMs,
    statusDetail: source === "unavailable"
      ? "All sovereign data sources temporarily unavailable"
      : `Sovereign pipeline: ${source} (${latencyMs}ms, no external API key required)`,
  };

  if (price > 0 || marketCap > 0) {
    setCache(tokenAddress, result);
  }

  broadcast("crypto", "token_update", { tokenAddress, data: result });

  return result;
}

export async function getSolanaTokenInfo(tokenMint: string): Promise<{
  supply: number;
  decimals: number;
  mintAuthority: string | null;
  isInitialized: boolean;
} | null> {
  try {
    const rpcEndpoint = await getSolanaRpcEndpoint();
    const result = await rpcCall(rpcEndpoint, "getTokenSupply", [tokenMint]);
    if (!result) return null;
    return {
      supply: parseFloat(result.value?.uiAmount || "0"),
      decimals: result.value?.decimals || 9,
      mintAuthority: null,
      isInitialized: true,
    };
  } catch {
    return null;
  }
}

export async function getSolanaSlot(): Promise<number> {
  try {
    const rpcEndpoint = await getSolanaRpcEndpoint();
    const result = await rpcCall(rpcEndpoint, "getSlot", [{ commitment: "finalized" }]);
    return result || 0;
  } catch {
    return 0;
  }
}

export function getPipelineStats() {
  return { ...pipelineStats };
}

export function registerSovereignCryptoRoutes(app: Express): void {
  app.get("/api/sovereign/crypto/token/:address", async (req: Request, res: Response) => {
    const { address } = req.params;
    const data = await fetchSovereignTokenData(address);
    res.json(data);
  });

  app.get("/api/sovereign/crypto/tsrt", async (_req: Request, res: Response) => {
    const data = await fetchSovereignTokenData(TSRT_CONTRACT);
    res.json(data);
  });

  app.get("/api/sovereign/crypto/solana/slot", async (_req: Request, res: Response) => {
    const slot = await getSolanaSlot();
    res.json({ slot, fetchedAt: new Date().toISOString() });
  });

  app.get("/api/sovereign/crypto/solana/token/:mint", async (req: Request, res: Response) => {
    const info = await getSolanaTokenInfo(req.params.mint);
    if (!info) return res.status(404).json({ error: "Token info unavailable" });
    res.json(info);
  });

  app.get("/api/sovereign/crypto/pipeline/stats", (_req: Request, res: Response) => {
    res.json(getPipelineStats());
  });

  cplog("Sovereign crypto pipeline routes registered");
}

setInterval(async () => {
  try {
    await fetchSovereignTokenData(TSRT_CONTRACT);
  } catch {}
}, 2 * 60 * 1000);

cplog(`Sovereign Crypto Pipeline initialized — direct Solana RPC + Jupiter + GeckoTerminal + DexScreener (no API keys required)`);
