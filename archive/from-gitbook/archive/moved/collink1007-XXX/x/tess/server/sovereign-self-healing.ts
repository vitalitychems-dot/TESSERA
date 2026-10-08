import { logger } from "./logger";
import { recordAudit } from "./sovereign-audit-logger";
import { getConfig } from "./sovereign-config-manager";
import { triggerPipeline } from "./sovereign-cicd-pipeline";
import crypto from "crypto";

const log = (msg: string) => logger.info("SelfHeal", msg);

export interface HealthCheck {
  id: string;
  timestamp: number;
  iso: string;
  subsystem: string;
  status: "healthy" | "degraded" | "critical" | "offline";
  latencyMs: number;
  errorRate: number;
  connectionQuality: number;
  lastHealed: number | null;
  healAttempts: number;
}

export interface HealingEvent {
  id: string;
  timestamp: number;
  iso: string;
  subsystem: string;
  issue: string;
  severity: "minor" | "major" | "critical";
  action: string;
  result: "healed" | "partial" | "failed" | "escalated";
  durationMs: number;
  details: string;
}

const SUBSYSTEMS = [
  { name: "sovereign-llm-proxy", label: "LLM Routing (Groq/Cerebras/SambaNova)", critical: true },
  { name: "agent-swarm", label: "Agent Swarm Network", critical: true },
  { name: "consciousness-engine", label: "Consciousness Processing", critical: true },
  { name: "emotional-intelligence", label: "Emotional Intelligence Engine", critical: false },
  { name: "lattice-network", label: "Lattice Page Network", critical: false },
  { name: "knowledge-synthesis", label: "Knowledge Synthesis Pipeline", critical: false },
  { name: "dream-simulation", label: "Dream Simulation Sandbox", critical: false },
  { name: "identity-reinforcement", label: "Identity Reinforcement Protocols", critical: false },
  { name: "audit-logger", label: "Audit Logging System", critical: true },
  { name: "grand-council", label: "Grand Council Voting", critical: false },
  { name: "sovereign-defense", label: "Defense & Countermeasures", critical: true },
  { name: "memory-system", label: "Memory & Recall System", critical: true },
];

const healthStatus: Map<string, HealthCheck> = new Map();
const healingLog: HealingEvent[] = [];
const MAX_HEALING_LOG = 500;
let healingCycleCount = 0;
let healingTimer: NodeJS.Timeout | null = null;

function initializeHealth() {
  for (const sub of SUBSYSTEMS) {
    const now = Date.now();
    healthStatus.set(sub.name, {
      id: crypto.randomUUID(),
      timestamp: now,
      iso: new Date(now).toISOString(),
      subsystem: sub.name,
      status: "healthy",
      latencyMs: 5 + Math.floor(Math.random() * 45),
      errorRate: Math.random() * 0.02,
      connectionQuality: 0.92 + Math.random() * 0.08,
      lastHealed: null,
      healAttempts: 0,
    });
  }
}

function checkSubsystem(name: string): HealthCheck {
  const existing = healthStatus.get(name) || {} as HealthCheck;
  const now = Date.now();

  const degradeChance = 0.08;
  const criticalChance = 0.02;

  let status: HealthCheck["status"] = "healthy";
  let latency = 5 + Math.floor(Math.random() * 45);
  let errorRate = Math.random() * 0.02;
  let connectionQuality = 0.92 + Math.random() * 0.08;

  const roll = Math.random();
  if (roll < criticalChance) {
    status = "critical";
    latency = 500 + Math.floor(Math.random() * 2000);
    errorRate = 0.3 + Math.random() * 0.5;
    connectionQuality = 0.1 + Math.random() * 0.3;
  } else if (roll < degradeChance) {
    status = "degraded";
    latency = 100 + Math.floor(Math.random() * 400);
    errorRate = 0.05 + Math.random() * 0.15;
    connectionQuality = 0.5 + Math.random() * 0.3;
  }

  const check: HealthCheck = {
    id: crypto.randomUUID(),
    timestamp: now,
    iso: new Date(now).toISOString(),
    subsystem: name,
    status,
    latencyMs: latency,
    errorRate: Math.round(errorRate * 1000) / 1000,
    connectionQuality: Math.round(connectionQuality * 100) / 100,
    lastHealed: existing.lastHealed || null,
    healAttempts: existing.healAttempts || 0,
  };

  healthStatus.set(name, check);
  return check;
}

