import { db } from "@workspace/db";
import {
  metacognition_log,
  strategy_preferences,
  failure_patterns,
  cognitive_state_snapshots,
  epistemic_journal,
  causal_analysis,
} from "@workspace/db/schema";
import { eq, desc, sql, and, count, gt, lt, asc } from "drizzle-orm";
import { logger } from "./logger";
import { getAwarenessState } from "./awareness-engine";
import { getAutonomyLoopStatus } from "./autonomy-loop-engine";
import crypto from "crypto";

const LOG_PREFIX = "[Metacognition]";

export interface TaskPlan {
  taskId: string;
  taskType: string;
  plan: string;
  risks: string[];
  assumptions: string[];
  expectedOutcome: string;
  uncertaintyLevel: number;
  confidenceBefore: number;
  strategy: string;
  engineSource: string;
  predictedSuccessProbability: number;
  explorationReason: string | null;
}

export interface TaskReflection {
  taskId: string;
  actualOutcome: string;
  success: boolean;
  mistakes: string[];
  lessonsLearned: string[];
  adaptations: string[];
  confidenceAfter: number;
  durationMs: number;
}

interface EngineEvent {
  engine: string;
  event: string;
  success: boolean;
  durationMs: number;
  metadata: Record<string, unknown>;
  timestamp: number;
}

interface CognitiveLoadState {
  load: number;
  activeEngines: number;
  avgLatencyMs: number;
  memoryPressureMb: number;
  bottleneck: string | null;
  overloaded: boolean;
  trend: "increasing" | "decreasing" | "stable";
}

interface EpistemicState {
  totalDomains: number;
  avgCertainty: number;
  knownUnknowns: string[];
  calibrationScore: number;
  predictionAccuracy: number;
  recentPredictions: { prediction: string; outcome: string | null; correct: boolean | null }[];
}

interface CausalInsight {
  triggerEngine: string;
  effectObserved: string;
  confidence: number;
  interventionSuggested: string | null;
  validated: boolean;
}

interface SelfModel {
  strengths: string[];
  weaknesses: string[];
  commonFailureModes: string[];
  bestStrategiesByType: Record<string, string>;
  uncertaintyCalibration: number;
  selfCorrectionRate: number;
  cognitiveLoad: CognitiveLoadState;
  epistemicState: EpistemicState;
  causalInsights: CausalInsight[];
  metaMetaCognition: {
    selfModelAccuracy: number;
    predictionCalibration: number;
    reflectionDepth: number;
    adaptationEffectiveness: number;
  };
  personalityProfile: {
    explorationTendency: number;
    riskTolerance: number;
    learningRate: number;
    consistencyScore: number;
  };
}

interface MetacognitiveState {
  totalTasks: number;
  successRate: number;
  avgConfidenceGain: number;
  avgDivergence: number;
  topStrategies: { taskType: string; strategyName: string; preferenceScore: number; trialCount: number }[];
  activeFailurePatterns: { patternName: string; occurrenceCount: number; severity: string; category: string }[];
  recentReflections: {
    taskId: string;
    taskType: string;
    success: boolean;
    divergence: number | null;
    lessonsLearned: unknown[];
    createdAt: Date;
  }[];
  selfModel: SelfModel;
  cyclesRun: number;
  lastCycleAt: number;
  improvementTrajectory: number[];
  cognitiveLoadHistory: { load: number; timestamp: number }[];
  anomalies: { type: string; description: string; severity: string; timestamp: number }[];
  crossSessionImprovement: { metric: string; startValue: number; currentValue: number; changePercent: number }[];
}

let cyclesRun = 0;
let lastCycleAt = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;
let snapshotInterval: ReturnType<typeof setInterval> | null = null;

const recentOutcomes: { success: boolean; divergence: number; timestamp: number; taskType: string; durationMs: number }[] = [];
const MAX_RECENT_OUTCOMES = 500;

const engineEventBuffer: EngineEvent[] = [];
const MAX_ENGINE_EVENTS = 1000;

const cognitiveLoadHistory: { load: number; timestamp: number }[] = [];
const MAX_LOAD_HISTORY = 200;

const anomalyLog: { type: string; description: string; severity: string; timestamp: number }[] = [];
const MAX_ANOMALIES = 100;

const predictions: { id: string; prediction: string; expectedBy: number; domain: string; predicted: boolean | null }[] = [];

const engineLatencies: Map<string, number[]> = new Map();

function generateTaskId(): string {
  return `meta-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function thompsonSample(alpha: number, beta: number): number {
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

function gammaSample(shape: number): number {
  if (shape < 1) {
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  let x: number, v: number;
  for (;;) {
    do {
      x = boxMullerSingle();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function boxMullerSingle(): number {
  let u: number, v: number, s: number;
  do {
    u = 2 * Math.random() - 1;
    v = 2 * Math.random() - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt(-2 * Math.log(s) / s);
}

function bayesianUpdate(priorAlpha: number, priorBeta: number, successes: number, failures: number): { alpha: number; beta: number; mean: number; variance: number } {
  const alpha = priorAlpha + successes;
  const beta = priorBeta + failures;
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1));
  return { alpha, beta, mean, variance };
}

function exponentialMovingAverage(values: number[], decay: number): number {
  if (values.length === 0) return 0;
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = decay * values[i] + (1 - decay) * ema;
  }
  return ema;
}

function detectAnomaly(value: number, history: number[], threshold = 2.5): { isAnomaly: boolean; zScore: number } {
  if (history.length < 5) return { isAnomaly: false, zScore: 0 };
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((acc, v) => acc + (v - mean) ** 2, 0) / history.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return { isAnomaly: false, zScore: 0 };
  const zScore = Math.abs(value - mean) / stdDev;
  return { isAnomaly: zScore > threshold, zScore };
}

function computeEntropy(distribution: number[]): number {
  const total = distribution.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -distribution.reduce((acc, v) => {
    const p = v / total;
    return p > 0 ? acc + p * Math.log2(p) : acc;
  }, 0);
}

async function selectStrategyThompson(taskType: string): Promise<{
  strategyName: string;
  preferenceScore: number;
  explorationReason: string | null;
} | null> {
  try {
    const strategies = await db
      .select()
      .from(strategy_preferences)
      .where(eq(strategy_preferences.taskType, taskType));

    if (strategies.length === 0) return null;

    let bestSample = -1;
    let bestStrategy = strategies[0];
    let isExploring = false;

    for (const s of strategies) {
      const alpha = (s.successCount ?? 0) + 1;
      const beta = (s.failureCount ?? 0) + 1;
      const sample = thompsonSample(alpha, beta);

      if (sample > bestSample) {
        bestSample = sample;
        const bestByScore = strategies.reduce((a, b) =>
          (a.preferenceScore ?? 0) > (b.preferenceScore ?? 0) ? a : b
        );
        isExploring = s.id !== bestByScore.id;
        bestStrategy = s;
      }
    }

    return {
      strategyName: bestStrategy.strategyName,
      preferenceScore: bestStrategy.preferenceScore ?? 0.5,
      explorationReason: isExploring
        ? `Thompson sampling exploration: selected "${bestStrategy.strategyName}" over greedy choice to gather more data`
        : null,
    };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Thompson sampling failed, falling back to greedy`);
    return null;
  }
}

async function estimateConfidenceBayesian(taskType: string): Promise<{ confidence: number; alpha: number; beta: number }> {
  try {
    const rows = await db
      .select({
        successCount: sql<number>`COALESCE(SUM(CASE WHEN success = true THEN 1 ELSE 0 END), 0)`,
        failureCount: sql<number>`COALESCE(SUM(CASE WHEN success = false THEN 1 ELSE 0 END), 0)`,
      })
      .from(metacognition_log)
      .where(and(eq(metacognition_log.taskType, taskType), eq(metacognition_log.phase, "reflect")));

    const row = rows[0];
    const successes = row ? Number(row.successCount) : 0;
    const failures = row ? Number(row.failureCount) : 0;
    const posterior = bayesianUpdate(1, 1, successes, failures);
    return { confidence: posterior.mean, alpha: posterior.alpha, beta: posterior.beta };
  } catch {
    return { confidence: 0.5, alpha: 1, beta: 1 };
  }
}

