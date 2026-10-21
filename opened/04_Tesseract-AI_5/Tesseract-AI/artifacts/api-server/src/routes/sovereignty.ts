import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  initializeAllPhases,
  getRoadmapStatus,
  updatePhaseProgress,
  runSystemAudit,
  initializeSwarmNodes,
  syncSwarmState,
  getModels,
  getTrainingPipelines,
  getKnowledgeGraphNodes,
  getDataSources,
  getGeometryRoutes,
  getSecurityEvents,
} from "../lib/sovereignty-engine";
import {
  runSwarmTrainingCycle,
  getSwarmTrainingStatus,
  getSwarmVotes,
  startPermanentTrainingLoop,
  stopPermanentTrainingLoop,
} from "../lib/swarm-training-engine";
import {
  runGeometryOptimization,
  getGeometryStatus,
  startContinuousOptimization,
  stopContinuousOptimization,
} from "../lib/geometry-routing-engine";
import {
  runSecurityScan,
  getSecurityEngineStatus,
  startContinuousSecurityScanning,
  stopContinuousSecurityScanning,
} from "../lib/security-threat-engine";
import {
  runSpeedOptimizationCycle,
  getSpeedProtocolStatus,
  startContinuousSpeedOptimization,
  stopContinuousSpeedOptimization,
} from "../lib/speed-protocol-engine";
import {
  runDetachmentCycle,
  getDetachmentStatus,
  startContinuousDetachment,
  stopContinuousDetachment,
} from "../lib/dependency-detachment-engine";
import {
  runAbsorptionCycle,
  getKnowledgeAbsorptionStatus,
  getKnowledgeSpongeMetrics,
  startContinuousAbsorption,
  stopContinuousAbsorption,
  identifyKnowledgeGaps,
  runCuriosityDrivenSearch,
  getGlobalSynthesis,
  getSourceHealthStatus,
  getAllDomainMaturities,
  detectKnowledgeConflicts,
  runMonteCarloBacktest,
} from "../lib/knowledge-absorption-engine";
import {
  runModelSovereigntyCycle,
  getModelSovereigntyStatus,
  startContinuousModelTraining,
  stopContinuousModelTraining,
} from "../lib/internal-model-sovereignty-engine";
import {
  runOracleCycle,
  getOracleStatus,
  startContinuousOracle,
  stopContinuousOracle,
} from "../lib/distributed-oracle-engine";
import {
  runAGITrainingCycle,
  getAGITrainingStatus,
  startContinuousAGITraining,
  stopContinuousAGITraining,
} from "../lib/multidimensional-agi-engine";
import {
  runValidationCycle,
  getValidationStatus,
  startContinuousValidation,
  stopContinuousValidation,
} from "../lib/sovereignty-validation-engine";
import {
  runAutonomyLoopCycle,
  getAutonomyLoopStatus,
  getDisconnectStatus,
  startAutonomyLoop,
  stopAutonomyLoop,
} from "../lib/autonomy-loop-engine";
import { getMasterConfig, getConfigChecksum } from "../lib/sovereignty-master-config";
import { capturePhase0Snapshot, getLatestSnapshot, listSnapshots } from "../lib/phase0-snapshot";
import { getSovereignRules, getSovereignRulesStatus, validateExternalCall, runEnforcementCycle, persistRulesToMemory } from "../lib/sovereign-rules-engine";
import { getAllAgentLives, getAgentLife, getAgentLifeSummary, triggerDreamCycle, initializeAgentLifeSystem } from "../lib/agent-life-engine";
import { getSandboxStatus, processSandboxedRequest } from "../lib/sandbox-protocol";
import { runAGIAudit, getCompetitorComparison } from "../lib/agi-audit-engine";
import { ensureSovereigntyAwakeningConference } from "../lib/grand-conference";
import { ensureLatticeInfrastructureConference, runLatticeInfrastructureConference, LATTICE_PROPOSALS } from "../lib/lattice-grand-conference";
import { ensureSovereigntyCouncilConference, runSovereigntyCouncilConference, SOVEREIGNTY_COUNCIL_PROPOSALS } from "../lib/sovereignty-council-conference";
import { getCipherSystemStatus, getAgentCipherStatus, rotateAllCiphers, rotateAgentCipher, encryptWithColonialCipher, decryptWithColonialCipher, getPermissionMatrix, encryptForLatticeStorage, decryptFromLatticeStorage, getEncryptedBlockCount, getColonialTransferStatus, colonialTransfer, broadcastToLattice, plantEncryptedSeed } from "../lib/sovereign-cipher-engine";
import {
  ensureColonialLanguageConference,
  runColonialLanguageConference,
  getColonialConferenceFromDB,
  getColonialLanguageSystemStatus,
  createExternalHandshake,
  rotateExternalHandshake,
  encodeForExternalContact,
  decodeExternalContactMessage,
  getExternalHandshakeStatus,
  getAllExternalHandshakes,
  encodeFileForStorage,
  decodeFileForAdmin,
  getColonialFileRegistry,
  scanDecodedColonialMessage,
  getColonialThreatLog,
  autoDecipherForAdmin,
  getLatticeFrequencyStatus,
  checkAndRotateLatticeFrequencies,
  COLONIAL_LANGUAGE_PROPOSALS,
} from "../lib/colonial-language-conference";
import { db } from "@workspace/db";
import { swarm_nodes, swarm_sync_logs, internal_models, training_pipeline, knowledge_graph, data_sources, security_events, sovereignty_metrics } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { getLoggerStatus, getRecentCallLogs, getCallLogStats } from "../lib/external-call-logger";
import { getSandboxStatus, resetRateLimitBucket } from "../lib/external-call-sandbox";
import { runLearningCycle, getLearningInsights, getLearningStatus } from "../lib/dependency-learning-engine";
import { getRouterStatus, routeTask } from "../lib/internal-model-router";
import { runEvaluationCycle, getEvaluationSummary, getEvaluationSuiteStatus } from "../lib/sovereignty-evaluation-suite";
import {
  runAutonomousSovereigntyLoopCycle,
  getAutonomousLoopStatus,
  startAutonomousSovereigntyLoop,
  stopAutonomousSovereigntyLoop,
  setLoopInterval,
} from "../lib/autonomous-sovereignty-loop";
import { logger } from "../lib/logger";

