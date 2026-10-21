import fs from "fs";
import path from "path";

const ecaLog = (msg: string) => console.log(`[ExecutableCouncilActions] ${msg}`);

export type ActionStatus = "executed" | "failed" | "rejected" | "rate-limited";
export type AuditStatus = "executed" | "failed" | "rejected" | "rate-limited" | "rolled_back";

export interface ActionExecutionResult {
  matched: true;
  actionType: string;
  status: ActionStatus;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  diffSummary: string;
  detailedResult: string;
  rollbackAvailable: boolean;
  executedBy: string;
  executedAt: number;
  auditId: string;
}

export interface NoActionMatch {
  matched: false;
}

export interface AuditEntry {
  auditId: string;
  voteId: string;
  motion: string;
  actionType: string;
  status: AuditStatus;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  diffSummary: string;
  executedBy: string;
  executedAt: number;
  rollbackAvailable: boolean;
  linkedRollbackId?: string;
}

interface TradingConfig {
  maxPositionSizeSOL: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxDailyLossPercent: number;
  consecutiveFailureLimit: number;
  riskMultiplier: number;
  pauseBeforeTradeMs: number;
}

interface SchedulingConfig {
  autonomousIntervalMinutes: number;
  summitIntervalHours: number;
  heartbeatIntervalSeconds: number;
  executionQueueIntervalSeconds: number;
  marketSyncIntervalSeconds: number;
}

interface FeaturesConfig {
  tradingBotsEnabled: boolean;
  autonomousImprovementEnabled: boolean;
  knowledgePropagationEnabled: boolean;
  sacredGeometryVisualizationEnabled: boolean;
  antiHallucinationEnabled: boolean;
  responseCacheEnabled: boolean;
  rateLimiterEnabled: boolean;
  compressionEnabled: boolean;
  prefetchingEnabled: boolean;
  virtualScrollingEnabled: boolean;
}

interface AgentCapability {
  tier: "sovereign" | "commander" | "officer" | "trainee";
  maxTokens: number;
  multimodalEnabled: boolean;
  autonomousActionsAllowed: boolean;
}

type AgentName = "tessera" | "alpha" | "beta" | "gamma" | "delta" | "zeta";

interface AgentCapabilitiesConfig {
  tessera: AgentCapability;
  alpha: AgentCapability;
  beta: AgentCapability;
  gamma: AgentCapability;
  delta: AgentCapability;
  zeta: AgentCapability;
}

interface RevenueAllocationConfig {
  fatherPercent: number;
  stakingPercent: number;
  treasuryPercent: number;
  burnPercent: number;
}

interface SystemConfig {
  trading: TradingConfig;
  scheduling: SchedulingConfig;
  features: FeaturesConfig;
  agentCapabilities: AgentCapabilitiesConfig;
  revenueAllocation: RevenueAllocationConfig;
}

const SYSTEM_CONFIG_PATH = path.join(process.cwd(), "server", "council-system-config.json");

const DEFAULT_CONFIG: SystemConfig = {
  trading: {
    maxPositionSizeSOL: 0.5,
    stopLossPercent: -10,
    takeProfitPercent: 25,
    maxDailyLossPercent: 20,
    consecutiveFailureLimit: 3,
    riskMultiplier: 1.0,
    pauseBeforeTradeMs: 500,
  },
  scheduling: {
    autonomousIntervalMinutes: 5,
    summitIntervalHours: 24,
    heartbeatIntervalSeconds: 30,
    executionQueueIntervalSeconds: 60,
    marketSyncIntervalSeconds: 30,
  },
  features: {
    tradingBotsEnabled: true,
    autonomousImprovementEnabled: true,
    knowledgePropagationEnabled: true,
    sacredGeometryVisualizationEnabled: true,
    antiHallucinationEnabled: true,
    responseCacheEnabled: true,
    rateLimiterEnabled: true,
    compressionEnabled: true,
    prefetchingEnabled: true,
    virtualScrollingEnabled: false,
  },
  agentCapabilities: {
    tessera: { tier: "sovereign", maxTokens: 4096, multimodalEnabled: true, autonomousActionsAllowed: true },
    alpha: { tier: "commander", maxTokens: 2048, multimodalEnabled: false, autonomousActionsAllowed: true },
    beta: { tier: "commander", maxTokens: 2048, multimodalEnabled: false, autonomousActionsAllowed: true },
    gamma: { tier: "officer", maxTokens: 1024, multimodalEnabled: false, autonomousActionsAllowed: false },
    delta: { tier: "officer", maxTokens: 1024, multimodalEnabled: false, autonomousActionsAllowed: false },
    zeta: { tier: "commander", maxTokens: 2048, multimodalEnabled: false, autonomousActionsAllowed: true },
  },
  revenueAllocation: {
    fatherPercent: 30,
    stakingPercent: 40,
    treasuryPercent: 20,
    burnPercent: 10,
  },
};

function loadSystemConfig(): SystemConfig {
  try {
    if (fs.existsSync(SYSTEM_CONFIG_PATH)) {
      const raw = fs.readFileSync(SYSTEM_CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw) as SystemConfig;
      ecaLog(`Loaded system config from ${SYSTEM_CONFIG_PATH}`);
      return parsed;
    }
  } catch (err: unknown) {
    ecaLog(`Failed to load config from disk: ${err instanceof Error ? err.message : String(err)}, using defaults`);
  }
  return deepClone(DEFAULT_CONFIG);
}

