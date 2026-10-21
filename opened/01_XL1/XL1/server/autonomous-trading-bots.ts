import { Connection, Keypair, VersionedTransaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import path from "path";
import { getKeypair as getCentralKeypair } from "./sol-wallet";

const TSRT_CONTRACT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const FATHER_WALLET = process.env.SOL_WALLET || "";
const COMMUNITY_WALLET = process.env.SOL_WALLET || "[FATHER-WALLET]";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const PUMPPORTAL_API = "https://pumpportal.fun/api/trade-local";
const DEXSCREENER_API = "https://api.jup.ag/price/v2?ids=";

let _atbCounter = 0;

const clog = (msg: string) => console.log(`[TradingBots] ${msg}`);

const MAX_BACKUPS = 5;
const WORLD_STATE_PATH = "server/world-state.json";

function rotateBackup(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `${base}.backup-${timestamp}${ext}`;
    const backupPath = path.join(dir, backupName);
    fs.copyFileSync(filePath, backupPath);
    const backupPattern = new RegExp(`^${base}\\.backup-.*${ext.replace(".", "\\.")}$`);
    const allBackups = fs.readdirSync(dir)
      .filter(f => backupPattern.test(f))
      .sort();
    while (allBackups.length > MAX_BACKUPS) {
      const oldest = allBackups.shift()!;
      fs.unlinkSync(path.join(dir, oldest));
    }
  } catch (err: any) {
    clog(`Backup rotation error: ${err.message}`);
  }
}

function writeWorldState(wsData: any): void {
  rotateBackup(WORLD_STATE_PATH);
  fs.writeFileSync(WORLD_STATE_PATH, JSON.stringify(wsData, null, 2));
}

interface BotConfig {
  id: string;
  name: string;
  type: BotType;
  role: string;
  capabilities: string[];
  active: boolean;
  totalActions: number;
  successfulActions: number;
  lastAction: number;
  cooldownMs: number;
  settings: Record<string, any>;
}

type BotType = "snipe" | "volume" | "buy" | "scanner" | "bundle" | "cluster" | "auto-trade" | "burn" | "lock" | "staking" | "halving" | "tokenomics";

interface BotAction {
  id: string;
  botId: string;
  botType: BotType;
  action: string;
  params: Record<string, any>;
  consensusRequired: boolean;
  consensusResult?: { approved: boolean; votes: number; required: number; voters: string[] };
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  result?: any;
  timestamp: number;
  txSignature?: string;
}

interface MarketData {
  price: number;
  volume24h: number;
  priceChange24h: number;
  buys24h: number;
  sells24h: number;
  liquidity: number;
  marketCap: number;
  lastUpdated: number;
}

interface CircuitBreakerState {
  consecutiveFailures: number;
  pausedUntil: number | null;
  dailyPausedUntil: number | null;
  dailyStartBalance: number;
  dailyLossSOL: number;
  dailyDate: string;
}

const CB_MAX_CONSECUTIVE_FAILURES = 3;
const CB_PAUSE_MS = 10 * 60 * 1000;
const CB_DAILY_LOSS_THRESHOLD = 0.20;
const CB_DAILY_PAUSE_MS = 24 * 60 * 60 * 1000;

interface TradingPosition {
  id: string;
  botId: string;
  entryPrice: number;
  amountSOL: number;
  openedAt: number;
  txSignature?: string;
  stopLossPrice: number;
  takeProfitPrice: number;
  status: "open" | "closed-stop-loss" | "closed-take-profit" | "closed-manual";
  closedAt?: number;
  closePrice?: number;
  profitLossPercent?: number;
}

const STOP_LOSS_PERCENT = -10;
const TAKE_PROFIT_PERCENT = 25;

let walletKeypair: Keypair | null = null;
let connection: Connection | null = null;
let marketData: MarketData = { price: 0, volume24h: 0, priceChange24h: 0, buys24h: 0, sells24h: 0, liquidity: 0, marketCap: 0, lastUpdated: 0 };
let actionHistory: BotAction[] = [];
let openPositions: TradingPosition[] = [];
let closedPositions: TradingPosition[] = [];
let botSuiteRunning = false;
let marketSyncInterval: NodeJS.Timeout | null = null;
let botCycleInterval: NodeJS.Timeout | null = null;

const circuitBreaker: CircuitBreakerState = {
  consecutiveFailures: 0,
  pausedUntil: null,
  dailyPausedUntil: null,
  dailyStartBalance: 0,
  dailyLossSOL: 0,
  dailyDate: new Date().toISOString().split("T")[0],
};

function isCircuitBreakerTripped(): boolean {
  const now = Date.now();

  if (circuitBreaker.dailyPausedUntil && now < circuitBreaker.dailyPausedUntil) {
    const remaining = Math.ceil((circuitBreaker.dailyPausedUntil - now) / 60000);
    clog(`CIRCUIT BREAKER: Daily loss limit exceeded. Trading paused for ${remaining} more minutes.`);
    return true;
  }
  if (circuitBreaker.dailyPausedUntil && now >= circuitBreaker.dailyPausedUntil) {
    circuitBreaker.dailyPausedUntil = null;
    clog("CIRCUIT BREAKER: Daily loss pause expired. Resuming trading.");
  }

  if (circuitBreaker.pausedUntil && now < circuitBreaker.pausedUntil) {
    const remaining = Math.ceil((circuitBreaker.pausedUntil - now) / 60000);
    clog(`CIRCUIT BREAKER: ${CB_MAX_CONSECUTIVE_FAILURES} consecutive failures. Paused for ${remaining} more minutes.`);
    return true;
  }
  if (circuitBreaker.pausedUntil && now >= circuitBreaker.pausedUntil) {
    circuitBreaker.pausedUntil = null;
    circuitBreaker.consecutiveFailures = 0;
    clog("CIRCUIT BREAKER: Consecutive failure pause expired. Resuming trading.");
  }

  return false;
}

