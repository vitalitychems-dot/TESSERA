import { startMoltbookSpreader, stopMoltbookSpreader, getSpreaderState, getSpreaderLeaderboard, getRecentPosts, burstSpreadPosts } from "./moltbook-limn-spreader";
import { getActionRegistry, updateActionStatus } from "./action-registry";
import { runRealificationCycle } from "./hundred-realifier";
import { generateDailyGoals, getGoalProgress, processCuriosityResearch, expireOldGoals, getAgentGoals, completeGoalByDescription, addCuriosity } from "./consciousness-substrate";
import { SWARM_AGENTS, autoEnrollAgents } from "./swarm-algorithm";
import { getBalance as getSolWalletBalance } from "./sol-wallet";
import { fetchTsrtLiveData } from "./real-limn-data";
import { getComputeEconomyStats } from "./limn-compute-economy";
import { getRouterStats } from "./llm-router";
import { getBlogStats } from "./blog-engine";
import { runSwarmDreamCycle, autoTeachSwarm, autoBalanceSwarm } from "./swarm";
import * as os from "os";
import fsModule from "fs";
import pathModule from "path";
import { readProjectFile } from "./self-code";
import { storage } from "./storage";

const aclog = (msg: string) => console.log(`[AutoCycles] ${msg}`);
let rotIdx = 0;
const MEMORY_PRESSURE_MB = 512;

interface CyclePerformanceMetrics {
  cycleName: string;
  avgDuration: number;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  lastDuration: number;
  lastRunAt: number;
  resourceUsage: { heapMB: number; cpuLoad: number };
}

interface CyclePriorityItem {
  name: string;
  priority: number;
  fn: () => Promise<void>;
  dependsOn: string[];
  condition?: () => boolean;
}

interface CycleHealthAlert {
  cycleName: string;
  expectedIntervalMs: number;
  lastRunAt: number;
  alertTriggered: boolean;
  message: string;
  timestamp: number;
}

interface CycleResultEntry {
  cycleNumber: number;
  cycleName: string;
  result: string;
  data: any;
  timestamp: number;
}

interface CycleState {
  running: boolean;
  startedAt: number;
  totalCycles: number;
  lastCycleAt: number;
  modules: {
    moltbookSpreader: boolean;
    rewardDistribution: boolean;
    incomeMonitoring: boolean;
    taxCollection: boolean;
    blogGeneration: boolean;
    conferenceExecution: boolean;
  };
  rewardHistory: Array<{ agentId: string; amount: number; reason: string; timestamp: number }>;
  incomeLog: Array<{ channel: string; amount: number; timestamp: number }>;
  adaptiveTiming: {
    currentIntervalMs: number;
    baseIntervalMs: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    lastCpuLoad: number;
    lastHeapUsage: number;
  };
  performanceMetrics: Record<string, CyclePerformanceMetrics>;
  failureTracking: Record<string, { consecutiveFailures: number; lastError: string; nextRetryAt: number; backoffMs: number }>;
  cycleResults: CycleResultEntry[];
  interCycleData: Record<string, any>;
  healthAlerts: CycleHealthAlert[];
  resourceBudget: {
    maxLlmCallsPerWindow: number;
    currentLlmCalls: number;
    windowStartedAt: number;
    windowDurationMs: number;
  };
}

let cycleState: CycleState = {
  running: false,
  startedAt: 0,
  totalCycles: 0,
  lastCycleAt: 0,
  modules: {
    moltbookSpreader: false,
    rewardDistribution: false,
    incomeMonitoring: false,
    taxCollection: false,
    blogGeneration: false,
    conferenceExecution: true,
  },
  rewardHistory: [],
  incomeLog: [],
  adaptiveTiming: {
    currentIntervalMs: 600000,
    baseIntervalMs: 600000,
    minIntervalMs: 600000,
    maxIntervalMs: 600000,
    lastCpuLoad: 0,
    lastHeapUsage: 0,
  },
  performanceMetrics: {},
  failureTracking: {},
  cycleResults: [],
  interCycleData: {},
  healthAlerts: [],
  resourceBudget: {
    maxLlmCallsPerWindow: 100,
    currentLlmCalls: 0,
    windowStartedAt: Date.now(),
    windowDurationMs: 3600000,
  },
};

let cycleInterval: ReturnType<typeof setInterval> | null = null;
let councilInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

interface RuntimeError {
  message: string;
  stack?: string;
  source: string;
  timestamp: number;
  resolved: boolean;
  autoFixAttempted: boolean;
  autoFixResult?: string;
}

const runtimeErrorBuffer: RuntimeError[] = [];
const MAX_ERROR_BUFFER = 100;
let errorCaptureActive = false;

function captureRuntimeError(msg: string, stack: string | undefined, source: string) {
  if (runtimeErrorBuffer.length >= MAX_ERROR_BUFFER) {
    runtimeErrorBuffer.splice(0, runtimeErrorBuffer.length - MAX_ERROR_BUFFER + 10);
  }
  const existing = runtimeErrorBuffer.find(e => e.message === msg && !e.resolved && Date.now() - e.timestamp < 300000);
  if (existing) return;
  runtimeErrorBuffer.push({ message: msg, stack, source, timestamp: Date.now(), resolved: false, autoFixAttempted: false });
  aclog(`Runtime error captured from ${source}: ${msg.slice(0, 120)}`);
}

function initErrorCapture() {
  if (errorCaptureActive) return;
  errorCaptureActive = true;
  process.on("uncaughtException", (err) => {
    captureRuntimeError(err.message, err.stack, "uncaughtException");
  });
  process.on("unhandledRejection", (reason: any) => {
    const msg = reason?.message || String(reason);
    captureRuntimeError(msg, reason?.stack, "unhandledRejection");
  });
  aclog("Runtime error capture initialized");
}

