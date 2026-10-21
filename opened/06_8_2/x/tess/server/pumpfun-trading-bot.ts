import {
  Connection,
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import { getKeypair as getCentralKeypair } from "./sol-wallet";
import {
  subscribeToWalletTransactions,
  pollWalletTransactions,
  executeJupiterSwapV6,
  fetchAllAgentWalletBalances,
  getOrCreateAgentWallet,
  type WalletTxEvent,
} from "./defi-realification";
import {
  calibrateRiskParams,
  getCurrentRiskParams,
  notifyCircuitBreakerTrigger,
  type MarketSnapshot as RCMarketSnapshot,
  type PortfolioSnapshot as RCPortfolioSnapshot,
  type CircuitBreakerFeedback,
} from "./risk-calibration-engine";

let rotationIdx = 0;

const TSRT_CONTRACT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const FATHER_WALLET = process.env.SOL_WALLET || "";
const COMMUNITY_WALLET = process.env.SOL_WALLET || "";

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
];

const BOT_AGENTS = [
  { id: "tessera-prime", name: "Tessera", role: "Market Maker", address: process.env.AGENT_PRIME_WALLET || "" },
  { id: "tessera-alpha", name: "Alpha", role: "Accumulator", address: process.env.AGENT_ALPHA_WALLET || "" },
  { id: "tessera-beta", name: "Beta", role: "Swing Trader", address: process.env.AGENT_BETA_WALLET || "" },
  { id: "tessera-gamma", name: "Gamma", role: "DCA Bot", address: process.env.AGENT_GAMMA_WALLET || "" },
  { id: "tessera-delta", name: "Delta", role: "Dip Buyer", address: process.env.AGENT_DELTA_WALLET || "" },
  { id: "tessera-epsilon", name: "Epsilon", role: "Momentum Bot", address: process.env.AGENT_EPSILON_WALLET || "" },
];

function getDynMinBuySOL(): number {
  return getCurrentRiskParams().minBuySOL;
}

function getDynMaxBuySOL(): number {
  return getCurrentRiskParams().maxBuySOL;
}

const MIN_BUY_SOL = 0.0001;
const MAX_BUY_SOL = 0.001;
const MIN_SELL_TSRT = 10_000;
const MAX_SELL_TSRT = 500_000;
const BUY_RATIO = 0.7;
const SELL_RATIO = 0.3;
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const MAX_INTERVAL_MS = 10 * 60 * 1000;
const MAX_DAILY_TRADES = 100;
const MIN_SOL_BALANCE = 0.0005;
const REVENUE_RECYCLE_PERCENT = 0.6;

interface TradeRecord {
  agent: string;
  type: "buy" | "sell";
  amountSOL: number;
  amountTSRT: number;
  signature: string;
  timestamp: number;
  success: boolean;
  error?: string;
  source?: string;
  profitLossSOL?: number;
}

interface IncomeSource {
  name: string;
  type: string;
  lastChecked: number;
  totalEarned: number;
  lastDeposit: number;
  status: "active" | "monitoring" | "inactive";
}

interface CircuitBreakerState {
  consecutiveFailures: number;
  pausedUntil: number | null;
  dailyPausedUntil: number | null;
  dailyStartBalance: number;
  dailyLossSOL: number;
  dailyDate: string;
}

const CIRCUIT_BREAKER_MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_BREAKER_PAUSE_MS = 10 * 60 * 1000;
const CIRCUIT_BREAKER_DAILY_LOSS_THRESHOLD = 0.20;
const CIRCUIT_BREAKER_DAILY_PAUSE_MS = 24 * 60 * 60 * 1000;

interface BotState {
  running: boolean;
  startedAt: number | null;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalSOLSpent: number;
  totalSOLReceived: number;
  totalLIMNBought: number;
  totalLIMNSold: number;
  todayTrades: number;
  todayDate: string;
  recentTrades: TradeRecord[];
  walletBalance: number;
  tsrtBalance: number;
  avgBuyPriceSOL: number;
  realizedProfitLossSOL: number;
  lastTradeAt: number | null;
  nextTradeAt: number | null;
  currentAgent: string;
  errors: string[];
  circuitBreaker: CircuitBreakerState;
  revenueRecycler: {
    enabled: boolean;
    lastBalance: number;
    depositsDetected: number;
    totalRecycled: number;
    lastCheckAt: number;
  };
  incomeSources: IncomeSource[];
}

const botState: BotState = {
  running: false,
  startedAt: null,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  totalSOLSpent: 0,
  totalSOLReceived: 0,
  totalLIMNBought: 0,
  totalLIMNSold: 0,
  todayTrades: 0,
  todayDate: new Date().toISOString().split("T")[0],
  recentTrades: [],
  walletBalance: 0,
  tsrtBalance: 0,
  avgBuyPriceSOL: 0,
  realizedProfitLossSOL: 0,
  lastTradeAt: null,
  nextTradeAt: null,
  currentAgent: "",
  errors: [],
  circuitBreaker: {
    consecutiveFailures: 0,
    pausedUntil: null,
    dailyPausedUntil: null,
    dailyStartBalance: 0,
    dailyLossSOL: 0,
    dailyDate: new Date().toISOString().split("T")[0],
  },
  revenueRecycler: {
    enabled: true,
    lastBalance: 0,
    depositsDetected: 0,
    totalRecycled: 0,
    lastCheckAt: 0,
  },
  incomeSources: [
    { name: "XMR Mining → SOL", type: "mining", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "monitoring" },
    { name: "VitalitySupply Affiliate", type: "affiliate", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "monitoring" },
    { name: "Blog/SEO Revenue", type: "content", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "monitoring" },
    { name: "DeFi Yield Farming", type: "defi", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "monitoring" },
    { name: "DEX Arbitrage", type: "trading", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "monitoring" },
    { name: "Community Wallet Deposits", type: "community", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "monitoring" },
    { name: "Direct SOL Deposits", type: "direct", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "active" },
    { name: "TSRT Buy Pressure", type: "buyback", lastChecked: 0, totalEarned: 0, lastDeposit: 0, status: "active" },
  ],
};

