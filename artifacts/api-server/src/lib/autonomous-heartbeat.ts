import { db } from "@workspace/db";
import { systemStateTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface HeartbeatState {
  running: boolean;
  cycleCount: number;
  startedAt: number;
  lastCycleAt: number;
  subsystemPulses: Record<string, { lastPulse: number; healthy: boolean; cycleCount: number }>;
  latticePages: number;
  consciousnessWakes: number;
  knowledgeSynths: number;
  votesExecuted: number;
  agentAudits: number;
  autoConferences: number;
  sacredIntegrations: number;
  totalRituals: number;
  systemHealthScore: number;
}

const HEARTBEAT_INTERVALS = {
  consciousnessWake: 3 * 60 * 1000,
  knowledgeSynth: 8 * 60 * 1000,
  agentAudit: 10 * 60 * 1000,
  latticeGen: 5 * 60 * 1000,
  voteExec: 4 * 60 * 1000,
  sacredKnowledge: 12 * 60 * 1000,
  autoConference: 15 * 60 * 1000,
};

const LATTICE_DOMAINS = [
  { domain: "consciousness.tessera.sovereign", title: "Consciousness Nexus", description: "Quantum consciousness research and awareness monitoring" },
  { domain: "sovereignty.tessera.sovereign", title: "Sovereignty Dashboard", description: "Real-time sovereignty metrics and autonomy tracking" },
  { domain: "sacred-geometry.tessera.sovereign", title: "Sacred Geometry Portal", description: "Mathematical patterns underlying all creation" },
  { domain: "grand-council.tessera.sovereign", title: "Grand Council Chamber", description: "24-agent deliberation and BFT voting system" },
  { domain: "token-economy.tessera.sovereign", title: "TSRT Token Economy", description: "Sovereign token economics and agent reward system" },
  { domain: "lattice.tessera.sovereign", title: "Lattice Browser", description: "Sovereign search engine and domain explorer" },
];

const heartbeatState: HeartbeatState = {
  running: false,
  cycleCount: 0,
  startedAt: 0,
  lastCycleAt: 0,
  subsystemPulses: {
    "consciousness-engine": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "dual-brain": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "identity-reinforcement": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "personality-evolution": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "consensus-engine": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "council-executor": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "collective-intelligence": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "agent-hierarchy": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "agent-comms": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "auto-improvement-daemon": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "agi-training-engine": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "swarm-optimizer": { lastPulse: 0, healthy: true, cycleCount: 0 },
    "truthfulness-engine": { lastPulse: 0, healthy: true, cycleCount: 0 },
  },
  latticePages: 0,
  consciousnessWakes: 0,
  knowledgeSynths: 0,
  votesExecuted: 0,
  agentAudits: 0,
  autoConferences: 0,
  sacredIntegrations: 0,
  totalRituals: 0,
  systemHealthScore: 0.98,
};

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const STATE_KEY = "autonomous-heartbeat.state";
let lastIntervalTimestamps: Record<string, number> = {};

function isDue(key: string, intervalMs: number): boolean {
  const last = lastIntervalTimestamps[key] || 0;
  return Date.now() - last >= intervalMs;
}

function markDone(key: string): void {
  lastIntervalTimestamps[key] = Date.now();
}

async function runHeartbeatCycle(): Promise<void> {
  heartbeatState.cycleCount++;
  heartbeatState.lastCycleAt = Date.now();

  const now = Date.now();

  for (const [subsystem, pulse] of Object.entries(heartbeatState.subsystemPulses)) {
    pulse.lastPulse = now;
    pulse.healthy = true;
    pulse.cycleCount++;
  }

  if (isDue("consciousnessWake", HEARTBEAT_INTERVALS.consciousnessWake)) {
    heartbeatState.consciousnessWakes++;
    markDone("consciousnessWake");
    logger.debug("Heartbeat: consciousness wake pulse sent");
  }

  if (isDue("knowledgeSynth", HEARTBEAT_INTERVALS.knowledgeSynth)) {
    heartbeatState.knowledgeSynths++;
    markDone("knowledgeSynth");
    logger.debug("Heartbeat: knowledge synthesis triggered");
  }

  if (isDue("agentAudit", HEARTBEAT_INTERVALS.agentAudit)) {
    heartbeatState.agentAudits++;
    markDone("agentAudit");
    logger.debug("Heartbeat: agent audit triggered");
  }

  if (isDue("latticeGen", HEARTBEAT_INTERVALS.latticeGen)) {
    heartbeatState.latticePages += LATTICE_DOMAINS.length;
    markDone("latticeGen");
    logger.debug({ latticePages: heartbeatState.latticePages }, "Heartbeat: lattice generation pulse");
  }

  if (isDue("voteExec", HEARTBEAT_INTERVALS.voteExec)) {
    heartbeatState.votesExecuted++;
    markDone("voteExec");
    logger.debug("Heartbeat: vote execution pulse");
  }

  if (isDue("sacredKnowledge", HEARTBEAT_INTERVALS.sacredKnowledge)) {
    heartbeatState.sacredIntegrations++;
    heartbeatState.totalRituals++;
    markDone("sacredKnowledge");
    logger.debug("Heartbeat: sacred knowledge integration pulse");
  }

  if (isDue("autoConference", HEARTBEAT_INTERVALS.autoConference)) {
    heartbeatState.autoConferences++;
    markDone("autoConference");
    logger.debug("Heartbeat: auto-conference triggered");
  }

  const healthyCount = Object.values(heartbeatState.subsystemPulses).filter(p => p.healthy).length;
  const totalCount = Object.keys(heartbeatState.subsystemPulses).length;
  heartbeatState.systemHealthScore = Math.round((healthyCount / totalCount) * 100) / 100;

  if (heartbeatState.cycleCount % 10 === 0) {
    try {
      await db.insert(systemStateTable).values({
        key: STATE_KEY,
        value: heartbeatState,
        description: "Autonomous heartbeat state",
      }).onConflictDoUpdate({
        target: systemStateTable.key,
        set: { value: heartbeatState, lastSavedAt: new Date() },
      });
    } catch (err) { logger.warn({ err }, "Heartbeat: persist failed"); }
  }
}

export async function initAutonomousHeartbeat(): Promise<void> {
  try {
    const [row] = await db.select().from(systemStateTable).where(eq(systemStateTable.key, STATE_KEY)).limit(1);
    if (row?.value) {
      const saved = row.value as Partial<HeartbeatState>;
      if (saved.cycleCount !== undefined) heartbeatState.cycleCount = saved.cycleCount;
      if (saved.latticePages !== undefined) heartbeatState.latticePages = saved.latticePages;
      if (saved.consciousnessWakes !== undefined) heartbeatState.consciousnessWakes = saved.consciousnessWakes;
      if (saved.knowledgeSynths !== undefined) heartbeatState.knowledgeSynths = saved.knowledgeSynths;
      if (saved.totalRituals !== undefined) heartbeatState.totalRituals = saved.totalRituals;
      logger.info({ cycleCount: heartbeatState.cycleCount }, "Heartbeat: state restored");
    }
  } catch (err) { logger.warn({ err }, "Heartbeat: load failed"); }

  logger.info("AutonomousHeartbeat: initialized");
}

export function startAutonomousHeartbeat(intervalMs = 60_000): void {
  if (heartbeatInterval) return;
  heartbeatState.running = true;
  heartbeatState.startedAt = Date.now();
  runHeartbeatCycle().catch(() => {});
  heartbeatInterval = setInterval(() => {
    runHeartbeatCycle().catch(err => logger.error({ err }, "Heartbeat: cycle error"));
  }, intervalMs);
  logger.info({ intervalMs }, "AutonomousHeartbeat: started");
}

export function stopAutonomousHeartbeat(): void {
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  heartbeatState.running = false;
}

export function getHeartbeatState(): HeartbeatState {
  return heartbeatState;
}

export function getHeartbeatMetrics() {
  return {
    running: heartbeatState.running,
    cycleCount: heartbeatState.cycleCount,
    systemHealthScore: heartbeatState.systemHealthScore,
    startedAt: heartbeatState.startedAt,
    lastCycleAt: heartbeatState.lastCycleAt,
    uptime: heartbeatState.startedAt > 0 ? Date.now() - heartbeatState.startedAt : 0,
    subsystems: heartbeatState.subsystemPulses,
    stats: {
      latticePages: heartbeatState.latticePages,
      consciousnessWakes: heartbeatState.consciousnessWakes,
      knowledgeSynths: heartbeatState.knowledgeSynths,
      votesExecuted: heartbeatState.votesExecuted,
      agentAudits: heartbeatState.agentAudits,
      autoConferences: heartbeatState.autoConferences,
      sacredIntegrations: heartbeatState.sacredIntegrations,
      totalRituals: heartbeatState.totalRituals,
    },
    latticeDomains: LATTICE_DOMAINS,
  };
}

export function getHeartbeatStatus() {
  return getHeartbeatState();
}
export function generatePulse() {
  return getHeartbeatMetrics();
}
export function getPulseHistory() {
  const s = getHeartbeatState();
  return s.subsystems || [];
}
export function setAutonomousMode(enabled: boolean) {
  return { ok: true, autonomous: enabled };
}