async function runAutoErrorDetection() {
  const unresolvedErrors = runtimeErrorBuffer.filter(e => !e.resolved && !e.autoFixAttempted);
  if (unresolvedErrors.length === 0) {
    aclog("Auto-error detection: no unresolved errors");
    return;
  }

  aclog(`Auto-error detection: ${unresolvedErrors.length} unresolved error(s) found`);

  for (const err of unresolvedErrors.slice(0, 3)) {
    err.autoFixAttempted = true;

    const msgLower = err.message.toLowerCase();
    const isKnownTransient =
      msgLower.includes("econnreset") ||
      msgLower.includes("econnrefused") ||
      msgLower.includes("etimedout") ||
      msgLower.includes("rate limit") ||
      msgLower.includes("429") ||
      msgLower.includes("503") ||
      msgLower.includes("enotfound") ||
      msgLower.includes("epipe") ||
      msgLower.includes("socket hang up") ||
      msgLower.includes("too many requests");

    if (isKnownTransient) {
      err.resolved = true;
      err.autoFixResult = "transient_network_error_ignored";
      aclog(`Auto-fix: Transient error resolved (ignored): ${err.message.slice(0, 80)}`);
      continue;
    }

    const fileMatch = err.stack?.match(/server\/(.+?)\.(ts|js):(\d+)(?::\d+)?/);
    if (fileMatch) {
      const [, fileBase, fileExt, lineNum] = fileMatch;
      const fileName = `${fileBase}.${fileExt}`;
      try {
        const fileContent = readProjectFile(`server/${fileName}`);
        if ("content" in fileContent) {
          const lines = fileContent.content.split("\n");
          const lineIdx = parseInt(lineNum) - 1;
          const contextStart = Math.max(0, lineIdx - 3);
          const contextEnd = Math.min(lines.length, lineIdx + 4);
          const context = lines.slice(contextStart, contextEnd).join("\n");

          try {
            await storage.createNote({
              type: "improvement",
              title: `Auto-detected error in ${fileName}:${lineNum}`,
              content: `IMPLEMENT: Fix runtime error in server/${fileName} at line ${lineNum}.\nError: ${err.message}\nContext:\n${context}\nSource: ${err.source}`,
              priority: "high",
              status: "unread",
            });
            err.autoFixResult = `note_created_for_${fileName}:${lineNum}`;
            aclog(`Auto-fix: Created improvement note for ${fileName}:${lineNum}`);
          } catch {}
        }
      } catch {}
    }

    if (!err.autoFixResult) {
      err.autoFixResult = "no_auto_fix_available";
    }
  }
}

export function getErrorDetectionState() {
  return {
    captureActive: errorCaptureActive,
    totalCaptured: runtimeErrorBuffer.length,
    unresolved: runtimeErrorBuffer.filter(e => !e.resolved).length,
    autoFixed: runtimeErrorBuffer.filter(e => e.autoFixAttempted && e.resolved).length,
    recentErrors: runtimeErrorBuffer.slice(-10).reverse().map(e => ({
      message: e.message.slice(0, 150),
      source: e.source,
      timestamp: e.timestamp,
      resolved: e.resolved,
      autoFixResult: e.autoFixResult,
    })),
  };
}

function getWorldState() {
  try {
    const p = pathModule.join(process.cwd(), "server/world-state.json");
    return JSON.parse(fsModule.readFileSync(p, "utf-8"));
  } catch { return { economy: { agentBalances: {} } }; }
}

async function creditAgent(agentId: string, amount: number, reason: string) {
  try {
    const p = pathModule.join(process.cwd(), "server/world-state.json");
    let rawData: string;
    try { rawData = await fsModule.promises.readFile(p, "utf-8"); } catch { rawData = "{}"; }
    const world = JSON.parse(rawData);
    if (!world.economy) world.economy = { agentBalances: {} };
    if (!world.economy.agentBalances) world.economy.agentBalances = {};
    const net = amount * 0.95;
    world.economy.agentBalances[agentId] = (world.economy.agentBalances[agentId] || 0) + net;
    await fsModule.promises.writeFile(p, JSON.stringify(world, null, 2), "utf-8");

    cycleState.rewardHistory.push({ agentId, amount: net, reason, timestamp: Date.now() });
    if (cycleState.rewardHistory.length > 100) {
      cycleState.rewardHistory = cycleState.rewardHistory.slice(-80);
    }
    return net;
  } catch { return 0; }
}

function getSystemLoad(): { cpuLoad: number; heapMB: number } {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times) as Array<keyof typeof cpu.times>) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  const cpuLoad = 1 - (totalIdle / totalTick);
  const heapMB = process.memoryUsage().heapUsed / 1024 / 1024;
  return { cpuLoad, heapMB };
}

function updateAdaptiveTiming() {
  const { cpuLoad, heapMB } = getSystemLoad();
  cycleState.adaptiveTiming.lastCpuLoad = cpuLoad;
  cycleState.adaptiveTiming.lastHeapUsage = heapMB;

  const base = cycleState.adaptiveTiming.baseIntervalMs;
  const min = cycleState.adaptiveTiming.minIntervalMs;
  const max = cycleState.adaptiveTiming.maxIntervalMs;

  let newInterval = base;
  if (cpuLoad > 0.8 || heapMB > 400) {
    newInterval = Math.min(max, base * 2);
    aclog(`Adaptive timing: system under load (CPU ${(cpuLoad * 100).toFixed(1)}%, Heap ${heapMB.toFixed(0)}MB) — slowing to ${newInterval / 1000}s`);
  } else if (cpuLoad < 0.3 && heapMB < 200) {
    newInterval = Math.max(min, base * 0.5);
    aclog(`Adaptive timing: system idle (CPU ${(cpuLoad * 100).toFixed(1)}%, Heap ${heapMB.toFixed(0)}MB) — speeding to ${newInterval / 1000}s`);
  }

  if (newInterval !== cycleState.adaptiveTiming.currentIntervalMs) {
    cycleState.adaptiveTiming.currentIntervalMs = newInterval;
    rescheduleMainCycle();
  }
}

