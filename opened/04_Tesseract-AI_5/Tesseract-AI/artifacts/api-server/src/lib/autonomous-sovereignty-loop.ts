import { db } from "@workspace/db";
import { sovereignty_metrics } from "@workspace/db";
import { logger } from "./logger";
import { runLearningCycle, getLearningStatus, getLearningInsights } from "./dependency-learning-engine";
import { updateCapabilityReadiness, getRouterStatus } from "./internal-model-router";
import { runEvaluationCycle, getEvaluationSummary, getEvaluationSuiteStatus, runLoadRobustnessTest } from "./sovereignty-evaluation-suite";
import { runSovereigntyMonitorCycle, getSovereigntyMonitorStatus, executeDisconnect, updateSovereigntyConfig } from "./sovereignty-monitor";
import { getDetachmentStatus } from "./dependency-detachment-engine";
import { getLoggerStatus } from "./external-call-logger";
import { getSandboxStatus } from "./external-call-sandbox";
import { logger as pino } from "./logger";
import { getKnowledgeAbsorptionStatus } from "./knowledge-absorption-engine";

const LOG_PREFIX = "[AutonomousSovereigntyLoop]";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

interface LoopCycleResult {
  cycleNumber: number;
  timestamp: string;
  phases: {
    observe: { logsAnalyzed: number; providersTracked: number };
    learn: { insightsGenerated: number; providersAnalyzed: number };
    buildKnowledge: { capabilitiesUpdated: number; knowledgeArtifactsWritten: number };
    evaluate: { internalScore: number; externalScore: number; readyForDetachment: boolean; loadThroughputScore: number };
    score: { sovereigntyScore: number; readiness: number };
    decide: { detachmentDecision: string; detachmentExecuted: boolean };
  };
  overallSovereigntyScore: number;
  recommendations: string[];
  durationMs: number;
}

let loopCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;
let loopIntervalMs = DEFAULT_INTERVAL_MS;
let isRunning = false;
let lastCycleResult: LoopCycleResult | null = null;
let totalDetachmentsExecuted = 0;

async function observePhase(): Promise<{ logsAnalyzed: number; providersTracked: number }> {
  try {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as log_count,
        COUNT(DISTINCT provider_id) as provider_count
      FROM external_call_logs
      WHERE created_at > NOW() - INTERVAL '30 minutes'
    `);
    type ObserveRow = { log_count: string | number; provider_count: string | number };
    const row = ((result as { rows?: ObserveRow[] }).rows?.[0] ?? result as unknown as ObserveRow);
    return {
      logsAnalyzed: Number(row.log_count ?? 0),
      providersTracked: Number(row.provider_count ?? 0),
    };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Observe phase failed`);
    return { logsAnalyzed: 0, providersTracked: 0 };
  }
}

async function learnPhase(): Promise<{ insightsGenerated: number; providersAnalyzed: number }> {
  try {
    const result = await runLearningCycle();
    return {
      insightsGenerated: result.insightsGenerated,
      providersAnalyzed: result.providersAnalyzed,
    };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Learn phase failed`);
    return { insightsGenerated: 0, providersAnalyzed: 0 };
  }
}

async function buildKnowledgePhase(): Promise<{ capabilitiesUpdated: number; knowledgeArtifactsWritten: number }> {
  let knowledgeArtifactsWritten = 0;
  try {
    await updateCapabilityReadiness();
    const routerStatus = await getRouterStatus();
    const readyCaps = routerStatus.capabilities.filter(c => c.ready).length;

    const recentInsights = await getLearningInsights({ limit: 10 });
    for (const insight of recentInsights) {
      try {
        const { storeKnowledgeEntry } = await import("./memory-service");
        await storeKnowledgeEntry({
          label: `Learned: ${insight.providerId}/${insight.taskDomain}`,
          content: [
            `Provider: ${insight.providerId}`,
            `Domain: ${insight.taskDomain}`,
            `Confidence: ${insight.confidenceScore}%`,
            `Patterns: ${insight.patterns.join("; ").slice(0, 500)}`,
            `EdgeCases: ${insight.edgeCases.join("; ").slice(0, 300)}`,
            `FailureModes: ${insight.failureModes.join("; ").slice(0, 300)}`,
            `Recommendations: ${insight.recommendations.join("; ").slice(0, 300)}`,
          ].join("\n"),
          source: "dependency-learning-engine",
          tags: ["sovereign-learning", insight.taskDomain, insight.providerId],
        });
        knowledgeArtifactsWritten++;
      } catch {
        /* ignore individual write failures */
      }
    }

    return { capabilitiesUpdated: readyCaps, knowledgeArtifactsWritten };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Build knowledge phase failed`);
    return { capabilitiesUpdated: 0, knowledgeArtifactsWritten };
  }
}

