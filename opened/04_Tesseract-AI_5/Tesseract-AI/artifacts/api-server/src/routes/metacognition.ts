import { Router } from "express";
import type { Request, Response } from "express";
import {
  getMetacognitionStatus,
  planTask,
  reflectOnTask,
  adaptStrategies,
  getCognitiveLoadStatus,
  getEpistemicStatus,
  getCausalAnalyses,
  getAnomalies,
  getEngineHealth,
  registerPrediction,
  resolvePrediction,
  instrumentEngine,
} from "../lib/metacognition-engine";
import { logger } from "../lib/logger";

const router = Router();

router.get("/metacognition/status", async (_req: Request, res: Response) => {
  try {
    const status = await getMetacognitionStatus();
    res.json(status);
  } catch (err) {
    logger.error({ err }, "Failed to get metacognition status");
    res.status(500).json({ error: "Failed to retrieve metacognition status" });
  }
});

router.get("/metacognition/self-model", async (_req: Request, res: Response) => {
  try {
    const status = await getMetacognitionStatus();
    res.json({
      selfModel: status.selfModel,
      improvementTrajectory: status.improvementTrajectory,
      successRate: status.successRate,
      avgConfidenceGain: status.avgConfidenceGain,
      cyclesRun: status.cyclesRun,
      crossSessionImprovement: status.crossSessionImprovement,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get self-model");
    res.status(500).json({ error: "Failed to retrieve self-model" });
  }
});

router.get("/metacognition/strategies", async (_req: Request, res: Response) => {
  try {
    const status = await getMetacognitionStatus();
    res.json({
      topStrategies: status.topStrategies,
      bestByType: status.selfModel.bestStrategiesByType,
      explorationProfile: status.selfModel.personalityProfile,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get strategies");
    res.status(500).json({ error: "Failed to retrieve strategies" });
  }
});

router.get("/metacognition/failure-patterns", async (_req: Request, res: Response) => {
  try {
    const status = await getMetacognitionStatus();
    res.json({
      activePatterns: status.activeFailurePatterns,
      commonFailureModes: status.selfModel.commonFailureModes,
      causalInsights: status.selfModel.causalInsights,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get failure patterns");
    res.status(500).json({ error: "Failed to retrieve failure patterns" });
  }
});

router.get("/metacognition/reflections", async (_req: Request, res: Response) => {
  try {
    const status = await getMetacognitionStatus();
    res.json({
      recentReflections: status.recentReflections,
      totalTasks: status.totalTasks,
      improvementTrajectory: status.improvementTrajectory,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get reflections");
    res.status(500).json({ error: "Failed to retrieve reflections" });
  }
});

router.get("/metacognition/cognitive-load", async (_req: Request, res: Response) => {
  try {
    const load = getCognitiveLoadStatus();
    const status = await getMetacognitionStatus();
    res.json({
      current: load,
      history: status.cognitiveLoadHistory,
      engineHealth: getEngineHealth(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to get cognitive load");
    res.status(500).json({ error: "Failed to retrieve cognitive load" });
  }
});

router.get("/metacognition/epistemic", (_req: Request, res: Response) => {
  try {
    const epistemic = getEpistemicStatus();
    res.json(epistemic);
  } catch (err) {
    logger.error({ err }, "Failed to get epistemic state");
    res.status(500).json({ error: "Failed to retrieve epistemic state" });
  }
});

router.get("/metacognition/causal", async (_req: Request, res: Response) => {
  try {
    const analyses = await getCausalAnalyses();
    res.json({ analyses });
  } catch (err) {
    logger.error({ err }, "Failed to get causal analyses");
    res.status(500).json({ error: "Failed to retrieve causal analyses" });
  }
});

router.get("/metacognition/anomalies", async (_req: Request, res: Response) => {
  try {
    const anomalies = getAnomalies();
    res.json({
      anomalies,
      total: anomalies.length,
      bySeverity: {
        critical: anomalies.filter(a => a.severity === "critical").length,
        high: anomalies.filter(a => a.severity === "high").length,
        medium: anomalies.filter(a => a.severity === "medium").length,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to get anomalies");
    res.status(500).json({ error: "Failed to retrieve anomalies" });
  }
});

router.get("/metacognition/engine-health", async (_req: Request, res: Response) => {
  try {
    const health = getEngineHealth();
    const entries = Object.entries(health);
    const healthyCount = entries.filter(([, v]) => v.recentFailures === 0).length;
    res.json({
      engines: health,
      summary: {
        total: entries.length,
        healthy: healthyCount,
        degraded: entries.length - healthyCount,
        avgLatencyMs: entries.length > 0
          ? entries.reduce((acc, [, v]) => acc + v.avgLatencyMs, 0) / entries.length
          : 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to get engine health");
    res.status(500).json({ error: "Failed to retrieve engine health" });
  }
});

router.get("/metacognition/personality", async (_req: Request, res: Response) => {
  try {
    const status = await getMetacognitionStatus();
    res.json({
      personality: status.selfModel.personalityProfile,
      metaMetaCognition: status.selfModel.metaMetaCognition,
      uncertaintyCalibration: status.selfModel.uncertaintyCalibration,
      selfCorrectionRate: status.selfModel.selfCorrectionRate,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get personality profile");
    res.status(500).json({ error: "Failed to retrieve personality profile" });
  }
});

router.get("/metacognition/improvement", async (_req: Request, res: Response) => {
  try {
    const status = await getMetacognitionStatus();
    res.json({
      trajectory: status.improvementTrajectory,
      crossSession: status.crossSessionImprovement,
      successRate: status.successRate,
      avgConfidenceGain: status.avgConfidenceGain,
      cyclesRun: status.cyclesRun,
      learningRate: status.selfModel.personalityProfile.learningRate,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get improvement data");
    res.status(500).json({ error: "Failed to retrieve improvement data" });
  }
});

router.post("/metacognition/plan", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const taskType = String(body.taskType ?? "manual");
    const plan = String(body.plan ?? "");
    if (!plan) {
      res.status(400).json({ error: "plan is required" });
      return;
    }

    const result = await planTask(taskType, plan, {
      risks: Array.isArray(body.risks) ? body.risks.map(String) : [],
      assumptions: Array.isArray(body.assumptions) ? body.assumptions.map(String) : [],
      expectedOutcome: body.expectedOutcome ? String(body.expectedOutcome) : undefined,
      uncertaintyLevel: typeof body.uncertaintyLevel === "number" ? body.uncertaintyLevel : undefined,
      engineSource: body.engineSource ? String(body.engineSource) : undefined,
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to create task plan");
    res.status(500).json({ error: "Failed to create task plan" });
  }
});

router.post("/metacognition/reflect", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const taskId = String(body.taskId ?? "");
    if (!taskId) {
      res.status(400).json({ error: "taskId is required" });
      return;
    }

    await reflectOnTask({
      taskId,
      actualOutcome: String(body.actualOutcome ?? ""),
      success: Boolean(body.success),
      mistakes: Array.isArray(body.mistakes) ? body.mistakes.map(String) : [],
      lessonsLearned: Array.isArray(body.lessonsLearned) ? body.lessonsLearned.map(String) : [],
      adaptations: Array.isArray(body.adaptations) ? body.adaptations.map(String) : [],
      confidenceAfter: typeof body.confidenceAfter === "number" ? body.confidenceAfter : 0.5,
      durationMs: typeof body.durationMs === "number" ? body.durationMs : 0,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to record reflection");
    res.status(500).json({ error: "Failed to record reflection" });
  }
});

router.post("/metacognition/adapt", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const taskType = String(body.taskType ?? "");
    const strategyName = String(body.strategyName ?? "");
    if (!taskType || !strategyName) {
      res.status(400).json({ error: "taskType and strategyName are required" });
      return;
    }

    await adaptStrategies(
      taskType,
      strategyName,
      Boolean(body.success),
      typeof body.durationMs === "number" ? body.durationMs : 0
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to adapt strategy");
    res.status(500).json({ error: "Failed to adapt strategy" });
  }
});

router.post("/metacognition/predict", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const prediction = String(body.prediction ?? "");
    const domain = String(body.domain ?? "general");
    if (!prediction) {
      res.status(400).json({ error: "prediction is required" });
      return;
    }

    const expectedByMs = typeof body.expectedByMs === "number" ? body.expectedByMs : 600_000;
    const id = registerPrediction(prediction, domain, expectedByMs);

    res.json({ id, prediction, domain, expectedByMs });
  } catch (err) {
    logger.error({ err }, "Failed to register prediction");
    res.status(500).json({ error: "Failed to register prediction" });
  }
});

router.post("/metacognition/predict/resolve", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const id = String(body.id ?? "");
    const correct = Boolean(body.correct);
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }

    resolvePrediction(id, correct);
    res.json({ ok: true, id, correct });
  } catch (err) {
    logger.error({ err }, "Failed to resolve prediction");
    res.status(500).json({ error: "Failed to resolve prediction" });
  }
});

export default router;