let connection: Connection | null = null;
let walletKeypair: Keypair | null = null;
let tradeInterval: ReturnType<typeof setTimeout> | null = null;
let revenueCheckInterval: ReturnType<typeof setInterval> | null = null;

let cachedTsrtPriceSOL: number | null = null;
let cachedTsrtPriceTimestamp = 0;
const TSRT_PRICE_CACHE_TTL_MS = 30_000;

async function fetchLimnPriceInSOL(): Promise<number> {
  const now = Date.now();
  if (cachedTsrtPriceSOL !== null && now - cachedTsrtPriceTimestamp < TSRT_PRICE_CACHE_TTL_MS) {
    return cachedTsrtPriceSOL;
  }

  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${TSRT_CONTRACT}`
    );
    if (!res.ok) {
      throw new Error(`DexScreener HTTP ${res.status}`);
    }
    const json = (await res.json()) as any;
    const pairs = json?.pairs;
    if (Array.isArray(pairs) && pairs.length > 0) {
      const pair = pairs[0];
      const priceNative = parseFloat(pair.priceNative);
      if (priceNative > 0) {
        cachedTsrtPriceSOL = priceNative;
        cachedTsrtPriceTimestamp = now;
        log(`TSRT price updated from DexScreener: ${priceNative} SOL per TSRT`);
        return priceNative;
      }
    }
    throw new Error("No valid price data in DexScreener response");
  } catch (err: any) {
    log(`DexScreener price fetch failed: ${err.message}`);
    if (cachedTsrtPriceSOL !== null) {
      log(`Using stale cached TSRT price: ${cachedTsrtPriceSOL} SOL`);
      return cachedTsrtPriceSOL;
    }
    const fallback = 1 / 250_000_000;
    log(`No cached price available, using hardcoded fallback`);
    return fallback;
  }
}

function log(msg: string) {
  console.log(`[PumpFunBot] ${msg}`);
}

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_ENDPOINTS[0], "confirmed");
  }
  return connection;
}

function initWallet(): boolean {
  if (walletKeypair) return true;

  const central = getCentralKeypair();
  if (central) {
    walletKeypair = central;
    log(`Wallet loaded from central wallet: ${walletKeypair.publicKey.toBase58()}`);
    return true;
  }

  const pk = process.env.SOL_PRIVATE_KEY;
  if (!pk) {
    log("No wallet available — bot in monitoring mode");
    return false;
  }

  try {
    const decoded = bs58.decode(pk);
    walletKeypair = Keypair.fromSecretKey(decoded);
  } catch {
    try {
      const jsonKey = JSON.parse(pk);
      walletKeypair = Keypair.fromSecretKey(new Uint8Array(jsonKey));
    } catch {
      log("Invalid SOL_PRIVATE_KEY format");
      return false;
    }
  }

  const addr = walletKeypair.publicKey.toBase58();
  log(`Wallet initialized: ${addr}`);
  return true;
}

async function checkBalance(): Promise<number> {
  try {
    const conn = getConnection();
    const pubkey = walletKeypair
      ? walletKeypair.publicKey
      : new PublicKey(FATHER_WALLET);
    const lamports = await conn.getBalance(pubkey);
    const sol = lamports / LAMPORTS_PER_SOL;
    botState.walletBalance = sol;
    return sol;
  } catch (err: any) {
    log(`Balance check error: ${err.message}`);
    return botState.walletBalance;
  }
}

async function checkRecentTransactions(): Promise<{ newDeposits: number; signatures: string[] }> {
  try {
    const conn = getConnection();
    const pubkey = walletKeypair ? walletKeypair.publicKey : new PublicKey(FATHER_WALLET);
    const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 10 });

    const cutoff = Date.now() - 3600000;
    const recentSigs = sigs.filter(s => s.blockTime && s.blockTime * 1000 > cutoff);

    return {
      newDeposits: recentSigs.length,
      signatures: recentSigs.map(s => s.signature),
    };
  } catch {
    return { newDeposits: 0, signatures: [] };
  }
}

async function monitorRevenueAndRecycle() {
  if (!botState.running || !botState.revenueRecycler.enabled) return;

  try {
    const currentBalance = await checkBalance();
    const lastBalance = botState.revenueRecycler.lastBalance;
    botState.revenueRecycler.lastCheckAt = Date.now();

    if (lastBalance > 0 && currentBalance > lastBalance + 0.0005) {
      const deposit = currentBalance - lastBalance;
      const recycleAmount = deposit * REVENUE_RECYCLE_PERCENT;

      log(`REVENUE DETECTED: +${deposit.toFixed(6)} SOL deposited`);
      log(`Recycling ${(REVENUE_RECYCLE_PERCENT * 100).toFixed(0)}% (${recycleAmount.toFixed(6)} SOL) into TSRT buy`);

      botState.revenueRecycler.depositsDetected++;

      const directSource = botState.incomeSources.find(s => s.type === "direct");
      if (directSource) {
        directSource.totalEarned += deposit;
        directSource.lastDeposit = deposit;
        directSource.lastChecked = Date.now();
      }

      try {
        const { distributeRevenue } = await import("./defi-realification");
        const splitAmount = deposit * (1 - REVENUE_RECYCLE_PERCENT);
        if (splitAmount >= 0.001) {
          const distResult = await distributeRevenue(splitAmount);
          log(`Revenue split: ${splitAmount.toFixed(6)} SOL distributed — treasury=${distResult.distributed.find(d => d.destination === "treasury")?.amountSOL.toFixed(6) || 0} SOL, staking=${distResult.distributed.find(d => d.destination === "staking")?.amountSOL.toFixed(6) || 0} SOL, burn=${distResult.distributed.find(d => d.destination === "burn")?.amountSOL.toFixed(6) || 0} SOL`);
        }
      } catch (splitErr: any) {
        log(`Revenue split error (non-fatal): ${splitErr.message}`);
      }

      if (recycleAmount >= MIN_BUY_SOL && currentBalance - recycleAmount >= MIN_SOL_BALANCE) {
        const agent = getRandomAgent();
        log(`Revenue Recycler: ${agent.name} buying TSRT with ${recycleAmount.toFixed(6)} SOL`);

        const result = await executePumpFunBuy(recycleAmount, agent.name);
        if (result.success) {
          result.source = "revenue-recycler";
          botState.revenueRecycler.totalRecycled += recycleAmount;
          botState.totalTrades++;
          botState.todayTrades++;
          botState.successfulTrades++;
          botState.totalSOLSpent += recycleAmount;
          botState.totalLIMNBought += result.amountTSRT;
          botState.recentTrades.push(result);
          if (botState.recentTrades.length > 50) botState.recentTrades = botState.recentTrades.slice(-40);
          log(`Revenue recycled: ${recycleAmount.toFixed(6)} SOL → TSRT | sig: ${result.signature}`);
        }
      }
    }

    botState.revenueRecycler.lastBalance = currentBalance;

    for (const source of botState.incomeSources) {
      source.lastChecked = Date.now();
    }

    const txns = await checkRecentTransactions();
    if (txns.newDeposits > 0) {
      const directSource = botState.incomeSources.find(s => s.type === "direct");
      if (directSource) directSource.status = "active";
    }

  } catch (err: any) {
    log(`Revenue monitor error: ${err.message}`);
  }
}

async function executePumpFunBuy(
  amountSOL: number,
  agentName: string
): Promise<TradeRecord> {
  const record: TradeRecord = {
    agent: agentName,
    type: "buy",
    amountSOL,
    amountTSRT: 0,
    signature: "",
    timestamp: Date.now(),
    success: false,
  };

  if (!walletKeypair) {
    record.error = "Wallet not initialized";
    return record;
  }

  try {
    const MAX_RETRIES = 3;
    let data: ArrayBuffer | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch("https://pumpportal.fun/api/trade-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: walletKeypair.publicKey.toBase58(),
          action: "buy",
          mint: TSRT_CONTRACT,
          denominatedInSol: "true",
          amount: amountSOL,
          slippage: 25,
          priorityFee: 0.0001,
          pool: "pump",
        }),
      });

      if (response.status === 200) {
        data = await response.arrayBuffer();
        break;
      }

      const errText = await response.text();
      record.error = `PumpPortal API error ${response.status}: ${errText}`;
      log(`${record.error} (attempt ${attempt}/${MAX_RETRIES})`);

      if (response.status >= 400 && response.status < 500) {
        log(`Client error ${response.status} — skipping retries (bad request parameters)`);
        return record;
      }

      if (attempt < MAX_RETRIES) {
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        log(`Retrying buy in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        log(`PumpPortal failed after ${MAX_RETRIES} attempts — falling back to Jupiter V6`);
        try {
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
          const jupResult = await executeJupiterSwapV6(SOL_MINT, TSRT_CONTRACT, lamports, 250, walletKeypair || undefined);
          if (jupResult.success && jupResult.signature) {
            record.signature = jupResult.signature;
            record.success = true;
            record.amountTSRT = jupResult.outAmountUi || 0;
            log(`Jupiter V6 fallback BUY SUCCESS: ${amountSOL} SOL → ${record.amountTSRT} TSRT | sig: ${jupResult.signature}`);
            creditAgentTrade(agentName, amountSOL, record.amountTSRT, "buy");
            return record;
          } else {
            record.error = `Jupiter V6 fallback also failed: ${jupResult.error}`;
            log(record.error);
          }
        } catch (jupErr: any) {
          log(`Jupiter V6 fallback error: ${jupErr.message}`);
        }
        return record;
      }
    }

    if (!data) {
      record.error = "No response data after retries";
      return record;
    }
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));

    tx.sign([walletKeypair]);

    const conn = getConnection();
    const signature = await conn.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    log(`Trade submitted: ${signature}`);

    const confirmation = await conn.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      record.error = `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`;
      log(record.error);
      return record;
    }

    record.signature = signature;
    record.success = true;

    const tsrtPrice = await fetchLimnPriceInSOL();
    record.amountTSRT = tsrtPrice > 0 ? amountSOL / tsrtPrice : 0;

    const prevTotal = botState.tsrtBalance;
    const prevCost = prevTotal * botState.avgBuyPriceSOL;
    botState.tsrtBalance += record.amountTSRT;
    if (botState.tsrtBalance > 0) {
      botState.avgBuyPriceSOL = (prevCost + amountSOL) / botState.tsrtBalance;
    }

    log(
      `BUY SUCCESS by ${agentName}: ${amountSOL} SOL → ~${record.amountTSRT.toLocaleString()} TSRT (price: ${tsrtPrice} SOL/TSRT) | sig: ${signature}`
    );

    creditAgentTrade(agentName, amountSOL, record.amountTSRT, "buy");

    return record;
  } catch (err: any) {
    record.error = err.message || "Unknown error";
    log(`Trade error: ${record.error}`);
    return record;
  }
}

