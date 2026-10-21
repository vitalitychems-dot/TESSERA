import { logger } from "./logger";
import { emitAlert } from "./alert-manager";
import { appendAuditLog } from "./pg-audit-trail";

export interface WatchdogComponent {
  id: string;
  name: string;
  description?: string;
  checkFn: () => boolean | Promise<boolean>;
  restartFn?: () => void | Promise<void>;
  maxRetries: number;
  baseBackoffMs: number;
  lastChecked: number;
  lastHealthy: number;
  status: "healthy" | "degraded" | "failed" | "recovering";
  consecutiveFailures: number;
  totalRestarts: number;
  lastRestartAt?: number;
  retryCount: number;
  nextRetryAt: number;
}

interface RecoveryAction {
  componentId: string;
  componentName: string;
  action: "restart" | "alert_escalated" | "recovered";
  timestamp: number;
  attemptNumber: number;
  details?: string;
}

const components = new Map<string, WatchdogComponent>();
const recoveryHistory: RecoveryAction[] = [];
const MAX_RECOVERY_HISTORY = 200;

const CHECK_INTERVAL_MS = 30 * 1000;
const MAX_HEALTHY_AGE_MS = 5 * 60 * 1000;

export function registerComponent(opts: {
  id: string;
  name: string;
  description?: string;
  checkFn: () => boolean | Promise<boolean>;
  restartFn?: () => void | Promise<void>;
  maxRetries?: number;
  baseBackoffMs?: number;
}): void {
  const now = Date.now();
  components.set(opts.id, {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    checkFn: opts.checkFn,
    restartFn: opts.restartFn,
    maxRetries: opts.maxRetries ?? 3,
    baseBackoffMs: opts.baseBackoffMs ?? 5000,
    lastChecked: now,
    lastHealthy: now,
    status: "healthy",
    consecutiveFailures: 0,
    totalRestarts: 0,
    lastRestartAt: undefined,
    retryCount: 0,
    nextRetryAt: 0,
  });
  logger.info("Watchdog", `Registered component: ${opts.name} (${opts.id})`);
}

export function unregisterComponent(id: string): void {
  components.delete(id);
}

function logRecovery(action: RecoveryAction): void {
  recoveryHistory.unshift(action);
  if (recoveryHistory.length > MAX_RECOVERY_HISTORY) {
    recoveryHistory.pop();
  }
  appendAuditLog(
    "recovery_action",
    "ComponentWatchdog",
    action.componentName,
    action.action,
    { attempt: action.attemptNumber, details: action.details }
  ).catch(() => {});
}

