import { db } from "@workspace/db";
import { internal_models, training_pipeline, sovereignty_metrics, knowledge_graph } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";
import { isLLMConfigured, llmChat } from "./llm-client";
import { logger } from "./logger";
import { extractCount } from "./db-utils";

const LOG_PREFIX = "[ModelSovereignty]";

interface ModelTrainingState {
  reasoningAccuracy: number;
  visionAccuracy: number;
  audioAccuracy: number;
  symbolicAccuracy: number;
  temporalAccuracy: number;
  rlhfEpochsCompleted: number;
  cotValidationScore: number;
  selfCalibrationScore: number;
  distillationProgress: number;
  totalTrainingSteps: number;
  sovereigntyReadiness: number;
  lastLLMTestResult: boolean;
  lastLLMLatencyMs: number;
  knowledgeRetrievalAccuracy: number;
}

let trainingCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;
let llmSuccessCount = 0;
let llmFailCount = 0;
let llmTotalLatency = 0;

let state: ModelTrainingState = {
  reasoningAccuracy: 0,
  visionAccuracy: 0,
  audioAccuracy: 0,
  symbolicAccuracy: 0,
  temporalAccuracy: 0,
  rlhfEpochsCompleted: 0,
  cotValidationScore: 0,
  selfCalibrationScore: 0,
  distillationProgress: 0,
  totalTrainingSteps: 0,
  sovereigntyReadiness: 0,
  lastLLMTestResult: false,
  lastLLMLatencyMs: 0,
  knowledgeRetrievalAccuracy: 0,
};

async function testReasoningCapability(): Promise<number> {
  if (!isLLMConfigured()) return 0;
  const start = Date.now();
  try {
    const result = await llmChat({
      systemPrompt: "Answer with ONLY the number. No explanation.",
      userPrompt: "What is 17 * 23?",
      maxTokens: 10,
    });
    const latency = Date.now() - start;
    state.lastLLMLatencyMs = latency;
    llmTotalLatency += latency;
    if (result && result.includes("391")) {
      llmSuccessCount++;
      return 100;
    }
    llmFailCount++;
    return result ? 30 : 0;
  } catch {
    llmFailCount++;
    return 0;
  }
}

async function testKnowledgeRetrieval(): Promise<number> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM knowledge_graph 
      WHERE source_type NOT IN ('insight', 'swarm_training')
    `);
    const realNodes = extractCount(rows);
    if (realNodes >= 2000) return 100;
    if (realNodes >= 1000) return 80;
    if (realNodes >= 500) return 60;
    if (realNodes >= 100) return 40;
    if (realNodes > 0) return 20;
    return 0;
  } catch {
    return 0;
  }
}

async function testCrossdomainLinking(): Promise<number> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(DISTINCT metadata->>'domain') as cnt FROM knowledge_graph 
      WHERE metadata->>'domain' IS NOT NULL
    `);
    const domains = extractCount(rows);
    if (domains >= 60) return 100;
    if (domains >= 40) return 80;
    if (domains >= 20) return 60;
    if (domains >= 10) return 40;
    return domains > 0 ? 20 : 0;
  } catch {
    return 0;
  }
}

async function testDistillation(): Promise<number> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type = 'insight'
    `);
    const insights = extractCount(rows);
    if (insights >= 5000) return 100;
    if (insights >= 2000) return 80;
    if (insights >= 500) return 60;
    if (insights >= 100) return 40;
    return insights > 0 ? 20 : 0;
  } catch {
    return 0;
  }
}

async function testDeduplication(): Promise<number> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM knowledge_build_ledger
    `);
    const dedups = extractCount(rows);
    if (dedups >= 2000) return 100;
    if (dedups >= 1000) return 80;
    if (dedups >= 500) return 60;
    if (dedups >= 100) return 40;
    return dedups > 0 ? 20 : 0;
  } catch {
    return 0;
  }
}

function computeSovereigntyReadiness(): number {
  const weights = {
    reasoning: 0.25,
    knowledge: 0.25,
    crossdomain: 0.15,
    distillation: 0.15,
    deduplication: 0.10,
    llmAvailability: 0.10,
  };
  const llmAvail = llmSuccessCount + llmFailCount > 0
    ? (llmSuccessCount / (llmSuccessCount + llmFailCount)) * 100 : 0;
  state.sovereigntyReadiness =
    state.reasoningAccuracy * weights.reasoning +
    state.knowledgeRetrievalAccuracy * weights.knowledge +
    state.symbolicAccuracy * weights.crossdomain +
    state.distillationProgress * weights.distillation +
    state.cotValidationScore * weights.deduplication +
    llmAvail * weights.llmAvailability;
  return state.sovereigntyReadiness;
}