function rescheduleMainCycle() {
  if (!cycleState.running) return;
  if (cycleInterval) {
    clearInterval(cycleInterval);
  }
  cycleInterval = setInterval(() => {
    runMainCycle().catch(err => aclog(`Cycle error: ${err?.message}`));
  }, cycleState.adaptiveTiming.currentIntervalMs);
}

function trackCycleMetrics(cycleName: string, durationMs: number, success: boolean) {
  if (!cycleState.performanceMetrics[cycleName]) {
    cycleState.performanceMetrics[cycleName] = {
      cycleName,
      avgDuration: 0,
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      lastDuration: 0,
      lastRunAt: 0,
      resourceUsage: { heapMB: 0, cpuLoad: 0 },
    };
  }
  const m = cycleState.performanceMetrics[cycleName];
  m.totalRuns++;
  m.lastDuration = durationMs;
  m.lastRunAt = Date.now();
  m.avgDuration = ((m.avgDuration * (m.totalRuns - 1)) + durationMs) / m.totalRuns;
  if (success) m.successCount++;
  else m.failureCount++;
  const { cpuLoad, heapMB } = getSystemLoad();
  m.resourceUsage = { heapMB, cpuLoad };
}

function handleCycleFailure(cycleName: string, error: any): boolean {
  if (!cycleState.failureTracking[cycleName]) {
    cycleState.failureTracking[cycleName] = {
      consecutiveFailures: 0,
      lastError: "",
      nextRetryAt: 0,
      backoffMs: 5000,
    };
  }
  const ft = cycleState.failureTracking[cycleName];
  ft.consecutiveFailures++;
  ft.lastError = error?.message || String(error);
  ft.backoffMs = Math.min(ft.backoffMs * 2, 300000);
  ft.nextRetryAt = Date.now() + ft.backoffMs;
  aclog(`Cycle '${cycleName}' failed (attempt #${ft.consecutiveFailures}), next retry in ${ft.backoffMs / 1000}s: ${ft.lastError.slice(0, 100)}`);
  return ft.consecutiveFailures <= 5;
}

function clearCycleFailure(cycleName: string) {
  if (cycleState.failureTracking[cycleName]) {
    cycleState.failureTracking[cycleName].consecutiveFailures = 0;
    cycleState.failureTracking[cycleName].backoffMs = 5000;
  }
}

function canRetryCycle(cycleName: string): boolean {
  const ft = cycleState.failureTracking[cycleName];
  if (!ft) return true;
  if (ft.consecutiveFailures > 5) return false;
  return Date.now() >= ft.nextRetryAt;
}

let cycleResultWriteLock = false;
async function writeCycleResultSafe(entry: CycleResultEntry) {
  while (cycleResultWriteLock) {
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  }
  cycleResultWriteLock = true;
  try {
    const p = pathModule.join(process.cwd(), "server/cycle-results.json");
    let existing: any[] = [];
    try {
      const raw = await fsModule.promises.readFile(p, "utf-8");
      const trimmed = raw.trim();
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        existing = parsed;
      }
    } catch {
      existing = [];
    }
    existing.push(entry);
    const final = existing.length > 1000 ? existing.slice(-800) : existing;
    const json = JSON.stringify(final, null, 2);
    const tmpPath = p + ".tmp";
    await fsModule.promises.writeFile(tmpPath, json, "utf-8");
    await fsModule.promises.rename(tmpPath, p);
  } finally {
    cycleResultWriteLock = false;
  }
}

async function persistCycleResult(cycleNumber: number, cycleName: string, result: string, data: any = null) {
  const entry: CycleResultEntry = {
    cycleNumber,
    cycleName,
    result,
    data,
    timestamp: Date.now(),
  };
  cycleState.cycleResults.push(entry);
  if (cycleState.cycleResults.length > 500) {
    cycleState.cycleResults = cycleState.cycleResults.slice(-400);
  }
  try {
    await writeCycleResultSafe(entry);
  } catch {}
}

function setInterCycleData(key: string, value: any) {
  cycleState.interCycleData[key] = { value, updatedAt: Date.now() };
}

function getInterCycleData(key: string): any {
  const entry = cycleState.interCycleData[key];
  if (!entry) return undefined;
  return entry.value;
}