async function evaluatePhase(): Promise<{ internalScore: number; externalScore: number; readyForDetachment: boolean; loadThroughputScore: number }> {
  try {
    const [evalResult, loadResult] = await Promise.all([
      runEvaluationCycle({ taskTypes: ["reasoning", "factual", "format", "robustness"] }),
      runLoadRobustnessTest(5),
    ]);
    return {
      internalScore: evalResult.overallInternalScore,
      externalScore: evalResult.overallExternalScore,
      readyForDetachment: evalResult.readyForDetachment,
      loadThroughputScore: loadResult.throughputScore,
    };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Evaluate phase failed`);
    return { internalScore: 0, externalScore: 0, readyForDetachment: false, loadThroughputScore: 0 };
  }
}

async function scorePhase(): Promise<{ sovereigntyScore: number; readiness: number }> {
  try {
    const monitorResult = await runSovereigntyMonitorCycle();
    return {
      sovereigntyScore: monitorResult.readiness.score,
      readiness: monitorResult.internalRatio * 100,
    };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Score phase failed`);
    return { sovereigntyScore: 0, readiness: 0 };
  }
}

async function decidePhase(params: {
  evalReadyForDetachment: boolean;
  sovereigntyScore: number;
}): Promise<{ detachmentDecision: string; detachmentExecuted: boolean }> {
  const monitorStatus = getSovereigntyMonitorStatus();

  if (!params.evalReadyForDetachment) {
    return {
      detachmentDecision: "HOLD — evaluation scores not yet meeting detachment thresholds",
      detachmentExecuted: false,
    };
  }

  if (!monitorStatus.isReadyForDisconnect) {
    return {
      detachmentDecision: `HOLD — sovereignty monitor not ready (score: ${monitorStatus.readinessScore}%, threshold: 80%)`,
      detachmentExecuted: false,
    };
  }

  if (params.sovereigntyScore < 80) {
    return {
      detachmentDecision: `HOLD — sovereignty score ${params.sovereigntyScore}% below 80% threshold`,
      detachmentExecuted: false,
    };
  }

  logger.info(
    { sovereigntyScore: params.sovereigntyScore, readinessScore: monitorStatus.readinessScore },
    `${LOG_PREFIX} All detachment thresholds met — enabling hardDisconnect and executing phase 1 detachment`
  );

  updateSovereigntyConfig({
    disconnectPlan: {
      phase1: ["puter-gpt4o"],
      phase2: ["replit-openai"],
      dryRunMode: false,
      hardDisconnectEnabled: true,
    },
  });

  try {
    const disconnectResult = await executeDisconnect({ phase: 1, dryRun: false });
    const actuallyExecuted = disconnectResult.executed.length > 0;
    if (actuallyExecuted) {
      totalDetachmentsExecuted++;
      return {
        detachmentDecision: `PHASE 1 DETACHMENT EXECUTED (autonomous): ${disconnectResult.message}`,
        detachmentExecuted: true,
      };
    }
    return {
      detachmentDecision: `HOLD — detachment conditions not yet met: ${disconnectResult.message}`,
      detachmentExecuted: false,
    };
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Detachment execution failed`);
    return {
      detachmentDecision: "FAILED — detachment execution error",
      detachmentExecuted: false,
    };
  }
}

export async function runAutonomousSovereigntyLoopCycle(): Promise<LoopCycleResult> {
  if (isRunning) {
    logger.info(`${LOG_PREFIX} Loop already running, skipping cycle`);
    return lastCycleResult ?? {
      cycleNumber: loopCycleCount,
      timestamp: new Date().toISOString(),
      phases: {
        observe: { logsAnalyzed: 0, providersTracked: 0 },
        learn: { insightsGenerated: 0, providersAnalyzed: 0 },
        buildKnowledge: { capabilitiesUpdated: 0, knowledgeArtifactsWritten: 0 },
        evaluate: { internalScore: 0, externalScore: 0, readyForDetachment: false, loadThroughputScore: 0 },
        score: { sovereigntyScore: 0, readiness: 0 },
        decide: { detachmentDecision: "already_running", detachmentExecuted: false },
      },
      overallSovereigntyScore: 0,
      recommendations: ["Loop is already running"],
      durationMs: 0,
    };
  }

  isRunning = true;
  loopCycleCount++;
  const start = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} AUTONOMOUS SOVEREIGNTY LOOP CYCLE #${loopCycleCount}`);
  console.log(`${LOG_PREFIX} ${new Date().toISOString()}`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  try {
    console.log(`${LOG_PREFIX} [Phase 1/6] Observe — analyzing external call logs`);
    const observe = await observePhase();
    console.log(`${LOG_PREFIX}   Logs: ${observe.logsAnalyzed} | Providers: ${observe.providersTracked}`);

    console.log(`${LOG_PREFIX} [Phase 2/6] Learn — running dependency learning analysis`);
    const learn = await learnPhase();
    console.log(`${LOG_PREFIX}   Providers analyzed: ${learn.providersAnalyzed} | Insights: ${learn.insightsGenerated}`);

    console.log(`${LOG_PREFIX} [Phase 3/6] Build Knowledge — updating internal capability map`);
    const buildKnowledge = await buildKnowledgePhase();
    console.log(`${LOG_PREFIX}   Capabilities updated: ${buildKnowledge.capabilitiesUpdated}`);

    console.log(`${LOG_PREFIX} [Phase 4/6] Evaluate — running A/B evaluation suite`);
    const evaluate = await evaluatePhase();
    console.log(`${LOG_PREFIX}   Internal: ${evaluate.internalScore}% | External: ${evaluate.externalScore}% | Ready: ${evaluate.readyForDetachment}`);

    console.log(`${LOG_PREFIX} [Phase 5/6] Score — computing sovereignty scores`);
    const score = await scorePhase();
    console.log(`${LOG_PREFIX}   Sovereignty score: ${score.sovereigntyScore}% | Readiness: ${Math.round(score.readiness)}%`);

    console.log(`${LOG_PREFIX} [Phase 6/6] Decide — evaluating detachment thresholds`);
    const decide = await decidePhase({
      evalReadyForDetachment: evaluate.readyForDetachment,
      sovereigntyScore: score.sovereigntyScore,
    });
    console.log(`${LOG_PREFIX}   Decision: ${decide.detachmentDecision}`);

    const recommendations: string[] = [];
    if (evaluate.internalScore < 50) recommendations.push("Accelerate knowledge ingestion — internal scores below 50%");
    if (score.sovereigntyScore < 40) recommendations.push("Internal ratio low — increase internal task routing");
    if (observe.logsAnalyzed === 0) recommendations.push("No external calls logged in last 30min — verify interceptor is active");
    if (learn.insightsGenerated === 0 && observe.logsAnalyzed > 10) recommendations.push("Learning engine found no patterns — may need more call diversity");
    if (evaluate.readyForDetachment && !decide.detachmentExecuted) {
      recommendations.push("Evaluation thresholds met — increase sovereignty monitor readiness score to trigger detachment");
    }
    if (decide.detachmentExecuted) {
      recommendations.push("Phase 1 dry-run detachment completed — review disconnect log and enable hardDisconnect when ready");
    }

    const overallSovereigntyScore = Math.round(
      (score.sovereigntyScore * 0.4) +
      (evaluate.internalScore * 0.35) +
      (learn.providersAnalyzed > 0 ? 20 : 0) * 0.25
    );

    try {
      await db.insert(sovereignty_metrics).values([
        { phase: "Autonomous Loop", phaseNumber: -3, metricName: "Loop Sovereignty Score", currentValue: overallSovereigntyScore, targetValue: 100, unit: "percent", status: "measured" },
        { phase: "Autonomous Loop", phaseNumber: -3, metricName: "Loop Cycle Count", currentValue: loopCycleCount, targetValue: 1000, unit: "count", status: "measured" },
        { phase: "Autonomous Loop", phaseNumber: -3, metricName: "Internal Eval Score", currentValue: evaluate.internalScore, targetValue: 80, unit: "percent", status: "measured" },
        { phase: "Autonomous Loop", phaseNumber: -3, metricName: "Learning Insights", currentValue: learn.insightsGenerated, targetValue: 100, unit: "count", status: "measured" },
      ]).onConflictDoNothing();
    } catch (err) {
      logger.warn({ err }, `${LOG_PREFIX} Metrics persist failed`);
    }

    const durationMs = Date.now() - start;

    const result: LoopCycleResult = {
      cycleNumber: loopCycleCount,
      timestamp: new Date().toISOString(),
      phases: { observe, learn, buildKnowledge, evaluate, score, decide },
      overallSovereigntyScore,
      recommendations,
      durationMs,
    };

    lastCycleResult = result;

    console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
    console.log(`${LOG_PREFIX} CYCLE #${loopCycleCount} COMPLETE`);
    console.log(`${LOG_PREFIX} Overall sovereignty: ${overallSovereigntyScore}% | Duration: ${durationMs}ms`);
    if (recommendations.length > 0) {
      console.log(`${LOG_PREFIX} Recommendations:`);
      for (const rec of recommendations) {
        console.log(`${LOG_PREFIX}   → ${rec}`);
      }
    }
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

    return result;
  } finally {
    isRunning = false;
  }
}

export function getAutonomousLoopStatus() {
  const loggerSt = getLoggerStatus();
  const sandboxSt = getSandboxStatus();
  const learningSt = getLearningStatus();
  const evalSt = getEvaluationSuiteStatus();
  const monitorSt = getSovereigntyMonitorStatus();
  const knowledgeSt = getKnowledgeAbsorptionStatus();

  return {
    loopCycleCount,
    isRunning,
    continuousActive: continuousInterval !== null,
    intervalMs: loopIntervalMs,
    lastCycleResult,
    totalDetachmentsExecuted,
    engines: {
      externalCallLogger: loggerSt,
      externalCallSandbox: { totalIntercepted: sandboxSt.totalCallsIntercepted, allowRate: sandboxSt.allowRate },
      dependencyLearning: learningSt,
      evaluationSuite: evalSt,
      sovereigntyMonitor: { cycleCount: monitorSt.cycleCount, readinessScore: monitorSt.readinessScore, isReady: monitorSt.isReadyForDisconnect },
      knowledgeAbsorption: { totalNodes: knowledgeSt.totalNodesAbsorbed },
    },
  };
}

export function startAutonomousSovereigntyLoop(intervalMs?: number): void {
  if (continuousInterval) return;
  if (intervalMs) loopIntervalMs = intervalMs;
  console.log(`${LOG_PREFIX} Starting autonomous sovereignty loop (every ${Math.round(loopIntervalMs / 60000)} minutes)`);
  runAutonomousSovereigntyLoopCycle().catch(err => logger.warn({ err }, `${LOG_PREFIX} Initial cycle failed`));
  continuousInterval = setInterval(() => {
    runAutonomousSovereigntyLoopCycle().catch(err => logger.warn({ err }, `${LOG_PREFIX} Cycle failed`));
  }, loopIntervalMs);
}

export function stopAutonomousSovereigntyLoop(): void {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Autonomous sovereignty loop stopped`);
  }
}

export function setLoopInterval(ms: number): void {
  loopIntervalMs = ms;
  if (continuousInterval) {
    stopAutonomousSovereigntyLoop();
    startAutonomousSovereigntyLoop(ms);
  }
}
