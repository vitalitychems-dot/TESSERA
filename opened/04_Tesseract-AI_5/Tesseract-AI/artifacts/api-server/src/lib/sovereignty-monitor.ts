import { db } from "@workspace/db";
import { sovereignty_metrics } from "@workspace/db";
import { getValidationStatus } from "./sovereignty-validation-engine";
import { getModelSovereigntyStatus } from "./internal-model-sovereignty-engine";
import { getKnowledgeAbsorptionStatus } from "./knowledge-absorption-engine";
import { getSecurityEngineStatus } from "./security-threat-engine";
import { logger } from "./logger";
import { sql as drizzleSql } from "drizzle-orm";

const LOG_PREFIX = "[SovereigntyMonitor]";

let cachedEvaluationScore = 0;

async function refreshEvaluationScore(): Promise<void> {
  try {
    const result = await db.execute(drizzleSql`
      SELECT AVG(internal_score) as avg_internal, COUNT(*) as cnt
      FROM evaluation_results
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    type Row = { avg_internal: string | null; cnt: string | number };
    const row = ((result as { rows?: Row[] }).rows?.[0] ?? result as unknown as Row);
    if (row && Number(row.cnt) > 0) {
      cachedEvaluationScore = Math.round(Number(row.avg_internal ?? 0));
    }
  } catch {
    /* evaluation_results table may not exist yet during migrations; silently skip */
  }
}

interface TaskRecord {
  timestamp: number;
  taskType: string;
  handledInternally: boolean;
  providerId?: string;
  successRate: number;
  latencyMs: number;
}

interface SovereigntyConfig {
  internalRatioTarget: number;
  performanceGapThreshold: number;
  readinessThresholds: {
    internalRatio: number;
    validationScore: number;
    securityScore: number;
    knowledgeNodes: number;
  };
  disconnectPlan: {
    phase1: string[];
    phase2: string[];
    dryRunMode: boolean;
    hardDisconnectEnabled: boolean;
  };
}

const DEFAULT_CONFIG: SovereigntyConfig = {
  internalRatioTarget: 0.95,
  performanceGapThreshold: 20,
  readinessThresholds: {
    internalRatio: 0.80,
    validationScore: 70,
    securityScore: 60,
    knowledgeNodes: 100,
  },
  disconnectPlan: {
    phase1: ["puter-gpt4o"],
    phase2: ["replit-openai"],
    dryRunMode: true,
    hardDisconnectEnabled: false,
  },
};

let config: SovereigntyConfig = { ...DEFAULT_CONFIG };
const taskLog: TaskRecord[] = [];
let monitorCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;

export function recordTask(params: {
  taskType: string;
  handledInternally: boolean;
  providerId?: string;
  successRate?: number;
  latencyMs?: number;
}): void {
  taskLog.push({
    timestamp: Date.now(),
    taskType: params.taskType,
    handledInternally: params.handledInternally,
    providerId: params.providerId,
    successRate: params.successRate ?? 1.0,
    latencyMs: params.latencyMs ?? 0,
  });
  if (taskLog.length > 5000) taskLog.splice(0, 1000);
}

function getRecentTasks(windowMs: number = 60 * 60 * 1000): TaskRecord[] {
  const cutoff = Date.now() - windowMs;
  return taskLog.filter(t => t.timestamp >= cutoff);
}

function computeInternalRatio(tasks: TaskRecord[]): number {
  if (tasks.length === 0) return 0;
  return tasks.filter(t => t.handledInternally).length / tasks.length;
}

function computePerformanceGap(tasks: TaskRecord[]): Record<string, number> {
  const byType = new Map<string, { internal: number[]; external: number[] }>();

  for (const task of tasks) {
    if (!byType.has(task.taskType)) byType.set(task.taskType, { internal: [], external: [] });
    const bucket = byType.get(task.taskType)!;
    if (task.handledInternally) bucket.internal.push(task.successRate);
    else bucket.external.push(task.successRate);
  }

  const gaps: Record<string, number> = {};
  for (const [type, data] of byType.entries()) {
    const avgInternal = data.internal.length > 0 ? data.internal.reduce((a, b) => a + b, 0) / data.internal.length : null;
    const avgExternal = data.external.length > 0 ? data.external.reduce((a, b) => a + b, 0) / data.external.length : null;
    if (avgInternal !== null && avgExternal !== null) {
      gaps[type] = Math.round((avgExternal - avgInternal) * 100);
    }
  }

  return gaps;
}

function computeReadinessScore(): {
  score: number;
  breakdown: Record<string, number>;
  ready: boolean;
} {
  const validation = getValidationStatus();
  const modelStatus = getModelSovereigntyStatus();
  const knowledge = getKnowledgeAbsorptionStatus();
  const security = getSecurityEngineStatus();
  const recentTasks = getRecentTasks();
  const internalRatio = computeInternalRatio(recentTasks);

  const breakdown = {
    internalRatio: Math.round(internalRatio * 100),
    validationScore: Math.round(validation.overallScore),
    modelReadiness: Math.round(modelStatus?.state?.sovereigntyReadiness ?? 0),
    knowledgeNodes: knowledge.totalNodesAbsorbed,
    securityScore: Math.round(security.securityScore),
    evaluationScore: cachedEvaluationScore,
  };

  const thresholds = config.readinessThresholds;

  const score = Math.round(
    (breakdown.internalRatio >= thresholds.internalRatio * 100 ? 20 : breakdown.internalRatio / (thresholds.internalRatio * 100) * 20) +
    (breakdown.validationScore >= thresholds.validationScore ? 20 : breakdown.validationScore / thresholds.validationScore * 20) +
    (breakdown.modelReadiness >= 80 ? 15 : breakdown.modelReadiness / 80 * 15) +
    (breakdown.knowledgeNodes >= thresholds.knowledgeNodes ? 15 : breakdown.knowledgeNodes / thresholds.knowledgeNodes * 15) +
    (breakdown.securityScore >= thresholds.securityScore ? 15 : breakdown.securityScore / thresholds.securityScore * 15) +
    (breakdown.evaluationScore >= 70 ? 15 : breakdown.evaluationScore / 70 * 15)
  );

  const ready = Object.entries({
    internalRatio: internalRatio >= thresholds.internalRatio,
    validationScore: breakdown.validationScore >= thresholds.validationScore,
    securityScore: breakdown.securityScore >= thresholds.securityScore,
    knowledgeNodes: breakdown.knowledgeNodes >= thresholds.knowledgeNodes,
    evaluationScore: breakdown.evaluationScore >= 70,
  }).every(([, v]) => v);

  return { score, breakdown, ready };
}

interface DisconnectPlan {
  phase: number;
  targets: string[];
  dryRun: boolean;
  estimatedImpact: string;
  blockers: string[];
}

function computeDisconnectPlan(readiness: ReturnType<typeof computeReadinessScore>): DisconnectPlan[] {
  const plans: DisconnectPlan[] = [];
  const blockers: string[] = [];

  if (readiness.breakdown.internalRatio < config.readinessThresholds.internalRatio * 100) {
    blockers.push(`Internal ratio ${readiness.breakdown.internalRatio}% < ${config.readinessThresholds.internalRatio * 100}% threshold`);
  }
  if (readiness.breakdown.validationScore < config.readinessThresholds.validationScore) {
    blockers.push(`Validation score ${readiness.breakdown.validationScore} < ${config.readinessThresholds.validationScore} threshold`);
  }

  plans.push({
    phase: 1,
    targets: config.disconnectPlan.phase1,
    dryRun: config.disconnectPlan.dryRunMode,
    estimatedImpact: "Low priority providers. Minimal impact on quality.",
    blockers: blockers.length > 0 ? blockers : [],
  });

  plans.push({
    phase: 2,
    targets: config.disconnectPlan.phase2,
    dryRun: config.disconnectPlan.dryRunMode,
    estimatedImpact: "Primary external providers. Requires 95%+ internal readiness.",
    blockers: !readiness.ready ? blockers : [],
  });

  return plans;
}

export async function runSovereigntyMonitorCycle(): Promise<{
  cycleNumber: number;
  internalRatio: number;
  performanceGaps: Record<string, number>;
  readiness: { score: number; breakdown: Record<string, number>; ready: boolean };
  disconnectPlan: DisconnectPlan[];
  recommendations: string[];
}> {
  monitorCycleCount++;
  await refreshEvaluationScore();
  const recentTasks = getRecentTasks();
  const internalRatio = computeInternalRatio(recentTasks);
  const performanceGaps = computePerformanceGap(recentTasks);
  const readiness = computeReadinessScore();
  const disconnectPlan = computeDisconnectPlan(readiness);

  const recommendations: string[] = [];

  if (internalRatio < config.internalRatioTarget) {
    recommendations.push(`Increase internal handling: ${(internalRatio * 100).toFixed(1)}% vs target ${config.internalRatioTarget * 100}%`);
  }

  const highGaps = Object.entries(performanceGaps).filter(([, gap]) => Math.abs(gap) > config.performanceGapThreshold);
  for (const [type, gap] of highGaps) {
    if (gap > 0) recommendations.push(`External outperforms internal for ${type} by ${gap}% — prioritize training this domain`);
    else recommendations.push(`Internal outperforms external for ${type} by ${Math.abs(gap)}% — good candidate for disconnection`);
  }

  if (readiness.score >= 80) {
    recommendations.push("System approaching disconnect readiness — consider phase 1 disconnect simulation");
  }

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Monitor", phaseNumber: -2, metricName: "Internal Ratio", currentValue: internalRatio * 100, targetValue: config.internalRatioTarget * 100, unit: "percent", status: "measured" },
      { phase: "Monitor", phaseNumber: -2, metricName: "Readiness Score", currentValue: readiness.score, targetValue: 100, unit: "percent", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  console.log(`${LOG_PREFIX} Cycle #${monitorCycleCount} — Internal ratio: ${(internalRatio * 100).toFixed(1)}%, Readiness: ${readiness.score}%`);

  return {
    cycleNumber: monitorCycleCount,
    internalRatio: Math.round(internalRatio * 100) / 100,
    performanceGaps,
    readiness,
    disconnectPlan,
    recommendations,
  };
}

export function getSovereigntyMonitorStatus() {
  const recentTasks = getRecentTasks();
  const readiness = computeReadinessScore();
  return {
    cycleCount: monitorCycleCount,
    totalTasksTracked: taskLog.length,
    recentTaskCount: recentTasks.length,
    internalRatio: Math.round(computeInternalRatio(recentTasks) * 100) / 100,
    readinessScore: readiness.score,
    readinessBreakdown: readiness.breakdown,
    isReadyForDisconnect: readiness.ready,
    config: {
      internalRatioTarget: config.internalRatioTarget,
      dryRunMode: config.disconnectPlan.dryRunMode,
      hardDisconnectEnabled: config.disconnectPlan.hardDisconnectEnabled,
    },
    continuousActive: continuousInterval !== null,
  };
}

export function updateSovereigntyConfig(updates: Partial<SovereigntyConfig>): void {
  config = { ...config, ...updates };
  console.log(`${LOG_PREFIX} Config updated`);
}

export function startSovereigntyMonitor(): void {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting sovereignty monitor (every 10 minutes)`);
  runSovereigntyMonitorCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err?.message));
  continuousInterval = setInterval(() => {
    runSovereigntyMonitorCycle().catch(err => console.error(`${LOG_PREFIX} Cycle failed:`, err?.message));
  }, 10 * 60 * 1000);
}

export function stopSovereigntyMonitor(): void {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
  }
}

interface DisconnectResult {
  phase: number;
  target: string;
  action: "disabled" | "skipped" | "blocked";
  reason: string;
  dryRun: boolean;
  timestamp: number;
}

const disconnectLog: DisconnectResult[] = [];

export async function executeDisconnect(options: {
  phase?: number;
  dryRun?: boolean;
  force?: boolean;
} = {}): Promise<{
  executed: DisconnectResult[];
  readiness: ReturnType<typeof computeReadinessScore>;
  message: string;
}> {
  const { providerRegistry } = await import("./provider-registry");
  const readiness = computeReadinessScore();
  const plans = computeDisconnectPlan(readiness);
  const targetPhase = options.phase ?? 1;
  const isDryRun = options.dryRun ?? config.disconnectPlan.dryRunMode;
  const isForce = options.force ?? false;

  const plan = plans.find(p => p.phase === targetPhase);
  if (!plan) {
    return { executed: [], readiness, message: `Phase ${targetPhase} not found in disconnect plan` };
  }

  if (!config.disconnectPlan.hardDisconnectEnabled && !isForce) {
    return { executed: [], readiness, message: "Hard disconnect not enabled. Use force=true or enable hardDisconnectEnabled in config." };
  }

  const results: DisconnectResult[] = [];

  for (const target of plan.targets) {
    if (plan.blockers.length > 0 && !isForce) {
      const result: DisconnectResult = {
        phase: targetPhase,
        target,
        action: "blocked",
        reason: `Blockers: ${plan.blockers.join("; ")}`,
        dryRun: isDryRun,
        timestamp: Date.now(),
      };
      results.push(result);
      disconnectLog.push(result);
      console.log(`${LOG_PREFIX} DISCONNECT BLOCKED for ${target}: ${result.reason}`);
      continue;
    }

    if (isDryRun) {
      const result: DisconnectResult = {
        phase: targetPhase,
        target,
        action: "skipped",
        reason: "Dry run mode — no actual disconnect performed",
        dryRun: true,
        timestamp: Date.now(),
      };
      results.push(result);
      disconnectLog.push(result);
      console.log(`${LOG_PREFIX} DRY RUN: Would disconnect provider ${target}`);
    } else {
      const disableResult = providerRegistry.disable(target);
      const result: DisconnectResult = {
        phase: targetPhase,
        target,
        action: disableResult.success ? "disabled" : "blocked",
        reason: disableResult.message,
        dryRun: false,
        timestamp: Date.now(),
      };
      results.push(result);
      disconnectLog.push(result);
      console.log(`${LOG_PREFIX} DISCONNECT EXECUTED for ${target}: ${disableResult.message}`);
    }
  }

  if (disconnectLog.length > 200) disconnectLog.splice(0, 100);

  const disabledCount = results.filter(r => r.action === "disabled").length;
  const message = isDryRun
    ? `Dry run complete for phase ${targetPhase}: ${results.length} targets evaluated`
    : `Phase ${targetPhase} executed: ${disabledCount} providers disabled, ${results.length - disabledCount} skipped/blocked`;

  return { executed: results, readiness, message };
}

export function getDisconnectLog(): DisconnectResult[] {
  return [...disconnectLog];
}