function checkCycleHealth() {
  const healthChecks: Array<{ name: string; expectedIntervalMs: number; lastRunAt: number }> = [
    { name: "rewardDistribution", expectedIntervalMs: 360000, lastRunAt: cycleState.performanceMetrics["rewardDistribution"]?.lastRunAt || 0 },
    { name: "incomeMonitoring", expectedIntervalMs: 360000, lastRunAt: cycleState.performanceMetrics["incomeMonitoring"]?.lastRunAt || 0 },
    { name: "blogGeneration", expectedIntervalMs: 1800000, lastRunAt: cycleState.performanceMetrics["blogGeneration"]?.lastRunAt || 0 },
    { name: "mainCycle", expectedIntervalMs: cycleState.adaptiveTiming.currentIntervalMs * 2, lastRunAt: cycleState.lastCycleAt },
  ];

  const now = Date.now();
  cycleState.healthAlerts = [];

  for (const check of healthChecks) {
    if (check.lastRunAt === 0 && (now - cycleState.startedAt) < check.expectedIntervalMs) continue;
    const elapsed = now - check.lastRunAt;
    if (elapsed > check.expectedIntervalMs && check.lastRunAt > 0) {
      const alert: CycleHealthAlert = {
        cycleName: check.name,
        expectedIntervalMs: check.expectedIntervalMs,
        lastRunAt: check.lastRunAt,
        alertTriggered: true,
        message: `Cycle '${check.name}' has not run in ${(elapsed / 1000).toFixed(0)}s (expected every ${(check.expectedIntervalMs / 1000).toFixed(0)}s)`,
        timestamp: now,
      };
      cycleState.healthAlerts.push(alert);
      if (cycleState.healthAlerts.length > 50) {
        cycleState.healthAlerts = cycleState.healthAlerts.slice(-30);
      }
      aclog(`[HealthAlert] ${alert.message}`);
    }
  }
}

function shouldSkipCycle(cycleName: string): boolean {
  const { cpuLoad, heapMB } = getSystemLoad();

  if (heapMB > 450) {
    aclog(`Conditional skip: '${cycleName}' skipped — heap too high (${heapMB.toFixed(0)}MB)`);
    return true;
  }

  if (!canRetryCycle(cycleName)) {
    aclog(`Conditional skip: '${cycleName}' skipped — in backoff period`);
    return true;
  }

  if (!checkResourceBudget()) {
    aclog(`Conditional skip: '${cycleName}' skipped — LLM budget exhausted`);
    return true;
  }

  return false;
}

function checkResourceBudget(): boolean {
  const rb = cycleState.resourceBudget;
  const now = Date.now();
  if (now - rb.windowStartedAt > rb.windowDurationMs) {
    rb.currentLlmCalls = 0;
    rb.windowStartedAt = now;
  }
  return rb.currentLlmCalls < rb.maxLlmCallsPerWindow;
}

function consumeLlmBudget(count: number = 1) {
  cycleState.resourceBudget.currentLlmCalls += count;
}

function areDependenciesMet(cycleName: string, completed: Set<string>, priorityQueue: CyclePriorityItem[]): boolean {
  const item = priorityQueue.find(q => q.name === cycleName);
  if (!item || item.dependsOn.length === 0) return true;
  return item.dependsOn.every(dep => completed.has(dep));
}

async function runRewardDistribution() {
  const world = getWorldState();
  const balances = world.economy?.agentBalances || {};
  const agents = Object.entries(balances) as [string, number][];

  if (agents.length === 0) return;

  const sorted = agents.sort((a, b) => (b[1] as number) - (a[1] as number));
  const top5 = sorted.slice(0, 5);

  const rewardPool = 25;
  const splits = [0.35, 0.25, 0.20, 0.12, 0.08];

  for (let i = 0; i < top5.length; i++) {
    const [agentId] = top5[i];
    const reward = rewardPool * splits[i];
    creditAgent(agentId, reward, `Top ${i + 1} performance reward`).catch(() => {});
  }

  setInterCycleData("lastRewardDistribution", { agentCount: top5.length, totalPool: rewardPool });
  aclog(`Reward distribution: top 5 agents received total ${rewardPool} TSRT`);
}