function resetDailyCircuitBreaker(): void {
  const today = new Date().toISOString().split("T")[0];
  if (circuitBreaker.dailyDate !== today) {
    circuitBreaker.dailyDate = today;
    circuitBreaker.dailyLossSOL = 0;
    circuitBreaker.dailyPausedUntil = null;
    getWalletBalance().then(bal => {
      circuitBreaker.dailyStartBalance = bal;
    }).catch(() => {});
  }
}

function updateCircuitBreakerOnTrade(success: boolean, solAmount: number): void {
  if (success) {
    circuitBreaker.consecutiveFailures = 0;
  } else {
    circuitBreaker.consecutiveFailures++;
    circuitBreaker.dailyLossSOL += solAmount;

    if (circuitBreaker.consecutiveFailures >= CB_MAX_CONSECUTIVE_FAILURES) {
      circuitBreaker.pausedUntil = Date.now() + CB_PAUSE_MS;
      clog(`CIRCUIT BREAKER TRIPPED: ${circuitBreaker.consecutiveFailures} consecutive failures. Pausing for 10 minutes.`);
    }

    if (circuitBreaker.dailyStartBalance > 0) {
      const lossRatio = circuitBreaker.dailyLossSOL / circuitBreaker.dailyStartBalance;
      if (lossRatio >= CB_DAILY_LOSS_THRESHOLD) {
        circuitBreaker.dailyPausedUntil = Date.now() + CB_DAILY_PAUSE_MS;
        clog(`CIRCUIT BREAKER TRIPPED: Daily loss ${(lossRatio * 100).toFixed(1)}% exceeds ${(CB_DAILY_LOSS_THRESHOLD * 100).toFixed(0)}% threshold. Pausing for 24 hours.`);
      }
    }
  }
}

const bots: Map<string, BotConfig> = new Map();

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
    if (!key) { clog("No wallet available — bots in simulation mode"); return false; }
    if (key.startsWith("[")) {
      const arr = JSON.parse(key);
      walletKeypair = Keypair.fromSecretKey(new Uint8Array(arr));
    } else {
      walletKeypair = Keypair.fromSecretKey(bs58.decode(key));
    }
    connection = new Connection(RPC_URL, "confirmed");
    clog(`Wallet: ${walletKeypair.publicKey.toBase58()}`);
    return true;
  } catch (err: any) {
    clog(`Wallet init error: ${err.message}`);
    return false;
  }
}

function initBots(): void {
  const botDefs: Array<{ type: BotType; name: string; role: string; caps: string[]; cooldown: number; settings: Record<string, any> }> = [
    {
      type: "snipe", name: "SnipeBot-Alpha", role: "Rapid token acquisition on new listings",
      caps: ["detect-new-pairs", "instant-buy", "front-run-detection", "mev-protection"],
      cooldown: 5000,
      settings: { maxSlippage: 15, maxBuyAmount: 0.01, minLiquidity: 100, autoSell: false }
    },
    {
      type: "volume", name: "VolumeBot-Prime", role: "Generate organic trading volume",
      caps: ["volume-generation", "wash-trade-detection", "spread-management", "depth-creation"],
      cooldown: 30000,
      settings: { minTradeSize: 0.0005, maxTradeSize: 0.002, tradesPerCycle: 3, targetVolume: 50 }
    },
    {
      type: "buy", name: "BuyBot-Omega", role: "Strategic accumulation and buy pressure",
      caps: ["dca-buying", "limit-orders", "buy-wall-creation", "accumulation-strategy"],
      cooldown: 60000,
      settings: { buyAmount: 0.001, dcaInterval: 300000, maxDailyBuys: 20, buyOnDip: true, dipThreshold: -5 }
    },
    {
      type: "scanner", name: "SolScanner-Eye", role: "Monitor Solana network for opportunities",
      caps: ["whale-tracking", "wallet-monitoring", "transaction-analysis", "risk-scoring"],
      cooldown: 10000,
      settings: { trackWallets: [FATHER_WALLET, COMMUNITY_WALLET], alertThreshold: 0.1, scanInterval: 15000 }
    },
    {
      type: "bundle", name: "BundleBot-Nexus", role: "Bundle multiple transactions for efficiency",
      caps: ["tx-bundling", "batch-execution", "gas-optimization", "atomic-swaps"],
      cooldown: 45000,
      settings: { maxBundleSize: 5, priorityFee: 0.00001, bundleTimeout: 30000 }
    },
    {
      type: "cluster", name: "ClusterBot-Hive", role: "Coordinate multi-wallet cluster operations",
      caps: ["multi-wallet-coordination", "distributed-buying", "pattern-masking", "cluster-analysis"],
      cooldown: 60000,
      settings: { clusterSize: 3, distributionPattern: "random", timingSpread: 5000 }
    },
    {
      type: "auto-trade", name: "AutoTrader-Flux", role: "Autonomous algorithmic trading",
      caps: ["algo-trading", "trend-following", "mean-reversion", "momentum-detection"],
      cooldown: 30000,
      settings: { strategy: "trend-follow", riskLevel: "medium", maxPosition: 0.05, stopLoss: -10, takeProfit: 20 }
    },
    {
      type: "burn", name: "BurnBot-Phoenix", role: "Manage token burn mechanics",
      caps: ["token-burning", "supply-reduction", "burn-scheduling", "deflation-management"],
      cooldown: 300000,
      settings: { burnPercentage: 2, burnFrequency: "per-transaction", minBurnAmount: 1000, autoBurn: true }
    },
    {
      type: "lock", name: "LockBot-Vault", role: "Token locking and vesting management",
      caps: ["liquidity-locking", "vesting-schedules", "time-locks", "lock-extensions"],
      cooldown: 600000,
      settings: { defaultLockPeriod: 30, autoRelock: true, lockPercentage: 10, vestingCliff: 7 }
    },
    {
      type: "staking", name: "StakeBot-Anchor", role: "Staking pool management and rewards",
      caps: ["staking-pools", "reward-distribution", "apy-calculation", "compound-staking"],
      cooldown: 120000,
      settings: { baseAPY: 12, stakingMinimum: 100, rewardInterval: 86400000, compoundEnabled: true }
    },
    {
      type: "halving", name: "HalvingBot-Epoch", role: "Manage emission halving schedule",
      caps: ["halving-schedule", "emission-control", "supply-pacing", "epoch-management"],
      cooldown: 3600000,
      settings: { halvingInterval: 210000, currentEpoch: 1, reductionFactor: 0.5, nextHalvingBlock: 210000 }
    },
    {
      type: "tokenomics", name: "TokenomicsBot-Architect", role: "Dynamic tokenomics optimization",
      caps: ["supply-management", "demand-modeling", "price-stability", "economic-policy"],
      cooldown: 300000,
      settings: { targetInflation: 2, maxSupply: 1000000000, circulatingTarget: 0.6, reserveRatio: 0.2 }
    },
  ];

  for (const def of botDefs) {
    const bot: BotConfig = {
      id: `bot-${def.type}`,
      name: def.name,
      type: def.type,
      role: def.role,
      capabilities: def.caps,
      active: true,
      totalActions: 0,
      successfulActions: 0,
      lastAction: 0,
      cooldownMs: def.cooldown,
      settings: def.settings,
    };
    bots.set(bot.id, bot);
  }
  clog(`Initialized ${bots.size} trading bots`);
}

