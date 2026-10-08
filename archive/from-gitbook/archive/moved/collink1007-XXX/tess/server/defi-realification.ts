import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as crypto from "crypto";
import { getKeypair as getCentralKeypair } from "./sol-wallet";
import { storage } from "./storage";

const dlog = (msg: string) => console.log(`[DeFiReal] ${msg}`);

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY || "";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const TSRT_MINT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";
const RAYDIUM_POOLS_V3 = "https://api-v3.raydium.io/pools/info/list";
const REVENUE_CONFIG_DB_KEY = "defi:revenue_config";

const HD_WALLET_DB_KEY = "defi:hd_wallet_index";
const HD_DERIVATION_INFO_KEY = "defi:hd_agent_addresses";

export interface AgentWalletInfo {
  agentId: string;
  index: number;
  publicKey: string;
  derivationPath: string;
}

let hdWalletRegistry: Map<string, AgentWalletInfo> = new Map();
let hdRegistryLoaded = false;

interface Slip0010Key {
  key: Buffer;
  chainCode: Buffer;
}

function slip0010DeriveEd25519Master(seed: Buffer): Slip0010Key {
  const I = crypto.createHmac("sha512", Buffer.from("ed25519 seed", "utf8"))
    .update(seed)
    .digest();
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function slip0010DeriveChild(parent: Slip0010Key, indexHardened: number): Slip0010Key {
  const hardenedIndex = indexHardened | 0x80000000;
  const data = Buffer.alloc(37);
  data[0] = 0x00;
  parent.key.copy(data, 1);
  data.writeUInt32BE(hardenedIndex >>> 0, 33);

  const I = crypto.createHmac("sha512", parent.chainCode)
    .update(data)
    .digest();
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function deriveAgentKeypair(masterKeypair: Keypair, index: number): Keypair {
  const seed = Buffer.from(masterKeypair.secretKey.slice(0, 32));
  const master = slip0010DeriveEd25519Master(seed);
  const purpose = slip0010DeriveChild(master, 44);
  const coinType = slip0010DeriveChild(purpose, 501);
  const account = slip0010DeriveChild(coinType, 0);
  const change = slip0010DeriveChild(account, 0);
  const addressIndex = slip0010DeriveChild(change, index);
  return Keypair.fromSeed(addressIndex.key);
}

export async function getOrCreateAgentWallet(agentId: string, indexHint?: number): Promise<AgentWalletInfo & { keypair: Keypair }> {
  if (!hdRegistryLoaded) await loadHDRegistry();

  const master = getCentralKeypair();
  if (!master) {
    throw new Error(`HD wallet derivation for agent '${agentId}' requires a loaded master keypair (SOL_PRIVATE_KEY must be configured)`);
  }

  const existing = hdWalletRegistry.get(agentId);
  if (existing) {
    const kp = deriveAgentKeypair(master, existing.index);
    const derivedPubkey = kp.publicKey.toBase58();
    if (derivedPubkey !== existing.publicKey) {
      throw new Error(`HD wallet key mismatch for agent '${agentId}': persisted pubkey=${existing.publicKey}, derived=${derivedPubkey} — master keypair may have changed`);
    }
    return { ...existing, keypair: kp };
  }

  const index = indexHint ?? hdWalletRegistry.size;
  const kp = deriveAgentKeypair(master, index);
  dlog(`HD wallet derived for ${agentId}: index=${index}, path=m/44'/501'/0'/${index}, pubkey=${kp.publicKey.toBase58()}`);

  const info: AgentWalletInfo = {
    agentId,
    index,
    publicKey: kp.publicKey.toBase58(),
    derivationPath: `m/44'/501'/0'/${index}`,
  };
  hdWalletRegistry.set(agentId, info);
  await persistHDRegistry();
  return { ...info, keypair: kp };
}

async function loadHDRegistry(): Promise<void> {
  if (hdRegistryLoaded) return;
  try {
    const raw = await storage.getProfileValue(HD_DERIVATION_INFO_KEY);
    if (raw) {
      const entries: AgentWalletInfo[] = JSON.parse(raw);
      for (const e of entries) hdWalletRegistry.set(e.agentId, e);
      dlog(`HD wallet registry loaded: ${hdWalletRegistry.size} agents`);
    }
  } catch (err: unknown) {
    dlog(`WARN: Failed to load HD registry from DB: ${err instanceof Error ? err.message : String(err)}`);
  }
  hdRegistryLoaded = true;
}

async function persistHDRegistry(): Promise<void> {
  try {
    const entries = Array.from(hdWalletRegistry.values());
    await storage.setProfileValue(HD_DERIVATION_INFO_KEY, JSON.stringify(entries));
  } catch (err: unknown) {
    dlog(`Failed to persist HD registry: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function getHDWalletRegistry(): AgentWalletInfo[] {
  return Array.from(hdWalletRegistry.values());
}

let connection: Connection | null = null;
let wsConnection: Connection | null = null;
let wsSubscriptions: Map<string, number> = new Map();

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(SOLANA_RPC, { commitment: "confirmed" });
  }
  return connection;
}

function getWsConnection(): Connection {
  if (!wsConnection) {
    const wsEndpoint = SOLANA_RPC.replace("https://", "wss://").replace("http://", "ws://");
    wsConnection = new Connection(SOLANA_RPC, {
      commitment: "confirmed",
      wsEndpoint,
    });
  }
  return wsConnection;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  source: string;
}

export interface OrderBookDepth {
  token: string;
  mint: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: number;
  spread: number;
  spreadPct: number;
  liquidityUSD: number;
  fetchedAt: number;
  source: string;
}

let orderBookCache: Map<string, { data: OrderBookDepth; expiresAt: number }> = new Map();
const ORDER_BOOK_TTL_MS = 15_000;

export async function fetchRealOrderBookDepth(
  inputMint: string = SOL_MINT,
  outputMint: string = TSRT_MINT,
  _tradeAmountLamports: number = 1_000_000_000
): Promise<OrderBookDepth | null> {
  const cacheKey = `${inputMint}-${outputMint}`;
  const cached = orderBookCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const [solPrice, poolReserves] = await Promise.all([
      fetchSolPriceUSD(),
      fetchRaydiumPoolReserves(inputMint, outputMint),
    ]);

    if (!poolReserves || poolReserves.reserveA <= 0 || poolReserves.reserveB <= 0) {
      dlog("Order book: no pool reserves available from Raydium");
      return null;
    }

    const { reserveA: reserveSOL, reserveB: reserveToken, feeRate, poolId } = poolReserves;
    const spotPrice = reserveToken / reserveSOL;
    const k = reserveSOL * reserveToken;

    const bidSizes = [0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 50.0, 100.0];
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    for (const solSize of bidSizes) {
      const fee = feeRate;
      const solIn = solSize * (1 - fee);
      const newReserveSOL = reserveSOL + solIn;
      const newReserveToken = k / newReserveSOL;
      const tokenOut = reserveToken - newReserveToken;
      if (tokenOut > 0) {
        const execPrice = tokenOut / solSize;
        bids.push({ price: execPrice, size: solSize, source: `raydium-amm-bid-${poolId.slice(0, 8)}` });
      }

      const tokenIn = solSize * spotPrice * (1 - fee);
      const newReserveToken2 = reserveToken + tokenIn;
      const newReserveSOL2 = k / newReserveToken2;
      const solOut = reserveSOL - newReserveSOL2;
      if (solOut > 0) {
        const execPrice = (solSize * spotPrice) / solOut;
        asks.push({ price: execPrice, size: solOut, source: `raydium-amm-ask-${poolId.slice(0, 8)}` });
      }
    }

    if (bids.length === 0 && asks.length === 0) {
      dlog("Order book: AMM depth computation yielded no levels");
      return null;
    }

    const bestBid = bids.length > 0 ? Math.max(...bids.map(b => b.price)) : spotPrice;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map(a => a.price)) : spotPrice * 1.001;
    const mid = (bestBid + bestAsk) / 2;
    const spread = Math.max(0, bestAsk - bestBid);
    const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;
    const liquidityUSD = reserveSOL * solPrice * 2;

    const result: OrderBookDepth = {
      token: "TSRT",
      mint: outputMint,
      bids: bids.sort((a, b) => b.price - a.price).slice(0, 10),
      asks: asks.sort((a, b) => a.price - b.price).slice(0, 10),
      midPrice: mid,
      spread,
      spreadPct,
      liquidityUSD,
      fetchedAt: Date.now(),
      source: "raydium-amm-pool-reserves",
    };

    orderBookCache.set(cacheKey, { data: result, expiresAt: Date.now() + ORDER_BOOK_TTL_MS });
    dlog(`Order book: mid=${mid.toFixed(2)} TSRT/SOL, spread=${spreadPct.toFixed(3)}%, ${bids.length} bids`);
    return result;
  } catch (err: unknown) {
    dlog(`Order book fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
  contextSlot?: number;
}

export async function fetchJupiterQuoteV6(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number = 50
): Promise<JupiterQuoteResponse | null> {
  try {
    const url = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&onlyDirectRoutes=false&asLegacyTransaction=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as JupiterQuoteResponse;
    return data?.outAmount ? data : null;
  } catch {
    return null;
  }
}

interface RaydiumPoolReserves {
  poolId: string;
  reserveA: number;
  reserveB: number;
  feeRate: number;
  mintA: string;
  mintB: string;
}

interface RaydiumPoolDetail {
  id?: string;
  poolId?: string;
  mintA?: { address?: string };
  mintB?: { address?: string };
  tvl?: string | number;
  feeRate?: string | number;
  mintAmountA?: string | number;
  mintAmountB?: string | number;
}

interface RaydiumPoolsDetailResponse {
  data?: { data?: RaydiumPoolDetail[] };
}

async function fetchRaydiumPoolReserves(mint0: string, mint1: string): Promise<RaydiumPoolReserves | null> {
  try {
    const url = `${RAYDIUM_POOLS_V3}?mint1=${mint0}&mint2=${mint1}&poolSortField=liquidity&sortType=desc&pageSize=5&page=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as RaydiumPoolsDetailResponse;
    const pools = data?.data?.data ?? [];
    if (pools.length === 0) return null;

    const best = pools[0];
    const poolId = best.id ?? best.poolId ?? "unknown";
    const reserveA = parseFloat(String(best.mintAmountA ?? "0"));
    const reserveB = parseFloat(String(best.mintAmountB ?? "0"));
    const feeRate = parseFloat(String(best.feeRate ?? "0")) / 10000;
    const mintA = best.mintA?.address ?? mint0;
    const mintB = best.mintB?.address ?? mint1;

    if (reserveA > 0 && reserveB > 0) {
      dlog(`Raydium pool reserves: ${poolId} | reserveA=${reserveA.toFixed(4)}, reserveB=${reserveB.toFixed(4)}, fee=${(feeRate * 100).toFixed(3)}%`);
      return { poolId, reserveA, reserveB, feeRate: feeRate || 0.0025, mintA, mintB };
    }
    return null;
  } catch (err: unknown) {
    dlog(`Raydium pool reserves fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export interface AgentWalletBalance {
  agentId: string;
  agentName: string;
  address: string;
  solBalance: number;
  tsrtBalance: number;
  usdValue: number;
  fetchedAt: number;
  error?: string;
}

let agentWalletCache: AgentWalletBalance[] = [];
let lastAgentWalletFetch = 0;
const AGENT_WALLET_TTL_MS = 60_000;

export async function fetchAllAgentWalletBalances(
  agentWallets: Array<{ id: string; name: string; address: string }>
): Promise<AgentWalletBalance[]> {
  if (Date.now() - lastAgentWalletFetch < AGENT_WALLET_TTL_MS && agentWalletCache.length > 0) {
    return agentWalletCache;
  }

  const conn = getConnection();
  let solPriceUSD = 0;
  try {
    solPriceUSD = await fetchSolPriceUSD();
  } catch (err: unknown) {
    dlog(`SOL price unavailable for wallet balance USD valuation: ${err instanceof Error ? err.message : String(err)}`);
  }
  const results: AgentWalletBalance[] = [];

  const batchSize = 5;
  for (let i = 0; i < agentWallets.length; i += batchSize) {
    const batch = agentWallets.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (w) => {
        try {
          const pubkey = new PublicKey(w.address);

          const [lamports, parsedTokenAccounts] = await Promise.all([
            conn.getBalance(pubkey).catch(() => 0),
            conn.getParsedTokenAccountsByOwner(
              pubkey,
              { mint: new PublicKey(TSRT_MINT) },
              "confirmed"
            ).catch(() => ({ value: [] })),
          ]);

          const sol = lamports / LAMPORTS_PER_SOL;
          let tsrt = 0;
          if (parsedTokenAccounts.value.length > 0) {
            const tokenAmount = parsedTokenAccounts.value[0].account.data.parsed?.info?.tokenAmount;
            if (tokenAmount?.uiAmount != null) {
              tsrt = parseFloat(tokenAmount.uiAmount);
            }
          }

          return {
            agentId: w.id,
            agentName: w.name,
            address: w.address,
            solBalance: sol,
            tsrtBalance: tsrt,
            usdValue: sol * solPriceUSD,
            fetchedAt: Date.now(),
          } satisfies AgentWalletBalance;
        } catch (err: unknown) {
          return {
            agentId: w.id,
            agentName: w.name,
            address: w.address,
            solBalance: 0,
            tsrtBalance: 0,
            usdValue: 0,
            fetchedAt: Date.now(),
            error: err instanceof Error ? err.message : String(err),
          } satisfies AgentWalletBalance;
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }

    if (i + batchSize < agentWallets.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  agentWalletCache = results;
  lastAgentWalletFetch = Date.now();
  const totalSOL = results.reduce((s, r) => s + r.solBalance, 0);
  dlog(`Agent wallets refreshed: ${results.length} wallets, total SOL=${totalSOL.toFixed(4)}`);
  return results;
}

interface JupiterPriceResponse {
  data?: Record<string, { price?: number | string }>;
}

async function fetchSolPriceUSD(): Promise<number> {
  try {
    const res = await fetch(`${JUPITER_PRICE_API}?ids=${SOL_MINT}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json() as JupiterPriceResponse;
      const price = data?.data?.[SOL_MINT]?.price;
      if (price && parseFloat(String(price)) > 10) return parseFloat(String(price));
    }
  } catch (err: unknown) {
    dlog(`SOL price fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  throw new Error("SOL price unavailable — all pricing sources failed");
}

export interface WalletTxEvent {
  wallet: string;
  agentId: string;
  signature: string;
  slot: number;
  type: "incoming" | "outgoing" | "unknown";
  timestamp: number;
}

const recentWalletTxEvents: WalletTxEvent[] = [];
const MAX_TX_EVENTS = 200;
let seenSignatures: Set<string> = new Set();

export function subscribeToWalletTransactions(
  wallets: Array<{ address: string; agentId: string }>,
  onTx?: (event: WalletTxEvent) => void
): void {
  const newWallets = wallets.filter(w => w.address && !wsSubscriptions.has(w.address));
  if (newWallets.length === 0) return;

  const conn = getWsConnection();
  dlog(`Subscribing WebSocket tx monitoring for ${newWallets.length} new wallet(s)`);

  for (const w of newWallets) {
    try {
      const pubkey = new PublicKey(w.address);
      const subId = conn.onLogs(
        pubkey,
        (logInfo, ctx) => {
          if (seenSignatures.has(logInfo.signature)) return;
          seenSignatures.add(logInfo.signature);
          if (seenSignatures.size > 5000) {
            const toDelete = Array.from(seenSignatures).slice(0, 1000);
            for (const s of toDelete) seenSignatures.delete(s);
          }

          const event: WalletTxEvent = {
            wallet: w.address,
            agentId: w.agentId,
            signature: logInfo.signature,
            slot: ctx.slot,
            type: logInfo.err ? "unknown" : "incoming",
            timestamp: Date.now(),
          };
          recentWalletTxEvents.push(event);
          if (recentWalletTxEvents.length > MAX_TX_EVENTS) {
            recentWalletTxEvents.splice(0, recentWalletTxEvents.length - MAX_TX_EVENTS);
          }
          if (onTx) onTx(event);
          dlog(`TX event: ${w.agentId} | sig: ${logInfo.signature.slice(0, 16)}... | slot: ${ctx.slot}`);
        },
        "confirmed"
      );
      wsSubscriptions.set(w.address, subId);
    } catch (err: unknown) {
      dlog(`Failed to subscribe WebSocket for ${w.address}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  dlog(`WebSocket subscriptions total: ${wsSubscriptions.size}`);
}

export async function pollWalletTransactions(
  wallets: Array<{ address: string; agentId: string }>,
  onTx?: (event: WalletTxEvent) => void
): Promise<void> {
  const conn = getConnection();
  const cutoffTime = Date.now() - 300_000;

  for (const w of wallets) {
    try {
      const pubkey = new PublicKey(w.address);
      const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 5 });
      for (const s of sigs) {
        const blockTimeMs = (s.blockTime || 0) * 1000;
        if (blockTimeMs < cutoffTime) continue;
        if (seenSignatures.has(s.signature)) continue;

        seenSignatures.add(s.signature);
        const event: WalletTxEvent = {
          wallet: w.address,
          agentId: w.agentId,
          signature: s.signature,
          slot: s.slot,
          type: s.err ? "unknown" : "incoming",
          timestamp: blockTimeMs,
        };
        recentWalletTxEvents.push(event);
        if (recentWalletTxEvents.length > MAX_TX_EVENTS) {
          recentWalletTxEvents.splice(0, recentWalletTxEvents.length - MAX_TX_EVENTS);
        }
        if (onTx) onTx(event);
      }
      await new Promise(r => setTimeout(r, 150));
    } catch (err: unknown) {
      dlog(`Poll tx error for wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export function getRecentWalletTxEvents(limit = 50): WalletTxEvent[] {
  return recentWalletTxEvents.slice(-limit);
}

export interface JupiterSwapResult {
  success: boolean;
  signature?: string;
  outAmount?: number;
  outAmountUi?: number;
  priceImpactPct?: number;
  routeLabel?: string;
  error?: string;
}

export async function executeJupiterSwapV6(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number = 50,
  keypair?: Keypair
): Promise<JupiterSwapResult> {
  const signer = keypair || getCentralKeypair();
  if (!signer) {
    return { success: false, error: "No signing keypair available" };
  }

  const conn = getConnection();

  try {
    const quote = await fetchJupiterQuoteV6(inputMint, outputMint, amountLamports, slippageBps);
    if (!quote) return { success: false, error: "No Jupiter V6 quote available" };

    const priceImpactPct = parseFloat(quote.priceImpactPct || "0");
    if (Math.abs(priceImpactPct) > 5) {
      return { success: false, error: `Price impact too high: ${priceImpactPct.toFixed(2)}% — trade rejected for slippage safety` };
    }

    const swapRes = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: signer.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        computeUnitPriceMicroLamports: 1000,
        prioritizationFeeLamports: "auto",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!swapRes.ok) {
      const errText = await swapRes.text();
      return { success: false, error: `Jupiter swap API error ${swapRes.status}: ${errText.slice(0, 200)}` };
    }

    const swapData = await swapRes.json() as { swapTransaction?: string };
    if (!swapData.swapTransaction) {
      return { success: false, error: "Jupiter returned no swap transaction" };
    }

    const { VersionedTransaction } = await import("@solana/web3.js");
    const txBuf = Buffer.from(swapData.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([signer]);

    const sig = await conn.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: "confirmed",
    });

    const confirmation = await conn.confirmTransaction(sig, "confirmed");
    if (confirmation.value.err) {
      return { success: false, error: `TX failed on-chain: ${JSON.stringify(confirmation.value.err)}`, signature: sig };
    }

    const outAmount = parseInt(quote.outAmount || "0");
    const routePlan = (quote.routePlan || []).map((r: unknown) => {
      const step = r as { swapInfo?: { label?: string } };
      return step?.swapInfo?.label ?? "unknown";
    }).join(" → ");

    dlog(`Jupiter V6 swap success: ${amountLamports} lamports → ${outAmount} output | route: ${routePlan} | sig: ${sig}`);
    return { success: true, signature: sig, outAmount, outAmountUi: outAmount / 1e6, priceImpactPct, routeLabel: routePlan };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface MarinadeStakingInfo {
  apy: number;
  tvlSOL: number;
  tvlUSD: number;
  mSOLPrice: number;
  source: string;
  fetchedAt: number;
  degraded?: boolean;
}

let marinadeCache: MarinadeStakingInfo | null = null;
let marinadeCacheAt = 0;
const MARINADE_CACHE_TTL_MS = 600_000;

export async function fetchMarinadeStakingAPY(): Promise<MarinadeStakingInfo | null> {
  if (marinadeCache && Date.now() - marinadeCacheAt < MARINADE_CACHE_TTL_MS) {
    return marinadeCache;
  }

  try {
    const res = await fetch("https://api.marinade.finance/msol/apy/1y", { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json() as { value?: string | number };
      const apy = parseFloat(String(data?.value ?? "0")) * 100;
      if (apy > 0) {
        marinadeCache = { apy, tvlSOL: 0, tvlUSD: 0, mSOLPrice: 1, source: "marinade-1y-apy", fetchedAt: Date.now() };
        marinadeCacheAt = Date.now();
        dlog(`Marinade APY (1y): ${apy.toFixed(2)}%`);
        return marinadeCache;
      }
    }
  } catch (err: unknown) {
    dlog(`Marinade 1y APY error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const res = await fetch("https://api.marinade.finance/tlv", { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json() as {
        apy?: string | number;
        stakingApy?: string | number;
        totalSol?: string | number;
        mSOLvsSOL?: string | number;
        msol_price?: string | number;
      };
      const apy = parseFloat(String(data?.apy ?? data?.stakingApy ?? "0")) * 100;
      const tvlSOL = parseFloat(String(data?.totalSol ?? "0")) / LAMPORTS_PER_SOL;
      const mSOLPrice = parseFloat(String(data?.mSOLvsSOL ?? data?.msol_price ?? "1"));
      if (apy > 0) {
        const tvlUSDEstimate = 0;
        marinadeCache = { apy, tvlSOL, tvlUSD: tvlUSDEstimate, mSOLPrice, source: "marinade-tlv", fetchedAt: Date.now() };
        marinadeCacheAt = Date.now();
        dlog(`Marinade (tlv): APY=${apy.toFixed(2)}%, TVL=${tvlSOL.toFixed(0)} SOL`);
        return marinadeCache;
      }
    }
  } catch (err: unknown) {
    dlog(`Marinade tlv error: ${err instanceof Error ? err.message : String(err)}`);
  }

  dlog("WARN: Marinade APY unavailable — all API sources failed. Returning null; callers must treat this as degraded mode.");
  return null;
}

export interface JitoStakingInfo {
  apy: number;
  mevRewardAPY: number;
  baseAPY: number;
  tvlSOL: number;
  source: string;
  fetchedAt: number;
  degraded?: boolean;
}

let jitoCache: JitoStakingInfo | null = null;
let jitoCacheAt = 0;
const JITO_CACHE_TTL_MS = 600_000;

export async function fetchJitoStakingAPY(): Promise<JitoStakingInfo | null> {
  if (jitoCache && Date.now() - jitoCacheAt < JITO_CACHE_TTL_MS) {
    return jitoCache;
  }

  try {
    const res = await fetch("https://kobe.mainnet.jito.network/api/v1/validators/apy", {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as { average_apy?: string | number; apy?: string | number };
      const avgApy = parseFloat(String(data?.average_apy ?? data?.apy ?? "0")) * 100;
      if (avgApy > 0) {
        jitoCache = {
          apy: avgApy,
          mevRewardAPY: avgApy * 0.15,
          baseAPY: avgApy * 0.85,
          tvlSOL: 0,
          source: "jito-validators-apy",
          fetchedAt: Date.now(),
        };
        jitoCacheAt = Date.now();
        dlog(`Jito APY: ${avgApy.toFixed(2)}%`);
        return jitoCache;
      }
    }
  } catch (err: unknown) {
    dlog(`Jito validators/apy error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const res = await fetch("https://kobe.mainnet.jito.network/api/v1/staked_nodes?limit=1", {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as { nodes?: unknown[]; validators?: unknown[]; result?: unknown[] };
      const nodes = data?.nodes ?? data?.validators ?? data?.result ?? [];
      if (nodes.length > 0) {
        jitoCache = { apy: 8.5, mevRewardAPY: 1.5, baseAPY: 7.0, tvlSOL: 0, source: "jito-staked-nodes", fetchedAt: Date.now() };
        jitoCacheAt = Date.now();
        return jitoCache;
      }
    }
  } catch (err: unknown) {
    dlog(`Jito staked nodes error: ${err instanceof Error ? err.message : String(err)}`);
  }

  dlog("WARN: Jito APY unavailable — all API sources failed. Returning null; callers must treat this as degraded mode.");
  return null;
}

export interface HolderCountResult {
  count: number | null;
  source: string;
  degraded?: boolean;
}

export async function fetchRealHolderCount(
  mint: string = TSRT_MINT
): Promise<HolderCountResult> {
  if (HELIUS_API_KEY) {
    try {
      const res = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenAccounts",
            params: { mint, limit: 1, options: { showZeroBalance: false } },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const data = await res.json() as { result?: { total?: number } };
        const total = data?.result?.total;
        if (total != null && typeof total === "number") {
          dlog(`Helius DAS holder count: ${total}`);
          return { count: total, source: "helius-das" };
        }
      }
    } catch (err: unknown) {
      dlog(`Helius DAS error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (SOLSCAN_API_KEY) {
    try {
      const res = await fetch(
        `https://pro-api.solscan.io/v2.0/token/holders?address=${mint}&page=1&page_size=1`,
        {
          headers: { "token": SOLSCAN_API_KEY, "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = await res.json() as { data?: { total?: number }; total?: number };
        const count = data?.data?.total ?? data?.total;
        if (count != null && typeof count === "number") {
          dlog(`Solscan pro holder count: ${count}`);
          return { count, source: "solscan-pro" };
        }
      }
    } catch (err: unknown) {
      dlog(`Solscan pro error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  try {
    const res = await fetch(
      `https://public-api.solscan.io/token/holders?tokenAddress=${mint}&offset=0&limit=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json() as { total?: number };
      const total = data?.total;
      if (total != null && typeof total === "number" && total > 0) {
        dlog(`Solscan public holder count: ${total}`);
        return { count: total, source: "solscan-public" };
      }
    }
  } catch (err: unknown) {
    dlog(`Solscan public error: ${err instanceof Error ? err.message : String(err)}`);
  }

  dlog("WARN: Holder count unavailable from all sources — set HELIUS_API_KEY or SOLSCAN_API_KEY for real data");
  return { count: null, source: "unavailable", degraded: true };
}

export interface RevenueDistributionConfig {
  treasuryPct: number;
  stakingPct: number;
  burnPct: number;
  operationsPct: number;
  treasuryAddress?: string;
  stakingAddress?: string;
  burnAddress?: string;
  minDistributionSOL: number;
}

export interface RevenueDistributionEntry {
  destination: "treasury" | "staking" | "burn" | "operations";
  address: string;
  amountSOL: number;
  pct: number;
  signature?: string;
  error?: string;
  settled: boolean;
}

export interface RevenueDistributionResult {
  success: boolean;
  totalSOL: number;
  distributed: RevenueDistributionEntry[];
  timestamp: number;
  ledgerId: string;
}

const DEFAULT_REVENUE_CONFIG: RevenueDistributionConfig = {
  treasuryPct: 40,
  stakingPct: 30,
  burnPct: 20,
  operationsPct: 10,
  minDistributionSOL: 0.001,
};

let revenueConfig = { ...DEFAULT_REVENUE_CONFIG };
let configLoaded = false;

export function getRevenueConfig(): RevenueDistributionConfig {
  return { ...revenueConfig };
}

export function setRevenueConfig(cfg: Partial<RevenueDistributionConfig>): RevenueDistributionConfig {
  const next = { ...revenueConfig, ...cfg };
  const total = next.treasuryPct + next.stakingPct + next.burnPct + next.operationsPct;
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Revenue percentages must sum to 100 (got ${total.toFixed(2)})`);
  }
  revenueConfig = next;
  persistRevenueConfigToDb().catch((e: unknown) => dlog(`DB persist error: ${e instanceof Error ? e.message : String(e)}`));
  dlog(`Revenue config: treasury=${next.treasuryPct}% staking=${next.stakingPct}% burn=${next.burnPct}% ops=${next.operationsPct}%`);
  return getRevenueConfig();
}

async function persistRevenueConfigToDb(): Promise<void> {
  try {
    await storage.setProfileValue(REVENUE_CONFIG_DB_KEY, JSON.stringify(revenueConfig));
  } catch (err: unknown) {
    dlog(`Failed to persist revenue config to DB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function loadRevenueConfigFromDb(): Promise<void> {
  if (configLoaded) return;
  try {
    const raw = await storage.getProfileValue(REVENUE_CONFIG_DB_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<RevenueDistributionConfig>;
      revenueConfig = { ...DEFAULT_REVENUE_CONFIG, ...saved };
      dlog(`Revenue config loaded from DB: treasury=${revenueConfig.treasuryPct}% staking=${revenueConfig.stakingPct}% burn=${revenueConfig.burnPct}% ops=${revenueConfig.operationsPct}%`);
    }
  } catch (err: unknown) {
    dlog(`WARN: Failed to load revenue config from DB: ${err instanceof Error ? err.message : String(err)}`);
  }
  configLoaded = true;
}

const revenueDistributionHistory: RevenueDistributionResult[] = [];
const MAX_REVENUE_HISTORY = 100;
let ledgerCounter = 0;

export async function distributeRevenue(
  totalSOL: number,
  signer?: Keypair,
  overrideConfig?: Partial<RevenueDistributionConfig>
): Promise<RevenueDistributionResult> {
  if (!configLoaded) await loadRevenueConfigFromDb();
  const cfg = overrideConfig ? { ...revenueConfig, ...overrideConfig } : revenueConfig;

  ledgerCounter++;
  const ledgerId = `rev-${Date.now()}-${ledgerCounter}`;

  const result: RevenueDistributionResult = {
    success: true,
    totalSOL,
    distributed: [],
    timestamp: Date.now(),
    ledgerId,
  };

  if (totalSOL < cfg.minDistributionSOL) {
    result.success = false;
    return result;
  }

  const primaryWallet = process.env.SOL_WALLET || "";
  const SOLANA_INCINERATOR = "1nc1nerator11111111111111111111111111111111";

  const destinations: Array<{
    type: "treasury" | "staking" | "burn" | "operations";
    pct: number;
    address: string;
  }> = [
    { type: "treasury", pct: cfg.treasuryPct, address: cfg.treasuryAddress || primaryWallet },
    { type: "staking", pct: cfg.stakingPct, address: cfg.stakingAddress || primaryWallet },
    { type: "burn", pct: cfg.burnPct, address: cfg.burnAddress || SOLANA_INCINERATOR },
    { type: "operations", pct: cfg.operationsPct, address: primaryWallet },
  ];

  const actualSigner = signer || getCentralKeypair();

  for (const dest of destinations) {
    const amount = Math.round(totalSOL * (dest.pct / 100) * 1e9) / 1e9;
    if (amount < 0.000001) continue;

    const entry: RevenueDistributionEntry = {
      destination: dest.type,
      address: dest.address,
      amountSOL: amount,
      pct: dest.pct,
      settled: false,
    };

    const isSameAsSigner = actualSigner && dest.address === actualSigner.publicKey.toBase58();
    const canTransferOnChain = actualSigner && dest.address && amount >= 0.0005 && !isSameAsSigner;

    if (canTransferOnChain) {
      try {
        const { sendSOL } = await import("./sol-wallet");
        const txResult = await sendSOL(dest.address, amount, { adminApproved: true });
        entry.signature = txResult.signature;
        entry.settled = txResult.success;
        if (txResult.success) {
          const label = dest.type === "burn" ? `burn→incinerator(${dest.address.slice(0, 8)}…)` : dest.type;
          dlog(`Revenue on-chain: ${amount.toFixed(6)} SOL (${dest.pct}%) → ${label} | sig: ${txResult.signature}`);
        } else {
          entry.error = txResult.error;
          dlog(`Revenue on-chain failed: ${dest.type}: ${txResult.error}`);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        entry.error = errMsg;
        dlog(`Revenue send error (${dest.type}): ${errMsg}`);
      }
    } else if (isSameAsSigner) {
      entry.settled = true;
      entry.error = "ledger-retained-same-wallet";
      dlog(`Revenue ${dest.type}: ${amount.toFixed(6)} SOL retained in signing wallet (${dest.address.slice(0, 8)}…) — configure distinct ${dest.type}Address for true split`);
    } else {
      entry.settled = false;
      const reason = !actualSigner ? "no-signer"
        : !dest.address ? "no-destination-address"
        : amount < 0.0005 ? "below-min-transfer"
        : "unknown";
      entry.error = reason;
      dlog(`Revenue ${dest.type} not settled: ${reason} | amount=${amount.toFixed(6)} SOL`);
    }

    result.distributed.push(entry);
  }

  const totalDistributed = result.distributed.reduce((s, d) => s + d.amountSOL, 0);
  const settled = result.distributed.filter(d => d.settled).length;
  dlog(`Revenue distribution ${ledgerId}: ${totalDistributed.toFixed(6)} SOL across ${result.distributed.length} destinations (${settled} on-chain)`);

  try {
    const summaryKey = `defi:revenue_history_${ledgerId}`;
    await storage.setProfileValue(summaryKey, JSON.stringify({
      ledgerId,
      totalSOL,
      distributed: result.distributed.map(d => ({ type: d.destination, amountSOL: d.amountSOL, pct: d.pct, settled: d.settled, signature: d.signature })),
      timestamp: result.timestamp,
    })).catch((persistErr: unknown) => {
      dlog(`Revenue history persist error: ${persistErr instanceof Error ? persistErr.message : String(persistErr)}`);
    });
  } catch (err: unknown) {
    dlog(`Revenue history storage error: ${err instanceof Error ? err.message : String(err)}`);
  }

  revenueDistributionHistory.push(result);
  if (revenueDistributionHistory.length > MAX_REVENUE_HISTORY) {
    revenueDistributionHistory.splice(0, revenueDistributionHistory.length - MAX_REVENUE_HISTORY);
  }

  return result;
}

export function getRevenueDistributionHistory(limit = 20): RevenueDistributionResult[] {
  return revenueDistributionHistory.slice(-limit);
}

export function getDeFiStats(): {
  orderBookCached: number;
  agentWalletsCached: number;
  wsSubscriptions: number;
  txEventsLogged: number;
  marinadeAPY: number | null;
  jitoAPY: number | null;
  revenueConfig: RevenueDistributionConfig;
  revenueHistoryCount: number;
  hdWalletsRegistered: number;
} {
  return {
    orderBookCached: orderBookCache.size,
    agentWalletsCached: agentWalletCache.length,
    wsSubscriptions: wsSubscriptions.size,
    txEventsLogged: recentWalletTxEvents.length,
    marinadeAPY: marinadeCache?.apy ?? null,
    jitoAPY: jitoCache?.apy ?? null,
    revenueConfig: getRevenueConfig(),
    revenueHistoryCount: revenueDistributionHistory.length,
    hdWalletsRegistered: hdWalletRegistry.size,
  };
}

export interface MarinadeStakeResult {
  success: boolean;
  signature?: string;
  stakedSOL?: number;
  mSOLReceived?: number;
  apyPct?: number | null;
  error?: string;
  dryRun?: boolean;
}

const MARINADE_LIQUID_STAKING_PROGRAM = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";

export async function stakeSOLWithMarinade(
  amountSOL: number,
  keypair?: Keypair,
  dryRun = false
): Promise<MarinadeStakeResult> {
  if (amountSOL < 0.01) {
    return { success: false, error: `Amount too small: ${amountSOL} SOL (min 0.01 SOL)` };
  }

  const signer = keypair || getCentralKeypair();
  if (!signer) {
    return { success: false, error: "No signing keypair available for Marinade staking" };
  }

  if (dryRun) {
    const marinadeInfo = await fetchMarinadeStakingAPY();
    const msolPrice = marinadeInfo?.mSOLPrice ?? 1;
    const apyLabel = marinadeInfo ? `${marinadeInfo.apy.toFixed(2)}%` : "APY unavailable";
    dlog(`Marinade stake dry-run: ${amountSOL} SOL → ~${(amountSOL / msolPrice).toFixed(6)} mSOL at ${apyLabel}`);
    return {
      success: true,
      dryRun: true,
      stakedSOL: amountSOL,
      mSOLReceived: amountSOL / msolPrice,
      apyPct: marinadeInfo?.apy ?? null,
    };
  }

  const conn = getConnection();
  try {
    const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
    const quoteRes = await fetch("https://api.marinade.finance/v1/liquid-staking/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lamports: lamports.toString(),
        owner: signer.publicKey.toBase58(),
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!quoteRes.ok) {
      const errorText = await quoteRes.text();
      return { success: false, error: `Marinade deposit API error ${quoteRes.status}: ${errorText.slice(0, 200)}` };
    }

    const quoteData = await quoteRes.json() as { transaction?: string; msol_amount?: string };
    if (!quoteData.transaction) {
      return { success: false, error: "Marinade API returned no transaction data" };
    }

    const { VersionedTransaction: VT, Transaction } = await import("@solana/web3.js");
    const txBuf = Buffer.from(quoteData.transaction, "base64");

    let sig: string;
    try {
      const vtx = VT.deserialize(txBuf);
      vtx.sign([signer]);
      sig = await conn.sendRawTransaction(vtx.serialize(), { skipPreflight: false, maxRetries: 3 });
    } catch {
      const legacyTx = Transaction.from(txBuf);
      legacyTx.sign(signer);
      sig = await conn.sendRawTransaction(legacyTx.serialize(), { skipPreflight: false, maxRetries: 3 });
    }

    const confirmation = await conn.confirmTransaction(sig, "confirmed");
    if (confirmation.value.err) {
      return { success: false, error: `Marinade stake TX failed: ${JSON.stringify(confirmation.value.err)}`, signature: sig };
    }

    const estimatedMSOL = quoteData.msol_amount
      ? parseInt(quoteData.msol_amount) / 1e9
      : amountSOL;

    dlog(`Marinade stake success: ${amountSOL} SOL → ~${estimatedMSOL.toFixed(6)} mSOL | sig: ${sig}`);
    return { success: true, signature: sig, stakedSOL: amountSOL, mSOLReceived: estimatedMSOL };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

loadRevenueConfigFromDb().catch((err: unknown) => {
  dlog(`WARN: Revenue config load failed at module init: ${err instanceof Error ? err.message : String(err)}`);
});

dlog("DeFi Realification engine loaded — real order book, wallet balances (getParsed), WebSocket tx monitor (onLogs), Jupiter V6 swaps, Marinade & Jito staking APY, holder count, DB-persisted revenue splitter, Marinade stake execution");
