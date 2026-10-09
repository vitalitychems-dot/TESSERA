import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "@workspace/db";
import { systemLogsTable } from "@workspace/db";
import { logger } from "./logger";
import type { RecoveryAction, ModuleHealth, ModuleStatus } from "../core/types";

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
  startRecoveryWatchdog();
  logger.info("Auto-recovery module initialized");
}