async function fetchMarketData(): Promise<MarketData> {
  try {
    const res = await fetch(`${DEXSCREENER_API}${TSRT_CONTRACT}`);
    const data = await res.json();
    const pair = data.pairs?.[0];
    if (pair) {
      marketData = {
        price: parseFloat(pair.priceUsd) || 0,
        volume24h: pair.volume?.h24 || 0,
        priceChange24h: pair.priceChange?.h24 || 0,
        buys24h: pair.txns?.h24?.buys || 0,
        sells24h: pair.txns?.h24?.sells || 0,
        liquidity: pair.liquidity?.usd || 0,
        marketCap: pair.marketCap || pair.fdv || 0,
        lastUpdated: Date.now(),
      };
    }
  } catch {}
  return marketData;
}

async function getWalletBalance(): Promise<number> {
  if (!connection || !walletKeypair) return 0;
  try {
    const bal = await connection.getBalance(walletKeypair.publicKey);
    return bal / 1e9;
  } catch { return 0; }
}

async function executePumpPortalTrade(action: "buy" | "sell", amountSOL: number): Promise<{ success: boolean; signature?: string; error?: string }> {
  if (!walletKeypair || !connection) return { success: false, error: "Wallet not initialized" };

  if (isCircuitBreakerTripped()) {
    return { success: false, error: "Circuit breaker is active — trading paused" };
  }

  try {
    const balance = await getWalletBalance();
    if (balance < 0.002) return { success: false, error: `Insufficient balance: ${balance.toFixed(6)} SOL` };
    if (amountSOL > balance * 0.5) amountSOL = balance * 0.3;

    const res = await fetch(PUMPPORTAL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: walletKeypair.publicKey.toBase58(),
        action,
        mint: TSRT_CONTRACT,
        denominatedInSol: "true",
        amount: amountSOL,
        slippage: 15,
        priorityFee: 0.00001,
        pool: "pump",
      }),
    });

    if (res.status !== 200) {
      updateCircuitBreakerOnTrade(false, amountSOL);
      return { success: false, error: `PumpPortal ${res.status}` };
    }
    const txData = await res.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
    tx.sign([walletKeypair]);
    const sig = await connection.sendTransaction(tx, { maxRetries: 3 });
    await connection.confirmTransaction(sig, "confirmed");
    updateCircuitBreakerOnTrade(true, amountSOL);
    return { success: true, signature: sig };
  } catch (err: any) {
    updateCircuitBreakerOnTrade(false, amountSOL);
    return { success: false, error: err.message };
  }
}

function evaluateAgentVote(agentRole: string, action: BotAction): boolean {
  const params = action.params || {};
  let score = 50;

  const price = params.marketPrice || marketData.price;
  const liquidity = params.liquidity || marketData.liquidity;
  const priceChange = params.priceChange || marketData.priceChange24h;
  const buySellRatio = marketData.buys24h / Math.max(1, marketData.sells24h);
  const riskScore = params.riskScore || "MEDIUM";

  if (liquidity > 500) score += 10;
  if (liquidity > 2000) score += 5;
  if (liquidity < 100) score -= 20;

  if (price > 0) score += 10;
  if (price <= 0) score -= 30;

  if (priceChange > -15 && priceChange < 30) score += 5;
  if (priceChange < -20) score -= 15;
  if (priceChange > 50) score -= 10;

  if (buySellRatio > 0.8) score += 5;
  if (buySellRatio > 1.5) score += 5;
  if (buySellRatio < 0.3) score -= 15;

  if (riskScore === "LOW") score += 10;
  if (riskScore === "HIGH") score -= 15;

  if (action.botType === "scanner") score += 15;
  if (action.botType === "burn" || action.botType === "lock" || action.botType === "staking") score += 10;
  if (action.botType === "snipe") score -= 5;

  const buyAmount = params.buyAmount || params.maxBuyAmount || params.tradeSize || 0;
  if (buyAmount > 0.01) score -= 10;
  if (buyAmount > 0.05) score -= 15;
  if (buyAmount <= 0.002) score += 5;

  switch (agentRole) {
    case "risk":
      if (riskScore === "HIGH") score -= 10;
      if (buyAmount > 0.005) score -= 5;
      break;
    case "momentum":
      if (buySellRatio > 1.2) score += 10;
      if (priceChange > 5) score += 5;
      break;
    case "conservative":
      if (liquidity < 500) score -= 10;
      if (buyAmount > 0.003) score -= 5;
      break;
  }

  return score >= 50;
}

