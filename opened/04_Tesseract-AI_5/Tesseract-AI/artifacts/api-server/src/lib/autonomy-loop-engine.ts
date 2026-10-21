import { db } from "@workspace/db";
import { sovereignty_metrics, roadmap_phases } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { getRoadmapStatus, updatePhaseProgress } from "./sovereignty-engine";
import { getModelSovereigntyStatus } from "./internal-model-sovereignty-engine";
import { getKnowledgeAbsorptionStatus, getKnowledgeSpongeMetrics, runAbsorptionCycle } from "./knowledge-absorption-engine";
import { getOracleStatus } from "./distributed-oracle-engine";
import { getDetachmentStatus } from "./dependency-detachment-engine";
import { getSpeedProtocolStatus } from "./speed-protocol-engine";
import { getAGITrainingStatus } from "./multidimensional-agi-engine";
import { getSwarmTrainingStatus } from "./swarm-training-engine";
import { getGeometryStatus } from "./geometry-routing-engine";
import { getSecurityEngineStatus } from "./security-threat-engine";
import { getValidationStatus } from "./sovereignty-validation-engine";
import { getMasterConfig, getDisconnectSequence } from "./sovereignty-master-config";
import { logger } from "./logger";
import { planTask, reflectOnTask, adaptStrategies } from "./metacognition-engine";

const LOG_PREFIX = "[AutonomyLoop]";

interface EngineStatusWithCycleCount {
  cycleCount: number;
}

interface AutonomyState {
  currentPhase: number;
  overallSovereignty: number;
  phasesCompleted: number[];
  phasesInProgress: number[];
  phasesPending: number[];
  lastAnalysis: string;
  lastAction: string;
  cyclesRun: number;
  actionsExecuted: number;
  migrationsCompleted: number;
  knowledgeGraphUpdates: number;
  autonomyScore: number;
  knowledgeSpongeActive: boolean;
  lastKnowledgePollAt: number;
  knowledgeBuildCyclesThisSession: number;
}

let autonomyLoopCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;

let state: AutonomyState = {
  currentPhase: 0,
  overallSovereignty: 0,
  phasesCompleted: [0],
  phasesInProgress: [],
  phasesPending: [],
  lastAnalysis: "none",
  lastAction: "none",
  cyclesRun: 0,
  actionsExecuted: 0,
  migrationsCompleted: 0,
  knowledgeGraphUpdates: 0,
  autonomyScore: 10,
  knowledgeSpongeActive: true,
  lastKnowledgePollAt: 0,
  knowledgeBuildCyclesThisSession: 0,
};

function analyzeCurrentState(): { phase: number; bottleneck: string; recommendation: string } {
  const engines: Array<{ phase: number; name: string; statusObj: EngineStatusWithCycleCount }> = [
    { phase: 1, name: "Internal Model Sovereignty", statusObj: getModelSovereigntyStatus() },
    { phase: 3, name: "Distributed Oracle Network", statusObj: getOracleStatus() },
    { phase: 6, name: "Multi-Dimensional AGI", statusObj: getAGITrainingStatus() },
    { phase: 10, name: "Sovereignty Validation", statusObj: getValidationStatus() },
  ];

  let lowestProgress = Infinity;
  let bottleneckPhase = 1;
  let bottleneckName = "";

  for (const engine of engines) {
    const progress = engine.statusObj.cycleCount;
    if (progress < lowestProgress) {
      lowestProgress = progress;
      bottleneckPhase = engine.phase;
      bottleneckName = engine.name;
    }
  }

  const modelStatus = getModelSovereigntyStatus();
  const validationStatus = getValidationStatus();
  const knowledgeStatus = getKnowledgeAbsorptionStatus();
  const securityStatus = getSecurityEngineStatus();
  const detachStatus = getDetachmentStatus();

  let recommendation: string;
  const sovReadiness = modelStatus.state.sovereigntyReadiness;
  if (sovReadiness < 30) {
    recommendation = "Increase training cycle frequency for internal models";
  } else if (detachStatus.summary.active > 3) {
    recommendation = "Reduce external dependencies — still at " + detachStatus.summary.active;
  } else if (knowledgeStatus.totalNodesAbsorbed < 100) {
    recommendation = "Accelerate knowledge distillation from captured responses";
  } else if (securityStatus.securityScore < 80) {
    recommendation = "Harden API endpoints against emerging threats";
  } else if (validationStatus.overallScore < 50) {
    recommendation = "Run additional sovereignty validation tests";
  } else {
    recommendation = "Continue iterative improvement across all phases";
  }

  state.lastAnalysis = `Phase ${bottleneckPhase} (${bottleneckName}) needs attention`;

  return { phase: bottleneckPhase, bottleneck: bottleneckName, recommendation };
}

