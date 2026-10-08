import { Router, type Request, type Response } from "express";
import os from "os";
import { getResourceState, getTaskList, enableTask, disableTask, forceGC } from "./resource-manager";
import { getProviderHealth, getCircuitBreakerSummary, resetProvider, resetAllProviders } from "./smart-circuit-breaker";

const router = Router();
const serverStartTime = Date.now();

router.get("/api/system/health", (_req: Request, res: Response) => {
  try {
    const resourceState = getResourceState();
    const circuitBreaker = getCircuitBreakerSummary();
    const mem = process.memoryUsage();
    const uptimeSeconds = Math.round((Date.now() - serverStartTime) / 1000);
    const uptimeHours = Math.round(uptimeSeconds / 3600 * 10) / 10;

    res.json({
      status: resourceState.healthScore > 70 ? "healthy" : resourceState.healthScore > 40 ? "degraded" : "critical",
      healthScore: resourceState.healthScore,
      uptime: {
        seconds: uptimeSeconds,
        hours: uptimeHours,
        formatted: formatUptime(uptimeSeconds),
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
        percent: resourceState.memoryPercent,
      },
      cpu: {
        loadAvg: os.loadavg(),
        cores: os.cpus().length,
      },
      tasks: {
        active: resourceState.activeTasks,
        total: resourceState.totalTasks,
      },
      llmProviders: circuitBreaker,
      platform: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        totalMemoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10,
        freeMemoryGB: Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10,
      },
      timestamp: Date.now(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/api/system/health/detailed", (_req: Request, res: Response) => {
  try {
    const resourceState = getResourceState();
    const providerHealth = getProviderHealth();
    const taskList = getTaskList();

    res.json({
      resources: resourceState,
      providers: providerHealth,
      tasks: taskList,
      timestamp: Date.now(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/api/system/tasks", (_req: Request, res: Response) => {
  try {
    res.json({ tasks: getTaskList() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function requireAdmin(req: Request, res: Response): boolean {
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  const provided = req.headers["x-admin-key"] as string || req.body?.adminKey;
  if (!adminKey || provided !== adminKey) {
    res.status(403).json({ error: "Admin authentication required" });
    return false;
  }
  return true;
}

router.post("/api/system/tasks/:name/enable", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const success = enableTask(req.params.name);
  res.json({ success, task: req.params.name, action: "enabled" });
});

router.post("/api/system/tasks/:name/disable", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const success = disableTask(req.params.name);
  res.json({ success, task: req.params.name, action: "disabled" });
});

router.get("/api/system/providers", (_req: Request, res: Response) => {
  try {
    res.json({
      summary: getCircuitBreakerSummary(),
      providers: getProviderHealth(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/system/providers/:name/reset", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const success = resetProvider(req.params.name);
  res.json({ success, provider: req.params.name });
});

router.post("/api/system/providers/reset-all", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  resetAllProviders();
  res.json({ success: true, message: "All providers reset" });
});

router.post("/api/system/gc", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const result = forceGC();
  res.json({
    success: true,
    beforeMB: result.before,
    afterMB: result.after,
    freedMB: result.before - result.after,
  });
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default router;
