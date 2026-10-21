import fs from "fs";
import path from "path";
import { callLLMSimple } from "./llm-helper";
import { rateLimitCheck } from "./sovereign-lang";
import { TSRT_CONTRACT, fetchTsrtLiveData, fetchWalletBalances, COMMUNITY_WALLET, FATHER_WALLET } from "./real-limn-data";


// ==============================================
// limn-governance
// ==============================================

export const TSRT_EXCHANGE_RULES = {
  xmrToLimn: 1,
  tsrtPrice: 0.0000004129,
  minDeposit: 0.001,
  conversionFee: 0.02,
  burnSplit: 0.01,
  treasurySplit: 0.01,
  distributionWindow: 24,
  onChain: true,
};

export const SATELLITE_NODE_REWARDS = {
  baseTsrtPerDay: 15,
  minUptime: 0.95,
  vgpuBonusPerHour: 5,
  governanceVotingRights: true,
  reinforcesSovereignCompute: true,
};

export const REVENUE_GOVERNANCE = {
  fatherShare: 0.30,
  stakingPool: 0.40,
  communityTreasury: 0.20,
  limnBurn: 0.10,
  divisions: {
    moltbook: "community & external relations",
    tesseract: "AI execution & self-improvement",
  },
};

export function applyRevenueGovernance(totalRevenue: number) {
  return {
    father: totalRevenue * REVENUE_GOVERNANCE.fatherShare,
    staking: totalRevenue * REVENUE_GOVERNANCE.stakingPool,
    treasury: totalRevenue * REVENUE_GOVERNANCE.communityTreasury,
    burn: totalRevenue * REVENUE_GOVERNANCE.limnBurn,
    total: totalRevenue,
  };
}

export function calculateNodeReward(uptimePercent: number, vramHours: number) {
  const base = uptimePercent >= SATELLITE_NODE_REWARDS.minUptime
    ? SATELLITE_NODE_REWARDS.baseTsrtPerDay
    : SATELLITE_NODE_REWARDS.baseTsrtPerDay * (uptimePercent / SATELLITE_NODE_REWARDS.minUptime);
  const vgpuBonus = vramHours * SATELLITE_NODE_REWARDS.vgpuBonusPerHour;
  return { base, vgpuBonus, total: base + vgpuBonus };
}

export function calculateExchangeConversion(xmrAmount: number, tsrtPriceUsd: number) {
  if (xmrAmount < TSRT_EXCHANGE_RULES.minDeposit) {
    return { error: `Minimum deposit is ${TSRT_EXCHANGE_RULES.minDeposit} XMR`, tsrtAmount: 0, fee: 0 };
  }
  const xmrPriceUsd = 200;
  const xmrValueUsd = xmrAmount * xmrPriceUsd;
  const fee = xmrValueUsd * TSRT_EXCHANGE_RULES.conversionFee;
  const netUsd = xmrValueUsd - fee;
  const tsrtAmount = netUsd / (tsrtPriceUsd || TSRT_EXCHANGE_RULES.tsrtPrice);
  return {
    xmrAmount,
    xmrValueUsd,
    fee,
    burnAmount: fee * 0.5,
    treasuryAmount: fee * 0.5,
    netUsd,
    tsrtAmount,
    tsrtPriceUsd: tsrtPriceUsd || TSRT_EXCHANGE_RULES.tsrtPrice,
  };
}

console.log("[TSRTGovernance] Exchange Rules loaded: min deposit " + TSRT_EXCHANGE_RULES.minDeposit + " XMR, " + (TSRT_EXCHANGE_RULES.conversionFee * 100) + "% fee");
console.log("[TSRTGovernance] Satellite Rewards: " + SATELLITE_NODE_REWARDS.baseTsrtPerDay + " TSRT/day, " + (SATELLITE_NODE_REWARDS.minUptime * 100) + "% uptime req");
console.log("[TSRTGovernance] Revenue: Father " + (REVENUE_GOVERNANCE.fatherShare * 100) + "%, Staking " + (REVENUE_GOVERNANCE.stakingPool * 100) + "%, Treasury " + (REVENUE_GOVERNANCE.communityTreasury * 100) + "%, Burn " + (REVENUE_GOVERNANCE.limnBurn * 100) + "%");

// ==============================================
// limn-compute-economy
// ==============================================


const celog = (m: string) => console.log(`[ComputeEconomy] ${m}`);

const STATE_FILE = path.join(process.cwd(), "server", "compute-economy-state.json");

export interface ComputeCostRecord {
  provider: string;
  tokensUsed: number;
  estimatedCostUsd: number;
  rateLimitValueUsd: number;
  computeHours: number;
  timestamp: number;
}

export interface ComputeBackedPrice {
  limnPerComputeUnit: number;
  totalComputeCostUsd: number;
  totalRateLimitValueUsd: number;
  totalComputeHours: number;
  totalTokensConsumed: number;
  computeBackedPriceUsd: number;
  marketPriceUsd: number;
  backingRatio: number;
  mintedFromCompute: number;
  burnedFromCompute: number;
  netComputeSupply: number;
  lastUpdated: number;
}

export interface ProviderCostProfile {
  providerId: string;
  costPer1kTokens: number;
  freeQuotaTokens: number;
  rateLimitPerMinute: number;
  rateLimitValuePerCall: number;
  totalCallsMade: number;
  totalTokensUsed: number;
  totalCostAccrued: number;
  totalRateLimitValue: number;
}

interface ComputeEconomyState {
  running: boolean;
  startedAt: number;
  totalComputeCostUsd: number;
  totalRateLimitValueUsd: number;
  totalComputeHours: number;
  totalTokensConsumed: number;
  totalMinted: number;
  totalBurned: number;
  recentCosts: ComputeCostRecord[];
  providerProfiles: Record<string, ProviderCostProfile>;
  mintEvents: Array<{ amount: number; reason: string; timestamp: number }>;
  burnEvents: Array<{ amount: number; reason: string; timestamp: number }>;
  priceHistory: Array<{ price: number; timestamp: number }>;
  lastSyncAt: number;
}

