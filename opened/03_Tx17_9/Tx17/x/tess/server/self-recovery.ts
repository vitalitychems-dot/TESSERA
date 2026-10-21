import { logger } from "./logger";
import { getCircuitBreakerSummary, getProviderHealth, resetProvider } from "./smart-circuit-breaker";

const log = (msg: string) => logger.info(msg, { category: "SelfRecovery" });

interface SubsystemHealth {
  name: string;
  status: "healthy" | "degraded" | "critical" | "down";
  lastCheck: number;
  lastHealthy: number;
  consecutiveFailures: number;
  recoveryAttempts: number;
  lastRecoveryAttempt: number;
  metrics: Record<string, number>;
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  subsystem: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolvedAt?: number;
  autoResolved: boolean;
}

interface RecoveryAction {
  subsystem: string;
  action: string;
  timestamp: number;
  success: boolean;
  details: string;
}

const subsystems = new Map<string, SubsystemHealth>();
const alertLog: Alert[] = [];
const recoveryLog: RecoveryAction[] = [];
let monitorInterval: NodeJS.Timeout | null = null;
let alertCounter = 0;

const SUBSYSTEM_CHECKS: Array<{
  name: string;
  check: () => Promise<{ healthy: boolean; metrics: Record<string, number>; details?: string }>;
  recover: () => Promise<{ success: boolean; action: string }>;
  criticalThreshold: number;
}> = [
  {
    name: "llm-providers",
    criticalThreshold: 3,
    check: async () => {
      const summary = getCircuitBreakerSummary();
      const health = getProviderHealth();
      const downCount = health.filter(p => p.state === "open").length;
      const healthy = summary.avgHealthScore > 30 && summary.healthy > 0;
      return {
        healthy,
        metrics: {
          totalProviders: summary.totalProviders,
          healthy: summary.healthy,
          degraded: summary.degraded,
          down: summary.down,
          avgHealth: summary.avgHealthScore,
        },
        details: downCount > 0 ? `${downCount} providers down: ${health.filter(p => p.state === "open").map(p => p.name).join(", ")}` : undefined,
      };
    },
    recover: async () => {
      const health = getProviderHealth();
      const staleDown = health.filter(p => p.state === "open" && p.cooldownRemaining <= 0);
      let recovered = 0;
      for (const p of staleDown) {
        resetProvider(p.name);
        recovered++;
      }
      return {
        success: recovered > 0,
        action: recovered > 0 ? `Reset ${recovered} stale providers: ${staleDown.map(p => p.name).join(", ")}` : "No stale providers to reset",
      };
    },
  },
  {
    name: "memory",
    criticalThreshold: 5,
    check: async () => {
      const mem = process.memoryUsage();
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
      const rssMB = Math.round(mem.rss / 1024 / 1024);
      const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
      return {
        healthy: heapPercent < 90 && rssMB < 2048,
        metrics: { heapUsedMB, heapTotalMB, rssMB, heapPercent: Math.round(heapPercent) },
        details: heapPercent >= 90 ? `Heap usage critical: ${heapPercent.toFixed(1)}%` : undefined,
      };
    },
    recover: async () => {
      if (global.gc) {
        global.gc();
        return { success: true, action: "Forced garbage collection" };
      }
      return { success: false, action: "GC not exposed (run with --expose-gc for full recovery)" };
    },
  },
  {
    name: "event-loop",
    criticalThreshold: 5,
    check: async () => {
      const start = Date.now();
      await new Promise(resolve => setImmediate(resolve));
      const lag = Date.now() - start;
      return {
        healthy: lag < 500,
        metrics: { lagMs: lag },
        details: lag >= 500 ? `Event loop lag: ${lag}ms (threshold: 500ms)` : undefined,
      };
    },
    recover: async () => {
      return { success: true, action: "Event loop congestion detected — monitoring for resolution" };
    },
  },
  {
    name: "disk-space",
    criticalThreshold: 3,
    check: async () => {
      try {
        const { execSync } = await import("child_process");
        const output = execSync("df -h / | tail -1", { encoding: "utf-8", timeout: 5000 });
        const parts = output.trim().split(/\s+/);
        const usePercent = parseInt(parts[4] || "0");
        return {
          healthy: usePercent < 90,
          metrics: { usePercent, availableGB: parseFloat(parts[3] || "0") },
          details: usePercent >= 90 ? `Disk usage at ${usePercent}%` : undefined,
        };
      } catch {
        return { healthy: true, metrics: { usePercent: 0 }, details: "Unable to check disk" };
      }
    },
    recover: async () => {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const logsDir = path.join(process.cwd(), "logs");
        if (fs.existsSync(logsDir)) {
          const files = fs.readdirSync(logsDir).filter(f => f.endsWith(".log"));
          const oldFiles = files
            .map(f => ({ name: f, stat: fs.statSync(path.join(logsDir, f)) }))
            .filter(f => Date.now() - f.stat.mtimeMs > 7 * 24 * 60 * 60 * 1000)
            .slice(0, 10);
          for (const f of oldFiles) {
            fs.unlinkSync(path.join(logsDir, f.name));
          }
          return { success: oldFiles.length > 0, action: `Cleaned ${oldFiles.length} old log files` };
        }
        return { success: false, action: "No logs directory to clean" };
      } catch (e: any) {
        return { success: false, action: `Cleanup failed: ${e.message}` };
      }
    },
  },
  {
    name: "process-health",
    criticalThreshold: 10,
    check: async () => {
      const uptime = process.uptime();
      const cpuUsage = process.cpuUsage();
      const totalCpu = (cpuUsage.user + cpuUsage.system) / 1e6;
      const cpuPercent = uptime > 0 ? (totalCpu / uptime) * 100 : 0;

      return {
        healthy: true,
        metrics: {
          uptimeHours: Math.round(uptime / 3600 * 100) / 100,
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          pid: process.pid,
        },
      };
    },
    recover: async () => {
      return { success: true, action: "Process health nominal" };
    },
  },
];