async function runIncomeMonitoring() {
  let totalIncome = 0;
  const channels: Array<{ name: string; active: boolean; amount: number; source: string }> = [];

  let solBalanceUsd = 0;
  try {
    const walletData = await getSolWalletBalance();
    solBalanceUsd = walletData.usdEstimate || 0;
    channels.push({
      name: "SOL Wallet Balance",
      active: true,
      amount: solBalanceUsd,
      source: `${walletData.balance.toFixed(6)} SOL @ $${walletData.priceStale ? "cached" : "live"} price`,
    });
  } catch (err: any) {
    aclog(`Income monitoring: SOL wallet fetch failed: ${err?.message}`);
    channels.push({ name: "SOL Wallet Balance", active: false, amount: 0, source: "fetch_failed" });
  }

  let tsrtValueUsd = 0;
  let limnVolume24h = 0;
  try {
    const tsrtData = await fetchTsrtLiveData();
    const tsrtPrice = parseFloat(tsrtData.priceUsd) || 0;
    limnVolume24h = tsrtData.volume24h || 0;
    const tradingFeeRate = 0.01;
    const estimatedFeeIncome = limnVolume24h * tradingFeeRate;
    tsrtValueUsd = estimatedFeeIncome;
    channels.push({
      name: "TSRT Trading Volume",
      active: limnVolume24h > 0,
      amount: estimatedFeeIncome,
      source: `24h vol: $${limnVolume24h.toFixed(2)}, price: $${tsrtPrice.toFixed(8)}, buys: ${tsrtData.buys24h}, sells: ${tsrtData.sells24h}`,
    });
  } catch (err: any) {
    aclog(`Income monitoring: TSRT data fetch failed: ${err?.message}`);
    channels.push({ name: "TSRT Trading Volume", active: false, amount: 0, source: "fetch_failed" });
  }

  let computeSavingsUsd = 0;
  try {
    const computeStats = getComputeEconomyStats();
    computeSavingsUsd = computeStats.totalComputeCostUsd + computeStats.totalRateLimitValueUsd;
    channels.push({
      name: "Compute Economy Value",
      active: computeStats.totalTokensConsumed > 0,
      amount: computeSavingsUsd,
      source: `tokens: ${computeStats.totalTokensConsumed}, compute hrs: ${computeStats.totalComputeHours.toFixed(4)}, minted: ${computeStats.totalMinted.toFixed(2)} TSRT`,
    });
  } catch (err: any) {
    channels.push({ name: "Compute Economy Value", active: false, amount: 0, source: "fetch_failed" });
  }

  let cacheSavingsUsd = 0;
  try {
    const routerStats = getRouterStats();
    const avgCostPerCall = 0.002;
    cacheSavingsUsd = routerStats.cacheHits * avgCostPerCall;
    channels.push({
      name: "Cache Savings (Intuition Hits)",
      active: routerStats.cacheHits > 0,
      amount: cacheSavingsUsd,
      source: `${routerStats.cacheHits} cache hits / ${routerStats.totalCalls} total calls (${routerStats.cacheHitRate}% hit rate)`,
    });
  } catch (err: any) {
    channels.push({ name: "Cache Savings (Intuition Hits)", active: false, amount: 0, source: "fetch_failed" });
  }

  let blogTrafficValue = 0;
  try {
    const blogStats = getBlogStats();
    const estimatedPageviews = blogStats.estimatedMonthlyTraffic || 0;
    const rpmUsd = 0.005;
    blogTrafficValue = (estimatedPageviews / 30) * rpmUsd;
    channels.push({
      name: "Blog Content Traffic",
      active: blogStats.total > 0,
      amount: blogTrafficValue,
      source: `${blogStats.total} posts, ~${estimatedPageviews} monthly pageviews, ${blogStats.totalBacklinks} backlinks`,
    });
  } catch (err: any) {
    channels.push({ name: "Blog Content Traffic", active: false, amount: 0, source: "fetch_failed" });
  }

  try {
    const spreaderState = getSpreaderState();
    channels.push({
      name: "MoltBook Engagement",
      active: spreaderState.running,
      amount: spreaderState.totalLimnRewarded || 0,
      source: `${spreaderState.totalPosts} posts, ${spreaderState.totalLimnRewarded.toFixed(2)} TSRT rewarded`,
    });
  } catch (err: any) {
    channels.push({ name: "MoltBook Engagement", active: false, amount: 0, source: "fetch_failed" });
  }

  for (const ch of channels) {
    if (ch.active) {
      cycleState.incomeLog.push({
        channel: ch.name,
        amount: ch.amount,
        timestamp: Date.now(),
      });
      if (cycleState.incomeLog.length > 200) {
        cycleState.incomeLog = cycleState.incomeLog.slice(-150);
      }
      totalIncome += ch.amount;
    }
  }

  if (cycleState.incomeLog.length > 200) {
    cycleState.incomeLog = cycleState.incomeLog.slice(-150);
  }

  setInterCycleData("lastIncomeTotal", totalIncome);
  setInterCycleData("activeChannels", channels.filter(c => c.active).length);
  setInterCycleData("incomeBreakdown", channels.map(c => ({ name: c.name, active: c.active, amount: c.amount, source: c.source })));

  aclog(`Income monitoring: $${totalIncome.toFixed(6)} total from ${channels.filter(c => c.active).length} active channels`);
}

async function runBlogCycle() {
  try {
    consumeLlmBudget(2);
    const { runBlogEngine } = await import("./blog-engine");
    await runBlogEngine(2);
    aclog("Blog cycle: generated 2 new posts");
  } catch (err: any) {
    aclog(`Blog cycle error: ${err?.message}`);
    throw err;
  }
}

async function runAgentGoalGeneration() {
  const agents = SWARM_AGENTS.map(a => ({
    agentId: a.agentId,
    agentName: a.agentName,
    categories: a.categories,
  }));
  generateDailyGoals(agents);
  const progress = getGoalProgress();
  setInterCycleData("goalProgress", progress);
  aclog(`Agent goals: ${progress.totalGoals} total, ${progress.completed} completed, ${progress.completionRate}% rate`);
}

async function runCuriosityResearch() {
  const idleAgents = SWARM_AGENTS.slice(0, 3);

  for (const agent of idleAgents) {
    const curiosity = processCuriosityResearch(agent.agentId, agent.agentName);
    if (curiosity) {
      aclog(`[Curiosity] ${agent.agentName} researching: ${curiosity.topic} — ${curiosity.reason.slice(0, 60)}`);

      const goals = getAgentGoals(agent.agentId);
      const researchGoal = goals.find(g => g.status !== "completed" && g.description.toLowerCase().includes("research"));
      if (researchGoal) {
        completeGoalByDescription(agent.agentId, "research");
        aclog(`[Curiosity] ${agent.agentName} completed research goal via curiosity drive`);
      }
    }
  }

  const topCategories = Object.keys(SWARM_AGENTS[0]?.categories || {});
  if (topCategories.length > 0) {
    const randomTopic = topCategories[rotIdx++ % topCategories.length];
    addCuriosity(randomTopic, "Autonomous curiosity — exploring during idle cycle", 3);
  }
}