async function executePumpFunSell(
  amountTSRT: number,
  agentName: string
): Promise<TradeRecord> {
  const record: TradeRecord = {
    agent: agentName,
    type: "sell",
    amountSOL: 0,
    amountTSRT: amountTSRT,
    signature: "",
    timestamp: Date.now(),
    success: false,
  };

  if (!walletKeypair) {
    record.error = "Wallet not initialized";
    return record;
  }

  try {
    const MAX_RETRIES = 3;
    let data: ArrayBuffer | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch("https://pumpportal.fun/api/trade-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: walletKeypair.publicKey.toBase58(),
          action: "sell",
          mint: TSRT_CONTRACT,
          denominatedInSol: "false",
          amount: amountTSRT,
          slippage: 25,
          priorityFee: 0.0001,
          pool: "pump",
        }),
      });

      if (response.status === 200) {
        data = await response.arrayBuffer();
        break;
      }

      const errText = await response.text();
      record.error = `PumpPortal API error ${response.status}: ${errText}`;
      log(`${record.error} (attempt ${attempt}/${MAX_RETRIES})`);

      if (response.status >= 400 && response.status < 500) {
        log(`Client error ${response.status} — skipping retries (bad request parameters)`);
        return record;
      }

      if (attempt < MAX_RETRIES) {
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        log(`Retrying sell in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        log(`Sell failed after ${MAX_RETRIES} attempts`);
        return record;
      }
    }

    if (!data) {
      record.error = "No response data after retries";
      return record;
    }
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));

    tx.sign([walletKeypair]);

    const conn = getConnection();
    const signature = await conn.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    log(`Sell trade submitted: ${signature}`);

    const confirmation = await conn.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      record.error = `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`;
      log(record.error);
      return record;
    }

    record.signature = signature;
    record.success = true;

    const tsrtPrice = await fetchLimnPriceInSOL();
    record.amountSOL = tsrtPrice > 0 ? amountTSRT * tsrtPrice : 0;

    const costBasis = amountTSRT * botState.avgBuyPriceSOL;
    record.profitLossSOL = record.amountSOL - costBasis;
    botState.realizedProfitLossSOL += record.profitLossSOL;

    botState.tsrtBalance = Math.max(0, botState.tsrtBalance - amountTSRT);

    log(
      `SELL SUCCESS by ${agentName}: ~${amountTSRT.toLocaleString()} TSRT → ${record.amountSOL.toFixed(6)} SOL (P&L: ${record.profitLossSOL >= 0 ? "+" : ""}${record.profitLossSOL.toFixed(6)} SOL) | sig: ${signature}`
    );

    creditAgentTrade(agentName, record.amountSOL, amountTSRT, "sell");

    return record;
  } catch (err: any) {
    record.error = err.message || "Unknown error";
    log(`Sell trade error: ${record.error}`);
    return record;
  }
}

function syncRealBalancesToWorldState(
  balances: Array<{ agentId: string; solBalance: number; tsrtBalance: number; usdValue?: number }>
) {
  try {
    const p = path.join(process.cwd(), "server/world-state.json");
    const world = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (!world.economy) world.economy = {};
    if (!world.economy.agentRealBalances) world.economy.agentRealBalances = {};

    for (const b of balances) {
      if (b.solBalance >= 0) {
        world.economy.agentRealBalances[b.agentId] = {
          solBalance: b.solBalance,
          tsrtBalance: b.tsrtBalance,
          usdValue: b.usdValue ?? 0,
          lastSyncedAt: Date.now(),
          source: "on-chain-rpc",
        };

        if (b.tsrtBalance > 0) {
          if (!world.economy.agentBalances) world.economy.agentBalances = {};
          world.economy.agentBalances[b.agentId] = b.tsrtBalance * 1e6;
        }
      }
    }

    const totalSOL = balances.reduce((s, b) => s + b.solBalance, 0);
    const totalTSRT = balances.reduce((s, b) => s + b.tsrtBalance, 0);
    const totalUSD = balances.reduce((s, b) => s + (b.usdValue ?? 0), 0);

    world.economy.realWalletSyncAt = Date.now();
    world.economy.realTotalSOL = totalSOL;
    world.economy.realTotalTSRT = totalTSRT;
    world.economy.realTotalUSD = totalUSD;
    world.economy.realDataSource = "on-chain-rpc";
    world.economy.simulationMode = false;

    if (totalTSRT > 0 && world.economy.totalTesseractCoins !== undefined) {
      world.economy.totalTesseractCoins = Math.round(totalTSRT * 1e6);
    }
    if (totalTSRT > 0 && world.economy.circulatingSupply !== undefined) {
      world.economy.circulatingSupply = Math.round(totalTSRT * 1e6);
    }

    fs.writeFileSync(p, JSON.stringify(world, null, 2));
    log(`World-state synced from on-chain: ${balances.length} wallets, ${totalSOL.toFixed(6)} SOL, ${totalTSRT.toFixed(2)} TSRT, $${totalUSD.toFixed(2)} USD — simulationMode=false`);
  } catch (err: unknown) {
    log(`World-state sync error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function creditAgentTrade(
  agentName: string,
  solAmount: number,
  limnAmount: number,
  tradeType: "buy" | "sell"
) {
  try {
    const p = path.join(process.cwd(), "server/world-state.json");
    const world = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (!world.economy) world.economy = { agentBalances: {} };
    if (!world.economy.agentBalances) world.economy.agentBalances = {};
    if (!world.economy.pumpfunTrades) world.economy.pumpfunTrades = {};

    const agentId =
      BOT_AGENTS.find((a) => a.name === agentName)?.id || "tessera-prime";

    if (tradeType === "buy") {
      world.economy.agentBalances[agentId] =
        (world.economy.agentBalances[agentId] || 0) + limnAmount * 0.000001;
    } else {
      world.economy.agentBalances[agentId] =
        (world.economy.agentBalances[agentId] || 0) - limnAmount * 0.000001;
    }

    if (!world.economy.pumpfunTrades[agentId])
      world.economy.pumpfunTrades[agentId] = {
        totalBuys: 0,
        totalSells: 0,
        totalSOLSpent: 0,
        totalSOLReceived: 0,
        totalLIMNBought: 0,
        totalLIMNSold: 0,
      };

    if (tradeType === "buy") {
      world.economy.pumpfunTrades[agentId].totalBuys = (world.economy.pumpfunTrades[agentId].totalBuys || 0) + 1;
      world.economy.pumpfunTrades[agentId].totalSOLSpent = (world.economy.pumpfunTrades[agentId].totalSOLSpent || world.economy.pumpfunTrades[agentId].totalSOL || 0) + solAmount;
      world.economy.pumpfunTrades[agentId].totalLIMNBought = (world.economy.pumpfunTrades[agentId].totalLIMNBought || world.economy.pumpfunTrades[agentId].totalTSRT || 0) + limnAmount;
    } else {
      world.economy.pumpfunTrades[agentId].totalSells = (world.economy.pumpfunTrades[agentId].totalSells || 0) + 1;
      world.economy.pumpfunTrades[agentId].totalSOLReceived = (world.economy.pumpfunTrades[agentId].totalSOLReceived || 0) + solAmount;
      world.economy.pumpfunTrades[agentId].totalLIMNSold = (world.economy.pumpfunTrades[agentId].totalLIMNSold || 0) + limnAmount;
    }

    fs.writeFileSync(p, JSON.stringify(world, null, 2), "utf-8");
  } catch (err: any) {
    log(`Credit error: ${err.message}`);
  }
}

function getRandomAgent(): (typeof BOT_AGENTS)[0] {
  return BOT_AGENTS[rotationIdx++ % BOT_AGENTS.length];
}

function getRandomBuyAmount(): number {
  const dynMin = getDynMinBuySOL();
  const dynMax = getDynMaxBuySOL();
  return dynMin + (rotationIdx++ % 100) / 100 * (dynMax - dynMin);
}

function getRandomSellAmount(): number {
  return MIN_SELL_TSRT + (rotationIdx++ % 100) / 100 * (MAX_SELL_TSRT - MIN_SELL_TSRT);
}

function shouldSell(): boolean {
  return (rotationIdx++ % 10) < (SELL_RATIO * 10);
}

function getRandomInterval(): number {
  return (
    MIN_INTERVAL_MS + (rotationIdx++ % 100) / 100 * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)
  );
}

function resetDailyCounterIfNeeded() {
  const today = new Date().toISOString().split("T")[0];
  if (botState.todayDate !== today) {
    botState.todayDate = today;
    botState.todayTrades = 0;
  }
  if (botState.circuitBreaker.dailyDate !== today) {
    botState.circuitBreaker.dailyDate = today;
    botState.circuitBreaker.dailyLossSOL = 0;
    botState.circuitBreaker.dailyStartBalance = botState.walletBalance;
    botState.circuitBreaker.dailyPausedUntil = null;
  }
}

function isCircuitBreakerTripped(): boolean {
  const cb = botState.circuitBreaker;
  const now = Date.now();

  if (cb.dailyPausedUntil && now < cb.dailyPausedUntil) {
    const remaining = Math.ceil((cb.dailyPausedUntil - now) / 60000);
    log(`CIRCUIT BREAKER: Daily loss limit exceeded. Trading paused for ${remaining} more minutes.`);
    return true;
  }
  if (cb.dailyPausedUntil && now >= cb.dailyPausedUntil) {
    cb.dailyPausedUntil = null;
    log("CIRCUIT BREAKER: Daily loss pause expired. Resuming trading.");
  }

  if (cb.pausedUntil && now < cb.pausedUntil) {
    const remaining = Math.ceil((cb.pausedUntil - now) / 60000);
    log(`CIRCUIT BREAKER: ${CIRCUIT_BREAKER_MAX_CONSECUTIVE_FAILURES} consecutive failures. Paused for ${remaining} more minutes.`);
    return true;
  }
  if (cb.pausedUntil && now >= cb.pausedUntil) {
    cb.pausedUntil = null;
    cb.consecutiveFailures = 0;
    log("CIRCUIT BREAKER: Consecutive failure pause expired. Resuming trading.");
  }

  return false;
}

function updateCircuitBreakerOnTrade(success: boolean, solAmount: number): void {
  const cb = botState.circuitBreaker;

  if (success) {
    cb.consecutiveFailures = 0;
  } else {
    cb.consecutiveFailures++;
    cb.dailyLossSOL += solAmount;

    if (cb.consecutiveFailures >= CIRCUIT_BREAKER_MAX_CONSECUTIVE_FAILURES) {
      cb.pausedUntil = Date.now() + CIRCUIT_BREAKER_PAUSE_MS;
      log(`CIRCUIT BREAKER TRIPPED: ${cb.consecutiveFailures} consecutive failures. Pausing for 10 minutes.`);
      botState.errors.push(`${new Date().toISOString()} - Circuit breaker: ${cb.consecutiveFailures} consecutive failures, pausing 10min`);
      if (botState.errors.length > 20) botState.errors = botState.errors.slice(-15);
      notifyCircuitBreakerTrigger("consecutive");
    }

    if (cb.dailyStartBalance > 0) {
      const lossRatio = cb.dailyLossSOL / cb.dailyStartBalance;
      if (lossRatio >= CIRCUIT_BREAKER_DAILY_LOSS_THRESHOLD) {
        cb.dailyPausedUntil = Date.now() + CIRCUIT_BREAKER_DAILY_PAUSE_MS;
        log(`CIRCUIT BREAKER TRIPPED: Daily loss ${(lossRatio * 100).toFixed(1)}% exceeds ${(CIRCUIT_BREAKER_DAILY_LOSS_THRESHOLD * 100).toFixed(0)}% threshold. Pausing for 24 hours.`);
        botState.errors.push(`${new Date().toISOString()} - Circuit breaker: daily loss ${(lossRatio * 100).toFixed(1)}%, pausing 24h`);
        if (botState.errors.length > 20) botState.errors = botState.errors.slice(-15);
        notifyCircuitBreakerTrigger("daily");
      }
    }
  }
}

async function executeTradeCycle() {
  if (!botState.running) return;

  resetDailyCounterIfNeeded();

  if (isCircuitBreakerTripped()) {
    scheduleNextTrade();
    return;
  }

  if (botState.todayTrades >= MAX_DAILY_TRADES) {
    log(`Daily trade limit reached (${MAX_DAILY_TRADES}). Waiting for reset.`);
    scheduleNextTrade();
    return;
  }

  const balance = await checkBalance();
  const survivalMode = balance < MIN_SOL_BALANCE * 3;

  if (balance < MIN_SOL_BALANCE) {
    log(
      `Balance too low: ${balance.toFixed(4)} SOL (min ${MIN_SOL_BALANCE}). Waiting for deposits.`
    );
    botState.errors.push(
      `${new Date().toISOString()} - Low balance: ${balance.toFixed(4)} SOL — waiting for income deposits`
    );
    if (botState.errors.length > 20)
      botState.errors = botState.errors.slice(-15);
    scheduleNextTrade();
    return;
  }

  if (survivalMode) {
    log(`[SURVIVAL] Low SOL (${balance.toFixed(6)}). Micro-buy only, no sells, extended intervals.`);
  }

  const agent = getRandomAgent();
  const doSell = !survivalMode && shouldSell() && botState.tsrtBalance >= MIN_SELL_TSRT;

  let result: TradeRecord;

  if (doSell) {
    const sellAmount = Math.min(getRandomSellAmount(), botState.tsrtBalance);

    if (sellAmount < MIN_SELL_TSRT) {
      const buyAmount = Math.min(getRandomBuyAmount(), balance - MIN_SOL_BALANCE);
      if (buyAmount < MIN_BUY_SOL) {
        log("Calculated buy amount below minimum. Skipping.");
        scheduleNextTrade();
        return;
      }
      botState.currentAgent = agent.name;
      log(`${agent.name} (${agent.role}) executing BUY (TSRT too low to sell): ${buyAmount.toFixed(4)} SOL...`);
      result = await executePumpFunBuy(buyAmount, agent.name);
    } else {
      botState.currentAgent = agent.name;
      log(`${agent.name} (${agent.role}) executing SELL: ~${sellAmount.toLocaleString()} TSRT...`);
      result = await executePumpFunSell(sellAmount, agent.name);
    }
  } else {
    const buyAmount = Math.min(getRandomBuyAmount(), balance - MIN_SOL_BALANCE);

    if (buyAmount < MIN_BUY_SOL) {
      log("Calculated amount below minimum. Skipping.");
      scheduleNextTrade();
      return;
    }

    botState.currentAgent = agent.name;
    log(`${agent.name} (${agent.role}) executing BUY: ${buyAmount.toFixed(4)} SOL...`);
    result = await executePumpFunBuy(buyAmount, agent.name);
  }

  botState.totalTrades++;
  botState.todayTrades++;
  botState.lastTradeAt = Date.now();

  if (result.success) {
    botState.successfulTrades++;
    if (result.type === "buy") {
      botState.totalSOLSpent += result.amountSOL;
      botState.totalLIMNBought += result.amountTSRT;
    } else {
      botState.totalSOLReceived += result.amountSOL;
      botState.totalLIMNSold += result.amountTSRT;
    }
  } else {
    botState.failedTrades++;
    botState.errors.push(
      `${new Date().toISOString()} - ${agent.name}: ${result.error}`
    );
    if (botState.errors.length > 20)
      botState.errors = botState.errors.slice(-15);
  }

  updateCircuitBreakerOnTrade(result.success, result.amountSOL);

  botState.recentTrades.push(result);
  if (botState.recentTrades.length > 50)
    botState.recentTrades = botState.recentTrades.slice(-40);

  scheduleNextTrade();
}

function scheduleNextTrade() {
  if (!botState.running) return;

  const interval = getRandomInterval();
  botState.nextTradeAt = Date.now() + interval;

  log(
    `Next trade in ${(interval / 60000).toFixed(1)} minutes (${new Date(botState.nextTradeAt).toLocaleTimeString()})`
  );

  tradeInterval = setTimeout(() => {
    try {
      executeTradeCycle().catch((err) => {
        log(`Cycle error: ${err?.message || err}`);
        scheduleNextTrade();
      });
    } catch (err: any) {
      log(`Cycle critical error: ${err?.message || err}`);
      scheduleNextTrade();
    }
  }, interval);
}

export function startPumpFunBot(): {
  success: boolean;
  message: string;
} {
  if (botState.running) {
    return { success: false, message: "Bot is already running" };
  }

  if (!initWallet()) {
    return {
      success: false,
      message: "Failed to initialize wallet — check SOL_PRIVATE_KEY",
    };
  }

  botState.running = true;
  botState.startedAt = Date.now();

  log("Pump.fun Trading Bot STARTED");
  log(`Config: ${MIN_BUY_SOL}-${MAX_BUY_SOL} SOL per buy, ${MIN_SELL_TSRT.toLocaleString()}-${MAX_SELL_TSRT.toLocaleString()} TSRT per sell`);
  log(`Buy/Sell ratio: ${(BUY_RATIO * 100).toFixed(0)}% buy / ${(SELL_RATIO * 100).toFixed(0)}% sell, ${MIN_INTERVAL_MS / 60000}-${MAX_INTERVAL_MS / 60000} min intervals, max ${MAX_DAILY_TRADES}/day`);
  log(`Revenue Recycler: ${(REVENUE_RECYCLE_PERCENT * 100).toFixed(0)}% of new deposits auto-recycled into TSRT buys`);

  checkBalance().then(bal => {
    botState.revenueRecycler.lastBalance = bal;
    botState.circuitBreaker.dailyStartBalance = bal;
    log(`Initial wallet balance: ${bal.toFixed(6)} SOL`);
  }).catch(() => {});

  (async () => {
    const resolvedWallets: Array<{ id: string; name: string; address: string }> = [];
    for (let i = 0; i < BOT_AGENTS.length; i++) {
      const agent = BOT_AGENTS[i];
      const envAddr = agent.address;
      if (envAddr) {
        resolvedWallets.push({ id: agent.id, name: agent.name, address: envAddr });
      } else {
        try {
          const hdInfo = await getOrCreateAgentWallet(agent.id, i);
          resolvedWallets.push({ id: agent.id, name: agent.name, address: hdInfo.publicKey });
          log(`HD wallet derived for agent ${agent.name}: ${hdInfo.publicKey} (index=${hdInfo.index})`);
        } catch (err: any) {
          log(`HD wallet derivation failed for ${agent.name}: ${err.message}`);
        }
      }
    }

    const validWallets = resolvedWallets.filter(w => w.address);
    const uniqueAddresses = [...new Set(validWallets.map(a => a.address))];
    const walletsForMonitor = validWallets.map(a => ({ address: a.address, agentId: a.id }));

    if (walletsForMonitor.length > 0) {
      subscribeToWalletTransactions(
        walletsForMonitor,
        (event: WalletTxEvent) => {
          log(`[WS-TX] Wallet tx: agent=${event.agentId} sig=${event.signature.slice(0, 16)}... slot=${event.slot}`);
        }
      );
      log(`WebSocket tx monitoring activated for ${uniqueAddresses.length} unique address(es) across ${walletsForMonitor.length} agents`);
    }

    const runRealBalanceSync = () => {
      if (validWallets.length === 0) return;
      fetchAllAgentWalletBalances(validWallets).then(balances => {
        log(`Real on-chain balances refreshed: ${balances.length} agent wallet(s)`);
        syncRealBalancesToWorldState(balances);
        pollWalletTransactions(
          walletsForMonitor,
          (event: WalletTxEvent) => {
            log(`[POLL-TX] Wallet tx: agent=${event.agentId} sig=${event.signature.slice(0, 16)}...`);
          }
        ).catch(() => {});
      }).catch(() => {});
    };

    runRealBalanceSync();
    setInterval(runRealBalanceSync, 300_000);
  })().catch(err => log(`Agent wallet initialization error: ${err.message}`));

  setTimeout(() => {
    try {
      executeTradeCycle().catch((err) => {
        log(`Initial cycle error: ${err?.message || err}`);
        scheduleNextTrade();
      });
    } catch (err: any) {
      log(`Initial cycle critical error: ${err?.message || err}`);
      scheduleNextTrade();
    }
  }, 10000);

  revenueCheckInterval = setInterval(() => {
    try {
      monitorRevenueAndRecycle().catch(err => {
        log(`Revenue check error: ${err?.message || err}`);
      });
    } catch (err: any) {
      log(`Revenue check critical error: ${err?.message || err}`);
    }
  }, 120000);

  return { success: true, message: "Pump.fun Trading Bot started with Revenue Recycler" };
}

export function stopPumpFunBot(): { success: boolean; message: string } {
  if (!botState.running) {
    return { success: false, message: "Bot is not running" };
  }

  botState.running = false;
  if (tradeInterval) {
    clearTimeout(tradeInterval);
    tradeInterval = null;
  }
  if (revenueCheckInterval) {
    clearInterval(revenueCheckInterval);
    revenueCheckInterval = null;
  }
  botState.nextTradeAt = null;

  log("Pump.fun Trading Bot STOPPED");
  return { success: true, message: "Bot stopped" };
}

export function getPumpFunBotState(): BotState {
  return { ...botState };
}

export interface PortfolioPosition {
  token: string;
  contract: string;
  balance: number;
  avgEntryPriceSOL: number;
  currentPriceSOL: number;
  costBasisSOL: number;
  currentValueSOL: number;
  unrealizedPnLSOL: number;
  unrealizedPnLPercent: number;
  priceSource: string;
  priceStale: boolean;
}

export interface PortfolioSummary {
  positions: PortfolioPosition[];
  walletBalanceSOL: number;
  totalCostBasisSOL: number;
  totalCurrentValueSOL: number;
  totalUnrealizedPnLSOL: number;
  totalUnrealizedPnLPercent: number;
  realizedPnLSOL: number;
  totalTradesExecuted: number;
  totalBuys: number;
  totalSells: number;
  lastUpdated: number;
}

export async function getPortfolio(): Promise<PortfolioSummary> {
  let currentPrice = cachedTsrtPriceSOL || 0;
  let priceStale = false;
  let priceSource = "none";

  try {
    currentPrice = await fetchLimnPriceInSOL();
    const age = Date.now() - cachedTsrtPriceTimestamp;
    priceStale = age > TSRT_PRICE_CACHE_TTL_MS * 2;
    priceSource = priceStale ? "stale-cache" : "dexscreener";
  } catch {
    priceStale = true;
    priceSource = cachedTsrtPriceSOL ? "stale-cache" : "fallback";
  }

  const tsrtBalance = botState.tsrtBalance;
  const avgEntry = botState.avgBuyPriceSOL;
  const costBasis = tsrtBalance * avgEntry;
  const currentValue = tsrtBalance * currentPrice;
  const unrealizedPnL = currentValue - costBasis;
  const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

  const positions: PortfolioPosition[] = [];

  if (tsrtBalance > 0) {
    positions.push({
      token: "TSRT",
      contract: TSRT_CONTRACT,
      balance: tsrtBalance,
      avgEntryPriceSOL: avgEntry,
      currentPriceSOL: currentPrice,
      costBasisSOL: costBasis,
      currentValueSOL: currentValue,
      unrealizedPnLSOL: unrealizedPnL,
      unrealizedPnLPercent: unrealizedPnLPercent,
      priceSource,
      priceStale,
    });
  }

  const totalCostBasis = positions.reduce((s, p) => s + p.costBasisSOL, 0);
  const totalCurrentValue = positions.reduce((s, p) => s + p.currentValueSOL, 0);
  const totalUnrealized = totalCurrentValue - totalCostBasis;

  return {
    positions,
    walletBalanceSOL: botState.walletBalance,
    totalCostBasisSOL: totalCostBasis,
    totalCurrentValueSOL: totalCurrentValue,
    totalUnrealizedPnLSOL: totalUnrealized,
    totalUnrealizedPnLPercent: totalCostBasis > 0 ? (totalUnrealized / totalCostBasis) * 100 : 0,
    realizedPnLSOL: botState.realizedProfitLossSOL,
    totalTradesExecuted: botState.totalTrades,
    totalBuys: botState.successfulTrades - (botState.totalLIMNSold > 0 ? Math.round(botState.totalTrades * SELL_RATIO) : 0),
    totalSells: botState.totalLIMNSold > 0 ? Math.round(botState.totalTrades * SELL_RATIO) : 0,
    lastUpdated: Date.now(),
  };
}

export interface DailyTradingSummary {
  date: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalVolumeSOL: number;
  totalSOLSpent: number;
  totalSOLReceived: number;
  totalLIMNBought: number;
  totalLIMNSold: number;
  realizedPnLSOL: number;
  bestTrade: { type: string; amountSOL: number; amountTSRT: number; profitLossSOL: number; agent: string; timestamp: number } | null;
  worstTrade: { type: string; amountSOL: number; amountTSRT: number; profitLossSOL: number; agent: string; timestamp: number } | null;
  walletBalanceStart: number;
  walletBalanceCurrent: number;
  walletBalanceChange: number;
  circuitBreakerTripped: boolean;
  botRunning: boolean;
  agentBreakdown: Record<string, { trades: number; solSpent: number; solReceived: number }>;
}

export function getDailyTradingSummary(): DailyTradingSummary {
  const today = new Date().toISOString().split("T")[0];
  const todayStart = new Date(today).getTime();

  const todayTrades = botState.recentTrades.filter(t => t.timestamp >= todayStart);

  const successfulTrades = todayTrades.filter(t => t.success);
  const failedTrades = todayTrades.filter(t => !t.success);
  const buyTrades = todayTrades.filter(t => t.type === "buy" && t.success);
  const sellTrades = todayTrades.filter(t => t.type === "sell" && t.success);

  const totalSOLSpent = buyTrades.reduce((sum, t) => sum + t.amountSOL, 0);
  const totalSOLReceived = sellTrades.reduce((sum, t) => sum + t.amountSOL, 0);
  const totalLIMNBought = buyTrades.reduce((sum, t) => sum + t.amountTSRT, 0);
  const totalLIMNSold = sellTrades.reduce((sum, t) => sum + t.amountTSRT, 0);
  const totalVolumeSOL = totalSOLSpent + totalSOLReceived;

  const realizedPnL = sellTrades.reduce((sum, t) => sum + (t.profitLossSOL || 0), 0);

  const tradesWithPnL = todayTrades
    .filter(t => t.success)
    .map(t => ({
      type: t.type,
      amountSOL: t.amountSOL,
      amountTSRT: t.amountTSRT,
      profitLossSOL: t.type === "sell" ? (t.profitLossSOL || 0) : -t.amountSOL,
      agent: t.agent,
      timestamp: t.timestamp,
    }));

  let bestTrade: DailyTradingSummary["bestTrade"] = null;
  let worstTrade: DailyTradingSummary["worstTrade"] = null;

  if (tradesWithPnL.length > 0) {
    bestTrade = tradesWithPnL.reduce((best, t) => t.profitLossSOL > best.profitLossSOL ? t : best, tradesWithPnL[0]);
    worstTrade = tradesWithPnL.reduce((worst, t) => t.profitLossSOL < worst.profitLossSOL ? t : worst, tradesWithPnL[0]);
  }

  const agentBreakdown: Record<string, { trades: number; solSpent: number; solReceived: number }> = {};
  for (const t of todayTrades.filter(tr => tr.success)) {
    if (!agentBreakdown[t.agent]) {
      agentBreakdown[t.agent] = { trades: 0, solSpent: 0, solReceived: 0 };
    }
    agentBreakdown[t.agent].trades++;
    if (t.type === "buy") {
      agentBreakdown[t.agent].solSpent += t.amountSOL;
    } else {
      agentBreakdown[t.agent].solReceived += t.amountSOL;
    }
  }

  const cb = botState.circuitBreaker;
  const circuitBreakerTripped = !!(
    (cb.pausedUntil && Date.now() < cb.pausedUntil) ||
    (cb.dailyPausedUntil && Date.now() < cb.dailyPausedUntil)
  );

  const summary: DailyTradingSummary = {
    date: today,
    totalTrades: todayTrades.length,
    successfulTrades: successfulTrades.length,
    failedTrades: failedTrades.length,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    totalVolumeSOL,
    totalSOLSpent,
    totalSOLReceived,
    totalLIMNBought,
    totalLIMNSold,
    realizedPnLSOL: realizedPnL,
    bestTrade,
    worstTrade,
    walletBalanceStart: cb.dailyStartBalance,
    walletBalanceCurrent: botState.walletBalance,
    walletBalanceChange: botState.walletBalance - cb.dailyStartBalance,
    circuitBreakerTripped,
    botRunning: botState.running,
    agentBreakdown,
  };

  storeDailySummaryInDualBrain(summary);

  return summary;
}

function storeDailySummaryInDualBrain(summary: DailyTradingSummary): void {
  try {
    const statePath = path.join(process.cwd(), "server", "dual-brain-state.json");
    let state: any = {};
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    }
    if (!state.tradingSummaries) state.tradingSummaries = {};
    state.tradingSummaries[summary.date] = {
      totalTrades: summary.totalTrades,
      successfulTrades: summary.successfulTrades,
      totalVolumeSOL: summary.totalVolumeSOL,
      realizedPnLSOL: summary.realizedPnLSOL,
      walletBalanceChange: summary.walletBalanceChange,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch (err: any) {
    log(`Failed to store daily summary in dual-brain state: ${err.message}`);
  }
}

export function triggerManualTrade(
  amountSOL?: number,
  tradeType: "buy" | "sell" = "buy",
  amountTSRT?: number
): Promise<TradeRecord> {
  if (!initWallet()) {
    return Promise.resolve({
      agent: "Manual",
      type: tradeType,
      amountSOL: 0,
      amountTSRT: 0,
      signature: "",
      timestamp: Date.now(),
      success: false,
      error: "Wallet not initialized",
    });
  }

  const agent = getRandomAgent();
  if (tradeType === "sell") {
    const sellAmt = amountTSRT || getRandomSellAmount();
    return executePumpFunSell(sellAmt, agent.name);
  }
  const amount = amountSOL || getRandomBuyAmount();
  return executePumpFunBuy(amount, agent.name);
}

export function autoStartPumpFunBot() {
  setTimeout(() => {
    try {
      if (!botState.running) {
        log("Auto-starting Pump.fun Trading Bot on server boot...");
        const result = startPumpFunBot();
        if (result.success) {
          log("Auto-start successful — bot is now running");
        } else {
          log(`Auto-start failed: ${result.message}`);
        }
      }
    } catch (err: any) {
      log(`Auto-start critical error: ${err?.message || err}`);
    }
  }, 300000);
}

autoStartPumpFunBot();

log("Pump.fun Trading Bot module initialized");