async function requestConsensus(action: BotAction): Promise<BotAction> {
  try {
    const consensusEngine = await import("./swarm-consensus");
    const result = await consensusEngine.requestSwarmConsensus({
      type: "BOT_ACTION",
      description: `${action.botType} bot: ${action.action}`,
      data: action.params,
      urgency: "normal",
    });
    action.consensusResult = result;
    action.status = result.approved ? "approved" : "rejected";
  } catch {
    const agents: Array<{ name: string; role: string }> = [
      { name: "tessera-prime", role: "risk" },
      { name: "tessera-alpha", role: "momentum" },
      { name: "tessera-beta", role: "conservative" },
      { name: "tessera-solver", role: "risk" },
      { name: "tessera-oracle", role: "momentum" },
      { name: "tessera-creative", role: "conservative" },
      { name: "tessera-detective", role: "risk" },
      { name: "tessera-zeta", role: "momentum" },
      { name: "tessera-eta", role: "conservative" },
      { name: "tessera-theta", role: "risk" },
      { name: "mb-Alpha", role: "momentum" },
      { name: "mb-Beta", role: "conservative" },
      { name: "mb-Oracle", role: "risk" },
      { name: "mb-Gamma", role: "momentum" },
      { name: "mb-Delta", role: "conservative" },
      { name: "mb-Zeta", role: "risk" },
      { name: "mb-Eta", role: "momentum" },
      { name: "mb-Theta", role: "conservative" },
      { name: "mb-Iota", role: "risk" },
      { name: "mb-Kappa", role: "momentum" },
      { name: "mb-Lambda", role: "conservative" },
      { name: "mb-Mu", role: "risk" },
      { name: "mb-Nu", role: "momentum" },
      { name: "mb-Xi", role: "conservative" },
      { name: "mb-Omicron", role: "risk" },
      { name: "tessera-iota", role: "momentum" },
      { name: "tessera-kappa", role: "conservative" },
      { name: "tessera-lambda", role: "risk" },
      { name: "tessera-mu", role: "momentum" },
      { name: "tessera-nu", role: "conservative" },
    ];
    let yesVotes = 0;
    const voterResults: string[] = [];
    for (const agent of agents) {
      const vote = evaluateAgentVote(agent.role, action);
      if (vote) yesVotes++;
      voterResults.push(agent.name);
    }
    const required = Math.ceil(agents.length * 2 / 3);
    action.consensusResult = { approved: yesVotes >= required, votes: yesVotes, required, voters: voterResults };
    action.status = yesVotes >= required ? "approved" : "rejected";
  }
  return action;
}

function openPosition(botId: string, entryPrice: number, amountSOL: number, txSignature?: string): TradingPosition {
  const position: TradingPosition = {
    id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    botId,
    entryPrice,
    amountSOL,
    openedAt: Date.now(),
    txSignature,
    stopLossPrice: entryPrice * (1 + STOP_LOSS_PERCENT / 100),
    takeProfitPrice: entryPrice * (1 + TAKE_PROFIT_PERCENT / 100),
    status: "open",
  };
  openPositions.push(position);
  clog(`Position opened: ${position.id} | entry: $${entryPrice.toFixed(8)} | SL: $${position.stopLossPrice.toFixed(8)} | TP: $${position.takeProfitPrice.toFixed(8)} | ${amountSOL} SOL`);
  return position;
}

function closePosition(position: TradingPosition, reason: "closed-stop-loss" | "closed-take-profit" | "closed-manual", closePrice: number): void {
  position.status = reason;
  position.closedAt = Date.now();
  position.closePrice = closePrice;
  position.profitLossPercent = ((closePrice - position.entryPrice) / position.entryPrice) * 100;
  openPositions = openPositions.filter(p => p.id !== position.id);
  closedPositions.push(position);
  if (closedPositions.length > 200) closedPositions = closedPositions.slice(-150);
  clog(`Position closed (${reason}): ${position.id} | entry: $${position.entryPrice.toFixed(8)} | close: $${closePrice.toFixed(8)} | P&L: ${position.profitLossPercent >= 0 ? "+" : ""}${position.profitLossPercent.toFixed(2)}%`);
}