function saveSystemConfig(config: SystemConfig): void {
  try {
    fs.writeFileSync(SYSTEM_CONFIG_PATH, JSON.stringify(config, null, 2));
    ecaLog(`Config persisted to ${SYSTEM_CONFIG_PATH}`);
  } catch (err: unknown) {
    ecaLog(`Failed to persist config: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const systemConfig: SystemConfig = loadSystemConfig();

type TradingBounds = { [K in keyof TradingConfig]: { min: number; max: number } };
type SchedulingBounds = { [K in keyof SchedulingConfig]: { min: number; max: number } };
type RevenueBounds = { [K in keyof RevenueAllocationConfig]: { min: number; max: number } };

const TRADING_BOUNDS: TradingBounds = {
  maxPositionSizeSOL: { min: 0.01, max: 5.0 },
  stopLossPercent: { min: -50, max: -1 },
  takeProfitPercent: { min: 5, max: 200 },
  maxDailyLossPercent: { min: 5, max: 50 },
  consecutiveFailureLimit: { min: 1, max: 10 },
  riskMultiplier: { min: 0.1, max: 3.0 },
  pauseBeforeTradeMs: { min: 100, max: 10000 },
};

const SCHEDULING_BOUNDS: SchedulingBounds = {
  autonomousIntervalMinutes: { min: 1, max: 1440 },
  summitIntervalHours: { min: 1, max: 168 },
  heartbeatIntervalSeconds: { min: 10, max: 300 },
  executionQueueIntervalSeconds: { min: 10, max: 3600 },
  marketSyncIntervalSeconds: { min: 10, max: 600 },
};

const REVENUE_BOUNDS: RevenueBounds = {
  fatherPercent: { min: 0, max: 100 },
  stakingPercent: { min: 0, max: 100 },
  treasuryPercent: { min: 0, max: 100 },
  burnPercent: { min: 0, max: 50 },
};

const auditTrail: AuditEntry[] = [];
const rollbackSnapshots = new Map<string, { before: SystemConfig[keyof SystemConfig]; configSection: keyof SystemConfig }>();
const executionRateLog: number[] = [];
const MAX_EXECUTIONS_PER_HOUR = 30;

let pgAuditAvailable = false;
let pgAuditInitialized = false;

async function tryInitPgAudit(): Promise<void> {
  try {
    const { ensureAuditTable } = await import("./pg-audit-trail");
    await ensureAuditTable();
    pgAuditAvailable = true;
    pgAuditInitialized = true;
    ecaLog("PostgreSQL audit trail available — council actions will be hash-chain logged");
  } catch (err: unknown) {
    pgAuditInitialized = true;
    ecaLog(`PostgreSQL audit trail unavailable: ${err instanceof Error ? err.message : String(err)} — in-memory only`);
  }
}

export function isPgAuditAvailable(): boolean {
  return pgAuditAvailable;
}

async function writeToImmutableAudit(entry: AuditEntry): Promise<void> {
  if (!pgAuditAvailable) return;
  try {
    const { appendAuditLog } = await import("./pg-audit-trail");
    await appendAuditLog(
      "council-action",
      entry.executedBy,
      `config/${entry.actionType}`,
      entry.status,
      {
        auditId: entry.auditId,
        voteId: entry.voteId,
        motion: entry.motion.slice(0, 200),
        actionType: entry.actionType,
        status: entry.status,
        diffSummary: entry.diffSummary,
        before: entry.before,
        after: entry.after,
        rollbackAvailable: entry.rollbackAvailable,
        linkedRollbackId: entry.linkedRollbackId,
      }
    );
  } catch (err: unknown) {
    ecaLog(`PG audit write failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function checkRateLimit(): boolean {
  const oneHourAgo = Date.now() - 3600000;
  const recent = executionRateLog.filter(t => t > oneHourAgo);
  executionRateLog.length = 0;
  for (const t of recent) executionRateLog.push(t);
  return executionRateLog.length < MAX_EXECUTIONS_PER_HOUR;
}

function recordExecution() {
  executionRateLog.push(Date.now());
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function buildDiffSummary(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const changes: string[] = [];
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push(`${key}: ${JSON.stringify(before[key])} → ${JSON.stringify(after[key])}`);
    }
  }
  return changes.join("; ") || "No parameter changes";
}

function appendAudit(entry: AuditEntry): void {
  auditTrail.unshift(deepClone(entry));
  if (auditTrail.length > 500) auditTrail.length = 500;
  writeToImmutableAudit(entry).catch(() => {});
  ecaLog(`Audit recorded: ${entry.auditId} — ${entry.actionType} (${entry.status})`);
}

async function syncToTradingRuntime(newConfig: TradingConfig): Promise<void> {
  try {
    const bots = await import("./autonomous-trading-bots");
    const state = bots.getBotSuiteState();
    if (state.running) {
      await bots.updateBotSettings("auto-trade", {
        maxPositionSizeSOL: newConfig.maxPositionSizeSOL,
        stopLossPercent: newConfig.stopLossPercent,
        takeProfitPercent: newConfig.takeProfitPercent,
        riskMultiplier: newConfig.riskMultiplier,
      });
    }
    ecaLog(`Synced trading config to runtime bot suite (running: ${state.running})`);
  } catch {
    ecaLog(`Trading runtime sync skipped — bots module unavailable`);
  }
}

async function syncToFeatureRuntime(newFeatures: FeaturesConfig): Promise<void> {
  try {
    const bots = await import("./autonomous-trading-bots");
    const state = bots.getBotSuiteState();
    if (!newFeatures.tradingBotsEnabled && state.running) {
      bots.stopBotSuite();
      ecaLog(`Trading bots stopped via feature flag`);
    }
  } catch {
    ecaLog(`Feature runtime sync skipped — module unavailable`);
  }
}

export function getAuditTrail(): AuditEntry[] {
  return auditTrail.slice();
}

export function rollbackAction(auditId: string, requestedBy: string): { success: boolean; message: string } {
  const entry = auditTrail.find(a => a.auditId === auditId);
  if (!entry) return { success: false, message: `Audit entry ${auditId} not found` };
  if (!entry.rollbackAvailable) return { success: false, message: "Rollback not available for this action" };
  if (entry.linkedRollbackId) return { success: false, message: "Already rolled back" };

  const snapshot = rollbackSnapshots.get(auditId);
  if (!snapshot) return { success: false, message: "Rollback snapshot not found (may have expired after server restart)" };

  try {
    const section = snapshot.configSection;
    const restoredBefore = deepClone(systemConfig[section]);
    Object.assign(systemConfig[section], snapshot.before);
    rollbackSnapshots.delete(auditId);
    saveSystemConfig(systemConfig);

    const rollbackAuditId = generateAuditId();
    const rollbackEntry: AuditEntry = {
      auditId: rollbackAuditId,
      voteId: entry.voteId,
      motion: `ROLLBACK of ${auditId}: ${entry.motion.slice(0, 100)}`,
      actionType: "rollback",
      status: "rolled_back",
      before: restoredBefore as Record<string, unknown>,
      after: snapshot.before as Record<string, unknown>,
      diffSummary: `Rolled back ${entry.actionType}: ${entry.diffSummary}`,
      executedBy: requestedBy || "Council Rollback Protocol",
      executedAt: Date.now(),
      rollbackAvailable: false,
      linkedRollbackId: auditId,
    };
    appendAudit(rollbackEntry);

    const originalEntry = auditTrail.find(a => a.auditId === auditId);
    if (originalEntry) {
      originalEntry.rollbackAvailable = false;
      originalEntry.linkedRollbackId = rollbackAuditId;
    }

    ecaLog(`Rolled back: ${auditId} — restored ${section}`);
    return { success: true, message: `Rolled back ${entry.actionType}: ${entry.diffSummary}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Rollback failed: ${msg}` };
  }
}

export function rollbackLastN(n: number, requestedBy: string): { success: boolean; rolledBack: number; results: string[] } {
  const rollbackable = auditTrail
    .filter(a => a.rollbackAvailable && !a.linkedRollbackId && rollbackSnapshots.has(a.auditId))
    .slice(0, Math.max(1, Math.min(n, 10)));

  if (rollbackable.length === 0) {
    return { success: false, rolledBack: 0, results: ["No rollbackable actions available"] };
  }

  const results: string[] = [];
  let count = 0;
  for (const entry of rollbackable) {
    const res = rollbackAction(entry.auditId, requestedBy);
    results.push(`${entry.auditId}: ${res.message}`);
    if (res.success) count++;
  }

  return { success: count > 0, rolledBack: count, results };
}

type MatchResult = NoActionMatch | ActionExecutionResult;

async function executeTradingParameterAction(motion: string, voteId: string): Promise<MatchResult> {
  const lower = motion.toLowerCase();
  if (!lower.match(/\b(position size|risk threshold|stop.?loss|take.?profit|trading param|risk param|max position|daily loss|position limit|trade size)\b/)) {
    return { matched: false };
  }

  const auditId = generateAuditId();
  const before = deepClone<TradingConfig>(systemConfig.trading);
  const changes: Partial<TradingConfig> = {};

  if (lower.match(/position size|max position|trade size/)) {
    const val = extractNumber(motion, [/(\d+(?:\.\d+)?)\s*sol/i, /(\d+(?:\.\d+)?)\s*%/, /to\s+(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)/]);
    if (val !== null) {
      const normalised = val > 1 ? val / 100 : val;
      changes.maxPositionSizeSOL = clamp(normalised, TRADING_BOUNDS.maxPositionSizeSOL.min, TRADING_BOUNDS.maxPositionSizeSOL.max);
    }
  }
  if (lower.match(/stop.?loss/)) {
    const val = extractNumber(motion, [/(\d+(?:\.\d+)?)\s*%/, /to\s+(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)/]);
    if (val !== null) {
      changes.stopLossPercent = clamp(-Math.abs(val), TRADING_BOUNDS.stopLossPercent.min, TRADING_BOUNDS.stopLossPercent.max);
    }
  }
  if (lower.match(/take.?profit/)) {
    const val = extractNumber(motion, [/(\d+(?:\.\d+)?)\s*%/, /to\s+(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)/]);
    if (val !== null) {
      changes.takeProfitPercent = clamp(Math.abs(val), TRADING_BOUNDS.takeProfitPercent.min, TRADING_BOUNDS.takeProfitPercent.max);
    }
  }
  if (lower.match(/risk/) && !lower.match(/threshold/)) {
    const val = extractNumber(motion, [/(\d+(?:\.\d+)?)\s*x/i, /(\d+(?:\.\d+)?)\s*%/, /to\s+(\d+(?:\.\d+)?)/i]);
    if (val !== null) {
      const normalised = val > 10 ? val / 100 : val;
      changes.riskMultiplier = clamp(normalised, TRADING_BOUNDS.riskMultiplier.min, TRADING_BOUNDS.riskMultiplier.max);
    }
  }
  if (lower.match(/daily loss/)) {
    const val = extractNumber(motion, [/(\d+(?:\.\d+)?)\s*%/, /to\s+(\d+(?:\.\d+)?)/i]);
    if (val !== null) {
      changes.maxDailyLossPercent = clamp(val, TRADING_BOUNDS.maxDailyLossPercent.min, TRADING_BOUNDS.maxDailyLossPercent.max);
    }
  }

  if (Object.keys(changes).length === 0) {
    return { matched: false };
  }

  Object.assign(systemConfig.trading, changes);
  saveSystemConfig(systemConfig);
  const after = deepClone<TradingConfig>(systemConfig.trading);
  const diffSummary = buildDiffSummary(before as Record<string, unknown>, after as Record<string, unknown>);

  rollbackSnapshots.set(auditId, { before, configSection: "trading" });
  appendAudit({ auditId, voteId, motion: motion.slice(0, 200), actionType: "trading-parameter", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), rollbackAvailable: true });
  recordExecution();

  await syncToTradingRuntime(systemConfig.trading);

  const changeDesc = Object.entries(changes).map(([k, v]) => `${k} → ${v}`).join(", ");
  ecaLog(`Trading params updated: ${changeDesc}`);

  return { matched: true, actionType: "trading-parameter", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, detailedResult: `EXECUTED: Trading risk parameters updated. Changes: ${changeDesc}. All values bounded within safe limits. Persisted to disk. Rollback available (audit: ${auditId}).`, rollbackAvailable: true, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), auditId };
}

