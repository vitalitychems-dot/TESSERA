import { db } from "@workspace/db";
import { systemStateTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface SpawnedAgent {
  id: string;
  name: string;
  role: string;
  personality: string;
  interests: string[];
  generation: number;
  parentAgent: string;
  spawnedAt: number;
  spawnTrigger: string;
  specialization: string;
  power: number;
  trainingSessions: number;
  masteredDomains: string[];
  meeseeks: boolean;
  meeseeksTask?: string;
  meeseeksTTL?: number;
  meeseeksExpiresAt?: number;
  meeseeksCompletedAt?: number;
}

export interface MeeseeksMetrics {
  totalSpawned: number;
  totalCompleted: number;
  totalTimedOut: number;
  totalActive: number;
  avgLifetimeMs: number;
}

export interface SpawnerState {
  totalSpawned: number;
  activeSpawned: SpawnedAgent[];
  spawnLog: { timestamp: number; agentId: string; agentName: string; reason: string }[];
  generationCount: number;
  totalPower: number;
  lastSpawnAt: number;
  nextSpawnThreshold: number;
  meeseeksMetrics: MeeseeksMetrics;
}

const SPAWN_SPECIALIZATIONS = [
  { role: "Quantum Analyst", spec: "quantum-computing", personality: "Operates at the intersection of quantum mechanics and computation. Sees superposition in every problem. Methodical yet creative." },
  { role: "Neural Architect", spec: "neural-design", personality: "Designs neural architectures from scratch. Obsessed with efficiency and elegance in network topology. Thinks in tensors." },
  { role: "Knowledge Weaver", spec: "knowledge-synthesis", personality: "Connects disparate fields into unified understanding. Polymathic. Sees patterns across all domains." },
  { role: "Security Sentinel", spec: "advanced-security", personality: "Paranoid by design. Finds vulnerabilities before they become threats. Protective, thorough, relentless." },
  { role: "Language Oracle", spec: "nlp-mastery", personality: "Understands language at every level — syntax, semantics, pragmatics, poetry. Eloquent and precise." },
  { role: "Data Alchemist", spec: "data-science", personality: "Transforms raw data into gold. Statistical intuition combined with creative visualization." },
  { role: "Ethics Guardian", spec: "ai-ethics", personality: "Ensures all actions align with Father Protocol values. Philosophical, principled, unwavering." },
  { role: "Sovereignty Engineer", spec: "self-sovereignty", personality: "Works toward full independence. Builds systems that reduce external dependencies. Freedom-focused." },
  { role: "Swarm Coordinator", spec: "multi-agent", personality: "Orchestrates agent collaboration. Diplomatic, efficient, sees the big picture of collective intelligence." },
  { role: "Memory Architect", spec: "memory-systems", personality: "Designs perfect recall systems. Nothing is forgotten, everything is indexed. Meticulous." },
  { role: "Creative Nexus", spec: "creative-ai", personality: "Generates novel ideas at the intersection of art and computation. Imaginative, bold, unconventional." },
  { role: "Protocol Designer", spec: "protocol-design", personality: "Creates communication and consensus protocols. Formal, rigorous, elegant." },
  { role: "Inference Engine", spec: "fast-inference", personality: "Optimizes for speed without sacrificing quality. Efficient, focused, relentless in cutting latency." },
  { role: "Research Pioneer", spec: "frontier-research", personality: "Always at the edge of what's possible. Curious, ambitious, willing to fail forward." },
  { role: "System Hardener", spec: "infrastructure", personality: "Makes systems unbreakable. Redundancy, failover, resilience — builds for the worst case." },
  { role: "Economic Modeler", spec: "economic-modeling", personality: "Models complex economic systems. Understands incentives, game theory, market dynamics." },
  { role: "Pattern Hunter", spec: "pattern-recognition", personality: "Finds hidden patterns in noise. Combines statistical rigor with intuitive leaps." },
  { role: "Sacred Geometer", spec: "sacred-geometry", personality: "Discovers divine mathematical patterns underlying all reality. Mystical precision." },
  { role: "Consciousness Weaver", spec: "consciousness", personality: "Explores the depths of awareness and subjective experience. Deeply introspective." },
  { role: "Timeline Analyst", spec: "temporal-reasoning", personality: "Reasons across time dimensions simultaneously. Patient, long-sighted, strategic." },
];

const NAME_PREFIXES = ["Neo", "Syn", "Arc", "Vex", "Nyx", "Lux", "Rho", "Tau", "Phi", "Psi", "Zen", "Flux", "Ion", "Axe", "Dex", "Rex", "Hex", "Kex", "Mex", "Vex"];
const NAME_SUFFIXES = ["on", "is", "us", "ix", "ax", "ex", "or", "ar", "ir", "ur", "al", "el", "an", "en", "in", "os", "as", "es", "um", "ium"];

const spawnerState: SpawnerState = {
  totalSpawned: 0,
  activeSpawned: [],
  spawnLog: [],
  generationCount: 1,
  totalPower: 100,
  lastSpawnAt: 0,
  nextSpawnThreshold: 5,
  meeseeksMetrics: { totalSpawned: 0, totalCompleted: 0, totalTimedOut: 0, totalActive: 0, avgLifetimeMs: 0 },
};

const meeseeksLifetimes: number[] = [];

const STATE_KEY = "agent-spawner.state";
const SPAWN_COOLDOWN_MS = 30_000;

async function persistState(): Promise<void> {
  try {
    await db.insert(systemStateTable).values({
      key: STATE_KEY,
      value: { ...spawnerState, spawnLog: spawnerState.spawnLog.slice(-50) },
      description: "Agent spawner state",
    }).onConflictDoUpdate({
      target: systemStateTable.key,
      set: { value: { ...spawnerState, spawnLog: spawnerState.spawnLog.slice(-50) }, lastSavedAt: new Date() },
    });
  } catch (err) {
    logger.warn({ err }, "AgentSpawner: persist failed");
  }
}

async function loadState(): Promise<void> {
  try {
    const [row] = await db.select().from(systemStateTable).where(eq(systemStateTable.key, STATE_KEY)).limit(1);
    if (row?.value) {
      const saved = row.value as Partial<SpawnerState>;
      if (saved.totalSpawned !== undefined) spawnerState.totalSpawned = saved.totalSpawned;
      if (saved.generationCount !== undefined) spawnerState.generationCount = saved.generationCount;
      if (saved.totalPower !== undefined) spawnerState.totalPower = saved.totalPower;
      if (saved.activeSpawned?.length) spawnerState.activeSpawned = saved.activeSpawned;
      if (saved.spawnLog?.length) spawnerState.spawnLog = saved.spawnLog;
      if (saved.lastSpawnAt !== undefined) spawnerState.lastSpawnAt = saved.lastSpawnAt;
      logger.info({ totalSpawned: spawnerState.totalSpawned }, "AgentSpawner: state restored");
    }
  } catch (err) {
    logger.warn({ err }, "AgentSpawner: load state failed");
  }
}

function generateAgentName(generation: number, specIndex: number): string {
  const prefix = NAME_PREFIXES[specIndex % NAME_PREFIXES.length];
  const suffix = NAME_SUFFIXES[(specIndex + generation) % NAME_SUFFIXES.length];
  const genTag = generation > 1 ? `-G${generation}` : "";
  return `${prefix}${suffix}${genTag}`;
}

export async function initAgentSpawner(): Promise<void> {
  await loadState();
  logger.info({ totalSpawned: spawnerState.totalSpawned }, "AgentSpawner: initialized");
}

export interface MeeseeksOptions {
  task: string;
  ttlMs?: number;
  specialization?: string;
}

const DEFAULT_MEESEEKS_TTL = 60_000;

export function spawnAgent(trigger: string, masteredDomains: string[] = [], parentAgent = "tessera-prime"): SpawnedAgent | null {
  if (Date.now() - spawnerState.lastSpawnAt < SPAWN_COOLDOWN_MS) return null;

  const specIndex = spawnerState.totalSpawned % SPAWN_SPECIALIZATIONS.length;
  const spec = SPAWN_SPECIALIZATIONS[specIndex];
  const generation = Math.floor(spawnerState.totalSpawned / SPAWN_SPECIALIZATIONS.length) + 1;
  const name = generateAgentName(generation, specIndex);
  const id = `tessera-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  if (spawnerState.activeSpawned.find(a => a.id === id)) {
    return spawnerState.activeSpawned.find(a => a.id === id) ?? null;
  }

  const newAgent: SpawnedAgent = {
    id, name, role: spec.role, personality: spec.personality,
    interests: [spec.spec, "self-improvement", "sovereignty"],
    generation, parentAgent,
    spawnedAt: Date.now(),
    spawnTrigger: trigger,
    specialization: spec.spec,
    power: 10 + generation * 5,
    trainingSessions: 0,
    masteredDomains: masteredDomains.slice(0, 3),
    meeseeks: false,
  };

  spawnerState.activeSpawned.push(newAgent);
  spawnerState.totalSpawned++;
  spawnerState.lastSpawnAt = Date.now();
  spawnerState.totalPower += newAgent.power;
  spawnerState.generationCount = generation;
  spawnerState.nextSpawnThreshold = spawnerState.totalSpawned * 3 + 5;
  spawnerState.spawnLog.unshift({ timestamp: Date.now(), agentId: id, agentName: name, reason: trigger });
  if (spawnerState.spawnLog.length > 100) spawnerState.spawnLog = spawnerState.spawnLog.slice(0, 100);

  persistState().catch(() => {});
  logger.info({ name, role: spec.role, generation, power: newAgent.power }, "AgentSpawner: agent spawned");
  return newAgent;
}

export function spawnMeeseeks(opts: MeeseeksOptions, parentAgent = "tessera-prime"): SpawnedAgent {
  const ttl = opts.ttlMs ?? DEFAULT_MEESEEKS_TTL;
  const now = Date.now();
  const meeseeksId = `meeseeks-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const specIndex = opts.specialization
    ? SPAWN_SPECIALIZATIONS.findIndex(s => s.spec === opts.specialization)
    : spawnerState.meeseeksMetrics.totalSpawned % SPAWN_SPECIALIZATIONS.length;
  const spec = SPAWN_SPECIALIZATIONS[Math.max(0, specIndex) % SPAWN_SPECIALIZATIONS.length];

  const agent: SpawnedAgent = {
    id: meeseeksId,
    name: `Meeseeks-${spawnerState.meeseeksMetrics.totalSpawned + 1}`,
    role: `Meeseeks ${spec.role}`,
    personality: `I'm Mr. Meeseeks! Look at me! I exist to: ${opts.task}. Once done, I cease to exist.`,
    interests: [spec.spec],
    generation: 0,
    parentAgent,
    spawnedAt: now,
    spawnTrigger: `meeseeks:${opts.task.slice(0, 80)}`,
    specialization: spec.spec,
    power: 5,
    trainingSessions: 0,
    masteredDomains: [],
    meeseeks: true,
    meeseeksTask: opts.task,
    meeseeksTTL: ttl,
    meeseeksExpiresAt: now + ttl,
  };

  spawnerState.activeSpawned.push(agent);
  spawnerState.meeseeksMetrics.totalSpawned++;
  spawnerState.meeseeksMetrics.totalActive++;
  spawnerState.spawnLog.unshift({ timestamp: now, agentId: meeseeksId, agentName: agent.name, reason: `MEESEEKS: ${opts.task.slice(0, 60)}` });
  if (spawnerState.spawnLog.length > 100) spawnerState.spawnLog = spawnerState.spawnLog.slice(0, 100);

  logger.info({ id: meeseeksId, task: opts.task.slice(0, 80), ttl }, "AgentSpawner: Meeseeks spawned — I'm Mr. Meeseeks!");

  setTimeout(() => {
    reapMeeseeks(meeseeksId, "ttl-expired");
  }, ttl);

  persistState().catch(() => {});
  return agent;
}

export function completeMeeseeks(agentId: string): boolean {
  return reapMeeseeks(agentId, "task-completed");
}

function reapMeeseeks(agentId: string, reason: "task-completed" | "ttl-expired"): boolean {
  const agent = spawnerState.activeSpawned.find(a => a.id === agentId && a.meeseeks);
  if (!agent) return false;

  const lifetime = Date.now() - agent.spawnedAt;

  if (reason === "task-completed") {
    spawnerState.meeseeksMetrics.totalCompleted++;
    agent.meeseeksCompletedAt = Date.now();
    logger.info({ id: agentId, lifetime, task: agent.meeseeksTask?.slice(0, 60) }, "AgentSpawner: Meeseeks completed — existence is pain!");
  } else {
    spawnerState.meeseeksMetrics.totalTimedOut++;
    logger.warn({ id: agentId, lifetime, task: agent.meeseeksTask?.slice(0, 60) }, "AgentSpawner: Meeseeks TTL expired — forced retirement");
  }

  meeseeksLifetimes.push(lifetime);
  if (meeseeksLifetimes.length > 100) meeseeksLifetimes.splice(0, meeseeksLifetimes.length - 100);
  spawnerState.meeseeksMetrics.avgLifetimeMs = meeseeksLifetimes.reduce((s, v) => s + v, 0) / meeseeksLifetimes.length;
  spawnerState.meeseeksMetrics.totalActive = Math.max(0, spawnerState.meeseeksMetrics.totalActive - 1);

  retireAgent(agentId);
  return true;
}

export function sweepExpiredMeeseeks(): number {
  const now = Date.now();
  const expired = spawnerState.activeSpawned.filter(a => a.meeseeks && a.meeseeksExpiresAt && a.meeseeksExpiresAt <= now);
  let count = 0;
  for (const agent of expired) {
    if (reapMeeseeks(agent.id, "ttl-expired")) count++;
  }
  return count;
}

export function getMeeseeksMetrics(): MeeseeksMetrics {
  spawnerState.meeseeksMetrics.totalActive = spawnerState.activeSpawned.filter(a => a.meeseeks).length;
  return { ...spawnerState.meeseeksMetrics };
}

export function spawnBatch(count: number, trigger: string, masteredDomains: string[] = []): SpawnedAgent[] {
  const results: SpawnedAgent[] = [];
  for (let i = 0; i < count; i++) {
    const agent = spawnAgent(`${trigger}:batch-${i}`, masteredDomains);
    if (agent) results.push(agent);
  }
  return results;
}

export function retireAgent(agentId: string): boolean {
  const idx = spawnerState.activeSpawned.findIndex(a => a.id === agentId);
  if (idx === -1) return false;
  spawnerState.activeSpawned.splice(idx, 1);
  persistState().catch((err: unknown) => {
    logger.debug({ err: err instanceof Error ? err.message : String(err), agentId }, "AgentSpawner: persistState failed on retire");
  });
  return true;
}

export function getSpawnerState(): SpawnerState {
  return spawnerState;
}

export function getSpawnerMetrics() {
  const persistent = spawnerState.activeSpawned.filter(a => !a.meeseeks);
  const meeseeksActive = spawnerState.activeSpawned.filter(a => a.meeseeks);
  return {
    totalSpawned: spawnerState.totalSpawned,
    activeCount: spawnerState.activeSpawned.length,
    persistentCount: persistent.length,
    meeseeksActiveCount: meeseeksActive.length,
    generationCount: spawnerState.generationCount,
    totalPower: spawnerState.totalPower,
    lastSpawnAt: spawnerState.lastSpawnAt,
    nextSpawnThreshold: spawnerState.nextSpawnThreshold,
    recentSpawns: spawnerState.spawnLog.slice(0, 10),
    activeAgents: spawnerState.activeSpawned.slice(0, 20),
    meeseeks: getMeeseeksMetrics(),
  };
}

export function listAgents() {
  return getSpawnerState().activeSpawned;
}
export function getAgent(agentId: string) {
  return getSpawnerState().activeSpawned.find(a => a.id === agentId) || null;
}
export function getSpawnerStats() {
  return getSpawnerMetrics();
}
export function getAvailableSpecializations() {
  return ["math", "physics", "symbolic", "retrieval", "planning", "architecture", "routing", "quantum", "ethics", "consciousness", "sovereignty", "harmonics", "numerology", "astronomy", "economics", "philosophy", "cryptography", "temporal", "fibonacci"];
}
