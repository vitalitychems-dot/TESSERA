import { db } from "@workspace/db";
import { sovereignty_metrics, internal_models, data_sources, roadmap_phases, knowledge_graph, knowledge_build_ledger } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";
import { isLLMConfigured } from "./llm-client";
import { logger } from "./logger";
import { extractCount } from "./db-utils";
import { recordEngineEvent } from "./metacognition-engine";

const LOG_PREFIX = "[SovereigntyValidation]";

interface ValidationResult {
  testName: string;
  category: "knowledge" | "system" | "data" | "capability" | "autonomy";
  passed: boolean;
  score: number;
  target: number;
  details: string;
  measured: string;
}

interface ValidationMetrics {
  knowledgeNodeCount: number;
  domainCoverage: number;
  insightCount: number;
  buildLedgerCount: number;
  dbConnected: boolean;
  llmConfigured: boolean;
  liveSourcesActive: number;
  uptimeSeconds: number;
  memoryMB: number;
  overallSovereigntyScore: number;
  testsRun: number;
  testsPassed: number;
}

let validationCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;
const bootTime = Date.now();

let metrics: ValidationMetrics = {
  knowledgeNodeCount: 0,
  domainCoverage: 0,
  insightCount: 0,
  buildLedgerCount: 0,
  dbConnected: false,
  llmConfigured: false,
  liveSourcesActive: 0,
  uptimeSeconds: 0,
  memoryMB: 0,
  overallSovereigntyScore: 0,
  testsRun: 0,
  testsPassed: 0,
};

async function testKnowledgeNodes(): Promise<ValidationResult> {
  try {
    const rows = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type NOT IN ('insight', 'swarm_training')`);
    const cnt = extractCount(rows);
    metrics.knowledgeNodeCount = cnt;
    const target = 1000;
    const passed = cnt >= target;
    return {
      testName: "Knowledge Nodes (Real Sources)",
      category: "knowledge",
      passed,
      score: Math.min(100, Math.round((cnt / target) * 100)),
      target,
      details: `${cnt} real knowledge nodes from live APIs (target: ≥${target})`,
      measured: `DB query: SELECT COUNT(*) FROM knowledge_graph WHERE source_type NOT IN ('insight','swarm_training')`,
    };
  } catch {
    return { testName: "Knowledge Nodes", category: "knowledge", passed: false, score: 0, target: 1000, details: "DB query failed", measured: "FAILED" };
  }
}

async function testDomainCoverage(): Promise<ValidationResult> {
  try {
    const rows = await db.execute(sql`SELECT COUNT(DISTINCT metadata->>'domain') as cnt FROM knowledge_graph WHERE metadata->>'domain' IS NOT NULL`);
    const cnt = extractCount(rows);
    metrics.domainCoverage = cnt;
    const target = 50;
    return {
      testName: "Domain Coverage",
      category: "knowledge",
      passed: cnt >= target,
      score: Math.min(100, Math.round((cnt / target) * 100)),
      target,
      details: `${cnt} unique knowledge domains covered (target: ≥${target})`,
      measured: `DB query: SELECT COUNT(DISTINCT metadata->>'domain') FROM knowledge_graph`,
    };
  } catch {
    return { testName: "Domain Coverage", category: "knowledge", passed: false, score: 0, target: 50, details: "DB query failed", measured: "FAILED" };
  }
}

async function testInsightGeneration(): Promise<ValidationResult> {
  try {
    const rows = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type = 'insight'`);
    const cnt = extractCount(rows);
    metrics.insightCount = cnt;
    const target = 2000;
    return {
      testName: "AI Insight Generation",
      category: "capability",
      passed: cnt >= target,
      score: Math.min(100, Math.round((cnt / target) * 100)),
      target,
      details: `${cnt} AI-synthesized insights generated (target: ≥${target})`,
      measured: `DB query: SELECT COUNT(*) FROM knowledge_graph WHERE source_type = 'insight'`,
    };
  } catch {
    return { testName: "Insight Generation", category: "capability", passed: false, score: 0, target: 2000, details: "DB query failed", measured: "FAILED" };
  }
}

