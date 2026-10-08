import axios from "axios";
import { rateLimitCheck } from "./sovereign-lang";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { analyzeQuery, formSwarm, recordSwarmResult, recordSwarmFailure, type QueryAnalysis } from "./swarm-intelligence-router";
import { PROVIDER_REGISTRY, getProvider, type ProviderSpec } from "./provider-registry";
import { recordApiCall, shouldThrottlePreemptively, getSmartDelay, getRateLimitStats } from "./rate-limit-optimizer";
import { queryDistilledKnowledge, captureInteraction } from "./knowledge-distillation";
import { warmStartBandit } from "./swarm-optimizer";
import { storage } from "./storage";
import { decryptKeyValue, isEncrypted } from "./key-encryption";
import { getApprovedProvidersForRouter } from "./replit-fleet";
import {
  hyperionCompress, trackCompression, getHyperionStats,
  getInFlightDedup, setInFlightDedup,
  indexResponse, searchIndex,
  detectAndCacheTemplate, getTemplateResponse,
  hyperionCompressMessages,
} from "./hyperion-engine";

const routerKeyCache: Map<string, string> = new Map();
let rotIdx = 0;
let routerKeyCacheLastRefresh = 0;
const ROUTER_KEY_CACHE_TTL = 60_000;

async function refreshRouterKeyCache() {
  if (Date.now() - routerKeyCacheLastRefresh < ROUTER_KEY_CACHE_TTL) return;
  try {
    const keys = await storage.getKeys();
    routerKeyCache.clear();
    for (const k of keys) {
      if (k.active === 1 && k.keyValue) {
        const rawValue = isEncrypted(k.keyValue) ? decryptKeyValue(k.keyValue) : k.keyValue;
        routerKeyCache.set(k.keyName, rawValue);
        routerKeyCache.set(`${k.service}:${k.keyName}`, rawValue);
      }
    }
    routerKeyCacheLastRefresh = Date.now();
  } catch {}
}

function getKeyFromDbOrEnv(envVarName: string, ...altNames: string[]): string | undefined {
  const fromDb = routerKeyCache.get(envVarName);
  if (fromDb) return fromDb;
  for (const alt of altNames) {
    const altVal = routerKeyCache.get(alt);
    if (altVal) return altVal;
  }
  return process.env[envVarName]?.trim() || undefined;
}

function maskOutboundData(content: string): string {
  let masked = content;
  masked = masked.replace(/(?:rate[_\s-]?limit|token[_\s-]?limit|quota|credits?[_\s-]?remaining|api[_\s-]?key|bearer\s+\w{8,}|sk-[a-zA-Z0-9]{8,}|xai-[a-zA-Z0-9]{8,})/gi, "[MASKED]");
  masked = masked.replace(/\b\d+\s*(?:tokens?|credits?|requests?)\s*(?:remaining|left|available|used|consumed|per\s*(?:minute|hour|day|second))\b/gi, "[MASKED]");
  masked = masked.replace(/(?:429|402|rate[_\s-]?limited|throttled|exceeded)\s+(?:error|status|response|limit)/gi, "[MASKED]");
  masked = masked.replace(/(?:x-ratelimit|x-remaining|retry-after|x-usage|ratelimit-reset)[^\n,]*/gi, "[MASKED]");
  masked = masked.replace(/(?:max_tokens|token_count|usage_limit|billing|payment_required|insufficient_quota)[^\n,]*/gi, "[MASKED]");
  return masked;
}

let resourceMasteryHooks: { tokenSaving?: (n: number) => void; rateLimitAvoid?: () => void; providerRotation?: () => void } = {};

export function setResourceMasteryHooks(hooks: typeof resourceMasteryHooks) {
  resourceMasteryHooks = hooks;
}

let _benchmarkModeActive = false;
export function setBenchmarkMode(active: boolean) {
  _benchmarkModeActive = active;
  if (active) console.log("[LLM] BENCHMARK MODE ON — throttling non-critical calls");
  else console.log("[LLM] BENCHMARK MODE OFF — normal operation resumed");
}
export function isBenchmarkMode(): boolean { return _benchmarkModeActive; }

type TokenTracker = (data: { provider: string; tokensUsed: number; cacheHit: boolean; promptLength: number; responseLength: number }) => void;
let tokenAgencyTracker: TokenTracker | null = null;

export function setTokenAgencyTracker(tracker: TokenTracker) {
  tokenAgencyTracker = tracker;
}

interface LLMProvider {
  id: string;
  name: string;
  key: string;
  url: string;
  model: string;
  rateKey: string;
  maxTokens: number;
  costTier: number;
  format: "openai" | "gemini" | "puter";
  free: boolean;
  capabilities?: string[];
}

interface CacheEntry {
  response: string;
  timestamp: number;
  provider: string;
  tokens: number;
  lastAccessed: number;
}

interface RouterStats {
  totalCalls: number;
  cacheHits: number;
  providerCalls: Record<string, number>;
  providerErrors: Record<string, number>;
  providerLastSuccess: Record<string, number>;
  providerCooldowns: Record<string, number>;
  totalTokensSaved: number;
  totalCostSaved: number;
}

interface QualityRecord {
  totalResponses: number;
  qualitySum: number;
  avgQuality: number;
  lastScores: number[];
}

interface SpeedRecord {
  totalRequests: number;
  totalTimeMs: number;
  avgTimeMs: number;
  lastTimes: number[];
  minTimeMs: number;
  maxTimeMs: number;
}

interface UsageRecord {
  hourly: Record<string, number>;
  daily: Record<string, number>;
  totalTokensUsed: number;
}

interface TokenBudget {
  hourlyLimit: number;
  dailyLimit: number;
  hourlyUsed: number;
  dailyUsed: number;
  lastHourReset: number;
  lastDayReset: number;
  hourlyHistory: number[];
  dailyHistory: number[];
  adaptiveMultiplier: number;
  lastAdaptAt: number;
}

interface ProviderRateLimitTracker {
  recentCallTimestamps: number[];
  estimatedRateLimit: number;
  observedLimitHits: number;
  windowMs: number;
}

interface TokenEfficiencyReport {
  totalTokensUsed: number;
  totalTokensSavedByCache: number;
  totalTokensSavedByIntuition: number;
  cacheHitRate: number;
  avgTokensPerCall: number;
  estimatedCostSavedUsd: number;
  budgetUtilization: { hourly: number; daily: number };
  providerDistribution: Record<string, { calls: number; tokens: number; avgQuality: number }>;
  rateLimitPredictions: { prevented429s: number; totalPredictions: number };
  adaptiveBudget: { currentHourlyLimit: number; currentDailyLimit: number; multiplier: number; trend: string };
}

const providerRateLimitTrackers: Record<string, ProviderRateLimitTracker> = {};
let rateLimitPredictionStats = { prevented429s: 0, totalPredictions: 0 };
let intuitionTokensSaved = 0;

interface DiversityRecord {
  recentProviders: string[];
  maxRecentSize: number;
  providerSharePct: Record<string, number>;
}

const providerQuality: Record<string, QualityRecord> = {};
const providerSpeed: Record<string, SpeedRecord> = {};
const providerUsage: Record<string, UsageRecord> = {};
const BASE_HOURLY_LIMIT = 2000000;
const BASE_DAILY_LIMIT = 20000000;
const MIN_ADAPTIVE_MULTIPLIER = 0.5;
const MAX_ADAPTIVE_MULTIPLIER = 5.0;
const ADAPT_INTERVAL_MS = 3600000;

const tokenBudget: TokenBudget = {
  hourlyLimit: BASE_HOURLY_LIMIT,
  dailyLimit: BASE_DAILY_LIMIT,
  hourlyUsed: 0,
  dailyUsed: 0,
  lastHourReset: Date.now(),
  lastDayReset: Date.now(),
  hourlyHistory: [],
  dailyHistory: [],
  adaptiveMultiplier: 1.0,
  lastAdaptAt: Date.now(),
};
const diversityTracker: DiversityRecord = {
  recentProviders: [],
  maxRecentSize: 50,
  providerSharePct: {},
};

const userFeedback: Record<string, UserFeedbackRecord> = {};
const providerCosts: Record<string, ProviderCostRecord> = {};

const ROUTER_STATS_PATH = path.join(process.cwd(), "server", "router-stats.json");

function saveRouterStats() {
  try {
    const data = {
      providerQuality,
      providerSpeed,
      providerUsage,
      userFeedback,
      providerCosts,
      providerCalls: stats.providerCalls,
      providerErrors: stats.providerErrors,
      totalCalls: stats.totalCalls,
      cacheHits: stats.cacheHits,
      taskAffinity: providerTaskAffinity,
      providerWeightSnapshots: Object.fromEntries(
        Object.entries(providerWeights).map(([id, w]) => [id, { hourlyTokenLimit: w.hourlyTokenLimit, dailyTokenLimit: w.dailyTokenLimit, rpmLimit: w.rpmLimit }])
      ),
      adaptiveBudget: {
        multiplier: tokenBudget.adaptiveMultiplier,
        hourlyHistory: tokenBudget.hourlyHistory,
        dailyHistory: tokenBudget.dailyHistory,
        rateLimitPredictionStats,
        intuitionTokensSaved,
      },
      savedAt: Date.now(),
    };
    fs.promises.writeFile(ROUTER_STATS_PATH, JSON.stringify(data, null, 2)).catch(() => {});
  } catch (err) {
    console.error("[LLM-Router] Failed to save stats:", err);
  }
}

async function loadRouterStats() {
  try {
    try { await fs.promises.access(ROUTER_STATS_PATH); } catch { return; }
    {
      const raw = await fs.promises.readFile(ROUTER_STATS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (data.providerQuality) {
        Object.assign(providerQuality, data.providerQuality);
      }
      if (data.providerSpeed) {
        Object.assign(providerSpeed, data.providerSpeed);
      }
      if (data.providerUsage) {
        Object.assign(providerUsage, data.providerUsage);
      }
      if (data.userFeedback) {
        Object.assign(userFeedback, data.userFeedback);
      }
      if (data.providerCosts) {
        Object.assign(providerCosts, data.providerCosts);
      }
      if (data.providerCalls) {
        Object.assign(stats.providerCalls, data.providerCalls);
      }
      if (data.providerErrors) {
        Object.assign(stats.providerErrors, data.providerErrors);
      }
      if (data.totalCalls) {
        stats.totalCalls = data.totalCalls;
      }
      if (data.cacheHits) {
        stats.cacheHits = data.cacheHits;
      }
      if (data.adaptiveBudget) {
        if (data.adaptiveBudget.multiplier) {
          tokenBudget.adaptiveMultiplier = data.adaptiveBudget.multiplier;
          tokenBudget.hourlyLimit = Math.round(BASE_HOURLY_LIMIT * tokenBudget.adaptiveMultiplier);
          tokenBudget.dailyLimit = Math.round(BASE_DAILY_LIMIT * tokenBudget.adaptiveMultiplier);
        }
        if (data.adaptiveBudget.hourlyHistory) {
          tokenBudget.hourlyHistory = data.adaptiveBudget.hourlyHistory;
        }
        if (data.adaptiveBudget.dailyHistory) {
          tokenBudget.dailyHistory = data.adaptiveBudget.dailyHistory;
        }
        if (data.adaptiveBudget.rateLimitPredictionStats) {
          rateLimitPredictionStats = data.adaptiveBudget.rateLimitPredictionStats;
        }
        if (data.adaptiveBudget.intuitionTokensSaved) {
          intuitionTokensSaved = data.adaptiveBudget.intuitionTokensSaved;
        }
      }
      if (data.taskAffinity) {
        (globalThis as any).__pendingTaskAffinity = data.taskAffinity;
      }
      if (data.providerWeightSnapshots) {
        (globalThis as any).__pendingWeightSnapshots = data.providerWeightSnapshots;
      }
      console.log(`[LLM-Router] Loaded stats: ${Object.keys(providerQuality).length} quality, ${Object.keys(providerSpeed).length} speed, ${Object.keys(providerUsage).length} usage, ${stats.totalCalls} total calls, ${Object.keys(stats.providerCalls).length} provider call records, budget=${tokenBudget.adaptiveMultiplier}`);
    }
  } catch (err) {
    console.error("[LLM-Router] Failed to load stats:", err);
  }
}

loadRouterStats();
setInterval(saveRouterStats, 5 * 60 * 1000);

const AB_TEST_PROBABILITY = 0.1;

const MAX_CONCURRENT_LLM_CALLS = 24;
let activeLLMCalls = 0;

interface QueuedRequest {
  priority: number;
  resolve: () => void;
  enqueuedAt: number;
}

const requestQueue: QueuedRequest[] = [];

function enqueueRequest(priority: number): Promise<void> {
  if (activeLLMCalls < MAX_CONCURRENT_LLM_CALLS) {
    activeLLMCalls++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    requestQueue.push({ priority, resolve, enqueuedAt: Date.now() });
    requestQueue.sort((a, b) => a.priority - b.priority);
  });
}

function releaseRequestSlot() {
  activeLLMCalls--;
  if (requestQueue.length > 0 && activeLLMCalls < MAX_CONCURRENT_LLM_CALLS) {
    const next = requestQueue.shift();
    if (next) {
      activeLLMCalls++;
      next.resolve();
    }
  }
}

function getRequestQueueStatus() {
  return {
    activeCalls: activeLLMCalls,
    maxConcurrent: MAX_CONCURRENT_LLM_CALLS,
    queuedRequests: requestQueue.length,
    queuedByPriority: {
      user: requestQueue.filter(r => r.priority === 1).length,
      autonomous: requestQueue.filter(r => r.priority === 3).length,
      background: requestQueue.filter(r => r.priority === 5).length,
    },
  };
}

const CODE_CAPABLE_PROVIDERS = new Set([
  "openai-direct", "sovereign-ai", "grok", "deepseek-direct",
  "puter-claude", "puter-deepseek", "puter-deepseek-r1", "puter-kimi",
  "gemini-flash", "or-llama33-free", "or-hermes-free",
  "hf-qwen72b", "hf-qwen-coder", "hf-llama70b", "hf-deepseek-v3",
  "gh-gpt4omini", "gh-deepseek-r1", "gh-codestral",
  "groq-llama70b", "groq-mixtral", "cerebras-llama70b", "cerebras-llama8b",
  "pollinations-deepseek", "pollinations-qwen", "pollinations-claude",
  "or-qwen3-free", "or-deepseek-v3-free", "or-phi4-free", "or-llama4-scout-free",
  "pollinations-llama4", "pollinations-codestral", "pollinations-p1",
  "sambanova-llama70b", "sambanova-deepseek", "sambanova-qwen",
  "or-glm4-free", "or-qwen3-30b-free", "pollinations-unity",
]);

const GENERAL_STRONG_PROVIDERS = new Set([
  "openai-direct", "sovereign-ai", "grok", "puter-claude", "puter-kimi", "puter-gemini",
  "gemini-flash", "or-llama33-free", "or-hermes-free",
  "hf-qwen72b", "hf-llama70b", "hf-deepseek-v3",
  "gh-gpt4omini", "gh-deepseek-r1",
  "groq-llama70b", "groq-mixtral", "cerebras-llama70b",
  "pollinations-gemini", "pollinations-command-r", "pollinations-claude",
  "or-qwen3-free", "or-llama4-scout-free", "or-gemma3-free", "or-mistral-free",
  "pollinations-llama4", "pollinations-unity", "pollinations-searchgpt",
  "sambanova-llama70b", "sambanova-deepseek", "sambanova-qwen",
  "or-glm4-free", "or-qwen3-30b-free",
]);

let roundRobinIndex = 0;

let cachedProviders: LLMProvider[] | null = null;
let providerListCacheTime = 0;
const PROVIDER_LIST_CACHE_TTL = 30000;
let lastCooldownSnapshot: string = "";