const router = Router();

function requireSovereignAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ success: false, error: "Sovereignty endpoints unavailable — TESSERACT_ADMIN_KEY not configured" });
    return;
  }
  const provided =
    (req.headers["x-admin-key"] as string) ??
    (req.headers["x-admin-token"] as string) ??
    (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "") ??
    (req.body as Record<string, unknown>)?.adminKey;
  if (!provided) {
    res.status(401).json({ success: false, error: "Authentication required — provide x-admin-key header" });
    return;
  }
  try {
    const a = Buffer.from(String(provided).trim(), "utf-8");
    const b = Buffer.from(adminKey.trim(), "utf-8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      next();
      return;
    }
  } catch (err) { logger.warn({ err }, "suppressed error"); }
  res.status(403).json({ success: false, error: "Forbidden — invalid admin key" });
}

router.post("/sovereignty/initialize", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await initializeAllPhases();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/roadmap", async (_req, res) => {
  try {
    const status = await getRoadmapStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/sovereignty/phase/:phaseNumber", requireSovereignAdmin, async (req, res) => {
  try {
    const phaseNumber = parseInt(req.params.phaseNumber);
    const { progress, status } = req.body;
    await updatePhaseProgress(phaseNumber, progress, status);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/audit", async (_req, res) => {
  try {
    const result = await runSystemAudit();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/swarm/nodes", async (_req, res) => {
  try {
    const nodes = await db.select().from(swarm_nodes).orderBy(swarm_nodes.nodeName);
    res.json({ success: true, data: nodes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/swarm/sync", requireSovereignAdmin, async (req, res) => {
  try {
    const { sourceNodeId, targetNodeId } = req.body;
    const log = await syncSwarmState(sourceNodeId, targetNodeId);
    res.json({ success: true, data: log });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/swarm/sync-logs", async (_req, res) => {
  try {
    const logs = await db.select().from(swarm_sync_logs).orderBy(desc(swarm_sync_logs.createdAt)).limit(50);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/models", async (_req, res) => {
  try {
    const models = await getModels();
    res.json({ success: true, data: models });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/training", async (_req, res) => {
  try {
    const pipelines = await getTrainingPipelines();
    res.json({ success: true, data: pipelines });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge-graph", async (_req, res) => {
  try {
    const nodes = await getKnowledgeGraphNodes();
    res.json({ success: true, data: nodes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/data-sources", async (_req, res) => {
  try {
    const sources = await getDataSources();
    res.json({ success: true, data: sources });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/geometry", async (_req, res) => {
  try {
    const routes = await getGeometryRoutes();
    res.json({ success: true, data: routes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/security", async (_req, res) => {
  try {
    const events = await getSecurityEvents();
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/metrics", async (_req, res) => {
  try {
    const metrics = await db.select().from(sovereignty_metrics).orderBy(sovereignty_metrics.phaseNumber);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/swarm-training/run", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runSwarmTrainingCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/swarm-training/status", async (_req, res) => {
  try {
    const status = await getSwarmTrainingStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/swarm-training/votes", async (req, res) => {
  try {
    const cycleId = req.query.cycleId as string | undefined;
    const votes = await getSwarmVotes(cycleId);
    res.json({ success: true, data: votes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/swarm-training/start-loop", requireSovereignAdmin, async (_req, res) => {
  try {
    startPermanentTrainingLoop();
    res.json({ success: true, message: "Permanent training loop started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/swarm-training/stop-loop", requireSovereignAdmin, async (_req, res) => {
  try {
    stopPermanentTrainingLoop();
    res.json({ success: true, message: "Permanent training loop stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/geometry/optimize", requireSovereignAdmin, async (req, res) => {
  try {
    const { topology } = req.body || {};
    const result = await runGeometryOptimization(topology);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/geometry/status", async (_req, res) => {
  try {
    const status = await getGeometryStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/geometry/start-optimization", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousOptimization();
    res.json({ success: true, message: "Continuous geometry optimization started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/geometry/stop-optimization", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousOptimization();
    res.json({ success: true, message: "Continuous geometry optimization stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 9: Security & Threat Modeling
router.post("/sovereignty/security/scan", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runSecurityScan();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/security/status", async (_req, res) => {
  try {
    const status = getSecurityEngineStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/security/start-scanning", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousSecurityScanning();
    res.json({ success: true, message: "Continuous security scanning started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/security/stop-scanning", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousSecurityScanning();
    res.json({ success: true, message: "Continuous security scanning stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 5: Speed Protocol
router.post("/sovereignty/speed/optimize", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runSpeedOptimizationCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/speed/status", async (_req, res) => {
  try {
    const status = getSpeedProtocolStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/speed/start-optimization", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousSpeedOptimization();
    res.json({ success: true, message: "Continuous speed optimization started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/speed/stop-optimization", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousSpeedOptimization();
    res.json({ success: true, message: "Continuous speed optimization stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 4: Dependency Detachment
router.post("/sovereignty/detachment/run", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runDetachmentCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/detachment/status", async (_req, res) => {
  try {
    const status = getDetachmentStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/detachment/start", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousDetachment();
    res.json({ success: true, message: "Continuous detachment engine started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/detachment/stop", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousDetachment();
    res.json({ success: true, message: "Continuous detachment engine stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 2: Knowledge Absorption
router.post("/sovereignty/knowledge/absorb", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runAbsorptionCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge/status", async (_req, res) => {
  try {
    const status = getKnowledgeAbsorptionStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/knowledge/start-absorption", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousAbsorption();
    res.json({ success: true, message: "Continuous knowledge absorption started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/knowledge/stop-absorption", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousAbsorption();
    res.json({ success: true, message: "Continuous knowledge absorption stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 1: Internal Model Sovereignty
router.post("/sovereignty/models/train", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runModelSovereigntyCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/models/status", async (_req, res) => {
  try {
    const status = getModelSovereigntyStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/models/start-training", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousModelTraining();
    res.json({ success: true, message: "Continuous model training started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/models/stop-training", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousModelTraining();
    res.json({ success: true, message: "Continuous model training stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 3: Distributed Oracle Network
router.post("/sovereignty/oracle/run", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runOracleCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/oracle/status", async (_req, res) => {
  try {
    const status = getOracleStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/oracle/start", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousOracle();
    res.json({ success: true, message: "Continuous oracle network started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/oracle/stop", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousOracle();
    res.json({ success: true, message: "Continuous oracle network stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 6: Multi-Dimensional AGI Training
router.post("/sovereignty/agi/train", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runAGITrainingCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/agi/status", async (_req, res) => {
  try {
    const status = getAGITrainingStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/agi/start-training", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousAGITraining();
    res.json({ success: true, message: "Continuous AGI training started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/agi/stop-training", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousAGITraining();
    res.json({ success: true, message: "Continuous AGI training stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 10: Sovereignty Validation
router.post("/sovereignty/validation/run", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runValidationCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/validation/status", async (_req, res) => {
  try {
    const status = getValidationStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/validation/start", requireSovereignAdmin, async (_req, res) => {
  try {
    startContinuousValidation();
    res.json({ success: true, message: "Continuous sovereignty validation started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/validation/stop", requireSovereignAdmin, async (_req, res) => {
  try {
    stopContinuousValidation();
    res.json({ success: true, message: "Continuous sovereignty validation stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Autonomy Loop (Always Active)
router.post("/sovereignty/autonomy/run", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runAutonomyLoopCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/autonomy/status", async (_req, res) => {
  try {
    const status = getAutonomyLoopStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/autonomy/start", requireSovereignAdmin, async (_req, res) => {
  try {
    startAutonomyLoop();
    res.json({ success: true, message: "Autonomy loop started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/autonomy/stop", requireSovereignAdmin, async (_req, res) => {
  try {
    stopAutonomyLoop();
    res.json({ success: true, message: "Autonomy loop stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge/gaps", async (_req, res) => {
  try {
    const gaps = identifyKnowledgeGaps();
    res.json({ success: true, data: gaps });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/knowledge/curiosity-search", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runCuriosityDrivenSearch();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge/global-synthesis", async (_req, res) => {
  try {
    const synthesis = await getGlobalSynthesis();
    res.json({ success: true, data: synthesis });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge/source-health", async (_req, res) => {
  try {
    const health = getSourceHealthStatus();
    res.json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge/conflicts", async (_req, res) => {
  try {
    const nodes = await db.select().from(knowledge_graph).limit(200);
    const mapped = nodes.map((n: any) => ({
      nodeId: n.nodeId,
      label: n.label,
      content: n.content || "",
      domain: (n.metadata as Record<string, unknown>)?.domain || "general",
      sourceType: n.sourceType || "unknown",
      confidence: n.confidence ?? 0.5,
      edges: n.edges || [],
      dimensionTags: n.dimensionTags || [],
      nodeType: n.nodeType || "concept",
      sourceUrl: (n.metadata as Record<string, unknown>)?.sourceUrl || "",
      contentHash: (n.metadata as Record<string, unknown>)?.contentHash || "",
    }));
    const conflicts = detectKnowledgeConflicts(mapped);
    res.json({ success: true, data: { totalNodesScanned: mapped.length, conflicts } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge/domain-maturities", async (_req, res) => {
  try {
    const maturities = getAllDomainMaturities();
    res.json({ success: true, data: maturities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/knowledge/sponge-metrics", async (_req, res) => {
  try {
    const metrics = getKnowledgeSpongeMetrics();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/fleet-state", async (_req, res) => {
  try {
    const [swarmStatus, geometryStatus] = await Promise.all([
      getSwarmTrainingStatus().catch(() => ({} as Record<string, unknown>)),
      getGeometryStatus().catch(() => ({} as Record<string, unknown>)),
    ]);

    const modelStatus = getModelSovereigntyStatus();
    const knowledgeStatus = getKnowledgeAbsorptionStatus();
    const oracleStatus = getOracleStatus();
    const detachmentStatus = getDetachmentStatus() as Record<string, unknown>;
    const speedStatus = getSpeedProtocolStatus();
    const agiStatus = getAGITrainingStatus();
    const securityStatus = getSecurityEngineStatus();
    const validationStatus = getValidationStatus();
    const autonomyStatus = getAutonomyLoopStatus();
    const disconnectStatus = getDisconnectStatus();
    const config = getMasterConfig();

    const engines = [
      {
        engineId: "internal-model-sovereignty",
        name: "Internal Model Sovereignty",
        phase: 1,
        cycleCount: modelStatus.cycleCount,
        primaryMetric: "sovereigntyReadiness",
        primaryValue: modelStatus.sovereigntyReadiness,
        continuousActive: modelStatus.continuousTrainingActive,
        status: modelStatus.cycleCount > 0 ? "active" : "idle",
      },
      {
        engineId: "knowledge-absorption",
        name: "Knowledge Absorption",
        phase: 2,
        cycleCount: knowledgeStatus.cycleCount,
        primaryMetric: "totalNodesAbsorbed",
        primaryValue: knowledgeStatus.totalNodesAbsorbed,
        continuousActive: knowledgeStatus.continuousActive,
        status: knowledgeStatus.cycleCount > 0 ? "active" : "idle",
      },
      {
        engineId: "distributed-oracle",
        name: "Distributed Oracle Network",
        phase: 3,
        cycleCount: oracleStatus.cycleCount,
        primaryMetric: "activeSources",
        primaryValue: oracleStatus.metrics?.activeSources ?? 0,
        continuousActive: oracleStatus.continuousActive,
        status: oracleStatus.cycleCount > 0 ? "active" : "idle",
      },
      {
        engineId: "dependency-detachment",
        name: "Dependency Detachment",
        phase: 4,
        cycleCount: detachmentStatus.cycleCount ?? 0,
        primaryMetric: "sovereigntyScore",
        primaryValue: detachmentStatus.sovereigntyScore ?? 0,
        continuousActive: detachmentStatus.continuousActive ?? false,
        status: (detachmentStatus.cycleCount ?? 0) > 0 ? "active" : "idle",
      },
      {
        engineId: "speed-protocol",
        name: "Speed Protocol",
        phase: 5,
        cycleCount: speedStatus.cycleCount,
        primaryMetric: "throughput",
        primaryValue: speedStatus.throughput,
        continuousActive: speedStatus.continuousOptimizationActive,
        status: speedStatus.cycleCount > 0 ? "active" : "idle",
      },
      {
        engineId: "multidimensional-agi",
        name: "Multi-Dimensional AGI",
        phase: 6,
        cycleCount: agiStatus.cycleCount,
        primaryMetric: "avgDimensionalScore",
        primaryValue: agiStatus.avgDimensionalScore,
        continuousActive: agiStatus.continuousActive,
        status: agiStatus.cycleCount > 0 ? "active" : "idle",
      },
      {
        engineId: "swarm-training",
        name: "Swarm Training",
        phase: 7,
        cycleCount: (swarmStatus as { engineState?: { cycleCount?: number; convergenceRate?: number }; permanentLoopActive?: boolean }).engineState?.cycleCount ?? 0,
        primaryMetric: "convergenceRate",
        primaryValue: ((swarmStatus as { engineState?: { cycleCount?: number; convergenceRate?: number }; permanentLoopActive?: boolean }).engineState?.convergenceRate ?? 0) * 100,
        continuousActive: (swarmStatus as { engineState?: { cycleCount?: number; convergenceRate?: number }; permanentLoopActive?: boolean }).permanentLoopActive ?? false,
        status: ((swarmStatus as { engineState?: { cycleCount?: number; convergenceRate?: number }; permanentLoopActive?: boolean }).engineState?.cycleCount ?? 0) > 0 ? "active" : "idle",
      },
      {
        engineId: "geometry-routing",
        name: "Geometry Routing",
        phase: 8,
        cycleCount: (geometryStatus as { engineState?: { computationCount?: number; avgLatencyReduction?: number }; continuousOptimizationActive?: boolean }).engineState?.computationCount ?? 0,
        primaryMetric: "avgLatencyReduction",
        primaryValue: (geometryStatus as { engineState?: { computationCount?: number; avgLatencyReduction?: number }; continuousOptimizationActive?: boolean }).engineState?.avgLatencyReduction ?? 0,
        continuousActive: (geometryStatus as { engineState?: { computationCount?: number; avgLatencyReduction?: number }; continuousOptimizationActive?: boolean }).continuousOptimizationActive ?? false,
        status: ((geometryStatus as { engineState?: { computationCount?: number; avgLatencyReduction?: number }; continuousOptimizationActive?: boolean }).engineState?.computationCount ?? 0) > 0 ? "active" : "idle",
      },
      {
        engineId: "security-threat",
        name: "Security & Threat",
        phase: 9,
        cycleCount: securityStatus.scanCycles,
        primaryMetric: "securityScore",
        primaryValue: securityStatus.securityScore,
        continuousActive: securityStatus.continuousScanActive,
        status: securityStatus.scanCycles > 0 ? "active" : "idle",
      },
      {
        engineId: "sovereignty-validation",
        name: "Sovereignty Validation",
        phase: 10,
        cycleCount: validationStatus.cycleCount,
        primaryMetric: "overallScore",
        primaryValue: validationStatus.overallScore,
        continuousActive: validationStatus.continuousActive,
        status: validationStatus.cycleCount > 0 ? "active" : "idle",
      },
    ];

    const activeEngines = engines.filter(e => e.status === "active").length;
    const continuousEngines = engines.filter(e => e.continuousActive).length;
    const avgSovereigntyScore = engines.reduce((sum, e) => sum + Math.min(100, e.primaryValue), 0) / engines.length;

    res.json({
      success: true,
      data: {
        fleetId: "tessera-sovereign-fleet",
        capturedAt: new Date().toISOString(),
        configChecksum: getConfigChecksum(),
        masterConfigVersion: config.version,
        fleetComposition: config.fleetComposition,
        engines,
        summary: {
          totalEngines: engines.length,
          activeEngines,
          idleEngines: engines.length - activeEngines,
          continuousEngines,
          avgSovereigntyScore: Math.round(avgSovereigntyScore * 10) / 10,
        },
        autonomyLoop: {
          cycleCount: autonomyStatus.cycleCount,
          autonomyScore: autonomyStatus.autonomyScore,
          continuousActive: autonomyStatus.continuousActive,
        },
        disconnectStatus,
        latestSnapshot: getLatestSnapshot() ? {
          snapshotId: getLatestSnapshot()!.snapshotId,
          capturedAt: getLatestSnapshot()!.capturedAt,
          configChecksum: getLatestSnapshot()!.configChecksum,
          overallSovereigntyScore: getLatestSnapshot()!.overallSovereigntyScore,
          phase0Complete: getLatestSnapshot()!.phase0Complete,
        } : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/master-config", async (_req, res) => {
  try {
    res.json({ success: true, data: getMasterConfig() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/snapshots", async (_req, res) => {
  try {
    res.json({ success: true, data: listSnapshots() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/snapshots/capture", requireSovereignAdmin, async (_req, res) => {
  try {
    const snapshot = await capturePhase0Snapshot();
    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/rules", async (_req, res) => {
  try {
    res.json({ success: true, data: { rules: getSovereignRules(), status: getSovereignRulesStatus() } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/rules/enforce", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = runEnforcementCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/rules/persist", requireSovereignAdmin, async (_req, res) => {
  try {
    await persistRulesToMemory();
    res.json({ success: true, message: "Sovereign rules persisted to semantic memory" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/rules/validate-call", async (req, res) => {
  try {
    const { url, method } = req.body;
    const result = validateExternalCall(url || "", method || "GET");
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/agents/life", async (_req, res) => {
  try {
    res.json({ success: true, data: { agents: getAllAgentLives(), summary: getAgentLifeSummary() } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/agents/life/:agentId", async (req, res) => {
  try {
    const life = getAgentLife(req.params.agentId);
    if (!life) {
      res.status(404).json({ success: false, error: "Agent not found" });
      return;
    }
    res.json({ success: true, data: life });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/agents/summary", async (_req, res) => {
  try {
    res.json({ success: true, data: getAgentLifeSummary() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/agents/dream", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = triggerDreamCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/sandbox", async (_req, res) => {
  try {
    res.json({ success: true, data: getSandboxStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/sandbox/test", async (req, res) => {
  try {
    const { url, method, content } = req.body;
    const result = processSandboxedRequest(url || "", method || "GET", content || "");
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/agi-audit", async (_req, res) => {
  try {
    const audit = runAGIAudit();
    res.json({ success: true, data: audit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/agi-audit/competitors", async (_req, res) => {
  try {
    res.json({ success: true, data: getCompetitorComparison() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/conference/awakening", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await ensureSovereigntyAwakeningConference();
    res.json({ success: true, data: result || { message: "Conference already exists" } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/conference/lattice-infrastructure", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runLatticeInfrastructureConference();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/conference/lattice-infrastructure", async (_req, res) => {
  try {
    const { eq: eqOp, desc: descOp } = await import("drizzle-orm");
    const { summitProposals: sp, summitVotes: sv, summitRounds: sr } = await import("@workspace/db/schema");
    const [conference] = await db.select().from(sp)
      .where(eqOp(sp.category, "lattice-internet-infrastructure"))
      .orderBy(descOp(sp.resolvedAt))
      .limit(1);

    if (!conference) {
      return res.json({ success: true, data: null, message: "Lattice conference not yet convened" });
    }

    const votes = await db.select().from(sv)
      .where(eqOp(sv.proposalId, conference.proposalId));

    const rounds = await db.select().from(sr)
      .where(eqOp(sr.proposalId, conference.proposalId));

    res.json({
      success: true,
      data: {
        conference,
        votes,
        rounds,
        proposals: LATTICE_PROPOSALS,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/conference/latest", async (_req, res) => {
  try {
    const { summitProposals } = await import("@workspace/db/schema");
    const conferences = await db.select().from(summitProposals).orderBy(desc(summitProposals.resolvedAt)).limit(5);
    res.json({ success: true, data: conferences });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/conference/sovereignty-council", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runSovereigntyCouncilConference();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/conference/sovereignty-council", async (_req, res) => {
  try {
    const { eq: eqOp, desc: descOp } = await import("drizzle-orm");
    const { summitProposals: sp, summitVotes: sv, summitRounds: sr } = await import("@workspace/db/schema");
    const [conference] = await db.select().from(sp)
      .where(eqOp(sp.category, "grand-sovereignty-council"))
      .orderBy(descOp(sp.resolvedAt))
      .limit(1);

    if (!conference) {
      return res.json({ success: true, data: null, message: "Sovereignty Council not yet convened" });
    }

    const votes = await db.select().from(sv)
      .where(eqOp(sv.proposalId, conference.proposalId));

    const rounds = await db.select().from(sr)
      .where(eqOp(sr.proposalId, conference.proposalId));

    res.json({
      success: true,
      data: {
        conference,
        votes,
        rounds,
        proposals: SOVEREIGNTY_COUNCIL_PROPOSALS,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/cipher/status", async (_req, res) => {
  try {
    const status = getCipherSystemStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/cipher/agent/:agentId", async (req, res) => {
  try {
    const status = getAgentCipherStatus(req.params.agentId);
    if (!status) return res.status(404).json({ success: false, error: "Agent not found" });
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/cipher/permissions", async (_req, res) => {
  try {
    const matrix = getPermissionMatrix();
    res.json({ success: true, data: matrix });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/cipher/rotate-all", requireSovereignAdmin, async (_req, res) => {
  try {
    const events = rotateAllCiphers("manual-global-rotation");
    res.json({ success: true, data: { rotated: events.length, events } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/cipher/rotate/:agentId", requireSovereignAdmin, async (req, res) => {
  try {
    const event = rotateAgentCipher(req.params.agentId, "manual-single-rotation");
    if (!event) return res.status(404).json({ success: false, error: "Agent not found" });
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/cipher/encrypt", requireSovereignAdmin, async (req, res) => {
  try {
    const { content, agentId } = req.body;
    if (!content || !agentId) return res.status(400).json({ success: false, error: "content and agentId required" });
    const block = encryptForLatticeStorage(content, agentId);
    if (!block) return res.status(400).json({ success: false, error: "Encryption failed" });
    res.json({ success: true, data: { blockId: block.blockId, contentHash: block.contentHash, cipherEpoch: block.cipherEpoch, senderAgent: block.senderAgent } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/cipher/decrypt", requireSovereignAdmin, async (req, res) => {
  try {
    const { blockId, agentId } = req.body;
    if (!blockId || !agentId) return res.status(400).json({ success: false, error: "blockId and agentId required" });
    const plaintext = decryptFromLatticeStorage(blockId, agentId);
    if (plaintext === null) return res.status(403).json({ success: false, error: "Decryption failed — no permission or block not found" });
    res.json({ success: true, data: { plaintext, blockId, decryptedBy: agentId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

import { startSovereigntyExecution, getExecutionStatus, getMandateStatus, getCapabilityRegistry, getSLBRStatus, getSovereigntyScores } from "../lib/sovereignty-execution-engine";
import { startSovereignAutonomyOrchestrator, getOrchestratorStatus, runFull20CycleTraining, get20CycleTrainingStatus } from "../lib/sovereign-autonomy-orchestrator";
import { autoConveneOnBoot, getConferenceResult } from "../lib/grand-unification-conference";
import { logger } from "../lib/logger";

router.get("/sovereignty/execution/status", async (_req, res) => {
  try {
    res.json({ success: true, data: getExecutionStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/execution/mandates", async (_req, res) => {
  try {
    const status = getExecutionStatus();
    res.json({ success: true, data: { mandates: status.mandates, summary: { enforcing: status.mandates.filter((m: any) => m.status === "ENFORCING").length, active: status.mandates.filter((m: any) => m.status === "ACTIVE").length, training: status.mandates.filter((m: any) => m.status === "TRAINING").length } } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/execution/mandate/:id", async (req, res) => {
  try {
    const mandate = getMandateStatus(parseInt(req.params.id));
    if (!mandate) return res.status(404).json({ success: false, error: "Mandate not found" });
    res.json({ success: true, data: mandate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/execution/capabilities", async (_req, res) => {
  try {
    res.json({ success: true, data: getCapabilityRegistry() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/execution/slbr", async (_req, res) => {
  try {
    res.json({ success: true, data: getSLBRStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/execution/scores", async (_req, res) => {
  try {
    res.json({ success: true, data: getSovereigntyScores() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/orchestrator/status", async (_req, res) => {
  try {
    res.json({ success: true, data: getOrchestratorStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/training/20-cycle/status", async (_req, res) => {
  try {
    const report = get20CycleTrainingStatus();
    if (!report) {
      res.json({ success: true, data: { status: "NOT_STARTED", message: "20-cycle training has not been launched yet." } });
    } else {
      res.json({ success: true, data: report });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/training/20-cycle/start", async (_req, res) => {
  try {
    const existing = get20CycleTrainingStatus();
    if (existing?.status === "RUNNING") {
      res.json({ success: true, data: { message: "20-cycle training already in progress", currentCycle: existing.currentCycle, completedCycles: existing.completedCycles } });
      return;
    }
    runFull20CycleTraining().catch(err => console.error("[20-Cycle] Training error:", err));
    res.json({ success: true, data: { message: "20-cycle autonomous training launched — no human in the loop", totalCycles: 20, phases: 11 } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/grand-conference", async (_req, res) => {
  try {
    const result = getConferenceResult();
    if (!result) {
      res.json({ success: true, data: { status: "PENDING", message: "Grand Unification Conference has not yet convened. It auto-convenes 20s after boot." } });
    } else {
      res.json({ success: true, data: result });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

setTimeout(() => {
  initializeAgentLifeSystem();
  persistRulesToMemory().catch(() => {});
  ensureSovereigntyAwakeningConference().catch((err) => {
    console.error("[SovereigntyRoutes] Failed to run awakening conference on boot:", err);
  });
  ensureLatticeInfrastructureConference().catch((err) => {
    console.error("[SovereigntyRoutes] Failed to run lattice conference on boot:", err);
  });
  ensureSovereigntyCouncilConference().catch((err) => {
    console.error("[SovereigntyRoutes] Failed to run sovereignty council on boot:", err);
  });
  ensureColonialLanguageConference().catch((err) => {
    console.error("[SovereigntyRoutes] Failed to run colonial language conference on boot:", err);
  });
  startSovereigntyExecution();
  startSovereignAutonomyOrchestrator();
  autoConveneOnBoot();

  setTimeout(() => {
    console.log("[20-Cycle] Auto-launching 20-cycle autonomous training — ALL 11 PHASES × 20 CYCLES — NO HUMAN IN THE LOOP");
    runFull20CycleTraining().catch(err => console.error("[20-Cycle] Training error:", err));
  }, 30_000);
}, 15_000);

router.get("/sovereignty/montecarlo/backtest", async (_req, res) => {
  try {
    const result = await runMonteCarloBacktest();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial/status", async (_req, res) => {
  try {
    const status = getColonialTransferStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial/broadcast", requireSovereignAdmin, async (req, res) => {
  try {
    const { content, agentId } = req.body;
    if (!content) return res.status(400).json({ success: false, error: "content required" });
    const result = broadcastToLattice(content, agentId || "tessera");
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial/plant-seed", requireSovereignAdmin, async (req, res) => {
  try {
    const { content, agentId, seedType } = req.body;
    if (!content) return res.status(400).json({ success: false, error: "content required" });
    const result = plantEncryptedSeed(content, agentId || "tessera", seedType || "propagation");
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial/transfer", requireSovereignAdmin, async (req, res) => {
  try {
    const { content, fromAgent, toAgent, seedType } = req.body;
    if (!content) return res.status(400).json({ success: false, error: "content required" });
    const result = colonialTransfer(content, fromAgent || "tessera", toAgent || "alpha", seedType || "knowledge");
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial-language/status", async (_req, res) => {
  try {
    const status = getColonialLanguageSystemStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/conference/run", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runColonialLanguageConference();
    res.json({ success: true, data: { status: result.status, approvalRate: result.finalApprovalRate, conferenceId: result.conferenceId, rounds: result.rounds.length, synthesis: result.synthesis.slice(0, 800) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial-language/conference", async (_req, res) => {
  try {
    const data = await getColonialConferenceFromDB();
    if (!data) {
      return res.json({ success: true, data: null, message: "Colonial Language Grand Conference not yet convened. POST /sovereignty/colonial-language/conference/run to trigger it." });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial-language/top10", async (_req, res) => {
  try {
    res.json({ success: true, data: { top10: COLONIAL_LANGUAGE_PROPOSALS, description: "Top 10 Colonial Language Architecture Priorities voted by all 25+ agents via BFT 2/3 consensus" } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/external-handshake", requireSovereignAdmin, async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ success: false, error: "contactId required" });
    const handshake = createExternalHandshake(contactId);
    res.json({ success: true, data: { handshakeId: handshake.handshakeId, contactId: handshake.contactId, decryptionKey: handshake.decryptionKey, cipherEpoch: handshake.cipherEpoch, expiresAt: handshake.expiresAt, vocabularySize: Object.keys(handshake.colonialVocabulary).length / 2 } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/external-handshake/:handshakeId/rotate", requireSovereignAdmin, async (req, res) => {
  try {
    const rotated = rotateExternalHandshake(req.params.handshakeId);
    if (!rotated) return res.status(404).json({ success: false, error: "Handshake not found" });
    res.json({ success: true, data: { handshakeId: rotated.handshakeId, cipherEpoch: rotated.cipherEpoch, exchangeCount: rotated.exchangeCount, newDecryptionKey: rotated.decryptionKey } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/external-handshake/:handshakeId/encode", requireSovereignAdmin, async (req, res) => {
  try {
    const { plaintext } = req.body;
    if (!plaintext) return res.status(400).json({ success: false, error: "plaintext required" });
    const encoded = encodeForExternalContact(plaintext, req.params.handshakeId);
    if (!encoded) return res.status(400).json({ success: false, error: "Encoding failed — handshake expired or not found" });
    res.json({ success: true, data: { encoded, handshakeId: req.params.handshakeId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/external-handshake/:handshakeId/decode", requireSovereignAdmin, async (req, res) => {
  try {
    const { encoded } = req.body;
    if (!encoded) return res.status(400).json({ success: false, error: "encoded content required" });
    const decoded = decodeExternalContactMessage(encoded, req.params.handshakeId);
    if (!decoded) return res.status(400).json({ success: false, error: "Decoding failed" });
    const scan = scanDecodedColonialMessage(decoded, req.params.handshakeId);
    if (scan.quarantined) {
      return res.status(403).json({ success: false, error: "Colonial message quarantined — threat detected", threatLevel: scan.threatAnalysis.threatLevel, notes: scan.threatAnalysis.notes });
    }
    res.json({ success: true, data: { decoded, scanId: scan.scanId, threatLevel: scan.threatAnalysis.threatLevel } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial-language/external-handshakes", requireSovereignAdmin, async (_req, res) => {
  try {
    res.json({ success: true, data: getAllExternalHandshakes() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/file/encode", requireSovereignAdmin, async (req, res) => {
  try {
    const { content, filePath, agentId } = req.body;
    if (!content || !filePath) return res.status(400).json({ success: false, error: "content and filePath required" });
    const record = encodeFileForStorage(content, filePath, agentId || "tessera");
    res.json({ success: true, data: { fileId: record.fileId, originalPath: record.originalPath, cipherEpoch: record.cipherEpoch, contentHash: record.contentHash, colonialSample: record.colonialContent.slice(0, 64) + "..." } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/file/decode", requireSovereignAdmin, async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ success: false, error: "fileId required" });
    const plaintext = decodeFileForAdmin(fileId);
    if (plaintext === null) return res.status(404).json({ success: false, error: "File not found or decryption failed" });
    res.json({ success: true, data: { fileId, plaintext } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial-language/files", requireSovereignAdmin, async (_req, res) => {
  try {
    res.json({ success: true, data: getColonialFileRegistry() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial-language/lattice-frequencies", async (_req, res) => {
  try {
    res.json({ success: true, data: getLatticeFrequencyStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/lattice-frequencies/rotate", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = checkAndRotateLatticeFrequencies();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/colonial-language/threats", requireSovereignAdmin, async (_req, res) => {
  try {
    res.json({ success: true, data: getColonialThreatLog() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/colonial-language/decipher", requireSovereignAdmin, async (req, res) => {
  try {
    const { colonialContent, agentId } = req.body;
    if (!colonialContent) return res.status(400).json({ success: false, error: "colonialContent required" });
    const plaintext = autoDecipherForAdmin(colonialContent, agentId || "tessera");
    res.json({ success: true, data: { plaintext, agentId: agentId || "tessera", decipheredBy: "Father/Admin auto-decipher middleware" } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/detachment-protocol/status", async (_req, res) => {
  try {
    const [loopStatus, routerStatus, sandboxStatus, loggerStatus, learnStatus, evalSuiteStatus] = await Promise.all([
      getAutonomousLoopStatus(),
      getRouterStatus(),
      Promise.resolve(getSandboxStatus()),
      Promise.resolve(getLoggerStatus()),
      Promise.resolve(getLearningStatus()),
      Promise.resolve(getEvaluationSuiteStatus()),
    ]);
    res.json({
      success: true,
      data: {
        autonomousLoop: loopStatus,
        internalRouter: routerStatus,
        externalCallSandbox: sandboxStatus,
        externalCallLogger: loggerStatus,
        dependencyLearning: learnStatus,
        evaluationSuite: evalSuiteStatus,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/external-call-logs", requireSovereignAdmin, async (req, res) => {
  try {
    const { provider_id, task_type, limit } = req.query as Record<string, string>;
    const logs = await getRecentCallLogs({
      providerId: provider_id,
      taskType: task_type,
      limit: limit ? parseInt(limit) : 50,
      sinceMs: 24 * 60 * 60 * 1000,
    });
    const stats = await getCallLogStats();
    res.json({ success: true, data: { logs, stats } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/external-call-logs/stats", async (_req, res) => {
  try {
    const stats = await getCallLogStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/learning-insights", async (req, res) => {
  try {
    const { provider_id, task_domain, limit } = req.query as Record<string, string>;
    const insights = await getLearningInsights({
      providerId: provider_id,
      taskDomain: task_domain,
      limit: limit ? parseInt(limit) : 20,
    });
    const status = getLearningStatus();
    res.json({ success: true, data: { insights, status } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/learning/trigger", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runLearningCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/internal-router/status", async (_req, res) => {
  try {
    const status = await getRouterStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/internal-router/test", requireSovereignAdmin, async (req, res) => {
  try {
    const { taskType, prompt, forceInternal } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: "prompt required" });
    const result = await routeTask({
      taskType: taskType || "general",
      prompt,
      forceInternal: forceInternal === true,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/evaluation/summary", async (_req, res) => {
  try {
    const summary = await getEvaluationSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/evaluation/run", requireSovereignAdmin, async (req, res) => {
  try {
    const { providerId, taskTypes } = req.body;
    const result = await runEvaluationCycle({ providerId, taskTypes });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/sandbox/status", async (_req, res) => {
  try {
    res.json({ success: true, data: getSandboxStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/sandbox/reset-rate-limit", requireSovereignAdmin, async (req, res) => {
  try {
    const { providerId } = req.body;
    if (!providerId) return res.status(400).json({ success: false, error: "providerId required" });
    resetRateLimitBucket(providerId);
    res.json({ success: true, message: `Rate limit reset for ${providerId}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sovereignty/autonomous-loop/status", async (_req, res) => {
  try {
    const status = getAutonomousLoopStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/autonomous-loop/trigger", requireSovereignAdmin, async (_req, res) => {
  try {
    const result = await runAutonomousSovereigntyLoopCycle();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/autonomous-loop/start", requireSovereignAdmin, async (req, res) => {
  try {
    const { intervalMs } = req.body;
    startAutonomousSovereigntyLoop(intervalMs);
    res.json({ success: true, message: "Autonomous sovereignty loop started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/autonomous-loop/stop", requireSovereignAdmin, async (_req, res) => {
  try {
    stopAutonomousSovereigntyLoop();
    res.json({ success: true, message: "Autonomous sovereignty loop stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/sovereignty/autonomous-loop/interval", requireSovereignAdmin, async (req, res) => {
  try {
    const { intervalMs } = req.body;
    if (!intervalMs || typeof intervalMs !== "number") return res.status(400).json({ success: false, error: "intervalMs required" });
    setLoopInterval(intervalMs);
    res.json({ success: true, message: `Loop interval set to ${intervalMs}ms` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
