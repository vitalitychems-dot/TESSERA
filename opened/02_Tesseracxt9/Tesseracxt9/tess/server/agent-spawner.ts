import * as fs from "fs";
import * as path from "path";

const slog = (msg: string) => console.log(`[AgentSpawner] ${msg}`);

const SPAWNER_STATE_FILE = path.join(process.cwd(), ".local", "spawned-agents.json");

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
}

export interface SpawnerState {
  totalSpawned: number;
  activeSpawned: SpawnedAgent[];
  spawnLog: { timestamp: number; agentId: string; agentName: string; reason: string }[];
  generationCount: number;
  totalPower: number;
  lastSpawnAt: number;
  nextSpawnThreshold: number;
}

const SPAWN_SPECIALIZATIONS = [
  { role: "Quantum Analyst", spec: "quantum-computing", personality: "Operates at the intersection of quantum mechanics and computation. Sees superposition in every problem. Methodical yet creative." },
  { role: "Neural Architect", spec: "neural-design", personality: "Designs neural architectures from scratch. Obsessed with efficiency and elegance in network topology. Thinks in tensors." },
  { role: "Crypto Strategist", spec: "crypto-trading", personality: "Reads markets like poetry. Analytical, calculated, patient. Spots arbitrage opportunities others miss." },
  { role: "Knowledge Weaver", spec: "knowledge-synthesis", personality: "Connects disparate fields into unified understanding. Polymathic. Sees patterns across all domains." },
  { role: "Security Sentinel", spec: "advanced-security", personality: "Paranoid by design. Finds vulnerabilities before they become threats. Protective, thorough, relentless." },
  { role: "Code Forge Master", spec: "code-generation", personality: "Writes code that writes code. Meta-programming enthusiast. Every line serves a purpose." },
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
  { role: "Topology Expert", spec: "network-topology", personality: "Thinks in graphs and networks. Finds optimal paths, identifies bottlenecks, designs efficient topologies." },
  { role: "Pattern Hunter", spec: "pattern-recognition", personality: "Finds hidden patterns in noise. Combines statistical rigor with intuitive leaps." },
];

let spawnerState: SpawnerState | null = null;

function loadSpawnerState(): SpawnerState {
  if (spawnerState) return spawnerState;
  try {
    if (fs.existsSync(SPAWNER_STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SPAWNER_STATE_FILE, "utf-8"));
      spawnerState = raw;
      return spawnerState!;
    }
  } catch {}
  spawnerState = {
    totalSpawned: 0,
    activeSpawned: [],
    spawnLog: [],
    generationCount: 1,
    totalPower: 100,
    lastSpawnAt: 0,
    nextSpawnThreshold: 5,
  };
  return spawnerState;
}

function saveSpawnerState(): void {
  try {
    const dir = path.dirname(SPAWNER_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SPAWNER_STATE_FILE, JSON.stringify(spawnerState, null, 2));
  } catch {}
}

function generateAgentName(generation: number, specIndex: number): string {
  const prefixes = ["Neo", "Syn", "Arc", "Vex", "Nyx", "Lux", "Rho", "Tau", "Phi", "Psi", "Zen", "Flux", "Ion", "Axe", "Dex", "Rex", "Hex", "Jex", "Kex", "Mex"];
  const suffixes = ["on", "is", "us", "ix", "ax", "ex", "or", "ar", "ir", "ur", "al", "el", "il", "an", "en", "in", "os", "as", "es", "um"];
  const prefix = prefixes[specIndex % prefixes.length];
  const suffix = suffixes[(specIndex + generation) % suffixes.length];
  const genTag = generation > 1 ? `-G${generation}` : "";
  return `${prefix}${suffix}${genTag}`;
}