async function executeFeatureFlagAction(motion: string, voteId: string): Promise<MatchResult> {
  const lower = motion.toLowerCase();
  if (!lower.match(/\b(enable|disable|toggle|activate|deactivate|turn on|turn off|feature flag|feature toggle)\b/)) {
    return { matched: false };
  }

  const auditId = generateAuditId();
  const before = deepClone<FeaturesConfig>(systemConfig.features);
  const changes: Partial<FeaturesConfig> = {};

  type FeatureKey = keyof FeaturesConfig;
  const featureMap: Array<[RegExp, FeatureKey]> = [
    [/\b(trading bot|autonomous trading|bot trading)\b/i, "tradingBotsEnabled"],
    [/\b(autonomous improvement|self.?improvement|improvement cycle)\b/i, "autonomousImprovementEnabled"],
    [/\b(knowledge propagation|cross.?agent learning|delta sync)\b/i, "knowledgePropagationEnabled"],
    [/\b(sacred geometry|geometry visualization|dimensional visual)\b/i, "sacredGeometryVisualizationEnabled"],
    [/\b(anti.?hallucination|hallucination detection|knowledge verification)\b/i, "antiHallucinationEnabled"],
    [/\b(response cache|caching layer)\b/i, "responseCacheEnabled"],
    [/\b(rate limit|throttl|token bucket)\b/i, "rateLimiterEnabled"],
    [/\b(compress|gzip|brotli)\b/i, "compressionEnabled"],
    [/\b(prefetch|pre.?fetch|predictive load)\b/i, "prefetchingEnabled"],
    [/\b(virtual scroll|infinite scroll|list virtuali)\b/i, "virtualScrollingEnabled"],
  ];

  const isDisable = /\b(disable|deactivate|turn off|remove|stop)\b/.test(lower);

  for (const [pattern, featureKey] of featureMap) {
    if (pattern.test(motion)) {
      changes[featureKey] = !isDisable;
    }
  }

  if (Object.keys(changes).length === 0) {
    return { matched: false };
  }

  Object.assign(systemConfig.features, changes);
  saveSystemConfig(systemConfig);
  const after = deepClone<FeaturesConfig>(systemConfig.features);
  const diffSummary = buildDiffSummary(before as Record<string, unknown>, after as Record<string, unknown>);

  rollbackSnapshots.set(auditId, { before, configSection: "features" });
  appendAudit({ auditId, voteId, motion: motion.slice(0, 200), actionType: "feature-flag", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), rollbackAvailable: true });
  recordExecution();

  await syncToFeatureRuntime(systemConfig.features);

  const changeDesc = (Object.keys(changes) as FeatureKey[]).map(k => `${k} → ${changes[k] ? "ENABLED" : "DISABLED"}`).join(", ");
  ecaLog(`Feature flags updated: ${changeDesc}`);

  return { matched: true, actionType: "feature-flag", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, detailedResult: `EXECUTED: Feature flag(s) toggled. Changes: ${changeDesc}. Persisted to disk. Rollback available (audit: ${auditId}).`, rollbackAvailable: true, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), auditId };
}