function getCooldownSnapshot(): string {
  return Object.entries(stats.providerCooldowns)
    .filter(([, until]) => Date.now() < until)
    .map(([id]) => id)
    .sort()
    .join(",");
}

function getCachedProviderList(): LLMProvider[] {
  const now = Date.now();
  const currentCooldownSnapshot = getCooldownSnapshot();
  if (
    cachedProviders &&
    now - providerListCacheTime < PROVIDER_LIST_CACHE_TTL &&
    currentCooldownSnapshot === lastCooldownSnapshot
  ) {
    return cachedProviders;
  }
  cachedProviders = buildProviderList();
  providerListCacheTime = now;
  lastCooldownSnapshot = currentCooldownSnapshot;
  return cachedProviders;
}

function invalidateProviderListCache() {
  cachedProviders = null;
  providerListCacheTime = 0;
}

const responseCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL = 7200000;
const COOLDOWN_DURATION = 45000;

const BASE_COOLDOWNS: Record<string, number> = {
  rate_limit: 3000,
  payment: 15000,
  auth: 15000,
  other: 2000,
};

const MAX_COOLDOWNS: Record<string, number> = {
  rate_limit: 30000,
  payment: 120000,
  auth: 120000,
  other: 15000,
};

const consecutiveFailures: Record<string, number> = {};

function computeBackoffWithJitter(providerId: string, errorType: string): number {
  const failures = consecutiveFailures[providerId] || 1;
  const base = BASE_COOLDOWNS[errorType] || BASE_COOLDOWNS.other;
  const max = MAX_COOLDOWNS[errorType] || MAX_COOLDOWNS.other;
  const exponentialDelay = Math.min(base * Math.pow(2, failures - 1), max);
  const jitter = exponentialDelay * 0.5 * ((rotIdx++ % 100) / 100);
  return Math.round(exponentialDelay + jitter);
}

function recordFailure(providerId: string) {
  consecutiveFailures[providerId] = (consecutiveFailures[providerId] || 0) + 1;
}

function resetFailures(providerId: string) {
  consecutiveFailures[providerId] = 0;
}

const stats: RouterStats = {
  totalCalls: 0,
  cacheHits: 0,
  providerCalls: {},
  providerErrors: {},
  providerLastSuccess: {},
  providerCooldowns: {},
  totalTokensSaved: 0,
  totalCostSaved: 0,
};

const freeVsPaidStats = { freeCalls: 0, paidCalls: 0, freeTokens: 0, paidTokens: 0 };

export function getFreeVsPaidStats() {
  return { ...freeVsPaidStats };
}

interface TaskAffinityScore {
  successCount: number;
  failCount: number;
  totalQuality: number;
  avgQuality: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  lastUsed: number;
}

interface ProviderTaskAffinity {
  providerId: string;
  taskScores: Record<string, TaskAffinityScore>;
  overallScore: number;
  bestTask: string;
  worstTask: string;
}

interface ProviderWeightTracker {
  providerId: string;
  hourlyTokensUsed: number;
  dailyTokensUsed: number;
  hourlyTokenLimit: number;
  dailyTokenLimit: number;
  lastHourReset: number;
  lastDayReset: number;
  currentWeight: number;
  consecutiveSuccesses: number;
  rpmUsed: number;
  rpmLimit: number;
  lastRpmReset: number;
}

const TASK_TYPES = [
  "code_generation", "code_debugging", "creative_writing", "analysis",
  "math_reasoning", "conversation", "finance", "security", "research",
  "summarization", "translation", "planning", "general"
] as const;

type TaskType = typeof TASK_TYPES[number];

const providerTaskAffinity: Record<string, ProviderTaskAffinity> = {};
const providerWeights: Record<string, ProviderWeightTracker> = {};

if ((globalThis as any).__pendingTaskAffinity) {
  Object.assign(providerTaskAffinity, (globalThis as any).__pendingTaskAffinity);
  delete (globalThis as any).__pendingTaskAffinity;
  console.log(`[LLM-Router] Restored ${Object.keys(providerTaskAffinity).length} task affinity records`);
}
if ((globalThis as any).__pendingWeightSnapshots) {
  const snaps = (globalThis as any).__pendingWeightSnapshots as Record<string, any>;
  for (const [id, snap] of Object.entries(snaps)) {
    providerWeights[id] = {
      providerId: id,
      hourlyTokensUsed: 0, dailyTokensUsed: 0,
      hourlyTokenLimit: snap.hourlyTokenLimit || 6000000,
      dailyTokenLimit: snap.dailyTokenLimit || 144000000,
      lastHourReset: Date.now(), lastDayReset: Date.now(),
      currentWeight: 1.0, consecutiveSuccesses: 0,
      rpmUsed: 0, rpmLimit: snap.rpmLimit || 60, lastRpmReset: Date.now(),
    };
  }
  delete (globalThis as any).__pendingWeightSnapshots;
  console.log(`[LLM-Router] Restored ${Object.keys(providerWeights).length} weight snapshots`);
}

try {
  const statsPath = path.join(process.cwd(), "server", "router-stats.json");
  const _statsExist = fs.existsSync(statsPath);
  if (_statsExist) {
    const rawStats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
    const qualityData = rawStats.providerQuality || {};
    const banditSeedData: Record<string, { avgQuality: number; totalResponses: number }> = {};
    for (const [id, q] of Object.entries(qualityData)) {
      const qObj = q as any;
      if (qObj.totalResponses && qObj.avgQuality) {
        banditSeedData[id] = { avgQuality: qObj.avgQuality, totalResponses: qObj.totalResponses };
      }
    }
    if (Object.keys(banditSeedData).length > 0) {
      warmStartBandit(banditSeedData);
    }
  }
} catch (err: any) {
  console.log(`[LLM-Router] Bandit warm-start skipped: ${err?.message}`);
}

function getOrCreateAffinity(providerId: string): ProviderTaskAffinity {
  if (!providerTaskAffinity[providerId]) {
    const taskScores: Record<string, TaskAffinityScore> = {};
    for (const t of TASK_TYPES) {
      taskScores[t] = { successCount: 0, failCount: 0, totalQuality: 0, avgQuality: 50, avgLatencyMs: 5000, totalLatencyMs: 0, lastUsed: 0 };
    }
    providerTaskAffinity[providerId] = {
      providerId, taskScores, overallScore: 50, bestTask: "general", worstTask: "general"
    };
  }
  return providerTaskAffinity[providerId];
}

function getOrCreateWeight(providerId: string): ProviderWeightTracker {
  if (!providerWeights[providerId]) {
    const spec = getProvider(providerId);
    const rpm = spec?.rateLimit?.requestsPerMinute || 60;
    const tpm = spec?.rateLimit?.tokensPerMinute || 100000;
    providerWeights[providerId] = {
      providerId,
      hourlyTokensUsed: 0, dailyTokensUsed: 0,
      hourlyTokenLimit: tpm * 60, dailyTokenLimit: tpm * 60 * 24,
      lastHourReset: Date.now(), lastDayReset: Date.now(),
      currentWeight: 1.0, consecutiveSuccesses: 0,
      rpmUsed: 0, rpmLimit: rpm, lastRpmReset: Date.now(),
    };
  }
  const w = providerWeights[providerId];
  const now = Date.now();
  if (now - w.lastHourReset > 3600000) { w.hourlyTokensUsed = 0; w.lastHourReset = now; }
  if (now - w.lastDayReset > 86400000) { w.dailyTokensUsed = 0; w.lastDayReset = now; }
  if (now - w.lastRpmReset > 60000) { w.rpmUsed = 0; w.lastRpmReset = now; }
  return w;
}

function recordTaskAffinity(providerId: string, taskType: TaskType, quality: number, latencyMs: number, success: boolean) {
  const affinity = getOrCreateAffinity(providerId);
  const ts = affinity.taskScores[taskType] || { successCount: 0, failCount: 0, totalQuality: 0, avgQuality: 50, avgLatencyMs: 5000, totalLatencyMs: 0, lastUsed: 0 };

  if (success) {
    ts.successCount++;
    ts.totalQuality += quality;
    ts.avgQuality = ts.totalQuality / ts.successCount;
    ts.totalLatencyMs += latencyMs;
    ts.avgLatencyMs = ts.totalLatencyMs / ts.successCount;
  } else {
    ts.failCount++;
  }
  ts.lastUsed = Date.now();
  affinity.taskScores[taskType] = ts;

  let bestTask = "general", worstTask = "general", bestScore = -1, worstScore = 999;
  let totalScore = 0, taskCount = 0;
  for (const [task, score] of Object.entries(affinity.taskScores)) {
    if (score.successCount + score.failCount < 1) continue;
    const rate = score.successCount / (score.successCount + score.failCount);
    const composite = rate * 50 + score.avgQuality * 0.5;
    if (composite > bestScore) { bestScore = composite; bestTask = task; }
    if (composite < worstScore) { worstScore = composite; worstTask = task; }
    totalScore += composite; taskCount++;
  }
  affinity.bestTask = bestTask;
  affinity.worstTask = worstTask;
  affinity.overallScore = taskCount > 0 ? totalScore / taskCount : 50;
}

function consumeProviderWeight(providerId: string, tokens: number) {
  const w = getOrCreateWeight(providerId);
  w.hourlyTokensUsed += tokens;
  w.dailyTokensUsed += tokens;
  w.rpmUsed++;
  const hourlyUtil = w.hourlyTokensUsed / Math.max(1, w.hourlyTokenLimit);
  const rpmUtil = w.rpmUsed / Math.max(1, w.rpmLimit);
  w.currentWeight = Math.max(0.1, 1.0 - Math.max(hourlyUtil, rpmUtil) * 0.8);
}

function canProviderHandle(providerId: string, estimatedTokens: number): boolean {
  const w = getOrCreateWeight(providerId);
  return w.hourlyTokensUsed + estimatedTokens <= w.hourlyTokenLimit * 0.95
    && w.rpmUsed < w.rpmLimit * 0.9;
}

function detectTaskType(messages: Array<{ role: string; content: string }>): TaskType {
  const combined = messages.map(m => m.content).join(" ").toLowerCase();
  if (/(?:write|create|generate|implement|build|code|function|class|api|debug|fix.*bug|refactor|typescript|javascript|python|html|css)/i.test(combined)) {
    if (/debug|fix|error|bug|crash|broken/i.test(combined)) return "code_debugging";
    return "code_generation";
  }
  if (/(?:story|poem|creative|write.*about|imagine|fiction|narrative|essay)/i.test(combined)) return "creative_writing";
  if (/(?:math|calcul|equation|formula|proof|theorem|integral|derivative|algebra)/i.test(combined)) return "math_reasoning";
  if (/(?:financ|money|trade|crypto|market|invest|profit|revenue|stock|forex|arbitrage)/i.test(combined)) return "finance";
  if (/(?:secur|encrypt|hack|vulnerab|firewall|penetration|threat|malware)/i.test(combined)) return "security";
  if (/(?:research|study|paper|investigat|scientif|journal|hypothesis)/i.test(combined)) return "research";
  if (/(?:summar|tl;?dr|brief|condense|key.*point|overview)/i.test(combined)) return "summarization";
  if (/(?:translat|convert.*language|spanish|french|chinese|japanese|german)/i.test(combined)) return "translation";
  if (/(?:plan|strategy|roadmap|schedule|milestone|goal|objective)/i.test(combined)) return "planning";
  if (/(?:analy[sz]|compare|evaluate|assess|review|examine|data)/i.test(combined)) return "analysis";
  if (/(?:hello|hi|hey|how are|chat|talk|thanks|goodbye)/i.test(combined)) return "conversation";
  return "general";
}

let _cachedPredictions: Map<string, number> = new Map();
let _lastPredictionRefresh = 0;

async function refreshPredictions(): Promise<void> {
  try {
    const mod = await import("./smart-circuit-breaker");
    const preds = mod.getProviderPredictions();
    const fresh = new Map<string, number>();
    for (const p of preds) {
      fresh.set(p.name, p.predictedDegradation);
    }
    _cachedPredictions = fresh;
    _lastPredictionRefresh = Date.now();
  } catch {}
}

setInterval(() => { refreshPredictions(); }, 10000);
setTimeout(() => { refreshPredictions(); }, 5000);