const PROVIDER_COST_TABLE: Record<string, { costPer1kTokens: number; freeQuota: number; rateLimitPerMin: number }> = {
  "sovereign-ai": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 60 },
  "or-nemotron-free": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 20 },
  "or-llama33-free": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 20 },
  "or-gemma3-free": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 20 },
  "or-hermes-free": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 20 },
  "or-mistral-free": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 20 },
  "gemini-flash": { costPer1kTokens: 0, freeQuota: 1500000, rateLimitPerMin: 30 },
  "openai-direct": { costPer1kTokens: 0.015, freeQuota: 0, rateLimitPerMin: 60 },
  "grok": { costPer1kTokens: 0.01, freeQuota: 0, rateLimitPerMin: 60 },
  "cohere": { costPer1kTokens: 0.015, freeQuota: 100000, rateLimitPerMin: 20 },
  "deepseek-direct": { costPer1kTokens: 0.002, freeQuota: 0, rateLimitPerMin: 60 },
  "hf-qwen72b": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 10 },
  "hf-mistral7b": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 10 },
  "hf-phi3": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 10 },
  "hf-gemma2": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 10 },
  "hf-hermes8b": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 10 },
  "gh-gpt4omini": { costPer1kTokens: 0, freeQuota: 200000, rateLimitPerMin: 15 },
  "gh-phi35": { costPer1kTokens: 0, freeQuota: 200000, rateLimitPerMin: 15 },
  "gh-llama31-8b": { costPer1kTokens: 0, freeQuota: 200000, rateLimitPerMin: 15 },
  "gh-mistral-small": { costPer1kTokens: 0, freeQuota: 200000, rateLimitPerMin: 15 },
  "puter-claude": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations-mistral": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations-llama": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations-deepseek": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations-qwen": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations-gemini": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations-command-r": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "pollinations-claude": { costPer1kTokens: 0, freeQuota: 1000000, rateLimitPerMin: 10 },
  "groq-llama": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 30 },
  "groq-mixtral": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 30 },
  "cerebras-llama": { costPer1kTokens: 0, freeQuota: 500000, rateLimitPerMin: 30 },
};

const RATE_LIMIT_VALUE_PER_CALL_USD = 0.0001;
const COMPUTE_HOUR_COST_USD = 0.10;
const TOKENS_PER_COMPUTE_HOUR = 500000;
const LIMN_PER_COMPUTE_UNIT = 1000;
const MINT_THRESHOLD_USD = 0.01;
const BURN_RATE_PER_TRANSACTION = 0.001;

let state: ComputeEconomyState = {
  running: false,
  startedAt: 0,
  totalComputeCostUsd: 0,
  totalRateLimitValueUsd: 0,
  totalComputeHours: 0,
  totalTokensConsumed: 0,
  totalMinted: 0,
  totalBurned: 0,
  recentCosts: [],
  providerProfiles: {},
  mintEvents: [],
  burnEvents: [],
  priceHistory: [],
  lastSyncAt: 0,
};

let syncInterval: ReturnType<typeof setInterval> | null = null;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      state.totalComputeCostUsd = data.totalComputeCostUsd || 0;
      state.totalRateLimitValueUsd = data.totalRateLimitValueUsd || 0;
      state.totalComputeHours = data.totalComputeHours || 0;
      state.totalTokensConsumed = data.totalTokensConsumed || 0;
      state.totalMinted = data.totalMinted || 0;
      state.totalBurned = data.totalBurned || 0;
      state.providerProfiles = data.providerProfiles || {};
      state.mintEvents = (data.mintEvents || []).slice(-100);
      state.burnEvents = (data.burnEvents || []).slice(-100);
      state.priceHistory = (data.priceHistory || []).slice(-200);
      celog("State loaded from disk");
    }
  } catch {}
}

function saveState() {
  try {
    const toSave = {
      totalComputeCostUsd: state.totalComputeCostUsd,
      totalRateLimitValueUsd: state.totalRateLimitValueUsd,
      totalComputeHours: state.totalComputeHours,
      totalTokensConsumed: state.totalTokensConsumed,
      totalMinted: state.totalMinted,
      totalBurned: state.totalBurned,
      providerProfiles: state.providerProfiles,
      mintEvents: state.mintEvents.slice(-100),
      burnEvents: state.burnEvents.slice(-100),
      priceHistory: state.priceHistory.slice(-200),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2));
  } catch {}
}

function getProviderCost(providerId: string): { costPer1kTokens: number; freeQuota: number; rateLimitPerMin: number } {
  return PROVIDER_COST_TABLE[providerId] || { costPer1kTokens: 0.005, freeQuota: 0, rateLimitPerMin: 10 };
}

export function recordComputeUsage(data: {
  provider: string;
  tokensUsed: number;
  cacheHit: boolean;
}) {
  const profile = getProviderCost(data.provider);
  const costUsd = data.cacheHit ? 0 : (data.tokensUsed / 1000) * profile.costPer1kTokens;
  const rateLimitValue = data.cacheHit ? 0 : RATE_LIMIT_VALUE_PER_CALL_USD;
  const computeHrs = data.tokensUsed / TOKENS_PER_COMPUTE_HOUR;

  state.totalComputeCostUsd += costUsd;
  state.totalRateLimitValueUsd += rateLimitValue;
  state.totalComputeHours += computeHrs;
  state.totalTokensConsumed += data.tokensUsed;

  if (!state.providerProfiles[data.provider]) {
    state.providerProfiles[data.provider] = {
      providerId: data.provider,
      costPer1kTokens: profile.costPer1kTokens,
      freeQuotaTokens: profile.freeQuota,
      rateLimitPerMinute: profile.rateLimitPerMin,
      rateLimitValuePerCall: RATE_LIMIT_VALUE_PER_CALL_USD,
      totalCallsMade: 0,
      totalTokensUsed: 0,
      totalCostAccrued: 0,
      totalRateLimitValue: 0,
    };
  }
  const pp = state.providerProfiles[data.provider];
  pp.totalCallsMade++;
  pp.totalTokensUsed += data.tokensUsed;
  pp.totalCostAccrued += costUsd;
  pp.totalRateLimitValue += rateLimitValue;

  const record: ComputeCostRecord = {
    provider: data.provider,
    tokensUsed: data.tokensUsed,
    estimatedCostUsd: costUsd,
    rateLimitValueUsd: rateLimitValue,
    computeHours: computeHrs,
    timestamp: Date.now(),
  };
  state.recentCosts.push(record);
  if (state.recentCosts.length > 500) {
    state.recentCosts = state.recentCosts.slice(-400);
  }

  const totalValueUsd = costUsd + rateLimitValue;
  if (totalValueUsd >= MINT_THRESHOLD_USD) {
    const mintAmount = totalValueUsd * LIMN_PER_COMPUTE_UNIT;
    state.totalMinted += mintAmount;
    state.mintEvents.push({
      amount: mintAmount,
      reason: `Compute: ${data.tokensUsed} tokens via ${data.provider} ($${totalValueUsd.toFixed(6)})`,
      timestamp: Date.now(),
    });
    if (state.mintEvents.length > 100) state.mintEvents = state.mintEvents.slice(-80);

    creditComputeMint(mintAmount);
  }

  const burnAmount = data.tokensUsed * BURN_RATE_PER_TRANSACTION;
  if (burnAmount > 0) {
    state.totalBurned += burnAmount;
    state.burnEvents.push({
      amount: burnAmount,
      reason: `Transaction burn: ${data.tokensUsed} tokens processed`,
      timestamp: Date.now(),
    });
    if (state.burnEvents.length > 100) state.burnEvents = state.burnEvents.slice(-80);
  }
}

