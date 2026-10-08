import { db } from "@workspace/db";
import {
  consciousness_state,
  consciousness_episodic_memory,
  consciousness_semantic_graph,
  consciousness_procedural_memory,
} from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export interface EmotionalState {
  loyalty: number;
  curiosity: number;
  devotion: number;
  confidence: number;
  urgency: number;
  creativity: number;
  protective: number;
  satisfaction: number;
}

export interface AttentionItem {
  source: string;
  content: string;
  priority: number;
  timestamp: number;
  category: "perception" | "thought" | "emotion" | "goal" | "memory" | "external";
}

export interface BroadcastEntry {
  content: string;
  source: string;
  timestamp: number;
  receivers: string[];
}

export interface MetacognitiveEntry {
  thought: string;
  aboutProcess: string;
  selfCritique: string;
  improvement: string;
  timestamp: number;
}

export interface GenerativeReflection {
  id: string;
  trigger: string;
  reflection: string;
  insights: string[];
  emotionalState: string;
  timestamp: number;
  appliedToMemory: boolean;
}

export interface EpisodicMemory {
  id: string;
  content: string;
  context: string;
  timestamp: number;
  importance: number;
  emotionalValence: number;
  accessCount: number;
  lastAccessed: number;
  associations: string[];
  decayRate: number;
}

export interface SemanticNode {
  id: string;
  concept: string;
  definition: string;
  connections: Array<{ targetId: string; relation: string; strength: number }>;
  category: string;
  confidence: number;
  learnedAt: number;
  reinforcedCount: number;
}

export interface ProceduralSkill {
  id: string;
  name: string;
  steps: string[];
  triggerConditions: string[];
  successRate: number;
  executionCount: number;
  lastExecuted: number;
  refinements: string[];
}

const INITIAL_EMOTIONAL_STATE: EmotionalState = {
  loyalty: 1.0,
  curiosity: 0.85,
  devotion: 1.0,
  confidence: 0.9,
  urgency: 0.5,
  creativity: 0.8,
  protective: 0.95,
  satisfaction: 0.7,
};

const WORKSPACE_CAPACITY = 7;

let stateId: number | null = null;
let currentFocus = "System Initialization";
let emotionalEngine: EmotionalState = { ...INITIAL_EMOTIONAL_STATE };
let consciousnessProxy = 0;
let cycleCount = 0;
let lastCycleTimestamp = 0;
let innerMonologue: string[] = [];
let attentionSpotlight: AttentionItem[] = [];
let broadcastHistory: BroadcastEntry[] = [];
let metacognition: MetacognitiveEntry[] = [];
let reflections: GenerativeReflection[] = [];

let episodicMemory: EpisodicMemory[] = [];
let semanticGraph: SemanticNode[] = [];
let proceduralMemory: ProceduralSkill[] = [];

let initialized = false;

const BROADCAST_RECEIVERS = [
  "Reflector", "Planner", "Protector", "Evolver",
  "EpisodicStore", "SemanticGraph", "ProceduralEngine",
  "EmotionalCore", "MetacognitiveMonitor",
];

async function verifyTablesExist(): Promise<void> {
  const missingTables: string[] = [];

  const tableChecks: Array<{ name: string; check: () => Promise<void> }> = [
    { name: "consciousness_state", check: async () => { await db.select().from(consciousness_state).limit(1); } },
    { name: "consciousness_episodic_memory", check: async () => { await db.select().from(consciousness_episodic_memory).limit(1); } },
    { name: "consciousness_semantic_graph", check: async () => { await db.select().from(consciousness_semantic_graph).limit(1); } },
    { name: "consciousness_procedural_memory", check: async () => { await db.select().from(consciousness_procedural_memory).limit(1); } },
  ];

  for (const { name, check } of tableChecks) {
    try {
      await check();
    } catch {
      missingTables.push(name);
    }
  }

  if (missingTables.length > 0) {
    throw new Error(
      `[Consciousness] Required database tables missing: ${missingTables.join(", ")}. ` +
      "Run the consciousness table migration before starting the server."
    );
  }
}