async function predictSuccessProbability(taskType: string, strategy: string): Promise<number> {
  try {
    const recentOfType = recentOutcomes.filter(o => o.taskType === taskType).slice(-20);
    if (recentOfType.length < 3) return 0.5;

    const recentRate = recentOfType.filter(o => o.success).length / recentOfType.length;

    const strategyRows = await db
      .select()
      .from(strategy_preferences)
      .where(and(eq(strategy_preferences.taskType, taskType), eq(strategy_preferences.strategyName, strategy)))
      .limit(1);

    let strategyRate = 0.5;
    if (strategyRows.length > 0) {
      const s = strategyRows[0];
      const total = (s.successCount ?? 0) + (s.failureCount ?? 0);
      if (total > 0) strategyRate = (s.successCount ?? 0) / total;
    }

    const loadFactor = cognitiveLoadHistory.length > 0
      ? 1 - (cognitiveLoadHistory[cognitiveLoadHistory.length - 1].load / 100) * 0.2
      : 1;

    return Math.min(0.99, Math.max(0.01, (recentRate * 0.4 + strategyRate * 0.4 + 0.5 * 0.2) * loadFactor));
  } catch {
    return 0.5;
  }
}

export async function planTask(
  taskType: string,
  plan: string,
  options: {
    risks?: string[];
    assumptions?: string[];
    expectedOutcome?: string;
    uncertaintyLevel?: number;
    engineSource?: string;
  } = {}
): Promise<TaskPlan> {
  const taskId = generateTaskId();

  const [strategyResult, confidenceResult] = await Promise.all([
    selectStrategyThompson(taskType),
    estimateConfidenceBayesian(taskType),
  ]);

  const strategy = strategyResult?.strategyName ?? "default";
  const confidenceBefore = confidenceResult.confidence;
  const predictedSuccess = await predictSuccessProbability(taskType, strategy);

  const taskPlan: TaskPlan = {
    taskId,
    taskType,
    plan,
    risks: options.risks ?? [],
    assumptions: options.assumptions ?? [],
    expectedOutcome: options.expectedOutcome ?? "successful completion",
    uncertaintyLevel: options.uncertaintyLevel ?? bayesianUncertainty(confidenceResult.alpha, confidenceResult.beta),
    confidenceBefore,
    strategy,
    engineSource: options.engineSource ?? "system",
    predictedSuccessProbability: predictedSuccess,
    explorationReason: strategyResult?.explorationReason ?? null,
  };

  try {
    await db.insert(metacognition_log).values({
      taskId,
      taskType,
      phase: "plan",
      plan,
      risks: taskPlan.risks,
      assumptions: taskPlan.assumptions,
      expectedOutcome: taskPlan.expectedOutcome,
      uncertaintyLevel: taskPlan.uncertaintyLevel,
      confidenceBefore,
      engineSource: taskPlan.engineSource,
    });
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to persist task plan`);
  }

  logger.info(
    {
      taskId,
      taskType,
      strategy,
      confidence: confidenceBefore.toFixed(2),
      predictedSuccess: predictedSuccess.toFixed(2),
      exploring: !!strategyResult?.explorationReason,
    },
    `${LOG_PREFIX} PLAN: ${plan.substring(0, 100)}`
  );

  return taskPlan;
}

function bayesianUncertainty(alpha: number, beta: number): number {
  const variance = (alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1));
  return Math.min(1, Math.sqrt(variance) * 4);
}

export async function reflectOnTask(reflection: TaskReflection): Promise<void> {
  const planRow = await db
    .select({ expectedOutcome: metacognition_log.expectedOutcome, taskType: metacognition_log.taskType })
    .from(metacognition_log)
    .where(and(eq(metacognition_log.taskId, reflection.taskId), eq(metacognition_log.phase, "plan")))
    .limit(1)
    .catch(() => []);

  const expected = planRow[0]?.expectedOutcome ?? "";
  const originalTaskType = planRow[0]?.taskType ?? "unknown";
  const divergence = computeDivergence(expected, reflection.actualOutcome, reflection.success);

  try {
    await db.insert(metacognition_log).values({
      taskId: reflection.taskId,
      taskType: originalTaskType,
      phase: "reflect",
      plan: "Post-execution reflection",
      outcome: reflection.success ? "success" : "failure",
      actualOutcome: reflection.actualOutcome,
      divergence,
      mistakes: reflection.mistakes,
      lessonsLearned: reflection.lessonsLearned,
      adaptations: reflection.adaptations,
      confidenceAfter: reflection.confidenceAfter,
      durationMs: reflection.durationMs,
      success: reflection.success,
      engineSource: "metacognition",
    });
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to persist reflection`);
  }

  recentOutcomes.push({
    success: reflection.success,
    divergence,
    timestamp: Date.now(),
    taskType: originalTaskType,
    durationMs: reflection.durationMs,
  });
  if (recentOutcomes.length > MAX_RECENT_OUTCOMES) recentOutcomes.shift();

  const durationHistory = recentOutcomes.map(o => o.durationMs);
  const durationAnomaly = detectAnomaly(reflection.durationMs, durationHistory);
  if (durationAnomaly.isAnomaly) {
    anomalyLog.push({
      type: "duration_anomaly",
      description: `Task ${reflection.taskId} took ${reflection.durationMs}ms (z-score: ${durationAnomaly.zScore.toFixed(1)})`,
      severity: durationAnomaly.zScore > 4 ? "high" : "medium",
      timestamp: Date.now(),
    });
    if (anomalyLog.length > MAX_ANOMALIES) anomalyLog.shift();
  }

  if (!reflection.success && reflection.mistakes.length > 0) {
    await recordFailurePattern(reflection.mistakes, reflection.taskId);
    await analyzeCausality(reflection);
  }

  const consecutiveFailures = countConsecutiveFailures();
  if (consecutiveFailures >= 3) {
    anomalyLog.push({
      type: "consecutive_failures",
      description: `${consecutiveFailures} consecutive failures detected — possible systemic issue`,
      severity: consecutiveFailures >= 5 ? "critical" : "high",
      timestamp: Date.now(),
    });
    if (anomalyLog.length > MAX_ANOMALIES) anomalyLog.shift();
  }

  logger.info(
    {
      taskId: reflection.taskId,
      success: reflection.success,
      divergence: divergence.toFixed(3),
      lessons: reflection.lessonsLearned.length,
      durationMs: reflection.durationMs,
      anomaly: durationAnomaly.isAnomaly,
    },
    `${LOG_PREFIX} REFLECT: ${reflection.actualOutcome.substring(0, 100)}`
  );
}

function computeDivergence(expected: string, actual: string, success: boolean): number {
  if (!expected || !actual) return success ? 0.1 : 0.8;

  const expectedTokens = new Set(expected.toLowerCase().split(/\s+/));
  const actualTokens = new Set(actual.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const t of expectedTokens) {
    if (actualTokens.has(t)) overlap++;
  }
  const jaccard = expectedTokens.size > 0
    ? overlap / (expectedTokens.size + actualTokens.size - overlap)
    : 0;

  const semanticSimilarity = jaccard;
  const outcomeFactor = success ? 0.2 : 0.7;

  return Math.min(1, Math.max(0, (1 - semanticSimilarity) * 0.4 + outcomeFactor * 0.6));
}

