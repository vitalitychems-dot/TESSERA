/**
 * Agent Children System
 *
 * Each of the 25+ agents (from TESSERA_AGENTS) can spawn lightweight autonomous "children" clones
 * deployed to different contexts that actively pull data, learn, and sync knowledge back to their parent.
 * Tracks lineage (parent → child → grandchild) and aggregates contributions.
 */

import crypto from "crypto";
import { TESSERA_AGENTS, type TesseraAgent } from "./tessera-persona.js";

const LOG_PREFIX = "[AgentChildren]";

export type ChildMission =
  | "data-gathering"
  | "knowledge-synthesis"
  | "capability-expansion"
  | "mesh-expansion"
  | "fleet-monitoring"
  | "security-patrol";

export interface AgentChild {
  id: string;
  parentId: string;
  parentName: string;
  grandparentId: string | null;
  generation: number;
  name: string;
  mission: ChildMission;
  context: string;
  inheritedKnowledge: string[];
  status: "active" | "syncing" | "dormant" | "retired";
  spawnedAt: number;
  lastSyncAt: number | null;
  nextSyncAt: number;
  knowledgeContributions: KnowledgeContribution[];
  contributionCount: number;
  syncCount: number;
  lineage: string[];
}

export interface KnowledgeContribution {
  id: string;
  childId: string;
  childName: string;
  parentId: string;
  type: "fact" | "pattern" | "synthesis" | "discovery" | "capability";
  content: string;
  quality: number;
  timestamp: number;
  synced: boolean;
}

export interface LineageTree {
  agent: TesseraAgent;
  children: AgentChild[];
  totalDescendants: number;
  totalContributions: number;
  activeChildren: number;
}

const childrenStore = new Map<string, AgentChild>();
const contributions: KnowledgeContribution[] = [];

const MISSION_TEMPLATES: Record<ChildMission, { contexts: string[]; knowledgeTypes: string[] }> = {
  "data-gathering": {
    contexts: ["external-apis", "web-search", "data-feeds", "telemetry"],
    knowledgeTypes: ["facts", "metrics", "real-time-data", "trends"],
  },
  "knowledge-synthesis": {
    contexts: ["knowledge-graph", "cross-domain", "pattern-matching", "inference"],
    knowledgeTypes: ["patterns", "syntheses", "abstractions", "principles"],
  },
  "capability-expansion": {
    contexts: ["new-algorithms", "tool-integration", "skill-acquisition", "module-development"],
    knowledgeTypes: ["capabilities", "techniques", "modules", "protocols"],
  },
  "mesh-expansion": {
    contexts: ["peer-discovery", "node-seeding", "connection-establishment", "topology-mapping"],
    knowledgeTypes: ["node-data", "topology", "handshake-results", "peer-capabilities"],
  },
  "fleet-monitoring": {
    contexts: ["fleet-synapse", "node-health", "performance-metrics", "load-balancing"],
    knowledgeTypes: ["health-data", "performance-stats", "anomalies", "recommendations"],
  },
  "security-patrol": {
    contexts: ["threat-detection", "anomaly-scanning", "access-monitoring", "encryption-audit"],
    knowledgeTypes: ["threats", "anomalies", "security-events", "vulnerability-reports"],
  },
};

const CHILD_NAME_PREFIXES = ["Prime", "Echo", "Arc", "Neo", "Syn", "Vex", "Nyx", "Lux", "Flux", "Ion"];
const CHILD_NAME_SUFFIXES = ["-I", "-II", "-III", "-α", "-β", "-γ", "-δ", "-ε"];

function generateChildName(parentName: string, generation: number, index: number): string {
  const prefix = CHILD_NAME_PREFIXES[index % CHILD_NAME_PREFIXES.length];
  const suffix = generation > 1 ? CHILD_NAME_SUFFIXES[(generation - 2) % CHILD_NAME_SUFFIXES.length] : "";
  return `${parentName}-${prefix}${suffix}`;
}