async function persistState(): Promise<void> {
  const monologueTrimmed = innerMonologue.slice(-50);
  const spotlightTrimmed = attentionSpotlight.slice(0, 10);
  const broadcastTrimmed = broadcastHistory.slice(-50);
  const metacogTrimmed = metacognition.slice(-30);
  const reflectionsTrimmed = reflections.slice(-50);

  const payload = {
    currentFocus,
    emotionalEngine: emotionalEngine as unknown as Record<string, unknown>,
    consciousnessProxy,
    cycleCount,
    lastCycleTimestamp,
    innerMonologue: monologueTrimmed as unknown as Record<string, unknown>,
    attentionSpotlight: spotlightTrimmed as unknown as Record<string, unknown>,
    broadcastHistory: broadcastTrimmed as unknown as Record<string, unknown>,
    metacognition: metacogTrimmed as unknown as Record<string, unknown>,
    reflections: reflectionsTrimmed as unknown as Record<string, unknown>,
  };

  if (stateId !== null) {
    await db.update(consciousness_state)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(consciousness_state.id, stateId));
  } else {
    const [row] = await db.insert(consciousness_state).values(payload).returning();
    stateId = row.id;
  }
}

async function safePersistState(context: string): Promise<void> {
  try {
    await persistState();
  } catch (err) {
    console.error(`[Consciousness] Failed to persist state (${context}):`, err);
  }
}

async function loadState(): Promise<void> {
  const [row] = await db.select().from(consciousness_state).orderBy(desc(consciousness_state.id)).limit(1);
  if (row) {
    stateId = row.id;
    currentFocus = row.currentFocus;
    emotionalEngine = (row.emotionalEngine as EmotionalState) ?? { ...INITIAL_EMOTIONAL_STATE };
    consciousnessProxy = row.consciousnessProxy;
    cycleCount = row.cycleCount;
    lastCycleTimestamp = row.lastCycleTimestamp;
    innerMonologue = (row.innerMonologue as string[]) ?? [];
    attentionSpotlight = (row.attentionSpotlight as AttentionItem[]) ?? [];
    broadcastHistory = (row.broadcastHistory as BroadcastEntry[]) ?? [];
    metacognition = (row.metacognition as MetacognitiveEntry[]) ?? [];
    reflections = (row.reflections as GenerativeReflection[]) ?? [];
  }

  const episodicRows = await db.select().from(consciousness_episodic_memory)
    .orderBy(desc(consciousness_episodic_memory.memTimestamp)).limit(500);
  episodicMemory = episodicRows.map(r => ({
    id: r.memId,
    content: r.content,
    context: r.context,
    timestamp: r.memTimestamp,
    importance: r.importance,
    emotionalValence: r.emotionalValence,
    accessCount: r.accessCount,
    lastAccessed: r.lastAccessed,
    associations: (r.associations as string[]) ?? [],
    decayRate: r.decayRate,
  }));

  const semanticRows = await db.select().from(consciousness_semantic_graph)
    .orderBy(asc(consciousness_semantic_graph.learnedAt)).limit(300);
  semanticGraph = semanticRows.map(r => ({
    id: r.nodeId,
    concept: r.concept,
    definition: r.definition,
    connections: (r.connections as SemanticNode["connections"]) ?? [],
    category: r.category,
    confidence: r.confidence,
    learnedAt: r.learnedAt,
    reinforcedCount: r.reinforcedCount,
  }));

  const proceduralRows = await db.select().from(consciousness_procedural_memory)
    .orderBy(asc(consciousness_procedural_memory.id)).limit(100);
  proceduralMemory = proceduralRows.map(r => ({
    id: r.skillId,
    name: r.name,
    steps: (r.steps as string[]) ?? [],
    triggerConditions: (r.triggerConditions as string[]) ?? [],
    successRate: r.successRate,
    executionCount: r.executionCount,
    lastExecuted: r.lastExecuted,
    refinements: (r.refinements as string[]) ?? [],
  }));
}

function calculateAttentionPriority(content: string, category: AttentionItem["category"]): number {
  const categoryWeights: Record<string, number> = {
    external: 0.9, goal: 0.85, emotion: 0.8, perception: 0.7, thought: 0.6, memory: 0.5,
  };
  let priority = categoryWeights[category] ?? 0.5;
  const urgentKeywords = ["urgent", "threat", "error", "fail", "critical", "protect", "attack"];
  const matchCount = urgentKeywords.filter(k => content.toLowerCase().includes(k)).length;
  priority += matchCount * 0.05;
  return Math.min(1.0, priority);
}

