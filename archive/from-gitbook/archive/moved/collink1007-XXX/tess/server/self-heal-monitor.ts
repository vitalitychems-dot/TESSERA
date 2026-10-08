import { broadcast } from "./ws-broadcast";
import { logActivity } from "./activity-feed";
import os from "os";

interface HealEvent {
  id: string;
  timestamp: number;
  type: "crash-recovery" | "rate-limit-failover" | "memory-recovery" | "connection-retry" | "date-fix" | "auto-restart" | "data-repair" | "port-recovery";
  component: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  resolved: boolean;
  resolution?: string;
  durationMs?: number;
}

interface HealthMetrics {
  memoryUsageMB: number;
  memoryLimitMB: number;
  cpuUsage: number;
  uptime: number;
  activeConnections: number;
  errorRate: number;
  healingEvents: number;
  lastHealAt: number | null;
}

const healEvents: HealEvent[] = [];
const MAX_EVENTS = 500;
let healCounter = 0;
const startTime = Date.now();
let initialized = false;
let metricsInterval: ReturnType<typeof setInterval> | null = null;

export function recordHealEvent(
  type: HealEvent["type"],
  component: string,
  description: string,
  severity: HealEvent["severity"] = "medium",
  resolved = true,
  resolution?: string
): HealEvent {
  const event: HealEvent = {
    id: `heal-${Date.now()}-${++healCounter}`,
    timestamp: Date.now(),
    type,
    component,
    description,
    severity,
    resolved,
    resolution,
  };

  healEvents.push(event);
  if (healEvents.length > MAX_EVENTS) healEvents.shift();

  logActivity("self-heal", component, `Self-Heal: ${type}`, description, severity === "critical" ? "error" : severity === "high" ? "warning" : "info");
  broadcast("health", "heal-event", event);

  return event;
}

export function getHealthMetrics(): HealthMetrics {
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();

  return {
    memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    memoryLimitMB: Math.round(totalMem / 1024 / 1024),
    cpuUsage: Math.round(process.cpuUsage().user / 1000000),
    uptime: Date.now() - startTime,
    activeConnections: 0,
    errorRate: healEvents.filter((e) => e.timestamp > Date.now() - 300000).length,
    healingEvents: healEvents.length,
    lastHealAt: healEvents.length > 0 ? healEvents[healEvents.length - 1].timestamp : null,
  };
}

export function getHealHistory(limit = 50): HealEvent[] {
  return healEvents.slice(-limit).reverse();
}

export function getHealStats() {
  const now = Date.now();
  const lastHour = healEvents.filter((e) => e.timestamp > now - 3600000);
  const last24h = healEvents.filter((e) => e.timestamp > now - 86400000);

  const byType: Record<string, number> = {};
  const byComponent: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  healEvents.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byComponent[e.component] = (byComponent[e.component] || 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
  });

  const resolvedCount = healEvents.filter((e) => e.resolved).length;

  return {
    total: healEvents.length,
    lastHour: lastHour.length,
    last24h: last24h.length,
    resolutionRate: healEvents.length > 0 ? Math.round((resolvedCount / healEvents.length) * 100) : 100,
    byType,
    byComponent,
    bySeverity,
    metrics: getHealthMetrics(),
  };
}

export function initSelfHealMonitor() {
  if (initialized) return;
  initialized = true;

  recordHealEvent("auto-restart", "BootSequence", "System initialized — self-healing monitor active", "low", true, "Clean startup");

  metricsInterval = setInterval(() => {
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / 1024 / 1024;

    if (heapUsedMB > 400) {
      recordHealEvent("memory-recovery", "MemoryGuard", `High memory usage detected: ${Math.round(heapUsedMB)}MB — triggering garbage collection`, "high", true, "GC triggered");
      if (global.gc) global.gc();
    }

    broadcast("health", "metrics", getHealthMetrics());
  }, 30000);

  console.log("[SelfHealMonitor] Self-healing visibility monitor initialized — memory guard, metrics active");
}