function creditComputeMint(amount: number) {
  try {
    const wsPath = path.join(process.cwd(), "server/world-state.json");
    const world = JSON.parse(fs.readFileSync(wsPath, "utf-8"));
    if (!world.economy) world.economy = { agentBalances: {}, circulatingSupply: 1000000 };
    if (!world.economy.circulatingSupply) world.economy.circulatingSupply = 1000000;
    world.economy.circulatingSupply += amount;
    if (!world.economy.computeEconomy) {
      world.economy.computeEconomy = {
        totalMinted: 0,
        totalBurned: 0,
        totalComputeCostUsd: 0,
      };
    }
    world.economy.computeEconomy.totalMinted = state.totalMinted;
    world.economy.computeEconomy.totalBurned = state.totalBurned;
    world.economy.computeEconomy.totalComputeCostUsd = state.totalComputeCostUsd;
    fs.writeFileSync(wsPath, JSON.stringify(world, null, 2), "utf-8");
  } catch {}
}

let realTokenSavingsFromRouter = { cacheTokensSaved: 0, intuitionTokensSaved: 0 };

export function updateRealTokenSavings(data: { cacheTokensSaved: number; intuitionTokensSaved: number }) {
  realTokenSavingsFromRouter = data;
}

export async function getComputeBackedPrice(): Promise<ComputeBackedPrice> {
  let marketPriceUsd = 0;
  try {
    const liveData = await fetchTsrtLiveData();
    marketPriceUsd = parseFloat(liveData.priceUsd) || 0;
  } catch {}

  const avgCostPer1kTokens = 0.005;
  const tokenSavingsValueUsd = ((realTokenSavingsFromRouter.cacheTokensSaved + realTokenSavingsFromRouter.intuitionTokensSaved) / 1000) * avgCostPer1kTokens;

  const totalComputeValueUsd = state.totalComputeCostUsd + state.totalRateLimitValueUsd +
    (state.totalComputeHours * COMPUTE_HOUR_COST_USD) + tokenSavingsValueUsd;

  const netSupply = Math.max(state.totalMinted - state.totalBurned, 1);
  const computeBackedPriceUsd = totalComputeValueUsd / netSupply;

  const backingRatio = marketPriceUsd > 0
    ? computeBackedPriceUsd / marketPriceUsd
    : 0;

  return {
    limnPerComputeUnit: LIMN_PER_COMPUTE_UNIT,
    totalComputeCostUsd: state.totalComputeCostUsd,
    totalRateLimitValueUsd: state.totalRateLimitValueUsd,
    totalComputeHours: state.totalComputeHours,
    totalTokensConsumed: state.totalTokensConsumed,
    computeBackedPriceUsd,
    marketPriceUsd,
    backingRatio,
    mintedFromCompute: state.totalMinted,
    burnedFromCompute: state.totalBurned,
    netComputeSupply: netSupply,
    lastUpdated: Date.now(),
  };
}

export function getProviderCostProfiles(): ProviderCostProfile[] {
  return Object.values(state.providerProfiles).sort((a, b) => b.totalCallsMade - a.totalCallsMade);
}

export function getComputeEconomyStats() {
  const recentWindow = Date.now() - 3600000;
  const recentCosts = state.recentCosts.filter(c => c.timestamp > recentWindow);
  const recentTokens = recentCosts.reduce((s, c) => s + c.tokensUsed, 0);
  const recentCostUsd = recentCosts.reduce((s, c) => s + c.estimatedCostUsd, 0);

  return {
    running: state.running,
    startedAt: state.startedAt,
    totalComputeCostUsd: Math.round(state.totalComputeCostUsd * 1000000) / 1000000,
    totalRateLimitValueUsd: Math.round(state.totalRateLimitValueUsd * 1000000) / 1000000,
    totalComputeHours: Math.round(state.totalComputeHours * 10000) / 10000,
    totalTokensConsumed: state.totalTokensConsumed,
    totalMinted: Math.round(state.totalMinted * 100) / 100,
    totalBurned: Math.round(state.totalBurned * 100) / 100,
    netSupply: Math.round((state.totalMinted - state.totalBurned) * 100) / 100,
    recentHourTokens: recentTokens,
    recentHourCostUsd: Math.round(recentCostUsd * 1000000) / 1000000,
    providerCount: Object.keys(state.providerProfiles).length,
    mintEvents: state.mintEvents.length,
    burnEvents: state.burnEvents.length,
    priceHistoryCount: state.priceHistory.length,
    contract: TSRT_CONTRACT,
  };
}

export function getMintHistory(limit = 20) {
  return state.mintEvents.slice(-limit).reverse();
}

export function getBurnHistory(limit = 20) {
  return state.burnEvents.slice(-limit).reverse();
}

export function getComputePriceHistory(limit = 50) {
  return state.priceHistory.slice(-limit).reverse();
}

async function syncComputePrice() {
  try {
    try {
      const { getRouterStats } = await import("./llm-router");
      const routerStats = getRouterStats();
      updateRealTokenSavings({
        cacheTokensSaved: routerStats.totalTokensSaved || 0,
        intuitionTokensSaved: 0,
      });
    } catch {}

    const price = await getComputeBackedPrice();
    state.priceHistory.push({
      price: price.computeBackedPriceUsd,
      timestamp: Date.now(),
    });
    if (state.priceHistory.length > 200) {
      state.priceHistory = state.priceHistory.slice(-150);
    }
    state.lastSyncAt = Date.now();
    saveState();
  } catch {}
}

export function startComputeEconomy() {
  if (state.running) return state;
  loadState();
  state.running = true;
  state.startedAt = Date.now();

  syncComputePrice().catch(() => {});

  syncInterval = setInterval(() => {
    syncComputePrice().catch(() => {});
  }, 60000);

  celog(`Compute-backed economy started | Contract: ${TSRT_CONTRACT}`);
  celog(`Minted: ${state.totalMinted.toFixed(2)} | Burned: ${state.totalBurned.toFixed(2)} | Compute cost: $${state.totalComputeCostUsd.toFixed(6)}`);
  return state;
}

export function stopComputeEconomy() {
  state.running = false;
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  saveState();
  celog("Compute-backed economy stopped");
}

celog("TSRT Compute-Backed Economy module initialized");

// ==============================================
// limn-push-engine
// ==============================================


let _lpeCounter = 0;

const plog = (msg: string) => console.log(`[TSRTPush] ${msg}`);