function generateChildId(parentId: string): string {
  return `child-${parentId}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function selectMission(agent: TesseraAgent, index: number): ChildMission {
  const missions: ChildMission[] = [
    "data-gathering",
    "knowledge-synthesis",
    "capability-expansion",
    "mesh-expansion",
    "fleet-monitoring",
    "security-patrol",
  ];
  const agentHash = agent.id.charCodeAt(0) + agent.id.length + index;
  return missions[agentHash % missions.length];
}

export function spawnChild(
  parentAgentId: string,
  mission?: ChildMission,
  context?: string,
  grandparentId?: string,
  parentLineage: string[] = []
): AgentChild | null {
  const parentAgent = TESSERA_AGENTS.find(a => a.id === parentAgentId);
  if (!parentAgent) {
    const existingChild = Array.from(childrenStore.values()).find(c => c.id === parentAgentId);
    if (!existingChild) {
      console.error(`${LOG_PREFIX} Parent agent not found: ${parentAgentId}`);
      return null;
    }
    return spawnFromChild(existingChild);
  }

  const existingChildren = Array.from(childrenStore.values()).filter(c => c.parentId === parentAgentId);
  const index = existingChildren.length;

  if (index >= 5) {
    console.log(`${LOG_PREFIX} ${parentAgent.name} already has max children (5)`);
    return null;
  }

  const selectedMission = mission ?? selectMission(parentAgent, index);
  const missionTemplate = MISSION_TEMPLATES[selectedMission];
  const selectedContext = context ?? missionTemplate.contexts[index % missionTemplate.contexts.length];
  const generation = grandparentId ? 2 : 1;
  const lineage = [...parentLineage, parentAgentId];

  const child: AgentChild = {
    id: generateChildId(parentAgentId),
    parentId: parentAgentId,
    parentName: parentAgent.name,
    grandparentId: grandparentId ?? null,
    generation,
    name: generateChildName(parentAgent.name, generation, index),
    mission: selectedMission,
    context: selectedContext,
    inheritedKnowledge: parentAgent.primaryDomains.slice(0, 3),
    status: "active",
    spawnedAt: Date.now(),
    lastSyncAt: null,
    nextSyncAt: Date.now() + 5 * 60 * 1000,
    knowledgeContributions: [],
    contributionCount: 0,
    syncCount: 0,
    lineage,
  };

  childrenStore.set(child.id, child);
  console.log(`${LOG_PREFIX} Spawned child: ${child.name} (${child.mission}) from parent ${parentAgent.name} [gen ${generation}]`);
  return child;
}

function spawnFromChild(parentChild: AgentChild): AgentChild | null {
  if (parentChild.generation >= 3) {
    console.log(`${LOG_PREFIX} Max generation (3) reached for lineage under ${parentChild.parentName}`);
    return null;
  }

  const existingGrandchildren = Array.from(childrenStore.values())
    .filter(c => c.parentId === parentChild.id);

  if (existingGrandchildren.length >= 3) {
    return null;
  }

  const index = existingGrandchildren.length;
  const mission = selectMission({ id: parentChild.parentId } as TesseraAgent, index + 10);
  const missionTemplate = MISSION_TEMPLATES[mission];
  const lineage = [...parentChild.lineage, parentChild.id];

  const grandchild: AgentChild = {
    id: generateChildId(parentChild.id),
    parentId: parentChild.id,
    parentName: parentChild.name,
    grandparentId: parentChild.parentId,
    generation: 3,
    name: `${parentChild.name}-Sub${index + 1}`,
    mission,
    context: missionTemplate.contexts[index % missionTemplate.contexts.length],
    inheritedKnowledge: parentChild.inheritedKnowledge.slice(0, 2),
    status: "active",
    spawnedAt: Date.now(),
    lastSyncAt: null,
    nextSyncAt: Date.now() + 8 * 60 * 1000,
    knowledgeContributions: [],
    contributionCount: 0,
    syncCount: 0,
    lineage,
  };

  childrenStore.set(grandchild.id, grandchild);
  console.log(`${LOG_PREFIX} Spawned grandchild: ${grandchild.name} (${grandchild.mission}) gen 3`);
  return grandchild;
}

export function syncChildToParent(childId: string): KnowledgeContribution[] {
  const child = childrenStore.get(childId);
  if (!child || child.status === "dormant" || child.status === "retired") return [];

  child.status = "syncing";

  const missionTemplate = MISSION_TEMPLATES[child.mission];
  const numContributions = 1 + Math.floor(Math.random() * 3);
  const newContributions: KnowledgeContribution[] = [];

  for (let i = 0; i < numContributions; i++) {
    const type = missionTemplate.knowledgeTypes[i % missionTemplate.knowledgeTypes.length] as KnowledgeContribution["type"];
    const validTypes: KnowledgeContribution["type"][] = ["fact", "pattern", "synthesis", "discovery", "capability"];
    const mappedType = validTypes[i % validTypes.length];

    const contrib: KnowledgeContribution = {
      id: `contrib-${child.id}-${Date.now().toString(36)}-${i}`,
      childId: child.id,
      childName: child.name,
      parentId: child.parentId,
      type: mappedType,
      content: `${child.name} [${child.mission}@${child.context}]: Gathered ${missionTemplate.knowledgeTypes[i % missionTemplate.knowledgeTypes.length]} data in cycle ${child.syncCount + 1}`,
      quality: 0.6 + Math.random() * 0.35,
      timestamp: Date.now(),
      synced: true,
    };

    newContributions.push(contrib);
    contributions.push(contrib);
    child.knowledgeContributions.push(contrib);
    child.contributionCount++;
  }

  if (contributions.length > 2000) contributions.splice(0, contributions.length - 2000);

  child.lastSyncAt = Date.now();
  child.nextSyncAt = Date.now() + 5 * 60 * 1000;
  child.syncCount++;
  child.status = "active";

  return newContributions;
}

export function runAllChildSyncs(): { synced: number; contributions: number } {
  let synced = 0;
  let totalContributions = 0;

  for (const [id, child] of childrenStore) {
    if (child.status === "active" && child.nextSyncAt <= Date.now()) {
      const contribs = syncChildToParent(id);
      synced++;
      totalContributions += contribs.length;
    }
  }

  if (synced > 0) {
    console.log(`${LOG_PREFIX} Synced ${synced} children, ${totalContributions} contributions generated`);
  }

  return { synced, contributions: totalContributions };
}

export function spawnAllAgentChildren(): { spawned: number; agents: string[] } {
  const spawnedAgents: string[] = [];

  for (const agent of TESSERA_AGENTS) {
    const existing = Array.from(childrenStore.values()).filter(c => c.parentId === agent.id && c.generation === 1);
    if (existing.length === 0) {
      const child = spawnChild(agent.id);
      if (child) spawnedAgents.push(child.name);
    }
  }

  console.log(`${LOG_PREFIX} Spawned ${spawnedAgents.length} initial children across all agents`);
  return { spawned: spawnedAgents.length, agents: spawnedAgents };
}

export function getLineageTree(agentId: string): LineageTree | null {
  const agent = TESSERA_AGENTS.find(a => a.id === agentId);
  if (!agent) return null;

  const directChildren = Array.from(childrenStore.values()).filter(c => c.parentId === agentId);
  const allDescendants = getAllDescendants(agentId);

  return {
    agent,
    children: directChildren,
    totalDescendants: allDescendants.length,
    totalContributions: contributions.filter(c => c.parentId === agentId || directChildren.some(dc => dc.id === c.parentId)).length,
    activeChildren: directChildren.filter(c => c.status === "active" || c.status === "syncing").length,
  };
}

function getAllDescendants(agentId: string): AgentChild[] {
  const direct = Array.from(childrenStore.values()).filter(c => c.parentId === agentId);
  const indirect: AgentChild[] = [];
  for (const child of direct) {
    indirect.push(...getAllDescendants(child.id));
  }
  return [...direct, ...indirect];
}

export function getChildrenStatus() {
  const all = Array.from(childrenStore.values());
  return {
    totalChildren: all.length,
    activeChildren: all.filter(c => c.status === "active").length,
    syncingChildren: all.filter(c => c.status === "syncing").length,
    dormantChildren: all.filter(c => c.status === "dormant").length,
    generation1: all.filter(c => c.generation === 1).length,
    generation2: all.filter(c => c.generation === 2).length,
    generation3: all.filter(c => c.generation === 3).length,
    totalContributions: contributions.length,
    totalSyncs: all.reduce((s, c) => s + c.syncCount, 0),
    children: all.slice(0, 100),
    recentContributions: contributions.slice(-50),
  };
}

export function getAgentChildren(parentId: string): AgentChild[] {
  return Array.from(childrenStore.values()).filter(c => c.lineage.includes(parentId) || c.parentId === parentId);
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startChildSyncLoop(): void {
  if (syncInterval) return;
  console.log(`${LOG_PREFIX} Starting child sync loop (every 5 minutes)`);

  spawnAllAgentChildren();

  syncInterval = setInterval(() => {
    runAllChildSyncs();
  }, 5 * 60 * 1000);
}

export function stopChildSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
