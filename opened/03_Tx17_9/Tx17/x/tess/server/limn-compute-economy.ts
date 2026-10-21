import fs from "fs";
import path from "path";
import { TSRT_CONTRACT, fetchTsrtLiveData } from "./real-limn-data";

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