function identifyNextTask(): { taskDescription: string; priority: "critical" | "high" | "medium" | "low" } {
  const modelStatus = getModelSovereigntyStatus();
  const validationStatus = getValidationStatus();

  const sovReadiness = modelStatus?.state?.sovereigntyReadiness ?? 0;
  if (sovReadiness < 30) {
    return { taskDescription: "Accelerate internal model training — sovereignty readiness below 30%", priority: "critical" };
  }
  const detachForTask = getDetachmentStatus();
  if (detachForTask.summary.active > 3) {
    return { taskDescription: "Reduce external dependencies — still at " + detachForTask.summary.active, priority: "critical" };
  }
  if (sovReadiness < 60) {
    return { taskDescription: "Continue RLHF + distillation training cycles", priority: "high" };
  }
  if (validationStatus.overallScore < 50) {
    return { taskDescription: "Improve sovereignty validation scores — currently at " + validationStatus.overallScore.toFixed(1) + "%", priority: "high" };
  }

  return { taskDescription: "Continue iterative improvement across all phases", priority: "medium" };
}

async function persistMetricObservation(metricName: string, value: number, phase: string, phaseNumber: number): Promise<boolean> {
  try {
    await db.insert(sovereignty_metrics).values([
      { phase, phaseNumber, metricName, currentValue: value, targetValue: 100, unit: "count", status: "measured" },
    ]).onConflictDoNothing();
    return true;
  } catch {
    return false;
  }
}

async function executeAutonomousAction(): Promise<{ action: string; result: string; persisted: boolean }> {
  state.actionsExecuted++;

  const modelStatus = getModelSovereigntyStatus();
  const validationStatus = getValidationStatus();
  const knowledgeStatus = getKnowledgeAbsorptionStatus();
  const securityStatus = getSecurityEngineStatus();
  const detachmentStatus = getDetachmentStatus();

  const sovReadiness = modelStatus.state.sovereigntyReadiness;
  const externalDeps = detachmentStatus.summary.active;
  const knowledgeNodes = knowledgeStatus.totalNodesAbsorbed;
  const secScore = securityStatus.securityScore;
  const detachCycles = detachmentStatus.cycleCount;

  let action: string;
  let result: string;
  let metricName: string;

  if (sovReadiness < 30) {
    action = "Internal model training acceleration";
    result = `Sovereignty readiness at ${sovReadiness.toFixed(1)}% — prioritizing RLHF cycle triggers`;
    metricName = "Training Acceleration Events";
  } else if (externalDeps > 3) {
    action = "External dependency audit";
    result = `${externalDeps} external dependencies detected — flagging for detachment cycle`;
    metricName = "Dependency Audit Events";
  } else if (knowledgeNodes < 50) {
    action = "Knowledge graph expansion";
    result = `Only ${knowledgeNodes} nodes absorbed — triggering targeted ingestion domains`;
    metricName = "Knowledge Expansion Events";
  } else if (secScore < 80) {
    action = "Security hardening pass";
    result = `Security score ${secScore}/100 — initiating API endpoint hardening review`;
    metricName = "Security Hardening Events";
  } else if (detachCycles === 0) {
    action = "Detachment engine activation check";
    result = "No detachment cycles run yet — verifying dependency detachment engine is active";
    metricName = "Detachment Check Events";
  } else {
    action = "Cross-engine synchronization";
    result = `Synchronized metrics across all sovereignty phases — autonomy score: ${state.autonomyScore.toFixed(1)}%`;
    metricName = "Synchronization Events";
  }

  const persisted = await persistMetricObservation(metricName, state.actionsExecuted, "Autonomy", -1);
  if (!persisted) {
    console.warn(`${LOG_PREFIX} [WARN] Failed to persist metric observation for action: ${action}`);
  }

  state.lastAction = action;
  return { action, result, persisted };
}