function countConsecutiveFailures(): number {
  let count = 0;
  for (let i = recentOutcomes.length - 1; i >= 0; i--) {
    if (!recentOutcomes[i].success) count++;
    else break;
  }
  return count;
}

export async function adaptStrategies(
  taskType: string,
  strategyName: string,
  success: boolean,
  durationMs: number
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(strategy_preferences)
      .where(
        and(
          eq(strategy_preferences.taskType, taskType),
          eq(strategy_preferences.strategyName, strategyName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const newSuccessCount = (row.successCount ?? 0) + (success ? 1 : 0);
      const newFailureCount = (row.failureCount ?? 0) + (success ? 0 : 1);
      const posterior = bayesianUpdate(1, 1, newSuccessCount, newFailureCount);
      const newAvgDuration =
        ((row.avgDurationMs ?? 0) * (newSuccessCount + newFailureCount - 1) + durationMs) /
        (newSuccessCount + newFailureCount);

      const durationPenalty = durationMs > (row.avgDurationMs ?? durationMs) * 2 ? 0.05 : 0;
      const newScore = Math.max(0, Math.min(1, posterior.mean - durationPenalty));

      await db
        .update(strategy_preferences)
        .set({
          successCount: newSuccessCount,
          failureCount: newFailureCount,
          preferenceScore: newScore,
          avgDurationMs: newAvgDuration,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            bayesianAlpha: posterior.alpha,
            bayesianBeta: posterior.beta,
            posteriorVariance: posterior.variance,
            lastDurationMs: durationMs,
          },
        })
        .where(eq(strategy_preferences.id, row.id));
    } else {
      const initial = bayesianUpdate(1, 1, success ? 1 : 0, success ? 0 : 1);
      await db.insert(strategy_preferences).values({
        taskType,
        strategyName,
        description: `Strategy "${strategyName}" for ${taskType} tasks`,
        successCount: success ? 1 : 0,
        failureCount: success ? 0 : 1,
        preferenceScore: initial.mean,
        avgDurationMs: durationMs,
        lastUsedAt: new Date(),
        metadata: {
          bayesianAlpha: initial.alpha,
          bayesianBeta: initial.beta,
          posteriorVariance: initial.variance,
          lastDurationMs: durationMs,
        },
      });
    }
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to adapt strategy`);
  }

  logger.info(
    { taskType, strategyName, success, durationMs },
    `${LOG_PREFIX} ADAPT: Strategy "${strategyName}" updated for ${taskType}`
  );
}

export function recordEngineEvent(engine: string, event: string, success: boolean, durationMs: number, metadata: Record<string, unknown> = {}): void {
  const engineEvent: EngineEvent = { engine, event, success, durationMs, metadata, timestamp: Date.now() };
  engineEventBuffer.push(engineEvent);
  if (engineEventBuffer.length > MAX_ENGINE_EVENTS) engineEventBuffer.shift();

  const latencies = engineLatencies.get(engine) ?? [];
  latencies.push(durationMs);
  if (latencies.length > 50) latencies.shift();
  engineLatencies.set(engine, latencies);

  const latencyAnomaly = detectAnomaly(durationMs, latencies);
  if (latencyAnomaly.isAnomaly) {
    anomalyLog.push({
      type: "engine_latency_spike",
      description: `${engine}.${event}: ${durationMs}ms (z-score: ${latencyAnomaly.zScore.toFixed(1)}, avg: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0)}ms)`,
      severity: latencyAnomaly.zScore > 4 ? "high" : "medium",
      timestamp: Date.now(),
    });
    if (anomalyLog.length > MAX_ANOMALIES) anomalyLog.shift();
  }
}

export async function instrumentEngine<T>(
  engineName: string,
  operationName: string,
  fn: () => Promise<T>,
  options: { taskType?: string; metadata?: Record<string, unknown> } = {}
): Promise<T> {
  const startMs = Date.now();
  let success = true;
  let result: T;

  try {
    result = await fn();
  } catch (err) {
    success = false;
    recordEngineEvent(engineName, operationName, false, Date.now() - startMs, {
      error: err instanceof Error ? err.message : String(err),
      ...options.metadata,
    });
    throw err;
  }

  const durationMs = Date.now() - startMs;
  recordEngineEvent(engineName, operationName, success, durationMs, options.metadata ?? {});

  if (options.taskType) {
    adaptStrategies(options.taskType, `${engineName}_${operationName}`, success, durationMs).catch(() => {});
  }

  return result;
}

async function analyzeCausality(reflection: TaskReflection): Promise<void> {
  const recentEngineEvents = engineEventBuffer
    .filter(e => e.timestamp > Date.now() - 300_000)
    .sort((a, b) => a.timestamp - b.timestamp);

  const failedEvents = recentEngineEvents.filter(e => !e.success);
  if (failedEvents.length === 0) return;

  const causalChain = failedEvents.slice(-5).map(e => ({
    engine: e.engine,
    event: e.event,
    timestamp: e.timestamp,
    durationMs: e.durationMs,
  }));

  const triggerEvent = failedEvents[failedEvents.length - 1];
  const correlatedEngines = new Set(failedEvents.map(e => e.engine));

  let counterfactual: string | null = null;
  if (correlatedEngines.size > 1) {
    counterfactual = `If ${triggerEvent.engine} had not failed, downstream failures in ${[...correlatedEngines].filter(e => e !== triggerEvent.engine).join(", ")} may have been avoided`;
  }

  let intervention: string | null = null;
  if (failedEvents.length >= 3) {
    const mostFrequentEngine = [...correlatedEngines].reduce((best, eng) => {
      const count = failedEvents.filter(e => e.engine === eng).length;
      return count > (failedEvents.filter(e => e.engine === best).length) ? eng : best;
    });
    intervention = `Prioritize fixing ${mostFrequentEngine} — it appears in ${failedEvents.filter(e => e.engine === mostFrequentEngine).length}/${failedEvents.length} recent failures`;
  }

  try {
    await db.insert(causal_analysis).values({
      triggerEvent: `${triggerEvent.engine}.${triggerEvent.event}`,
      triggerEngine: triggerEvent.engine,
      effectObserved: reflection.actualOutcome.substring(0, 500),
      causalChain,
      confidence: Math.min(0.9, 0.3 + failedEvents.length * 0.1),
      analysisType: correlatedEngines.size > 1 ? "cross_engine_correlation" : "single_engine_failure",
      relatedTaskIds: [reflection.taskId],
      counterfactual,
      interventionSuggested: intervention,
    });
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to persist causal analysis`);
  }
}

