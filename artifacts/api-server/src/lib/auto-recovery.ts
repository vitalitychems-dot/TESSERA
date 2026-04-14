import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "@workspace/db";

import { systemLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { getActualPort } from "./server-config";
import type { RecoveryAction, ModuleHealth, ModuleStatus } from "../core/types";

export const INTERNAL_PROBE_HEADER = "x-internal-health-probe";
export const INTERNAL_PROBE_SECRET = crypto.randomBytes(16).toString("hex");

const moduleRegistry = new Map<string, ModuleHealth>();
const recoveryHandlers = new Map<string, () => Promise<void>>();

export function registerModule(name: string, status: ModuleStatus = "running"): void {
  moduleRegistry.set(name, {
    name,
    status,
    startedAt: new Date(),
  });
}

export function registerRecoveryHandler(name: string, handler: () => Promise<void>): void {
  recoveryHandlers.set(name, handler);
}

export function updateModuleStatus(name: string, status: ModuleStatus, lastError?: string): void {
  const existing = moduleRegistry.get(name);
  if (existing) {
    moduleRegistry.set(name, { ...existing, status, lastError });
  } else {
    moduleRegistry.set(name, { name, status, startedAt: new Date(), lastError });
  }
}

export function getModuleHealth(): ModuleHealth[] {
  return Array.from(moduleRegistry.values());
}

const recoveryLog: RecoveryAction[] = [];

async function logRecoveryAction(action: RecoveryAction): Promise<void> {
  recoveryLog.push(action);
  if (recoveryLog.length > 100) recoveryLog.shift();

  try {
    await db.insert(systemLogsTable).values({
      level: action.status === "failed" ? "error" : "info",
      category: "recovery",
      message: `Recovery action ${action.actionType} on ${action.targetModule}: ${action.status}`,
      source: "auto-recovery",
      context: {
        actionId: action.id,
        triggeredBy: action.triggeredBy,
        errorMessage: action.errorMessage,
      },
    });
  } catch (err) {
    logger.warn({ err }, "Failed to log recovery action to DB");
  }
}

export async function attemptModuleRecovery(
  moduleName: string,
  triggeredBy = "auto-recovery"
): Promise<RecoveryAction> {
  const actionId = `recovery-${Date.now()}-${moduleName}`;
  const action: RecoveryAction = {
    id: actionId,
    triggeredBy,
    targetModule: moduleName,
    actionType: "restart",
    status: "running",
    startedAt: new Date(),
  };

  logger.info({ moduleName, triggeredBy }, "Attempting module recovery");
  updateModuleStatus(moduleName, "recovering");

  try {
    const handler = recoveryHandlers.get(moduleName);
    if (handler) {
      await handler();
      logger.info({ moduleName }, "Module recovery handler invoked");
    } else {
      logger.warn({ moduleName }, "No recovery handler registered; marking module as recovered");
    }

    updateModuleStatus(moduleName, "running");
    action.status = "succeeded";
    action.completedAt = new Date();

    logger.info({ moduleName }, "Module recovery succeeded");
  } catch (err: unknown) {
    action.status = "failed";
    action.completedAt = new Date();
    action.errorMessage = err instanceof Error ? err.message : String(err);
    updateModuleStatus(moduleName, "failed", action.errorMessage);
    logger.error({ err, moduleName }, "Module recovery failed");
  }

  await logRecoveryAction(action);
  return action;
}

const snapshotStore = new Map<string, { content: Buffer; checksum: string; snapshotAt: Date }>();

export function snapshotFile(filePath: string, absPath: string): boolean {
  try {
    const content = fs.readFileSync(absPath);
    const checksum = crypto.createHash("sha256").update(content).digest("hex");
    snapshotStore.set(filePath, { content, checksum, snapshotAt: new Date() });
    return true;
  } catch {
    return false;
  }
}

export function hasSnapshot(filePath: string): boolean {
  return snapshotStore.has(filePath);
}

export async function restoreMissingFile(
  filePath: string,
  workspaceRoot: string
): Promise<boolean> {
  const absPath = path.resolve(workspaceRoot, filePath);
  const snapshot = snapshotStore.get(filePath);

  if (!snapshot) {
    logger.warn({ filePath }, "No trusted snapshot available for missing file — skipping restore to avoid corruption");

    try {
      await db.insert(systemLogsTable).values({
        level: "error",
        category: "recovery",
        message: `Cannot restore missing file — no trusted baseline snapshot: ${filePath}`,
        source: "auto-recovery",
        context: { filePath, action: "alert_only" },
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, "Failed to log unrestorable file alert");
    }

    return false;
  }

  try {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, snapshot.content);

    const restoredChecksum = crypto
      .createHash("sha256")
      .update(fs.readFileSync(absPath))
      .digest("hex");

    if (restoredChecksum !== snapshot.checksum) {
      logger.error({ filePath }, "Restored file checksum mismatch — possible write error");

      await db.insert(systemLogsTable).values({
        level: "error",
        category: "recovery",
        message: `Restore checksum mismatch for: ${filePath}`,
        source: "auto-recovery",
        context: { filePath, expected: snapshot.checksum, actual: restoredChecksum },
      });

      return false;
    }

    logger.info({ filePath, checksum: restoredChecksum }, "Restored missing file from verified snapshot");

    await db.insert(systemLogsTable).values({
      level: "warn",
      category: "recovery",
      message: `Restored missing file from verified snapshot: ${filePath}`,
      source: "auto-recovery",
      context: { filePath, checksum: restoredChecksum, snapshotAt: snapshot.snapshotAt },
    });

    return true;
  } catch (err: unknown) {
    logger.error({ err, filePath }, "Failed to restore missing file");
    return false;
  }
}

export interface RecoverySummary {
  totalAttempts: number;
  successfulAttempts: number;
  lastAttempt: Date | null;
}

export function getRecoverySummary(): RecoverySummary {
  const successful = recoveryLog.filter(a => a.status === "succeeded");
  const sorted = [...recoveryLog].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return {
    totalAttempts: recoveryLog.length,
    successfulAttempts: successful.length,
    lastAttempt: sorted[0]?.startedAt ?? null,
  };
}

export async function runRecoveryCheck(): Promise<void> {
  const modules = getModuleHealth();
  for (const mod of modules) {
    if (mod.status === "failed") {
      logger.warn({ module: mod.name }, "Detected failed module, initiating recovery");
      await attemptModuleRecovery(mod.name, "watchdog");
    }
  }
}

interface WatchdogProbeRoute {
  path: string;
  hasParams: boolean;
}

let watchdogProbeRoutes: WatchdogProbeRoute[] = [
  { path: "/api/healthz", hasParams: false },
  { path: "/api/tesseract-forum/topics", hasParams: false },
  { path: "/api/memory/stats", hasParams: false },
  { path: "/api/diagnostics", hasParams: false },
];

export function setWatchdogProbeRoutes(routes: WatchdogProbeRoute[]): void {
  watchdogProbeRoutes = routes.length > 0 ? routes : watchdogProbeRoutes;
  logger.info({ count: watchdogProbeRoutes.length }, "Watchdog probe route list updated");
}

let routeHealthInterval: ReturnType<typeof setInterval> | null = null;
let onRoutesHealthyCallback: (() => void) | null = null;
let onRoutesUnhealthyCallback: (() => void) | null = null;
let routesWereEverHealthy = false;

export function setOnRoutesHealthyCallback(cb: () => void): void {
  onRoutesHealthyCallback = cb;
}

export function setOnRoutesUnhealthyCallback(cb: () => void): void {
  onRoutesUnhealthyCallback = cb;
}

export function startRouteHealthMonitor(intervalMs = 120_000): void {
  if (routeHealthInterval) return;
  logger.info({ intervalMs, routeCount: watchdogProbeRoutes.length }, "Starting route health monitor");

  const checkRoutes = async () => {
    const port = getActualPort();
    if (!port) return;
    const baseUrl = `http://localhost:${port}`;

    const failures: string[] = [];

    for (const probe of watchdogProbeRoutes) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${baseUrl}${probe.path}`, {
          signal: controller.signal,
          headers: { [INTERNAL_PROBE_HEADER]: INTERNAL_PROBE_SECRET },
        });
        clearTimeout(timeout);

        if (res.status >= 500) {
          logger.warn({ route: probe.path, status: res.status }, "Route health check: server error — route may be broken");
          failures.push(`${res.status} on ${probe.path}`);
        } else if (res.status === 404 && !probe.hasParams) {
          logger.warn({ route: probe.path, status: 404 }, "Route health check: 404 on static route — route unregistered or unreachable");
          failures.push(`404 on static route ${probe.path}`);
          try {
            await db.insert(systemLogsTable).values({
              level: "error",
              category: "route-health",
              message: `Route health 404 on static route: ${probe.path}`,
              source: "auto-recovery-watchdog",
              context: { route: probe.path, status: 404, treatAs: "failure" },
            });
          } catch {}
        } else {
          logger.debug({ route: probe.path, status: res.status, hasParams: probe.hasParams }, "Route health check: OK");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes("abort") && !message.includes("ECONNREFUSED")) {
          logger.warn({ route: probe.path, err: message }, "Route health check: fetch error");
          failures.push(`fetch error on ${probe.path}: ${message}`);
        }
      }
    }

    if (failures.length > 0) {
      routesWereEverHealthy = false;
      updateModuleStatus("route-health", "failed", failures.join("; "));
      logger.warn({ failures }, "Route health cycle FAILED");

      if (onRoutesUnhealthyCallback) {
        onRoutesUnhealthyCallback();
      }

      try {
        await db.insert(systemLogsTable).values({
          level: "error",
          category: "route-health",
          message: `Route health watchdog: ${failures.length} failure(s) detected — readiness gate CLOSED (503 to all clients)`,
          source: "auto-recovery-watchdog",
          context: { failures, autoFixStrategy: "readiness-gate-close" },
        });
      } catch {}
    } else {
      updateModuleStatus("route-health", "running");
      logger.debug("Route health cycle PASSED — all probed routes responded");
      if (!routesWereEverHealthy && onRoutesHealthyCallback) {
        routesWereEverHealthy = true;
        logger.info("Route health watchdog: all routes healthy — opening readiness gate");
        onRoutesHealthyCallback();
      }
    }
  };

  routeHealthInterval = setInterval(async () => {
    try {
      await checkRoutes();
    } catch (err) {
      logger.error({ err }, "Route health monitor check failed");
    }
  }, intervalMs);

  setTimeout(async () => {
    try {
      await checkRoutes();
    } catch {}
  }, 15_000);
}

export function stopRouteHealthMonitor(): void {
  if (routeHealthInterval) {
    clearInterval(routeHealthInterval);
    routeHealthInterval = null;
    logger.info("Route health monitor stopped");
  }
}

let watchdogInterval: ReturnType<typeof setInterval> | null = null;

export function startRecoveryWatchdog(intervalMs = 60_000): void {
  if (watchdogInterval) return;
  logger.info({ intervalMs }, "Starting recovery watchdog");
  watchdogInterval = setInterval(async () => {
    try {
      await runRecoveryCheck();
    } catch (err) {
      logger.error({ err }, "Recovery watchdog check failed");
    }
  }, intervalMs);
}

export function stopRecoveryWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
    logger.info("Recovery watchdog stopped");
  }
}

export function initRecoveryModule(): void {
  registerModule("api-server", "running");
  registerModule("file-integrity", "running");
  registerModule("anomaly-detection", "running");
  registerModule("auto-recovery", "running");
  registerModule("diagnostics", "running");
  registerModule("route-health", "running");
  startRecoveryWatchdog();
  startRouteHealthMonitor();
  logger.info("Auto-recovery module initialized");
}
