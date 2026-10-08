const DEX_ERROR_LOG_INTERVAL = 5 * 60 * 1000;
let lastDexErrorLog = 0;
let dexConsecutiveFailures = 0;
let dexNoDataCached = false;

const rlog = (m: string) => console.log(`[RealTSRT] ${m}`);
const rlogThrottled = (m: string) => {
  const now = Date.now();
  if (now - lastDexErrorLog >= DEX_ERROR_LOG_INTERVAL) {
    lastDexErrorLog = now;
    console.log(`[RealTSRT] ${m} (failures: ${dexConsecutiveFailures})`);
  }
};

export const TSRT_CONTRACT = "REDACTED";
export const TSRT_PAIR = "4XoCGkE6VGy9LL83vKnbGWtw2hUwtQmACdNb76XharQT";
export const JUPITER_BUY_URL = `https://jup.ag/swap/SOL-${TSRT_CONTRACT}`;
export const DEXSCREENER_URL = `https://jup.ag/swap/SOL-${TSRT_CONTRACT}`;
export const PUMPFUN_URL = `https://pump.fun/${TSRT_CONTRACT}`;
export const PUMPFUN_COIN_URL = `https://pump.fun/coin/${TSRT_CONTRACT}`;
export const COMMUNITY_WALLET = process.env.SOL_WALLET || "";
export const FATHER_WALLET = process.env.SOL_WALLET || "";
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

export interface TsrtLiveData {
  priceUsd: string;
  priceSol: string;
  volume24h: number;
  volumeH6: number;
  priceChangeH24: number;
  priceChangeH6: number;
  marketCap: number;
  fdv: number;
  buys24h: number;
  sells24h: number;
  buysH6: number;
  sellsH6: number;
  buysH1: number;
  sellsH1: number;
  pairAddress: string;
  dex: string;
  createdAt: number;
  fetchedAt: number;
  source: string;
  links: {
    jupiter: string;
    pumpfun: string;
    dexscreener?: string;
    pumpfunCoin?: string;
  };
}

export interface WalletBalance {
  address: string;
  label: string;
  lamports: number;
  sol: number;
  usdValue: number;
  tsrtBalance?: number;
  fetchedAt: number;
}

let cachedTsrtData: TsrtLiveData | null = null;
let lastFetch = 0;
const CACHE_TTL = 120000;

let cachedTokenBalances: Record<string, number> = {};
let lastTokenBalanceFetch = 0;
const TOKEN_BALANCE_CACHE_TTL = 180000;

async function fetchTsrtTokenBalance(walletAddress: string): Promise<number> {
  try {
    const tokenRes = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: TSRT_CONTRACT },
          { encoding: "jsonParsed" }
        ]
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData?.error) {
      if (!tokenData.error.message?.includes("could not find mint")) {
        rlog(`Token balance RPC error for ${walletAddress}: ${tokenData.error.message}`);
      }
      return cachedTokenBalances[walletAddress] || 0;
    }
    const accounts = tokenData?.result?.value || [];
    if (accounts.length > 0) {
      const balance = accounts[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
      cachedTokenBalances[walletAddress] = balance;
      return balance;
    }
    return 0;
  } catch (err: any) {
    rlog(`Token balance fetch error for ${walletAddress}: ${err?.message}`);
    return cachedTokenBalances[walletAddress] || 0;
  }
}

async function fetchAllTokenBalances(addresses: string[]): Promise<void> {
  const now = Date.now();
  if (now - lastTokenBalanceFetch < TOKEN_BALANCE_CACHE_TTL) return;
  lastTokenBalanceFetch = now;
  for (let i = 0; i < addresses.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 500));
    await fetchTsrtTokenBalance(addresses[i]);
  }
}