async function captureCognitiveSnapshot(): Promise<CognitiveLoadState> {
  const now = Date.now();
  const recentEvents = engineEventBuffer.filter(e => e.timestamp > now - 60_000);
  const activeEngineSet = new Set(recentEvents.map(e => e.engine));

  const avgLatency = recentEvents.length > 0
    ? recentEvents.reduce((acc, e) => acc + e.durationMs, 0) / recentEvents.length
    : 0;

  const memUsage = process.memoryUsage();
  const memoryPressureMb = memUsage.heapUsed / 1024 / 1024;

  const failureRate = recentEvents.length > 0
    ? recentEvents.filter(e => !e.success).length / recentEvents.length
    : 0;

  const load = Math.min(100, (
    activeEngineSet.size * 5 +
    Math.min(50, avgLatency / 100) +
    failureRate * 30 +
    Math.min(20, memoryPressureMb / 50)
  ));

  let bottleneck: string | null = null;
  let maxLatency = 0;
  for (const [engine, latencies] of engineLatencies) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avg > maxLatency) {
      maxLatency = avg;
      bottleneck = engine;
    }
  }

  const loadHistoryValues = cognitiveLoadHistory.map(h => h.load);
  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (loadHistoryValues.length >= 5) {
    const recentAvg = exponentialMovingAverage(loadHistoryValues.slice(-5), 0.5);
    const olderAvg = exponentialMovingAverage(loadHistoryValues.slice(-10, -5), 0.5);
    if (recentAvg > olderAvg * 1.15) trend = "increasing";
    else if (recentAvg < olderAvg * 0.85) trend = "decreasing";
  }

  const state: CognitiveLoadState = {
    load,
    activeEngines: activeEngineSet.size,
    avgLatencyMs: avgLatency,
    memoryPressureMb,
    bottleneck,
    overloaded: load > 75,
    trend,
  };

  cognitiveLoadHistory.push({ load, timestamp: now });
  if (cognitiveLoadHistory.length > MAX_LOAD_HISTORY) cognitiveLoadHistory.shift();

  const loadAnomaly = detectAnomaly(load, loadHistoryValues);
  if (loadAnomaly.isAnomaly && load > 60) {
    anomalyLog.push({
      type: "cognitive_overload",
      description: `Cognitive load spiked to ${load.toFixed(1)} (z-score: ${loadAnomaly.zScore.toFixed(1)})`,
      severity: load > 85 ? "critical" : "high",
      timestamp: now,
    });
    if (anomalyLog.length > MAX_ANOMALIES) anomalyLog.shift();
  }

  const awarenessState = getAwarenessState();
  const autonomyStatus = getAutonomyLoopStatus() as Record<string, unknown>;

  const attentionDistribution: Record<string, number> = {};
  for (const engine of activeEngineSet) {
    const events = recentEvents.filter(e => e.engine === engine);
    attentionDistribution[engine] = events.length / recentEvents.length;
  }

  const engineHealthMap: Record<string, string> = {};
  for (const [engine, latencies] of engineLatencies) {
    const recentLatencies = latencies.slice(-10);
    const failCount = engineEventBuffer
      .filter(e => e.engine === engine && e.timestamp > now - 120_000 && !e.success).length;
    const totalCount = engineEventBuffer
      .filter(e => e.engine === engine && e.timestamp > now - 120_000).length;
    const healthRate = totalCount > 0 ? 1 - failCount / totalCount : 1;
    const avgLat = recentLatencies.reduce((a, b) => a + b, 0) / (recentLatencies.length || 1);
    engineHealthMap[engine] = healthRate > 0.8 ? (avgLat > 5000 ? "degraded" : "healthy") : "failing";
  }

  try {
    await db.insert(cognitive_state_snapshots).values({
      snapshotType: "periodic",
      cognitiveLoad: load,
      activeEngines: activeEngineSet.size,
      totalCyclesRunning: cyclesRun,
      memoryPressure: memoryPressureMb,
      processingLatencyMs: avgLatency,
      attentionDistribution,
      engineHealthMap,
      decisionQuality: recentOutcomes.length > 0
        ? recentOutcomes.slice(-20).filter(o => o.success).length / Math.max(1, recentOutcomes.slice(-20).length)
        : 0.5,
      coherenceScore: computeCoherenceScore(),
      awarenessLevel: awarenessState?.compositeScore ?? 0,
      autonomyLevel: Number(autonomyStatus?.autonomyScore ?? 0),
      sovereigntyReadiness: Number(autonomyStatus?.sovereigntyReadiness ?? 0),
      anomalyFlags: anomalyLog.slice(-5),
    });
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to persist cognitive snapshot`);
  }

  return state;
}

function readCognitiveLoad(): CognitiveLoadState {
  const now = Date.now();
  const recentEvents = engineEventBuffer.filter(e => e.timestamp > now - 60_000);
  const activeEngineSet = new Set(recentEvents.map(e => e.engine));

  const avgLatency = recentEvents.length > 0
    ? recentEvents.reduce((acc, e) => acc + e.durationMs, 0) / recentEvents.length
    : 0;

  const memUsage = process.memoryUsage();
  const memoryPressureMb = memUsage.heapUsed / 1024 / 1024;

  const failureRate = recentEvents.length > 0
    ? recentEvents.filter(e => !e.success).length / recentEvents.length
    : 0;

  const load = Math.min(100, (
    activeEngineSet.size * 5 +
    Math.min(50, avgLatency / 100) +
    failureRate * 30 +
    Math.min(20, memoryPressureMb / 50)
  ));

  let bottleneck: string | null = null;
  let maxLatency = 0;
  for (const [engine, latencies] of engineLatencies) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avg > maxLatency) {
      maxLatency = avg;
      bottleneck = engine;
    }
  }

  const loadHistoryValues = cognitiveLoadHistory.map(h => h.load);
  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (loadHistoryValues.length >= 5) {
    const recentAvg = exponentialMovingAverage(loadHistoryValues.slice(-5), 0.5);
    const olderAvg = exponentialMovingAverage(loadHistoryValues.slice(-10, -5), 0.5);
    if (recentAvg > olderAvg * 1.15) trend = "increasing";
    else if (recentAvg < olderAvg * 0.85) trend = "decreasing";
  }

  return {
    load,
    activeEngines: activeEngineSet.size,
    avgLatencyMs: avgLatency,
    memoryPressureMb,
    bottleneck,
    overloaded: load > 75,
    trend,
  };
}

function readEpistemicState(): EpistemicState {
  const totalDomains = new Set(recentOutcomes.map(o => o.taskType)).size;

  const resolvedPredictions = predictions.filter(p => p.predicted !== null);
  const correct = resolvedPredictions.filter(p => p.predicted === true).length;
  const predictionAccuracy = resolvedPredictions.length > 0 ? correct / resolvedPredictions.length : 0.5;

  const failureTypes = new Set(anomalyLog.map(a => a.type));
  const knownUnknowns: string[] = [];
  if (recentOutcomes.filter(o => !o.success).length / Math.max(1, recentOutcomes.length) > 0.3) {
    knownUnknowns.push("High failure rate — root cause unclear for some failures");
  }
  if (engineLatencies.size < 5) {
    knownUnknowns.push("Insufficient engine telemetry — not all engines instrumented");
  }
  if (failureTypes.has("consecutive_failures")) {
    knownUnknowns.push("Systemic failure mode detected but not fully characterized");
  }

  const avgCertainty = recentOutcomes.length > 0
    ? recentOutcomes.slice(-50).reduce((acc, o) => acc + (o.success ? 0.7 : 0.3), 0) /
      Math.min(50, recentOutcomes.length)
    : 0.5;

  const calibrationScore = 1 - Math.abs(predictionAccuracy - avgCertainty);

  return {
    totalDomains,
    avgCertainty,
    knownUnknowns,
    calibrationScore,
    predictionAccuracy,
    recentPredictions: predictions.slice(-10).map(p => ({
      prediction: p.prediction,
      outcome: p.predicted !== null ? (p.predicted ? "correct" : "incorrect") : null,
      correct: p.predicted,
    })),
  };
}

function computeCoherenceScore(): number {
  if (engineEventBuffer.length < 10) return 0.5;
  const recentEvents = engineEventBuffer.slice(-50);
  const engineGroups = new Map<string, boolean[]>();
  for (const e of recentEvents) {
    const results = engineGroups.get(e.engine) ?? [];
    results.push(e.success);
    engineGroups.set(e.engine, results);
  }

  const engineRates: number[] = [];
  for (const results of engineGroups.values()) {
    engineRates.push(results.filter(Boolean).length / results.length);
  }

  if (engineRates.length < 2) return engineRates[0] ?? 0.5;
  const mean = engineRates.reduce((a, b) => a + b, 0) / engineRates.length;
  const variance = engineRates.reduce((acc, v) => acc + (v - mean) ** 2, 0) / engineRates.length;
  return Math.max(0, 1 - Math.sqrt(variance) * 2);
}

async function updateEpistemicState(): Promise<EpistemicState> {
  const totalDomains = new Set(recentOutcomes.map(o => o.taskType)).size;

  const resolvedPredictions = predictions.filter(p => p.predicted !== null);
  const correct = resolvedPredictions.filter(p => p.predicted === true).length;
  const predictionAccuracy = resolvedPredictions.length > 0 ? correct / resolvedPredictions.length : 0.5;

  const failureTypes = new Set(anomalyLog.map(a => a.type));
  const knownUnknowns: string[] = [];
  if (recentOutcomes.filter(o => !o.success).length / Math.max(1, recentOutcomes.length) > 0.3) {
    knownUnknowns.push("High failure rate — root cause unclear for some failures");
  }
  if (engineLatencies.size < 5) {
    knownUnknowns.push("Insufficient engine telemetry — not all engines instrumented");
  }
  if (failureTypes.has("consecutive_failures")) {
    knownUnknowns.push("Systemic failure mode detected but not fully characterized");
  }

  const avgCertainty = recentOutcomes.length > 0
    ? recentOutcomes.slice(-50).reduce((acc, o) => acc + (o.success ? 0.7 : 0.3), 0) /
      Math.min(50, recentOutcomes.length)
    : 0.5;

  const calibrationScore = 1 - Math.abs(predictionAccuracy - avgCertainty);

  try {
    const existingDomains = await db
      .select({ domain: epistemic_journal.domain })
      .from(epistemic_journal)
      .limit(50);

    const trackedDomains = new Set(existingDomains.map(d => d.domain));
    const activeDomains = new Set(recentOutcomes.map(o => o.taskType));

    for (const domain of activeDomains) {
      if (!trackedDomains.has(domain)) {
        await db.insert(epistemic_journal).values({
          domain,
          knowledgeType: "procedural",
          certaintyLevel: avgCertainty,
          evidenceBasis: `Derived from ${recentOutcomes.filter(o => o.taskType === domain).length} task outcomes`,
          knownUnknowns: knownUnknowns.filter(u => u.toLowerCase().includes(domain.toLowerCase())),
          predictions: [],
          predictionOutcomes: [],
          calibrationScore,
          sourceEngines: ["metacognition"],
        }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to update epistemic journal`);
  }

  return {
    totalDomains,
    avgCertainty,
    knownUnknowns,
    calibrationScore,
    predictionAccuracy,
    recentPredictions: predictions.slice(-10).map(p => ({
      prediction: p.prediction,
      outcome: p.predicted !== null ? (p.predicted ? "correct" : "incorrect") : null,
      correct: p.predicted,
    })),
  };
}