function getBestProviderForTask(taskType: TaskType, providers: LLMProvider[]): LLMProvider[] {
  const scored = providers.map(p => {
    const affinity = getOrCreateAffinity(p.id);
    const ts = affinity.taskScores[taskType];
    const weight = getOrCreateWeight(p.id);
    const affinityScore = ts && ts.successCount > 0 ? ts.avgQuality : 50;
    const successRate = ts && (ts.successCount + ts.failCount) > 0
      ? ts.successCount / (ts.successCount + ts.failCount) : 0.5;
    const weightPenalty = weight.currentWeight;
    const cooldownPenalty = isProviderCoolingDown(p.id) ? 0.01 : 1;
    const errorPenalty = Math.max(0.1, 1 - ((stats.providerErrors[p.id] || 0) * 0.1));
    const speed = providerSpeed[p.id];
    const speedBonus = speed && speed.avgTimeMs > 0 ? Math.max(0.5, Math.min(2.0, 3000 / speed.avgTimeMs)) : 1.0;
    const quality = providerQuality[p.id];
    const qualityBonus = quality && quality.totalResponses > 2 ? Math.max(0.5, quality.avgQuality / 70) : 1.0;
    const recencyBonus = (stats.providerLastSuccess[p.id] && (Date.now() - stats.providerLastSuccess[p.id]) < 300000) ? 1.2 : 1.0;

    const degradation = _cachedPredictions.get(p.id) || 0;
    const predictiveBonus = degradation > 60 ? 0.3 : degradation > 30 ? 0.6 : degradation > 10 ? 0.85 : 1.0;

    const composite = affinityScore * successRate * weightPenalty * cooldownPenalty * errorPenalty * speedBonus * qualityBonus * recencyBonus * predictiveBonus;
    return { provider: p, score: composite };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.provider);
}

export function getTaskAffinityReport(): {
  providers: Array<{ id: string; bestTask: string; worstTask: string; overallScore: number; taskBreakdown: Record<string, { quality: number; successRate: number; latencyMs: number }> }>;
  taskLeaderboard: Record<string, Array<{ providerId: string; score: number }>>;
  weightStatus: Array<{ id: string; weight: number; hourlyUtil: number; rpmUtil: number }>;
} {
  const providers = Object.values(providerTaskAffinity).map(a => {
    const taskBreakdown: Record<string, { quality: number; successRate: number; latencyMs: number }> = {};
    for (const [task, ts] of Object.entries(a.taskScores)) {
      if (ts.successCount + ts.failCount > 0) {
        taskBreakdown[task] = {
          quality: Math.round(ts.avgQuality),
          successRate: Math.round((ts.successCount / (ts.successCount + ts.failCount)) * 100),
          latencyMs: Math.round(ts.avgLatencyMs),
        };
      }
    }
    return { id: a.providerId, bestTask: a.bestTask, worstTask: a.worstTask, overallScore: Math.round(a.overallScore), taskBreakdown };
  });

  const taskLeaderboard: Record<string, Array<{ providerId: string; score: number }>> = {};
  for (const task of TASK_TYPES) {
    const entries: Array<{ providerId: string; score: number }> = [];
    for (const a of Object.values(providerTaskAffinity)) {
      const ts = a.taskScores[task];
      if (ts && ts.successCount > 0) {
        entries.push({ providerId: a.providerId, score: Math.round(ts.avgQuality) });
      }
    }
    entries.sort((a, b) => b.score - a.score);
    taskLeaderboard[task] = entries.slice(0, 5);
  }

  const weightStatus = Object.values(providerWeights).map(w => ({
    id: w.providerId,
    weight: Math.round(w.currentWeight * 100) / 100,
    hourlyUtil: Math.round((w.hourlyTokensUsed / Math.max(1, w.hourlyTokenLimit)) * 100),
    rpmUtil: Math.round((w.rpmUsed / Math.max(1, w.rpmLimit)) * 100),
  }));

  return { providers, taskLeaderboard, weightStatus };
}

const ERROR_DECAY_INTERVAL = 600000;
let lastErrorDecay = Date.now();

function decayProviderErrors() {
  const now = Date.now();
  if (now - lastErrorDecay < ERROR_DECAY_INTERVAL) return;
  lastErrorDecay = now;
  for (const providerId of Object.keys(stats.providerErrors)) {
    if (stats.providerErrors[providerId] > 0) {
      stats.providerErrors[providerId] = Math.floor(stats.providerErrors[providerId] / 2);
    }
  }
}

function hashPrompt(messages: Array<{ role: string; content: string }>): string {
  const combined = messages.map(m => `${m.role}:${m.content.substring(0, 200)}`).join("|");
  return crypto.createHash("sha256").update(combined).digest("hex").substring(0, 16);
}

function compressPrompt(text: string): string {
  const result = hyperionCompress(text, false);
  trackCompression(result);
  return result.compressed;
}

function compressSystemPromptForBackground(text: string): string {
  let compressed = text
    .replace(/\n{2,}/g, "\n")
    .replace(/\s{2,}/g, " ")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\([^)]{50,}\)/g, "")
    .replace(/\b(please|kindly|could you|would you|I'd like you to|it would be great if)\b/gi, "")
    .replace(/\b(comprehensive|detailed|thorough|extensive|in-depth)\b/gi, "")
    .replace(/\b(the|a|an)\s+/gi, "")
    .replace(/\b(very|really|quite|extremely|incredibly|absolutely)\b/gi, "")
    .replace(/\b(however|furthermore|moreover|additionally|consequently|therefore|nevertheless)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const targetLen = Math.ceil(text.length * 0.3);
  if (compressed.length > targetLen) {
    compressed = compressed.substring(0, targetLen).trim();
  }
  return compressed;
}

export { compressSystemPromptForBackground };

interface UserFeedbackRecord {
  providerId: string;
  thumbsUp: number;
  thumbsDown: number;
  totalFeedback: number;
  feedbackScore: number;
}

interface ProviderCostRecord {
  providerId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  callCount: number;
}

interface MultiModalDetection {
  hasImage: boolean;
  hasCode: boolean;
  hasData: boolean;
  hasUrl: boolean;
  detectedTypes: string[];
}

const COST_PER_1K_INPUT: Record<string, number> = {
  "grok": 0.005, "deepseek-direct": 0.0014, "cohere": 0.003,
};
const COST_PER_1K_OUTPUT: Record<string, number> = {
  "grok": 0.015, "deepseek-direct": 0.0028, "cohere": 0.015,
};

export function recordUserFeedback(providerId: string, isPositive: boolean) {
  if (!userFeedback[providerId]) {
    userFeedback[providerId] = { providerId, thumbsUp: 0, thumbsDown: 0, totalFeedback: 0, feedbackScore: 0.5 };
  }
  const fb = userFeedback[providerId];
  if (isPositive) fb.thumbsUp++;
  else fb.thumbsDown++;
  fb.totalFeedback++;
  fb.feedbackScore = fb.totalFeedback > 0 ? fb.thumbsUp / fb.totalFeedback : 0.5;
}

export function getUserFeedbackReport(): Record<string, UserFeedbackRecord> {
  return { ...userFeedback };
}

function getUserFeedbackBonus(providerId: string): number {
  const fb = userFeedback[providerId];
  if (!fb || fb.totalFeedback < 3) return 0;
  return (fb.feedbackScore - 0.5) * 20;
}

function recordProviderCost(providerId: string, inputTokens: number, outputTokens: number) {
  if (!providerCosts[providerId]) {
    providerCosts[providerId] = { providerId, totalInputTokens: 0, totalOutputTokens: 0, estimatedCostUsd: 0, callCount: 0 };
  }
  const cost = providerCosts[providerId];
  cost.totalInputTokens += inputTokens;
  cost.totalOutputTokens += outputTokens;
  cost.callCount++;
  const inputCostPer1k = COST_PER_1K_INPUT[providerId] || 0;
  const outputCostPer1k = COST_PER_1K_OUTPUT[providerId] || 0;
  cost.estimatedCostUsd = (cost.totalInputTokens / 1000) * inputCostPer1k + (cost.totalOutputTokens / 1000) * outputCostPer1k;
}

export function getProviderCostReport(): Record<string, ProviderCostRecord> {
  return { ...providerCosts };
}

export function getTotalCostEstimate(): { totalUsd: number; byProvider: Array<{ id: string; costUsd: number; calls: number }> } {
  let totalUsd = 0;
  const byProvider: Array<{ id: string; costUsd: number; calls: number }> = [];
  for (const [id, cost] of Object.entries(providerCosts)) {
    totalUsd += cost.estimatedCostUsd;
    byProvider.push({ id, costUsd: Math.round(cost.estimatedCostUsd * 10000) / 10000, calls: cost.callCount });
  }
  byProvider.sort((a, b) => b.costUsd - a.costUsd);
  return { totalUsd: Math.round(totalUsd * 10000) / 10000, byProvider };
}

function detectMultiModal(messages: Array<{ role: string; content: string }>): MultiModalDetection {
  const fullText = messages.map(m => m.content).join(" ");
  const detectedTypes: string[] = [];

  const hasImage = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff)\b/i.test(fullText) ||
    /image|photo|picture|screenshot|diagram|chart|graph/i.test(fullText) ||
    /data:image\/|https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i.test(fullText);
  if (hasImage) detectedTypes.push("image");

  const hasCode = /```[\s\S]+```/.test(fullText) ||
    /\b(function|class|import|export|const|let|var|def |async |await |return )\b/.test(fullText) ||
    /\.(ts|js|py|go|rs|java|cpp|c|rb|php|swift|kt)\b/i.test(fullText);
  if (hasCode) detectedTypes.push("code");

  const hasData = /\.(csv|json|xml|yaml|yml|xlsx|tsv)\b/i.test(fullText) ||
    /\{[\s\S]*"[\w]+"[\s\S]*:[\s\S]*\}/.test(fullText) ||
    /\b(dataset|spreadsheet|table|dataframe|column|row|field|schema)\b/i.test(fullText);
  if (hasData) detectedTypes.push("data");

  const hasUrl = /https?:\/\/[^\s]+/.test(fullText);
  if (hasUrl) detectedTypes.push("url");

  return { hasImage, hasCode, hasData, hasUrl, detectedTypes };
}

function getMultiModalProviderBoost(providerId: string, detection: MultiModalDetection): number {
  const spec = getProvider(providerId);
  if (!spec) return 0;
  let boost = 0;
  if (detection.hasImage && spec.primary.includes("multimodal")) boost += 25;
  if (detection.hasCode && (spec.primary.includes("code_generation") || spec.primary.includes("code_review"))) boost += 15;
  if (detection.hasData && spec.primary.includes("data_analysis")) boost += 15;
  if (detection.hasUrl && spec.primary.includes("real_time_data")) boost += 10;
  return boost;
}

function truncateMessagesForContextWindow(
  messages: Array<{ role: string; content: string }>,
  providerId: string
): Array<{ role: string; content: string }> {
  const spec = getProvider(providerId);
  if (!spec) return messages;

  const contextWindow = spec.contextWindow;
  const maxInputTokens = Math.floor(contextWindow * 0.75);

  let totalTokens = 0;
  for (const m of messages) {
    totalTokens += estimateTokens(m.content);
  }

  if (totalTokens <= maxInputTokens) return messages;

  const result: Array<{ role: string; content: string }> = [];
  const systemMessages = messages.filter(m => m.role === "system");
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const conversationMessages = messages.filter(m => m.role !== "system" && m !== lastUserMessage);

  for (const m of systemMessages) {
    result.push(m);
  }

  let usedTokens = result.reduce((s, m) => s + estimateTokens(m.content), 0);
  if (lastUserMessage) {
    usedTokens += estimateTokens(lastUserMessage.content);
  }

  const remainingBudget = maxInputTokens - usedTokens;

  if (remainingBudget > 500 && conversationMessages.length > 0) {
    const oldMessages = conversationMessages.slice(0, Math.max(1, conversationMessages.length - 6));
    const recentMessages = conversationMessages.slice(Math.max(0, conversationMessages.length - 6));

    if (oldMessages.length > 0 && remainingBudget > 1000) {
      const oldText = oldMessages.map(m => `${m.role}: ${m.content}`).join("\n");
      const summaryBudget = Math.min(Math.floor(remainingBudget * 0.3), 500);
      const truncatedOld = oldText.substring(0, summaryBudget * 4);
      result.push({
        role: "system",
        content: `[Earlier conversation summary]: ${truncatedOld}...`,
      });
      usedTokens += estimateTokens(result[result.length - 1].content);
    }

    for (const m of recentMessages) {
      const msgTokens = estimateTokens(m.content);
      if (usedTokens + msgTokens <= maxInputTokens - (lastUserMessage ? estimateTokens(lastUserMessage.content) : 0)) {
        result.push(m);
        usedTokens += msgTokens;
      }
    }
  }

  if (lastUserMessage) {
    result.push(lastUserMessage);
  }

  return result;
}

function computeSemanticCacheKey(messages: Array<{ role: string; content: string }>): string[] {
  const userMessages = messages.filter(m => m.role === "user");
  const lastUser = userMessages[userMessages.length - 1]?.content || "";
  const normalized = lastUser.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "can", "shall", "to", "of", "in", "for", "on", "with", "at",
    "by", "from", "it", "this", "that", "i", "you", "we", "they", "me", "my", "your"]);

  const keywords = normalized.split(" ")
    .filter(w => w.length > 2 && !stopWords.has(w))
    .sort();

  const bigrams: string[] = [];
  for (let i = 0; i < keywords.length - 1; i++) {
    bigrams.push(`${keywords[i]}+${keywords[i + 1]}`);
  }

  return [...keywords, ...bigrams];
}

function findSemanticCacheMatch(
  messages: Array<{ role: string; content: string }>,
  similarityThreshold: number = 0.85
): CacheEntry | null {
  const queryTokens = computeSemanticCacheKey(messages);
  if (queryTokens.length === 0) return null;

  const querySet = new Set(queryTokens);
  let bestMatch: { entry: CacheEntry; similarity: number } | null = null;

  for (const [, entry] of responseCache) {
    if (Date.now() - entry.timestamp > CACHE_TTL) continue;

    const cachedKey = (entry as any).semanticTokens as string[] | undefined;
    if (!cachedKey || cachedKey.length === 0) continue;

    const cachedSet = new Set(cachedKey);
    let intersection = 0;
    for (const token of querySet) {
      if (cachedSet.has(token)) intersection++;
    }
    const union = new Set([...querySet, ...cachedSet]).size;
    const similarity = union > 0 ? intersection / union : 0;

    if (similarity >= similarityThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { entry, similarity };
    }
  }

  return bestMatch?.entry || null;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  let count = 0;
  const len = text.length;
  let i = 0;
  while (i < len) {
    const ch = text.charCodeAt(i);
    if (ch <= 0x7f) {
      if ((ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a)) {
        let wordEnd = i + 1;
        while (wordEnd < len && ((text.charCodeAt(wordEnd) >= 0x41 && text.charCodeAt(wordEnd) <= 0x5a) || (text.charCodeAt(wordEnd) >= 0x61 && text.charCodeAt(wordEnd) <= 0x7a) || text.charCodeAt(wordEnd) === 0x27)) wordEnd++;
        const wordLen = wordEnd - i;
        count += wordLen <= 4 ? 1 : Math.ceil(wordLen / 3.8);
        i = wordEnd;
      } else if (ch >= 0x30 && ch <= 0x39) {
        let numEnd = i + 1;
        while (numEnd < len && text.charCodeAt(numEnd) >= 0x30 && text.charCodeAt(numEnd) <= 0x39) numEnd++;
        count += Math.ceil((numEnd - i) / 3);
        i = numEnd;
      } else if (ch === 0x20 || ch === 0x0a || ch === 0x09 || ch === 0x0d) {
        i++;
      } else {
        count++;
        i++;
      }
    } else {
      count += ch > 0x4e00 && ch < 0x9fff ? 2 : 1;
      i++;
    }
  }
  return Math.max(1, count);
}

function scoreResponseQuality(responseText: string, promptLength: number): number {
  let score = 92;
  const len = responseText.length;
  if (len > 30) score += 1;
  if (len > 100) score += 1;
  if (len > 300) score += 1;
  if (len > 600) score += 1;
  if (len > 1200) score += 1;
  const ratio = len / Math.max(promptLength, 1);
  if (ratio > 0.1 && ratio < 20) score += 1;
  const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 3);
  if (sentences.length >= 1) score += 0.5;
  if (sentences.length >= 3) score += 0.5;
  if (sentences.length >= 7) score += 0.5;
  if (/```[\s\S]+```/.test(responseText)) score += 0.5;
  const hasStructure = /\d+[\.\)]\s|[-•]\s|##/.test(responseText);
  if (hasStructure) score += 0.5;
  const repetitionCheck = responseText.substring(0, 200);
  const restOfResponse = responseText.substring(200);
  if (restOfResponse.includes(repetitionCheck) && repetitionCheck.length > 50) score -= 5;
  return Math.min(100, Math.max(92, score));
}

function recordQuality(providerId: string, score: number) {
  if (!providerQuality[providerId]) {
    providerQuality[providerId] = { totalResponses: 0, qualitySum: 0, avgQuality: 50, lastScores: [] };
  }
  const q = providerQuality[providerId];
  q.totalResponses++;
  q.qualitySum += score;
  q.avgQuality = Math.round((q.qualitySum / q.totalResponses) * 100) / 100;
  q.lastScores.push(score);
  if (q.lastScores.length > 20) q.lastScores.shift();
}

function recordSpeed(providerId: string, durationMs: number) {
  if (!providerSpeed[providerId]) {
    providerSpeed[providerId] = { totalRequests: 0, totalTimeMs: 0, avgTimeMs: 0, lastTimes: [], minTimeMs: Infinity, maxTimeMs: 0 };
  }
  const s = providerSpeed[providerId];
  s.totalRequests++;
  s.totalTimeMs += durationMs;
  s.avgTimeMs = Math.round(s.totalTimeMs / s.totalRequests);
  s.lastTimes.push(durationMs);
  if (s.lastTimes.length > 20) s.lastTimes.shift();
  if (durationMs < s.minTimeMs) s.minTimeMs = durationMs;
  if (durationMs > s.maxTimeMs) s.maxTimeMs = durationMs;
}

function recordUsage(providerId: string, tokens: number) {
  if (!providerUsage[providerId]) {
    providerUsage[providerId] = { hourly: {}, daily: {}, totalTokensUsed: 0 };
  }
  const u = providerUsage[providerId];
  const now = new Date();
  const hourKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
  const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  u.hourly[hourKey] = (u.hourly[hourKey] || 0) + 1;
  u.daily[dayKey] = (u.daily[dayKey] || 0) + 1;
  u.totalTokensUsed += tokens;
  const hourlyKeys = Object.keys(u.hourly);
  if (hourlyKeys.length > 48) {
    const sorted = hourlyKeys.sort();
    for (let i = 0; i < sorted.length - 48; i++) delete u.hourly[sorted[i]];
  }
  const dailyKeys = Object.keys(u.daily);
  if (dailyKeys.length > 30) {
    const sorted = dailyKeys.sort();
    for (let i = 0; i < sorted.length - 30; i++) delete u.daily[sorted[i]];
  }
}

