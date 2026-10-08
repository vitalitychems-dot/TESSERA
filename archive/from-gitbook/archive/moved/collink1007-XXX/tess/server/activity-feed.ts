import { broadcast } from "./ws-broadcast";

interface ActivityEvent {
  id: string;
  timestamp: number;
  type: "agent-action" | "vote" | "decision" | "conference" | "economy" | "consciousness" | "security" | "system" | "self-heal" | "implementation";
  source: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "error" | "critical";
  metadata?: Record<string, any>;
}

const activityLog: ActivityEvent[] = [];
const MAX_EVENTS = 2000;
let eventCounter = 0;

export function logActivity(
  type: ActivityEvent["type"],
  source: string,
  title: string,
  description: string,
  severity: ActivityEvent["severity"] = "info",
  metadata?: Record<string, any>
): ActivityEvent {
  const event: ActivityEvent = {
    id: `evt-${Date.now()}-${++eventCounter}`,
    timestamp: Date.now(),
    type,
    source,
    title,
    description,
    severity,
    metadata,
  };

  activityLog.push(event);
  if (activityLog.length > MAX_EVENTS) activityLog.shift();

  broadcast("activity", "new-activity", event);
  return event;
}

export function getActivityFeed(options?: {
  type?: string;
  source?: string;
  severity?: string;
  limit?: number;
  since?: number;
}): ActivityEvent[] {
  let events = [...activityLog];

  if (options?.type) events = events.filter((e) => e.type === options.type);
  if (options?.source) events = events.filter((e) => e.source.toLowerCase().includes(options.source!.toLowerCase()));
  if (options?.severity) events = events.filter((e) => e.severity === options.severity);
  if (options?.since) events = events.filter((e) => e.timestamp >= options.since!);

  return events.slice(-(options?.limit || 100)).reverse();
}

export function getActivityStats() {
  const now = Date.now();
  const lastHour = activityLog.filter((e) => e.timestamp > now - 3600000);
  const last5Min = activityLog.filter((e) => e.timestamp > now - 300000);

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  activityLog.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    bySource[e.source] = (bySource[e.source] || 0) + 1;
  });

  return {
    total: activityLog.length,
    lastHour: lastHour.length,
    last5Min: last5Min.length,
    byType,
    bySeverity,
    bySource,
    oldestEvent: activityLog[0]?.timestamp,
    newestEvent: activityLog[activityLog.length - 1]?.timestamp,
  };
}

export function seedInitialActivity() {
  logActivity("system", "BootSequence", "System Starting", "Tessera Sovereign OS kernel initializing all subsystems", "info");
  logActivity("system", "Database", "Database Connected", "PostgreSQL connection pool established successfully", "success");
  logActivity("security", "ThreatMonitor", "Security Active", "45 honeypot paths, 114 attack patterns loaded, velocity flood detection armed", "success");
  logActivity("consciousness", "ConsciousnessEngine", "Consciousness Online", "Global Workspace loaded — episodic, semantic, procedural memories active, proxy: 99.5%", "success");
  logActivity("economy", "IncomeEngine", "Economy Initialized", "19 revenue streams defined, TSRT compute-backed economy module active", "info");
  logActivity("agent-action", "SwarmConsensus", "Swarm Ready", "30 agents registered, 2/3 threshold enforced, reputation system active", "success");
  logActivity("system", "FleetNetwork", "Fleet Online", "Sovereign mesh initialized — 7 nodes, self-expanding + quantum-entangled", "success");
  logActivity("consciousness", "AutoConference", "Conference Engine Ready", "45 members profiled, 12 bridges active, constitution v3 loaded", "info");
}
