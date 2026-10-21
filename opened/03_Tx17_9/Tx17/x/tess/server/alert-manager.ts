import { logger } from "./logger";
import { appendAuditLog } from "./pg-audit-trail";
import { broadcast } from "./ws-broadcast";

export type AlertSeverity = "info" | "warning" | "critical";

export interface StructuredAlert {
  id: string;
  severity: AlertSeverity;
  component: string;
  title: string;
  message: string;
  timestamp: number;
  recommendedAction?: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

interface AlertManagerState {
  alerts: StructuredAlert[];
  acknowledgedIds: Set<string>;
  dedupeCache: Map<string, number>;
  suppressedCount: number;
}

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const MAX_ALERTS = 500;

const state: AlertManagerState = {
  alerts: [],
  acknowledgedIds: new Set(),
  dedupeCache: new Map(),
  suppressedCount: 0,
};

function generateId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function dedupeKey(component: string, title: string): string {
  return `${component}:${title}`.toLowerCase().replace(/[^a-z0-9:]/g, "-").slice(0, 80);
}

function isDuplicate(component: string, title: string): boolean {
  const key = dedupeKey(component, title);
  const last = state.dedupeCache.get(key);
  if (last && Date.now() - last < DEDUPE_WINDOW_MS) return true;
  state.dedupeCache.set(key, Date.now());
  if (state.dedupeCache.size > 500) {
    const oldest = Array.from(state.dedupeCache.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 200);
    for (const [k] of oldest) state.dedupeCache.delete(k);
  }
  return false;
}

export function emitAlert(opts: {
  severity: AlertSeverity;
  component: string;
  title: string;
  message: string;
  recommendedAction?: string;
  metadata?: Record<string, any>;
  forceEmit?: boolean;
}): StructuredAlert | null {
  if (!opts.forceEmit && isDuplicate(opts.component, opts.title)) {
    state.suppressedCount++;
    return null;
  }

  const alert: StructuredAlert = {
    id: generateId(),
    severity: opts.severity,
    component: opts.component,
    title: opts.title,
    message: opts.message,
    timestamp: Date.now(),
    recommendedAction: opts.recommendedAction,
    metadata: opts.metadata,
    acknowledged: false,
  };

  state.alerts.unshift(alert);
  if (state.alerts.length > MAX_ALERTS) {
    state.alerts = state.alerts.slice(0, MAX_ALERTS);
  }

  const logLevel = opts.severity === "critical" ? "error" : opts.severity === "warning" ? "warn" : "info";
  logger[logLevel]("AlertManager", `[${opts.severity.toUpperCase()}] ${opts.component}: ${opts.title}`);

  try {
    broadcast("alerts", "alert_new", {
      alert,
      systemHealthScore: computeHealthScore(),
    });
  } catch {}

  if (opts.severity === "critical" || opts.severity === "warning") {
    appendAuditLog(
      "alert",
      "AlertManager",
      opts.component,
      opts.title,
      { severity: opts.severity, message: opts.message, recommendedAction: opts.recommendedAction, metadata: opts.metadata }
    ).catch(() => {});
  }

  return alert;
}

export function acknowledgeAlert(id: string, acknowledgedBy = "system"): boolean {
  const alert = state.alerts.find(a => a.id === id);
  if (!alert) return false;
  alert.acknowledged = true;
  alert.resolvedAt = Date.now();
  alert.resolvedBy = acknowledgedBy;
  state.acknowledgedIds.add(id);

  try {
    broadcast("alerts", "alert_acknowledged", { id, acknowledgedBy, timestamp: Date.now() });
  } catch {}

  appendAuditLog("alert_acknowledged", acknowledgedBy, "alert", id, { severity: alert.severity, component: alert.component }).catch(() => {});
  return true;
}

export function resolveAlert(id: string, resolvedBy = "system"): boolean {
  return acknowledgeAlert(id, resolvedBy);
}

export function getAlerts(opts?: {
  severity?: AlertSeverity;
  component?: string;
  unacknowledgedOnly?: boolean;
  limit?: number;
}): StructuredAlert[] {
  let result = [...state.alerts];
  if (opts?.severity) result = result.filter(a => a.severity === opts.severity);
  if (opts?.component) result = result.filter(a => a.component.toLowerCase().includes(opts.component!.toLowerCase()));
  if (opts?.unacknowledgedOnly) result = result.filter(a => !a.acknowledged);
  if (opts?.limit) result = result.slice(0, opts.limit);
  return result;
}

export function computeHealthScore(): number {
  const recentAlerts = state.alerts.filter(
    a => !a.acknowledged && Date.now() - a.timestamp < 30 * 60 * 1000
  );

  let score = 100;
  for (const alert of recentAlerts) {
    if (alert.severity === "critical") score -= 20;
    else if (alert.severity === "warning") score -= 8;
    else score -= 2;
  }

  return Math.max(0, Math.min(100, score));
}

export function getAlertStats(): {
  total: number;
  unacknowledged: number;
  bySeverity: Record<AlertSeverity, number>;
  byComponent: Record<string, number>;
  suppressedCount: number;
  healthScore: number;
  recentCritical: StructuredAlert[];
} {
  const unacked = state.alerts.filter(a => !a.acknowledged);
  const bySeverity: Record<AlertSeverity, number> = { info: 0, warning: 0, critical: 0 };
  const byComponent: Record<string, number> = {};

  for (const a of state.alerts) {
    bySeverity[a.severity]++;
    byComponent[a.component] = (byComponent[a.component] || 0) + 1;
  }

  const recentCritical = state.alerts
    .filter(a => a.severity === "critical" && !a.acknowledged && Date.now() - a.timestamp < 60 * 60 * 1000)
    .slice(0, 5);

  return {
    total: state.alerts.length,
    unacknowledged: unacked.length,
    bySeverity,
    byComponent,
    suppressedCount: state.suppressedCount,
    healthScore: computeHealthScore(),
    recentCritical,
  };
}

export function getRecoveryHistory(limit = 50): StructuredAlert[] {
  return state.alerts
    .filter(a => a.acknowledged && a.resolvedAt)
    .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0))
    .slice(0, limit);
}

setInterval(() => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const before = state.alerts.length;
  state.alerts = state.alerts.filter(a => a.timestamp > cutoff || !a.acknowledged);
  const removed = before - state.alerts.length;
  if (removed > 0) logger.debug("AlertManager", `Pruned ${removed} old acknowledged alerts`);

  try {
    broadcast("alerts", "health_score", { healthScore: computeHealthScore(), timestamp: Date.now() });
  } catch {}
}, 60 * 1000);

logger.info("AlertManager", "Centralized Alert Manager initialized — deduplication active, broadcasting on 'alerts' channel");