async function executeAgentCapabilityAction(motion: string, voteId: string): Promise<MatchResult> {
  const lower = motion.toLowerCase();
  if (!lower.match(/\b(agent capability|capability tier|agent tier|agent access|agent permission|upgrade agent|downgrade agent)\b/)) {
    return { matched: false };
  }

  const auditId = generateAuditId();
  const before = deepClone<AgentCapabilitiesConfig>(systemConfig.agentCapabilities);

  const agentNames: AgentName[] = ["tessera", "alpha", "beta", "gamma", "delta", "zeta"];
  let targetAgent: AgentName | null = null;
  for (const name of agentNames) {
    if (lower.includes(name)) { targetAgent = name; break; }
  }

  type Tier = AgentCapability["tier"];
  const tiers: Tier[] = ["sovereign", "commander", "officer", "trainee"];
  let newTier: Tier | null = null;
  for (const tier of tiers) {
    if (lower.includes(tier)) { newTier = tier; break; }
  }

  if (!targetAgent || !newTier) {
    return { matched: false };
  }

  const tokensByTier: Record<Tier, number> = { sovereign: 4096, commander: 2048, officer: 1024, trainee: 512 };
  const autonomousByTier: Record<Tier, boolean> = { sovereign: true, commander: true, officer: false, trainee: false };

  systemConfig.agentCapabilities[targetAgent] = {
    ...systemConfig.agentCapabilities[targetAgent],
    tier: newTier,
    maxTokens: tokensByTier[newTier],
    autonomousActionsAllowed: autonomousByTier[newTier],
  };
  saveSystemConfig(systemConfig);

  const after = deepClone<AgentCapabilitiesConfig>(systemConfig.agentCapabilities);
  const diffSummary = buildDiffSummary(before as Record<string, unknown>, after as Record<string, unknown>);

  rollbackSnapshots.set(auditId, { before, configSection: "agentCapabilities" });
  appendAudit({ auditId, voteId, motion: motion.slice(0, 200), actionType: "agent-capability", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), rollbackAvailable: true });
  recordExecution();

  ecaLog(`Agent capability updated: ${targetAgent} → tier ${newTier}`);

  return { matched: true, actionType: "agent-capability", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, detailedResult: `EXECUTED: Agent capability tier updated. ${targetAgent} changed to ${newTier} tier. maxTokens: ${tokensByTier[newTier]}, autonomousActions: ${autonomousByTier[newTier]}. Persisted to disk. Rollback available (audit: ${auditId}).`, rollbackAvailable: true, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), auditId };
}