function createAlert(severity: Alert["severity"], subsystem: string, message: string): Alert {
  const alert: Alert = {
    id: `alert-${++alertCounter}-${Date.now().toString(36)}`,
    severity,
    subsystem,
    message,
    timestamp: Date.now(),
    acknowledged: false,
    autoResolved: false,
  };
  alertLog.push(alert);
  if (alertLog.length > 500) alertLog.splice(0, alertLog.length - 500);

  if (severity === "critical") {
    log(`CRITICAL ALERT [${subsystem}]: ${message}`);
  } else if (severity === "warning") {
    log(`WARNING [${subsystem}]: ${message}`);
  }

  return alert;
}

async function checkSubsystem(config: typeof SUBSYSTEM_CHECKS[0]): Promise<void> {
  let health = subsystems.get(config.name);
  if (!health) {
    health = {
      name: config.name,
      status: "healthy",
      lastCheck: 0,
      lastHealthy: Date.now(),
      consecutiveFailures: 0,
      recoveryAttempts: 0,
      lastRecoveryAttempt: 0,
      metrics: {},
    };
    subsystems.set(config.name, health);
  }

  try {
    const result = await config.check();
    health.lastCheck = Date.now();
    health.metrics = result.metrics;

    if (result.healthy) {
      if (health.status !== "healthy") {
        const prevStatus = health.status;
        health.status = "healthy";
        health.consecutiveFailures = 0;

        const openAlert = alertLog.find(a => a.subsystem === config.name && !a.resolvedAt);
        if (openAlert) {
          openAlert.resolvedAt = Date.now();
          openAlert.autoResolved = true;
        }

        createAlert("info", config.name, `Recovered from ${prevStatus} state`);
      }
      health.lastHealthy = Date.now();
      health.consecutiveFailures = 0;
    } else {
      health.consecutiveFailures++;

      if (health.consecutiveFailures >= config.criticalThreshold) {
        if (health.status !== "critical") {
          health.status = "critical";
          createAlert("critical", config.name, result.details || `Critical: ${health.consecutiveFailures} consecutive failures`);
        }

        if (Date.now() - health.lastRecoveryAttempt > 60000) {
          health.lastRecoveryAttempt = Date.now();
          health.recoveryAttempts++;
          const recovery = await config.recover();
          recoveryLog.push({
            subsystem: config.name,
            action: recovery.action,
            timestamp: Date.now(),
            success: recovery.success,
            details: result.details || "",
          });
          if (recoveryLog.length > 200) recoveryLog.splice(0, recoveryLog.length - 200);
        }
      } else if (health.consecutiveFailures >= 2) {
        if (health.status !== "degraded") {
          health.status = "degraded";
          createAlert("warning", config.name, result.details || `Degraded: ${health.consecutiveFailures} failures`);
        }
      }
    }
  } catch (err: any) {
    health.lastCheck = Date.now();
    health.consecutiveFailures++;
    if (health.consecutiveFailures >= config.criticalThreshold) {
      health.status = "critical";
      createAlert("critical", config.name, `Check threw error: ${err.message}`);
    }
  }
}

async function runHealthCheck(): Promise<void> {
  for (const config of SUBSYSTEM_CHECKS) {
    await checkSubsystem(config);
  }
}

export function startSelfRecovery(intervalMs = 30000): void {
  if (monitorInterval) return;
  log("Self-recovery system starting — health monitoring active");

  runHealthCheck();

  monitorInterval = setInterval(() => {
    runHealthCheck().catch(err => {
      log(`Health check cycle failed: ${err.message}`);
    });
  }, intervalMs);
}

export function stopSelfRecovery(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    log("Self-recovery system stopped");
  }
}

export function getSelfRecoveryStatus() {
  return {
    monitoring: monitorInterval !== null,
    subsystems: Array.from(subsystems.values()).map(s => ({
      name: s.name,
      status: s.status,
      lastCheck: s.lastCheck,
      lastHealthy: s.lastHealthy,
      consecutiveFailures: s.consecutiveFailures,
      recoveryAttempts: s.recoveryAttempts,
      metrics: s.metrics,
    })),
    alerts: {
      total: alertLog.length,
      unresolved: alertLog.filter(a => !a.resolvedAt).length,
      critical: alertLog.filter(a => a.severity === "critical" && !a.resolvedAt).length,
      recent: alertLog.slice(-20).reverse(),
    },
    recoveryActions: {
      total: recoveryLog.length,
      successful: recoveryLog.filter(r => r.success).length,
      recent: recoveryLog.slice(-10).reverse(),
    },
    uptime: {
      hours: Math.round(process.uptime() / 3600 * 100) / 100,
      startedAt: Date.now() - process.uptime() * 1000,
    },
  };
}

export function acknowledgeAlert(alertId: string): boolean {
  const alert = alertLog.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    return true;
  }
  return false;
}

export function getActiveAlerts(): Alert[] {
  return alertLog.filter(a => !a.resolvedAt && !a.acknowledged);
}

export function forceRecovery(subsystemName: string): Promise<{ success: boolean; action: string }> {
  const config = SUBSYSTEM_CHECKS.find(c => c.name === subsystemName);
  if (!config) return Promise.resolve({ success: false, action: `Unknown subsystem: ${subsystemName}` });
  return config.recover();
}