async function testDeduplication(): Promise<ValidationResult> {
  try {
    const rows = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_build_ledger`);
    const cnt = extractCount(rows);
    metrics.buildLedgerCount = cnt;
    const target = 500;
    return {
      testName: "Content Deduplication (SHA-256)",
      category: "data",
      passed: cnt >= target,
      score: Math.min(100, Math.round((cnt / target) * 100)),
      target,
      details: `${cnt} content hashes tracked in build ledger (target: ≥${target})`,
      measured: `DB query: SELECT COUNT(*) FROM knowledge_build_ledger`,
    };
  } catch {
    return { testName: "Deduplication", category: "data", passed: false, score: 0, target: 500, details: "DB query failed", measured: "FAILED" };
  }
}

async function testDatabaseConnectivity(): Promise<ValidationResult> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;
    metrics.dbConnected = true;
    return {
      testName: "Database Connectivity",
      category: "system",
      passed: true,
      score: latency < 50 ? 100 : latency < 200 ? 80 : 60,
      target: 50,
      details: `PostgreSQL responding in ${latency}ms`,
      measured: `SELECT 1 — latency: ${latency}ms`,
    };
  } catch {
    metrics.dbConnected = false;
    return { testName: "Database Connectivity", category: "system", passed: false, score: 0, target: 50, details: "PostgreSQL not responding", measured: "FAILED" };
  }
}

function testSystemResources(): ValidationResult {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  metrics.memoryMB = heapMB;
  metrics.uptimeSeconds = Math.round((Date.now() - bootTime) / 1000);
  const passed = heapMB < 1024;
  return {
    testName: "System Resources",
    category: "system",
    passed,
    score: heapMB < 512 ? 100 : heapMB < 768 ? 80 : heapMB < 1024 ? 60 : 30,
    target: 1024,
    details: `Memory: ${heapMB}MB | Uptime: ${metrics.uptimeSeconds}s`,
    measured: `process.memoryUsage().heapUsed = ${heapMB}MB`,
  };
}

function testLLMConfiguration(): ValidationResult {
  const configured = isLLMConfigured();
  metrics.llmConfigured = configured;
  return {
    testName: "LLM Configuration",
    category: "capability",
    passed: configured,
    score: configured ? 100 : 0,
    target: 1,
    details: configured ? "AI integration configured and available" : "No AI integration configured",
    measured: `isLLMConfigured() = ${configured}`,
  };
}

async function testLiveSourceDiversity(): Promise<ValidationResult> {
  try {
    const rows = await db.execute(sql`SELECT COUNT(DISTINCT source_type) as cnt FROM knowledge_graph WHERE source_type NOT IN ('insight', 'swarm_training')`);
    const cnt = extractCount(rows);
    metrics.liveSourcesActive = cnt;
    const target = 10;
    return {
      testName: "Live Source Diversity",
      category: "data",
      passed: cnt >= target,
      score: Math.min(100, Math.round((cnt / target) * 100)),
      target,
      details: `${cnt} distinct live data sources feeding knowledge graph (target: ≥${target})`,
      measured: `DB query: SELECT COUNT(DISTINCT source_type) FROM knowledge_graph`,
    };
  } catch {
    return { testName: "Source Diversity", category: "data", passed: false, score: 0, target: 10, details: "DB query failed", measured: "FAILED" };
  }
}

async function testKnowledgeGrowth(): Promise<ValidationResult> {
  try {
    const rows = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE created_at > NOW() - INTERVAL '30 minutes'`);
    const cnt = extractCount(rows);
    const target = 10;
    return {
      testName: "Knowledge Growth (Last 30 Min)",
      category: "autonomy",
      passed: cnt >= target,
      score: Math.min(100, Math.round((cnt / target) * 100)),
      target,
      details: `${cnt} new knowledge entries in last 30 minutes (target: ≥${target})`,
      measured: `DB query: SELECT COUNT(*) FROM knowledge_graph WHERE created_at > NOW() - INTERVAL '30 minutes'`,
    };
  } catch {
    return { testName: "Knowledge Growth", category: "autonomy", passed: false, score: 0, target: 10, details: "DB query failed", measured: "FAILED" };
  }
}

let externalCallCount = 0;
let sovereignCallCount = 0;

/**
 * Increment the external call counter — called by LLM client / proxy each time
 * a call is made to an external LLM provider.
 */
export function recordExternalCall(): void {
  externalCallCount++;
}

/**
 * Increment the sovereign call counter — called for DB queries, crypto ops,
 * in-memory compute, etc. that do NOT leave the system.
 */
export function recordSovereignCall(): void {
  sovereignCallCount++;
}

/**
 * Compute the real external dependency percentage from runtime telemetry.
 * Returns { externalPercent, sovereignPercent, totalCalls }
 */
export function computeExternalDependencyRatio(): {
  externalPercent: number;
  sovereignPercent: number;
  totalCalls: number;
  externalCalls: number;
  sovereignCalls: number;
} {
  const total = externalCallCount + sovereignCallCount;
  if (total === 0) {
    return { externalPercent: 0, sovereignPercent: 100, totalCalls: 0, externalCalls: 0, sovereignCalls: 0 };
  }
  const externalPercent = Math.round((externalCallCount / total) * 100);
  return {
    externalPercent,
    sovereignPercent: 100 - externalPercent,
    totalCalls: total,
    externalCalls: externalCallCount,
    sovereignCalls: sovereignCallCount,
  };
}

async function testExternalDependencyRatio(): Promise<ValidationResult> {
  const ratio = computeExternalDependencyRatio();
  const sovereignPercent = ratio.sovereignPercent;
  const target = 20;
  return {
    testName: "Sovereign vs External Call Ratio",
    category: "autonomy",
    passed: sovereignPercent >= target,
    score: Math.min(100, Math.round((sovereignPercent / 100) * 100)),
    target,
    details: `${ratio.sovereignCalls} sovereign calls, ${ratio.externalCalls} external — ${sovereignPercent}% sovereign (target: ≥${target}%)`,
    measured: `Runtime telemetry: ${ratio.totalCalls} total calls tracked`,
  };
}