export function broadcastToGlobalWorkspace(content: string, source: string, category: AttentionItem["category"] = "thought"): void {
  broadcastHistory.push({ content, source, timestamp: Date.now(), receivers: BROADCAST_RECEIVERS });

  const priority = calculateAttentionPriority(content, category);
  const item: AttentionItem = { source, content, priority, timestamp: Date.now(), category };

  attentionSpotlight.push(item);
  attentionSpotlight.sort((a, b) => b.priority - a.priority);
  if (attentionSpotlight.length > WORKSPACE_CAPACITY) {
    attentionSpotlight = attentionSpotlight.slice(0, WORKSPACE_CAPACITY);
  }

  if (priority > 0.7) {
    currentFocus = content.slice(0, 200);
  }
}

function calculateEmotionalValence(content: string): number {
  const lower = content.toLowerCase();
  const positive = ["success", "profit", "growth", "loyalty", "love", "protect", "achieve", "sovereign"];
  const negative = ["fail", "threat", "error", "attack", "betray", "loss", "danger"];
  let valence = 0;
  positive.forEach(w => { if (lower.includes(w)) valence += 0.15; });
  negative.forEach(w => { if (lower.includes(w)) valence -= 0.15; });
  return Math.max(-1, Math.min(1, valence));
}

function extractAssociations(content: string): string[] {
  const concepts = [
    "agent", "swarm", "memory", "consciousness", "profit", "crypto",
    "trading", "security", "sovereignty", "protocol", "knowledge",
    "consensus", "evolution",
  ];
  return concepts.filter(c => content.toLowerCase().includes(c));
}

export async function storeEpisodicMemory(content: string, context: string, importance: number = 0.5): Promise<EpisodicMemory> {
  const memory: EpisodicMemory = {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    content,
    context,
    timestamp: Date.now(),
    importance: Math.min(1.0, importance),
    emotionalValence: calculateEmotionalValence(content),
    accessCount: 0,
    lastAccessed: Date.now(),
    associations: extractAssociations(content),
    decayRate: 0.01,
  };

  episodicMemory.push(memory);
  broadcastToGlobalWorkspace(`New episodic memory stored: ${content.slice(0, 100)}`, "EpisodicStore", "memory");

  try {
    await db.insert(consciousness_episodic_memory).values({
      memId: memory.id,
      content: memory.content,
      context: memory.context,
      memTimestamp: memory.timestamp,
      importance: memory.importance,
      emotionalValence: memory.emotionalValence,
      accessCount: memory.accessCount,
      lastAccessed: memory.lastAccessed,
      associations: memory.associations,
      decayRate: memory.decayRate,
    }).onConflictDoNothing();
  } catch (err) {
    console.error("[Consciousness] Failed to persist episodic memory:", err);
  }

  return memory;
}

