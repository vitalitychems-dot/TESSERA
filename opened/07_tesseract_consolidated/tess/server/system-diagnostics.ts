import os from "os";
import { getIntegrityStatus } from "./file-integrity-monitor";
import { getAnomalyStats } from "./anomaly-detection";
import { getRealThreatStats } from "./real-threat-monitor";
import { getSecurityFortressStatus } from "./security-fortress";

const diagLog = (msg: string) => console.log(`[Diagnostics] ${msg}`);

interface ModuleStatus {
  name: string;
  status: "healthy" | "degraded" | "failed" | "unknown";
  details?: string;
  latencyMs?: number;
}

const recentErrors: Array<{ message: string; stack?: string; timestamp: number; source: string }> = [];
const maxRecentErrors = 100;

export function recordDiagnosticsError(message: string, source: string, stack?: string): void {
  recentErrors.unshift({ message: message.slice(0, 500), stack: stack?.slice(0, 1000), timestamp: Date.now(), source });
  if (recentErrors.length > maxRecentErrors) recentErrors.length = maxRecentErrors;
}

async function checkModuleStatus(name: string, importFn: () => Promise<any>): Promise<ModuleStatus> {
  const start = Date.now();
  try {
    await importFn();
    return { name, status: "healthy", latencyMs: Date.now() - start };
  } catch (err: any) {
    return { name, status: "failed", details: err.message?.slice(0, 100), latencyMs: Date.now() - start };
  }
}

async function checkDatabaseStatus(): Promise<{ connected: boolean; latencyMs: number | null; error?: string }> {
  try {
    const { pool } = await import("./db");
    const start = Date.now();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { connected: false, latencyMs: null, error: err.message?.slice(0, 200) };
  }
}

function getCpuUsage(): number {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return 0;
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type of Object.values(cpu.times)) {
      totalTick += type;
    }
    totalIdle += cpu.times.idle;
  }
  return Math.round((1 - totalIdle / totalTick) * 100);
}

