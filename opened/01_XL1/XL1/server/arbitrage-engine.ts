import { Connection, Keypair, VersionedTransaction, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import { getKeypair as getCentralKeypair } from "./sol-wallet";

const FATHER_WALLET = process.env.SOL_WALLET || "";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const DEXSCREENER_API = "https://api.jup.ag/price/v2";
const RAYDIUM_QUOTE_API = "https://transaction-v1.raydium.io/compute/swap-base-in";
const RAYDIUM_SWAP_API = "https://transaction-v1.raydium.io/transaction/swap-base-in";
const RAYDIUM_POOLS_API = "https://api-v3.raydium.io/pools/info/list";
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";
const COINGECKO_API = "https://api.jup.ag/price/v2";
const POLYMARKET_API = "https://clob.polymarket.com";
const MIN_BALANCE_FOR_TRADE = 0.0005;

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const WIF_MINT = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const JTO_MINT = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL";
const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwRbHR9EbrhT";
const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const RNDR_MINT = "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof";
const RAY_MINT = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
const LIMN_MINT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";

const clog = (msg: string) => console.log(`[Arbitrage] ${msg}`);

const TRACKED_TOKENS: { symbol: string; mint: string; minLiquidity: number }[] = [
  { symbol: "SOL", mint: SOL_MINT, minLiquidity: 10000 },
  { symbol: "USDC", mint: USDC_MINT, minLiquidity: 50000 },
  { symbol: "USDT", mint: USDT_MINT, minLiquidity: 10000 },
  { symbol: "BONK", mint: BONK_MINT, minLiquidity: 5000 },
  { symbol: "WIF", mint: WIF_MINT, minLiquidity: 5000 },
  { symbol: "JTO", mint: JTO_MINT, minLiquidity: 3000 },
  { symbol: "PYTH", mint: PYTH_MINT, minLiquidity: 3000 },
  { symbol: "JUP", mint: JUP_MINT, minLiquidity: 5000 },
  { symbol: "RNDR", mint: RNDR_MINT, minLiquidity: 3000 },
  { symbol: "RAY", mint: RAY_MINT, minLiquidity: 2000 },
  { symbol: "TSRT", mint: LIMN_MINT, minLiquidity: 0 },
];

interface PriceSource {
  source: string;
  price: number;
  timestamp: number;
  liquidity?: number;
  volume24h?: number;
}

interface ArbitrageOpportunity {
  id: string;
  type: "cross-dex" | "triangular" | "statistical" | "polymarket" | "nft";
  tokenA: string;
  tokenB: string;
  mintA: string;
  mintB: string;
  buySource: string;
  sellSource: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  estimatedProfitSOL: number;
  estimatedProfitUSD: number;
  riskScore: number;
  sharpeRatio: number;
  confidence: number;
  amountIn: number;
  amountOut: number;
  route: string;
  timestamp: number;
  status: "detected" | "approved" | "executing" | "executed" | "failed" | "expired";
  txSignature?: string;
  actualProfitSOL?: number;
  actualProfitUSD?: number;
  executionTimeMs?: number;
  consensusResult?: { approved: boolean; votes: number; required: number };
}

interface RiskParameters {
  maxPositionPct: number;
  maxTradeSOL: number;
  minTradeSOL: number;
  minSpreadPct: number;
  maxSlippage: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxDailyLossPct: number;
  maxConcurrentTrades: number;
  cooldownMs: number;
  minLiquidity: number;
  minConfidence: number;
  targetSharpeRatio: number;
}

interface PortfolioState {
  walletBalanceSOL: number;
  allocatedSOL: number;
  availableSOL: number;
  totalProfitSOL: number;
  totalProfitUSD: number;
  totalLossSOL: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  winRate: number;
  avgProfitPerTrade: number;
  sharpeRatio: number;
  maxDrawdown: number;
  dailyPnL: number[];
  returns: number[];
}

interface StrategyLearning {
  strategyType: string;
  totalAttempts: number;
  successes: number;
  failures: number;
  totalProfitSOL: number;
  totalLossSOL: number;
  avgProfitPerTrade: number;
  avgSpreadAtEntry: number;
  successRate: number;
  weight: number;
  lastAdjusted: number;
  recentResults: Array<{ profit: number; spread: number; timestamp: number }>;
}

interface OpportunityLog {
  timestamp: number;
  type: string;
  found: number;
  filtered: number;
  approved: number;
  executed: number;
  profitSOL: number;
  details: string;
}

interface CompoundOpportunity {
  id: string;
  components: ArbitrageOpportunity[];
  combinedProfitSOL: number;
  combinedProfitUSD: number;
  route: string;
  timestamp: number;
  status: "detected" | "approved" | "executing" | "executed" | "failed";
}

interface LossLesson {
  timestamp: number;
  strategyType: string;
  lossSOL: number;
  spreadAtEntry: number;
  liquidityAtEntry: number;
  riskScore: number;
  confidence: number;
  cause: string;
  lesson: string;
  adjustmentApplied: string;
}

interface AllocationModel {
  baseAllocationPct: number;
  currentAllocationPct: number;
  maxAllocationPct: number;
  conservativeFloor: number;
  aggressiveCeiling: number;
  drawdownMultiplier: number;
  winStreakBonus: number;
  recentWins: number;
  recentLosses: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  lastAdjusted: number;
  volatilityEstimate: number;
}

let walletKeypair: Keypair | null = null;
let connection: Connection | null = null;
let engineRunning = false;
let scanInterval: NodeJS.Timeout | null = null;
let executeInterval: NodeJS.Timeout | null = null;
let priceCache: Map<string, PriceSource[]> = new Map();
let opportunities: ArbitrageOpportunity[] = [];
let executedTrades: ArbitrageOpportunity[] = [];
let pendingExecution: ArbitrageOpportunity[] = [];
let opportunityLogs: OpportunityLog[] = [];
let strategyLearning: Map<string, StrategyLearning> = new Map();
let compoundOpportunities: CompoundOpportunity[] = [];
let lossLessons: LossLesson[] = [];
let lastScanTime = 0;
let solPriceUSD = 170;
let engineStartTime = 0;

let allocation: AllocationModel = {
  baseAllocationPct: 0.50,
  currentAllocationPct: 0.50,
  maxAllocationPct: 0.85,
  conservativeFloor: 0.10,
  aggressiveCeiling: 0.85,
  drawdownMultiplier: 1.0,
  winStreakBonus: 0,
  recentWins: 0,
  recentLosses: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  lastAdjusted: Date.now(),
  volatilityEstimate: 0.02,
};

const STRATEGY_TYPES = ["cross-dex", "triangular", "statistical", "polymarket"];
for (const st of STRATEGY_TYPES) {
  strategyLearning.set(st, {
    strategyType: st,
    totalAttempts: 0,
    successes: 0,
    failures: 0,
    totalProfitSOL: 0,
    totalLossSOL: 0,
    avgProfitPerTrade: 0,
    avgSpreadAtEntry: 0,
    successRate: 0.5,
    weight: 1.0,
    lastAdjusted: Date.now(),
    recentResults: [],
  });
}

const STATE_FILE = "server/arbitrage-state.json";

let riskParams: RiskParameters = {
  maxPositionPct: 0.10,
  maxTradeSOL: 0.05,
  minTradeSOL: 0.0005,
  minSpreadPct: 0.15,
  maxSlippage: 2.5,
  stopLossPct: 2.0,
  takeProfitPct: 3.0,
  maxDailyLossPct: 5.0,
  maxConcurrentTrades: 3,
  cooldownMs: 8000,
  minLiquidity: 500,
  minConfidence: 0.50,
  targetSharpeRatio: 1.0,
};

let portfolio: PortfolioState = {
  walletBalanceSOL: 0,
  allocatedSOL: 0,
  availableSOL: 0,
  totalProfitSOL: 0,
  totalProfitUSD: 0,
  totalLossSOL: 0,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  winRate: 0,
  avgProfitPerTrade: 0,
  sharpeRatio: 0,
  maxDrawdown: 0,
  dailyPnL: [],
  returns: [],
};

function initWallet(): boolean {
  try {
    const central = getCentralKeypair();
    if (central) {
      walletKeypair = central;
      connection = new Connection(RPC_URL, "confirmed");
      clog(`Wallet loaded from central wallet: ${walletKeypair.publicKey.toBase58()}`);
      return true;
    }
    const key = process.env.SOL_PRIVATE_KEY;
    if (!key) { clog("No wallet available — arbitrage in scan-only mode"); return false; }
    if (key.startsWith("[")) {
      walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(key)));
    } else {
      walletKeypair = Keypair.fromSecretKey(bs58.decode(key));
    }
    connection = new Connection(RPC_URL, "confirmed");
    clog(`Wallet loaded: ${walletKeypair.publicKey.toBase58()}`);
    return true;
  } catch (err: any) {
    clog(`Wallet init error: ${err.message}`);
    return false;
  }
}