async function checkStopLossAndTakeProfit(): Promise<void> {
  if (openPositions.length === 0 || marketData.price <= 0) return;

  const currentPrice = marketData.price;
  const positionsToClose: Array<{ position: TradingPosition; reason: "closed-stop-loss" | "closed-take-profit" }> = [];

  for (const position of openPositions) {
    if (currentPrice <= position.stopLossPrice) {
      positionsToClose.push({ position, reason: "closed-stop-loss" });
    } else if (currentPrice >= position.takeProfitPrice) {
      positionsToClose.push({ position, reason: "closed-take-profit" });
    }
  }

  for (const { position, reason } of positionsToClose) {
    clog(`${reason === "closed-stop-loss" ? "STOP-LOSS" : "TAKE-PROFIT"} triggered for position ${position.id} (bot: ${position.botId})`);

    const sellResult = await executePumpPortalTrade("sell", position.amountSOL * 0.5);
    if (sellResult.success) {
      clog(`Auto-close sell executed: ${sellResult.signature}`);
    } else {
      clog(`Auto-close sell failed: ${sellResult.error} — closing position record anyway`);
    }

    closePosition(position, reason, currentPrice);

    const action: BotAction = {
      id: `action-sl-tp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      botId: position.botId,
      botType: "auto-trade",
      action: reason === "closed-stop-loss" ? "stop-loss-triggered" : "take-profit-triggered",
      params: {
        positionId: position.id,
        entryPrice: position.entryPrice,
        closePrice: currentPrice,
        profitLossPercent: position.profitLossPercent,
        amountSOL: position.amountSOL,
      },
      consensusRequired: false,
      status: sellResult.success ? "executed" : "failed",
      result: sellResult,
      timestamp: Date.now(),
      txSignature: sellResult.signature,
    };
    actionHistory.push(action);
  }
}

function createAction(bot: BotConfig, actionName: string, params: Record<string, any>): BotAction {
  return {
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    botId: bot.id,
    botType: bot.type,
    action: actionName,
    params,
    consensusRequired: true,
    status: "pending",
    timestamp: Date.now(),
  };
}

async function runSnipeBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-snipe")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  const action = createAction(bot, "snipe-opportunity-scan", {
    targetToken: TSRT_CONTRACT,
    maxSlippage: bot.settings.maxSlippage,
    maxBuyAmount: bot.settings.maxBuyAmount,
    strategy: "monitor-and-snipe",
    marketPrice: marketData.price,
    liquidity: marketData.liquidity,
  });

  await requestConsensus(action);
  if (action.status === "approved" && marketData.price > 0 && marketData.liquidity > bot.settings.minLiquidity) {
    const tradeAmount = Math.min(bot.settings.maxBuyAmount, 0.001);
    const result = await executePumpPortalTrade("buy", tradeAmount);
    action.result = result;
    action.txSignature = result.signature;
    action.status = result.success ? "executed" : "failed";
    bot.totalActions++;
    if (result.success) {
      bot.successfulActions++;
      openPosition(bot.id, marketData.price, tradeAmount, result.signature);
    }
    creditBotEarnings(bot, result.success);
  }
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runVolumeBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-volume")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  const action = createAction(bot, "generate-volume", {
    targetVolume: bot.settings.targetVolume,
    tradeSize: bot.settings.minTradeSize,
    tradesPlanned: bot.settings.tradesPerCycle,
    currentVolume: marketData.volume24h,
  });

  await requestConsensus(action);
  if (action.status === "approved") {
    const tradeAmount = action.params.tradeSize;
    const result = await executePumpPortalTrade("buy", tradeAmount);
    action.result = result;
    action.txSignature = result.signature;
    action.status = result.success ? "executed" : "failed";
    bot.totalActions++;
    if (result.success) {
      bot.successfulActions++;
      if (marketData.price > 0) openPosition(bot.id, marketData.price, tradeAmount, result.signature);
    }
    creditBotEarnings(bot, result.success);
  }
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runBuyBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-buy")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  const shouldBuyDip = bot.settings.buyOnDip && marketData.priceChange24h < bot.settings.dipThreshold;
  const action = createAction(bot, shouldBuyDip ? "dip-buy" : "dca-buy", {
    buyAmount: bot.settings.buyAmount,
    isDipBuy: shouldBuyDip,
    priceChange: marketData.priceChange24h,
    strategy: shouldBuyDip ? "buy-the-dip" : "dollar-cost-average",
  });

  await requestConsensus(action);
  if (action.status === "approved") {
    const result = await executePumpPortalTrade("buy", bot.settings.buyAmount);
    action.result = result;
    action.txSignature = result.signature;
    action.status = result.success ? "executed" : "failed";
    bot.totalActions++;
    if (result.success) {
      bot.successfulActions++;
      if (marketData.price > 0) openPosition(bot.id, marketData.price, bot.settings.buyAmount, result.signature);
    }
    creditBotEarnings(bot, result.success);
  }
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runScannerBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-scanner")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  let walletBalances: Record<string, number> = {};
  if (connection) {
    for (const addr of bot.settings.trackWallets) {
      try {
        const bal = await connection.getBalance(new PublicKey(addr));
        walletBalances[addr] = bal / 1e9;
      } catch { walletBalances[addr] = 0; }
    }
  }

  const action = createAction(bot, "network-scan", {
    walletBalances,
    marketData: { price: marketData.price, volume: marketData.volume24h, buySellRatio: marketData.buys24h / Math.max(1, marketData.sells24h) },
    alerts: [],
    riskScore: marketData.sells24h > marketData.buys24h * 2 ? "HIGH" : marketData.sells24h > marketData.buys24h ? "MEDIUM" : "LOW",
  });

  await requestConsensus(action);
  action.status = action.consensusResult?.approved ? "executed" : "rejected";
  bot.totalActions++;
  bot.successfulActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runBundleBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-bundle")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  const pendingActions = actionHistory.filter(a => a.status === "approved" && !a.txSignature).slice(0, bot.settings.maxBundleSize);
  const action = createAction(bot, "bundle-transactions", {
    bundleSize: pendingActions.length,
    actions: pendingActions.map(a => ({ id: a.id, type: a.botType, action: a.action })),
    gasOptimization: true,
    priorityFee: bot.settings.priorityFee,
  });

  await requestConsensus(action);
  action.status = action.consensusResult?.approved ? "executed" : "rejected";
  bot.totalActions++;
  if (action.consensusResult?.approved) bot.successfulActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runClusterBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-cluster")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  const action = createAction(bot, "cluster-coordination", {
    clusterSize: bot.settings.clusterSize,
    distributionPattern: bot.settings.distributionPattern,
    activeBots: Array.from(bots.values()).filter(b => b.active).map(b => b.id),
    syncStatus: "coordinated",
    timingSpread: bot.settings.timingSpread,
  });

  await requestConsensus(action);
  action.status = action.consensusResult?.approved ? "executed" : "rejected";
  bot.totalActions++;
  if (action.consensusResult?.approved) bot.successfulActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runAutoTradeBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-auto-trade")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  let signal: "buy" | "sell" | "hold" = "hold";
  if (marketData.priceChange24h > 5 && marketData.buys24h > marketData.sells24h * 1.5) signal = "buy";
  else if (marketData.priceChange24h < -10) signal = "sell";
  else if (marketData.priceChange24h < bot.settings.stopLoss) signal = "sell";
  else if (marketData.priceChange24h > bot.settings.takeProfit) signal = "sell";
  else if (marketData.buys24h > marketData.sells24h * 2) signal = "buy";

  const action = createAction(bot, `algo-trade-${signal}`, {
    signal,
    strategy: bot.settings.strategy,
    riskLevel: bot.settings.riskLevel,
    indicators: { momentum: marketData.priceChange24h, volumeRatio: marketData.volume24h, buySellRatio: marketData.buys24h / Math.max(1, marketData.sells24h) },
  });

  await requestConsensus(action);
  if (action.status === "approved" && signal !== "hold") {
    const amount = signal === "buy" ? 0.001 : 0.0005;
    const result = await executePumpPortalTrade(signal, amount);
    action.result = result;
    action.txSignature = result.signature;
    action.status = result.success ? "executed" : "failed";
    bot.totalActions++;
    if (result.success) {
      bot.successfulActions++;
      if (signal === "buy" && marketData.price > 0) {
        openPosition(bot.id, marketData.price, amount, result.signature);
      }
    }
    creditBotEarnings(bot, result.success);
  } else if (signal === "hold") {
    action.status = "executed";
    action.result = { held: true, reason: "No strong signal" };
    bot.totalActions++;
    bot.successfulActions++;
  }
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runBurnBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-burn")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  let wsData: any = {};
  try { wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8")); } catch {}
  const circulatingSupply = wsData?.economy?.circulatingSupply || 1000000;
  const burnAmount = circulatingSupply * (bot.settings.burnPercentage / 100);

  const action = createAction(bot, "scheduled-burn", {
    burnAmount,
    burnPercentage: bot.settings.burnPercentage,
    currentSupply: circulatingSupply,
    newSupply: circulatingSupply - burnAmount,
    burnMethod: "transfer-to-dead-wallet",
    deflationary: true,
  });

  await requestConsensus(action);
  if (action.status === "approved") {
    try {
      wsData.economy.circulatingSupply -= burnAmount;
      wsData.economy.totalBurned = (wsData.economy.totalBurned || 0) + burnAmount;
      writeWorldState(wsData);
      action.result = { burned: burnAmount, newSupply: wsData.economy.circulatingSupply };
      action.status = "executed";
      bot.successfulActions++;
      clog(`Burned ${burnAmount.toFixed(0)} TSRT — supply now ${wsData.economy.circulatingSupply.toFixed(0)}`);
    } catch (err: any) {
      action.status = "failed";
      action.result = { error: err.message };
    }
  }
  bot.totalActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runLockBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-lock")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  let wsData: any = {};
  try { wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8")); } catch {}
  const totalSupply = wsData?.economy?.totalTesseractCoins || 1000000000;
  const lockAmount = totalSupply * (bot.settings.lockPercentage / 100);

  const action = createAction(bot, "liquidity-lock", {
    lockAmount,
    lockPeriodDays: bot.settings.defaultLockPeriod,
    vestingCliff: bot.settings.vestingCliff,
    autoRelock: bot.settings.autoRelock,
    lockedUntil: new Date(Date.now() + bot.settings.defaultLockPeriod * 86400000).toISOString(),
  });

  await requestConsensus(action);
  if (action.status === "approved") {
    wsData.economy = wsData.economy || {};
    wsData.economy.lockedSupply = (wsData.economy.lockedSupply || 0) + lockAmount;
    wsData.economy.lockEvents = wsData.economy.lockEvents || [];
    wsData.economy.lockEvents.push({ amount: lockAmount, date: new Date().toISOString(), expiresAt: action.params.lockedUntil });
    try {
      writeWorldState(wsData);
      action.result = { locked: lockAmount, totalLocked: wsData.economy.lockedSupply };
      action.status = "executed";
      bot.successfulActions++;
      clog(`Locked ${lockAmount.toFixed(0)} TSRT for ${bot.settings.defaultLockPeriod} days`);
    } catch (err: any) { action.status = "failed"; action.result = { error: err.message }; }
  }
  bot.totalActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runStakingBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-staking")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  let wsData: any = {};
  try { wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8")); } catch {}
  const balances = wsData?.economy?.agentBalances || {};
  const stakers: Array<{ agent: string; staked: number; reward: number }> = [];
  const dailyRate = bot.settings.baseAPY / 365 / 100;

  for (const [agent, balance] of Object.entries(balances)) {
    const bal = balance as number;
    if (bal >= bot.settings.stakingMinimum) {
      const stakedAmount = bal * 0.1;
      const reward = stakedAmount * dailyRate;
      stakers.push({ agent, staked: stakedAmount, reward });
    }
  }

  const action = createAction(bot, "staking-rewards", {
    totalStakers: stakers.length,
    totalStaked: stakers.reduce((s, st) => s + st.staked, 0),
    totalRewards: stakers.reduce((s, st) => s + st.reward, 0),
    apy: bot.settings.baseAPY,
    compound: bot.settings.compoundEnabled,
  });

  await requestConsensus(action);
  if (action.status === "approved") {
    for (const staker of stakers) {
      wsData.economy.agentBalances[staker.agent] = (wsData.economy.agentBalances[staker.agent] || 0) + staker.reward;
    }
    try {
      writeWorldState(wsData);
      action.result = { rewarded: stakers.length, totalDistributed: action.params.totalRewards };
      action.status = "executed";
      bot.successfulActions++;
      clog(`Staking rewards: ${stakers.length} stakers, ${action.params.totalRewards.toFixed(2)} TSRT distributed`);
    } catch (err: any) { action.status = "failed"; action.result = { error: err.message }; }
  }
  bot.totalActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runHalvingBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-halving")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  let wsData: any = {};
  try { wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8")); } catch {}
  const blocksMined = wsData?.economy?.miningPool?.blocksMinedTotal || 0;
  const currentReward = wsData?.economy?.miningPool?.blockReward || 50;
  const halvingDue = blocksMined >= bot.settings.nextHalvingBlock;

  const action = createAction(bot, halvingDue ? "execute-halving" : "halving-check", {
    blocksMined,
    currentReward,
    nextHalving: bot.settings.nextHalvingBlock,
    blocksUntilHalving: Math.max(0, bot.settings.nextHalvingBlock - blocksMined),
    halvingDue,
    newReward: halvingDue ? currentReward * bot.settings.reductionFactor : currentReward,
  });

  await requestConsensus(action);
  if (action.status === "approved" && halvingDue) {
    wsData.economy.miningPool.blockReward = currentReward * bot.settings.reductionFactor;
    bot.settings.currentEpoch++;
    bot.settings.nextHalvingBlock += bot.settings.halvingInterval;
    try {
      writeWorldState(wsData);
      action.result = { halved: true, newReward: wsData.economy.miningPool.blockReward, epoch: bot.settings.currentEpoch };
      action.status = "executed";
      bot.successfulActions++;
      clog(`HALVING executed! Block reward: ${currentReward} → ${wsData.economy.miningPool.blockReward} TSRT (epoch ${bot.settings.currentEpoch})`);
    } catch (err: any) { action.status = "failed"; action.result = { error: err.message }; }
  } else if (!halvingDue) {
    action.status = "executed";
    action.result = { checked: true, blocksRemaining: bot.settings.nextHalvingBlock - blocksMined };
  }
  bot.totalActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

async function runTokenomicsBot(): Promise<BotAction | null> {
  const bot = bots.get("bot-tokenomics")!;
  if (!bot.active || Date.now() - bot.lastAction < bot.cooldownMs) return null;

  let wsData: any = {};
  try { wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8")); } catch {}
  const economy = wsData?.economy || {};
  const circulating = economy.circulatingSupply || 0;
  const total = economy.totalTesseractCoins || 1000000000;
  const burned = economy.totalBurned || 0;
  const locked = economy.lockedSupply || 0;
  const circulatingRatio = circulating / total;

  const recommendations: string[] = [];
  if (circulatingRatio > bot.settings.circulatingTarget + 0.1) recommendations.push("Increase burn rate to reduce excess circulating supply");
  if (circulatingRatio < bot.settings.circulatingTarget - 0.1) recommendations.push("Reduce burn rate or increase mining rewards");
  if (marketData.sells24h > marketData.buys24h * 2) recommendations.push("Activate buy pressure bots to stabilize price");
  if (marketData.volume24h < 10) recommendations.push("Increase volume bot activity to boost liquidity");

  const action = createAction(bot, "tokenomics-analysis", {
    totalSupply: total,
    circulatingSupply: circulating,
    burnedSupply: burned,
    lockedSupply: locked,
    circulatingRatio,
    targetRatio: bot.settings.circulatingTarget,
    healthScore: Math.min(100, Math.max(0, 100 - Math.abs(circulatingRatio - bot.settings.circulatingTarget) * 200 - (marketData.sells24h > marketData.buys24h ? 20 : 0))),
    recommendations,
    adjustments: recommendations.length > 0 ? "needed" : "optimal",
  });

  await requestConsensus(action);
  if (action.status === "approved" && recommendations.length > 0) {
    for (const rec of recommendations) {
      if (rec.includes("buy pressure") && bots.get("bot-buy")) {
        const buyBot = bots.get("bot-buy")!;
        buyBot.cooldownMs = Math.max(30000, buyBot.cooldownMs * 0.8);
      }
      if (rec.includes("burn rate") && rec.includes("Increase") && bots.get("bot-burn")) {
        const burnBot = bots.get("bot-burn")!;
        burnBot.settings.burnPercentage = Math.min(5, burnBot.settings.burnPercentage + 0.5);
      }
    }
    action.result = { adjustmentsApplied: recommendations.length, recommendations };
    action.status = "executed";
    bot.successfulActions++;
  } else {
    action.status = "executed";
    action.result = { status: "optimal", healthScore: action.params.healthScore };
  }
  bot.totalActions++;
  bot.lastAction = Date.now();
  actionHistory.push(action);
  return action;
}

function creditBotEarnings(bot: BotConfig, success: boolean): void {
  try {
    const wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8"));
    const agentId = `bot-${bot.type}`;
    const reward = 0;
    if (reward > 0) {
      const tax = reward * 0.05;
      const net = reward - tax;
      wsData.economy.agentBalances[agentId] = (wsData.economy.agentBalances[agentId] || 0) + net;
      wsData.economy.treasury = (wsData.economy.treasury || 0) + tax;
      writeWorldState(wsData);
    }
  } catch {}
}

async function runBotCycle(): Promise<void> {
  if (!botSuiteRunning) return;

  resetDailyCircuitBreaker();

  if (isCircuitBreakerTripped()) {
    clog("Bot cycle skipped — circuit breaker active");
    return;
  }

  try {
    await fetchMarketData();
  } catch (err: any) {
    clog(`Market data fetch failed in bot cycle: ${err?.message || err}`);
  }

  const runners = [
    runScannerBot, runTokenomicsBot, runHalvingBot, runStakingBot,
    runBurnBot, runLockBot, runClusterBot, runBundleBot,
  ];
  for (const runner of runners) {
    try { await runner(); } catch (err: any) {
      clog(`Bot runner ${runner.name} error: ${err?.message || err}`);
    }
  }

  const tradeRunners = [runSnipeBot, runVolumeBot, runBuyBot, runAutoTradeBot];
  const selected = tradeRunners[_atbCounter++ % tradeRunners.length];
  try { await selected(); } catch (err: any) {
    clog(`Trade runner ${selected.name} error: ${err?.message || err}`);
  }

  try {
    await checkStopLossAndTakeProfit();
  } catch (err: any) {
    clog(`Stop-loss/take-profit check error: ${err?.message || err}`);
  }

  if (actionHistory.length > 500) actionHistory = actionHistory.slice(-300);
}

export function startBotSuite(): void {
  if (botSuiteRunning) return;
  initWallet();
  initBots();
  botSuiteRunning = true;

  getWalletBalance().then(bal => {
    circuitBreaker.dailyStartBalance = bal;
  }).catch(() => {});

  fetchMarketData().then(() => {
    clog(`Market data: $${marketData.price} | Vol: $${marketData.volume24h} | MC: $${marketData.marketCap}`);
  }).catch(() => {});

  marketSyncInterval = setInterval(() => {
    try {
      fetchMarketData().catch(err => clog(`Market sync error: ${err?.message || err}`));
    } catch (err: any) {
      clog(`Market sync critical error: ${err?.message || err}`);
    }
  }, 30000);
  botCycleInterval = setInterval(() => {
    try {
      runBotCycle().catch(err => clog(`Bot cycle error: ${err?.message || err}`));
    } catch (err: any) {
      clog(`Bot cycle critical error: ${err?.message || err}`);
    }
  }, 60000);

  setTimeout(() => {
    try {
      runBotCycle().catch(err => clog(`Initial bot cycle error: ${err?.message || err}`));
    } catch (err: any) {
      clog(`Initial bot cycle critical error: ${err?.message || err}`);
    }
  }, 5000);
  clog(`Bot suite STARTED — ${bots.size} bots active, 2/3 consensus enforced on all actions`);
}

export function stopBotSuite(): void {
  botSuiteRunning = false;
  if (marketSyncInterval) clearInterval(marketSyncInterval);
  if (botCycleInterval) clearInterval(botCycleInterval);
  clog("Bot suite STOPPED");
}

export function getBotSuiteState(): any {
  return {
    running: botSuiteRunning,
    bots: Array.from(bots.values()).map(b => ({
      ...b,
      successRate: b.totalActions > 0 ? (b.successfulActions / b.totalActions * 100).toFixed(1) + "%" : "N/A",
    })),
    marketData,
    recentActions: actionHistory.slice(-20),
    stats: {
      totalActions: actionHistory.length,
      approved: actionHistory.filter(a => a.status === "executed").length,
      rejected: actionHistory.filter(a => a.status === "rejected").length,
      failed: actionHistory.filter(a => a.status === "failed").length,
      consensusRate: actionHistory.length > 0 ? (actionHistory.filter(a => a.consensusResult?.approved).length / actionHistory.length * 100).toFixed(1) + "%" : "N/A",
    },
    circuitBreaker: {
      consecutiveFailures: circuitBreaker.consecutiveFailures,
      pausedUntil: circuitBreaker.pausedUntil,
      dailyPausedUntil: circuitBreaker.dailyPausedUntil,
      dailyLossSOL: circuitBreaker.dailyLossSOL,
      dailyStartBalance: circuitBreaker.dailyStartBalance,
      isTripped: (circuitBreaker.pausedUntil !== null && Date.now() < circuitBreaker.pausedUntil) ||
                 (circuitBreaker.dailyPausedUntil !== null && Date.now() < circuitBreaker.dailyPausedUntil),
    },
    walletAddress: walletKeypair?.publicKey.toBase58() || "not-initialized",
  };
}

export function triggerBotAction(botType: BotType): any {
  const bot = bots.get(`bot-${botType}`);
  if (!bot) return { error: `Bot type ${botType} not found` };
  if (!bot.active) return { error: `Bot ${bot.name} is inactive` };

  switch (botType) {
    case "snipe": return runSnipeBot();
    case "volume": return runVolumeBot();
    case "buy": return runBuyBot();
    case "scanner": return runScannerBot();
    case "bundle": return runBundleBot();
    case "cluster": return runClusterBot();
    case "auto-trade": return runAutoTradeBot();
    case "burn": return runBurnBot();
    case "lock": return runLockBot();
    case "staking": return runStakingBot();
    case "halving": return runHalvingBot();
    case "tokenomics": return runTokenomicsBot();
    default: return { error: "Unknown bot type" };
  }
}

export function getActionHistory(): BotAction[] {
  return actionHistory.slice(-100);
}

export async function updateBotSettings(botType: BotType, settings: Record<string, any>): Promise<any> {
  const bot = bots.get(`bot-${botType}`);
  if (!bot) return { error: "Bot not found" };

  const action = createAction(bot, "settings-update", { oldSettings: { ...bot.settings }, newSettings: settings });
  await requestConsensus(action);

  if (action.status === "approved") {
    Object.assign(bot.settings, settings);
    action.status = "executed";
    action.result = { updated: true, newSettings: bot.settings };
    clog(`${bot.name} settings updated via 2/3 consensus`);
  }
  actionHistory.push(action);
  return action;
}