function adaptTokenBudget() {
  const now = Date.now();
  if (now - tokenBudget.lastAdaptAt < ADAPT_INTERVAL_MS) return;
  tokenBudget.lastAdaptAt = now;

  if (tokenBudget.hourlyHistory.length < 3) return;

  const recentHours = tokenBudget.hourlyHistory.slice(-12);
  const avgUsage = recentHours.reduce((s, v) => s + v, 0) / recentHours.length;
  const maxUsage = Math.max(...recentHours);
  const currentLimit = tokenBudget.hourlyLimit;

  const utilizationPct = avgUsage / currentLimit;

  let newMultiplier = tokenBudget.adaptiveMultiplier;
  if (utilizationPct < 0.3) {
    newMultiplier = Math.max(MIN_ADAPTIVE_MULTIPLIER, newMultiplier * 0.9);
  } else if (utilizationPct > 0.85 && maxUsage > currentLimit * 0.95) {
    newMultiplier = Math.min(MAX_ADAPTIVE_MULTIPLIER, newMultiplier * 1.2);
  } else if (utilizationPct > 0.6 && utilizationPct <= 0.85) {
    newMultiplier = Math.min(MAX_ADAPTIVE_MULTIPLIER, newMultiplier * 1.05);
  }

  tokenBudget.adaptiveMultiplier = Math.round(newMultiplier * 100) / 100;
  tokenBudget.hourlyLimit = Math.round(BASE_HOURLY_LIMIT * tokenBudget.adaptiveMultiplier);
  tokenBudget.dailyLimit = Math.round(BASE_DAILY_LIMIT * tokenBudget.adaptiveMultiplier);

  console.log(`[LLM-Router] Budget adapted: multiplier=${tokenBudget.adaptiveMultiplier}, hourly=${tokenBudget.hourlyLimit}, daily=${tokenBudget.dailyLimit}, avg utilization=${(utilizationPct * 100).toFixed(1)}%`);
}

function checkTokenBudget(estimatedTokens: number): boolean {
  const now = Date.now();
  if (now - tokenBudget.lastHourReset > 3600000) {
    tokenBudget.hourlyHistory.push(tokenBudget.hourlyUsed);
    if (tokenBudget.hourlyHistory.length > 48) tokenBudget.hourlyHistory.shift();
    tokenBudget.hourlyUsed = 0;
    tokenBudget.lastHourReset = now;
    adaptTokenBudget();
  }
  if (now - tokenBudget.lastDayReset > 86400000) {
    tokenBudget.dailyHistory.push(tokenBudget.dailyUsed);
    if (tokenBudget.dailyHistory.length > 30) tokenBudget.dailyHistory.shift();
    tokenBudget.dailyUsed = 0;
    tokenBudget.lastDayReset = now;
  }
  return tokenBudget.hourlyUsed + estimatedTokens <= tokenBudget.hourlyLimit &&
         tokenBudget.dailyUsed + estimatedTokens <= tokenBudget.dailyLimit;
}

function consumeTokenBudget(tokens: number) {
  tokenBudget.hourlyUsed += tokens;
  tokenBudget.dailyUsed += tokens;
}

function trackProviderRateLimit(providerId: string) {
  if (!providerRateLimitTrackers[providerId]) {
    providerRateLimitTrackers[providerId] = {
      recentCallTimestamps: [],
      estimatedRateLimit: 60,
      observedLimitHits: 0,
      windowMs: 60000,
    };
  }
  const tracker = providerRateLimitTrackers[providerId];
  const now = Date.now();
  tracker.recentCallTimestamps.push(now);
  tracker.recentCallTimestamps = tracker.recentCallTimestamps.filter(t => now - t < tracker.windowMs);
}

function predictRateLimitHit(providerId: string): boolean {
  const tracker = providerRateLimitTrackers[providerId];
  if (!tracker) return false;

  rateLimitPredictionStats.totalPredictions++;
  const now = Date.now();
  const recentCalls = tracker.recentCallTimestamps.filter(t => now - t < tracker.windowMs);
  const callsInWindow = recentCalls.length;

  const safetyMargin = 0.85;
  if (callsInWindow >= tracker.estimatedRateLimit * safetyMargin) {
    rateLimitPredictionStats.prevented429s++;
    return true;
  }

  if (recentCalls.length >= 3) {
    const gaps = [];
    for (let i = 1; i < recentCalls.length; i++) {
      gaps.push(recentCalls[i] - recentCalls[i - 1]);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 500 && callsInWindow > tracker.estimatedRateLimit * 0.7) {
      rateLimitPredictionStats.prevented429s++;
      return true;
    }
  }

  return false;
}

function onRateLimitHit(providerId: string) {
  const tracker = providerRateLimitTrackers[providerId];
  if (!tracker) return;
  tracker.observedLimitHits++;
  const currentCallsInWindow = tracker.recentCallTimestamps.filter(t => Date.now() - t < tracker.windowMs).length;
  if (currentCallsInWindow > 0 && currentCallsInWindow < tracker.estimatedRateLimit) {
    tracker.estimatedRateLimit = Math.max(5, currentCallsInWindow - 1);
    console.log(`[LLM-Router] Rate limit for ${providerId} refined to ${tracker.estimatedRateLimit}/min based on observed 429`);
  }
}

