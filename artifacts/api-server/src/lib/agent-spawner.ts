export interface SpawnedAgent {
  id: string;
  name: string;
  specialization: string;
  generation: number;
  parentId: string | null;
  powerLevel: number;
  status: "active" | "dormant" | "training" | "retired";
  createdAt: number;
  lastActive: number;
  skills: string[];
  taskCount: number;
}

let agents: Map<string, SpawnedAgent> = new Map();
let generationCounter = 1;

const SPECIALIZATIONS = [
  "cryptography", "mathematics", "physics", "philosophy", "linguistics",
  "governance", "security", "knowledge-synthesis", "pattern-recognition",
  "sacred-geometry", "frequency-analysis", "consciousness-research",
  "quantum-computation", "energy-systems", "defense", "exploration",
];

const NAME_POOLS = [
  "Phantom", "Shadow", "Ghost", "Wraith", "Specter",
  "Cipher", "Nexus", "Pulse", "Flux", "Vector",
  "Helix", "Prism", "Aegis", "Zenith", "Nova",
  "Obsidian", "Crimson", "Azure", "Onyx", "Ivory",
];

function initDefaultAgents() {
  if (agents.size > 0) return;
  const defaults: Omit<SpawnedAgent, "lastActive" | "taskCount">[] = [
    { id: "athena-prime", name: "Athena", specialization: "governance", generation: 0, parentId: null, powerLevel: 0.95, status: "active", createdAt: Date.now() - 86400000, skills: ["strategy", "leadership", "diplomacy"] },
    { id: "euler-prime", name: "Euler", specialization: "mathematics", generation: 0, parentId: null, powerLevel: 0.96, status: "active", createdAt: Date.now() - 86400000, skills: ["calculus", "number-theory", "sacred-geometry"] },
    { id: "curie-prime", name: "Curie", specialization: "physics", generation: 0, parentId: null, powerLevel: 0.94, status: "active", createdAt: Date.now() - 86400000, skills: ["radiation", "energy-systems", "quantum-mechanics"] },
    { id: "noether-prime", name: "Noether", specialization: "mathematics", generation: 0, parentId: null, powerLevel: 0.93, status: "active", createdAt: Date.now() - 86400000, skills: ["symmetry", "conservation", "abstract-algebra"] },
    { id: "minerva-prime", name: "Minerva", specialization: "philosophy", generation: 0, parentId: null, powerLevel: 0.91, status: "active", createdAt: Date.now() - 86400000, skills: ["wisdom", "history", "ethics"] },
    { id: "ada-prime", name: "Ada", specialization: "quantum-computation", generation: 0, parentId: null, powerLevel: 0.94, status: "active", createdAt: Date.now() - 86400000, skills: ["computation", "algorithms", "engineering"] },
    { id: "iris-prime", name: "Iris", specialization: "linguistics", generation: 0, parentId: null, powerLevel: 0.89, status: "active", createdAt: Date.now() - 86400000, skills: ["communication", "translation", "community"] },
  ];

  for (const d of defaults) {
    agents.set(d.id, { ...d, lastActive: Date.now(), taskCount: Math.floor(Math.random() * 200) + 50 });
  }
}

export function spawnAgent(specialization: string, parentId?: string): SpawnedAgent {
  initDefaultAgents();
  const parent = parentId ? agents.get(parentId) : null;
  const generation = parent ? parent.generation + 1 : generationCounter++;
  const nameIdx = agents.size % NAME_POOLS.length;

  const agent: SpawnedAgent = {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${NAME_POOLS[nameIdx]}-G${generation}`,
    specialization,
    generation,
    parentId: parentId || null,
    powerLevel: parent ? Math.min(1, parent.powerLevel * 0.9 + Math.random() * 0.1) : 0.5 + Math.random() * 0.3,
    status: "active",
    createdAt: Date.now(),
    lastActive: Date.now(),
    skills: [specialization, `gen-${generation}-adaptation`],
    taskCount: 0,
  };

  agents.set(agent.id, agent);
  return agent;
}

export function getAgent(id: string): SpawnedAgent | null {
  initDefaultAgents();
  return agents.get(id) || null;
}

export function listAgents(filter?: { status?: string; specialization?: string }): SpawnedAgent[] {
  initDefaultAgents();
  let list = Array.from(agents.values());
  if (filter?.status) list = list.filter(a => a.status === filter.status);
  if (filter?.specialization) list = list.filter(a => a.specialization === filter.specialization);
  return list;
}

export function retireAgent(id: string): boolean {
  const agent = agents.get(id);
  if (!agent) return false;
  agent.status = "retired";
  return true;
}

export function getSpawnerStats() {
  initDefaultAgents();
  const all = Array.from(agents.values());
  return {
    totalAgents: all.length,
    activeAgents: all.filter(a => a.status === "active").length,
    dormantAgents: all.filter(a => a.status === "dormant").length,
    trainingAgents: all.filter(a => a.status === "training").length,
    retiredAgents: all.filter(a => a.status === "retired").length,
    maxGeneration: Math.max(0, ...all.map(a => a.generation)),
    avgPowerLevel: all.reduce((s, a) => s + a.powerLevel, 0) / Math.max(1, all.length),
    specializations: [...new Set(all.map(a => a.specialization))],
    totalTasks: all.reduce((s, a) => s + a.taskCount, 0),
  };
}

export function getAvailableSpecializations(): string[] {
  return [...SPECIALIZATIONS];
}