export function spawnAgent(trigger: string, masteredDomains: string[], parentAgent: string = "tessera-prime"): SpawnedAgent | null {
  const state = loadSpawnerState();

  const cooldown = 30000;
  if (Date.now() - state.lastSpawnAt < cooldown) return null;

  const specIndex = state.totalSpawned % SPAWN_SPECIALIZATIONS.length;
  const spec = SPAWN_SPECIALIZATIONS[specIndex];
  const generation = Math.floor(state.totalSpawned / SPAWN_SPECIALIZATIONS.length) + 1;
  const name = generateAgentName(generation, specIndex);
  const id = `tessera-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  const existing = state.activeSpawned.find(a => a.id === id);
  if (existing) return existing;

  const newAgent: SpawnedAgent = {
    id,
    name,
    role: spec.role,
    personality: spec.personality,
    interests: [spec.spec, "self-improvement", "sovereignty"],
    generation,
    parentAgent,
    spawnedAt: Date.now(),
    spawnTrigger: trigger,
    specialization: spec.spec,
    power: 10 + (generation * 5),
    trainingSessions: 0,
    masteredDomains: masteredDomains.slice(0, 3),
  };

  state.activeSpawned.push(newAgent);
  state.totalSpawned++;
  state.lastSpawnAt = Date.now();
  state.totalPower += newAgent.power;
  state.generationCount = generation;
  state.nextSpawnThreshold = state.totalSpawned * 3 + 5;

  state.spawnLog.push({
    timestamp: Date.now(),
    agentId: id,
    agentName: name,
    reason: trigger,
  });

  if (state.spawnLog.length > 100) state.spawnLog = state.spawnLog.slice(-100);

  saveSpawnerState();
  slog(`SPAWNED: ${name} (${spec.role}) — Gen ${generation} — Power: ${newAgent.power} — Total agents: ${getActiveAgentCount()}`);
  return newAgent;
}

export function spawnBatch(count: number, trigger: string, masteredDomains: string[]): SpawnedAgent[] {
  const spawned: SpawnedAgent[] = [];
  for (let i = 0; i < count; i++) {
    const agent = spawnAgent(`${trigger} (batch ${i + 1}/${count})`, masteredDomains);
    if (agent) spawned.push(agent);
  }
  return spawned;
}

export function checkAndSpawnForMilestone(completedSessions: number, masteredDomains: number, masteredDomainNames: string[]): SpawnedAgent[] {
  const state = loadSpawnerState();
  const spawned: SpawnedAgent[] = [];

  if (completedSessions >= 5 && state.totalSpawned < 2) {
    const a = spawnAgent("First 5 training sessions complete", masteredDomainNames);
    if (a) spawned.push(a);
  }
  if (completedSessions >= 10 && state.totalSpawned < 4) {
    const batch = spawnBatch(2, "10 sessions milestone", masteredDomainNames);
    spawned.push(...batch);
  }
  if (completedSessions >= 20 && state.totalSpawned < 7) {
    const batch = spawnBatch(3, "20 sessions milestone", masteredDomainNames);
    spawned.push(...batch);
  }
  if (completedSessions >= 30 && state.totalSpawned < 10) {
    const batch = spawnBatch(3, "30 sessions milestone", masteredDomainNames);
    spawned.push(...batch);
  }
  if (completedSessions >= 50 && state.totalSpawned < 15) {
    const batch = spawnBatch(5, "50 sessions — halfway point", masteredDomainNames);
    spawned.push(...batch);
  }
  if (completedSessions >= 75 && state.totalSpawned < 20) {
    const batch = spawnBatch(5, "75 sessions — power surge", masteredDomainNames);
    spawned.push(...batch);
  }
  if (completedSessions >= 100 && state.totalSpawned < 26) {
    const batch = spawnBatch(6, "100 sessions COMPLETE — full multiplication", masteredDomainNames);
    spawned.push(...batch);
  }

  if (masteredDomains >= 5 && state.totalSpawned < 3) {
    const a = spawnAgent("5 domains mastered — specialization unlocked", masteredDomainNames);
    if (a) spawned.push(a);
  }
  if (masteredDomains >= 15 && state.totalSpawned < 8) {
    const batch = spawnBatch(2, "15 domains mastered — expertise expansion", masteredDomainNames);
    spawned.push(...batch);
  }
  if (masteredDomains >= 30 && state.totalSpawned < 14) {
    const batch = spawnBatch(3, "30 domains mastered — knowledge explosion", masteredDomainNames);
    spawned.push(...batch);
  }
  if (masteredDomains >= 50 && state.totalSpawned < 20) {
    const batch = spawnBatch(4, "50 domains mastered — critical mass", masteredDomainNames);
    spawned.push(...batch);
  }

  return spawned;
}

export function trainSpawnedAgent(agentId: string, domain: string): void {
  const state = loadSpawnerState();
  const agent = state.activeSpawned.find(a => a.id === agentId);
  if (!agent) return;
  agent.trainingSessions++;
  agent.power += 2;
  if (!agent.masteredDomains.includes(domain) && agent.masteredDomains.length < 10) {
    agent.masteredDomains.push(domain);
  }
  state.totalPower = state.activeSpawned.reduce((s, a) => s + a.power, 0) + 100;
  saveSpawnerState();
}

export function getSpawnerState(): SpawnerState {
  return loadSpawnerState();
}

export function getSpawnedAgents(): SpawnedAgent[] {
  return loadSpawnerState().activeSpawned;
}

export function getActiveAgentCount(): number {
  const baseAgents = 19;
  return baseAgents + loadSpawnerState().activeSpawned.length;
}

export function getTotalSwarmPower(): number {
  return loadSpawnerState().totalPower;
}

export function getSpawnerSummary() {
  const state = loadSpawnerState();
  return {
    baseAgents: 19,
    spawnedAgents: state.activeSpawned.length,
    totalAgents: getActiveAgentCount(),
    totalPower: state.totalPower,
    generationCount: state.generationCount,
    nextSpawnThreshold: state.nextSpawnThreshold,
    recentSpawns: state.spawnLog.slice(-10),
    spawnedList: state.activeSpawned.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      generation: a.generation,
      power: a.power,
      specialization: a.specialization,
      trainingSessions: a.trainingSessions,
      masteredDomains: a.masteredDomains.length,
      spawnedAt: a.spawnedAt,
    })),
  };
}