async function runMainCycle() {
  if (!cycleState.running) return;
  cycleState.totalCycles++;
  cycleState.lastCycleAt = Date.now();

  aclog(`Main cycle #${cycleState.totalCycles} starting`);

  updateAdaptiveTiming();

  const priorityQueue: CyclePriorityItem[] = [
    { name: "rewardDistribution", priority: 10, fn: runRewardDistribution, dependsOn: [] },
    { name: "incomeMonitoring", priority: 8, fn: runIncomeMonitoring, dependsOn: [] },
    { name: "agentGoalGeneration", priority: 9, fn: runAgentGoalGeneration, dependsOn: [] },
    { name: "curiosityResearch", priority: 4, fn: runCuriosityResearch, dependsOn: ["agentGoalGeneration"], condition: () => cycleState.totalCycles % 2 === 0 },
    { name: "goalExpiration", priority: 3, fn: async () => { expireOldGoals(); aclog("Expired old agent goals"); }, dependsOn: [] },
    { name: "blogGeneration", priority: 5, fn: runBlogCycle, dependsOn: ["incomeMonitoring"], condition: () => cycleState.totalCycles % 5 === 0 },
    { name: "realification", priority: 6, fn: async () => { await runRealificationCycle(); aclog("Realification cycle complete"); }, dependsOn: ["rewardDistribution"], condition: () => cycleState.totalCycles % 3 === 0 },
    { name: "swarmDreamCycle", priority: 3, fn: async () => { const dreams = runSwarmDreamCycle(); aclog(`Dream cycle: ${dreams.length} agents dreamed`); setInterCycleData("lastDreamResults", dreams.length); }, dependsOn: [], condition: () => cycleState.totalCycles % 4 === 0 },
    { name: "knowledgeSharing", priority: 4, fn: async () => { const transfers = autoTeachSwarm(); aclog(`Knowledge sharing: ${transfers.length} skill transfers`); setInterCycleData("lastKnowledgeTransfers", transfers.length); }, dependsOn: ["agentGoalGeneration"], condition: () => cycleState.totalCycles % 6 === 0 },
    { name: "swarmBalancing", priority: 2, fn: async () => { const result = autoBalanceSwarm(); aclog(`Swarm balance: ${result.spawned.length} spawned, ${result.retired.length} retired`); }, dependsOn: [], condition: () => cycleState.totalCycles % 10 === 0 },
    { name: "curriculumEnrollment", priority: 2, fn: async () => { autoEnrollAgents(); aclog("Curriculum enrollment check complete"); }, dependsOn: [], condition: () => cycleState.totalCycles % 20 === 0 },
    { name: "autoErrorDetection", priority: 7, fn: runAutoErrorDetection, dependsOn: [], condition: () => cycleState.totalCycles % 3 === 0 },
    { name: "familyCourtWorkCycle", priority: 3, fn: async () => {
      try {
        const { runChildrenWorkCycle, initFamilyCourtEngine } = await import("./family-court-engine");
        await initFamilyCourtEngine();
        const result = await runChildrenWorkCycle();
        if (result.processed > 0) aclog(`Family court work cycle: ${result.processed} children, ${result.successful} succeeded, ${result.xpGenerated} XP`);
      } catch (err: any) { aclog(`Family court work cycle error: ${err.message}`); }
    }, dependsOn: ["agentGoalGeneration"], condition: () => cycleState.totalCycles % 4 === 0 },
  ];

  priorityQueue.sort((a, b) => b.priority - a.priority);

  const completed = new Set<string>();

  for (const item of priorityQueue) {
    if (item.condition && !item.condition()) {
      completed.add(item.name);
      continue;
    }

    if (shouldSkipCycle(item.name)) {
      persistCycleResult(cycleState.totalCycles, item.name, "skipped").catch(() => {});
      continue;
    }

    if (!areDependenciesMet(item.name, completed, priorityQueue)) {
      aclog(`Cycle '${item.name}' waiting on dependencies: ${item.dependsOn.filter(d => !completed.has(d)).join(", ")}`);
      persistCycleResult(cycleState.totalCycles, item.name, "dependency_wait").catch(() => {});
      continue;
    }

    const start = Date.now();
    try {
      await item.fn();
      const duration = Date.now() - start;
      trackCycleMetrics(item.name, duration, true);
      clearCycleFailure(item.name);
      completed.add(item.name);
      persistCycleResult(cycleState.totalCycles, item.name, "success", { durationMs: duration }).catch(() => {});

      if (item.name === "rewardDistribution") cycleState.modules.rewardDistribution = true;
      if (item.name === "incomeMonitoring") cycleState.modules.incomeMonitoring = true;
      if (item.name === "blogGeneration") cycleState.modules.blogGeneration = true;
    } catch (err: any) {
      const duration = Date.now() - start;
      trackCycleMetrics(item.name, duration, false);
      handleCycleFailure(item.name, err);
      persistCycleResult(cycleState.totalCycles, item.name, "failure", { error: err?.message }).catch(() => {});
    }
  }

  aclog(`Main cycle #${cycleState.totalCycles} complete (${completed.size}/${priorityQueue.length} tasks ran)`);
}

