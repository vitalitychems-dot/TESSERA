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
  startContinuousAbsorption,
  stopContinuousAbsorption,
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
  startAutonomyLoop,
  stopAutonomyLoop,
} from "../lib/autonomy-loop-engine";
import { db } from "@workspace/db";
import { swarm_nodes, swarm_sync_logs, internal_models, training_pipeline, knowledge_graph, data_sources, security_events, sovereignty_metrics } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

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
    (req.body as any)?.adminKey;
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
  } catch {}
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
export default router;