async function checkAndHealComponent(comp: WatchdogComponent): Promise<void> {
  const now = Date.now();

  if (now < comp.nextRetryAt) return;

  comp.lastChecked = now;
  let isHealthy = false;

  try {
    isHealthy = await Promise.resolve(comp.checkFn());
  } catch (err: any) {
    isHealthy = false;
    logger.warn("Watchdog", `Health check threw for ${comp.name}: ${err?.message}`);
  }

  if (isHealthy) {
    const wasUnhealthy = comp.consecutiveFailures > 0;
    comp.lastHealthy = now;
    comp.consecutiveFailures = 0;
    comp.retryCount = 0;
    comp.nextRetryAt = 0;

    if (wasUnhealthy) {
      comp.status = "healthy";
      logger.info("Watchdog", `${comp.name} recovered after ${comp.totalRestarts} restart(s)`);
      emitAlert({
        severity: "info",
        component: comp.name,
        title: `${comp.name} recovered`,
        message: `Component ${comp.name} is healthy again after ${comp.totalRestarts} restart attempt(s).`,
        recommendedAction: "No action needed — monitoring continues.",
        metadata: { componentId: comp.id, totalRestarts: comp.totalRestarts },
      });
      logRecovery({
        componentId: comp.id,
        componentName: comp.name,
        action: "recovered",
        timestamp: now,
        attemptNumber: comp.totalRestarts,
        details: "Health check passed after recovery",
      });
    }
    return;
  }

  comp.consecutiveFailures++;
  comp.status = comp.consecutiveFailures >= comp.maxRetries ? "failed" : "degraded";

  if (comp.retryCount < comp.maxRetries) {
    const backoffMs = comp.baseBackoffMs * Math.pow(2, comp.retryCount);
    comp.nextRetryAt = now + backoffMs;
    comp.retryCount++;

    logger.warn("Watchdog", `${comp.name} unhealthy (failure #${comp.consecutiveFailures}), attempting restart ${comp.retryCount}/${comp.maxRetries} in ${Math.round(backoffMs / 1000)}s`);

    emitAlert({
      severity: "warning",
      component: comp.name,
      title: `${comp.name} degraded — restart attempt ${comp.retryCount}/${comp.maxRetries}`,
      message: `Component ${comp.name} failed health check. Attempting auto-restart with exponential backoff (${Math.round(backoffMs / 1000)}s delay).`,
      recommendedAction: `Auto-restart scheduled. Monitor for recovery. If persistent, check ${comp.description || comp.name} logs.`,
      metadata: { componentId: comp.id, retryCount: comp.retryCount, backoffMs, consecutiveFailures: comp.consecutiveFailures },
    });

    if (comp.restartFn) {
      try {
        await Promise.resolve(comp.restartFn());
        comp.totalRestarts++;
        comp.lastRestartAt = now;
        logRecovery({
          componentId: comp.id,
          componentName: comp.name,
          action: "restart",
          timestamp: now,
          attemptNumber: comp.retryCount,
          details: `Backoff: ${Math.round(backoffMs / 1000)}s`,
        });
      } catch (restartErr: any) {
        logger.error("Watchdog", `Restart failed for ${comp.name}: ${restartErr?.message}`);
      }
    }
  } else {
    comp.status = "failed";
    comp.nextRetryAt = now + comp.baseBackoffMs * Math.pow(2, comp.maxRetries);

    logger.error("Watchdog", `${comp.name} failed all ${comp.maxRetries} restart attempts — escalating to critical alert`);

    emitAlert({
      severity: "critical",
      component: comp.name,
      title: `${comp.name} is DOWN — all recovery attempts exhausted`,
      message: `Component ${comp.name} has failed ${comp.consecutiveFailures} consecutive health checks and all ${comp.maxRetries} auto-restart attempts have been exhausted. Manual intervention required.`,
      recommendedAction: `Manually inspect ${comp.name}. Check logs for root cause. Component may need a full server restart.`,
      metadata: {
        componentId: comp.id,
        consecutiveFailures: comp.consecutiveFailures,
        totalRestarts: comp.totalRestarts,
        lastHealthy: comp.lastHealthy,
        downForMs: now - comp.lastHealthy,
      },
      forceEmit: true,
    });

    logRecovery({
      componentId: comp.id,
      componentName: comp.name,
      action: "alert_escalated",
      timestamp: now,
      attemptNumber: comp.maxRetries,
      details: "All retry attempts exhausted — critical alert emitted",
    });
  }
}

async function runWatchdogCycle(): Promise<void> {
  const all = Array.from(components.values());
  await Promise.allSettled(all.map(comp => checkAndHealComponent(comp)));
}

let watchdogInterval: ReturnType<typeof setInterval> | null = null;

export function startWatchdog(): void {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(async () => {
    try {
      await runWatchdogCycle();
    } catch (err: any) {
      logger.error("Watchdog", `Watchdog cycle error: ${err?.message}`);
    }
  }, CHECK_INTERVAL_MS);
  logger.info("Watchdog", `Component watchdog started — checking ${components.size} components every ${CHECK_INTERVAL_MS / 1000}s`);
}

export function stopWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

export function getWatchdogStatus(): {
  components: Array<{
    id: string;
    name: string;
    description?: string;
    status: WatchdogComponent["status"];
    consecutiveFailures: number;
    totalRestarts: number;
    lastChecked: number;
    lastHealthy: number;
    retryCount: number;
    nextRetryAt: number;
  }>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
    recovering: number;
  };
  recoveryHistory: RecoveryAction[];
} {
  const comps = Array.from(components.values()).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    consecutiveFailures: c.consecutiveFailures,
    totalRestarts: c.totalRestarts,
    lastChecked: c.lastChecked,
    lastHealthy: c.lastHealthy,
    retryCount: c.retryCount,
    nextRetryAt: c.nextRetryAt,
  }));

  const healthy = comps.filter(c => c.status === "healthy").length;
  const degraded = comps.filter(c => c.status === "degraded").length;
  const failed = comps.filter(c => c.status === "failed").length;
  const recovering = comps.filter(c => c.status === "recovering").length;

  return {
    components: comps,
    summary: { total: comps.length, healthy, degraded, failed, recovering },
    recoveryHistory: recoveryHistory.slice(0, 30),
  };
}

export function getRecoveryHistory(limit = 50): RecoveryAction[] {
  return recoveryHistory.slice(0, limit);
}

logger.info("Watchdog", "Component Watchdog module loaded — call startWatchdog() to begin monitoring");
