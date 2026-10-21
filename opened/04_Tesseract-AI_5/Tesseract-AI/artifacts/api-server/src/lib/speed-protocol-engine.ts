import { db } from "@workspace/db";
import { sovereignty_metrics, training_pipeline } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";
import { logger } from "./logger";
import { recordEngineEvent } from "./metacognition-engine";

const LOG_PREFIX = "[SpeedProtocol]";

interface SpeedMetrics {
  dbQueryLatencyMs: number;
  apiResponseLatencyMs: number;
  knowledgeAbsorptionDurationMs: number;
  memoryUsageMB: number;
  uptimeSeconds: number;
  requestsPerMinute: number;
  dbConnectionActive: boolean;
  cycleCount: number;
}

let speedCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;
let requestTimestamps: number[] = [];
const startupTime = Date.now();

export function recordRequestTimestamp() {
  requestTimestamps.push(Date.now());
  if (requestTimestamps.length > 1000) {
    requestTimestamps = requestTimestamps.slice(-500);
  }
}

let lastAbsorptionDuration = 0;
export function recordAbsorptionDuration(ms: number) {
  lastAbsorptionDuration = ms;
}

let metrics: SpeedMetrics = {
  dbQueryLatencyMs: 0,
  apiResponseLatencyMs: 0,
  knowledgeAbsorptionDurationMs: 0,
  memoryUsageMB: 0,
  uptimeSeconds: 0,
  requestsPerMinute: 0,
  dbConnectionActive: false,
  cycleCount: 0,
};

async function measureDbLatency(): Promise<number> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return Date.now() - start;
  } catch {
    return -1;
  }
}

async function measureDbQueryPerformance(): Promise<number> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT COUNT(*) FROM knowledge_graph`);
    return Date.now() - start;
  } catch {
    return -1;
  }
}

function measureMemoryUsage(): number {
  const mem = process.memoryUsage();
  return Math.round(mem.heapUsed / 1024 / 1024);
}

function measureUptime(): number {
  return Math.round((Date.now() - startupTime) / 1000);
}

function measureRequestRate(): number {
  const oneMinuteAgo = Date.now() - 60000;
  const recent = requestTimestamps.filter(t => t > oneMinuteAgo);
  return recent.length;
}

function computePerformanceScore(): number {
  let score = 0;
  if (metrics.dbConnectionActive) score += 20;
  if (metrics.dbQueryLatencyMs > 0 && metrics.dbQueryLatencyMs < 50) score += 20;
  else if (metrics.dbQueryLatencyMs > 0 && metrics.dbQueryLatencyMs < 200) score += 10;
  if (metrics.memoryUsageMB < 512) score += 20;
  else if (metrics.memoryUsageMB < 1024) score += 10;
  if (metrics.uptimeSeconds > 300) score += 20;
  else if (metrics.uptimeSeconds > 60) score += 10;
  if (metrics.knowledgeAbsorptionDurationMs > 0 && metrics.knowledgeAbsorptionDurationMs < 10000) score += 20;
  else if (metrics.knowledgeAbsorptionDurationMs > 0 && metrics.knowledgeAbsorptionDurationMs < 30000) score += 10;
  return score;
}

export async function runSpeedOptimizationCycle(): Promise<{
  cycleNumber: number;
  improvements: Record<string, number | boolean>;
  metrics: SpeedMetrics;
  throughput: number;
}> {
  speedCycleCount++;
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} SPEED MEASUREMENT CYCLE #${speedCycleCount}`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  const improvements: Record<string, number | boolean> = {};

  console.log(`${LOG_PREFIX} [Step 1] Measuring database latency (real query)`);
  const pingLatency = await measureDbLatency();
  const queryLatency = await measureDbQueryPerformance();
  metrics.dbQueryLatencyMs = queryLatency;
  metrics.dbConnectionActive = pingLatency >= 0;
  improvements.dbPingMs = pingLatency;
  improvements.dbQueryMs = queryLatency;

  console.log(`${LOG_PREFIX} [Step 2] Measuring system resources (real)`);
  metrics.memoryUsageMB = measureMemoryUsage();
  metrics.uptimeSeconds = measureUptime();
  improvements.memoryMB = metrics.memoryUsageMB;
  improvements.uptimeSeconds = metrics.uptimeSeconds;

  console.log(`${LOG_PREFIX} [Step 3] Measuring request throughput (real)`);
  metrics.requestsPerMinute = measureRequestRate();
  improvements.requestsPerMinute = metrics.requestsPerMinute;

  console.log(`${LOG_PREFIX} [Step 4] Recording absorption performance`);
  metrics.knowledgeAbsorptionDurationMs = lastAbsorptionDuration;
  metrics.cycleCount = speedCycleCount;
  improvements.absorptionMs = lastAbsorptionDuration;

  const performanceScore = computePerformanceScore();

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 5", phaseNumber: 5, metricName: "DB Query Latency", currentValue: metrics.dbQueryLatencyMs, targetValue: 50, unit: "ms", status: "measured" },
      { phase: "Phase 5", phaseNumber: 5, metricName: "Memory Usage", currentValue: metrics.memoryUsageMB, targetValue: 512, unit: "MB", status: "measured" },
      { phase: "Phase 5", phaseNumber: 5, metricName: "Uptime", currentValue: metrics.uptimeSeconds, targetValue: 3600, unit: "seconds", status: "measured" },
      { phase: "Phase 5", phaseNumber: 5, metricName: "Requests/min", currentValue: metrics.requestsPerMinute, targetValue: 100, unit: "count", status: "measured" },
      { phase: "Phase 5", phaseNumber: 5, metricName: "Performance Score", currentValue: performanceScore, targetValue: 100, unit: "percent", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  await updatePhaseProgress(5, performanceScore, "in_progress").catch(() => {});

  const duration = Date.now() - startTime;
  recordEngineEvent("speed_protocol", "performance_cycle", performanceScore > 30, duration, {
    cycleNumber: speedCycleCount,
    dbLatencyMs: metrics.dbQueryLatencyMs,
    memoryMB: metrics.memoryUsageMB,
    performanceScore,
  });

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} CYCLE #${speedCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} DB Latency: ${metrics.dbQueryLatencyMs}ms | Memory: ${metrics.memoryUsageMB}MB`);
  console.log(`${LOG_PREFIX} Uptime: ${metrics.uptimeSeconds}s | Requests/min: ${metrics.requestsPerMinute}`);
  console.log(`${LOG_PREFIX} Performance Score: ${performanceScore}% | Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return { cycleNumber: speedCycleCount, improvements, metrics: { ...metrics }, throughput: performanceScore };
}

export function getSpeedProtocolStatus() {
  return {
    cycleCount: speedCycleCount,
    metrics: { ...metrics },
    continuousOptimizationActive: continuousInterval !== null,
    throughput: computePerformanceScore(),
    accelerationFeatures: {
      dbConnected: metrics.dbConnectionActive,
      lowLatency: metrics.dbQueryLatencyMs > 0 && metrics.dbQueryLatencyMs < 50,
      memoryHealthy: metrics.memoryUsageMB < 512,
      stable: metrics.uptimeSeconds > 300,
    },
  };
}

export function startContinuousSpeedOptimization() {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting continuous speed measurement (every 12 minutes)`);
  runSpeedOptimizationCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err));
  continuousInterval = setInterval(() => {
    runSpeedOptimizationCycle().catch(err => console.error(`${LOG_PREFIX} Cycle failed:`, err));
  }, 12 * 60 * 1000);
}

export function stopContinuousSpeedOptimization() {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Continuous speed measurement stopped`);
  }
}