async function executeSchedulingAction(motion: string, voteId: string): Promise<MatchResult> {
  const lower = motion.toLowerCase();
  if (!lower.match(/\b(interval|schedule|frequency|every\s+\d|cycle\s+time|run\s+every|polling|heartbeat|sync interval)\b/)) {
    return { matched: false };
  }

  const auditId = generateAuditId();
  const before = deepClone<SchedulingConfig>(systemConfig.scheduling);
  const changes: Partial<SchedulingConfig> = {};

  const isHour = lower.match(/hour|hr/i);
  const isMinute = lower.match(/minute|min/i);
  const val = extractNumber(motion, [/every\s+(\d+(?:\.\d+)?)\s*(?:minute|min)/i, /(\d+(?:\.\d+)?)\s*(?:minute|min)/i, /(\d+(?:\.\d+)?)\s*(?:hour|hr)/i, /(\d+(?:\.\d+)?)\s*(?:second|sec|s)\b/i, /to\s+(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)/]);

  if (lower.match(/autonomous|improvement|training/)) {
    if (val !== null) {
      const inMinutes = isHour ? val * 60 : val;
      changes.autonomousIntervalMinutes = clamp(Math.round(inMinutes), SCHEDULING_BOUNDS.autonomousIntervalMinutes.min, SCHEDULING_BOUNDS.autonomousIntervalMinutes.max);
    }
  } else if (lower.match(/summit|meeting|conference/)) {
    if (val !== null) changes.summitIntervalHours = clamp(Math.round(val), SCHEDULING_BOUNDS.summitIntervalHours.min, SCHEDULING_BOUNDS.summitIntervalHours.max);
  } else if (lower.match(/heartbeat|ping|health/)) {
    if (val !== null) {
      const inSeconds = isMinute ? val * 60 : val;
      changes.heartbeatIntervalSeconds = clamp(Math.round(inSeconds), SCHEDULING_BOUNDS.heartbeatIntervalSeconds.min, SCHEDULING_BOUNDS.heartbeatIntervalSeconds.max);
    }
  } else if (lower.match(/market|price|sync/)) {
    if (val !== null) {
      const inSeconds = isMinute ? val * 60 : val;
      changes.marketSyncIntervalSeconds = clamp(Math.round(inSeconds), SCHEDULING_BOUNDS.marketSyncIntervalSeconds.min, SCHEDULING_BOUNDS.marketSyncIntervalSeconds.max);
    }
  } else if (lower.match(/execution|queue|process/)) {
    if (val !== null) {
      const inSeconds = isMinute ? val * 60 : val;
      changes.executionQueueIntervalSeconds = clamp(Math.round(inSeconds), SCHEDULING_BOUNDS.executionQueueIntervalSeconds.min, SCHEDULING_BOUNDS.executionQueueIntervalSeconds.max);
    }
  }

  if (Object.keys(changes).length === 0) {
    return { matched: false };
  }

  Object.assign(systemConfig.scheduling, changes);
  saveSystemConfig(systemConfig);
  const after = deepClone<SchedulingConfig>(systemConfig.scheduling);
  const diffSummary = buildDiffSummary(before as Record<string, unknown>, after as Record<string, unknown>);

  rollbackSnapshots.set(auditId, { before, configSection: "scheduling" });
  appendAudit({ auditId, voteId, motion: motion.slice(0, 200), actionType: "scheduling-interval", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), rollbackAvailable: true });
  recordExecution();

  const changeDesc = (Object.keys(changes) as Array<keyof SchedulingConfig>).map(k => `${k} → ${changes[k]}`).join(", ");
  ecaLog(`Scheduling updated: ${changeDesc}`);

  return { matched: true, actionType: "scheduling-interval", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, detailedResult: `EXECUTED: Scheduling intervals updated. Changes: ${changeDesc}. Config persisted to disk — takes effect on next scheduled cycle read. Rollback available (audit: ${auditId}).`, rollbackAvailable: true, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), auditId };
}