async function getWalletBalanceSOL(): Promise<number> {
  if (!connection || !walletKeypair) return 0;
  try {
    return (await connection.getBalance(walletKeypair.publicKey)) / LAMPORTS_PER_SOL;
  } catch { return 0; }
}

async function fetchSOLPrice(): Promise<number> {
  try {
    const res = await fetch(`${COINGECKO_API}/simple/price?ids=solana&vs_currencies=usd`, {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json() as any;
      solPriceUSD = data.solana?.usd || solPriceUSD;
    }
  } catch {}
  return solPriceUSD;
}

async function fetchDexScreenerPricesMulti(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  for (const mint of mints) {
    try {
      const token = TRACKED_TOKENS.find(t => t.mint === mint);
      const cacheKey = token?.symbol || mint;
      const cached = priceCache.get(cacheKey);
      if (cached && cached.length > 0 && Date.now() - cached[0].timestamp < 15000) {
        prices.set(mint, cached[0].price);
        continue;
      }
      const res = await fetch(`${DEXSCREENER_API}/tokens/${mint}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json() as any;
        const solPairs = (data.pairs || []).filter((p: any) => p.chainId === "solana");
        if (solPairs.length > 0) {
          const bestPair = solPairs.reduce((a: any, b: any) => (a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b);
          prices.set(mint, parseFloat(bestPair.priceUsd || "0"));
        }
      }
      await new Promise(r => setTimeout(r, 300));
    } catch {}
  }
  return prices;
}

async function fetchRaydiumQuote(inputMint: string, outputMint: string, amountLamports: number, slippageBps: number = 100): Promise<any | null> {
  try {
    const url = `${RAYDIUM_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&txVersion=V0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json() as any;
      if (data.success && data.data) return data.data;
    }
  } catch {}
  return null;
}

export async function fetchJupiterQuote(inputMint: string, outputMint: string, amountLamports: number, slippageBps: number = 100): Promise<any | null> {
  try {
    const url = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&onlyDirectRoutes=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json() as any;
      if (data && data.outAmount) return data;
    }
  } catch {}
  return null;
}

async function executeJupiterSwap(inputMint: string, outputMint: string, amountLamports: number, slippageBps: number = 100): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number }> {
  if (!walletKeypair || !connection) return { success: false, error: "Wallet not initialized" };

  try {
    const balance = await getWalletBalanceSOL();
    if (balance < MIN_BALANCE_FOR_TRADE) return { success: false, error: `Insufficient SOL: ${balance.toFixed(6)} (need ${MIN_BALANCE_FOR_TRADE})` };

    const quote = await fetchJupiterQuote(inputMint, outputMint, amountLamports, slippageBps);
    if (!quote) return { success: false, error: "Failed to get Jupiter quote" };

    const swapRes = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletKeypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: 1000,
        dynamicComputeUnitLimit: true,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!swapRes.ok) return { success: false, error: `Jupiter swap API ${swapRes.status}` };

    const swapData = await swapRes.json() as any;
    if (!swapData.swapTransaction) return { success: false, error: "No swap transaction from Jupiter" };

    const txBuf = Buffer.from(swapData.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([walletKeypair]);

    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: "confirmed",
    });

    const confirmation = await connection.confirmTransaction(sig, "confirmed");
    if (confirmation.value.err) {
      return { success: false, error: `TX failed: ${JSON.stringify(confirmation.value.err)}`, signature: sig };
    }

    clog(`Jupiter TX confirmed: ${sig}`);
    return { success: true, signature: sig, outAmount: parseInt(quote.outAmount || "0") };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function executeBestSwap(inputMint: string, outputMint: string, amountLamports: number, slippageBps: number = 100): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number; router: string }> {
  const [jupQuote, rayQuote] = await Promise.all([
    fetchJupiterQuote(inputMint, outputMint, amountLamports, slippageBps),
    fetchRaydiumQuote(inputMint, outputMint, amountLamports, slippageBps),
  ]);

  const jupOut = jupQuote ? parseInt(jupQuote.outAmount || "0") : 0;
  const rayOut = rayQuote ? parseInt(rayQuote.outputAmount || "0") : 0;

  if (jupOut === 0 && rayOut === 0) {
    return { success: false, error: "No quotes from Jupiter or Raydium", router: "none" };
  }

  if (jupOut >= rayOut) {
    clog(`Using Jupiter (out: ${jupOut} vs Raydium: ${rayOut})`);
    const result = await executeJupiterSwap(inputMint, outputMint, amountLamports, slippageBps);
    return { ...result, router: "jupiter" };
  } else {
    clog(`Using Raydium (out: ${rayOut} vs Jupiter: ${jupOut})`);
    const result = await executeRaydiumSwap(inputMint, outputMint, amountLamports, slippageBps);
    return { ...result, router: "raydium" };
  }
}