function buildTsrtDataFromPair(p: any, now: number): TsrtLiveData {
  return {
    priceUsd: p.priceUsd || "0",
    priceSol: p.priceNative || "0",
    volume24h: p.volume?.h24 || 0,
    volumeH6: p.volume?.h6 || 0,
    priceChangeH24: p.priceChange?.h24 || 0,
    priceChangeH6: p.priceChange?.h6 || 0,
    marketCap: p.marketCap || 0,
    fdv: p.fdv || 0,
    buys24h: p.txns?.h24?.buys || 0,
    sells24h: p.txns?.h24?.sells || 0,
    buysH6: p.txns?.h6?.buys || 0,
    sellsH6: p.txns?.h6?.sells || 0,
    buysH1: p.txns?.h1?.buys || 0,
    sellsH1: p.txns?.h1?.sells || 0,
    pairAddress: p.pairAddress || TSRT_PAIR,
    dex: p.dexId || "pumpfun",
    createdAt: p.pairCreatedAt || 0,
    fetchedAt: now,
    source: "geckoterminal",
    links: {
      jupiter: JUPITER_BUY_URL,
      pumpfun: PUMPFUN_URL,
    },
  };
}

async function fetchFromJupiterPrice(): Promise<TsrtLiveData | null> {
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${TSRT_CONTRACT}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      rlogThrottled(`Jupiter Price API HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const tokenData = (data as any)?.data?.[TSRT_CONTRACT];
    if (!tokenData?.price) return null;

    const priceUsd = tokenData.price.toString();
    const now = Date.now();
    return {
      priceUsd,
      priceSol: "0",
      volume24h: 0,
      volumeH6: 0,
      priceChangeH24: 0,
      priceChangeH6: 0,
      marketCap: parseFloat(priceUsd) * 1_000_000_000,
      fdv: parseFloat(priceUsd) * 1_000_000_000,
      buys24h: 0, sells24h: 0, buysH6: 0, sellsH6: 0, buysH1: 0, sellsH1: 0,
      pairAddress: TSRT_PAIR,
      dex: "jupiter",
      createdAt: 0,
      fetchedAt: now,
      source: "jupiter",
      links: { jupiter: JUPITER_BUY_URL, pumpfun: PUMPFUN_URL },
    };
  } catch (err: any) {
    rlogThrottled(`Jupiter Price API error: ${err?.message}`);
    return null;
  }
}

async function fetchFromGeckoTerminal(): Promise<TsrtLiveData | null> {
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${TSRT_PAIR}`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      rlogThrottled(`GeckoTerminal API HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const attrs = json?.data?.attributes;
    if (!attrs) return null;

    const priceUsd = attrs.base_token_price_usd || "0";
    const priceSol = attrs.base_token_price_native_currency || "0";
    const marketCap = parseFloat(attrs.market_cap_usd || attrs.fdv_usd || "0");
    const vol24h = parseFloat(attrs.volume_usd?.h24 || "0");
    const vol6h = parseFloat(attrs.volume_usd?.h6 || "0");
    const priceChange24h = parseFloat(attrs.price_change_percentage?.h24 || "0");
    const priceChange6h = parseFloat(attrs.price_change_percentage?.h6 || "0");

    const txns = attrs.transactions || {};
    const buys24h = (txns.h24?.buys || 0);
    const sells24h = (txns.h24?.sells || 0);
    const buys6h = (txns.h6?.buys || 0);
    const sells6h = (txns.h6?.sells || 0);
    const buys1h = (txns.h1?.buys || 0);
    const sells1h = (txns.h1?.sells || 0);

    const now = Date.now();
    return {
      priceUsd, priceSol,
      volume24h: vol24h, volumeH6: vol6h,
      priceChangeH24: priceChange24h, priceChangeH6: priceChange6h,
      marketCap, fdv: parseFloat(attrs.fdv_usd || "0") || marketCap,
      buys24h, sells24h, buysH6: buys6h, sellsH6: sells6h, buysH1: buys1h, sellsH1: sells1h,
      pairAddress: TSRT_PAIR, dex: attrs.dex_id || "raydium",
      createdAt: attrs.pool_created_at ? new Date(attrs.pool_created_at).getTime() : 0,
      fetchedAt: now, source: "geckoterminal",
      links: { jupiter: JUPITER_BUY_URL, dexscreener: DEXSCREENER_URL, pumpfun: PUMPFUN_URL, pumpfunCoin: PUMPFUN_COIN_URL },
    };
  } catch (err: any) {
    rlogThrottled(`GeckoTerminal error: ${err?.message}`);
    return null;
  }
}

async function fetchFromPumpFun(): Promise<TsrtLiveData | null> {
  try {
    const res = await fetch(`https://frontend-api.pump.fun/coins/${TSRT_CONTRACT}`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      rlogThrottled(`pump.fun API HTTP ${res.status}`);
      return null;
    }
    const coin = await res.json();
    if (!coin || !coin.mint) return null;

    const priceUsd = coin.usd_market_cap && coin.total_supply
      ? (coin.usd_market_cap / (coin.total_supply / 1e6)).toString()
      : "0";
    const marketCap = coin.usd_market_cap || 0;

    const now = Date.now();
    return {
      priceUsd,
      priceSol: coin.virtual_sol_reserves && coin.virtual_token_reserves
        ? ((coin.virtual_sol_reserves / 1e9) / (coin.virtual_token_reserves / 1e6)).toString()
        : "0",
      volume24h: 0,
      volumeH6: 0,
      priceChangeH24: 0,
      priceChangeH6: 0,
      marketCap,
      fdv: marketCap,
      buys24h: 0,
      sells24h: 0,
      buysH6: 0,
      sellsH6: 0,
      buysH1: 0,
      sellsH1: 0,
      pairAddress: TSRT_PAIR,
      dex: "pumpfun",
      createdAt: coin.created_timestamp || 0,
      fetchedAt: now,
      source: "pumpfun",
      links: {
        jupiter: JUPITER_BUY_URL,
        dexscreener: DEXSCREENER_URL,
        pumpfun: PUMPFUN_URL,
      },
    };
  } catch (err: any) {
    rlogThrottled(`pump.fun API error: ${err?.message}`);
    return null;
  }
}