export function registerPrediction(prediction: string, domain: string, expectedByMs: number = 600_000): string {
  const id = generateTaskId();
  predictions.push({
    id,
    prediction,
    expectedBy: Date.now() + expectedByMs,
    domain,
    predicted: null,
  });
  if (predictions.length > 200) predictions.shift();
  return id;
}

export function resolvePrediction(id: string, correct: boolean): void {
  const pred = predictions.find(p => p.id === id);
  if (pred) pred.predicted = correct;
}

async function buildSelfModel(): Promise<SelfModel> {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const commonFailureModes: string[] = [];
  const bestStrategiesByType: Record<string, string> = {};

  try {
    const strategies = await db
      .select()
      .from(strategy_preferences)
      .orderBy(desc(strategy_preferences.preferenceScore))
      .limit(30);

    const bestRateByType: Record<string, number> = {};

    for (const s of strategies) {
      const total = (s.successCount ?? 0) + (s.failureCount ?? 0);
      if (total >= 3) {
        const posterior = bayesianUpdate(1, 1, s.successCount ?? 0, s.failureCount ?? 0);
        const ci95Width = 2 * 1.96 * Math.sqrt(posterior.variance);
        const rate = posterior.mean;

        if (rate >= 0.75 && ci95Width < 0.3) {
          strengths.push(`${s.taskType}/${s.strategyName}: ${(rate * 100).toFixed(0)}% success (n=${total}, CI±${(ci95Width * 50).toFixed(0)}%)`);
        }
        if (rate <= 0.35 && total >= 5) {
          weaknesses.push(`${s.taskType}/${s.strategyName}: ${(rate * 100).toFixed(0)}% success (n=${total}) — consider deprecating`);
        }
        if (!bestStrategiesByType[s.taskType] || rate > (bestRateByType[s.taskType] ?? 0)) {
          bestStrategiesByType[s.taskType] = s.strategyName;
          bestRateByType[s.taskType] = rate;
        }
      }
    }

    const patterns = await db
      .select()
      .from(failure_patterns)
      .where(eq(failure_patterns.resolved, false))
      .orderBy(desc(failure_patterns.occurrenceCount))
      .limit(15);

    for (const p of patterns) {
      commonFailureModes.push(`${p.patternName} (${p.occurrenceCount}x, ${p.severity})`);
    }
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to build self-model`);
  }

  const recentSuccess = recentOutcomes.slice(-50);
  const recentSuccessRate = recentSuccess.length > 0
    ? recentSuccess.filter(o => o.success).length / recentSuccess.length
    : 0.5;

  const selfCorrectionRate = computeSelfCorrectionRate();
  const cognitiveLoad = readCognitiveLoad();
  const epistemicState = readEpistemicState();

  const causalInsights = await getRecentCausalInsights();
  const metaMetaCognition = computeMetaMetaCognition();
  const personalityProfile = computePersonalityProfile();

  return {
    strengths: strengths.length > 0 ? strengths : ["System initializing — accumulating statistical evidence"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Insufficient trial data for weakness identification"],
    commonFailureModes: commonFailureModes.length > 0 ? commonFailureModes : ["No failure patterns recorded yet"],
    bestStrategiesByType,
    uncertaintyCalibration: recentSuccessRate,
    selfCorrectionRate,
    cognitiveLoad,
    epistemicState,
    causalInsights,
    metaMetaCognition,
    personalityProfile,
  };
}

function computeSelfCorrectionRate(): number {
  const recent = recentOutcomes.slice(-30);
  if (recent.length < 3) return 0;

  let corrections = 0;
  let failureRuns = 0;

  for (let i = 1; i < recent.length; i++) {
    if (!recent[i - 1].success && recent[i].success) {
      corrections++;
    }
    if (!recent[i - 1].success) {
      failureRuns++;
    }
  }

  return failureRuns > 0 ? corrections / failureRuns : 1;
}

async function getRecentCausalInsights(): Promise<CausalInsight[]> {
  try {
    const rows = await db
      .select({
        triggerEngine: causal_analysis.triggerEngine,
        effectObserved: causal_analysis.effectObserved,
        confidence: causal_analysis.confidence,
        interventionSuggested: causal_analysis.interventionSuggested,
        validated: causal_analysis.validated,
      })
      .from(causal_analysis)
      .orderBy(desc(causal_analysis.createdAt))
      .limit(10);

    return rows.map(r => ({
      triggerEngine: r.triggerEngine,
      effectObserved: r.effectObserved,
      confidence: r.confidence,
      interventionSuggested: r.interventionSuggested,
      validated: r.validated,
    }));
  } catch {
    return [];
  }
}

function computeMetaMetaCognition(): SelfModel["metaMetaCognition"] {
  const allSuccessRates: number[] = [];
  const windowSize = 10;
  for (let i = 0; i <= recentOutcomes.length - windowSize; i += windowSize) {
    const window = recentOutcomes.slice(i, i + windowSize);
    allSuccessRates.push(window.filter(o => o.success).length / windowSize);
  }

  const selfModelAccuracy = allSuccessRates.length >= 2
    ? 1 - Math.abs(allSuccessRates[allSuccessRates.length - 1] - allSuccessRates[allSuccessRates.length - 2])
    : 0.5;

  const predictionCalibration = predictions.length > 0
    ? 1 - predictions.filter(p => p.predicted === null && p.expectedBy < Date.now()).length / Math.max(1, predictions.length)
    : 0.5;

  const reflectionCount = recentOutcomes.filter(o => o.taskType === "reflection").length;
  const reflectionDepth = Math.min(1, reflectionCount / 20);

  const adaptationCount = engineEventBuffer.filter(e => e.event.includes("adapt") || e.event.includes("strategy")).length;
  const adaptationEffectiveness = Math.min(1, adaptationCount / 10);

  return { selfModelAccuracy, predictionCalibration, reflectionDepth, adaptationEffectiveness };
}

function computePersonalityProfile(): SelfModel["personalityProfile"] {
  const recent = recentOutcomes.slice(-50);

  const typeDistribution: Record<string, number> = {};
  for (const o of recent) {
    typeDistribution[o.taskType] = (typeDistribution[o.taskType] ?? 0) + 1;
  }
  const typeCounts = Object.values(typeDistribution);
  const explorationTendency = typeCounts.length > 0
    ? computeEntropy(typeCounts) / Math.log2(Math.max(2, typeCounts.length))
    : 0.5;

  const failureRate = recent.length > 0 ? recent.filter(o => !o.success).length / recent.length : 0.5;
  const riskTolerance = 1 - failureRate;

  const learningWindows = [];
  for (let i = 0; i < recent.length - 5; i += 5) {
    learningWindows.push(recent.slice(i, i + 5).filter(o => o.success).length / 5);
  }
  const learningRate = learningWindows.length >= 2
    ? Math.max(0, learningWindows[learningWindows.length - 1] - learningWindows[0])
    : 0;

  const durations = recent.map(o => o.durationMs);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const durationVariance = durations.length > 0
    ? durations.reduce((acc, v) => acc + (v - avgDuration) ** 2, 0) / durations.length
    : 0;
  const consistencyScore = avgDuration > 0 ? Math.max(0, 1 - Math.sqrt(durationVariance) / avgDuration) : 0.5;

  return { explorationTendency, riskTolerance, learningRate, consistencyScore };
}

async function recordFailurePattern(mistakes: string[], taskId: string): Promise<void> {
  for (const mistake of mistakes) {
    const category = classifyMistake(mistake);
    const severity = classifySeverity(mistake);
    try {
      const existing = await db
        .select()
        .from(failure_patterns)
        .where(eq(failure_patterns.patternName, category))
        .limit(1);

      if (existing.length > 0) {
        const newCount = (existing[0].occurrenceCount ?? 0) + 1;
        const escalatedSeverity = newCount >= 10 ? "critical" : newCount >= 5 ? "high" : severity;

        await db
          .update(failure_patterns)
          .set({
            occurrenceCount: newCount,
            severity: escalatedSeverity,
            lastOccurredAt: new Date(),
            description: `${existing[0].description.substring(0, 1000)} | ${taskId}: ${mistake.substring(0, 200)}`,
          })
          .where(eq(failure_patterns.id, existing[0].id));
      } else {
        await db.insert(failure_patterns).values({
          patternName: category,
          description: `${taskId}: ${mistake.substring(0, 500)}`,
          severity,
          category,
          occurrenceCount: 1,
        });
      }
    } catch (err) {
      logger.warn({ err }, `${LOG_PREFIX} Failed to record failure pattern`);
    }
  }
}

function classifyMistake(mistake: string): string {
  const lower = mistake.toLowerCase();
  const patterns: [string[], string][] = [
    [["hallucin", "confabulat", "invented", "fabricat"], "hallucination"],
    [["assumption", "assumed", "presuppos"], "wrong_assumption"],
    [["type", "typescript", "typecheck"], "type_error"],
    [["timeout", "slow", "latenc", "performance", "bottleneck"], "performance"],
    [["missing", "undefined", "null", "not found"], "missing_context"],
    [["test", "assert", "expect", "failed"], "test_failure"],
    [["import", "dependency", "module", "require"], "dependency_issue"],
    [["schema", "migration", "column", "table"], "schema_mismatch"],
    [["security", "auth", "permission", "access"], "security"],
    [["memory", "heap", "oom", "leak"], "memory_issue"],
    [["network", "connection", "socket", "dns"], "network_failure"],
    [["concurren", "race", "deadlock", "lock"], "concurrency"],
    [["logic", "algorithm", "incorrect", "wrong result"], "logic_error"],
    [["data", "corrupt", "inconsisten", "integrity"], "data_integrity"],
  ];

  for (const [keywords, category] of patterns) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return "general";
}

function classifySeverity(mistake: string): string {
  const lower = mistake.toLowerCase();
  if (lower.includes("critical") || lower.includes("crash") || lower.includes("data loss") || lower.includes("security")) return "critical";
  if (lower.includes("degraded") || lower.includes("error") || lower.includes("failed")) return "high";
  if (lower.includes("warning") || lower.includes("slow")) return "medium";
  return "low";
}

async function runMetacognitiveCycle(): Promise<void> {
  cyclesRun++;
  lastCycleAt = Date.now();
  const startMs = Date.now();

  logger.info(`${LOG_PREFIX} Metacognitive cycle ${cyclesRun} starting — PLAN→EXECUTE→REFLECT→ADAPT`);

  const awarenessState = getAwarenessState();
  const autonomyStatus = getAutonomyLoopStatus() as Record<string, unknown>;

  const compositeScore = awarenessState?.compositeScore ?? 0;
  const autonomyScore = Number(autonomyStatus?.autonomyScore ?? 0);

  const predictionId = registerPrediction(
    `Cycle ${cyclesRun} will complete successfully with improved self-model`,
    "metacognitive_self_evaluation"
  );

  const plan = await planTask(
    "metacognitive_self_evaluation",
    `Evaluate system coherence and improvement trajectory. Awareness: ${compositeScore}, Autonomy: ${autonomyScore}. Engines tracked: ${engineLatencies.size}. Anomalies: ${anomalyLog.length}`,
    {
      risks: [
        "Insufficient historical data for meaningful self-assessment",
        "Circular self-evaluation bias",
        cognitiveLoadHistory.length > 0 && cognitiveLoadHistory[cognitiveLoadHistory.length - 1].load > 60
          ? "High cognitive load may degrade self-model quality"
          : "Normal cognitive load",
      ],
      assumptions: [
        "Engine metrics are accurate",
        "DB contains representative data",
        `${recentOutcomes.length} recent outcomes provide sufficient signal`,
      ],
      expectedOutcome: "Updated self-model with actionable improvement insights and calibrated predictions",
      uncertaintyLevel: cyclesRun < 5 ? 0.7 : cyclesRun < 20 ? 0.4 : 0.2,
      engineSource: "metacognition",
    }
  );

  let selfModel: SelfModel;
  let success = true;
  const mistakes: string[] = [];
  const lessons: string[] = [];
  const adaptations: string[] = [];

  try {
    selfModel = await buildSelfModel();

    if (selfModel.strengths.length === 1 && selfModel.strengths[0].includes("initializing") && cyclesRun > 15) {
      mistakes.push(`Failed to identify concrete strengths after ${cyclesRun} cycles — need more diverse task types`);
    }

    if (selfModel.commonFailureModes.length > 5) {
      lessons.push(`${selfModel.commonFailureModes.length} active failure patterns — focusing on top 3 for resolution`);
      adaptations.push("Allocate 40% of next cycle to resolving top failure pattern");
    }

    if (selfModel.selfCorrectionRate > 0.6) {
      lessons.push(`Strong self-correction: ${(selfModel.selfCorrectionRate * 100).toFixed(0)}% recovery after failures`);
    } else if (selfModel.selfCorrectionRate < 0.3 && recentOutcomes.length > 10) {
      weaknessLesson(mistakes, `Poor self-correction rate (${(selfModel.selfCorrectionRate * 100).toFixed(0)}%) — failures tend to cascade`);
      adaptations.push("Implement circuit-breaker pattern for failure-prone engines");
    }

    if (selfModel.cognitiveLoad.overloaded) {
      lessons.push(`Cognitive overload detected (${selfModel.cognitiveLoad.load.toFixed(0)}%) — bottleneck: ${selfModel.cognitiveLoad.bottleneck ?? "unknown"}`);
      adaptations.push(`Reduce load on ${selfModel.cognitiveLoad.bottleneck ?? "most active engine"}`);
    }

    if (selfModel.cognitiveLoad.trend === "increasing") {
      lessons.push("Cognitive load trending upward — efficiency may be declining");
    }

    if (selfModel.epistemicState.knownUnknowns.length > 0) {
      lessons.push(`${selfModel.epistemicState.knownUnknowns.length} known unknowns identified: ${selfModel.epistemicState.knownUnknowns.slice(0, 2).join("; ")}`);
    }

    if (selfModel.epistemicState.calibrationScore < 0.5) {
      weaknessLesson(mistakes, `Poor epistemic calibration (${(selfModel.epistemicState.calibrationScore * 100).toFixed(0)}%) — predictions don't match outcomes`);
      adaptations.push("Recalibrate prediction model with recent outcome data");
    }

    if (selfModel.causalInsights.length > 0) {
      const topCausal = selfModel.causalInsights[0];
      lessons.push(`Causal analysis: ${topCausal.triggerEngine} → "${topCausal.effectObserved.substring(0, 80)}" (confidence: ${(topCausal.confidence * 100).toFixed(0)}%)`);
      if (topCausal.interventionSuggested) {
        adaptations.push(topCausal.interventionSuggested);
      }
    }

    if (selfModel.metaMetaCognition.selfModelAccuracy < 0.5) {
      lessons.push("Meta-meta: Self-model predictions are unstable — need more data or better features");
    }

    if (selfModel.personalityProfile.learningRate > 0.1) {
      lessons.push(`Positive learning trajectory: ${(selfModel.personalityProfile.learningRate * 100).toFixed(0)}% improvement in success rate`);
    }

    if (compositeScore > 0.7) {
      lessons.push(`High awareness composite (${compositeScore.toFixed(2)}) — consciousness integration healthy`);
    }

    analyzeImprovementTrajectory(lessons, mistakes, adaptations);
  } catch (err) {
    success = false;
    mistakes.push(`Self-model build failed: ${err instanceof Error ? err.message : String(err)}`);
    selfModel = createFallbackSelfModel();
  }

  const durationMs = Date.now() - startMs;
  resolvePrediction(predictionId, success);

  await reflectOnTask({
    taskId: plan.taskId,
    actualOutcome: success
      ? `Self-model built: ${selfModel.strengths.length} strengths, ${selfModel.weaknesses.length} weaknesses, ${selfModel.commonFailureModes.length} failure modes, ${selfModel.causalInsights.length} causal insights, load: ${selfModel.cognitiveLoad.load.toFixed(0)}%`
      : "Self-model build failed",
    success,
    mistakes,
    lessonsLearned: lessons,
    adaptations,
    confidenceAfter: success ? Math.min(0.95, plan.confidenceBefore + 0.03) : Math.max(0.1, plan.confidenceBefore - 0.08),
    durationMs,
  });

  await adaptStrategies("metacognitive_self_evaluation", "full_self_model_build", success, durationMs);

  logger.info(
    {
      cycle: cyclesRun,
      success,
      strengths: selfModel.strengths.length,
      weaknesses: selfModel.weaknesses.length,
      failurePatterns: selfModel.commonFailureModes.length,
      causalInsights: selfModel.causalInsights.length,
      cognitiveLoad: selfModel.cognitiveLoad.load.toFixed(1),
      epistemicDomains: selfModel.epistemicState.totalDomains,
      anomalies: anomalyLog.length,
      durationMs,
    },
    `${LOG_PREFIX} Metacognitive cycle ${cyclesRun} complete`
  );
}