async function fetchDexScreenerPrices(tokenMint: string): Promise<PriceSource[]> {
  const sources: PriceSource[] = [];
  try {
    const res = await fetch(`${DEXSCREENER_API}/tokens/${tokenMint}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (data.pairs) {
        for (const pair of data.pairs.slice(0, 5)) {
          sources.push({
            source: `DexScreener-${pair.dexId || "unknown"}`,
            price: parseFloat(pair.priceUsd || "0"),
            timestamp: Date.now(),
            liquidity: pair.liquidity?.usd || 0,
            volume24h: pair.volume?.h24 || 0,
          });
        }
      }
    }
  } catch {}
  return sources;
}

async function fetchRaydiumPools(): Promise<Map<string, { price: number; liquidity: number }>> {
  const pools = new Map<string, { price: number; liquidity: number }>();
  try {
    const res = await fetch("https://api.raydium.io/v2/main/pairs", {
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (Array.isArray(data)) {
        for (const pool of data.slice(0, 200)) {
          if (pool.price && pool.liquidity) {
            pools.set(pool.name || pool.ammId, {
              price: parseFloat(pool.price),
              liquidity: parseFloat(pool.liquidity),
            });
          }
        }
      }
    }
  } catch {}
  return pools;
}

async function scanCrossDexArbitrage(): Promise<ArbitrageOpportunity[]> {
  const opps: ArbitrageOpportunity[] = [];
  const now = Date.now();

  for (const token of TRACKED_TOKENS) {
    if (token.mint === SOL_MINT || token.mint === USDC_MINT) continue;

    const dexPrices = await fetchDexScreenerPrices(token.mint);
    if (dexPrices.length < 2) continue;

    const allPrices: PriceSource[] = [...dexPrices];

    priceCache.set(token.symbol, allPrices);

    const validPrices = allPrices.filter(p => p.price > 0 && (p.liquidity === undefined || p.liquidity >= token.minLiquidity));
    if (validPrices.length < 2) continue;

    validPrices.sort((a, b) => a.price - b.price);
    const cheapest = validPrices[0];
    const expensive = validPrices[validPrices.length - 1];

    const spread = ((expensive.price - cheapest.price) / cheapest.price) * 100;

    if (spread >= riskParams.minSpreadPct) {
      const tradeAmount = calculateOptimalTradeSize(spread, cheapest.liquidity || 1000);
      const estimatedProfit = tradeAmount * (spread / 100) * 0.85;

      opps.push({
        id: `arb-${token.symbol}-${now}`,
        type: "cross-dex",
        tokenA: "SOL",
        tokenB: token.symbol,
        mintA: SOL_MINT,
        mintB: token.mint,
        buySource: cheapest.source,
        sellSource: expensive.source,
        buyPrice: cheapest.price,
        sellPrice: expensive.price,
        spreadPct: spread,
        estimatedProfitSOL: estimatedProfit,
        estimatedProfitUSD: estimatedProfit * solPriceUSD,
        riskScore: calculateRiskScore(spread, cheapest.liquidity || 0, token.minLiquidity),
        sharpeRatio: calculateSharpeRatio(estimatedProfit, tradeAmount),
        confidence: calculateConfidence(validPrices, spread, cheapest.liquidity || 0),
        amountIn: tradeAmount,
        amountOut: tradeAmount * (1 + spread / 100),
        route: `Buy ${token.symbol} on ${cheapest.source} → Sell on ${expensive.source}`,
        timestamp: now,
        status: "detected",
      });
    }
  }

  return opps;
}

async function scanTriangularArbitrage(): Promise<ArbitrageOpportunity[]> {
  const opps: ArbitrageOpportunity[] = [];
  const now = Date.now();

  const triangles = [
    { a: SOL_MINT, b: USDC_MINT, c: BONK_MINT, names: ["SOL", "USDC", "BONK"] },
    { a: SOL_MINT, b: USDC_MINT, c: JUP_MINT, names: ["SOL", "USDC", "JUP"] },
    { a: SOL_MINT, b: USDC_MINT, c: WIF_MINT, names: ["SOL", "USDC", "WIF"] },
    { a: SOL_MINT, b: USDC_MINT, c: RAY_MINT, names: ["SOL", "USDC", "RAY"] },
    { a: SOL_MINT, b: USDC_MINT, c: PYTH_MINT, names: ["SOL", "USDC", "PYTH"] },
    { a: SOL_MINT, b: USDC_MINT, c: JTO_MINT, names: ["SOL", "USDC", "JTO"] },
    { a: SOL_MINT, b: USDC_MINT, c: RNDR_MINT, names: ["SOL", "USDC", "RNDR"] },
  ];

  for (const tri of triangles) {
    try {
      const amountSOL = 0.01 * LAMPORTS_PER_SOL;

      const [quoteAB, quoteBC, quoteCA] = await Promise.all([
        fetchRaydiumQuote(tri.a, tri.b, amountSOL, 100),
        fetchRaydiumQuote(tri.b, tri.c, 1_000_000, 100),
        fetchRaydiumQuote(tri.c, tri.a, 1000000, 100),
      ]);

      if (!quoteAB || !quoteBC || !quoteCA) continue;

      const outAB = parseInt(quoteAB.outputAmount || "0");
      const outBC = parseInt(quoteBC.outputAmount || "0");
      const outCA = parseInt(quoteCA.outputAmount || "0");

      if (outAB === 0 || outBC === 0 || outCA === 0) continue;

      const ratioAB = outAB / 1_000_000;
      const effectiveReturnSOL = (outCA / LAMPORTS_PER_SOL) * ratioAB * (outBC / 1000000);

      const inputSOL = 0.01;
      const profit = effectiveReturnSOL - inputSOL;
      const spreadPct = (profit / inputSOL) * 100;

      if (spreadPct > 0.1) {
        const tradeAmount = calculateOptimalTradeSize(spreadPct, 5000);

        opps.push({
          id: `tri-${tri.names.join("-")}-${now}`,
          type: "triangular",
          tokenA: tri.names[0],
          tokenB: tri.names.join("→"),
          mintA: tri.a,
          mintB: tri.c,
          buySource: "Jupiter",
          sellSource: "Jupiter",
          buyPrice: inputSOL,
          sellPrice: effectiveReturnSOL,
          spreadPct,
          estimatedProfitSOL: profit * (tradeAmount / inputSOL),
          estimatedProfitUSD: profit * (tradeAmount / inputSOL) * solPriceUSD,
          riskScore: calculateRiskScore(spreadPct, 5000, 1000),
          sharpeRatio: calculateSharpeRatio(profit * (tradeAmount / inputSOL), tradeAmount),
          confidence: Math.min(0.9, spreadPct / 5),
          amountIn: tradeAmount,
          amountOut: tradeAmount * (1 + spreadPct / 100),
          route: `${tri.names[0]} → ${tri.names[1]} → ${tri.names[2]} → ${tri.names[0]}`,
          timestamp: now,
          status: "detected",
        });
      }
    } catch {}
  }

  return opps;
}

async function scanPolymarketArbitrage(): Promise<ArbitrageOpportunity[]> {
  const opps: ArbitrageOpportunity[] = [];
  try {
    const res = await fetch(`${POLYMARKET_API}/markets?limit=50&active=true`, {
      signal: AbortSignal.timeout(8000),
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return opps;

    const markets = await res.json() as any[];
    const now = Date.now();

    for (const market of (markets || []).slice(0, 30)) {
      if (!market.tokens || market.tokens.length < 2) continue;

      const prices = market.tokens.map((t: any) => parseFloat(t.price || "0"));
      const totalProb = prices.reduce((s: number, p: number) => s + p, 0);

      if (totalProb > 0 && Math.abs(totalProb - 1.0) > 0.02) {
        const mispricing = Math.abs(totalProb - 1.0) * 100;
        if (mispricing > 1) {
          opps.push({
            id: `poly-${market.condition_id?.slice(0, 8) || now}`,
            type: "polymarket",
            tokenA: "USDC",
            tokenB: market.question?.slice(0, 50) || "Unknown Market",
            mintA: USDC_MINT,
            mintB: USDC_MINT,
            buySource: "Polymarket",
            sellSource: "Polymarket",
            buyPrice: Math.min(...prices),
            sellPrice: Math.max(...prices),
            spreadPct: mispricing,
            estimatedProfitSOL: (mispricing / 100) * 0.01,
            estimatedProfitUSD: (mispricing / 100) * solPriceUSD * 0.01,
            riskScore: 6,
            sharpeRatio: mispricing > 3 ? 2.0 : 1.0,
            confidence: Math.min(0.8, mispricing / 10),
            amountIn: 0.01,
            amountOut: 0.01 * (1 + mispricing / 100),
            route: `Polymarket: ${market.question?.slice(0, 60) || "prediction market"}`,
            timestamp: now,
            status: "detected",
          });
        }
      }
    }
  } catch {}
  return opps;
}

async function scanStatisticalArbitrage(): Promise<ArbitrageOpportunity[]> {
  const opps: ArbitrageOpportunity[] = [];
  const now = Date.now();

  const correlatedPairs = [
    { a: { symbol: "JUP", mint: JUP_MINT }, b: { symbol: "RAY", mint: RAY_MINT }, correlation: 0.85 },
    { a: { symbol: "BONK", mint: BONK_MINT }, b: { symbol: "WIF", mint: WIF_MINT }, correlation: 0.78 },
    { a: { symbol: "JTO", mint: JTO_MINT }, b: { symbol: "PYTH", mint: PYTH_MINT }, correlation: 0.72 },
  ];

  const dexPrices = await fetchDexScreenerPricesMulti(correlatedPairs.flatMap(p => [p.a.mint, p.b.mint]));

  for (const pair of correlatedPairs) {
    const priceA = dexPrices.get(pair.a.mint);
    const priceB = dexPrices.get(pair.b.mint);
    if (!priceA || !priceB) continue;

    const ratio = priceA / priceB;
    const historicalRatio = priceA / priceB;
    const deviation = Math.abs(ratio - historicalRatio) / historicalRatio;

    const cachedA: PriceSource[] = priceCache.get(pair.a.symbol) || [];
    const cachedB: PriceSource[] = priceCache.get(pair.b.symbol) || [];

    if (cachedA.length > 0 && cachedB.length > 0) {
      const prevRatio = cachedA[0].price / cachedB[0].price;
      const currentRatio = priceA / priceB;
      const ratioChange = Math.abs((currentRatio - prevRatio) / prevRatio) * 100;

      if (ratioChange > 0.5) {
        const direction = currentRatio > prevRatio ? "long-B-short-A" : "long-A-short-B";
        const tradeAmount = calculateOptimalTradeSize(ratioChange, 3000);

        opps.push({
          id: `stat-${pair.a.symbol}-${pair.b.symbol}-${now}`,
          type: "statistical",
          tokenA: pair.a.symbol,
          tokenB: pair.b.symbol,
          mintA: pair.a.mint,
          mintB: pair.b.mint,
          buySource: "Jupiter",
          sellSource: "Jupiter",
          buyPrice: direction === "long-A-short-B" ? priceA : priceB,
          sellPrice: direction === "long-A-short-B" ? priceB : priceA,
          spreadPct: ratioChange,
          estimatedProfitSOL: tradeAmount * (ratioChange / 100) * 0.7,
          estimatedProfitUSD: tradeAmount * (ratioChange / 100) * 0.7 * solPriceUSD,
          riskScore: calculateRiskScore(ratioChange, 3000, 1000),
          sharpeRatio: calculateSharpeRatio(tradeAmount * (ratioChange / 100) * 0.7, tradeAmount),
          confidence: pair.correlation * Math.min(1, ratioChange / 2),
          amountIn: tradeAmount,
          amountOut: tradeAmount * (1 + ratioChange / 100),
          route: `Stat-arb: ${direction} (${pair.a.symbol}/${pair.b.symbol} ratio deviation)`,
          timestamp: now,
          status: "detected",
        });
      }
    }
  }

  return opps;
}

function calculateOptimalTradeSize(spreadPct: number, liquidity: number): number {
  const walletBal = portfolio.walletBalanceSOL || 0.01;
  const maxBySafety = walletBal * riskParams.maxPositionPct;
  const maxByLiquidity = (liquidity / solPriceUSD) * 0.01;
  const maxByConfig = riskParams.maxTradeSOL;

  let kelly = 0;
  const winProb = Math.min(0.85, 0.5 + spreadPct / 20);
  const avgWin = spreadPct / 100;
  const avgLoss = riskParams.stopLossPct / 100;
  if (avgLoss > 0) {
    kelly = (winProb * avgWin - (1 - winProb) * avgLoss) / avgWin;
    kelly = Math.max(0, Math.min(0.25, kelly));
  }

  const kellySize = walletBal * kelly;
  const optimalSize = Math.min(maxBySafety, maxByLiquidity, maxByConfig, kellySize || maxBySafety);

  return Math.max(riskParams.minTradeSOL, optimalSize);
}

function calculateRiskScore(spreadPct: number, liquidity: number, minLiquidity: number): number {
  let risk = 5;
  if (liquidity < minLiquidity * 2) risk += 2;
  if (liquidity < minLiquidity) risk += 3;
  if (spreadPct > 5) risk -= 1;
  if (spreadPct > 10) risk -= 1;
  if (spreadPct < 0.5) risk += 2;
  return Math.max(1, Math.min(10, risk));
}

function calculateSharpeRatio(expectedProfit: number, tradeSize: number): number {
  if (tradeSize <= 0) return 0;
  const returnPct = (expectedProfit / tradeSize) * 100;
  const riskFreeRate = 0.05;
  const volatility = 2.0;
  return (returnPct - riskFreeRate) / volatility;
}

function calculateConfidence(prices: PriceSource[], spread: number, liquidity: number): number {
  let conf = 0.5;
  if (prices.length >= 3) conf += 0.1;
  if (prices.length >= 5) conf += 0.1;
  if (spread > 1) conf += 0.1;
  if (spread > 3) conf += 0.1;
  if (liquidity > 10000) conf += 0.05;
  if (liquidity > 50000) conf += 0.05;
  return Math.min(0.95, conf);
}

function evaluateArbitrageVote(agentRole: string, opp: ArbitrageOpportunity): boolean {
  let score = 50;

  if (opp.spreadPct >= 0.5) score += 10;
  if (opp.spreadPct >= 1.0) score += 5;
  if (opp.spreadPct >= 3.0) score += 5;
  if (opp.spreadPct < 0.3) score -= 15;

  if (opp.estimatedProfitSOL > 0.001) score += 10;
  if (opp.estimatedProfitSOL > 0.01) score += 5;
  if (opp.estimatedProfitSOL <= 0) score -= 30;

  if (opp.riskScore <= 3) score += 10;
  if (opp.riskScore <= 5) score += 5;
  if (opp.riskScore >= 8) score -= 15;
  if (opp.riskScore >= 9) score -= 10;

  if (opp.sharpeRatio >= 1.5) score += 10;
  if (opp.sharpeRatio >= 1.0) score += 5;
  if (opp.sharpeRatio < 0.5) score -= 10;

  if (opp.confidence >= 0.7) score += 10;
  if (opp.confidence >= 0.5) score += 5;
  if (opp.confidence < 0.3) score -= 15;

  if (opp.amountIn > riskParams.maxTradeSOL) score -= 15;
  if (opp.amountIn <= riskParams.minTradeSOL) score -= 5;

  const dailyLoss = portfolio.totalLossSOL;
  const dailyLossLimit = portfolio.walletBalanceSOL * (riskParams.maxDailyLossPct / 100);
  if (dailyLoss > dailyLossLimit * 0.8) score -= 20;

  switch (agentRole) {
    case "risk-manager":
      if (opp.riskScore >= 7) score -= 15;
      if (opp.amountIn > riskParams.maxTradeSOL * 0.5) score -= 10;
      if (opp.confidence < 0.5) score -= 10;
      break;
    case "profit-seeker":
      if (opp.estimatedProfitSOL > 0.005) score += 10;
      if (opp.spreadPct > 2) score += 5;
      break;
    case "market-analyst":
      if (opp.sharpeRatio >= 1.0) score += 10;
      if (opp.type === "triangular") score += 5;
      if (opp.type === "statistical") score += 5;
      break;
  }

  return score >= 50;
}

async function requestArbitrageConsensus(opp: ArbitrageOpportunity): Promise<ArbitrageOpportunity> {
  try {
    const consensusEngine = await import("./swarm-consensus");
    const result = await consensusEngine.requestSwarmConsensus({
      type: "TRADE",
      description: `Arbitrage: ${opp.type} — ${opp.route} | Spread: ${opp.spreadPct.toFixed(2)}% | Est profit: ${opp.estimatedProfitSOL.toFixed(6)} SOL ($${opp.estimatedProfitUSD.toFixed(4)}) | Risk: ${opp.riskScore}/10 | Sharpe: ${opp.sharpeRatio.toFixed(2)} | Confidence: ${(opp.confidence * 100).toFixed(1)}%`,
      data: { 
        opportunityId: opp.id, type: opp.type, spread: opp.spreadPct,
        profit: opp.estimatedProfitSOL, risk: opp.riskScore, sharpe: opp.sharpeRatio,
        amountIn: opp.amountIn, route: opp.route 
      },
      urgency: opp.spreadPct > 2 ? "high" : "normal",
    });
    opp.consensusResult = { approved: result.approved, votes: result.votesFor, required: result.required };
    opp.status = result.approved ? "approved" : "detected";
    return opp;
  } catch {
    const agents: Array<{ name: string; role: string }> = [
      { name: "arb-risk-1", role: "risk-manager" },
      { name: "arb-risk-2", role: "risk-manager" },
      { name: "arb-risk-3", role: "risk-manager" },
      { name: "arb-profit-1", role: "profit-seeker" },
      { name: "arb-profit-2", role: "profit-seeker" },
      { name: "arb-profit-3", role: "profit-seeker" },
      { name: "arb-profit-4", role: "profit-seeker" },
      { name: "arb-analyst-1", role: "market-analyst" },
      { name: "arb-analyst-2", role: "market-analyst" },
      { name: "arb-analyst-3", role: "market-analyst" },
      { name: "arb-risk-4", role: "risk-manager" },
      { name: "arb-profit-5", role: "profit-seeker" },
      { name: "arb-analyst-4", role: "market-analyst" },
      { name: "arb-risk-5", role: "risk-manager" },
      { name: "arb-profit-6", role: "profit-seeker" },
      { name: "arb-analyst-5", role: "market-analyst" },
      { name: "arb-risk-6", role: "risk-manager" },
      { name: "arb-profit-7", role: "profit-seeker" },
      { name: "arb-analyst-6", role: "market-analyst" },
      { name: "arb-risk-7", role: "risk-manager" },
    ];
    let yesVotes = 0;
    for (const agent of agents) {
      if (evaluateArbitrageVote(agent.role, opp)) yesVotes++;
    }
    const required = Math.ceil(agents.length * 2 / 3);
    opp.consensusResult = { approved: yesVotes >= required, votes: yesVotes, required };
    opp.status = yesVotes >= required ? "approved" : "detected";
    return opp;
  }
}

async function executeRaydiumSwap(inputMint: string, outputMint: string, amountLamports: number, slippageBps: number = 100): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number }> {
  if (!walletKeypair || !connection) return { success: false, error: "Wallet not initialized" };

  try {
    const balance = await getWalletBalanceSOL();
    if (balance < MIN_BALANCE_FOR_TRADE) return { success: false, error: `Insufficient SOL: ${balance.toFixed(6)} (need ${MIN_BALANCE_FOR_TRADE})` };

    const quote = await fetchRaydiumQuote(inputMint, outputMint, amountLamports, slippageBps);
    if (!quote) return { success: false, error: "Failed to get Raydium quote" };

    const isInputSOL = inputMint === SOL_MINT;
    const isOutputSOL = outputMint === SOL_MINT;

    const swapBody: Record<string, any> = {
      computeUnitPriceMicroLamports: "1000",
      swapResponse: quote,
      wallet: walletKeypair.publicKey.toBase58(),
      txVersion: "V0",
    };

    if (isInputSOL) {
      swapBody.wrapSol = true;
      swapBody.inputAccount = walletKeypair.publicKey.toBase58();
    }
    if (isOutputSOL) {
      swapBody.unwrapSol = true;
    }

    if (!isInputSOL) {
      try {
        const { getAssociatedTokenAddress } = await import("@solana/spl-token");
        const inputTokenMint = new PublicKey(inputMint);
        const ata = await getAssociatedTokenAddress(inputTokenMint, walletKeypair.publicKey);
        swapBody.inputAccount = ata.toBase58();
      } catch (ataErr: any) {
        clog(`Warning: Could not derive ATA for input mint ${inputMint}: ${ataErr.message}`);
      }
    }

    const swapRes = await fetch(RAYDIUM_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swapBody),
    });

    if (!swapRes.ok) return { success: false, error: `Raydium swap API ${swapRes.status}` };

    const swapData = await swapRes.json() as any;
    if (!swapData.success || !swapData.data) return { success: false, error: swapData.msg || "No swap transaction" };

    const transactions = swapData.data;
    const txList = Array.isArray(transactions) ? transactions : [transactions];
    let lastSig = "";

    for (const txBase64 of txList) {
      const txBuf = Buffer.from(typeof txBase64 === "string" ? txBase64 : txBase64.transaction, "base64");
      const tx = VersionedTransaction.deserialize(txBuf);
      tx.sign([walletKeypair]);

      const sig = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: "confirmed",
      });

      const confirmation = await connection.confirmTransaction(sig, "confirmed");
      if (confirmation.value.err) {
        return { success: false, error: `TX failed: ${JSON.stringify(confirmation.value.err)}`, signature: sig };
      }
      lastSig = sig;
      clog(`TX confirmed: ${sig}`);
    }

    return { success: true, signature: lastSig, outAmount: parseInt(quote.outputAmount || "0") };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function executeArbitrage(opp: ArbitrageOpportunity): Promise<ArbitrageOpportunity> {
  const startTime = Date.now();
  opp.status = "executing";

  try {
    const balanceBefore = await getWalletBalanceSOL();

    if (opp.type === "cross-dex" || opp.type === "statistical") {
      const amountLamports = Math.floor(opp.amountIn * LAMPORTS_PER_SOL);

      const buyResult = await executeBestSwap(SOL_MINT, opp.mintB, amountLamports, Math.floor(riskParams.maxSlippage * 100));

      if (!buyResult.success) {
        opp.status = "failed";
        opp.executionTimeMs = Date.now() - startTime;
        clog(`FAILED ${opp.id} via ${buyResult.router}: ${buyResult.error}`);
        portfolio.failedTrades++;
        recordStrategyResult(opp.type, opp.spreadPct, 0, false);
        return opp;
      }

      await new Promise(r => setTimeout(r, 2000));

      if (buyResult.outAmount && buyResult.outAmount > 0) {
        const sellResult = await executeBestSwap(opp.mintB, SOL_MINT, buyResult.outAmount, Math.floor(riskParams.maxSlippage * 100));

        if (sellResult.success) {
          opp.txSignature = sellResult.signature;
          opp.status = "executed";
        } else {
          opp.txSignature = buyResult.signature;
          opp.status = "executed";
          clog(`Partial: bought via ${buyResult.router} but sell failed via ${sellResult.router}: ${sellResult.error}`);
        }
      } else {
        opp.txSignature = buyResult.signature;
        opp.status = "executed";
      }
    } else if (opp.type === "triangular") {
      const mints = [SOL_MINT, USDC_MINT, opp.mintB, SOL_MINT];
      let currentAmount = Math.floor(opp.amountIn * LAMPORTS_PER_SOL);
      let lastSig = "";

      for (let i = 0; i < mints.length - 1; i++) {
        const result = await executeBestSwap(mints[i], mints[i + 1], currentAmount, 150);
        if (!result.success) {
          opp.status = "failed";
          opp.executionTimeMs = Date.now() - startTime;
          clog(`Triangular leg ${i + 1} failed via ${result.router}: ${result.error}`);
          portfolio.failedTrades++;
          recordStrategyResult(opp.type, opp.spreadPct, 0, false);
          return opp;
        }
        lastSig = result.signature || "";
        currentAmount = result.outAmount || 0;
        if (i < mints.length - 2) await new Promise(r => setTimeout(r, 1000));
      }

      opp.txSignature = lastSig;
      opp.status = "executed";
    }

    const balanceAfter = await getWalletBalanceSOL();
    const actualProfit = balanceAfter - balanceBefore;

    opp.actualProfitSOL = actualProfit;
    opp.actualProfitUSD = actualProfit * solPriceUSD;
    opp.executionTimeMs = Date.now() - startTime;

    if (actualProfit > 0) {
      portfolio.totalProfitSOL += actualProfit;
      portfolio.totalProfitUSD += actualProfit * solPriceUSD;
      portfolio.successfulTrades++;
      recordStrategyResult(opp.type, opp.spreadPct, actualProfit, true);
      clog(`PROFIT +${actualProfit.toFixed(6)} SOL ($${(actualProfit * solPriceUSD).toFixed(4)}) | TX: ${opp.txSignature}`);
    } else {
      portfolio.totalLossSOL += Math.abs(actualProfit);
      recordStrategyResult(opp.type, opp.spreadPct, actualProfit, false);
      clog(`LOSS ${actualProfit.toFixed(6)} SOL | TX: ${opp.txSignature}`);
    }

    portfolio.totalTrades++;
    portfolio.returns.push(actualProfit);
    portfolio.walletBalanceSOL = balanceAfter;
    portfolio.winRate = portfolio.successfulTrades / portfolio.totalTrades;
    portfolio.avgProfitPerTrade = portfolio.totalProfitSOL / Math.max(1, portfolio.totalTrades);

    updateSharpeRatio();
    updateMaxDrawdown();

    executedTrades.push({ ...opp });
    saveState();

    return opp;
  } catch (err: any) {
    opp.status = "failed";
    opp.executionTimeMs = Date.now() - startTime;
    clog(`Execute error: ${err.message}`);
    portfolio.failedTrades++;
    return opp;
  }
}

function updateSharpeRatio(): void {
  if (portfolio.returns.length < 2) return;
  const mean = portfolio.returns.reduce((a, b) => a + b, 0) / portfolio.returns.length;
  const variance = portfolio.returns.reduce((s, r) => s + (r - mean) ** 2, 0) / portfolio.returns.length;
  const stdDev = Math.sqrt(variance);
  portfolio.sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
}

function updateMaxDrawdown(): void {
  let peak = 0;
  let maxDD = 0;
  let cumulative = 0;

  for (const ret of portfolio.returns) {
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
  }

  portfolio.maxDrawdown = peak > 0 ? (maxDD / peak) * 100 : 0;
}

function recordStrategyResult(strategyType: string, spread: number, profitSOL: number, success: boolean): void {
  let learning = strategyLearning.get(strategyType);
  if (!learning) {
    learning = {
      strategyType,
      totalAttempts: 0,
      successes: 0,
      failures: 0,
      totalProfitSOL: 0,
      totalLossSOL: 0,
      avgProfitPerTrade: 0,
      avgSpreadAtEntry: 0,
      successRate: 0.5,
      weight: 1.0,
      lastAdjusted: Date.now(),
      recentResults: [],
    };
    strategyLearning.set(strategyType, learning);
  }

  learning.totalAttempts++;
  if (success) {
    learning.successes++;
    learning.totalProfitSOL += profitSOL;
  } else {
    learning.failures++;
    learning.totalLossSOL += Math.abs(profitSOL);
  }

  learning.recentResults.push({ profit: profitSOL, spread, timestamp: Date.now() });
  if (learning.recentResults.length > 50) {
    learning.recentResults = learning.recentResults.slice(-50);
  }

  learning.successRate = learning.successes / Math.max(1, learning.totalAttempts);
  learning.avgProfitPerTrade = (learning.totalProfitSOL - learning.totalLossSOL) / Math.max(1, learning.totalAttempts);
  learning.avgSpreadAtEntry = learning.recentResults.reduce((s, r) => s + r.spread, 0) / Math.max(1, learning.recentResults.length);

  adjustStrategyWeights();
}

function adjustStrategyWeights(): void {
  const strategies = Array.from(strategyLearning.values());
  if (strategies.every(s => s.totalAttempts === 0)) return;

  for (const s of strategies) {
    if (s.totalAttempts < 3) {
      s.weight = 1.0;
      continue;
    }

    let weight = 1.0;
    weight *= 0.5 + s.successRate;
    if (s.avgProfitPerTrade > 0) {
      weight *= 1.0 + Math.min(1.0, s.avgProfitPerTrade * 100);
    } else {
      weight *= Math.max(0.1, 1.0 + s.avgProfitPerTrade * 50);
    }

    const recentSuccessRate = s.recentResults.filter(r => r.profit > 0).length / Math.max(1, s.recentResults.length);
    weight *= 0.5 + recentSuccessRate;

    s.weight = Math.max(0.1, Math.min(3.0, weight));
    s.lastAdjusted = Date.now();
  }

  const totalWeight = strategies.reduce((s, st) => s + st.weight, 0);
  if (totalWeight > 0) {
    for (const s of strategies) {
      s.weight = (s.weight / totalWeight) * strategies.length;
    }
  }

  clog(`Strategy weights: ${strategies.map(s => `${s.strategyType}=${s.weight.toFixed(2)}(${(s.successRate * 100).toFixed(0)}%)`).join(", ")}`);
}

function logOpportunity(type: string, found: number, filtered: number, approved: number, executed: number, profitSOL: number, details: string): void {
  opportunityLogs.push({
    timestamp: Date.now(),
    type,
    found,
    filtered,
    approved,
    executed,
    profitSOL,
    details,
  });

  if (opportunityLogs.length > 500) {
    opportunityLogs = opportunityLogs.slice(-500);
  }
}

function detectCompoundOpportunities(opps: ArbitrageOpportunity[]): CompoundOpportunity[] {
  const compounds: CompoundOpportunity[] = [];
  const now = Date.now();

  const byToken: Record<string, ArbitrageOpportunity[]> = {};
  for (const opp of opps) {
    const key = opp.mintB;
    if (!byToken[key]) byToken[key] = [];
    byToken[key].push(opp);
  }

  for (const token of Object.keys(byToken)) {
    const tokenOpps = byToken[token];
    if (tokenOpps.length < 2) continue;

    const combinedProfit = tokenOpps.reduce((s: number, o: ArbitrageOpportunity) => s + o.estimatedProfitSOL, 0);
    const combinedProfitUSD = tokenOpps.reduce((s: number, o: ArbitrageOpportunity) => s + o.estimatedProfitUSD, 0);

    if (combinedProfit > riskParams.minTradeSOL * 0.5) {
      const tokenSymbol = tokenOpps[0].tokenB;
      compounds.push({
        id: `compound-${tokenSymbol}-${now}`,
        components: tokenOpps,
        combinedProfitSOL: combinedProfit,
        combinedProfitUSD,
        route: `Compound: ${tokenOpps.length} ops on ${tokenSymbol} combined ${combinedProfit.toFixed(6)} SOL`,
        timestamp: now,
        status: "detected",
      });
    }
  }

  const crossType: Record<string, ArbitrageOpportunity[]> = {};
  for (const opp of opps) {
    if (!crossType[opp.type]) crossType[opp.type] = [];
    crossType[opp.type].push(opp);
  }

  for (const type of Object.keys(crossType)) {
    const typeOpps = crossType[type];
    if (typeOpps.length < 3) continue;
    const top3 = typeOpps.sort((a: ArbitrageOpportunity, b: ArbitrageOpportunity) => b.estimatedProfitSOL - a.estimatedProfitSOL).slice(0, 3);
    const combinedProfit = top3.reduce((s: number, o: ArbitrageOpportunity) => s + o.estimatedProfitSOL, 0);
    const combinedProfitUSD = top3.reduce((s: number, o: ArbitrageOpportunity) => s + o.estimatedProfitUSD, 0);

    if (combinedProfit > riskParams.minTradeSOL) {
      compounds.push({
        id: `compound-${type}-multi-${now}`,
        components: top3,
        combinedProfitSOL: combinedProfit,
        combinedProfitUSD,
        route: `Compound: top 3 ${type} ops combined ${combinedProfit.toFixed(6)} SOL`,
        timestamp: now,
        status: "detected",
      });
    }
  }

  return compounds;
}

function getStrategyWeight(type: string): number {
  return strategyLearning.get(type)?.weight || 1.0;
}

async function runScanCycle(): Promise<void> {
  if (!engineRunning) return;
  const cycleStart = Date.now();

  try {
    await fetchSOLPrice();
    portfolio.walletBalanceSOL = await getWalletBalanceSOL();
    portfolio.allocatedSOL = portfolio.walletBalanceSOL * riskParams.maxPositionPct * riskParams.maxConcurrentTrades;
    portfolio.availableSOL = portfolio.walletBalanceSOL - portfolio.allocatedSOL;

    const [crossDex, triangular, polymarket, statArb] = await Promise.all([
      scanCrossDexArbitrage(),
      scanTriangularArbitrage(),
      scanPolymarketArbitrage(),
      scanStatisticalArbitrage(),
    ]);

    const allOpps = [...crossDex, ...triangular, ...polymarket, ...statArb];

    const filtered = allOpps
      .filter(o => o.confidence >= riskParams.minConfidence)
      .filter(o => o.sharpeRatio >= riskParams.targetSharpeRatio * 0.5)
      .filter(o => o.riskScore <= 8)
      .map(o => {
        const weight = getStrategyWeight(o.type);
        return { ...o, estimatedProfitSOL: o.estimatedProfitSOL * weight };
      })
      .sort((a, b) => {
        const scoreA = a.sharpeRatio * a.confidence * a.estimatedProfitSOL;
        const scoreB = b.sharpeRatio * b.confidence * b.estimatedProfitSOL;
        return scoreB - scoreA;
      });

    opportunities = filtered.slice(0, 20);

    compoundOpportunities = detectCompoundOpportunities(allOpps);
    if (compoundOpportunities.length > 0) {
      clog(`Compound opportunities: ${compoundOpportunities.length} detected (${compoundOpportunities.map(c => `${c.combinedProfitSOL.toFixed(6)} SOL`).join(", ")})`);
    }

    logOpportunity(
      "scan",
      allOpps.length,
      filtered.length,
      0,
      0,
      0,
      `Cross-dex: ${crossDex.length}, Tri: ${triangular.length}, Poly: ${polymarket.length}, Stat: ${statArb.length} | Wallet: ${portfolio.walletBalanceSOL.toFixed(6)} SOL`
    );

    const dailyLoss = portfolio.returns
      .filter(r => r < 0)
      .reduce((s, r) => s + Math.abs(r), 0);
    const maxDailyLoss = portfolio.walletBalanceSOL * (riskParams.maxDailyLossPct / 100);

    if (dailyLoss >= maxDailyLoss) {
      clog(`Daily loss limit reached: ${dailyLoss.toFixed(6)} SOL — pausing execution`);
      return;
    }

    const toExecute = opportunities
      .filter(o => o.status === "detected" && o.spreadPct >= riskParams.minSpreadPct)
      .slice(0, riskParams.maxConcurrentTrades);

    let approvedCount = 0;
    for (const opp of toExecute) {
      const approved = await requestArbitrageConsensus(opp);
      if (approved.status === "approved") {
        pendingExecution.push(approved);
        approvedCount++;
      }
    }

    logOpportunity(
      "approval",
      toExecute.length,
      toExecute.length,
      approvedCount,
      0,
      0,
      `${approvedCount}/${toExecute.length} approved for execution`
    );

    lastScanTime = Date.now();
    const elapsed = lastScanTime - cycleStart;
    if (allOpps.length > 0) {
      clog(`Scan: ${allOpps.length} raw, ${filtered.length} filtered, ${approvedCount} approved | ${elapsed}ms | SOL: $${solPriceUSD.toFixed(2)} | Wallet: ${portfolio.walletBalanceSOL.toFixed(6)} SOL`);
    }
  } catch (err: any) {
    clog(`Scan error: ${err.message}`);
  }
}

async function runExecutionCycle(): Promise<void> {
  if (!engineRunning || pendingExecution.length === 0) return;

  try {
    const balance = await getWalletBalanceSOL();
    if (balance < MIN_BALANCE_FOR_TRADE) {
      pendingExecution.length = 0;
      return;
    }
  } catch {}

  if (portfolio.failedTrades > 20 && portfolio.successfulTrades === 0) {
    clog(`Engine paused: ${portfolio.failedTrades} failures, 0 successes. Waiting for better conditions.`);
    pendingExecution.length = 0;
    return;
  }

  const toExecute = pendingExecution.splice(0, riskParams.maxConcurrentTrades);

  for (const opp of toExecute) {
    const age = Date.now() - opp.timestamp;
    if (age > 60000) {
      opp.status = "expired";
      clog(`Expired: ${opp.id} (${(age / 1000).toFixed(0)}s old)`);
      continue;
    }

    clog(`Executing: ${opp.type} — ${opp.route} | Amount: ${opp.amountIn.toFixed(6)} SOL`);
    const result = await executeArbitrage(opp);

    if (result.status === "executed") {
      const profitSOL = result.actualProfitSOL || 0;
      const profitUSD = profitSOL * solPriceUSD;
      clog(`EXECUTED: ${result.id} | +${profitSOL.toFixed(6)} SOL (+$${profitUSD.toFixed(4)}) deposited to wallet | TX: ${result.txSignature}`);
    }

    await new Promise(r => setTimeout(r, riskParams.cooldownMs));
  }
}

async function runConference(): Promise<any> {
  try {
    const consensusEngine = await import("./swarm-consensus");

    const conferenceResult = await consensusEngine.requestSwarmConsensus({
      type: "TRADE",
      description: "Arbitrage Engine Configuration Conference: Determine optimal risk parameters, allocation strategy, and execution frequency for maximum profit with minimum drawdown",
      data: {
        currentParams: riskParams,
        portfolioState: portfolio,
        recentOpportunities: opportunities.slice(0, 10),
        question: "What are the optimal risk parameters for this arbitrage engine? Consider: position sizing, Sharpe ratio targets, min spread thresholds, max concurrent trades, cooldown timing, and daily loss limits.",
      },
      urgency: "normal",
    });

    if (conferenceResult.approved) {
      const adjustments: any = {};

      if (portfolio.winRate > 0.7) {
        adjustments.maxPositionPct = Math.min(0.1, riskParams.maxPositionPct * 1.1);
        adjustments.maxTradeSOL = Math.min(0.1, riskParams.maxTradeSOL * 1.1);
      } else if (portfolio.winRate < 0.4 && portfolio.totalTrades > 5) {
        adjustments.maxPositionPct = Math.max(0.01, riskParams.maxPositionPct * 0.8);
        adjustments.maxTradeSOL = Math.max(0.005, riskParams.maxTradeSOL * 0.8);
        adjustments.minSpreadPct = Math.min(2.0, riskParams.minSpreadPct * 1.2);
      }

      if (portfolio.sharpeRatio > 2.0) {
        adjustments.maxConcurrentTrades = Math.min(5, riskParams.maxConcurrentTrades + 1);
      } else if (portfolio.sharpeRatio < 0.5 && portfolio.totalTrades > 10) {
        adjustments.maxConcurrentTrades = Math.max(1, riskParams.maxConcurrentTrades - 1);
        adjustments.minConfidence = Math.min(0.85, riskParams.minConfidence + 0.05);
      }

      riskParams = { ...riskParams, ...adjustments };
      clog(`Conference adjusted params: ${JSON.stringify(adjustments)}`);
    }

    return conferenceResult;
  } catch {
    return { approved: true, message: "Conference completed with defaults" };
  }
}

function saveState(): void {
  try {
    const learningData: Record<string, StrategyLearning> = {};
    strategyLearning.forEach((val, key) => {
      learningData[key] = val;
    });

    const state = {
      portfolio,
      riskParams,
      executedTrades: executedTrades.slice(-100),
      opportunityLogs: opportunityLogs.slice(-200),
      strategyLearning: learningData,
      lastScanTime,
      engineStartTime,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      if (data.portfolio) portfolio = { ...portfolio, ...data.portfolio };
      if (data.riskParams) riskParams = { ...riskParams, ...data.riskParams };
      if (data.executedTrades) executedTrades = data.executedTrades;
      if (data.opportunityLogs) opportunityLogs = data.opportunityLogs;
      if (data.strategyLearning) {
        for (const [key, val] of Object.entries(data.strategyLearning)) {
          strategyLearning.set(key, val as StrategyLearning);
        }
      }
      if (data.lastScanTime) lastScanTime = data.lastScanTime;
      clog(`Loaded state: ${executedTrades.length} trades, ${portfolio.totalProfitSOL.toFixed(6)} SOL profit, ${strategyLearning.size} strategies tracked`);
    }
  } catch {}
}

export function startArbitrageEngine(): { success: boolean; message: string } {
  if (engineRunning) return { success: true, message: "Already running" };

  loadState();
  const walletOk = initWallet();
  if (!walletOk) {
    clog("Starting in scan-only mode (no wallet)");
  }

  engineRunning = true;
  engineStartTime = Date.now();

  runConference();

  scanInterval = setInterval(() => {
    try {
      runScanCycle().catch(err => clog(`Scan cycle error: ${err?.message || err}`));
    } catch (err: any) {
      clog(`Scan cycle critical error: ${err?.message || err}`);
    }
  }, 120000);
  executeInterval = setInterval(() => {
    try {
      runExecutionCycle().catch(err => clog(`Execution cycle error: ${err?.message || err}`));
    } catch (err: any) {
      clog(`Execution cycle critical error: ${err?.message || err}`);
    }
  }, 60000);

  setTimeout(() => {
    try {
      runScanCycle().catch(err => clog(`Initial scan error: ${err?.message || err}`));
    } catch (err: any) {
      clog(`Initial scan critical error: ${err?.message || err}`);
    }
  }, 3000);

  setInterval(() => {
    try {
      runConference();
      clog(`Conference cycle: portfolio ${portfolio.totalProfitSOL.toFixed(6)} SOL profit, ${portfolio.winRate * 100}% win rate, Sharpe ${portfolio.sharpeRatio.toFixed(2)}`);
    } catch (err: any) {
      clog(`Conference cycle error: ${err?.message || err}`);
    }
  }, 600000);

  clog(`=== ARBITRAGE ENGINE STARTED ===`);
  clog(`Wallet: ${walletKeypair?.publicKey.toBase58() || "scan-only"}`);
  clog(`Strategies: cross-dex, triangular, statistical, polymarket`);
  clog(`Risk: max ${riskParams.maxTradeSOL} SOL/trade, ${riskParams.maxPositionPct * 100}% position, ${riskParams.minSpreadPct}% min spread`);
  clog(`Scan: every 30s | Execute: every 15s | Conference: every 10min`);
  clog(`Sharpe target: ${riskParams.targetSharpeRatio} | Max daily loss: ${riskParams.maxDailyLossPct}%`);

  return { success: true, message: `Arbitrage engine started — ${walletOk ? "live trading" : "scan-only"} mode` };
}

export function stopArbitrageEngine(): void {
  engineRunning = false;
  if (scanInterval) clearInterval(scanInterval);
  if (executeInterval) clearInterval(executeInterval);
  saveState();
  clog("Engine stopped");
}

export function getArbitrageState(): any {
  const learningData: Record<string, any> = {};
  strategyLearning.forEach((val, key) => {
    learningData[key] = {
      ...val,
      recentResults: val.recentResults.slice(-10),
    };
  });

  const blockReasons: string[] = [];
  if (portfolio.walletBalanceSOL < MIN_BALANCE_FOR_TRADE) {
    blockReasons.push(`Wallet balance too low: ${portfolio.walletBalanceSOL.toFixed(6)} SOL (need ${MIN_BALANCE_FOR_TRADE} SOL minimum for gas fees)`);
  }
  if (!walletKeypair) {
    blockReasons.push("No wallet keypair loaded — cannot sign transactions");
  }

  return {
    running: engineRunning,
    wallet: walletKeypair?.publicKey.toBase58() || null,
    solPriceUSD,
    portfolio,
    riskParams,
    currentOpportunities: opportunities.filter(o => o.status === "approved" || o.status === "executing" || o.status === "executed").slice(0, 20),
    pendingExecution: pendingExecution.length,
    recentExecutedTrades: executedTrades.slice(-20).map(t => ({
      ...t,
      depositProof: t.status === "executed" ? `+${(t.actualProfitSOL || 0).toFixed(6)} SOL (+$${((t.actualProfitSOL || 0) * solPriceUSD).toFixed(4)})` : null,
    })),
    totalExecutedTrades: executedTrades.length,
    totalTrades: portfolio.totalTrades,
    totalPnl: portfolio.totalProfitSOL * solPriceUSD,
    opportunitiesFound: opportunities.length,
    lastScanTime,
    engineUptime: engineRunning ? Date.now() - engineStartTime : 0,
    strategies: ["cross-dex", "triangular", "statistical", "polymarket"],
    trackedTokens: TRACKED_TOKENS.map(t => t.symbol),
    strategyLearning: learningData,
    opportunityLogs: opportunityLogs.slice(-50),
    compoundOpportunities: compoundOpportunities.slice(0, 10),
    routers: ["jupiter", "raydium"],
    minBalanceForTrade: MIN_BALANCE_FOR_TRADE,
    tradeBlockReasons: blockReasons,
    autoExecuteEnabled: true,
  };
}

export function getExecutedTrades(): ArbitrageOpportunity[] {
  return executedTrades;
}

export function updateRiskParams(newParams: Partial<RiskParameters>): RiskParameters {
  riskParams = { ...riskParams, ...newParams };
  saveState();
  clog(`Risk params updated: ${JSON.stringify(newParams)}`);
  return riskParams;
}

export function forceConference(): any {
  return runConference();
}

export function forceScan(): Promise<void> {
  return runScanCycle();
}

export function getOpportunityLogs(): OpportunityLog[] {
  return opportunityLogs;
}

export function getStrategyLearning(): Record<string, StrategyLearning> {
  const result: Record<string, StrategyLearning> = {};
  strategyLearning.forEach((val, key) => {
    result[key] = val;
  });
  return result;
}

export function getCompoundOpportunities(): CompoundOpportunity[] {
  return compoundOpportunities;
}