export async function fetchTsrtLiveData(): Promise<TsrtLiveData> {
  const now = Date.now();

  const backoffMs = Math.min(30000 * Math.pow(2, dexConsecutiveFailures), 10 * 60 * 1000);
  const effectiveTTL = dexConsecutiveFailures > 0 ? Math.max(CACHE_TTL, backoffMs) : CACHE_TTL;

  if (cachedTsrtData && now - lastFetch < effectiveTTL) return cachedTsrtData;

  if (dexNoDataCached && cachedTsrtData && now - lastFetch < effectiveTTL) return cachedTsrtData;

  try {
    const jupiterData = await fetchFromJupiterPrice();
    if (jupiterData) {
      dexConsecutiveFailures = 0;
      dexNoDataCached = false;
      cachedTsrtData = jupiterData;
      lastFetch = now;
      rlog(`[Jupiter] Price: $${cachedTsrtData.priceUsd} | MCap: $${cachedTsrtData.marketCap}`);
      return cachedTsrtData;
    }

    rlogThrottled("Jupiter returned no data, trying GeckoTerminal fallback");
    const geckoData = await fetchFromGeckoTerminal();
    if (geckoData) {
      dexConsecutiveFailures = 0;
      dexNoDataCached = false;
      cachedTsrtData = geckoData;
      lastFetch = now;
      rlog(`[GeckoTerminal] Price: $${cachedTsrtData.priceUsd} | MCap: $${cachedTsrtData.marketCap}`);
      return cachedTsrtData;
    }

    rlogThrottled("GeckoTerminal returned no data, trying pump.fun fallback");
    const pumpData = await fetchFromPumpFun();
    if (pumpData) {
      dexConsecutiveFailures = 0;
      dexNoDataCached = false;
      cachedTsrtData = pumpData;
      lastFetch = now;
      rlog(`[pump.fun] Price: $${cachedTsrtData.priceUsd} | MCap: $${cachedTsrtData.marketCap}`);
      return cachedTsrtData;
    }

    dexConsecutiveFailures++;
    dexNoDataCached = true;
    lastFetch = now;
    rlogThrottled("All price sources returned no data");
    if (cachedTsrtData) return cachedTsrtData;
    throw new Error("No price data available from any source");
  } catch (err: any) {
    dexConsecutiveFailures++;
    lastFetch = now;
    rlogThrottled(`Fetch error: ${err?.message}`);
    if (cachedTsrtData) return cachedTsrtData;
    throw err;
  }
}