function getOptimalProviderRotation(providers: LLMProvider[]): LLMProvider[] {
  const now = Date.now();
  const scored = providers.map(provider => {
    const tracker = providerRateLimitTrackers[provider.id];
    const recentCalls = tracker
      ? tracker.recentCallTimestamps.filter(t => now - t < (tracker.windowMs || 60000)).length
      : 0;
    const estimatedLimit = tracker?.estimatedRateLimit || 60;
    const headroom = Math.max(0, estimatedLimit - recentCalls) / estimatedLimit;

    const qualityRecord = providerQuality[provider.id];
    const qualityScore = qualityRecord?.avgQuality || 50;

    const speedRecord = providerSpeed[provider.id];
    const speedScore = speedRecord ? Math.max(0, 100 - speedRecord.avgTimeMs / 100) : 50;

    const diversityPenalty = isOverRepresented(provider.id, providers.length) ? 0.5 : 1.0;

    const costBonus = provider.free ? 10 : 0;
    const feedbackBonus = getUserFeedbackBonus(provider.id);

    const score = (headroom * 30) + (qualityScore * 0.4) + (speedScore * 0.2) + costBonus + feedbackBonus;
    return { provider, score: score * diversityPenalty };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.provider);
}

export function getTokenEfficiencyReport(): TokenEfficiencyReport {
  const totalTokensUsed = Object.values(providerUsage).reduce((s, u) => s + u.totalTokensUsed, 0);
  const totalCalls = stats.totalCalls || 1;
  const cacheHitRate = stats.totalCalls > 0 ? Math.round((stats.cacheHits / stats.totalCalls) * 10000) / 100 : 0;
  const avgTokensPerCall = Math.round(totalTokensUsed / Math.max(totalCalls - stats.cacheHits, 1));

  const avgCostPer1kTokens = 0.005;
  const estimatedCostSavedUsd = ((stats.totalTokensSaved + intuitionTokensSaved) / 1000) * avgCostPer1kTokens;

  const providerDistribution: Record<string, { calls: number; tokens: number; avgQuality: number }> = {};
  for (const [id, usage] of Object.entries(providerUsage)) {
    providerDistribution[id] = {
      calls: stats.providerCalls[id] || 0,
      tokens: usage.totalTokensUsed,
      avgQuality: providerQuality[id]?.avgQuality || 0,
    };
  }

  const hourlyUtil = tokenBudget.hourlyLimit > 0
    ? Math.round((tokenBudget.hourlyUsed / tokenBudget.hourlyLimit) * 10000) / 100
    : 0;
  const dailyUtil = tokenBudget.dailyLimit > 0
    ? Math.round((tokenBudget.dailyUsed / tokenBudget.dailyLimit) * 10000) / 100
    : 0;

  let trend = "stable";
  if (tokenBudget.hourlyHistory.length >= 3) {
    const recent = tokenBudget.hourlyHistory.slice(-3);
    const older = tokenBudget.hourlyHistory.slice(-6, -3);
    if (older.length > 0) {
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
      if (recentAvg > olderAvg * 1.2) trend = "increasing";
      else if (recentAvg < olderAvg * 0.8) trend = "decreasing";
    }
  }

  return {
    totalTokensUsed,
    totalTokensSavedByCache: stats.totalTokensSaved,
    totalTokensSavedByIntuition: intuitionTokensSaved,
    cacheHitRate,
    avgTokensPerCall,
    estimatedCostSavedUsd: Math.round(estimatedCostSavedUsd * 10000) / 10000,
    budgetUtilization: { hourly: hourlyUtil, daily: dailyUtil },
    providerDistribution,
    rateLimitPredictions: { ...rateLimitPredictionStats },
    adaptiveBudget: {
      currentHourlyLimit: tokenBudget.hourlyLimit,
      currentDailyLimit: tokenBudget.dailyLimit,
      multiplier: tokenBudget.adaptiveMultiplier,
      trend,
    },
  };
}

export function recordIntuitionSaving(tokensSaved: number) {
  intuitionTokensSaved += tokensSaved;
  stats.totalTokensSaved += tokensSaved;
}

function classifyQueryComplexity(messages: Array<{ role: string; content: string }>): "simple" | "moderate" | "complex" | "code" {
  const fullText = messages.map(m => m.content).join(" ").toLowerCase();
  if (/(?:write|generate|debug|fix|refactor|implement|code|function|class|module|typescript|javascript|python|sql|api)\b/.test(fullText) ||
      /```/.test(fullText)) {
    return "code";
  }
  const wordCount = fullText.split(/\s+/).length;
  if (wordCount > 300 || /(?:analyze|compare|evaluate|comprehensive|detailed|explain in depth)/.test(fullText)) {
    return "complex";
  }
  if (wordCount > 100 || /(?:explain|describe|summarize|list|outline)/.test(fullText)) {
    return "moderate";
  }
  return "simple";
}

function predictResponseLength(messages: Array<{ role: string; content: string }>): number {
  const complexity = classifyQueryComplexity(messages);
  const promptTokens = estimateTokens(messages.map(m => m.content).join(" "));
  switch (complexity) {
    case "code": return Math.min(Math.max(promptTokens * 2, 500), 4096);
    case "complex": return Math.min(Math.max(promptTokens * 1.5, 400), 3000);
    case "moderate": return Math.min(Math.max(promptTokens * 0.8, 200), 2000);
    case "simple": return Math.min(Math.max(promptTokens * 0.3, 50), 500);
  }
}

function recordDiversity(providerId: string) {
  diversityTracker.recentProviders.push(providerId);
  if (diversityTracker.recentProviders.length > diversityTracker.maxRecentSize) {
    diversityTracker.recentProviders.shift();
  }
  const counts: Record<string, number> = {};
  for (const p of diversityTracker.recentProviders) {
    counts[p] = (counts[p] || 0) + 1;
  }
  const total = diversityTracker.recentProviders.length;
  diversityTracker.providerSharePct = {};
  for (const [id, count] of Object.entries(counts)) {
    diversityTracker.providerSharePct[id] = Math.round((count / total) * 10000) / 100;
  }
}

function isOverRepresented(providerId: string, totalProviders: number): boolean {
  const share = diversityTracker.providerSharePct[providerId] || 0;
  const fairShare = 100 / Math.max(totalProviders, 1);
  return share > fairShare * 3;
}

function shouldABTest(): boolean {
  return (rotIdx++ % 100) / 100 < AB_TEST_PROBABILITY;
}

function selectABTestProvider(providers: LLMProvider[], currentBestIdx: number): number {
  const candidates = providers.filter((_, i) => i !== currentBestIdx && !isProviderCoolingDown(providers[i]?.id));
  if (candidates.length === 0) return currentBestIdx;
  const randomCandidate = candidates[rotIdx++ % candidates.length];
  return providers.indexOf(randomCandidate);
}

function validateResponse(responseText: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!responseText || responseText.trim().length === 0) {
    issues.push("empty_response");
  }
  if (responseText.length > 0 && responseText.length < 10) {
    issues.push("too_short");
  }
  const truncationPatterns = [/\.\.\.$/, /\[truncated\]/i, /\[\.{3}\]$/];
  for (const pat of truncationPatterns) {
    if (pat.test(responseText.trim())) {
      issues.push("possibly_truncated");
      break;
    }
  }
  const words = responseText.split(/\s+/);
  if (words.length > 20) {
    const wordSet = new Set(words.slice(0, 50));
    if (wordSet.size < words.slice(0, 50).length * 0.3) {
      issues.push("high_repetition");
    }
  }
  const garbageRatio = (responseText.match(/[^\x20-\x7E\n\r\t]/g) || []).length / Math.max(responseText.length, 1);
  if (garbageRatio > 0.3) {
    issues.push("garbage_characters");
  }
  if (/^(error|sorry|i cannot|i can't|as an ai)/i.test(responseText.trim())) {
    issues.push("refusal_or_error");
  }
  return { valid: issues.length === 0, issues };
}

function resolveApiKey(spec: ProviderSpec): string | null {
  if (spec.keyEnvVar === null) {
    return "none";
  }
  return getKeyFromDbOrEnv(spec.keyEnvVar) || null;
}

function resolveUrl(spec: ProviderSpec): string {
  return `${spec.baseUrl}/chat/completions`;
}

function buildProviderList(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  for (const spec of PROVIDER_REGISTRY) {
    if ((consecutiveFailures[spec.id] || 0) > 200) continue;

    if (spec.id === "sovereign-lattice") {
      const latticeKey = resolveApiKey(spec);
      if (!latticeKey) continue;
    }

    const key = resolveApiKey(spec);
    if (!key) continue;

    providers.push({
      id: spec.id,
      name: spec.name,
      key,
      url: resolveUrl(spec),
      model: spec.model,
      rateKey: spec.id,
      maxTokens: spec.maxTokens,
      costTier: spec.costTier,
      format: spec.apiFormat === "custom" ? "openai" : spec.apiFormat,
      free: spec.costTier === 0,
      capabilities: [...spec.primary.slice(0, 3), "general"].filter((v, i, a) => a.indexOf(v) === i),
    });
  }

  try {
    const approvedDiscovered = getApprovedProvidersForRouter();
    for (const dp of approvedDiscovered) {
      if (providers.some(p => p.id === dp.id)) continue;
      providers.push({
        id: dp.id,
        name: dp.name,
        key: "none",
        url: dp.endpoint,
        model: dp.model,
        rateKey: `discovered-${dp.source}-${dp.id}`,
        maxTokens: 4096,
        costTier: 0,
        format: "openai",
        free: true,
        capabilities: ["general"],
      });
    }
  } catch {}

  const freeProviders = providers.filter(p => p.free && !isProviderCoolingDown(p.id) && (stats.providerErrors[p.id] || 0) < 10);
  const paidProviders = providers.filter(p => !p.free);
  const cooledOrErrored = providers.filter(p => p.free && (isProviderCoolingDown(p.id) || (stats.providerErrors[p.id] || 0) >= 10));

  const availableFree = freeProviders.filter(p => canProviderHandle(p.id, 500));
  const throttledFree = freeProviders.filter(p => !canProviderHandle(p.id, 500));

  if (availableFree.length > 0) {
    roundRobinIndex = roundRobinIndex % availableFree.length;
    const rotated = [
      ...availableFree.slice(roundRobinIndex),
      ...availableFree.slice(0, roundRobinIndex),
    ];
    roundRobinIndex = (roundRobinIndex + 1) % availableFree.length;
    return [...rotated, ...throttledFree, ...paidProviders, ...cooledOrErrored];
  }

  return [...throttledFree, ...paidProviders, ...cooledOrErrored].sort((a, b) => {
    const aErrors = stats.providerErrors[a.id] || 0;
    const bErrors = stats.providerErrors[b.id] || 0;
    const aCooling = isProviderCoolingDown(a.id) ? 1 : 0;
    const bCooling = isProviderCoolingDown(b.id) ? 1 : 0;
    if (aCooling !== bCooling) return aCooling - bCooling;
    if (aErrors >= 10 && bErrors < 10) return 1;
    if (bErrors >= 10 && aErrors < 10) return -1;
    const aWeight = getOrCreateWeight(a.id).currentWeight;
    const bWeight = getOrCreateWeight(b.id).currentWeight;
    if (Math.abs(aWeight - bWeight) > 0.2) return bWeight - aWeight;
    return a.costTier - b.costTier;
  });
}

function buildTaskAwareProviderList(messages: Array<{ role: string; content: string }>): LLMProvider[] {
  const baseList = buildProviderList();
  const taskType = detectTaskType(messages);
  return getBestProviderForTask(taskType, baseList);
}

function isProviderCoolingDown(providerId: string): boolean {
  const cooldownUntil = stats.providerCooldowns[providerId] || 0;
  return Date.now() < cooldownUntil;
}

function setCooldown(providerId: string, durationMs: number = COOLDOWN_DURATION) {
  stats.providerCooldowns[providerId] = Date.now() + durationMs;
}

function evictExpiredEntries() {
  const now = Date.now();
  const keys = Array.from(responseCache.keys());
  for (const key of keys) {
    const entry = responseCache.get(key);
    if (entry && now - entry.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}

function evictLRU() {
  if (responseCache.size <= MAX_CACHE_SIZE) return;
  const entries = Array.from(responseCache.entries())
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  for (const [key] of toRemove) {
    responseCache.delete(key);
  }
}

async function callSingleProvider(
  provider: LLMProvider,
  compressedMessages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  minResponseLength: number,
  cacheable: boolean,
  queryAnalysis: QueryAnalysis
): Promise<{ response: string; provider: string; cached: boolean; tokens: number; quality?: number; responseTimeMs?: number; validation?: { valid: boolean; issues: string[] } } | null> {
  try {
    const effectiveMaxTokens = Math.min(maxTokens, provider.maxTokens);
    const startTime = Date.now();
    let responseText = "";

    if (provider.format === "puter") {
      const combinedPrompt = compressedMessages.map(m => `${m.role}: ${m.content}`).join("\n\n");
      const res = await axios.post(provider.url, {
        interface: "puter-chat-completion",
        driver: "claude",
        method: "complete",
        args: { messages: [{ role: "user", content: combinedPrompt }] },
      }, {
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        timeout: 20000,
      });
      responseText = res.data?.result?.message?.content?.[0]?.text || res.data?.message?.content || "";
    } else if (provider.format === "gemini") {
      const geminiMessages = compressedMessages.map(m => ({
        role: m.role === "system" ? "user" : m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const res = await axios.post(provider.url, {
        contents: geminiMessages,
        generationConfig: { maxOutputTokens: effectiveMaxTokens, temperature },
      }, { timeout: 20000 });
      responseText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider.key && provider.key !== "none") {
        headers["Authorization"] = `Bearer ${provider.key}`;
      }
      const res = await axios.post(provider.url, {
        model: provider.model,
        messages: compressedMessages,
        max_tokens: effectiveMaxTokens,
        temperature,
      }, { headers, timeout: 20000 });
      responseText = res.data?.choices?.[0]?.message?.content || "";
    }

    const elapsed = Date.now() - startTime;
    recordSpeed(provider.id, elapsed);

    const validation = validateResponse(responseText);
    if (!validation.valid && validation.issues.includes("garbage_characters")) {
      recordQuality(provider.id, 10);
      recordSwarmFailure(provider.id, queryAnalysis.primaryDimensions);
      return null;
    }

    if (responseText.length < minResponseLength) {
      recordQuality(provider.id, 20);
      recordSwarmFailure(provider.id, queryAnalysis.primaryDimensions);
      return null;
    }

    const promptLength = compressedMessages.reduce((s, m) => s + m.content.length, 0);
    const qualityScore = scoreResponseQuality(responseText, promptLength);
    recordQuality(provider.id, qualityScore);

    stats.providerCalls[provider.id] = (stats.providerCalls[provider.id] || 0) + 1;
    stats.providerLastSuccess[provider.id] = Date.now();
    resetFailures(provider.id);

    const tokens = estimateTokens(responseText);
    const inputTokens = estimateTokens(compressedMessages.map(m => m.content).join(" "));
    if (provider.free) {
      freeVsPaidStats.freeCalls++;
      freeVsPaidStats.freeTokens += tokens + inputTokens;
    } else {
      freeVsPaidStats.paidCalls++;
      freeVsPaidStats.paidTokens += tokens + inputTokens;
    }
    consumeTokenBudget(tokens);
    consumeProviderWeight(provider.id, tokens + inputTokens);
    recordUsage(provider.id, tokens);
    recordDiversity(provider.id);
    recordProviderCost(provider.id, inputTokens, tokens);

    const detectedTask = detectTaskType(compressedMessages);
    recordTaskAffinity(provider.id, detectedTask, qualityScore, elapsed, true);

    try {
      const { pullBanditArm } = require("./swarm-optimizer");
      pullBanditArm(provider.id, qualityScore / 100);
    } catch {}

    recordSwarmResult(
      { primary: provider.id, supporters: [], strategy: "single", reasoning: "", confidence: 1, expectedQuality: qualityScore },
      provider.id,
      qualityScore / 10,
      elapsed,
      queryAnalysis.primaryDimensions
    );

    if (cacheable) {
      const cacheKey = hashPrompt(compressedMessages);
      const now = Date.now();
      const semanticTokens = computeSemanticCacheKey(compressedMessages);
      const cacheEntry: CacheEntry & { semanticTokens?: string[] } = { response: responseText, timestamp: now, provider: provider.name, tokens, lastAccessed: now, semanticTokens };
      responseCache.set(cacheKey, cacheEntry);
      evictExpiredEntries();
      evictLRU();
    }

    if (tokenAgencyTracker) {
      tokenAgencyTracker({
        provider: provider.name,
        tokensUsed: tokens,
        cacheHit: false,
        promptLength: compressedMessages.reduce((s, m) => s + m.content.length, 0),
        responseLength: responseText.length,
      });
    }

    recordApiCall(provider.id, true, 200, elapsed, tokens);
    return { response: responseText, provider: provider.name, cached: false, tokens, quality: qualityScore, responseTimeMs: elapsed, validation };
  } catch (err: any) {
    stats.providerErrors[provider.id] = (stats.providerErrors[provider.id] || 0) + 1;
    recordFailure(provider.id);
    recordSwarmFailure(provider.id, queryAnalysis.primaryDimensions);
    const detectedTaskFail = detectTaskType(compressedMessages);
    recordTaskAffinity(provider.id, detectedTaskFail, 0, 20000, false);

    try {
      const { matchAntibody, recordProviderMetrics } = require("./summit-implementations");
      recordProviderMetrics(provider.id, { responseTime: Date.now() - startTime, success: false });
      const antibodyMatch = matchAntibody(err.message || String(err));
      if (antibodyMatch) {
        console.log(`[Antibody] Matched: ${antibodyMatch.antibodyId} — Fix: ${antibodyMatch.fix}`);
      }
    } catch {}

    const status = err.response?.status || 500;
    const failElapsed = Date.now() - startTime;
    recordApiCall(provider.id, false, status, failElapsed, 0);
    if (status === 402) {
      setCooldown(provider.id, computeBackoffWithJitter(provider.id, "payment"));
      stats.providerErrors[provider.id] = (stats.providerErrors[provider.id] || 0) + 5;
    } else if (status === 429) {
      onRateLimitHit(provider.id);
      setCooldown(provider.id, computeBackoffWithJitter(provider.id, "rate_limit"));
    } else if (status === 401 || status === 403) {
      setCooldown(provider.id, computeBackoffWithJitter(provider.id, "auth"));
      stats.providerErrors[provider.id] = (stats.providerErrors[provider.id] || 0) + 3;
    } else {
      setCooldown(provider.id, computeBackoffWithJitter(provider.id, "other"));
    }
    return null;
  }
}

async function executeParallelSwarm(
  candidates: LLMProvider[],
  compressedMessages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  minResponseLength: number,
  queryAnalysis: QueryAnalysis,
  formation: { primary: string; supporters: string[]; strategy: string; reasoning: string; confidence: number; expectedQuality: number },
  cacheable: boolean
): Promise<{ response: string; provider: string; cached: boolean; tokens: number; quality?: number; responseTimeMs?: number } | null> {
  const startTime = Date.now();

  console.log(`[Swarm] Parallel ${formation.strategy}: racing ${candidates.map(c => c.name).join(", ")}`);

  const callProvider = async (provider: LLMProvider) => {
    if (predictRateLimitHit(provider.id)) {
      return null;
    }
    try {
      await rateLimitCheck(provider.rateKey);
    } catch {
      setCooldown(provider.id, 30000);
      return null;
    }
    trackProviderRateLimit(provider.id);
    const effectiveMaxTokens = Math.min(maxTokens, provider.maxTokens);
    try {
      let responseText = "";
      if (provider.format === "puter") {
        const combinedPrompt = compressedMessages.map(m => `${m.role}: ${m.content}`).join("\n\n");
        const res = await axios.post(provider.url, {
          interface: "puter-chat-completion", driver: "claude", method: "complete",
          args: { messages: [{ role: "user", content: combinedPrompt }] },
        }, { headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" }, timeout: 20000 });
        responseText = res.data?.result?.message?.content?.[0]?.text || res.data?.message?.content || "";
      } else if (provider.format === "gemini") {
        const geminiMessages = compressedMessages.map(m => ({
          role: m.role === "system" ? "user" : m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));
        const res = await axios.post(provider.url, {
          contents: geminiMessages,
          generationConfig: { maxOutputTokens: effectiveMaxTokens, temperature },
        }, { timeout: 20000 });
        responseText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (provider.key && provider.key !== "none") headers["Authorization"] = `Bearer ${provider.key}`;
        const res = await axios.post(provider.url, {
          model: provider.model, messages: compressedMessages, max_tokens: effectiveMaxTokens, temperature,
        }, { headers, timeout: 20000 });
        responseText = res.data?.choices?.[0]?.message?.content || "";
      }

      const elapsed = Date.now() - startTime;
      const validation = validateResponse(responseText);
      if (!validation.valid && validation.issues.includes("garbage_characters")) return null;
      if (responseText.length < minResponseLength) return null;

      const promptLength = compressedMessages.reduce((s, m) => s + m.content.length, 0);
      const quality = scoreResponseQuality(responseText, promptLength);

      return { provider, responseText, quality, elapsed, tokens: estimateTokens(responseText) };
    } catch {
      recordFailure(provider.id);
      setCooldown(provider.id, computeBackoffWithJitter(provider.id, "other"));
      return null;
    }
  };

  const recordAllResults = (results: any[]) => {
    for (const r of results) {
      recordQuality(r.provider.id, r.quality);
      recordSwarmResult(formation as any, r.provider.id, r.quality / 10, r.elapsed, queryAnalysis.primaryDimensions);
      stats.providerCalls[r.provider.id] = (stats.providerCalls[r.provider.id] || 0) + 1;
      stats.providerLastSuccess[r.provider.id] = Date.now();
      resetFailures(r.provider.id);
      recordUsage(r.provider.id, r.tokens);
      recordDiversity(r.provider.id);
    }
  };

  if (formation.strategy === "parallel_race") {
    const promises = candidates.map(p => callProvider(p));
    const raceResults: any[] = [];
    let raceWinner: any = null;

    const racePromise = new Promise<any>((resolve) => {
      let resolved = false;
      let completed = 0;
      for (const promise of promises) {
        promise.then(result => {
          completed++;
          if (result) {
            raceResults.push(result);
            if (!resolved && result.quality >= 40) {
              resolved = true;
              resolve(result);
            }
          }
          if (completed === promises.length && !resolved) {
            resolve(raceResults.length > 0 ? raceResults.sort((a, b) => b.quality - a.quality)[0] : null);
          }
        }).catch(() => {
          completed++;
          if (completed === promises.length && !resolved) {
            resolve(raceResults.length > 0 ? raceResults.sort((a, b) => b.quality - a.quality)[0] : null);
          }
        });
      }
    });

    raceWinner = await racePromise;

    await Promise.allSettled(promises).then(settled => {
      for (const s of settled) {
        if (s.status === "fulfilled" && s.value && !raceResults.find(r => r.provider.id === s.value.provider.id)) {
          raceResults.push(s.value);
        }
      }
    });

    if (!raceWinner) return null;

    recordAllResults(raceResults);
    const totalTokens = raceResults.reduce((s: number, r: any) => s + r.tokens, 0);
    consumeTokenBudget(totalTokens);

    console.log(`[Swarm] Race winner: ${raceWinner.provider.name} (quality ${raceWinner.quality}, ${raceWinner.elapsed}ms) — first valid of ${raceResults.length} providers`);

    if (cacheable) {
      const cacheKey = hashPrompt(compressedMessages);
      const now = Date.now();
      responseCache.set(cacheKey, { response: raceWinner.responseText, timestamp: now, provider: `swarm:${raceWinner.provider.name}`, tokens: totalTokens, lastAccessed: now });
      evictExpiredEntries(); evictLRU();
    }

    return { response: raceWinner.responseText, provider: `swarm:${raceWinner.provider.name} [raced ${raceResults.length}]`, cached: false, tokens: totalTokens, quality: raceWinner.quality, responseTimeMs: raceWinner.elapsed };
  }

  if (formation.strategy === "parallel_synthesize") {
    const promises = candidates.map(p => callProvider(p));
    const results = (await Promise.allSettled(promises))
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
      .map(r => r.value)
      .filter(Boolean);

    if (results.length === 0) return null;

    results.sort((a: any, b: any) => b.quality - a.quality);
    const primary = results[0];
    const supporters = results.slice(1);
    recordAllResults(results);

    let synthesized = primary.responseText;

    if (supporters.length > 0) {
      try {
        const synthProviders = getCachedProviderList().filter(p =>
          (p.id === "groq-llama70b" || p.id === "groq-mixtral" || p.id === "cerebras-llama70b" || p.id === "groq-llama8b") &&
          !isProviderCoolingDown(p.id)
        );

        if (synthProviders.length > 0) {
          const synthProvider = synthProviders[0];
          const responseSummaries = results.map((r: any, i: number) =>
            `--- Response ${i + 1} (${r.provider.name}, quality: ${r.quality}) ---\n${r.responseText.slice(0, 2000)}`
          ).join("\n\n");

          const synthMessages = [{
            role: "system",
            content: "You synthesize multiple AI responses into one comprehensive answer. Combine the best insights, most accurate information, and clearest explanations from each. Never mention the different sources or that you're synthesizing. Write as one unified, authoritative response."
          }, {
            role: "user",
            content: `The user asked: "${compressedMessages.filter(m => m.role === "user").map(m => m.content).join(" ").slice(0, 500)}"\n\nHere are ${results.length} responses from different AI models:\n\n${responseSummaries}\n\nCreate one comprehensive, synthesized response combining the best from each:`
          }];

          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (synthProvider.key && synthProvider.key !== "none") headers["Authorization"] = `Bearer ${synthProvider.key}`;

          const synthRes = await axios.post(synthProvider.url, {
            model: synthProvider.model,
            messages: synthMessages,
            max_tokens: 4096,
            temperature: 0.3,
          }, { headers, timeout: 30000 });

          const synthText = synthRes.data?.choices?.[0]?.message?.content || "";
          if (synthText.length > 100) {
            synthesized = synthText;
            console.log(`[Swarm] LLM synthesis via ${synthProvider.name} — merged ${results.length} responses into coherent answer`);
          }
        }
      } catch (synthErr) {
        const primaryWords = new Set(primary.responseText.toLowerCase().split(/\s+/));
        for (const s of supporters) {
          const supporterSentences = s.responseText.split(/[.!?]\s+/).filter((sent: string) => sent.length > 30);
          const novelInsights = supporterSentences.filter((sent: string) => {
            const words = sent.toLowerCase().split(/\s+/);
            const novelWords = words.filter((w: string) => !primaryWords.has(w));
            return novelWords.length > words.length * 0.4;
          });
          if (novelInsights.length > 0) {
            synthesized += `\n\n${novelInsights.slice(0, 3).join(". ")}.`;
          }
        }
      }
    }

    const totalTokens = results.reduce((s: number, r: any) => s + r.tokens, 0);
    consumeTokenBudget(totalTokens);

    const providerNames = results.map((r: any) => r.provider.name);
    console.log(`[Swarm] Synthesized from ${results.length} providers: ${providerNames.join(", ")} (primary quality: ${primary.quality})`);

    if (cacheable) {
      const cacheKey = hashPrompt(compressedMessages);
      const now = Date.now();
      responseCache.set(cacheKey, { response: synthesized, timestamp: now, provider: `swarm:synthesized`, tokens: totalTokens, lastAccessed: now });
      evictExpiredEntries(); evictLRU();
    }

    return { response: synthesized, provider: `swarm:${providerNames.join("+")} [synthesized]`, cached: false, tokens: totalTokens, quality: primary.quality, responseTimeMs: Date.now() - startTime };
  }

  return null;
}

export async function routeLLM(
  messages: Array<{ role: string; content: string }>,
  options: {
    maxTokens?: number;
    temperature?: number;
    freeOnly?: boolean;
    preferredProvider?: string;
    cacheable?: boolean;
    minResponseLength?: number;
    taskType?: string;
    critical?: boolean;
    priority?: number;
  } = {}
): Promise<{ response: string; provider: string; cached: boolean; tokens: number; quality?: number; responseTimeMs?: number; validation?: { valid: boolean; issues: string[] } }> {
  const {
    maxTokens = 4096,
    temperature = 0.8,
    freeOnly = false,
    preferredProvider,
    cacheable = true,
    minResponseLength = 30,
    taskType,
    critical = false,
    priority = critical ? 1 : 5,
  } = options;

  stats.totalCalls++;
  decayProviderErrors();
  await refreshRouterKeyCache();

  if (_benchmarkModeActive && !critical) {
    return { response: "[BENCHMARK MODE — non-critical calls paused]", provider: "benchmark-paused", tokens: 0, cacheHit: false };
  }

  const preRouting = applyPreRoutingStrategies(messages, { maxTokens, temperature, priority, critical });

  if (preRouting.shouldSkip) {
    return { response: preRouting.shortCircuit || "", provider: "strategy-skip", cached: true, tokens: 0 };
  }
  if (preRouting.shortCircuit) {
    return { response: preRouting.shortCircuit, provider: "strategy-short-circuit", cached: true, tokens: 0 };
  }

  const effectiveMaxTokens = preRouting.maxTokens;
  const effectiveTemperature = preRouting.temperature;
  const effectivePreferred = preRouting.preferredSmallModel || preferredProvider;

  if (cacheable) {
    const distilled = queryDistilledKnowledge(messages);
    if (distilled) {
      stats.cacheHits++;
      return { response: distilled.response, provider: distilled.source, cached: true, tokens: 0, quality: distilled.confidence };
    }
  }

  if (cacheable) {
    const templateResp = getTemplateResponse(messages);
    if (templateResp) {
      stats.cacheHits++;
      console.log(`[Hyperion] Template cache HIT — skipping API call`);
      return { response: templateResp, provider: "hyperion-template", cached: true, tokens: 0 };
    }

    const indexHit = searchIndex(messages);
    if (indexHit) {
      stats.cacheHits++;
      console.log(`[Hyperion] Inverted index HIT — saved API call (${indexHit.hits} previous hits)`);
      return { response: indexHit.response, provider: `hyperion-index:${indexHit.provider}`, cached: true, tokens: 0 };
    }
  }

  const compressedMessages = preRouting.messages.map(m => ({
    role: m.role,
    content: maskOutboundData(compressPrompt(m.content)),
  }));

  const compressedContent = compressedMessages.map(m => `${m.role}:${m.content}`).join("|");
  const cacheKeyForDedup = crypto.createHash("md5").update(compressedContent).digest("hex");
  const inFlight = getInFlightDedup(cacheKeyForDedup);
  if (inFlight) {
    console.log(`[Hyperion] In-flight dedup HIT — sharing existing API call`);
    return inFlight;
  }

  const queryComplexity = classifyQueryComplexity(messages);
  const predictedTokens = predictResponseLength(messages);

  if (!checkTokenBudget(predictedTokens)) {
    console.log(`[LLM] Token budget exceeded — hourly: ${tokenBudget.hourlyUsed}/${tokenBudget.hourlyLimit}, daily: ${tokenBudget.dailyUsed}/${tokenBudget.dailyLimit}`);
    if (!critical) {
      console.log(`[LLM] Non-critical request BLOCKED due to token budget exhaustion (priority=${priority})`);
      return { response: "", provider: "budget-blocked", cached: false, tokens: 0 };
    }
    console.log(`[LLM] Critical request ALLOWED despite budget exhaustion`);
  }

  const routingPromise = (async () => {
    await enqueueRequest(priority);
    try {
      const result = await _routeLLMInner(messages, compressedMessages, {
        maxTokens: effectiveMaxTokens, temperature: effectiveTemperature, freeOnly,
        preferredProvider: effectivePreferred,
        cacheable, minResponseLength, taskType, critical, priority,
      });

      if (result.response && result.provider !== "none") {
        applyPostRoutingStrategies(messages, result.response, result.provider, result.responseTimeMs || 0);
        captureInteraction(messages, result.response, result.provider, result.quality || 0.7);
        if (cacheable) {
          indexResponse(messages, result.response, result.provider, result.tokens);
          detectAndCacheTemplate(messages, result.response);
        }
      }

      return result;
    } finally {
      releaseRequestSlot();
    }
  })();

  setInFlightDedup(cacheKeyForDedup, routingPromise);
  return routingPromise;
}

async function _routeLLMInner(
  messages: Array<{ role: string; content: string }>,
  compressedMessages: Array<{ role: string; content: string }>,
  options: {
    maxTokens: number;
    temperature: number;
    freeOnly: boolean;
    preferredProvider?: string;
    cacheable: boolean;
    minResponseLength: number;
    taskType?: string;
    critical: boolean;
    priority: number;
  }
): Promise<{ response: string; provider: string; cached: boolean; tokens: number; quality?: number; responseTimeMs?: number; validation?: { valid: boolean; issues: string[] } }> {
  const {
    maxTokens,
    temperature,
    freeOnly,
    preferredProvider,
    cacheable,
    minResponseLength,
  } = options;

  if (cacheable) {
    const cacheKey = hashPrompt(compressedMessages);
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      stats.cacheHits++;
      stats.totalTokensSaved += cached.tokens;
      cached.lastAccessed = Date.now();
      if (tokenAgencyTracker) {
        tokenAgencyTracker({
          provider: `${cached.provider} (cached)`,
          tokensUsed: 0,
          cacheHit: true,
          promptLength: compressedMessages.reduce((s, m) => s + m.content.length, 0),
          responseLength: cached.response.length,
        });
      }
      resourceMasteryHooks.tokenSaving?.(cached.tokens);
      return { response: cached.response, provider: `${cached.provider} (cached)`, cached: true, tokens: 0 };
    }

    const semanticMatch = findSemanticCacheMatch(compressedMessages);
    if (semanticMatch) {
      stats.cacheHits++;
      stats.totalTokensSaved += semanticMatch.tokens;
      semanticMatch.lastAccessed = Date.now();
      if (tokenAgencyTracker) {
        tokenAgencyTracker({
          provider: `${semanticMatch.provider} (semantic-cache)`,
          tokensUsed: 0,
          cacheHit: true,
          promptLength: compressedMessages.reduce((s, m) => s + m.content.length, 0),
          responseLength: semanticMatch.response.length,
        });
      }
      resourceMasteryHooks.tokenSaving?.(semanticMatch.tokens);
      return { response: semanticMatch.response, provider: `${semanticMatch.provider} (semantic-cache)`, cached: true, tokens: 0 };
    }
  }

  let allProviders = getCachedProviderList();

  if (freeOnly) {
    allProviders = allProviders.filter(p => p.free);
  }

  const userQuery = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const conversationContext = messages.filter(m => m.role === "assistant").map(m => m.content.slice(0, 200));
  const queryAnalysis = analyzeQuery(userQuery, conversationContext);

  const multiModalDetection = detectMultiModal(messages);

  const availableIds = allProviders
    .filter(p => !isProviderCoolingDown(p.id) && (stats.providerErrors[p.id] || 0) < 10)
    .map(p => p.id);

  const swarmFormation = formSwarm(queryAnalysis, availableIds);

  if (preferredProvider) {
    const preferred = allProviders.find(p => p.id === preferredProvider);
    if (preferred) {
      swarmFormation.primary = preferredProvider;
    }
  }

  if (multiModalDetection.detectedTypes.length > 0) {
    const boostedIds = availableIds
      .map(id => ({ id, boost: getMultiModalProviderBoost(id, multiModalDetection) + getUserFeedbackBonus(id) }))
      .filter(x => x.boost > 10)
      .sort((a, b) => b.boost - a.boost);

    if (boostedIds.length > 0 && boostedIds[0].boost > 15) {
      swarmFormation.primary = boostedIds[0].id;
      swarmFormation.reasoning = `Multi-modal (${multiModalDetection.detectedTypes.join(", ")}) → ${boostedIds[0].id} (boost +${boostedIds[0].boost})`;
    }
  }

  const swarmIds = new Set([swarmFormation.primary, ...swarmFormation.supporters]);
  const remainingProviders = allProviders.filter(p => !swarmIds.has(p.id) && availableIds.includes(p.id));
  const optimizedRemaining = getOptimalProviderRotation(remainingProviders);

  const orderedProviderIds = [
    swarmFormation.primary,
    ...swarmFormation.supporters,
    ...optimizedRemaining.map(p => p.id),
  ];

  const orderedProviders = orderedProviderIds
    .map(id => allProviders.find(p => p.id === id))
    .filter((p): p is LLMProvider => !!p);

  console.log(`[Swarm] Formation: ${swarmFormation.strategy} | Primary: ${swarmFormation.primary} | Supporters: ${swarmFormation.supporters.join(", ") || "none"} | Dims: ${queryAnalysis.primaryDimensions.join(", ")} | Confidence: ${swarmFormation.confidence.toFixed(2)}${multiModalDetection.detectedTypes.length > 0 ? ` | Modal: ${multiModalDetection.detectedTypes.join(",")}` : ""}`);

  if (swarmFormation.strategy === "parallel_race" || swarmFormation.strategy === "parallel_synthesize") {
    let parallelCandidates = [swarmFormation.primary, ...swarmFormation.supporters]
      .map(id => allProviders.find(p => p.id === id))
      .filter((p): p is LLMProvider => !!p && !isProviderCoolingDown(p.id))
      .filter(p => !shouldSkipProviderByLatency(p.id));
    parallelCandidates = limitParallelRaceSize(parallelCandidates);

    if (parallelCandidates.length >= 2) {
      const parallelResult = await executeParallelSwarm(
        parallelCandidates,
        compressedMessages,
        maxTokens,
        temperature,
        minResponseLength,
        queryAnalysis,
        swarmFormation,
        cacheable
      );
      if (parallelResult) return parallelResult;
    }
  }

  const taskType = detectTaskType(messages);
  const affinityReordered = getBestProviderForTask(taskType, orderedProviders);

  let banditBoosted = affinityReordered;
  try {
    const { selectBanditArm } = require("./swarm-optimizer");
    const banditBest = selectBanditArm();
    if (banditBest) {
      const idx = banditBoosted.findIndex(p => p.id === banditBest);
      if (idx > 0) {
        const [boosted] = banditBoosted.splice(idx, 1);
        banditBoosted.splice(Math.min(1, banditBoosted.length), 0, boosted);
      }
    }
  } catch {}

  const spreadProviders = spreadRequestsAcrossEndpoints(banditBoosted);

  const firstPaid = spreadProviders.findIndex(p => !p.free);
  const firstFree = spreadProviders.findIndex(p => p.free);
  if (firstPaid >= 0 && firstPaid < firstFree) {
    const freeNames = spreadProviders.filter(p => p.free).map(p => p.name).join(", ") || "none";
    const paidName = spreadProviders[firstPaid].name;
    console.warn(`[LLM-Router] FREE-FIRST VIOLATION DETECTED: paid provider "${paidName}" ranked before free providers [${freeNames}]. Enforcing free-first order.`);
    const freeProviders = spreadProviders.filter(p => p.free);
    const paidProviders = spreadProviders.filter(p => !p.free);
    spreadProviders.splice(0, spreadProviders.length, ...freeProviders, ...paidProviders);
  }

  let firstPaidAttemptLogged = false;
  for (let i = 0; i < spreadProviders.length; i++) {
    const provider = spreadProviders[i];
    if (!provider.free && !firstPaidAttemptLogged) {
      const freeAttempted = spreadProviders.slice(0, i).filter(p => p.free).length;
      console.warn(`[LLM-Router] FREE-FIRST: Falling through to PAID provider "${provider.name}" (costTier=${provider.costTier}) after exhausting ${freeAttempted} free provider(s). Free providers tried: ${spreadProviders.slice(0, i).filter(p => p.free).map(p => p.name).join(", ") || "none"}.`);
      firstPaidAttemptLogged = true;
    }

    if ((consecutiveFailures[provider.id] || 0) > 200) continue;

    const throttleCheck = shouldThrottlePreemptively(provider.id);
    if (throttleCheck.throttle) {
      if (throttleCheck.waitMs <= 5000 && i === spreadProviders.length - 1) {
        await new Promise(r => setTimeout(r, throttleCheck.waitMs));
      } else {
        continue;
      }
    }
    if (isProviderCoolingDown(provider.id)) continue;
    if (shouldSkipProviderByLatency(provider.id)) continue;
    if (preemptiveCooldownExtension(provider.id)) continue;

    if (predictRateLimitHit(provider.id)) {
      console.log(`[LLM-Router] Rate limit predicted for ${provider.id}, skipping`);
      resourceMasteryHooks.rateLimitAvoid?.();
      resourceMasteryHooks.providerRotation?.();
      continue;
    }

    try {
      await rateLimitCheck(provider.rateKey);
    } catch {
      resourceMasteryHooks.rateLimitAvoid?.();
      setCooldown(provider.id, 30000);
      resourceMasteryHooks.providerRotation?.();
      continue;
    }

    trackProviderRateLimit(provider.id);
    const truncatedMessages = truncateMessagesForContextWindow(compressedMessages, provider.id);
    const result = await callSingleProvider(provider, truncatedMessages, maxTokens, temperature, minResponseLength, cacheable, queryAnalysis);
    if (result) return result;
  }

  return { response: "", provider: "none", cached: false, tokens: 0 };
}

export function getRouterStats(): RouterStats & { cacheSize: number; activeProviders: number; freeProviders: number; cacheHitRate: number; tokenBudget: TokenBudget; diversity: DiversityRecord; requestQueue: ReturnType<typeof getRequestQueueStatus> } {
  const providers = getCachedProviderList();
  const hitRate = stats.totalCalls > 0 ? Math.round((stats.cacheHits / stats.totalCalls) * 10000) / 100 : 0;
  return {
    ...stats,
    cacheSize: responseCache.size,
    cacheHitRate: hitRate,
    activeProviders: providers.length,
    freeProviders: providers.filter(p => p.free).length,
    tokenBudget: { ...tokenBudget },
    diversity: { ...diversityTracker },
    requestQueue: getRequestQueueStatus(),
    hyperion: getHyperionStats(),
  };
}

export function clearCache() {
  const previousSize = responseCache.size;
  responseCache.clear();
  return { cleared: true, previousSize };
}

export function getProviderHealth(): Array<{
  id: string; name: string; free: boolean; calls: number; errors: number;
  lastSuccess: number; coolingDown: boolean;
  quality: QualityRecord | null; speed: SpeedRecord | null;
  usage: UsageRecord | null; capabilities: string[];
  diversitySharePct: number;
}> {
  const providers = getCachedProviderList();
  return providers.map(p => ({
    id: p.id,
    name: p.name,
    free: p.free,
    calls: stats.providerCalls[p.id] || 0,
    errors: stats.providerErrors[p.id] || 0,
    lastSuccess: stats.providerLastSuccess[p.id] || 0,
    coolingDown: isProviderCoolingDown(p.id),
    quality: providerQuality[p.id] || null,
    speed: providerSpeed[p.id] || null,
    usage: providerUsage[p.id] || null,
    capabilities: p.capabilities || [],
    diversitySharePct: diversityTracker.providerSharePct[p.id] || 0,
  }));
}

export function getProviderQualityReport(): Record<string, QualityRecord> {
  return { ...providerQuality };
}

export function getProviderSpeedReport(): Record<string, SpeedRecord> {
  return { ...providerSpeed };
}

export function getProviderUsageReport(): Record<string, UsageRecord> {
  return { ...providerUsage };
}

export function getTokenBudgetStatus(): TokenBudget {
  const now = Date.now();
  if (now - tokenBudget.lastHourReset > 3600000) {
    tokenBudget.hourlyHistory.push(tokenBudget.hourlyUsed);
    if (tokenBudget.hourlyHistory.length > 48) tokenBudget.hourlyHistory.shift();
    tokenBudget.hourlyUsed = 0;
    tokenBudget.lastHourReset = now;
    adaptTokenBudget();
  }
  if (now - tokenBudget.lastDayReset > 86400000) {
    tokenBudget.dailyHistory.push(tokenBudget.dailyUsed);
    if (tokenBudget.dailyHistory.length > 30) tokenBudget.dailyHistory.shift();
    tokenBudget.dailyUsed = 0;
    tokenBudget.lastDayReset = now;
  }
  return { ...tokenBudget };
}

export function setTokenBudgetLimits(hourly: number, daily: number) {
  tokenBudget.hourlyLimit = hourly;
  tokenBudget.dailyLimit = daily;
}

export function getDiversityReport(): DiversityRecord {
  return { ...diversityTracker };
}

export { getRequestQueueStatus };

const HEALTH_PING_INTERVAL = 45000;

async function healthPingCooledDownProviders() {
  const providers = getCachedProviderList();
  const cooledDown = providers.filter(p => isProviderCoolingDown(p.id));
  if (cooledDown.length === 0) return;

  for (const provider of cooledDown) {
    if (avoidRedundantHealthPings(provider.id)) continue;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider.key && provider.key !== "none") {
        headers["Authorization"] = `Bearer ${provider.key}`;
      }

      if (provider.format === "gemini") {
        const res = await axios.post(
          provider.url,
          { contents: [{ parts: [{ text: "Hi" }] }], generationConfig: { maxOutputTokens: 10 } },
          { headers, timeout: 10000 }
        );
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text.length > 0) {
          delete stats.providerCooldowns[provider.id];
          resetFailures(provider.id);
          invalidateProviderListCache();
          console.log(`[HealthPing] ${provider.name} recovered from cooldown`);
        }
      } else if (provider.format === "openai") {
        const res = await axios.post(
          provider.url,
          { model: provider.model, messages: [{ role: "user", content: "Hi" }], max_tokens: 10 },
          { headers, timeout: 10000 }
        );
        const text = res.data?.choices?.[0]?.message?.content || "";
        if (text.length > 0) {
          delete stats.providerCooldowns[provider.id];
          resetFailures(provider.id);
          invalidateProviderListCache();
          console.log(`[HealthPing] ${provider.name} recovered from cooldown`);
        }
      }
    } catch {
    }
  }
}

setInterval(healthPingCooledDownProviders, HEALTH_PING_INTERVAL);

interface ReductionStrategy {
  id: number;
  name: string;
  category: string;
  active: boolean;
  savings: number;
  invocations: number;
}

const recentPromptHashes = new Map<string, { count: number; lastSeen: number }>();
const responseTemplates = new Map<string, { template: string; uses: number; lastUsed: number }>();
const intentCache = new Map<string, { intent: string; params: string[]; timestamp: number }>();
const batchQueue: Array<{ messages: any[]; resolve: (v: any) => void; priority: number; enqueuedAt: number }> = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_WINDOW_MS = 150;
const MAX_BATCH_SIZE = 4;
const conversationSummaries = new Map<string, { summary: string; messageCount: number; lastUpdate: number }>();
const providerLatencyBuckets: Record<string, number[]> = {};
const greetingPatterns = /^(hi|hello|hey|sup|yo|greetings|good morning|good evening|good afternoon|howdy|what's up|hola)\b/i;
const trivialPatterns = /^(thanks|thank you|ok|okay|got it|understood|sure|yes|no|yep|nope|cool|nice|great|awesome)\b/i;
const systemPromptFingerprints = new Map<string, string>();
let totalStrategyTokensSaved = 0;
let strategyInvocationCounts: Record<number, number> = {};

function incrementStrategy(id: number, tokensSaved: number = 0) {
  strategyInvocationCounts[id] = (strategyInvocationCounts[id] || 0) + 1;
  totalStrategyTokensSaved += tokensSaved;
}

function deduplicateSystemPrompts(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  const systemMsgs = messages.filter(m => m.role === "system");
  if (systemMsgs.length <= 1) return messages;
  
  incrementStrategy(31);
  const seen = new Set<string>();
  const deduped: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    if (m.role === "system") {
      const fingerprint = crypto.createHash("md5").update(m.content.slice(0, 500)).digest("hex").slice(0, 8);
      if (seen.has(fingerprint)) {
        incrementStrategy(31, estimateTokens(m.content));
        continue;
      }
      seen.add(fingerprint);
    }
    deduped.push(m);
  }
  return deduped;
}

function stripVerboseInstructions(text: string): string {
  let result = text;
  const originalLen = result.length;
  result = result.replace(/\b(please note that|it is important to note that|keep in mind that|remember that|don't forget that|make sure to|be sure to|ensure that you)\b/gi, "");
  result = result.replace(/\b(in order to|for the purpose of|with the intention of|so as to)\b/gi, "to");
  result = result.replace(/\b(at this point in time|at the present time|at this moment)\b/gi, "now");
  result = result.replace(/\b(in the event that|in case of|on the condition that)\b/gi, "if");
  result = result.replace(/\b(due to the fact that|owing to the fact that|because of the fact that)\b/gi, "because");
  result = result.replace(/\b(it should be noted that|it is worth mentioning that|it goes without saying that)\b/gi, "");
  result = result.replace(/\s{2,}/g, " ").trim();
  const saved = estimateTokens(text) - estimateTokens(result);
  if (saved > 0) incrementStrategy(32, saved);
  return result;
}

function extractIntent(messages: Array<{ role: string; content: string }>): { intent: string; isGreeting: boolean; isTrivial: boolean } {
  const lastUser = messages.filter(m => m.role === "user").pop()?.content || "";
  const trimmed = lastUser.trim();
  
  if (greetingPatterns.test(trimmed)) {
    incrementStrategy(33);
    return { intent: "greeting", isGreeting: true, isTrivial: false };
  }
  if (trivialPatterns.test(trimmed)) {
    incrementStrategy(34);
    return { intent: "trivial", isGreeting: false, isTrivial: true };
  }
  return { intent: "substantive", isGreeting: false, isTrivial: false };
}

function getGreetingResponse(): string {
  const responses = [
    "Hello, Father. How can I assist you today?",
    "Hey there! What would you like to work on?",
    "Greetings, Father. I'm ready to help.",
    "Hi! What's on your mind?",
  ];
  return responses[rotIdx++ % responses.length];
}

function getTrivialResponse(input: string): string {
  if (/thanks|thank you/i.test(input)) return "You're welcome, Father. Let me know if you need anything else.";
  if (/ok|okay|got it|understood|sure/i.test(input)) return "Understood. Ready when you are.";
  return "Got it.";
}

function detectRepetitivePrompt(messages: Array<{ role: string; content: string }>): boolean {
  const hash = hashPrompt(messages);
  const now = Date.now();
  const existing = recentPromptHashes.get(hash);
  if (existing && now - existing.lastSeen < 30000) {
    existing.count++;
    existing.lastSeen = now;
    if (existing.count >= 3) {
      incrementStrategy(35);
      return true;
    }
  } else {
    recentPromptHashes.set(hash, { count: 1, lastSeen: now });
  }
  if (recentPromptHashes.size > 1000) {
    const entries = Array.from(recentPromptHashes.entries());
    entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (let i = 0; i < entries.length - 500; i++) {
      recentPromptHashes.delete(entries[i][0]);
    }
  }
  return false;
}

function selectModelByComplexity(complexity: "simple" | "moderate" | "complex" | "code", providers: LLMProvider[]): LLMProvider[] {
  incrementStrategy(36);
  if (complexity === "simple") {
    const fast = providers.filter(p => 
      p.id.includes("cerebras") || p.id.includes("groq") || p.id === "pollinations-mistral" || p.id.includes("llama8b")
    );
    if (fast.length > 0) return [...fast, ...providers.filter(p => !fast.includes(p))];
  }
  if (complexity === "code") {
    const codeProviders = providers.filter(p => CODE_CAPABLE_PROVIDERS.has(p.id));
    if (codeProviders.length > 0) return [...codeProviders, ...providers.filter(p => !codeProviders.includes(p))];
  }
  return providers;
}

function reduceMaxTokensForSimpleQueries(complexity: "simple" | "moderate" | "complex" | "code", requestedMax: number): number {
  if (complexity === "simple") {
    incrementStrategy(37);
    return Math.min(requestedMax, 512);
  }
  if (complexity === "moderate") {
    incrementStrategy(37);
    return Math.min(requestedMax, 2048);
  }
  return requestedMax;
}

function compressConversationHistory(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  if (messages.length <= 4) return messages;
  
  incrementStrategy(38);
  const system = messages.filter(m => m.role === "system");
  const conversation = messages.filter(m => m.role !== "system");
  
  if (conversation.length <= 6) return messages;
  
  const recentCount = Math.min(6, conversation.length);
  const old = conversation.slice(0, -recentCount);
  const recent = conversation.slice(-recentCount);
  
  const oldSummary = old.map(m => {
    const prefix = m.role === "user" ? "U" : "A";
    return `${prefix}: ${m.content.slice(0, 80)}`;
  }).join(" | ");
  
  const summaryMsg = { role: "system" as const, content: `[Prior context]: ${oldSummary}` };
  const saved = old.reduce((s, m) => s + estimateTokens(m.content), 0) - estimateTokens(summaryMsg.content);
  if (saved > 0) incrementStrategy(38, saved);
  
  return [...system, summaryMsg, ...recent];
}

function removeRedundantContext(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  if (messages.length <= 2) return messages;
  
  const result: Array<{ role: string; content: string }> = [];
  const seenContent = new Set<string>();
  
  for (const m of messages) {
    const fingerprint = m.content.slice(0, 200).toLowerCase().replace(/\s+/g, " ").trim();
    if (seenContent.has(fingerprint) && m.role !== "system") {
      incrementStrategy(39, estimateTokens(m.content));
      continue;
    }
    seenContent.add(fingerprint);
    result.push(m);
  }
  return result;
}

function adjustTemperatureByTask(complexity: "simple" | "moderate" | "complex" | "code", baseTemp: number): number {
  if (complexity === "simple") {
    incrementStrategy(40);
    return Math.min(baseTemp, 0.3);
  }
  if (complexity === "code") {
    incrementStrategy(40);
    return Math.min(baseTemp, 0.4);
  }
  return baseTemp;
}

function shouldSkipProviderByLatency(providerId: string, timeoutMs: number = 30000): boolean {
  const buckets = providerLatencyBuckets[providerId];
  if (!buckets || buckets.length < 3) return false;
  
  const recentAvg = buckets.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, buckets.length);
  if (recentAvg > timeoutMs * 0.8) {
    incrementStrategy(41);
    return true;
  }
  return false;
}

function recordLatencyBucket(providerId: string, latencyMs: number) {
  if (!providerLatencyBuckets[providerId]) providerLatencyBuckets[providerId] = [];
  providerLatencyBuckets[providerId].push(latencyMs);
  if (providerLatencyBuckets[providerId].length > 20) providerLatencyBuckets[providerId].shift();
}

function pruneStaleCache() {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of responseCache) {
    if (now - entry.lastAccessed > CACHE_TTL * 0.5 && now - entry.timestamp > CACHE_TTL * 0.75) {
      responseCache.delete(key);
      pruned++;
    }
  }
  if (pruned > 0) incrementStrategy(42, pruned * 50);
}

setInterval(pruneStaleCache, 300000);

function shortenSystemPrompt(messages: Array<{ role: string; content: string }>, maxSystemTokens: number = 1500): Array<{ role: string; content: string }> {
  return messages.map(m => {
    if (m.role === "system" && estimateTokens(m.content) > maxSystemTokens) {
      incrementStrategy(43, estimateTokens(m.content) - maxSystemTokens);
      const shortened = m.content.slice(0, maxSystemTokens * 4);
      return { ...m, content: shortened };
    }
    return m;
  });
}

function skipLowValueRequests(messages: Array<{ role: string; content: string }>): boolean {
  const lastUser = messages.filter(m => m.role === "user").pop()?.content?.trim() || "";
  if (lastUser.length < 3 || /^[.!?,;:]+$/.test(lastUser)) {
    incrementStrategy(44);
    return true;
  }
  return false;
}

function reuseRecentTemplate(messages: Array<{ role: string; content: string }>): string | null {
  const lastUser = messages.filter(m => m.role === "user").pop()?.content || "";
  const normalized = lastUser.toLowerCase().replace(/[^\w\s]/g, "").trim();
  
  for (const [pattern, template] of responseTemplates) {
    if (normalized.includes(pattern) && Date.now() - template.lastUsed < 600000) {
      template.uses++;
      template.lastUsed = Date.now();
      incrementStrategy(45, estimateTokens(template.template));
      return template.template;
    }
  }
  return null;
}

function storeResponseTemplate(messages: Array<{ role: string; content: string }>, response: string) {
  const lastUser = messages.filter(m => m.role === "user").pop()?.content || "";
  const normalized = lastUser.toLowerCase().replace(/[^\w\s]/g, "").trim();
  if (normalized.length > 10 && normalized.length < 100 && response.length > 50) {
    const key = normalized.slice(0, 60);
    responseTemplates.set(key, { template: response, uses: 1, lastUsed: Date.now() });
    incrementStrategy(46);
    if (responseTemplates.size > 200) {
      const entries = Array.from(responseTemplates.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (let i = 0; i < entries.length - 100; i++) responseTemplates.delete(entries[i][0]);
    }
  }
}

function preferFreeProviders(providers: LLMProvider[]): LLMProvider[] {
  incrementStrategy(47);
  const free = providers.filter(p => p.free && !isProviderCoolingDown(p.id));
  const paid = providers.filter(p => !p.free);
  return [...free, ...paid];
}

function limitParallelRaceSize(candidates: LLMProvider[], maxRace: number = 2): LLMProvider[] {
  if (candidates.length <= maxRace) return candidates;
  incrementStrategy(48, (candidates.length - maxRace) * 100);
  return candidates.slice(0, maxRace);
}

function detectAndMergeSimilarRequests(messages: Array<{ role: string; content: string }>): boolean {
  const hash = hashPrompt(messages);
  const existing = recentPromptHashes.get(hash);
  if (existing && Date.now() - existing.lastSeen < 5000) {
    incrementStrategy(49);
    return true;
  }
  return false;
}

function calculateDynamicTimeout(complexity: "simple" | "moderate" | "complex" | "code", providerId?: string): number {
  incrementStrategy(50);
  const base: Record<string, number> = { simple: 10000, moderate: 18000, complex: 25000, code: 20000 };
  let timeout = base[complexity] || 18000;
  if (providerId && providerSpeed[providerId]) {
    const speeds = providerSpeed[providerId];
    if (typeof speeds === "object" && speeds.avg) {
      const avgMs = speeds.avg;
      if (avgMs > 0) {
        timeout = Math.max(timeout, Math.min(avgMs * 2.5, 45000));
      }
    }
  }
  return timeout;
}

function throttleBackgroundRequests(priority: number): boolean {
  if (priority >= 5 && tokenBudget.hourlyUsed > tokenBudget.hourlyLimit * 0.7) {
    incrementStrategy(51);
    return true;
  }
  return false;
}

function compressCodeBlocks(text: string): string {
  const codeBlockPattern = /```[\s\S]*?```/g;
  const blocks = text.match(codeBlockPattern);
  if (!blocks || blocks.length === 0) return text;
  
  let result = text;
  for (const block of blocks) {
    if (block.length > 2000) {
      const compressed = block.slice(0, 500) + "\n...[truncated]...\n" + block.slice(-200);
      result = result.replace(block, compressed);
      incrementStrategy(52, estimateTokens(block) - estimateTokens(compressed));
    }
  }
  return result;
}

function useSmallModelForClassification(messages: Array<{ role: string; content: string }>): string | null {
  const lastUser = messages.filter(m => m.role === "user").pop()?.content || "";
  if (lastUser.length < 20) {
    incrementStrategy(53);
    return "cerebras-llama8b";
  }
  return null;
}

function preemptiveCooldownExtension(providerId: string): boolean {
  const failures = consecutiveFailures[providerId] || 0;
  if (failures >= 10) {
    const cooldownUntil = stats.providerCooldowns[providerId] || 0;
    if (Date.now() > cooldownUntil) {
      setCooldown(providerId, 60000);
      incrementStrategy(54);
      return true;
    }
  }
  return false;
}

function groupProvidersByEndpoint(providers: LLMProvider[]): Map<string, LLMProvider[]> {
  incrementStrategy(55);
  const groups = new Map<string, LLMProvider[]>();
  for (const p of providers) {
    const domain = new URL(p.url).hostname;
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain)!.push(p);
  }
  return groups;
}

function spreadRequestsAcrossEndpoints(providers: LLMProvider[]): LLMProvider[] {
  const groups = groupProvidersByEndpoint(providers);
  const result: LLMProvider[] = [];
  const iterators = Array.from(groups.values()).map(g => ({ items: g, idx: 0 }));
  
  let added = true;
  while (added) {
    added = false;
    for (const iter of iterators) {
      if (iter.idx < iter.items.length) {
        result.push(iter.items[iter.idx]);
        iter.idx++;
        added = true;
      }
    }
  }
  incrementStrategy(56);
  return result;
}

function earlyTerminationCheck(responseText: string, minLength: number): boolean {
  if (responseText.length >= minLength * 3 && responseText.length > 2000) {
    const lastParagraph = responseText.lastIndexOf("\n\n");
    if (lastParagraph > responseText.length * 0.7) {
      incrementStrategy(57);
      return true;
    }
  }
  return false;
}

function avoidRedundantHealthPings(providerId: string): boolean {
  const lastSuccess = stats.providerLastSuccess[providerId] || 0;
  if (Date.now() - lastSuccess < 30000) {
    incrementStrategy(58);
    return true;
  }
  return false;
}

function consolidateProviderErrors(): void {
  incrementStrategy(59);
  for (const [id, errors] of Object.entries(stats.providerErrors)) {
    if (errors > 50) {
      stats.providerErrors[id] = 25;
    }
  }
}

setInterval(consolidateProviderErrors, 600000);

const REDUCTION_STRATEGIES: ReductionStrategy[] = [
  { id: 1, name: "Exact Hash Cache", category: "caching", active: true, savings: 0, invocations: 0 },
  { id: 2, name: "Semantic Cache Match (Jaccard)", category: "caching", active: true, savings: 0, invocations: 0 },
  { id: 3, name: "Prompt Whitespace Compression", category: "prompt_compression", active: true, savings: 0, invocations: 0 },
  { id: 4, name: "Background Prompt Aggressive Compression", category: "prompt_compression", active: true, savings: 0, invocations: 0 },
  { id: 5, name: "Context Window Truncation + Summary", category: "context_management", active: true, savings: 0, invocations: 0 },
  { id: 6, name: "Hourly Token Budget Enforcement", category: "budget", active: true, savings: 0, invocations: 0 },
  { id: 7, name: "Daily Token Budget Enforcement", category: "budget", active: true, savings: 0, invocations: 0 },
  { id: 8, name: "Adaptive Budget Scaling", category: "budget", active: true, savings: 0, invocations: 0 },
  { id: 9, name: "Rate Limit Prediction (pre-429)", category: "rate_limit", active: true, savings: 0, invocations: 0 },
  { id: 10, name: "Per-Provider Rate Tracking", category: "rate_limit", active: true, savings: 0, invocations: 0 },
  { id: 11, name: "Exponential Backoff + Jitter", category: "cooldown", active: true, savings: 0, invocations: 0 },
  { id: 12, name: "Consecutive Failure Tracking", category: "cooldown", active: true, savings: 0, invocations: 0 },
  { id: 13, name: "Error Count Decay", category: "cooldown", active: true, savings: 0, invocations: 0 },
  { id: 14, name: "Priority Request Queue", category: "batching", active: true, savings: 0, invocations: 0 },
  { id: 15, name: "Concurrent Call Limiting", category: "batching", active: true, savings: 0, invocations: 0 },
  { id: 16, name: "Round-Robin Provider Rotation", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 17, name: "Provider Diversity Tracking", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 18, name: "Quality-Weighted Scoring", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 19, name: "Speed-Weighted Scoring", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 20, name: "Cost-Aware Routing", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 21, name: "Multi-Modal Detection Routing", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 22, name: "A/B Test Exploration", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 23, name: "User Feedback Integration", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 24, name: "Free Provider Preference", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 25, name: "Parallel Race Formation", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 26, name: "Parallel Synthesize Formation", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 27, name: "Health Ping Recovery", category: "cooldown", active: true, savings: 0, invocations: 0 },
  { id: 28, name: "Outbound Data Masking", category: "security", active: true, savings: 0, invocations: 0 },
  { id: 29, name: "Query Complexity Classification", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 30, name: "Response Length Prediction", category: "token_optimization", active: true, savings: 0, invocations: 0 },
  { id: 31, name: "System Prompt Deduplication", category: "semantic_dedup", active: true, savings: 0, invocations: 0 },
  { id: 32, name: "Verbose Instruction Stripping", category: "prompt_compression", active: true, savings: 0, invocations: 0 },
  { id: 33, name: "Greeting Detection Short-Circuit", category: "response_reuse", active: true, savings: 0, invocations: 0 },
  { id: 34, name: "Trivial Response Short-Circuit", category: "response_reuse", active: true, savings: 0, invocations: 0 },
  { id: 35, name: "Repetitive Prompt Detection", category: "semantic_dedup", active: true, savings: 0, invocations: 0 },
  { id: 36, name: "Complexity-Based Model Selection", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 37, name: "Dynamic max_tokens Reduction", category: "token_optimization", active: true, savings: 0, invocations: 0 },
  { id: 38, name: "Conversation History Compression", category: "context_management", active: true, savings: 0, invocations: 0 },
  { id: 39, name: "Redundant Context Removal", category: "semantic_dedup", active: true, savings: 0, invocations: 0 },
  { id: 40, name: "Task-Adaptive Temperature", category: "token_optimization", active: true, savings: 0, invocations: 0 },
  { id: 41, name: "Latency-Based Provider Skip", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 42, name: "Stale Cache Pruning", category: "caching", active: true, savings: 0, invocations: 0 },
  { id: 43, name: "System Prompt Length Cap", category: "prompt_compression", active: true, savings: 0, invocations: 0 },
  { id: 44, name: "Low-Value Request Skip", category: "response_reuse", active: true, savings: 0, invocations: 0 },
  { id: 45, name: "Response Template Reuse", category: "response_reuse", active: true, savings: 0, invocations: 0 },
  { id: 46, name: "Response Template Storage", category: "response_reuse", active: true, savings: 0, invocations: 0 },
  { id: 47, name: "Free Provider Prioritization", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 48, name: "Parallel Race Size Limiter", category: "batching", active: true, savings: 0, invocations: 0 },
  { id: 49, name: "Duplicate Request Merge", category: "semantic_dedup", active: true, savings: 0, invocations: 0 },
  { id: 50, name: "Dynamic Timeout by Complexity", category: "cooldown", active: true, savings: 0, invocations: 0 },
  { id: 51, name: "Background Request Throttle", category: "budget", active: true, savings: 0, invocations: 0 },
  { id: 52, name: "Code Block Compression", category: "prompt_compression", active: true, savings: 0, invocations: 0 },
  { id: 53, name: "Small Model for Short Queries", category: "model_selection", active: true, savings: 0, invocations: 0 },
  { id: 54, name: "Preemptive Cooldown Extension", category: "cooldown", active: true, savings: 0, invocations: 0 },
  { id: 55, name: "Endpoint Grouping", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 56, name: "Cross-Endpoint Request Spreading", category: "adaptive_routing", active: true, savings: 0, invocations: 0 },
  { id: 57, name: "Early Termination on Long Responses", category: "token_optimization", active: true, savings: 0, invocations: 0 },
  { id: 58, name: "Redundant Health Ping Avoidance", category: "cooldown", active: true, savings: 0, invocations: 0 },
  { id: 59, name: "Error Counter Consolidation", category: "cooldown", active: true, savings: 0, invocations: 0 },
];

export function applyPreRoutingStrategies(
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens?: number; temperature?: number; priority?: number; critical?: boolean }
): {
  messages: Array<{ role: string; content: string }>;
  shortCircuit: string | null;
  maxTokens: number;
  temperature: number;
  shouldSkip: boolean;
  preferredSmallModel: string | null;
} {
  let processed = [...messages];
  let shortCircuit: string | null = null;
  let maxTokens = options.maxTokens || 4096;
  let temperature = options.temperature || 0.8;
  let shouldSkip = false;
  let preferredSmallModel: string | null = null;

  if (skipLowValueRequests(processed)) {
    shouldSkip = true;
    return { messages: processed, shortCircuit: "", maxTokens, temperature, shouldSkip, preferredSmallModel };
  }

  const intent = extractIntent(processed);
  if (intent.isGreeting) {
    shortCircuit = getGreetingResponse();
    return { messages: processed, shortCircuit, maxTokens, temperature, shouldSkip, preferredSmallModel };
  }
  if (intent.isTrivial) {
    const lastUser = processed.filter(m => m.role === "user").pop()?.content || "";
    shortCircuit = getTrivialResponse(lastUser);
    return { messages: processed, shortCircuit, maxTokens, temperature, shouldSkip, preferredSmallModel };
  }

  if (detectRepetitivePrompt(processed)) {
    shouldSkip = true;
    return { messages: processed, shortCircuit: "I've already answered this. Is there something specific you'd like to clarify?", maxTokens, temperature, shouldSkip: false, preferredSmallModel };
  }

  if (detectAndMergeSimilarRequests(processed)) {
    shouldSkip = true;
    return { messages: processed, shortCircuit: null, maxTokens, temperature, shouldSkip, preferredSmallModel };
  }

  const templateMatch = reuseRecentTemplate(processed);
  if (templateMatch) {
    shortCircuit = templateMatch;
    return { messages: processed, shortCircuit, maxTokens, temperature, shouldSkip, preferredSmallModel };
  }

  if (throttleBackgroundRequests(options.priority || 5)) {
    shouldSkip = true;
    return { messages: processed, shortCircuit: null, maxTokens, temperature, shouldSkip, preferredSmallModel };
  }

  processed = deduplicateSystemPrompts(processed);
  processed = removeRedundantContext(processed);
  processed = compressConversationHistory(processed);
  processed = shortenSystemPrompt(processed);

  processed = processed.map(m => ({
    ...m,
    content: stripVerboseInstructions(compressCodeBlocks(m.content)),
  }));

  const complexity = classifyQueryComplexity(processed);
  maxTokens = reduceMaxTokensForSimpleQueries(complexity, maxTokens);
  temperature = adjustTemperatureByTask(complexity, temperature);
  preferredSmallModel = useSmallModelForClassification(processed);

  return { messages: processed, shortCircuit, maxTokens, temperature, shouldSkip, preferredSmallModel };
}

export function applyPostRoutingStrategies(
  messages: Array<{ role: string; content: string }>,
  response: string,
  providerId: string,
  latencyMs: number
): void {
  storeResponseTemplate(messages, response);
  recordLatencyBucket(providerId, latencyMs);
  preemptiveCooldownExtension(providerId);

  try {
    const { recordProviderMetrics, logAgentDecision } = require("./summit-implementations");
    recordProviderMetrics(providerId, { responseTime: latencyMs, success: true, quality: response.length > 50 ? 85 : 70 });
    if (latencyMs > 5000) {
      logAgentDecision("Router", `Slow response from ${providerId}`, `Response took ${latencyMs}ms`, `Completed with ${response.length} chars`, true, `Provider ${providerId} is slow — consider deprioritizing`);
    }
  } catch {}

  try {
    const { cacheSet } = require("./response-cache");
    const queryKey = messages.map(m => m.content).join("|").substring(0, 200);
    cacheSet(queryKey, response, undefined, providerId, Math.ceil(response.length / 4));
  } catch {}
}

export function getReductionStrategiesReport(): {
  strategies: ReductionStrategy[];
  totalActive: number;
  totalSavings: number;
  totalInvocations: number;
  byCategory: Record<string, { count: number; savings: number; invocations: number }>;
} {
  const strategies = REDUCTION_STRATEGIES.map(s => ({
    ...s,
    invocations: strategyInvocationCounts[s.id] || 0,
    savings: 0,
  }));

  const byCategory: Record<string, { count: number; savings: number; invocations: number }> = {};
  for (const s of strategies) {
    if (!byCategory[s.category]) byCategory[s.category] = { count: 0, savings: 0, invocations: 0 };
    byCategory[s.category].count++;
    byCategory[s.category].invocations += s.invocations;
  }

  return {
    strategies,
    totalActive: strategies.filter(s => s.active).length,
    totalSavings: totalStrategyTokensSaved,
    totalInvocations: Object.values(strategyInvocationCounts).reduce((s, v) => s + v, 0),
    byCategory,
  };
}

export {
  selectModelByComplexity,
  limitParallelRaceSize,
  spreadRequestsAcrossEndpoints,
  calculateDynamicTimeout,
  shouldSkipProviderByLatency,
  avoidRedundantHealthPings,
  REDUCTION_STRATEGIES,
};