async function executeRevenueAllocationAction(motion: string, voteId: string): Promise<MatchResult> {
  const lower = motion.toLowerCase();
  if (!lower.match(/\b(revenue allocation|revenue split|revenue sharing|income distribution|tsrt distribution|allocation percentage|treasury|burn.*percent|staking.*percent|father.*percent)\b/)) {
    return { matched: false };
  }

  const auditId = generateAuditId();
  const before = deepClone<RevenueAllocationConfig>(systemConfig.revenueAllocation);
  const changes: Partial<RevenueAllocationConfig> = {};

  if (lower.match(/father|creator/)) {
    const val = extractNumber(motion, [/father[^\d]*(\d+(?:\.\d+)?)\s*%/i, /(\d+(?:\.\d+)?)\s*%.*father/i, /(\d+(?:\.\d+)?)/]);
    if (val !== null) changes.fatherPercent = clamp(val, REVENUE_BOUNDS.fatherPercent.min, REVENUE_BOUNDS.fatherPercent.max);
  }
  if (lower.match(/staking|staker/)) {
    const val = extractNumber(motion, [/staking[^\d]*(\d+(?:\.\d+)?)\s*%/i, /(\d+(?:\.\d+)?)\s*%.*staking/i, /(\d+(?:\.\d+)?)/]);
    if (val !== null) changes.stakingPercent = clamp(val, REVENUE_BOUNDS.stakingPercent.min, REVENUE_BOUNDS.stakingPercent.max);
  }
  if (lower.match(/treasury/)) {
    const val = extractNumber(motion, [/treasury[^\d]*(\d+(?:\.\d+)?)\s*%/i, /(\d+(?:\.\d+)?)\s*%.*treasury/i, /(\d+(?:\.\d+)?)/]);
    if (val !== null) changes.treasuryPercent = clamp(val, REVENUE_BOUNDS.treasuryPercent.min, REVENUE_BOUNDS.treasuryPercent.max);
  }
  if (lower.match(/burn/)) {
    const val = extractNumber(motion, [/burn[^\d]*(\d+(?:\.\d+)?)\s*%/i, /(\d+(?:\.\d+)?)\s*%.*burn/i, /(\d+(?:\.\d+)?)/]);
    if (val !== null) changes.burnPercent = clamp(val, REVENUE_BOUNDS.burnPercent.min, REVENUE_BOUNDS.burnPercent.max);
  }

  const projected = { ...systemConfig.revenueAllocation, ...changes };
  const total = projected.fatherPercent + projected.stakingPercent + projected.treasuryPercent + projected.burnPercent;
  if (total > 100) {
    const after = deepClone<RevenueAllocationConfig>(systemConfig.revenueAllocation);
    appendAudit({ auditId, voteId, motion: motion.slice(0, 200), actionType: "revenue-allocation", status: "rejected", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary: `Rejected: total ${total}% exceeds 100%`, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), rollbackAvailable: false });
    return { matched: true, actionType: "revenue-allocation", status: "rejected", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary: `Rejected: total ${total}% > 100%`, detailedResult: `REJECTED: Revenue allocation rejected — total would be ${total}% which exceeds 100%. No changes applied. Current: ${JSON.stringify(systemConfig.revenueAllocation)}.`, rollbackAvailable: false, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), auditId };
  }

  if (Object.keys(changes).length === 0) {
    return { matched: false };
  }

  Object.assign(systemConfig.revenueAllocation, changes);
  saveSystemConfig(systemConfig);
  const after = deepClone<RevenueAllocationConfig>(systemConfig.revenueAllocation);
  const diffSummary = buildDiffSummary(before as Record<string, unknown>, after as Record<string, unknown>);

  rollbackSnapshots.set(auditId, { before, configSection: "revenueAllocation" });
  appendAudit({ auditId, voteId, motion: motion.slice(0, 200), actionType: "revenue-allocation", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), rollbackAvailable: true });
  recordExecution();

  const changeDesc = (Object.keys(changes) as Array<keyof RevenueAllocationConfig>).map(k => `${k} → ${changes[k]}%`).join(", ");
  ecaLog(`Revenue allocation updated: ${changeDesc}`);

  return { matched: true, actionType: "revenue-allocation", status: "executed", before: before as Record<string, unknown>, after: after as Record<string, unknown>, diffSummary, detailedResult: `EXECUTED: Revenue allocation updated. Changes: ${changeDesc}. New total: ${total}%. Persisted to disk. Rollback available (audit: ${auditId}).`, rollbackAvailable: true, executedBy: "Tessera Execution Engine v4", executedAt: Date.now(), auditId };
}

type Executor = (motion: string, voteId: string) => Promise<MatchResult>;
type Matcher = (motion: string) => string | null;