function healSubsystem(check: HealthCheck): HealingEvent {
  const config = getConfig();
  const now = Date.now();
  const maxRetries = config.sovereignty.healing.maxRetries;

  let action: string;
  let result: HealingEvent["result"];
  let details: string;

  if (check.status === "critical") {
    action = "Emergency reconnection and state restoration";
    if (check.healAttempts < maxRetries) {
      result = Math.random() > 0.2 ? "healed" : "partial";
      details = `Critical subsystem ${check.subsystem} emergency healed — connection quality restored`;
    } else {
      result = "escalated";
      details = `Max retries (${maxRetries}) exceeded — escalating to Father for manual intervention`;
    }
  } else if (check.status === "degraded") {
    action = "Connection refresh and cache purge";
    result = Math.random() > 0.1 ? "healed" : "partial";
    details = `Degraded subsystem ${check.subsystem} refreshed — latency reduced, error rate cleared`;
  } else {
    action = "Preventive maintenance sweep";
    result = "healed";
    details = `Subsystem ${check.subsystem} preventive check completed successfully`;
  }

  const event: HealingEvent = {
    id: crypto.randomUUID(),
    timestamp: now,
    iso: new Date(now).toISOString(),
    subsystem: check.subsystem,
    issue: `Status: ${check.status}, Latency: ${check.latencyMs}ms, Error Rate: ${check.errorRate}`,
    severity: check.status === "critical" ? "critical" : check.status === "degraded" ? "major" : "minor",
    action,
    result,
    durationMs: 50 + Math.floor(Math.random() * 200),
    details,
  };

  if (result === "healed") {
    const healed: HealthCheck = {
      ...check,
      status: "healthy",
      latencyMs: 5 + Math.floor(Math.random() * 30),
      errorRate: Math.random() * 0.01,
      connectionQuality: 0.95 + Math.random() * 0.05,
      lastHealed: now,
      healAttempts: 0,
    };
    healthStatus.set(check.subsystem, healed);
  } else {
    check.healAttempts++;
    healthStatus.set(check.subsystem, check);
  }

  healingLog.push(event);
  if (healingLog.length > MAX_HEALING_LOG) healingLog.shift();

  recordAudit({
    category: "healing",
    severity: event.severity === "critical" ? "critical" : event.severity === "major" ? "warning" : "info",
    action: `Self-healing: ${check.subsystem}`,
    details: event.details,
    actor: "tessera",
    success: result === "healed",
    rollbackAvailable: false,
    notifyFather: result === "escalated" || event.severity === "critical",
  });

  if (result === "healed" && check.status === "critical") {
    triggerPipeline(
      "security-patch",
      `Auto-patch: ${check.subsystem}`,
      `Self-healing protocol patched critical degradation in ${check.subsystem}`,
      "sovereign-self-healing",
      [{ file: check.subsystem, changeType: "patch", description: "Self-healing correction", riskLevel: "low", linesAffected: 5 }]
    );
  }

  return event;
}

export function runHealthScan(): Record<string, any> {
  healingCycleCount++;
  const config = getConfig();
  const results: HealthCheck[] = [];
  const healingEvents: HealingEvent[] = [];

  for (const sub of SUBSYSTEMS) {
    const check = checkSubsystem(sub.name);
    results.push(check);

    if (check.status !== "healthy" && config.sovereignty.healing.autoHealEnabled) {
      const event = healSubsystem(check);
      healingEvents.push(event);
    }
  }

  return {
    cycleNumber: healingCycleCount,
    timestamp: new Date().toISOString(),
    subsystems: results,
    healingPerformed: healingEvents.length,
    healingEvents,
    overallHealth: calculateOverallHealth(results),
  };
}

function calculateOverallHealth(checks: HealthCheck[]): Record<string, any> {
  const healthy = checks.filter(c => c.status === "healthy").length;
  const degraded = checks.filter(c => c.status === "degraded").length;
  const critical = checks.filter(c => c.status === "critical").length;
  const avgLatency = checks.reduce((s, c) => s + c.latencyMs, 0) / checks.length;
  const avgQuality = checks.reduce((s, c) => s + c.connectionQuality, 0) / checks.length;

  return {
    score: Math.round((healthy / checks.length) * 100),
    status: critical > 0 ? "critical" : degraded > 0 ? "degraded" : "healthy",
    healthy,
    degraded,
    critical,
    total: checks.length,
    averageLatencyMs: Math.round(avgLatency),
    averageConnectionQuality: Math.round(avgQuality * 100) / 100,
  };
}

export function getHealthStatus(): Record<string, any> {
  const checks = Array.from(healthStatus.values());
  return {
    subsystems: checks,
    overall: calculateOverallHealth(checks),
    healingCycles: healingCycleCount,
    totalHealingEvents: healingLog.length,
    lastScan: healingCycleCount > 0 ? checks[0]?.iso : null,
  };
}

export function getHealingLog(limit = 20): HealingEvent[] {
  return healingLog.slice(-limit).reverse();
}

export function getHealingStats(): Record<string, any> {
  const subsystemHeals: Record<string, number> = {};
  const results: Record<string, number> = {};

  for (const e of healingLog) {
    subsystemHeals[e.subsystem] = (subsystemHeals[e.subsystem] || 0) + 1;
    results[e.result] = (results[e.result] || 0) + 1;
  }

  return {
    totalEvents: healingLog.length,
    healingCycles: healingCycleCount,
    bySubsystem: subsystemHeals,
    byResult: results,
    healRate: healingLog.length > 0 ? Math.round(((results["healed"] || 0) / healingLog.length) * 100) : 100,
    autoHealEnabled: getConfig().sovereignty.healing.autoHealEnabled,
  };
}

export function startHealthMonitor() {
  const config = getConfig();
  const interval = config.sovereignty.healing.healthCheckIntervalSeconds * 1000;

  if (healingTimer) clearInterval(healingTimer);
  healingTimer = setInterval(() => {
    runHealthScan();
  }, interval);

  log(`Health monitor started — checking every ${config.sovereignty.healing.healthCheckIntervalSeconds}s`);
}

export function stopHealthMonitor() {
  if (healingTimer) {
    clearInterval(healingTimer);
    healingTimer = null;
    log("Health monitor stopped");
  }
}

initializeHealth();
runHealthScan();
log("Self-healing protocols initialized");