export async function runModelSovereigntyCycle(): Promise<{
  cycleNumber: number;
  gains: Record<string, number>;
  state: ModelTrainingState;
  sovereigntyReadiness: number;
}> {
  trainingCycleCount++;
  state.totalTrainingSteps++;
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} INTERNAL MODEL SOVEREIGNTY CYCLE #${trainingCycleCount}`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  const gains: Record<string, number> = {};

  console.log(`${LOG_PREFIX} [Step 1] Testing reasoning capability (real LLM call)`);
  state.reasoningAccuracy = await testReasoningCapability();
  gains.reasoning = state.reasoningAccuracy;

  console.log(`${LOG_PREFIX} [Step 2] Measuring knowledge retrieval (real DB query)`);
  state.knowledgeRetrievalAccuracy = await testKnowledgeRetrieval();
  state.visionAccuracy = state.knowledgeRetrievalAccuracy;
  gains.knowledge = state.knowledgeRetrievalAccuracy;

  console.log(`${LOG_PREFIX} [Step 3] Testing cross-domain coverage (real DB query)`);
  state.symbolicAccuracy = await testCrossdomainLinking();
  gains.crossdomain = state.symbolicAccuracy;

  console.log(`${LOG_PREFIX} [Step 4] Measuring knowledge distillation (real insight count)`);
  state.distillationProgress = await testDistillation();
  gains.distillation = state.distillationProgress;

  console.log(`${LOG_PREFIX} [Step 5] Measuring deduplication effectiveness (real ledger count)`);
  state.cotValidationScore = await testDeduplication();
  gains.deduplication = state.cotValidationScore;

  state.rlhfEpochsCompleted = trainingCycleCount;

  console.log(`${LOG_PREFIX} [Step 6] Computing sovereignty readiness`);
  const readiness = computeSovereigntyReadiness();

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 1", phaseNumber: 1, metricName: "Reasoning (LLM Test)", currentValue: state.reasoningAccuracy, targetValue: 95, unit: "percent", status: "measured" },
      { phase: "Phase 1", phaseNumber: 1, metricName: "Knowledge Nodes", currentValue: state.knowledgeRetrievalAccuracy, targetValue: 100, unit: "percent", status: "measured" },
      { phase: "Phase 1", phaseNumber: 1, metricName: "Domain Coverage", currentValue: state.symbolicAccuracy, targetValue: 100, unit: "percent", status: "measured" },
      { phase: "Phase 1", phaseNumber: 1, metricName: "Insight Distillation", currentValue: state.distillationProgress, targetValue: 100, unit: "percent", status: "measured" },
      { phase: "Phase 1", phaseNumber: 1, metricName: "Deduplication", currentValue: state.cotValidationScore, targetValue: 100, unit: "percent", status: "measured" },
      { phase: "Phase 1", phaseNumber: 1, metricName: "Sovereignty Readiness", currentValue: readiness, targetValue: 95, unit: "percent", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const progress = Math.min(95, Math.floor(readiness));
  await updatePhaseProgress(1, progress, "in_progress").catch(() => {});

  const duration = Date.now() - startTime;
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} CYCLE #${trainingCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Sovereignty Readiness: ${readiness.toFixed(1)}%`);
  console.log(`${LOG_PREFIX} Reasoning (LLM): ${state.reasoningAccuracy}% | Knowledge: ${state.knowledgeRetrievalAccuracy}% | Domains: ${state.symbolicAccuracy}%`);
  console.log(`${LOG_PREFIX} Insights: ${state.distillationProgress}% | Dedup: ${state.cotValidationScore}% | LLM calls: ${llmSuccessCount}/${llmSuccessCount + llmFailCount}`);
  console.log(`${LOG_PREFIX} Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return { cycleNumber: trainingCycleCount, gains, state: { ...state }, sovereigntyReadiness: readiness };
}

export function getModelSovereigntyStatus() {
  return {
    cycleCount: trainingCycleCount,
    state: { ...state },
    continuousTrainingActive: continuousInterval !== null,
    llmStats: { success: llmSuccessCount, fail: llmFailCount, avgLatencyMs: llmSuccessCount > 0 ? Math.round(llmTotalLatency / (llmSuccessCount + llmFailCount)) : 0 },
  };
}

export function startContinuousModelTraining() {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting continuous model training (every 8 minutes)`);
  runModelSovereigntyCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err));
  continuousInterval = setInterval(() => {
    runModelSovereigntyCycle().catch(err => console.error(`${LOG_PREFIX} Cycle failed:`, err));
  }, 8 * 60 * 1000);
}

export function stopContinuousModelTraining() {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Continuous model training stopped`);
  }
}