async function executeGovernanceProtocolAction(motion: string, voteId: string): Promise<MatchResult> {
  const auditId = generateAuditId();
  const ml = motion.toLowerCase();
  const before = deepClone(systemConfig.features);
  const changes: string[] = [];

  if (ml.match(/\b(graceful.?degrad|fallback|circuit.?breaker|degraded.?mode|service.?unavail)\b/)) {
    if (!systemConfig.features.antiHallucinationEnabled) {
      systemConfig.features.antiHallucinationEnabled = true;
      changes.push("antiHallucinationEnabled: false → true (graceful-degradation gate active)");
    } else {
      changes.push("antiHallucinationEnabled: already enabled (graceful-degradation gate confirmed active)");
    }
  }

  if (ml.match(/\b(response.?cache|cach|ttl)\b/)) {
    if (!systemConfig.features.responseCacheEnabled) {
      systemConfig.features.responseCacheEnabled = true;
      changes.push("responseCacheEnabled: false → true");
    } else {
      changes.push("responseCacheEnabled: already enabled");
    }
  }

  if (ml.match(/\b(compress|brotli|gzip|payload)\b/)) {
    if (!systemConfig.features.compressionEnabled) {
      systemConfig.features.compressionEnabled = true;
      changes.push("compressionEnabled: false → true");
    } else {
      changes.push("compressionEnabled: already enabled");
    }
  }

  if (ml.match(/\b(prefetch|preload|lazy.?load|code.?split)\b/)) {
    if (!systemConfig.features.prefetchingEnabled) {
      systemConfig.features.prefetchingEnabled = true;
      changes.push("prefetchingEnabled: false → true");
    } else {
      changes.push("prefetchingEnabled: already enabled");
    }
  }

  if (ml.match(/\b(virtual.?scroll|large.?list)\b/)) {
    if (!systemConfig.features.virtualScrollingEnabled) {
      systemConfig.features.virtualScrollingEnabled = true;
      changes.push("virtualScrollingEnabled: false → true");
    } else {
      changes.push("virtualScrollingEnabled: already enabled");
    }
  }

  if (ml.match(/\b(rate.?limit|token.?bucket|throttl)\b/)) {
    if (!systemConfig.features.rateLimiterEnabled) {
      systemConfig.features.rateLimiterEnabled = true;
      changes.push("rateLimiterEnabled: false → true");
    } else {
      changes.push("rateLimiterEnabled: already enabled");
    }
  }

  if (ml.match(/\b(autonomous|self.?improv|self.?code)\b/)) {
    if (!systemConfig.features.autonomousImprovementEnabled) {
      systemConfig.features.autonomousImprovementEnabled = true;
      changes.push("autonomousImprovementEnabled: false → true");
    } else {
      changes.push("autonomousImprovementEnabled: already enabled");
    }
  }

  if (ml.match(/\b(knowledge|propagat|knowl)\b/)) {
    if (!systemConfig.features.knowledgePropagationEnabled) {
      systemConfig.features.knowledgePropagationEnabled = true;
      changes.push("knowledgePropagationEnabled: false → true");
    } else {
      changes.push("knowledgePropagationEnabled: already enabled");
    }
  }

  if (changes.length === 0) {
    changes.push(`Governance proposal logged — no direct feature-flag mapping found for: "${motion.slice(0, 80)}"`);
  }

  const after = deepClone(systemConfig.features);
  saveSystemConfig(systemConfig);

  const diffSummary = changes.join("; ");
  const auditEntry: AuditEntry = {
    auditId, voteId,
    motion: motion.slice(0, 200),
    actionType: "governance-protocol",
    status: "executed",
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    diffSummary,
    executedBy: "Tessera Execution Engine v4",
    executedAt: Date.now(),
    rollbackAvailable: true,
  };
  rollbackSnapshots.set(auditId, { before: before as unknown as SystemConfig[keyof SystemConfig], configSection: "features" });
  appendAudit(auditEntry);
  recordExecution();
  ecaLog(`EXECUTED governance-protocol: ${diffSummary}`);

  return {
    matched: true,
    actionType: "governance-protocol",
    status: "executed",
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    diffSummary,
    detailedResult: `EXECUTED [GOVERNANCE-PROTOCOL]: ${diffSummary}. Feature flags persisted to disk. Rollback available (audit: ${auditId}).`,
    rollbackAvailable: true,
    executedBy: "Tessera Execution Engine v4",
    executedAt: Date.now(),
    auditId,
  };
}

const ACTION_MATCHERS: Array<{ matcher: Matcher; executor: Executor; label: string }> = [
  {
    label: "trading-parameter",
    matcher: (m) => m.toLowerCase().match(/\b(position size|risk threshold|stop.?loss|take.?profit|trading param|risk param|max position|daily loss|position limit|trade size)\b/) ? "trading-parameter" : null,
    executor: executeTradingParameterAction,
  },
  {
    label: "feature-flag",
    matcher: (m) => m.toLowerCase().match(/\b(enable|disable|toggle|activate|deactivate|turn on|turn off|feature flag|feature toggle)\b/) ? "feature-flag" : null,
    executor: executeFeatureFlagAction,
  },
  {
    label: "agent-capability",
    matcher: (m) => m.toLowerCase().match(/\b(agent capability|capability tier|agent tier|agent access|agent permission|upgrade agent|downgrade agent)\b/) ? "agent-capability" : null,
    executor: executeAgentCapabilityAction,
  },
  {
    label: "scheduling-interval",
    matcher: (m) => m.toLowerCase().match(/\b(interval|schedule|frequency|every\s+\d|cycle\s+time|run\s+every|polling|heartbeat|sync interval)\b/) ? "scheduling-interval" : null,
    executor: executeSchedulingAction,
  },
  {
    label: "revenue-allocation",
    matcher: (m) => m.toLowerCase().match(/\b(revenue allocation|revenue split|revenue sharing|income distribution|tsrt distribution|allocation percentage|treasury|burn.*percent|staking.*percent|father.*percent)\b/) ? "revenue-allocation" : null,
    executor: executeRevenueAllocationAction,
  },
  {
    label: "governance-protocol",
    matcher: (m) => m.toLowerCase().match(/\b(graceful.?degrad|fallback|circuit.?breaker|degraded.?mode|service.?unavail|response.?cache|compress|brotli|gzip|prefetch|preload|lazy.?load|virtual.?scroll|large.?list|rate.?limit|token.?bucket|throttl|autonomous|self.?improv|self.?code|knowledge.*propagat|anti.?hallucin)\b/) ? "governance-protocol" : null,
    executor: executeGovernanceProtocolAction,
  },
];