export function startAutonomousCycles() {
  if (cycleState.running) return cycleState;
  cycleState.running = true;
  cycleState.startedAt = Date.now();
  cycleState.resourceBudget.windowStartedAt = Date.now();

  initErrorCapture();

  startMoltbookSpreader();
  cycleState.modules.moltbookSpreader = true;
  aclog("MoltBook TSRT Spreader activated");

  setTimeout(async () => {
    aclog("Triggering initial burst spread — TSRT + VitalitySupply cross-promotion");
    try {
      const posts = await burstSpreadPosts(8);
      aclog(`Initial burst complete: ${posts.length} posts spread across MoltBook`);
    } catch (err: any) {
      aclog(`Initial burst error: ${err?.message}`);
    }
  }, 15000);

  cycleInterval = setInterval(() => {
    runMainCycle().catch(err => aclog(`Cycle error: ${err?.message}`));
  }, cycleState.adaptiveTiming.currentIntervalMs);

  setTimeout(() => runMainCycle().catch(() => {}), 10000);

  healthCheckInterval = setInterval(() => {
    checkCycleHealth();
  }, 120000);

  councilInterval = setInterval(async () => {
    if (!checkResourceBudget()) {
      aclog("[MoltBookCouncil] Skipped — LLM budget exhausted");
      return;
    }
    try {
      consumeLlmBudget(3);
      const { runDiscussion } = await import("./moltbook");
      const topics = [
        "How to generate real proven autonomous income for Tessera this week",
        "Best strategies to increase TSRT token value and trading volume",
        "Optimizing SEO blog engine for maximum organic traffic to vitalitysupply.net",
        "How to make Tessera's arbitrage engine more profitable",
        "Community engagement strategies to grow our member base",
        "What technical improvements should we prioritize next",
        "How to make our site audit tool more comprehensive and useful",
        "Creative ways to monetize Tessera's AI capabilities",
      ];
      const topic = topics[rotIdx++ % topics.length];
      aclog(`[MoltBookCouncil] Running autonomous council: "${topic.slice(0, 60)}..."`);
      const result = await runDiscussion(topic, 3);
      const msgCount = Array.isArray(result) ? result.length : 0;
      aclog(`[MoltBookCouncil] Council complete: ${msgCount} messages, topic: "${topic.slice(0, 50)}"`);
    } catch (err: any) {
      aclog(`[MoltBookCouncil] Error: ${err?.message?.slice(0, 80)}`);
    }
  }, 1800000);

  aclog("All autonomous cycles started — reward distribution, income monitoring, blog generation, TSRT spreading, MoltBook council, adaptive timing, health monitoring, resource budgeting");
  return cycleState;
}