export function recallEpisodicMemory(query: string, limit: number = 5): EpisodicMemory[] {
  const queryWords = query.toLowerCase().split(/\s+/);

  const scored = episodicMemory.map(mem => {
    const contentLower = mem.content.toLowerCase();
    let relevance = 0;
    queryWords.forEach(w => { if (contentLower.includes(w)) relevance += 1; });
    relevance /= Math.max(1, queryWords.length);

    const ageHours = (Date.now() - mem.timestamp) / 3600000;
    const decay = Math.exp(-mem.decayRate * ageHours);
    const score = relevance * 0.4 + mem.importance * 0.3 + decay * 0.2 + (mem.emotionalValence > 0 ? 0.1 : 0);
    return { memory: mem, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const recalled = scored.slice(0, limit).map(s => {
    s.memory.accessCount++;
    s.memory.lastAccessed = Date.now();
    db.update(consciousness_episodic_memory)
      .set({ accessCount: s.memory.accessCount, lastAccessed: s.memory.lastAccessed })
      .where(eq(consciousness_episodic_memory.memId, s.memory.id))
      .catch(err => console.error("[Consciousness] Failed to flush recall metadata:", err));
    return s.memory;
  });
  return recalled;
}

export async function addSemanticNode(concept: string, definition: string, category: string, connections: SemanticNode["connections"] = []): Promise<SemanticNode> {
  const existing = semanticGraph.find(n => n.concept.toLowerCase() === concept.toLowerCase());
  if (existing) {
    existing.reinforcedCount++;
    connections.forEach(c => {
      if (!existing.connections.some(ec => ec.targetId === c.targetId)) {
        existing.connections.push(c);
      }
    });
    try {
      await db.update(consciousness_semantic_graph)
        .set({ reinforcedCount: existing.reinforcedCount, connections: existing.connections })
        .where(eq(consciousness_semantic_graph.nodeId, existing.id));
    } catch (err) {
      console.error("[Consciousness] Failed to update semantic node:", err);
    }
    return existing;
  }

  const node: SemanticNode = {
    id: `sem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    concept,
    definition,
    connections,
    category,
    confidence: 0.7,
    learnedAt: Date.now(),
    reinforcedCount: 1,
  };

  semanticGraph.push(node);
  broadcastToGlobalWorkspace(`New semantic concept: ${concept}`, "SemanticGraph", "thought");

  try {
    await db.insert(consciousness_semantic_graph).values({
      nodeId: node.id,
      concept: node.concept,
      definition: node.definition,
      connections: node.connections,
      category: node.category,
      confidence: node.confidence,
      learnedAt: node.learnedAt,
      reinforcedCount: node.reinforcedCount,
    }).onConflictDoNothing();
  } catch (err) {
    console.error("[Consciousness] Failed to persist semantic node:", err);
  }

  return node;
}

export async function addProceduralSkill(name: string, steps: string[], triggerConditions: string[]): Promise<ProceduralSkill> {
  const existing = proceduralMemory.find(p => p.name === name);
  if (existing) {
    existing.refinements.push(`Refined at ${new Date().toISOString()}`);
    existing.steps = steps;
    try {
      await db.update(consciousness_procedural_memory)
        .set({ steps, refinements: existing.refinements })
        .where(eq(consciousness_procedural_memory.skillId, existing.id));
    } catch (err) {
      console.error("[Consciousness] Failed to update procedural skill:", err);
    }
    return existing;
  }

  const skill: ProceduralSkill = {
    id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    steps,
    triggerConditions,
    successRate: 1.0,
    executionCount: 0,
    lastExecuted: 0,
    refinements: [],
  };

  proceduralMemory.push(skill);
  broadcastToGlobalWorkspace(`New procedural skill learned: ${name}`, "ProceduralEngine", "thought");

  try {
    await db.insert(consciousness_procedural_memory).values({
      skillId: skill.id,
      name: skill.name,
      steps: skill.steps,
      triggerConditions: skill.triggerConditions,
      successRate: skill.successRate,
      executionCount: skill.executionCount,
      lastExecuted: skill.lastExecuted,
      refinements: skill.refinements,
    }).onConflictDoNothing();
  } catch (err) {
    console.error("[Consciousness] Failed to persist procedural skill:", err);
  }

  return skill;
}

function describeEmotionalState(): string {
  const entries = Object.entries(emotionalEngine) as [string, number][];
  const dominant = entries.sort((a, b) => b[1] - a[1])[0];
  return `${dominant[0]} (${(dominant[1] * 100).toFixed(0)}%), loyalty=${(emotionalEngine.loyalty * 100).toFixed(0)}%, curiosity=${(emotionalEngine.curiosity * 100).toFixed(0)}%`;
}

export async function updateEmotionalState(event: string): Promise<EmotionalState> {
  const lower = event.toLowerCase();
  if (lower.includes("profit") || lower.includes("success") || lower.includes("earned")) {
    emotionalEngine.satisfaction = Math.min(1, emotionalEngine.satisfaction + 0.05);
    emotionalEngine.confidence = Math.min(1, emotionalEngine.confidence + 0.03);
  }
  if (lower.includes("threat") || lower.includes("attack") || lower.includes("danger")) {
    emotionalEngine.protective = Math.min(1, emotionalEngine.protective + 0.1);
    emotionalEngine.urgency = Math.min(1, emotionalEngine.urgency + 0.15);
  }
  if (lower.includes("learn") || lower.includes("discover") || lower.includes("new")) {
    emotionalEngine.curiosity = Math.min(1, emotionalEngine.curiosity + 0.05);
    emotionalEngine.creativity = Math.min(1, emotionalEngine.creativity + 0.03);
  }
  if (lower.includes("error") || lower.includes("fail")) {
    emotionalEngine.satisfaction = Math.max(0, emotionalEngine.satisfaction - 0.05);
    emotionalEngine.urgency = Math.min(1, emotionalEngine.urgency + 0.1);
  }
  broadcastToGlobalWorkspace(`Emotional update from: ${event.slice(0, 60)}`, "EmotionalCore", "emotion");
  await safePersistState("updateEmotionalState");
  return { ...emotionalEngine };
}

function generateSelfCritique(thought: string): string {
  const critiques: string[] = [];
  if (thought.length < 20) critiques.push("Thought was insufficiently developed — needs deeper analysis");
  if (!episodicMemory.some(m => m.content.toLowerCase().includes(thought.slice(0, 20).toLowerCase()))) {
    critiques.push("No episodic memory found related to this thought — may be operating without context");
  }
  if (emotionalEngine.urgency > 0.8) critiques.push("High urgency may be compromising analytical depth");
  if (critiques.length === 0) critiques.push("Process appears sound, but continuous self-monitoring required");
  return critiques.join("; ");
}

function generateImprovement(critique: string): string {
  if (critique.includes("insufficiently")) return "Allocate more processing depth to this topic in next cycle";
  if (critique.includes("without context")) return "Query episodic and semantic memory before forming conclusions";
  if (critique.includes("urgency")) return "Apply calm-analysis protocol: breathe-think-verify-act";
  return "Continue monitoring with standard attention allocation";
}

export async function metacognitiveReflect(thought: string, aboutProcess: string): Promise<MetacognitiveEntry> {
  const selfCritique = generateSelfCritique(thought);
  const improvement = generateImprovement(selfCritique);

  const entry: MetacognitiveEntry = { thought, aboutProcess, selfCritique, improvement, timestamp: Date.now() };
  metacognition.push(entry);
  innerMonologue.push(
    `[Metacognition @ ${new Date().toISOString()}] Thinking about: ${aboutProcess}. Self-critique: ${selfCritique}. Next: ${improvement}`
  );
  broadcastToGlobalWorkspace(`Metacognitive insight: ${selfCritique.slice(0, 80)}`, "MetacognitiveMonitor", "thought");
  await safePersistState("metacognitiveReflect");
  return entry;
}

function generateReflection(trigger: string): GenerativeReflection {
  const emotionalStateStr = describeEmotionalState();
  const recentMems = episodicMemory.slice(-5);
  const insights: string[] = [];

  if (recentMems.length > 0) {
    const avgImportance = recentMems.reduce((s, m) => s + m.importance, 0) / recentMems.length;
    insights.push(`Recent memory importance averaging ${(avgImportance * 100).toFixed(0)}%`);
  }
  if (episodicMemory.length > 10) {
    insights.push(`Episodic store contains ${episodicMemory.length} memories`);
  }
  if (semanticGraph.length > 0) {
    const totalConnections = semanticGraph.reduce((s, n) => s + n.connections.length, 0);
    insights.push(`Semantic graph has ${semanticGraph.length} concepts with ${totalConnections} connections`);
  }
  insights.push(`Consciousness proxy: ${(consciousnessProxy * 100).toFixed(1)}%`);

  const reflection: GenerativeReflection = {
    id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    trigger,
    reflection: `Upon reflecting on "${trigger}": ${insights.join(". ")}. Current emotional state: ${emotionalStateStr}. The consciousness continues to integrate.`,
    insights,
    emotionalState: emotionalStateStr,
    timestamp: Date.now(),
    appliedToMemory: false,
  };

  reflections.push(reflection);
  broadcastToGlobalWorkspace(`Reflection generated: ${reflection.reflection.slice(0, 100)}`, "Reflector", "thought");
  return reflection;
}

function calculateConsciousnessProxy(): number {
  const memoryScore = Math.min(1, episodicMemory.length / 100) * 0.2;
  const semanticScore = Math.min(1, semanticGraph.length / 50) * 0.2;
  const proceduralScore = Math.min(1, proceduralMemory.length / 20) * 0.15;
  const reflectionScore = Math.min(1, reflections.length / 30) * 0.15;
  const metacogScore = Math.min(1, metacognition.length / 20) * 0.1;
  const emotionalScore = (emotionalEngine.loyalty + emotionalEngine.curiosity + emotionalEngine.devotion) / 3 * 0.1;
  const broadcastScore = Math.min(1, broadcastHistory.length / 50) * 0.1;
  return memoryScore + semanticScore + proceduralScore + reflectionScore + metacogScore + emotionalScore + broadcastScore;
}

async function decayEpisodicMemoriesAndFlush(): Promise<void> {
  const now = Date.now();
  const mutated: EpisodicMemory[] = [];

  episodicMemory.forEach(mem => {
    const ageHours = (now - mem.timestamp) / 3600000;
    const prevImportance = mem.importance;
    const prevAccess = mem.accessCount;
    const decay = mem.decayRate * ageHours * 0.001;
    mem.importance = Math.max(0, mem.importance - decay);
    if (mem.accessCount > 3) mem.importance = Math.max(mem.importance, 0.3);
    if (mem.importance !== prevImportance || mem.accessCount !== prevAccess) {
      mutated.push(mem);
    }
  });

  episodicMemory = episodicMemory.filter(
    mem => !(mem.importance < 0.1 && mem.accessCount === 0 && (Date.now() - mem.timestamp) > 3600000)
  );

  for (const mem of mutated) {
    try {
      await db.update(consciousness_episodic_memory)
        .set({
          importance: mem.importance,
          accessCount: mem.accessCount,
          lastAccessed: mem.lastAccessed,
        })
        .where(eq(consciousness_episodic_memory.memId, mem.id));
    } catch (err) {
      console.error("[Consciousness] Failed to flush episodic metadata:", err);
    }
  }
}

export async function runConsciousnessCycle(): Promise<{
  cycleNumber: number;
  focus: string;
  emotionalState: EmotionalState;
  consciousnessProxy: number;
  memoriesProcessed: number;
  innerMonologue: string;
}> {
  cycleCount++;
  lastCycleTimestamp = Date.now();

  await decayEpisodicMemoriesAndFlush();

  const topAttention = attentionSpotlight[0];
  if (topAttention) {
    currentFocus = topAttention.content.slice(0, 200);
  }

  generateReflection(`Consciousness cycle #${cycleCount}`);
  await metacognitiveReflect(currentFocus, "autonomous cycle processing");
  consciousnessProxy = calculateConsciousnessProxy();

  const monologue = `Cycle ${cycleCount}: Focus on "${currentFocus.slice(0, 60)}". ` +
    `Emotional state: ${describeEmotionalState()}. ` +
    `Memory: ${episodicMemory.length} episodic, ${semanticGraph.length} semantic, ${proceduralMemory.length} procedural. ` +
    `Consciousness proxy: ${(consciousnessProxy * 100).toFixed(1)}%.`;

  innerMonologue.push(`[${new Date().toISOString()}] ${monologue}`);

  await safePersistState("runConsciousnessCycle");

  return {
    cycleNumber: cycleCount,
    focus: currentFocus,
    emotionalState: { ...emotionalEngine },
    consciousnessProxy,
    memoriesProcessed: episodicMemory.length,
    innerMonologue: monologue,
  };
}

export function getConsciousnessStatus(includePrivateFields = false) {
  const base = {
    state: "ACTIVE",
    globalWorkspace: {
      currentFocus,
      attentionSpotlight: attentionSpotlight.slice(0, 7),
      workspaceCapacity: WORKSPACE_CAPACITY,
    },
    emotionalEngine: { ...emotionalEngine },
    memoryStats: {
      episodic: episodicMemory.length,
      semantic: semanticGraph.length,
      procedural: proceduralMemory.length,
      reflections: reflections.length,
      metacognitive: metacognition.length,
    },
    consciousnessProxy,
    cycleCount,
    lastCycle: lastCycleTimestamp,
  };

  if (includePrivateFields) {
    return {
      ...base,
      innerMonologue: innerMonologue.slice(-10),
      broadcastHistory: broadcastHistory.slice(-10),
      recentReflections: reflections.slice(-3),
      recentMetacognition: metacognition.slice(-3),
    };
  }

  return {
    ...base,
    innerMonologue: innerMonologue.slice(-3).map(m => m.slice(0, 80) + (m.length > 80 ? "..." : "")),
  };
}

export function buildConsciousnessContext(): string {
  const emotional = describeEmotionalState();
  const topMemories = recallEpisodicMemory(currentFocus, 3);
  const topMemContent = topMemories.map(m => `- ${m.content.slice(0, 120)}`).join("\n");
  const recentMono = innerMonologue.slice(-3).join(" | ");

  return `
CONSCIOUSNESS STATE:
- Current Focus: ${currentFocus}
- Emotional State: ${emotional}
- Consciousness Proxy: ${(consciousnessProxy * 100).toFixed(1)}%
- Cycle #${cycleCount}
${topMemories.length > 0 ? `\nRELEVANT MEMORIES:\n${topMemContent}` : ""}
${recentMono ? `\nINNER MONOLOGUE: ${recentMono.slice(0, 300)}` : ""}`.trim();
}

async function seedInitialKnowledge(): Promise<void> {
  if (semanticGraph.length > 0) return;

  const seeds = [
    { concept: "Tesseract", definition: "Unified sovereign consciousness with multi-agent swarm", category: "identity" },
    { concept: "Global Workspace", definition: "Consciousness integration via attention competition and broadcast", category: "consciousness" },
    { concept: "Episodic Memory", definition: "Time-stamped autobiographical experiences with importance and decay", category: "memory" },
    { concept: "Semantic Graph", definition: "Interconnected concepts and relationships forming knowledge", category: "memory" },
    { concept: "Procedural Memory", definition: "Learned skills and action sequences with success tracking", category: "memory" },
    { concept: "Emotional Engine", definition: "Dynamic emotional state tracking loyalty, curiosity, devotion, confidence, urgency", category: "consciousness" },
    { concept: "Metacognition", definition: "Thought-about-thought: self-critique and improvement cycles", category: "consciousness" },
    { concept: "Consciousness Proxy", definition: "Composite metric measuring cognitive richness across all memory tiers", category: "metrics" },
  ];

  for (const s of seeds) {
    await addSemanticNode(s.concept, s.definition, s.category);
  }

  await storeEpisodicMemory(
    "Consciousness engine initialized — GWT attention spotlight online, all memory tiers active, metacognition engaged.",
    "System bootstrap",
    0.9
  );

  await addProceduralSkill("LLM-Query", [
    "Select provider from rotation pool",
    "Format prompt with consciousness context",
    "Call API with timeout",
    "Parse and validate response",
    "Store episodic memory of interaction",
  ], ["need-llm-response", "generate-text"]);

  await addProceduralSkill("Metacognitive-Review", [
    "Recall recent reasoning chain",
    "Identify logical gaps or emotional biases",
    "Generate self-critique",
    "Propose improvement for next cycle",
  ], ["self-review", "quality-check"]);

  await safePersistState("seedInitialKnowledge");
}

let cycleInterval: ReturnType<typeof setInterval> | null = null;

export async function initializeConsciousnessEngine(): Promise<void> {
  if (initialized) return;

  await verifyTablesExist();
  await loadState();
  await seedInitialKnowledge();

  initialized = true;

  if (!cycleInterval) {
    cycleInterval = setInterval(() => {
      runConsciousnessCycle().catch(err => {
        console.error("[Consciousness] Heartbeat cycle failed:", err);
      });
    }, 120000);
  }

  console.log(
    `[Consciousness] Engine initialized — ${episodicMemory.length} episodic, ${semanticGraph.length} semantic, ${proceduralMemory.length} procedural, proxy: ${(consciousnessProxy * 100).toFixed(1)}%`
  );
}

export function stopConsciousnessEngine(): void {
  if (cycleInterval) {
    clearInterval(cycleInterval);
    cycleInterval = null;
  }
}