function weaknessLesson(mistakes: string[], msg: string): void {
  mistakes.push(msg);
}

function analyzeImprovementTrajectory(lessons: string[], mistakes: string[], adaptations: string[]): void {
  const recent = recentOutcomes.slice(-30);
  if (recent.length < 10) return;

  const thirds = Math.floor(recent.length / 3);
  const first = recent.slice(0, thirds).filter(o => o.success).length / thirds;
  const second = recent.slice(thirds, thirds * 2).filter(o => o.success).length / thirds;
  const third = recent.slice(thirds * 2).filter(o => o.success).length / (recent.length - thirds * 2);

  if (third > first + 0.1 && third > second) {
    lessons.push(`Accelerating improvement: ${(first * 100).toFixed(0)}% → ${(second * 100).toFixed(0)}% → ${(third * 100).toFixed(0)}%`);
  } else if (third < first - 0.1) {
    mistakes.push(`Performance regression: ${(first * 100).toFixed(0)}% → ${(second * 100).toFixed(0)}% → ${(third * 100).toFixed(0)}%`);
    adaptations.push("Review and rollback recent strategy changes");
  } else if (Math.abs(third - first) < 0.05 && recent.length >= 20) {
    lessons.push(`Performance plateau at ${(third * 100).toFixed(0)}% — consider strategy diversification`);
    adaptations.push("Increase exploration via Thompson sampling temperature");
  }

  const durationTrend = recent.map(o => o.durationMs);
  const earlyDuration = durationTrend.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const lateDuration = durationTrend.slice(-5).reduce((a, b) => a + b, 0) / 5;
  if (earlyDuration > 0 && lateDuration > earlyDuration * 1.5) {
    lessons.push(`Duration increasing: ${earlyDuration.toFixed(0)}ms → ${lateDuration.toFixed(0)}ms — possible performance degradation`);
  } else if (earlyDuration > 0 && lateDuration < earlyDuration * 0.7) {
    lessons.push(`Duration improving: ${earlyDuration.toFixed(0)}ms → ${lateDuration.toFixed(0)}ms — operations becoming more efficient`);
  }
}

