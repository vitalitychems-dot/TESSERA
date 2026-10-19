import { Router, type Request, type Response } from "express";
import {
  getThrottleMetrics,
  getSystemLoad,
  pauseModule,
  resumeModule,
  pauseAllEvolution,
  resumeAllEvolution,
  resetModuleCooldown,
} from "../lib/evolution-throttle";
import { getEvolutionMetrics } from "../lib/self-code-evolution";
import { getRecursiveSelfImprovementMetrics } from "../lib/recursive-self-improvement";
import { getSchedulerMetrics, getSchedulerHistory } from "../lib/task-scheduler";
import { getScoringMetrics } from "../lib/sovereignty-impact-scoring";
import { getRecentAttempts } from "../lib/evolution-attempt-ledger";
import { requireAdminSession } from "../lib/sovereign-admin";
import { logger } from "../lib/logger";

const router = Router();

function genericFailure(res: Response, err: unknown, log: string, error: string): void {
  const name = err instanceof Error ? err.name : "Error";
  logger.error({ name }, log);
  res.status(500).json({ ok: false, error });
}

router.get("/evolution-health", (_req: Request, res: Response) => {
  const throttle = getThrottleMetrics();
  const evolution = getEvolutionMetrics();
  const improvement = getRecursiveSelfImprovementMetrics();
  const scheduler = getSchedulerMetrics();

  const systemLoad = getSystemLoad();

  res.json({
    ok: true,
    data: {
      systemLoad: {
        cpuLoad: Math.round(systemLoad.cpuLoad * 100),
        memoryUsage: Math.round(systemLoad.memoryUsage * 100),
        highLoad: systemLoad.highLoad,
      },
      throttle,
      evolution: {
        totalProposals: evolution.totalProposals,
        appliedChanges: evolution.appliedChanges,
        rejectedCount: evolution.rejectedCount,
        rolledBackChanges: evolution.rolledBackChanges,
        lastEvolutionAt: evolution.lastEvolutionAt,
        isLocked: evolution.isLocked,
      },
      improvement: {
        improvementCycles: improvement.improvementCycles,
        overallCodeHealth: improvement.overallCodeHealth,
        patches: improvement.patches,
        testing: improvement.testing,
      },
      scheduler: {
        running: scheduler.running,
        totalTasks: scheduler.totalTasks,
        activeTasks: scheduler.activeTasks,
        runningNow: scheduler.runningNow,
      },
    },
  });
});

router.get("/evolution-health/scheduler", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      ...getSchedulerMetrics(),
      sovereigntyScoring: getScoringMetrics(),
      history: getSchedulerHistory(20),
    },
  });
});

router.get("/evolution-health/attempts", requireAdminSession, (req: Request, res: Response) => {
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limitNum = typeof limitRaw === "string" ? parseInt(limitRaw, 10) : 50;
  const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 200) : 50;
  const attempts = getRecentAttempts(limit);
  const counts = attempts.reduce(
    (acc, a) => {
      acc[a.event] = (acc[a.event] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  res.json({ ok: true, data: { attempts, counts, total: attempts.length } });
});

router.post("/evolution-health/pause/:moduleId", requireAdminSession, (req: Request, res: Response) => {
  const moduleId = req.params.moduleId;
  if (!moduleId) {
    res.status(400).json({ ok: false, error: "moduleId required" });
    return;
  }
  try {
    if (moduleId === "_all") {
      pauseAllEvolution();
      res.json({ ok: true, message: "All evolution paused" });
    } else {
      pauseModule(String(moduleId));
      res.json({ ok: true, message: `Module ${moduleId} paused` });
    }
  } catch (err) {
    genericFailure(res, err, "evolution pause failed", "evolution-pause-failed");
  }
});

router.post("/evolution-health/resume/:moduleId", requireAdminSession, (req: Request, res: Response) => {
  const moduleId = req.params.moduleId;
  if (!moduleId) {
    res.status(400).json({ ok: false, error: "moduleId required" });
    return;
  }
  try {
    if (moduleId === "_all") {
      resumeAllEvolution();
      res.json({ ok: true, message: "All evolution resumed" });
    } else {
      resumeModule(String(moduleId));
      res.json({ ok: true, message: `Module ${moduleId} resumed` });
    }
  } catch (err) {
    genericFailure(res, err, "evolution resume failed", "evolution-resume-failed");
  }
});

router.post("/evolution-health/reset/:moduleId", requireAdminSession, (req: Request, res: Response) => {
  const moduleId = req.params.moduleId;
  if (!moduleId) {
    res.status(400).json({ ok: false, error: "moduleId required" });
    return;
  }
  try {
    resetModuleCooldown(String(moduleId));
    res.json({ ok: true, message: `Cooldown reset for ${moduleId}` });
  } catch (err) {
    genericFailure(res, err, "evolution reset failed", "evolution-reset-failed");
  }
});

export default router;