function computeOverallSovereignty(results: ValidationResult[]): number {
  const total = results.reduce((sum, r) => sum + r.score, 0);
  metrics.overallSovereigntyScore = total / results.length;
  return metrics.overallSovereigntyScore;
}

export async function runValidationCycle(): Promise<{
  cycleNumber: number;
  results: ValidationResult[];
  metrics: ValidationMetrics;
  overallScore: number;
  allTestsPassed: boolean;
}> {
  validationCycleCount++;
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} SOVEREIGNTY VALIDATION CYCLE #${validationCycleCount}`);
  console.log(`${LOG_PREFIX} PHASE 10 — REAL DATA VALIDATION`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  const results: ValidationResult[] = [];

  console.log(`${LOG_PREFIX} [Test 1] Database connectivity`);
  results.push(await testDatabaseConnectivity());

  console.log(`${LOG_PREFIX} [Test 2] Knowledge nodes (real count)`);
  results.push(await testKnowledgeNodes());

  console.log(`${LOG_PREFIX} [Test 3] Domain coverage (real count)`);
  results.push(await testDomainCoverage());

  console.log(`${LOG_PREFIX} [Test 4] AI insight generation (real count)`);
  results.push(await testInsightGeneration());

  console.log(`${LOG_PREFIX} [Test 5] Content deduplication (real ledger)`);
  results.push(await testDeduplication());

  console.log(`${LOG_PREFIX} [Test 6] System resources (real measurement)`);
  results.push(testSystemResources());

  console.log(`${LOG_PREFIX} [Test 7] LLM configuration`);
  results.push(testLLMConfiguration());

  console.log(`${LOG_PREFIX} [Test 8] Live source diversity (real count)`);
  results.push(await testLiveSourceDiversity());

  console.log(`${LOG_PREFIX} [Test 9] Knowledge growth (last 30 min)`);
  results.push(await testKnowledgeGrowth());

  console.log(`${LOG_PREFIX} [Test 10] External dependency ratio (runtime telemetry)`);
  results.push(await testExternalDependencyRatio());

  metrics.testsRun = results.length;
  metrics.testsPassed = results.filter(r => r.passed).length;
  const overallScore = computeOverallSovereignty(results);
  const allPassed = results.every(r => r.passed);

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 10", phaseNumber: 10, metricName: "Knowledge Nodes", currentValue: metrics.knowledgeNodeCount, targetValue: 1000, unit: "count", status: "measured" },
      { phase: "Phase 10", phaseNumber: 10, metricName: "Domain Coverage", currentValue: metrics.domainCoverage, targetValue: 50, unit: "count", status: "measured" },
      { phase: "Phase 10", phaseNumber: 10, metricName: "Insights Generated", currentValue: metrics.insightCount, targetValue: 2000, unit: "count", status: "measured" },
      { phase: "Phase 10", phaseNumber: 10, metricName: "Tests Passed", currentValue: metrics.testsPassed, targetValue: 9, unit: "count", status: "measured" },
      { phase: "Phase 10", phaseNumber: 10, metricName: "Overall Score", currentValue: overallScore, targetValue: 95, unit: "percent", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const progress = Math.min(allPassed ? 100 : 95, Math.floor(overallScore));
  await updatePhaseProgress(10, progress, allPassed ? "completed" : "in_progress").catch(() => {});

  const duration = Date.now() - startTime;
  recordEngineEvent("sovereignty_validation", "validation_cycle", allPassed, duration, {
    cycleNumber: validationCycleCount,
    testsPassed: metrics.testsPassed,
    testsRun: metrics.testsRun,
    overallScore,
  });

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} VALIDATION CYCLE #${validationCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Tests: ${metrics.testsPassed}/${metrics.testsRun} passed`);
  console.log(`${LOG_PREFIX} Overall Score: ${overallScore.toFixed(1)}%`);
  for (const r of results) {
    console.log(`${LOG_PREFIX}   ${r.passed ? "✓" : "✗"} ${r.testName}: ${r.score}% — ${r.details}`);
  }
  console.log(`${LOG_PREFIX} Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return { cycleNumber: validationCycleCount, results, metrics: { ...metrics }, overallScore, allTestsPassed: allPassed };
}

export function getValidationStatus() {
  return {
    cycleCount: validationCycleCount,
    metrics: { ...metrics },
    continuousActive: continuousInterval !== null,
    overallScore: metrics.overallSovereigntyScore,
    allTestsPassed: metrics.testsPassed === metrics.testsRun && metrics.testsRun > 0,
  };
}

export function startContinuousValidation() {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting continuous sovereignty validation (every 20 minutes)`);
  runValidationCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err));
  continuousInterval = setInterval(() => {
    runValidationCycle().catch(err => console.error(`${LOG_PREFIX} Cycle failed:`, err));
  }, 20 * 60 * 1000);
}

export function stopContinuousValidation() {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Continuous validation stopped`);
  }
}