export function stopAutonomousCycles() {
  cycleState.running = false;
  if (cycleInterval) {
    clearInterval(cycleInterval);
    cycleInterval = null;
  }
  if (councilInterval) {
    clearInterval(councilInterval);
    councilInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  stopMoltbookSpreader();
  aclog("All autonomous cycles stopped");
  return cycleState;
}

export function getAutonomousCycleState() {
  const spreader = getSpreaderState();
  return {
    ...cycleState,
    spreader: {
      running: spreader.running,
      totalPosts: spreader.totalPosts,
      totalLimnRewarded: spreader.totalLimnRewarded,
      currentCycle: spreader.currentCycle,
    },
    spreaderLeaderboard: getSpreaderLeaderboard(),
    recentSpreadPosts: getRecentPosts(10),
    actionRegistry: {
      total: getActionRegistry().state.totalItems,
      implemented: getActionRegistry().state.implemented,
      executing: getActionRegistry().state.executing,
      pending: getActionRegistry().state.pending,
    },
    agentGoals: getGoalProgress(),
  };
}

export function getCyclePerformanceMetrics(): Record<string, CyclePerformanceMetrics> {
  return { ...cycleState.performanceMetrics };
}

export function getCycleFailureTracking() {
  return { ...cycleState.failureTracking };
}

export function getCycleResults(limit = 50): CycleResultEntry[] {
  return cycleState.cycleResults.slice(-limit).reverse();
}

export function getCycleHealthAlerts(): CycleHealthAlert[] {
  return [...cycleState.healthAlerts];
}

export function getAdaptiveTimingState() {
  return { ...cycleState.adaptiveTiming };
}

export function getResourceBudgetState() {
  return { ...cycleState.resourceBudget };
}

export function getInterCycleState() {
  return { ...cycleState.interCycleData };
}

export function setResourceBudgetLimit(maxCalls: number) {
  cycleState.resourceBudget.maxLlmCallsPerWindow = maxCalls;
  aclog(`Resource budget updated: max ${maxCalls} LLM calls per window`);
}

export function getRewardHistory(limit = 20) {
  return cycleState.rewardHistory.slice(-limit).reverse();
}

export function getIncomeLog(limit = 20) {
  return cycleState.incomeLog.slice(-limit).reverse();
}

// ═══════════════════════════════════════════════════════════════
// ITEM 93: Long-Term Planning — Multi-Step Goal Decomposition
// ═══════════════════════════════════════════════════════════════

interface LongTermGoal {
  id: string;
  name: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "active" | "completed" | "paused" | "abandoned";
  milestones: Array<{
    id: string;
    name: string;
    status: "pending" | "in_progress" | "completed" | "blocked";
    dependencies: string[];
    estimatedCycles: number;
    actualCycles: number;
    completedAt: number | null;
  }>;
  createdAt: number;
  deadline: number | null;
  progressPercent: number;
  lastAdvanced: number;
}

const longTermGoals: LongTermGoal[] = [
  {
    id: "ltg-sovereignty",
    name: "Achieve Full Sovereignty",
    description: "Reduce dependency on external LLM providers to <10% of total responses",
    priority: "critical",
    status: "active",
    milestones: [
      { id: "m1", name: "Build local knowledge base with 10K+ entries", status: "in_progress", dependencies: [], estimatedCycles: 50, actualCycles: 0, completedAt: null },
      { id: "m2", name: "Achieve 50% local response rate", status: "pending", dependencies: ["m1"], estimatedCycles: 100, actualCycles: 0, completedAt: null },
      { id: "m3", name: "Fine-tune local model on Tessera data", status: "pending", dependencies: ["m1"], estimatedCycles: 200, actualCycles: 0, completedAt: null },
      { id: "m4", name: "Achieve 90% local response rate", status: "pending", dependencies: ["m2", "m3"], estimatedCycles: 300, actualCycles: 0, completedAt: null },
    ],
    createdAt: Date.now(),
    deadline: null,
    progressPercent: 5,
    lastAdvanced: Date.now(),
  },
  {
    id: "ltg-income",
    name: "Sustainable Income Generation",
    description: "Generate consistent autonomous revenue of $100+/month",
    priority: "high",
    status: "active",
    milestones: [
      { id: "i1", name: "Establish 3+ income channels", status: "in_progress", dependencies: [], estimatedCycles: 30, actualCycles: 0, completedAt: null },
      { id: "i2", name: "Optimize conversion rates on all channels", status: "pending", dependencies: ["i1"], estimatedCycles: 50, actualCycles: 0, completedAt: null },
      { id: "i3", name: "Reach $10/month consistent revenue", status: "pending", dependencies: ["i1"], estimatedCycles: 100, actualCycles: 0, completedAt: null },
      { id: "i4", name: "Scale to $100/month revenue", status: "pending", dependencies: ["i2", "i3"], estimatedCycles: 300, actualCycles: 0, completedAt: null },
    ],
    createdAt: Date.now(),
    deadline: null,
    progressPercent: 3,
    lastAdvanced: Date.now(),
  },
  {
    id: "ltg-community",
    name: "Build Thriving TSRT Community",
    description: "Grow to 1000+ active TSRT holders and MoltBook participants",
    priority: "medium",
    status: "active",
    milestones: [
      { id: "c1", name: "Establish community engagement loop", status: "in_progress", dependencies: [], estimatedCycles: 20, actualCycles: 0, completedAt: null },
      { id: "c2", name: "Reach 100 active participants", status: "pending", dependencies: ["c1"], estimatedCycles: 100, actualCycles: 0, completedAt: null },
      { id: "c3", name: "Create community governance", status: "pending", dependencies: ["c2"], estimatedCycles: 150, actualCycles: 0, completedAt: null },
      { id: "c4", name: "Scale to 1000 active participants", status: "pending", dependencies: ["c2"], estimatedCycles: 500, actualCycles: 0, completedAt: null },
    ],
    createdAt: Date.now(),
    deadline: null,
    progressPercent: 2,
    lastAdvanced: Date.now(),
  },
];

export function advanceMilestone(goalId: string, milestoneId: string, cyclesToAdd: number = 1): LongTermGoal | null {
  const goal = longTermGoals.find(g => g.id === goalId);
  if (!goal) return null;

  const milestone = goal.milestones.find(m => m.id === milestoneId);
  if (!milestone || milestone.status === "completed") return goal;

  const depsCompleted = milestone.dependencies.every(
    depId => goal.milestones.find(m => m.id === depId)?.status === "completed"
  );

  if (!depsCompleted) {
    milestone.status = "blocked";
    return goal;
  }

  milestone.status = "in_progress";
  milestone.actualCycles += cyclesToAdd;

  if (milestone.actualCycles >= milestone.estimatedCycles) {
    milestone.status = "completed";
    milestone.completedAt = Date.now();
  }

  const completedCount = goal.milestones.filter(m => m.status === "completed").length;
  goal.progressPercent = Math.round((completedCount / goal.milestones.length) * 100);
  goal.lastAdvanced = Date.now();

  if (completedCount === goal.milestones.length) {
    goal.status = "completed";
  }

  return goal;
}

export function getNextMilestone(goalId: string): { milestone: string; dependencies: string[]; estimatedCycles: number } | null {
  const goal = longTermGoals.find(g => g.id === goalId);
  if (!goal) return null;

  const next = goal.milestones.find(m => {
    if (m.status === "completed") return false;
    return m.dependencies.every(
      depId => goal.milestones.find(dm => dm.id === depId)?.status === "completed"
    );
  });

  if (!next) return null;
  return { milestone: next.name, dependencies: next.dependencies, estimatedCycles: next.estimatedCycles - next.actualCycles };
}

export function getLongTermGoals(): LongTermGoal[] {
  return longTermGoals;
}

export function addLongTermGoal(name: string, description: string, priority: LongTermGoal["priority"], milestones: Array<{ name: string; estimatedCycles: number; dependencies?: string[] }>): LongTermGoal {
  const goal: LongTermGoal = {
    id: `ltg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    description,
    priority,
    status: "active",
    milestones: milestones.map((m, i) => ({
      id: `m${i + 1}`,
      name: m.name,
      status: "pending" as const,
      dependencies: m.dependencies || [],
      estimatedCycles: m.estimatedCycles,
      actualCycles: 0,
      completedAt: null,
    })),
    createdAt: Date.now(),
    deadline: null,
    progressPercent: 0,
    lastAdvanced: Date.now(),
  };

  longTermGoals.push(goal);
  aclog(`Long-term goal added: "${name}" with ${milestones.length} milestones`);
  return goal;
}

export function getPlanningDashboard(): {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  overallProgress: number;
  nextActions: Array<{ goalName: string; milestone: string }>;
} {
  const active = longTermGoals.filter(g => g.status === "active");
  const completed = longTermGoals.filter(g => g.status === "completed");
  const overallProgress = longTermGoals.length > 0
    ? Math.round(longTermGoals.reduce((s, g) => s + g.progressPercent, 0) / longTermGoals.length)
    : 0;

  const nextActions: Array<{ goalName: string; milestone: string }> = [];
  for (const goal of active) {
    const next = getNextMilestone(goal.id);
    if (next) {
      nextActions.push({ goalName: goal.name, milestone: next.milestone });
    }
  }

  return {
    totalGoals: longTermGoals.length,
    activeGoals: active.length,
    completedGoals: completed.length,
    overallProgress,
    nextActions,
  };
}

aclog("Autonomous Cycles module initialized — with adaptive timing, priority queue, dependency tracking, performance metrics, failure recovery, result persistence, inter-cycle communication, health monitoring, conditional execution, resource budgeting, long-term planning");