export async function fetchWalletBalances(): Promise<WalletBalance[]> {
  const wallets = [
    { address: COMMUNITY_WALLET, label: "Community Treasury" },
    { address: FATHER_WALLET, label: "Father ([SOVEREIGN])" },
  ];

  await fetchAllTokenBalances(wallets.map(w => w.address));

  let solPrice = 0;
  const solSources = [
    async () => { const r = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", { signal: AbortSignal.timeout(4000) }); const j = await r.json(); return (j as any)?.solana?.usd ?? 0; },
    async () => { const r = await fetch("https://price.jup.ag/v6/price?ids=SOL", { signal: AbortSignal.timeout(4000) }); const j = await r.json(); return (j as any)?.data?.SOL?.price ?? 0; },
  ];
  for (const src of solSources) {
    try { const p = await src(); if (p > 10 && p < 2000) { solPrice = p; break; } } catch {}
  }

  const results: WalletBalance[] = [];
  for (const wallet of wallets) {
    try {
      const res = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet.address] }),
      });
      const data = await res.json();
      const lamports = data?.result?.value || 0;
      const sol = lamports / 1_000_000_000;

      const tsrtBalance = cachedTokenBalances[wallet.address] || 0;
      results.push({ address: wallet.address, label: wallet.label, lamports, sol, usdValue: sol * solPrice, tsrtBalance, fetchedAt: Date.now() });
    } catch (err: any) {
      rlog(`Wallet fetch error for ${wallet.address}: ${err?.message}`);
      results.push({ address: wallet.address, label: wallet.label, lamports: 0, sol: 0, usdValue: 0, tsrtBalance: 0, fetchedAt: Date.now() });
    }
  }
  return results;
}

let cachedHolderCount: number | null = null;
let holderCountFetchedAt = 0;
const HOLDER_COUNT_TTL_MS = 10 * 60 * 1000;

export async function fetchLimnHolderCount(): Promise<number | null> {
  const now = Date.now();
  if (cachedHolderCount !== null && now - holderCountFetchedAt < HOLDER_COUNT_TTL_MS) {
    return cachedHolderCount;
  }

  try {
    const { fetchRealHolderCount } = await import("./defi-realification");
    const result = await fetchRealHolderCount(TSRT_CONTRACT);
    if (result.count !== null) {
      cachedHolderCount = result.count;
      holderCountFetchedAt = now;
      rlog(`Holder count fetched from ${result.source}: ${result.count}`);
      return result.count;
    }
  } catch (err: any) {
    rlog(`Holder count fetch error: ${err.message}`);
  }

  return cachedHolderCount;
}

let autoFetchInterval: ReturnType<typeof setInterval> | null = null;

export function startLimnAutoFetch(): void {
  if (autoFetchInterval) return;
  fetchTsrtLiveData().catch(() => {});
  fetchAllTokenBalances([COMMUNITY_WALLET, FATHER_WALLET]).catch(() => {});
  autoFetchInterval = setInterval(() => {
    fetchTsrtLiveData().catch(() => {});
    fetchAllTokenBalances([COMMUNITY_WALLET, FATHER_WALLET]).catch(() => {});
  }, 300000);
  rlog("Real TSRT auto-fetch started (every 5min from Jupiter/GeckoTerminal + token balances)");
}

rlog("Real TSRT data engine initialized");