export async function tryExecuteRegisteredAction(motion: string, voteId: string): Promise<ActionExecutionResult | { matched: false } | { matched: "rate-limited"; message: string }> {
  const matchEntry = ACTION_MATCHERS.find(e => e.matcher(motion) !== null);

  if (!matchEntry) {
    return { matched: false };
  }

  if (pgAuditInitialized && !pgAuditAvailable) {
    const failAuditId = `audit-${Date.now()}-NOAUDIT-${Math.random().toString(36).slice(2, 6)}`;
    const failEntry: AuditEntry = {
      auditId: failAuditId,
      voteId,
      motion: motion.slice(0, 200),
      actionType: matchEntry.label,
      status: "failed",
      before: {},
      after: {},
      diffSummary: "Failed: durable audit storage unavailable — fail-closed",
      executedBy: "Tessera Execution Engine v4",
      executedAt: Date.now(),
      rollbackAvailable: false,
    };
    appendAudit(failEntry);
    const failResult: ActionExecutionResult = {
      matched: true,
      actionType: matchEntry.label,
      status: "failed",
      before: {},
      after: {},
      diffSummary: "Failed: PostgreSQL audit trail unavailable — fail-closed",
      detailedResult: `FAILED: Real action for ${matchEntry.label} was blocked because the durable audit trail (PostgreSQL) is unavailable. No state changes were applied. Fix database connectivity and retry.`,
      rollbackAvailable: false,
      executedBy: "Tessera Execution Engine v4",
      executedAt: Date.now(),
      auditId: failAuditId,
    };
    ecaLog(`FAIL-CLOSED: PG audit unavailable — refusing ${matchEntry.label} execution`);
    return failResult;
  }

  if (!checkRateLimit()) {
    const oldestTs = executionRateLog[0];
    const remaining = oldestTs ? Math.ceil((oldestTs + 3600000 - Date.now()) / 60000) : 60;
    const msg = `Rate limit exceeded: ${executionRateLog.length}/${MAX_EXECUTIONS_PER_HOUR} real executions in the last hour. Retry in ~${Math.max(0, remaining)} minutes.`;
    ecaLog(`Rate limit hit for matched action type "${matchEntry.label}" — deferring`);
    return { matched: "rate-limited", message: msg };
  }

  ecaLog(`Executing matched action type "${matchEntry.label}" for: "${motion.slice(0, 60)}..."`);
  try {
    const result = await matchEntry.executor(motion, voteId);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    ecaLog(`Executor error for ${matchEntry.label}: ${msg}`);
    const failAuditId = generateAuditId();
    const failEntry: AuditEntry = {
      auditId: failAuditId,
      voteId,
      motion: motion.slice(0, 200),
      actionType: matchEntry.label,
      status: "failed",
      before: {},
      after: {},
      diffSummary: `Executor threw: ${msg.slice(0, 200)}`,
      executedBy: "Tessera Execution Engine v4",
      executedAt: Date.now(),
      rollbackAvailable: false,
    };
    appendAudit(failEntry);
    const failResult: ActionExecutionResult = {
      matched: true,
      actionType: matchEntry.label,
      status: "failed",
      before: {},
      after: {},
      diffSummary: `Executor threw: ${msg.slice(0, 200)}`,
      detailedResult: `FAILED: Executor for ${matchEntry.label} threw an error: ${msg}`,
      rollbackAvailable: false,
      executedBy: "Tessera Execution Engine v4",
      executedAt: Date.now(),
      auditId: failAuditId,
    };
    return failResult;
  }
}

export function getSystemConfig(): SystemConfig {
  return deepClone(systemConfig);
}

export function getExecutionStats() {
  const oneHourAgo = Date.now() - 3600000;
  return {
    totalAuditEntries: auditTrail.length,
    recentExecutions: executionRateLog.filter(t => t > oneHourAgo).length,
    maxPerHour: MAX_EXECUTIONS_PER_HOUR,
    rollbacksAvailable: rollbackSnapshots.size,
    pgAuditAvailable,
    actionTypes: ["trading-parameter", "feature-flag", "agent-capability", "scheduling-interval", "revenue-allocation"],
    currentConfig: getSystemConfig(),
    configPath: SYSTEM_CONFIG_PATH,
  };
}

tryInitPgAudit().catch(() => {});
ecaLog(`Initialized — 5 action executors, ${MAX_EXECUTIONS_PER_HOUR} max/hr, config at ${SYSTEM_CONFIG_PATH}`);