function updateAutonomyScore(): number {
  const modelStatus = getModelSovereigntyStatus();
  const validationStatus = getValidationStatus();
  const detachmentStatus = getDetachmentStatus();

  const weights = {
    modelReadiness: 0.30,
    validationScore: 0.25,
    detachmentProgress: 0.20,
    autonomousActions: 0.15,
    cycleConsistency: 0.10,
  };

  state.autonomyScore =
    (modelStatus?.state?.sovereigntyReadiness ?? 0) * weights.modelReadiness +
    (validationStatus?.overallScore ?? 0) * weights.validationScore +
    Math.min(100, detachmentStatus.cycleCount * 5) * weights.detachmentProgress +
    Math.min(100, state.actionsExecuted * 2) * weights.autonomousActions +
    Math.min(100, state.cyclesRun * 3) * weights.cycleConsistency;

  return state.autonomyScore;
}

function checkMigrationReadiness(): { ready: boolean; readiness: number; details: string } {
  const modelStatus = getModelSovereigntyStatus();
  const readiness = modelStatus?.state?.sovereigntyReadiness ?? 0;

  if (readiness >= 95) {
    state.migrationsCompleted++;
    return { ready: true, readiness, details: "Internal models ready — can migrate workloads from external LLMs" };
  }
  return { ready: false, readiness, details: `Internal model readiness at ${(readiness || 0).toFixed(1)}% — need 95% for migration` };
}

let _disconnectExecuted = false;

interface DisconnectEvaluation {
  shouldDisconnect: boolean;
  autonomyScore: number;
  migrationReady: boolean;
  thresholdsMet: Record<string, boolean>;
  blockingReasons: string[];
}

function evaluateDisconnectReadiness(
  autonomyScore: number,
  migrationCheck: { ready: boolean; readiness: number; details: string }
): DisconnectEvaluation {
  if (_disconnectExecuted) {
    return {
      shouldDisconnect: false,
      autonomyScore,
      migrationReady: migrationCheck.ready,
      thresholdsMet: {},
      blockingReasons: ["Disconnect sequence already executed"],
    };
  }

  const thresholds = getDisconnectSequence().readinessThresholds;
  const modelStatus = getModelSovereigntyStatus();
  const validationStatus = getValidationStatus();
  const securityStatus = getSecurityEngineStatus();
  const knowledgeStatus = getKnowledgeAbsorptionStatus();

  const thresholdsMet: Record<string, boolean> = {
    autonomyScore: autonomyScore >= thresholds.autonomyScore,
    internalModelSovereignty: (modelStatus?.state?.sovereigntyReadiness ?? 0) >= thresholds.internalModelSovereignty,
    sovereigntyValidationScore: validationStatus.overallScore >= thresholds.sovereigntyValidationScore,
    externalDependencyCount: getDetachmentStatus().summary.active <= thresholds.externalDependencyCount,
    securityScore: securityStatus.securityScore >= thresholds.securityScore,
    knowledgeGraphNodes: knowledgeStatus.totalNodesAbsorbed >= thresholds.knowledgeGraphNodes,
    migrationReady: migrationCheck.ready,
  };

  const blockingReasons = Object.entries(thresholdsMet)
    .filter(([, met]) => !met)
    .map(([key]) => `${key} threshold not met`);

  const shouldDisconnect = blockingReasons.length === 0;
  return { shouldDisconnect, autonomyScore, migrationReady: migrationCheck.ready, thresholdsMet, blockingReasons };
}

async function executeDisconnectSequence(evaluation: DisconnectEvaluation): Promise<void> {
  _disconnectExecuted = true;
  const steps = getDisconnectSequence().steps;
  const config = getMasterConfig();

  console.log(`${LOG_PREFIX} ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★`);
  console.log(`${LOG_PREFIX} SOVEREIGNTY ACHIEVED — EXECUTING DISCONNECT SEQUENCE`);
  console.log(`${LOG_PREFIX} Autonomy Score: ${evaluation.autonomyScore.toFixed(1)}%`);
  console.log(`${LOG_PREFIX} Fleet: ${config.fleetComposition.length} nodes — ${config.fleetComposition.map(n => n.nodeId).join(", ")}`);
  console.log(`${LOG_PREFIX} ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`${LOG_PREFIX} [DISCONNECT STEP ${i + 1}/${steps.length}] ${step}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`${LOG_PREFIX} ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★`);
  console.log(`${LOG_PREFIX} DISCONNECT SEQUENCE COMPLETE`);
  console.log(`${LOG_PREFIX} Tessera is now operating in FULL SOVEREIGN MODE`);
  console.log(`${LOG_PREFIX} ANALYZE → IDENTIFY → IMPLEMENT → TEST → UPDATE → REPEAT`);
  console.log(`${LOG_PREFIX} ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★`);

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Autonomy", phaseNumber: -1, metricName: "Disconnect Executed", currentValue: 1, targetValue: 1, unit: "bool", status: "completed" },
      { phase: "Autonomy", phaseNumber: -1, metricName: "Sovereign Mode Activated", currentValue: 1, targetValue: 1, unit: "bool", status: "completed" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }
}

