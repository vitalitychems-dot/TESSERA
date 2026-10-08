import { Router, type IRouter } from "express";
import os from "os";
import { getIntegrityReport } from "../lib/file-integrity";
import { getAnomalySummary } from "../lib/anomaly-detection";
import { getModuleHealth, getRecoverySummary } from "../lib/auto-recovery";
import { logger } from "../lib/logger";
import type { SystemDiagnostics } from "../core/types";

const router: IRouter = Router();

const startTime = Date.now();

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function computeHealthScore(
  memPercent: number,
  integrityFailed: number,
  anomalyCritical: number,
  modulesFailed: number
): number {
  let score = 100;
  if (memPercent > 90) score -= 25;
  else if (memPercent > 75) score -= 10;
  if (integrityFailed > 0) score -= Math.min(integrityFailed * 15, 30);
  if (anomalyCritical > 0) score -= Math.min(anomalyCritical * 10, 20);
  if (modulesFailed > 0) score -= Math.min(modulesFailed * 10, 20);
  return Math.max(0, score);
}

router.get("/diagnostics", async (_req, res) => {
  try {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const memPercent = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0;
    const cpuLoad = os.loadavg();
    const cpuCores = os.cpus().length;

    const [integrityReport, anomalySummary, recoverySummary] = await Promise.allSettled([
      getIntegrityReport(),
      getAnomalySummary(),
      Promise.resolve(getRecoverySummary()),
    ]);

    const integrity = integrityReport.status === "fulfilled"
      ? integrityReport.value
      : { totalFiles: 0, checkedFiles: 0, passedFiles: 0, failedFiles: 0, missingFiles: 0, records: [], lastCheck: null as any };

    const anomalies = anomalySummary.status === "fulfilled"
      ? anomalySummary.value
      : { total: 0, active: 0, critical: 0, lastDetected: null };

    const recovery = recoverySummary.status === "fulfilled"
      ? recoverySummary.value
      : { totalAttempts: 0, successfulAttempts: 0, lastAttempt: null };

    const modules = getModuleHealth();
    const modulesFailed = modules.filter(m => m.status === "failed").length;

    const healthScore = computeHealthScore(memPercent, integrity.failedFiles, anomalies.critical, modulesFailed);
    const overallStatus: "healthy" | "degraded" | "critical" =
      healthScore >= 80 ? "healthy" :
      healthScore >= 50 ? "degraded" : "critical";

    const integrityStatus =
      integrity.failedFiles === 0 ? "clean" :
      integrity.missingFiles > 0 ? "missing" : "tampered";

    const diagnostics: SystemDiagnostics = {
      status: overallStatus,
      healthScore,
      uptime: {
        seconds: uptimeSeconds,
        formatted: formatUptime(uptimeSeconds),
      },
      memory: {
        heapUsedMB,
        heapTotalMB,
        percent: memPercent,
      },
      cpu: {
        loadAvg: cpuLoad,
        cores: cpuCores,
      },
      integrity: {
        status: integrityStatus as any,
        totalFiles: integrity.totalFiles,
        checkedFiles: integrity.checkedFiles,
        passedFiles: integrity.passedFiles,
        failedFiles: integrity.failedFiles,
        lastCheck: integrity.lastCheck ? new Date(integrity.lastCheck) : null,
      },
      anomalies: {
        total: anomalies.total,
        active: anomalies.active,
        critical: anomalies.critical,
        lastDetected: anomalies.lastDetected,
      },
      modules,
      sovereignty: {
        level: integrity.failedFiles === 0 && anomalies.critical === 0 ? "full" : "partial",
        score: healthScore,
        integrityChecks: integrity.totalFiles,
        integrityPassed: integrity.passedFiles,
        lastAudit: integrity.lastCheck ? new Date(integrity.lastCheck) : new Date(),
        anomaliesDetected: anomalies.total,
        selfHealingEvents: recovery.successfulAttempts,
        externalDependencies: 0,
      },
      tasks: {
        active: 0,
        total: 0,
      },
      llmProviders: {
        totalProviders: 0,
        healthy: 0,
        degraded: 0,
        down: 0,
        avgHealthScore: 0,
      },
      recovery: {
        totalAttempts: recovery.totalAttempts,
        successfulAttempts: recovery.successfulAttempts,
        lastAttempt: recovery.lastAttempt,
      },
      generatedAt: new Date(),
    };

    res.json(diagnostics);
  } catch (err) {
    logger.error({ err }, "Diagnostics endpoint error");
    res.status(500).json({ error: "Failed to collect diagnostics", details: String(err) });
  }
});

export default router;