export async function getLlmDashboardSummary() {
  try {
    const { getLlmMetricsSummary, getOptimalProvider } = await import("./llm-metrics");
    const { getAllBudgetStatus } = await import("./token-budget-manager");
    const { getRagStats } = await import("./rag-pipeline");
    const { getEmbeddingServiceStatus } = await import("./embedding-service");
    const { listTemplates } = await import("./prompt-template-store");

    const [metrics24h, optimalGeneral, budgets, ragStats, embeddingStatus, templates] = await Promise.allSettled([
      getLlmMetricsSummary(24),
      getOptimalProvider("general"),
      getAllBudgetStatus(),
      getRagStats(),
      Promise.resolve(getEmbeddingServiceStatus()),
      listTemplates(),
    ]);

    return {
      metrics24h: metrics24h.status === "fulfilled" ? metrics24h.value : null,
      optimalProvider: optimalGeneral.status === "fulfilled" ? optimalGeneral.value : null,
      tokenBudgets: budgets.status === "fulfilled" ? budgets.value : [],
      rag: ragStats.status === "fulfilled" ? ragStats.value : null,
      embeddings: embeddingStatus.status === "fulfilled" ? embeddingStatus.value : null,
      promptTemplates: templates.status === "fulfilled" ? {
        total: templates.value.length,
        categories: [...new Set(templates.value.map((t: any) => t.category))],
      } : null,
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getSystemDiagnostics() {
  const startTime = Date.now();
  const mem = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());
  const osFreeMem = os.freemem();
  const osTotalMem = os.totalmem();
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const cpuUsage = getCpuUsage();

  const [dbStatus, moduleStatuses] = await Promise.all([
    checkDatabaseStatus(),
    Promise.all([
      checkModuleStatus("security-fortress", () => import("./security-fortress")),
      checkModuleStatus("real-threat-monitor", () => import("./real-threat-monitor")),
      checkModuleStatus("file-integrity-monitor", () => import("./file-integrity-monitor")),
      checkModuleStatus("anomaly-detection", () => import("./anomaly-detection")),
      checkModuleStatus("permission-boundaries", () => import("./permission-boundaries")),
      checkModuleStatus("vuln-scanner", () => import("./vuln-scanner")),
    ]),
  ]);

  let threatStats: any = null;
  let fortressStatus: any = null;
  let integrityStatus: any = null;
  let anomalyStats: any = null;
  let vulnScanStatus: any = null;
  let auditStats: any = null;
  let rateLimitStatus: any = null;
  let zscoreStatus: any = null;

  try { threatStats = getRealThreatStats(); } catch {}
  try { fortressStatus = getSecurityFortressStatus(); } catch {}
  try { integrityStatus = getIntegrityStatus(); } catch {}
  try { anomalyStats = getAnomalyStats(); } catch {}
  try {
    const { getLastScanResult } = await import("./dep-vulnerability-scanner");
    vulnScanStatus = await getLastScanResult();
  } catch {}
  try {
    const { getAuditStats } = await import("./pg-audit-trail");
    auditStats = await getAuditStats();
  } catch {}
  try {
    const { getRateLimitStatus } = await import("./pg-rate-limiter");
    rateLimitStatus = getRateLimitStatus();
  } catch {}
  try {
    const { getZScoreMetricStatus } = await import("./zscore-anomaly-monitor");
    zscoreStatus = getZScoreMetricStatus();
  } catch {}

  const failedModules = moduleStatuses.filter(m => m.status === "failed");
  const overallStatus = failedModules.length === 0 && dbStatus.connected
    ? "healthy"
    : failedModules.length <= 1
    ? "degraded"
    : "critical";

  diagLog(`Diagnostics generated in ${Date.now() - startTime}ms — status: ${overallStatus}`);

  return {
    status: overallStatus,
    timestamp: Date.now(),
    generatedInMs: Date.now() - startTime,
    uptime: {
      seconds: uptimeSec,
      formatted: `${Math.floor(uptimeSec / 86400)}d ${Math.floor((uptimeSec % 86400) / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024),
      heapUsagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
      systemFreeGB: (osFreeMem / 1024 / 1024 / 1024).toFixed(2),
      systemTotalGB: (osTotalMem / 1024 / 1024 / 1024).toFixed(2),
      systemUsagePercent: Math.round((1 - osFreeMem / osTotalMem) * 100),
    },
    cpu: {
      cores: cpuCount,
      model: os.cpus()[0]?.model || "unknown",
      usagePercent: cpuUsage,
      loadAvg1m: loadAvg[0].toFixed(2),
      loadAvg5m: loadAvg[1].toFixed(2),
      loadAvg15m: loadAvg[2].toFixed(2),
    },
    database: dbStatus,
    modules: moduleStatuses,
    security: {
      threats: threatStats
        ? {
            total: threatStats.totalInterceptions,
            critical: threatStats.criticalCount,
            high: threatStats.highCount,
            blocked: threatStats.blockedCount,
            honeypotHits: threatStats.honeypotHits,
          }
        : null,
      fortress: fortressStatus
        ? {
            status: fortressStatus.fortress,
            bannedIPs: fortressStatus.bannedIPs,
            eventsLast24h: fortressStatus.eventsLast24h,
          }
        : null,
      integrity: integrityStatus
        ? {
            status: integrityStatus.status,
            alertCount: integrityStatus.alerts.length,
            protectedFiles: integrityStatus.protected.length,
          }
        : null,
      anomalies: anomalyStats
        ? {
            total: anomalyStats.total,
            last24h: anomalyStats.last24h,
            bySeverity: anomalyStats.bySeverity,
          }
        : null,
      vulnerabilityScanner: vulnScanStatus
        ? {
            scannedAt: vulnScanStatus.scannedAt,
            total: vulnScanStatus.total,
            critical: vulnScanStatus.critical,
            high: vulnScanStatus.high,
            moderate: vulnScanStatus.moderate,
            low: vulnScanStatus.low,
            status: vulnScanStatus.status,
          }
        : null,
      auditTrail: auditStats
        ? {
            total: auditStats.total,
            last24h: auditStats.last24h,
            byEventType: auditStats.byEventType,
            lastHash: auditStats.lastHash,
          }
        : null,
      rateLimiter: rateLimitStatus
        ? {
            store: rateLimitStatus.store,
            memFallbackKeys: rateLimitStatus.memFallbackKeys,
          }
        : null,
      zscoreMonitor: zscoreStatus
        ? {
            metrics: zscoreStatus.metrics,
            thresholds: zscoreStatus.thresholds,
          }
        : null,
    },
    recentErrors: recentErrors.slice(0, 20),
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
  };
}

export function installDiagnosticsRoute(app: any): void {
  app.get("/api/diagnostics", async (_req: any, res: any) => {
    try {
      const diag = await getSystemDiagnostics();
      res.json(diag);
    } catch (err: any) {
      res.status(500).json({ error: "Diagnostics unavailable", message: err.message });
    }
  });

  app.get("/api/diagnostics/llm", async (_req: any, res: any) => {
    try {
      const summary = await getLlmDashboardSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: "LLM diagnostics unavailable", message: err.message });
    }
  });

  app.get("/api/diagnostics/llm/metrics", async (req: any, res: any) => {
    try {
      const { getLlmMetricsSummary } = await import("./llm-metrics");
      const windowHours = parseInt(req.query.hours || "24", 10);
      const summary = await getLlmMetricsSummary(windowHours);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: "LLM metrics unavailable", message: err.message });
    }
  });

  app.get("/api/diagnostics/token-budgets", async (_req: any, res: any) => {
    try {
      const { getAllBudgetStatus } = await import("./token-budget-manager");
      const budgets = await getAllBudgetStatus();
      res.json({ budgets });
    } catch (err: any) {
      res.status(500).json({ error: "Token budget status unavailable", message: err.message });
    }
  });

  diagLog("Diagnostics endpoints registered at /api/diagnostics, /api/diagnostics/llm, /api/diagnostics/llm/metrics, /api/diagnostics/token-budgets");
}