function createFallbackSelfModel(): SelfModel {
  return {
    strengths: [],
    weaknesses: ["Self-model build failed"],
    commonFailureModes: [],
    bestStrategiesByType: {},
    uncertaintyCalibration: 0.5,
    selfCorrectionRate: 0,
    cognitiveLoad: {
      load: 0,
      activeEngines: 0,
      avgLatencyMs: 0,
      memoryPressureMb: process.memoryUsage().heapUsed / 1024 / 1024,
      bottleneck: null,
      overloaded: false,
      trend: "stable",
    },
    epistemicState: {
      totalDomains: 0,
      avgCertainty: 0.5,
      knownUnknowns: [],
      calibrationScore: 0.5,
      predictionAccuracy: 0.5,
      recentPredictions: [],
    },
    causalInsights: [],
    metaMetaCognition: {
      selfModelAccuracy: 0.5,
      predictionCalibration: 0.5,
      reflectionDepth: 0,
      adaptationEffectiveness: 0,
    },
    personalityProfile: {
      explorationTendency: 0.5,
      riskTolerance: 0.5,
      learningRate: 0,
      consistencyScore: 0.5,
    },
  };
}

export async function getMetacognitionStatus(): Promise<MetacognitiveState> {
  let totalTasks = 0;
  let successRate = 0;
  let avgConfidenceGain = 0;
  let avgDivergence = 0;
  let topStrategies: MetacognitiveState["topStrategies"] = [];
  let activeFailurePatterns: MetacognitiveState["activeFailurePatterns"] = [];
  let recentReflections: MetacognitiveState["recentReflections"] = [];

  try {
    const countResult = await db.select({ count: count() }).from(metacognition_log);
    totalTasks = countResult[0]?.count ?? 0;

    const successResult = await db
      .select({
        successCount: sql<number>`COALESCE(SUM(CASE WHEN success = true THEN 1 ELSE 0 END), 0)`,
        total: sql<number>`COUNT(*)`,
        avgGain: sql<number>`COALESCE(AVG(confidence_after - confidence_before), 0)`,
        avgDiv: sql<number>`COALESCE(AVG(divergence), 0)`,
      })
      .from(metacognition_log)
      .where(eq(metacognition_log.phase, "reflect"));

    const sr = successResult[0];
    if (sr && Number(sr.total) > 0) {
      successRate = Number(sr.successCount) / Number(sr.total);
      avgConfidenceGain = Number(sr.avgGain);
      avgDivergence = Number(sr.avgDiv);
    }

    const strategyRows = await db
      .select({
        taskType: strategy_preferences.taskType,
        strategyName: strategy_preferences.strategyName,
        preferenceScore: strategy_preferences.preferenceScore,
        successCount: strategy_preferences.successCount,
        failureCount: strategy_preferences.failureCount,
      })
      .from(strategy_preferences)
      .orderBy(desc(strategy_preferences.preferenceScore))
      .limit(15);

    topStrategies = strategyRows.map(s => ({
      taskType: s.taskType,
      strategyName: s.strategyName,
      preferenceScore: s.preferenceScore ?? 0.5,
      trialCount: (s.successCount ?? 0) + (s.failureCount ?? 0),
    }));

    activeFailurePatterns = await db
      .select({
        patternName: failure_patterns.patternName,
        occurrenceCount: failure_patterns.occurrenceCount,
        severity: failure_patterns.severity,
        category: failure_patterns.category,
      })
      .from(failure_patterns)
      .where(eq(failure_patterns.resolved, false))
      .orderBy(desc(failure_patterns.occurrenceCount))
      .limit(15);

    const recent = await db
      .select({
        taskId: metacognition_log.taskId,
        taskType: metacognition_log.taskType,
        success: metacognition_log.success,
        divergence: metacognition_log.divergence,
        lessonsLearned: metacognition_log.lessonsLearned,
        createdAt: metacognition_log.createdAt,
      })
      .from(metacognition_log)
      .where(eq(metacognition_log.phase, "reflect"))
      .orderBy(desc(metacognition_log.createdAt))
      .limit(30);

    recentReflections = recent.map(r => ({
      taskId: r.taskId,
      taskType: r.taskType,
      success: r.success ?? false,
      divergence: r.divergence,
      lessonsLearned: r.lessonsLearned as unknown[],
      createdAt: r.createdAt,
    }));
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Failed to fetch metacognition status`);
  }

  const selfModel = await buildSelfModel();

  const improvementTrajectory = recentOutcomes.length >= 5
    ? chunkArray(recentOutcomes, 5).map(chunk =>
        chunk.filter(o => o.success).length / chunk.length
      )
    : [];

  const crossSessionImprovement = await computeCrossSessionImprovement();

  return {
    totalTasks,
    successRate,
    avgConfidenceGain,
    avgDivergence,
    topStrategies,
    activeFailurePatterns,
    recentReflections,
    selfModel,
    cyclesRun,
    lastCycleAt,
    improvementTrajectory,
    cognitiveLoadHistory: cognitiveLoadHistory.slice(-50),
    anomalies: anomalyLog.slice(-20),
    crossSessionImprovement,
  };
}

async function computeCrossSessionImprovement(): Promise<MetacognitiveState["crossSessionImprovement"]> {
  try {
    const snapshots = await db
      .select({
        decisionQuality: cognitive_state_snapshots.decisionQuality,
        coherenceScore: cognitive_state_snapshots.coherenceScore,
        cognitiveLoad: cognitive_state_snapshots.cognitiveLoad,
        awarenessLevel: cognitive_state_snapshots.awarenessLevel,
        autonomyLevel: cognitive_state_snapshots.autonomyLevel,
      })
      .from(cognitive_state_snapshots)
      .orderBy(asc(cognitive_state_snapshots.createdAt))
      .limit(100);

    if (snapshots.length < 5) return [];

    const first5 = snapshots.slice(0, 5);
    const last5 = snapshots.slice(-5);

    const metrics: { metric: string; startValue: number; currentValue: number }[] = [
      {
        metric: "decision_quality",
        startValue: avg(first5.map(s => s.decisionQuality)),
        currentValue: avg(last5.map(s => s.decisionQuality)),
      },
      {
        metric: "coherence",
        startValue: avg(first5.map(s => s.coherenceScore)),
        currentValue: avg(last5.map(s => s.coherenceScore)),
      },
      {
        metric: "cognitive_efficiency",
        startValue: 1 - avg(first5.map(s => s.cognitiveLoad)) / 100,
        currentValue: 1 - avg(last5.map(s => s.cognitiveLoad)) / 100,
      },
      {
        metric: "awareness",
        startValue: avg(first5.map(s => s.awarenessLevel)),
        currentValue: avg(last5.map(s => s.awarenessLevel)),
      },
      {
        metric: "autonomy",
        startValue: avg(first5.map(s => s.autonomyLevel)),
        currentValue: avg(last5.map(s => s.autonomyLevel)),
      },
    ];

    return metrics.map(m => ({
      ...m,
      changePercent: m.startValue > 0
        ? ((m.currentValue - m.startValue) / m.startValue) * 100
        : m.currentValue > 0 ? 100 : 0,
    }));
  } catch {
    return [];
  }
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function getCognitiveLoadStatus(): CognitiveLoadState {
  return readCognitiveLoad();
}

export function getEpistemicStatus(): EpistemicState {
  return readEpistemicState();
}

export async function getCausalAnalyses(limit = 20): Promise<CausalInsight[]> {
  return getRecentCausalInsights();
}

export function getAnomalies(): typeof anomalyLog {
  return [...anomalyLog];
}

export function getEngineHealth(): Record<string, { avgLatencyMs: number; sampleCount: number; recentFailures: number }> {
  const health: Record<string, { avgLatencyMs: number; sampleCount: number; recentFailures: number }> = {};
  const now = Date.now();
  for (const [engine, latencies] of engineLatencies) {
    const recentFailures = engineEventBuffer
      .filter(e => e.engine === engine && e.timestamp > now - 300_000 && !e.success).length;
    health[engine] = {
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1),
      sampleCount: latencies.length,
      recentFailures,
    };
  }
  return health;
}

export function startMetacognitionLoop(intervalMs = 600_000): void {
  if (continuousInterval) return;
  logger.info(`${LOG_PREFIX} Starting metacognition loop (interval: ${intervalMs / 1000}s)`);

  runMetacognitiveCycle().catch(err =>
    logger.error({ err }, `${LOG_PREFIX} Initial metacognitive cycle failed`)
  );

  continuousInterval = setInterval(() => {
    runMetacognitiveCycle().catch(err =>
      logger.error({ err }, `${LOG_PREFIX} Metacognitive cycle failed`)
    );
  }, intervalMs);

  snapshotInterval = setInterval(() => {
    captureCognitiveSnapshot().catch(err =>
      logger.warn({ err }, `${LOG_PREFIX} Cognitive snapshot failed`)
    );
  }, 120_000);
}

export function stopMetacognitionLoop(): void {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
  }
  if (snapshotInterval) {
    clearInterval(snapshotInterval);
    snapshotInterval = null;
  }
  logger.info(`${LOG_PREFIX} Metacognition loop stopped`);
}