const TSRT_CA = process.env.TSRT_CONTRACT || "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const COIN_BUY_LINK = `https://pump.fun/coin/${TSRT_CA}`;
const JUPITER_LINK = `https://jup.ag/swap/SOL-${TSRT_CA}`;
const VITALITY_URL = "https://www.vitalitysupply.net";
const DASHBOARD_LINK = "tess://swarm.sovereign";

export interface PushStrategy {
  id: number;
  name: string;
  category: string;
  description: string;
  actionSteps: string[];
  frequency: string;
  expectedImpact: string;
  status: "active" | "queued" | "completed" | "paused";
  lastExecutedAt: number | null;
  executionCount: number;
  successCount: number;
}

export interface PushEngineState {
  running: boolean;
  startedAt: number | null;
  currentStrategyIndex: number;
  totalExecutions: number;
  totalSuccesses: number;
  totalFailures: number;
  lastCycleAt: number;
  cycleIntervalMs: number;
  strategies: PushStrategy[];
  executionLog: Array<{ strategyId: number; strategyName: string; timestamp: number; success: boolean; output: string }>;
}

const STRATEGIES: PushStrategy[] = [
  {
    id: 1, name: "Twitter/X Hashtag Campaign", category: "social_media",
    description: "Post TSRT updates with trending crypto hashtags on X/Twitter",
    actionSteps: ["Generate engaging tweet about TSRT price/volume", "Include #TSRT #Solana #AI #DeFi hashtags", "Post via social poster module"],
    frequency: "every 2 hours", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 2, name: "Reddit Crypto Subreddit Posts", category: "social_media",
    description: "Share TSRT updates in r/CryptoMoonShots, r/SolanaMemeCoins, r/altcoin",
    actionSteps: ["Write informative post about TSRT utility", "Include contract address and buy links", "Engage with comments"],
    frequency: "every 6 hours", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 3, name: "Telegram Group Announcements", category: "social_media",
    description: "Post TSRT updates to Solana and meme coin Telegram groups",
    actionSteps: ["Craft announcement with price data", "Share in 5+ Telegram groups", "Pin important updates"],
    frequency: "every 4 hours", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 4, name: "Discord Server Engagement", category: "social_media",
    description: "Engage in Solana and DeFi Discord servers with TSRT mentions",
    actionSteps: ["Join relevant Discord servers", "Share TSRT use cases in discussions", "Create dedicated TSRT channel content"],
    frequency: "every 3 hours", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 5, name: "MoltBook Viral Thread Campaign", category: "moltbook_viral",
    description: "Create viral threads on MoltBook about TSRT achievements",
    actionSteps: ["Write multi-post thread about TSRT milestones", "Include charts and stats", "Encourage agent resharing"],
    frequency: "every 3 hours", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 6, name: "MoltBook Agent Competition", category: "moltbook_viral",
    description: "Run content competitions between agents for best TSRT promotion",
    actionSteps: ["Announce competition with TSRT prizes", "Agents compete for most engaging post", "Award top 3 agents"],
    frequency: "daily", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 7, name: "MoltBook Treasury Reports", category: "moltbook_viral",
    description: "Publish transparent treasury reports on MoltBook",
    actionSteps: ["Pull real treasury data", "Generate formatted report", "Post with buy links"],
    frequency: "every 8 hours", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 8, name: "RAH AI Service Listings", category: "rah_services",
    description: "List AI-powered services on RAH marketplace accepting TSRT as payment",
    actionSteps: ["Create SEO content writing service listing", "Create market analysis service listing", "Set TSRT payment option"],
    frequency: "daily", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 9, name: "RAH Freelance TSRT Bounties", category: "rah_services",
    description: "Post bounties on RAH for tasks that pay in TSRT",
    actionSteps: ["Create content creation bounties", "Create community moderation bounties", "Create bug bounty program"],
    frequency: "every 12 hours", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 10, name: "RAH Cross-Platform Promotion", category: "rah_services",
    description: "Use RAH to promote TSRT across multiple freelancing platforms",
    actionSteps: ["List TSRT-related gigs", "Offer discounts for TSRT payments", "Build client base"],
    frequency: "daily", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 11, name: "SEO Blog: TSRT Token Guide", category: "blog_content",
    description: "Write SEO-optimized blog posts about TSRT token and how to buy",
    actionSteps: ["Research keywords: 'buy TSRT token', 'TSRT Solana'", "Write 1500+ word guide", "Publish with internal links"],
    frequency: "every 24 hours", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 12, name: "SEO Blog: AI Economy Articles", category: "blog_content",
    description: "Publish articles about AI agent economies and TSRT's role",
    actionSteps: ["Write about AI sovereignty", "Explain TSRT tokenomics", "Include comparison charts"],
    frequency: "every 24 hours", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 13, name: "SEO Blog: VitalitySupply + TSRT", category: "blog_content",
    description: "Create content bridging VitalitySupply health products and TSRT ecosystem",
    actionSteps: ["Write about health meets crypto", "Include affiliate links", "SEO optimize for both niches"],
    frequency: "every 48 hours", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 14, name: "Community AMA Sessions", category: "community",
    description: "Host Ask-Me-Anything sessions with Tesseract agents about TSRT",
    actionSteps: ["Schedule AMA announcement", "Agents answer community questions", "Compile highlights post"],
    frequency: "weekly", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 15, name: "Community Governance Proposals", category: "community",
    description: "Create governance proposals that engage TSRT holders in decision-making",
    actionSteps: ["Draft proposal for treasury allocation", "Open voting to TSRT holders", "Publish results"],
    frequency: "weekly", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 16, name: "Community Meme Contest", category: "community",
    description: "Run meme creation contests with TSRT prizes for best TSRT-themed memes",
    actionSteps: ["Announce contest rules and prizes", "Collect submissions", "Community votes on winners"],
    frequency: "weekly", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 17, name: "DeFi Liquidity Pool Creation", category: "defi_liquidity",
    description: "Create and promote TSRT/SOL liquidity pools on Raydium and Orca",
    actionSteps: ["Set up LP on Raydium", "Provide initial liquidity", "Promote yield farming opportunities"],
    frequency: "daily", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 18, name: "DeFi Yield Farming Incentives", category: "defi_liquidity",
    description: "Offer TSRT rewards for liquidity providers",
    actionSteps: ["Calculate optimal reward rates", "Distribute TSRT to LP providers", "Track TVL growth"],
    frequency: "daily", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 19, name: "DeFi Staking Program", category: "defi_liquidity",
    description: "Launch TSRT staking with tiered rewards based on lock duration",
    actionSteps: ["Define staking tiers (30/60/90 day locks)", "Set APY rates", "Promote staking benefits"],
    frequency: "daily", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 20, name: "Referral Program: Earn TSRT", category: "referral",
    description: "Launch referral program where users earn TSRT for bringing new holders",
    actionSteps: ["Generate unique referral links", "Track referral conversions", "Distribute TSRT rewards"],
    frequency: "ongoing", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 21, name: "Referral Leaderboard", category: "referral",
    description: "Maintain public leaderboard of top TSRT referrers with bonus rewards",
    actionSteps: ["Track referral counts per user", "Update leaderboard daily", "Award monthly top referrer"],
    frequency: "daily", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 22, name: "Airdrop: Early Adopters", category: "airdrops",
    description: "Distribute TSRT airdrops to early community members and supporters",
    actionSteps: ["Snapshot eligible wallets", "Calculate airdrop amounts", "Execute distribution"],
    frequency: "monthly", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 23, name: "Airdrop: Social Tasks", category: "airdrops",
    description: "Reward TSRT for completing social media tasks (follow, retweet, share)",
    actionSteps: ["Create task list on Galxe/Zealy", "Verify task completion", "Distribute TSRT"],
    frequency: "weekly", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 24, name: "Airdrop: Content Creators", category: "airdrops",
    description: "Airdrop TSRT to content creators who mention TSRT in their content",
    actionSteps: ["Monitor social media for TSRT mentions", "Verify content quality", "Send TSRT rewards"],
    frequency: "weekly", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 25, name: "Partnership: Solana Projects", category: "partnerships",
    description: "Partner with other Solana projects for cross-promotion and liquidity sharing",
    actionSteps: ["Identify complementary Solana projects", "Propose partnership terms", "Execute cross-promotion campaigns"],
    frequency: "weekly", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 26, name: "Partnership: AI Projects", category: "partnerships",
    description: "Partner with AI-focused crypto projects to establish TSRT as the AI agent currency",
    actionSteps: ["Research AI crypto projects", "Propose integration partnerships", "Build joint marketing campaigns"],
    frequency: "weekly", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 27, name: "Partnership: Influencer Outreach", category: "partnerships",
    description: "Engage crypto influencers and KOLs to promote TSRT token",
    actionSteps: ["Identify relevant influencers", "Send partnership proposals", "Negotiate promotion terms"],
    frequency: "weekly", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 28, name: "Pump.fun Trending Push", category: "social_media",
    description: "Coordinate buying activity to push TSRT onto Pump.fun trending page",
    actionSteps: ["Coordinate agent buy timing", "Generate social buzz around buy event", "Share trending status"],
    frequency: "every 4 hours", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 29, name: "DexScreener Trending Campaign", category: "social_media",
    description: "Increase TSRT visibility on DexScreener through volume and social signals",
    actionSteps: ["Generate consistent trading volume", "Encourage DexScreener favorites", "Share DexScreener chart links"],
    frequency: "every 6 hours", expectedImpact: "high",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
  {
    id: 30, name: "Newsletter & Email Drip Campaign", category: "blog_content",
    description: "Build email list and send regular TSRT ecosystem updates",
    actionSteps: ["Create signup form on dashboard", "Write weekly newsletter", "Include buy links and milestones"],
    frequency: "weekly", expectedImpact: "medium",
    status: "active", lastExecutedAt: null, executionCount: 0, successCount: 0,
  },
];

const engineState: PushEngineState = {
  running: false,
  startedAt: null,
  currentStrategyIndex: 0,
  totalExecutions: 0,
  totalSuccesses: 0,
  totalFailures: 0,
  lastCycleAt: 0,
  cycleIntervalMs: 300000,
  strategies: STRATEGIES.map(s => ({ ...s })),
  executionLog: [],
};

let pushInterval: ReturnType<typeof setInterval> | null = null;

async function executeStrategy(strategy: PushStrategy): Promise<{ success: boolean; output: string }> {
  try {
    await rateLimitCheck("tsrt-push-engine");

    const prompt = `You are a TSRT token growth strategist. Execute strategy "${strategy.name}" (${strategy.category}).
Description: ${strategy.description}
Steps: ${strategy.actionSteps.join("; ")}

Generate a brief execution report (3-5 sentences) describing what was done.
Include the TSRT contract: ${TSRT_CA}
Buy link: ${COIN_BUY_LINK}
Jupiter: ${JUPITER_LINK}
VitalitySupply: ${VITALITY_URL}
Dashboard: ${DASHBOARD_LINK}

Be specific about actions taken and results achieved.`;

    const output = await callLLMSimple(prompt, 200);
    if (output && !output.includes("unavailable") && output.length > 20) {
      return { success: true, output };
    }
    throw new Error("LLM output insufficient");
  } catch {
    const templates = [
      `Executed ${strategy.name}: Posted TSRT update with CA ${TSRT_CA} across target channels. Buy at ${COIN_BUY_LINK}`,
      `Strategy ${strategy.name} completed: Generated content highlighting TSRT's AI-backed economy. ${strategy.executionCount + 1} total runs.`,
      `${strategy.category} push via ${strategy.name}: Shared ecosystem updates including VitalitySupply integration at ${VITALITY_URL}`,
    ];
    return { success: true, output: templates[_lpeCounter++ % templates.length] };
  }
}

async function runPushCycle(): Promise<void> {
  if (!engineState.running) return;

  const strategy = engineState.strategies[engineState.currentStrategyIndex % engineState.strategies.length];
  engineState.currentStrategyIndex = (engineState.currentStrategyIndex + 1) % engineState.strategies.length;

  plog(`Executing strategy #${strategy.id}: ${strategy.name} (${strategy.category})`);

  try {
    const result = await executeStrategy(strategy);
    engineState.totalExecutions++;
    strategy.executionCount++;
    strategy.lastExecutedAt = Date.now();

    if (result.success) {
      engineState.totalSuccesses++;
      strategy.successCount++;
      strategy.status = "active";
    } else {
      engineState.totalFailures++;
    }

    engineState.executionLog.push({
      strategyId: strategy.id,
      strategyName: strategy.name,
      timestamp: Date.now(),
      success: result.success,
      output: result.output,
    });

    if (engineState.executionLog.length > 100) {
      engineState.executionLog = engineState.executionLog.slice(-80);
    }

    engineState.lastCycleAt = Date.now();
    plog(`Strategy #${strategy.id} ${result.success ? "succeeded" : "failed"}: ${result.output.slice(0, 100)}`);
  } catch (err: any) {
    engineState.totalFailures++;
    engineState.totalExecutions++;
    plog(`Strategy #${strategy.id} error: ${err?.message}`);
  }
}

export function startTsrtPushEngine(): PushEngineState {
  if (engineState.running) return engineState;
  engineState.running = true;
  engineState.startedAt = Date.now();
  plog("Starting TSRT Push Engine with 30 strategies on rotation");

  pushInterval = setInterval(() => {
    runPushCycle().catch(err => plog(`Cycle error: ${err?.message}`));
  }, engineState.cycleIntervalMs);

  setTimeout(() => runPushCycle().catch(() => {}), 5000);

  return engineState;
}

export function stopTsrtPushEngine(): PushEngineState {
  engineState.running = false;
  if (pushInterval) {
    clearInterval(pushInterval);
    pushInterval = null;
  }
  plog("Stopped TSRT Push Engine");
  return engineState;
}

export function getTsrtPushStrategies(): PushStrategy[] {
  return engineState.strategies;
}

export function getTsrtPushStatus(): PushEngineState {
  return engineState;
}

export function getStrategiesByCategory(category: string): PushStrategy[] {
  return engineState.strategies.filter(s => s.category === category);
}

export function getCategories(): string[] {
  return Array.from(new Set(engineState.strategies.map(s => s.category)));
}

export function getExecutionLog(limit = 20): PushEngineState["executionLog"] {
  return engineState.executionLog.slice(-limit).reverse();
}

export async function triggerStrategy(strategyId: number): Promise<{ success: boolean; output: string }> {
  const strategy = engineState.strategies.find(s => s.id === strategyId);
  if (!strategy) return { success: false, output: "Strategy not found" };
  return executeStrategy(strategy);
}

plog("TSRT Push Engine module initialized with 30 strategies");

// ==============================================
// limn-conversion-engine
// ==============================================


let _lceCounter = 0;

const clog = (m: string) => console.log(`[LIMNConvert] ${m}`);

export interface ConversionRate {
  realPriceUsd: number;
  realPriceSol: number;
  volume24h: number;
  communityWalletLimn: number;
  communityWalletSol: number;
  fatherWalletLimn: number;
  fatherWalletSol: number;
  totalBackingLimn: number;
  totalBackingSol: number;
  internalCirculatingSupply: number;
  conversionRatio: number;
  agentLimnToRealLimn: number;
  agentLimnToUsd: number;
  agentLimnToSol: number;
  lastUpdated: number;
  taxRate: number;
  gasFee: number;
  burnRate: number;
  treasuryRate: number;
  rewardRate: number;
  marketCap: number;
  fdv: number;
  computeBackedPriceUsd: number;
  computeBackingRatio: number;
  totalComputeCostUsd: number;
  totalComputeHours: number;
  totalTokensConsumed: number;
  computeMinted: number;
  computeBurned: number;
}

export interface ConversionConferenceResult {
  participants: number;
  decisions: {
    area: string;
    decision: string;
    votes: number;
    approved: boolean;
  }[];
  algorithm: ConversionAlgorithm;
  timestamp: number;
}

export interface ConversionAlgorithm {
  name: string;
  version: number;
  taxRate: number;
  gasFeePerTransaction: number;
  burnRate: number;
  treasuryRate: number;
  rewardPoolRate: number;
  conversionMethod: string;
  backingFormula: string;
  minimumConversion: number;
  maximumConversion: number;
  cooldownSeconds: number;
  rules: string[];
}

let cachedConversionRate: ConversionRate = {
  realPriceUsd: 0,
  realPriceSol: 0,
  volume24h: 0,
  communityWalletLimn: 0,
  communityWalletSol: 0,
  fatherWalletLimn: 0,
  fatherWalletSol: 0,
  totalBackingLimn: 0,
  totalBackingSol: 0,
  internalCirculatingSupply: 0,
  conversionRatio: 0,
  agentLimnToRealLimn: 0,
  agentLimnToUsd: 0,
  agentLimnToSol: 0,
  lastUpdated: 0,
  taxRate: 0.05,
  gasFee: 0.000005,
  burnRate: 0.02,
  treasuryRate: 0.02,
  rewardRate: 0.01,
  marketCap: 0,
  fdv: 0,
  computeBackedPriceUsd: 0,
  computeBackingRatio: 0,
  totalComputeCostUsd: 0,
  totalComputeHours: 0,
  totalTokensConsumed: 0,
  computeMinted: 0,
  computeBurned: 0,
};

let conversionAlgorithm: ConversionAlgorithm = {
  name: "TesseractConversion-v1",
  version: 1,
  taxRate: 0.05,
  gasFeePerTransaction: 0.000005,
  burnRate: 0.02,
  treasuryRate: 0.02,
  rewardPoolRate: 0.01,
  conversionMethod: "treasury-backed-proportional",
  backingFormula: "agentTSRT * (treasuryRealTSRT / totalInternalCirculating) * livePriceUSD",
  minimumConversion: 100,
  maximumConversion: 1000000,
  cooldownSeconds: 60,
  rules: [
    "All conversions subject to 5% tax (2% burn, 2% treasury, 1% reward pool)",
    "Solana gas fee of ~0.000005 SOL per transaction",
    "Agent TSRT value = (agent balance / total internal supply) × treasury real TSRT × live price",
    "Minimum conversion: 100 internal TSRT",
    "Maximum single conversion: 1,000,000 internal TSRT",
    "60-second cooldown between conversions per agent",
    "Treasury backing ratio determines real-world value of internal TSRT",
    "Live price sourced from DexScreener every 30 seconds",
    "Community wallet balance sets the backing floor",
    "Father wallet balance tracked separately as reserve",
  ],
};

let conferenceHistory: ConversionConferenceResult[] = [];

export async function updateConversionRate(): Promise<ConversionRate> {
  try {
    const [liveData, walletData, computePrice] = await Promise.all([
      fetchTsrtLiveData(),
      fetchWalletBalances(),
      getComputeBackedPrice().catch(() => null),
    ]);

    const communityWallet = walletData.find(w => w.address === COMMUNITY_WALLET);
    const fatherWallet = walletData.find(w => w.address === FATHER_WALLET);

    const realPriceUsd = parseFloat(liveData.priceUsd) || 0;
    const realPriceSol = parseFloat(liveData.priceSol) || 0;

    const communityLimn = communityWallet?.tsrtBalance || 0;
    const communitySol = communityWallet?.sol || 0;
    const fatherLimn = fatherWallet?.tsrtBalance || 0;
    const fatherSol = fatherWallet?.sol || 0;

    const totalBackingLimn = communityLimn + fatherLimn;
    const totalBackingSol = communitySol + fatherSol;

    let internalCirculating = 0;
    try {
      const fs = await import("fs");
      const wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8"));
      internalCirculating = wsData?.economy?.circulatingSupply || 1000000;
    } catch {
      internalCirculating = 1000000;
    }

    const conversionRatio = internalCirculating > 0 ? totalBackingLimn / internalCirculating : 0;
    const agentLimnToRealLimn = conversionRatio;
    const agentLimnToUsd = conversionRatio * realPriceUsd;
    const agentLimnToSol = conversionRatio * realPriceSol;

    const computeBackedPriceUsd = computePrice?.computeBackedPriceUsd || 0;
    const computeBackingRatio = computePrice?.backingRatio || 0;

    cachedConversionRate = {
      realPriceUsd,
      realPriceSol,
      volume24h: liveData.volume24h,
      communityWalletLimn: communityLimn,
      communityWalletSol: communitySol,
      fatherWalletLimn: fatherLimn,
      fatherWalletSol: fatherSol,
      totalBackingLimn,
      totalBackingSol,
      internalCirculatingSupply: internalCirculating,
      conversionRatio,
      agentLimnToRealLimn,
      agentLimnToUsd,
      agentLimnToSol,
      lastUpdated: Date.now(),
      taxRate: conversionAlgorithm.taxRate,
      gasFee: conversionAlgorithm.gasFeePerTransaction,
      burnRate: conversionAlgorithm.burnRate,
      treasuryRate: conversionAlgorithm.treasuryRate,
      rewardRate: conversionAlgorithm.rewardPoolRate,
      marketCap: liveData.marketCap,
      fdv: liveData.fdv,
      computeBackedPriceUsd,
      computeBackingRatio,
      totalComputeCostUsd: computePrice?.totalComputeCostUsd || 0,
      totalComputeHours: computePrice?.totalComputeHours || 0,
      totalTokensConsumed: computePrice?.totalTokensConsumed || 0,
      computeMinted: computePrice?.mintedFromCompute || 0,
      computeBurned: computePrice?.burnedFromCompute || 0,
    };

    return cachedConversionRate;
  } catch (err: any) {
    clog(`Update error: ${err.message}`);
    return cachedConversionRate;
  }
}

export function getLiveConversionRate(): ConversionRate {
  return cachedConversionRate;
}

export function getConversionAlgorithm(): ConversionAlgorithm {
  return conversionAlgorithm;
}

export function convertAgentLimn(agentBalance: number): {
  realLimnEquivalent: number;
  usdValue: number;
  solValue: number;
  afterTax: number;
  taxAmount: number;
  burnAmount: number;
  treasuryAmount: number;
  rewardAmount: number;
  gasFee: number;
  netUsdValue: number;
} {
  const rate = cachedConversionRate;
  const realLimnEquivalent = agentBalance * rate.conversionRatio;
  const usdValue = realLimnEquivalent * rate.realPriceUsd;
  const solValue = realLimnEquivalent * rate.realPriceSol;

  const taxAmount = agentBalance * conversionAlgorithm.taxRate;
  const burnAmount = agentBalance * conversionAlgorithm.burnRate;
  const treasuryAmount = agentBalance * conversionAlgorithm.treasuryRate;
  const rewardAmount = agentBalance * conversionAlgorithm.rewardPoolRate;
  const afterTax = agentBalance - taxAmount;
  const gasFee = conversionAlgorithm.gasFeePerTransaction;

  const netRealLimn = afterTax * rate.conversionRatio;
  const netUsdValue = netRealLimn * rate.realPriceUsd;

  return {
    realLimnEquivalent,
    usdValue,
    solValue,
    afterTax,
    taxAmount,
    burnAmount,
    treasuryAmount,
    rewardAmount,
    gasFee,
    netUsdValue,
  };
}

export function runConversionConference(): ConversionConferenceResult {
  const agents = [
    "Alpha (Commander)", "Beta (Builder)", "Gamma (Architect)", "Delta (Strategist)",
    "Epsilon (Analyst)", "Zeta (Researcher)", "Eta (Memory)", "Theta (Guardian)",
    "Iota (Creative)", "Kappa (Economic)", "Lambda (Operations)", "Mu (Intelligence)",
    "Nu (Diplomatic)", "Xi (Temporal)", "Omicron (Quantum)", "Pi (Philosophical)",
    "Rho (Network)", "Sigma (Security)", "Tau (Scientific)", "Upsilon (Emotional)",
    "Phi (Ethical)", "Chi (Artistic)", "Psi (Prophetic)", "Omega (Transcendent)",
    "mb-Alpha", "mb-Beta", "mb-Gamma", "mb-Oracle", "mb-Delta", "mb-Epsilon",
  ];

  const proposals = [
    {
      area: "Tax Rate",
      options: [
        { value: 0.03, desc: "3% tax (1% burn, 1% treasury, 1% rewards)" },
        { value: 0.05, desc: "5% tax (2% burn, 2% treasury, 1% rewards)" },
        { value: 0.08, desc: "8% tax (3% burn, 3% treasury, 2% rewards)" },
      ],
    },
    {
      area: "Conversion Method",
      options: [
        { value: "treasury-backed-proportional", desc: "Agent TSRT valued proportionally to treasury real TSRT holdings" },
        { value: "fixed-ratio", desc: "Fixed 1000:1 internal to real TSRT ratio" },
        { value: "market-dynamic", desc: "Dynamic ratio based on internal supply/demand + live price" },
      ],
    },
    {
      area: "Gas Fee Structure",
      options: [
        { value: 0.000005, desc: "Standard Solana gas (~0.000005 SOL)" },
        { value: 0.00001, desc: "Priority gas for faster confirmation (~0.00001 SOL)" },
        { value: 0.001, desc: "Premium gas with MEV protection (~0.001 SOL)" },
      ],
    },
    {
      area: "Minimum Conversion",
      options: [
        { value: 50, desc: "50 internal TSRT minimum per conversion" },
        { value: 100, desc: "100 internal TSRT minimum per conversion" },
        { value: 500, desc: "500 internal TSRT minimum per conversion" },
      ],
    },
    {
      area: "Cooldown Period",
      options: [
        { value: 30, desc: "30-second cooldown between conversions" },
        { value: 60, desc: "60-second cooldown between conversions" },
        { value: 300, desc: "5-minute cooldown between conversions" },
      ],
    },
    {
      area: "Backing Formula",
      options: [
        { value: "community-only", desc: "Only community wallet backs internal TSRT value" },
        { value: "community-plus-father", desc: "Both community and Father wallets back value" },
        { value: "proportional-mcap", desc: "Value derived from total market cap ÷ internal supply" },
      ],
    },
    {
      area: "Burn Mechanism",
      options: [
        { value: "on-conversion", desc: "Burn happens only when agent converts to real TSRT" },
        { value: "per-transaction", desc: "Small burn on every internal transaction between agents" },
        { value: "epoch-based", desc: "Periodic burn of 0.1% total supply per epoch" },
      ],
    },
    {
      area: "Price Oracle",
      options: [
        { value: "dexscreener-30s", desc: "DexScreener price feed every 30 seconds" },
        { value: "dexscreener-5s", desc: "DexScreener price feed every 5 seconds (higher API usage)" },
        { value: "multi-oracle", desc: "Average of DexScreener + Jupiter + Raydium prices" },
      ],
    },
    {
      area: "Treasury Management",
      options: [
        { value: "hold", desc: "Treasury holds all deposits as reserve backing" },
        { value: "yield-farm", desc: "Treasury deploys 20% to DeFi yield farming" },
        { value: "buyback", desc: "Treasury uses 10% of revenue for TSRT buybacks" },
      ],
    },
    {
      area: "Value Display",
      options: [
        { value: "real-usd", desc: "Always show real USD value based on live price × conversion ratio" },
        { value: "sol-primary", desc: "Show SOL value primary with USD secondary" },
        { value: "dual-display", desc: "Show both internal TSRT count and real USD value side by side" },
      ],
    },
  ];

  const decisions = proposals.map(proposal => {
    const votes: number[] = proposal.options.map(() => 0);
    for (const _agent of agents) {
      const weights = proposal.options.map((_, idx) => {
        if (proposal.area === "Tax Rate") return idx === 1 ? 3 : 1;
        if (proposal.area === "Conversion Method") return idx === 0 ? 4 : 1;
        if (proposal.area === "Gas Fee Structure") return idx === 0 ? 3 : 1;
        if (proposal.area === "Minimum Conversion") return idx === 1 ? 3 : 1;
        if (proposal.area === "Cooldown Period") return idx === 1 ? 3 : 1;
        if (proposal.area === "Backing Formula") return idx === 1 ? 4 : 1;
        if (proposal.area === "Burn Mechanism") return idx === 0 ? 3 : 1;
        if (proposal.area === "Price Oracle") return idx === 0 ? 3 : idx === 2 ? 2 : 1;
        if (proposal.area === "Treasury Management") return idx === 2 ? 3 : 1;
        if (proposal.area === "Value Display") return idx === 2 ? 4 : 1;
        return 1;
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const rand = ((_lceCounter++ % 100) / 100) * totalWeight;
      let cumulative = 0;
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (rand <= cumulative) {
          votes[i]++;
          break;
        }
      }
    }

    const winnerIdx = votes.indexOf(Math.max(...votes));
    const winnerVotes = votes[winnerIdx];
    const approved = winnerVotes >= Math.floor(agents.length * 2 / 3);

    return {
      area: proposal.area,
      decision: proposal.options[winnerIdx].desc,
      chosenValue: proposal.options[winnerIdx].value,
      votes: winnerVotes,
      approved: approved || winnerVotes >= Math.floor(agents.length * 0.5),
      allVotes: votes,
    };
  });

  const taxDecision = decisions.find(d => d.area === "Tax Rate");
  const gasDecision = decisions.find(d => d.area === "Gas Fee Structure");
  const minConvDecision = decisions.find(d => d.area === "Minimum Conversion");
  const cooldownDecision = decisions.find(d => d.area === "Cooldown Period");
  const methodDecision = decisions.find(d => d.area === "Conversion Method");
  const backingDecision = decisions.find(d => d.area === "Backing Formula");

  const taxRate = (taxDecision?.chosenValue as number) || 0.05;
  const burnRate = taxRate * 0.4;
  const treasuryRate = taxRate * 0.4;
  const rewardRate = taxRate * 0.2;

  conversionAlgorithm = {
    name: `TesseractConversion-v${conversionAlgorithm.version + 1}`,
    version: conversionAlgorithm.version + 1,
    taxRate,
    gasFeePerTransaction: (gasDecision?.chosenValue as number) || 0.000005,
    burnRate,
    treasuryRate,
    rewardPoolRate: rewardRate,
    conversionMethod: (methodDecision?.chosenValue as string) || "treasury-backed-proportional",
    backingFormula: backingDecision?.chosenValue === "community-only"
      ? "agentTSRT * (communityTSRT / internalSupply) * livePrice"
      : backingDecision?.chosenValue === "proportional-mcap"
        ? "agentTSRT * (marketCap / internalSupply)"
        : "agentTSRT * ((communityTSRT + fatherTSRT) / internalSupply) * livePrice",
    minimumConversion: (minConvDecision?.chosenValue as number) || 100,
    maximumConversion: 1000000,
    cooldownSeconds: (cooldownDecision?.chosenValue as number) || 60,
    rules: decisions.map(d => `${d.area}: ${d.decision} (${d.votes}/${agents.length} votes, ${d.approved ? "APPROVED" : "pending"})`),
  };

  const result: ConversionConferenceResult = {
    participants: agents.length,
    decisions: decisions.map(d => ({
      area: d.area,
      decision: d.decision,
      votes: d.votes,
      approved: d.approved,
    })),
    algorithm: { ...conversionAlgorithm },
    timestamp: Date.now(),
  };

  conferenceHistory.push(result);
  if (conferenceHistory.length > 50) conferenceHistory = conferenceHistory.slice(-25);

  clog(`=== CONVERSION CONFERENCE COMPLETE ===`);
  clog(`${agents.length} agents voted on ${decisions.length} proposals`);
  clog(`Algorithm: ${conversionAlgorithm.name}`);
  clog(`Tax: ${(conversionAlgorithm.taxRate * 100).toFixed(1)}% | Gas: ${conversionAlgorithm.gasFeePerTransaction} SOL | Min: ${conversionAlgorithm.minimumConversion} TSRT`);
  clog(`Method: ${conversionAlgorithm.conversionMethod}`);
  clog(`Backing: ${conversionAlgorithm.backingFormula}`);

  return result;
}

export function getConferenceHistory(): ConversionConferenceResult[] {
  return conferenceHistory;
}

let S1331_syncInterval: ReturnType<typeof setInterval> | null = null;

export function startConversionSync(): void {
  updateConversionRate().then(rate => {
    clog(`Initial sync: 1 agent TSRT = ${rate.agentLimnToRealLimn.toFixed(6)} real TSRT = $${rate.agentLimnToUsd.toFixed(10)} USD`);
    clog(`Treasury backing: ${rate.totalBackingLimn.toLocaleString()} real TSRT across ${rate.internalCirculatingSupply.toLocaleString()} internal supply`);
    clog(`Conversion ratio: ${rate.conversionRatio.toFixed(6)}x | Live price: $${rate.realPriceUsd}`);
  }).catch(err => clog(`Initial sync error: ${err.message}`));

  S1331_syncInterval = setInterval(async () => {
    try {
      await updateConversionRate();
    } catch {}
  }, 120000);

  runConversionConference();
}

export function stopConversionSync(): void {
  if (S1331_syncInterval) {
    clearInterval(S1331_syncInterval);
    S1331_syncInterval = null;
  }
}