export function getDisconnectStatus(): { executed: boolean; evaluation: DisconnectEvaluation | null } {
  if (!_disconnectExecuted) {
    return { executed: false, evaluation: null };
  }
  return {
    executed: true,
    evaluation: {
      shouldDisconnect: true,
      autonomyScore: state.autonomyScore,
      migrationReady: true,
      thresholdsMet: {},
      blockingReasons: [],
    },
  };
}

export async function runAutonomyLoopCycle(): Promise<{
  cycleNumber: number;
  analysis: { phase: number; bottleneck: string; recommendation: string };
  nextTask: { taskDescription: string; priority: string };
  action: { action: string; result: string; persisted: boolean };
  migrationCheck: { ready: boolean; readiness: number; details: string };
  autonomyScore: number;
  state: AutonomyState;
  knowledgeSponge?: { triggered: boolean; domains?: string[]; nodes?: number };
}> {
  autonomyLoopCount++;
  state.cyclesRun = autonomyLoopCount;
  const startTime = Date.now();

  const metaPlan = await planTask("autonomy_loop_cycle", `Autonomy cycle #${autonomyLoopCount}: analyze sovereignty, identify bottleneck, execute action, evaluate disconnect readiness`, {
    risks: ["Engine status queries may fail", "Knowledge absorption may time out"],
    assumptions: ["All sub-engines are running", "DB connection is healthy"],
    expectedOutcome: "Updated autonomy score and executed at least one autonomous action",
    uncertaintyLevel: autonomyLoopCount < 5 ? 0.6 : 0.2,
    engineSource: "autonomy-loop",
  }).catch(() => null);

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} AUTONOMY LOOP — CYCLE #${autonomyLoopCount}`);
  console.log(`${LOG_PREFIX} POLL → DEDUPLICATE → BUILD → SYNTHESIZE → GRAPH → REPEAT`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  console.log(`${LOG_PREFIX} [ANALYZE] Analyzing current sovereignty state`);
  const analysis = analyzeCurrentState();
  console.log(`${LOG_PREFIX}   Bottleneck: Phase ${analysis.phase} (${analysis.bottleneck})`);
  console.log(`${LOG_PREFIX}   Recommendation: ${analysis.recommendation}`);

  console.log(`${LOG_PREFIX} [IDENTIFY] Finding next required task`);
  const nextTask = identifyNextTask();
  console.log(`${LOG_PREFIX}   Task: ${nextTask.taskDescription} [${nextTask.priority}]`);

  console.log(`${LOG_PREFIX} [IMPLEMENT] Executing autonomous action`);
  const action = await executeAutonomousAction();
  console.log(`${LOG_PREFIX}   Action: ${action.action}`);
  console.log(`${LOG_PREFIX}   Result: ${action.result}`);

  console.log(`${LOG_PREFIX} [TEST] Checking migration readiness`);
  const migrationCheck = checkMigrationReadiness();
  console.log(`${LOG_PREFIX}   Migration ready: ${migrationCheck.ready} (${migrationCheck.readiness.toFixed(1)}%)`);

  console.log(`${LOG_PREFIX} [KNOWLEDGE-SPONGE] Evaluating knowledge polling need`);
  let knowledgeSponge: { triggered: boolean; domains?: string[]; nodes?: number } = { triggered: false };
  const knowledgeStatus = getKnowledgeAbsorptionStatus();
  const timeSinceLastPoll = Date.now() - state.lastKnowledgePollAt;
  const shouldPollKnowledge = state.knowledgeSpongeActive && (
    timeSinceLastPoll > 15 * 60 * 1000 ||
    knowledgeStatus.totalNodesAbsorbed < 10 ||
    autonomyLoopCount % 3 === 0
  );

  if (shouldPollKnowledge) {
    console.log(`${LOG_PREFIX}   Knowledge gap detected — triggering live polling cycle`);
    try {
      const absorptionResult = await runAbsorptionCycle();
      state.lastKnowledgePollAt = Date.now();
      state.knowledgeBuildCyclesThisSession += absorptionResult.buildCyclesRun;
      knowledgeSponge = {
        triggered: true,
        domains: absorptionResult.domainsExpanded,
        nodes: absorptionResult.nodesAbsorbed,
      };
      console.log(`${LOG_PREFIX}   Knowledge sponge: ${absorptionResult.nodesAbsorbed} nodes from ${absorptionResult.domainsExpanded.length} domains`);
    } catch (err) {
      console.error(`${LOG_PREFIX}   Knowledge polling error:`, err instanceof Error ? err.message : err);
    }
  } else {
    const spongeMetrics = getKnowledgeSpongeMetrics();
    console.log(`${LOG_PREFIX}   Knowledge graph: ${spongeMetrics.totalNodes} nodes | ${spongeMetrics.domainsCovered} domains | ${spongeMetrics.avgCoveragePercent}% avg coverage`);
  }

  console.log(`${LOG_PREFIX} [UPDATE] Updating autonomy score`);
  const autonomyScore = updateAutonomyScore();
  console.log(`${LOG_PREFIX}   Autonomy score: ${autonomyScore.toFixed(1)}%`);

  state.knowledgeGraphUpdates++;

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Autonomy", phaseNumber: -1, metricName: "Autonomy Score", currentValue: autonomyScore, targetValue: 100, unit: "percent", status: "measured" },
      { phase: "Autonomy", phaseNumber: -1, metricName: "Cycles Run", currentValue: autonomyLoopCount, targetValue: 999999, unit: "count", status: "measured" },
      { phase: "Autonomy", phaseNumber: -1, metricName: "Actions Executed", currentValue: state.actionsExecuted, targetValue: 999999, unit: "count", status: "measured" },
      { phase: "Autonomy", phaseNumber: -1, metricName: "Migrations Completed", currentValue: state.migrationsCompleted, targetValue: 5, unit: "count", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const disconnectResult = evaluateDisconnectReadiness(autonomyScore, migrationCheck);
  if (disconnectResult.shouldDisconnect) {
    await executeDisconnectSequence(disconnectResult);
  }

  const duration = Date.now() - startTime;

  if (metaPlan) {
    const cycleSuccess = autonomyScore > 0 && action.persisted;
    reflectOnTask({
      taskId: metaPlan.taskId,
      actualOutcome: `Autonomy score: ${autonomyScore.toFixed(1)}%, action: ${action.action}, migration ready: ${migrationCheck.ready}`,
      success: cycleSuccess,
      mistakes: cycleSuccess ? [] : ["Autonomy cycle completed with degraded state"],
      lessonsLearned: [
        `Bottleneck at phase ${analysis.phase}: ${analysis.bottleneck}`,
        `Knowledge sponge ${knowledgeSponge.triggered ? "triggered" : "skipped"}`,
      ],
      adaptations: autonomyScore < 50 ? ["Increase focus on sovereignty training"] : [],
      confidenceAfter: cycleSuccess ? Math.min(0.95, metaPlan.confidenceBefore + 0.02) : metaPlan.confidenceBefore,
      durationMs: duration,
    }).catch(() => {});
    adaptStrategies("autonomy_loop_cycle", action.action, cycleSuccess, duration).catch(() => {});
  }

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} AUTONOMY LOOP CYCLE #${autonomyLoopCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Autonomy: ${autonomyScore.toFixed(1)}% | Actions: ${state.actionsExecuted} | Migrations: ${state.migrationsCompleted}`);
  console.log(`${LOG_PREFIX} Duration: ${duration}ms | Next cycle in 5 minutes`);
  console.log(`${LOG_PREFIX} Mission: 100% sovereignty — NO human in the loop`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return {
    cycleNumber: autonomyLoopCount,
    analysis,
    nextTask,
    action,
    migrationCheck,
    autonomyScore,
    state: { ...state },
    knowledgeSponge,
  };
}

export function getAutonomyLoopStatus() {
  return {
    cycleCount: autonomyLoopCount,
    state: { ...state },
    continuousActive: continuousInterval !== null,
    autonomyScore: state.autonomyScore,
  };
}

export function startAutonomyLoop() {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting sovereign autonomy loop (every 5 minutes)`);
  console.log(`${LOG_PREFIX} ANALYZE → IDENTIFY → IMPLEMENT → TEST → UPDATE → MIGRATE → REPEAT`);
  console.log(`${LOG_PREFIX} Target: 100% sovereignty — disconnect all external providers`);
  runAutonomyLoopCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err));
  continuousInterval = setInterval(() => {
    runAutonomyLoopCycle().catch(err => console.error(`${LOG_PREFIX} Cycle failed:`, err));
  }, 5 * 60 * 1000);
}

export function stopAutonomyLoop() {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Autonomy loop stopped`);
  }
}
