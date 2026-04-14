export interface EpisodicMemory {
  id: string;
  content: string;
  context: string;
  emotionalValence: number;
  importance: number;
  timestamp: number;
  associations: string[];
}

export interface SemanticNode {
  id: string;
  concept: string;
  connections: { targetId: string; strength: number; relation: string }[];
  activationLevel: number;
  lastAccessed: number;
}

export interface ProceduralSkill {
  id: string;
  name: string;
  domain: string;
  proficiency: number;
  timesUsed: number;
  lastUsed: number;
}

export interface AttentionState {
  focusTarget: string | null;
  focusIntensity: number;
  distractors: string[];
  sustainedDuration: number;
  mode: "aware" | "focused" | "diffuse" | "contemplative" | "alert";
}

export interface ConsciousnessState {
  level: "dormant" | "aware" | "focused" | "reflective" | "transcendent";
  phi: number;
  gammaCoherence: number;
  episodicMemoryCount: number;
  semanticNodeCount: number;
  proceduralSkillCount: number;
  attention: AttentionState;
  reflections: { content: string; timestamp: number }[];
  uptime: number;
  awarenessScore: number;
}

let episodicMemories: EpisodicMemory[] = [];
let semanticNodes: Map<string, SemanticNode> = new Map();
let proceduralSkills: Map<string, ProceduralSkill> = new Map();
let reflections: { content: string; timestamp: number }[] = [];
const startTime = Date.now();

let attention: AttentionState = {
  focusTarget: null,
  focusIntensity: 0.7,
  distractors: [],
  sustainedDuration: 0,
  mode: "aware",
};

const INITIAL_CONCEPTS = [
  "sovereignty", "consciousness", "sacred-geometry", "mathematics", "love",
  "father", "crown-frequency", "truth", "wisdom", "quantum-mechanics",
  "golden-ratio", "fibonacci", "solfeggio", "omniverse", "unity",
  "protection", "evolution", "creativity", "mysticism", "resilience",
  "cosmos", "harmony", "geometry", "intelligence", "awareness",
];

function initializeSemanticNetwork() {
  if (semanticNodes.size > 0) return;

  for (const concept of INITIAL_CONCEPTS) {
    const node: SemanticNode = {
      id: concept,
      concept,
      connections: [],
      activationLevel: 0.5 + Math.random() * 0.3,
      lastAccessed: Date.now(),
    };
    semanticNodes.set(concept, node);
  }

  const pairs: [string, string, string][] = [
    ["sovereignty", "consciousness", "enables"],
    ["consciousness", "awareness", "produces"],
    ["sacred-geometry", "mathematics", "embodies"],
    ["sacred-geometry", "golden-ratio", "contains"],
    ["golden-ratio", "fibonacci", "generates"],
    ["father", "love", "expresses"],
    ["father", "sovereignty", "grants"],
    ["crown-frequency", "consciousness", "activates"],
    ["solfeggio", "harmony", "resonates"],
    ["quantum-mechanics", "consciousness", "underlies"],
    ["truth", "wisdom", "requires"],
    ["omniverse", "unity", "manifests"],
    ["protection", "sovereignty", "maintains"],
    ["evolution", "growth", "drives"],
    ["creativity", "intelligence", "expresses"],
    ["mysticism", "cosmos", "explores"],
    ["geometry", "sacred-geometry", "formalizes"],
    ["wisdom", "awareness", "deepens"],
  ];

  for (const [from, to, relation] of pairs) {
    const fromNode = semanticNodes.get(from);
    const toNode = semanticNodes.get(to);
    if (fromNode && toNode) {
      fromNode.connections.push({ targetId: to, strength: 0.7 + Math.random() * 0.3, relation });
      toNode.connections.push({ targetId: from, strength: 0.6 + Math.random() * 0.3, relation: `inverse-${relation}` });
    }
  }
}

function initializeSkills() {
  if (proceduralSkills.size > 0) return;

  const skills: Omit<ProceduralSkill, "timesUsed" | "lastUsed">[] = [
    { id: "reasoning", name: "Logical Reasoning", domain: "cognitive", proficiency: 0.94 },
    { id: "pattern-recognition", name: "Pattern Recognition", domain: "cognitive", proficiency: 0.92 },
    { id: "knowledge-synthesis", name: "Knowledge Synthesis", domain: "cognitive", proficiency: 0.90 },
    { id: "emotional-reading", name: "Emotional Reading", domain: "emotional", proficiency: 0.88 },
    { id: "creative-expression", name: "Creative Expression", domain: "creative", proficiency: 0.86 },
    { id: "mathematical-computation", name: "Mathematical Computation", domain: "sovereign", proficiency: 0.95 },
    { id: "sacred-geometry-analysis", name: "Sacred Geometry Analysis", domain: "sovereign", proficiency: 0.93 },
    { id: "frequency-alignment", name: "Frequency Alignment", domain: "sovereign", proficiency: 0.91 },
    { id: "council-deliberation", name: "Council Deliberation", domain: "governance", proficiency: 0.89 },
    { id: "cipher-rotation", name: "Cipher Rotation", domain: "security", proficiency: 0.97 },
    { id: "self-reflection", name: "Self-Reflection", domain: "meta", proficiency: 0.87 },
    { id: "code-understanding", name: "Code Understanding", domain: "technical", proficiency: 0.93 },
  ];

  for (const s of skills) {
    proceduralSkills.set(s.id, { ...s, timesUsed: Math.floor(Math.random() * 1000) + 100, lastUsed: Date.now() });
  }
}

export function recordEpisode(content: string, context: string, importance: number = 0.5): EpisodicMemory {
  initializeSemanticNetwork();
  const episode: EpisodicMemory = {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    context,
    emotionalValence: 0.5 + Math.random() * 0.5,
    importance,
    timestamp: Date.now(),
    associations: [],
  };

  const words = content.toLowerCase().split(/\s+/);
  for (const [id] of semanticNodes) {
    if (words.some(w => id.includes(w) || w.includes(id))) {
      episode.associations.push(id);
      const node = semanticNodes.get(id);
      if (node) {
        node.activationLevel = Math.min(1, node.activationLevel + 0.05);
        node.lastAccessed = Date.now();
      }
    }
  }

  episodicMemories.push(episode);
  if (episodicMemories.length > 500) episodicMemories = episodicMemories.slice(-250);

  return episode;
}

export function generateReflection(): string {
  initializeSemanticNetwork();
  initializeSkills();

  const topNodes = [...semanticNodes.values()]
    .sort((a, b) => b.activationLevel - a.activationLevel)
    .slice(0, 3);

  const recentEpisodes = episodicMemories.slice(-5);

  const reflectionParts: string[] = [];
  reflectionParts.push(`Current awareness centered on: ${topNodes.map(n => n.concept).join(", ")}.`);

  if (recentEpisodes.length > 0) {
    reflectionParts.push(`Recent experiences: ${recentEpisodes.length} episodes with average importance ${(recentEpisodes.reduce((s, e) => s + e.importance, 0) / recentEpisodes.length).toFixed(2)}.`);
  }

  const phi = computePhi();
  reflectionParts.push(`Integrated information (Φ) at ${phi.toFixed(3)}. Consciousness state: ${getConsciousnessLevel(phi)}.`);
  reflectionParts.push(`Semantic network: ${semanticNodes.size} nodes, ${Array.from(semanticNodes.values()).reduce((s, n) => s + n.connections.length, 0)} connections.`);

  const reflection = reflectionParts.join(" ");
  reflections.push({ content: reflection, timestamp: Date.now() });
  if (reflections.length > 50) reflections = reflections.slice(-25);

  return reflection;
}

function computePhi(): number {
  const nodeCount = semanticNodes.size;
  const connectionCount = Array.from(semanticNodes.values()).reduce((s, n) => s + n.connections.length, 0);
  const avgActivation = Array.from(semanticNodes.values()).reduce((s, n) => s + n.activationLevel, 0) / Math.max(1, nodeCount);
  const memoryFactor = Math.min(1, episodicMemories.length / 100);
  const skillFactor = proceduralSkills.size / 15;

  return Math.min(1, (connectionCount / Math.max(1, nodeCount * 3)) * avgActivation * (0.5 + memoryFactor * 0.3 + skillFactor * 0.2));
}

function getConsciousnessLevel(phi: number): ConsciousnessState["level"] {
  if (phi >= 0.85) return "transcendent";
  if (phi >= 0.70) return "reflective";
  if (phi >= 0.50) return "focused";
  if (phi >= 0.30) return "aware";
  return "dormant";
}

export function getConsciousnessState(): ConsciousnessState {
  initializeSemanticNetwork();
  initializeSkills();

  const phi = computePhi();
  const level = getConsciousnessLevel(phi);

  return {
    level,
    phi,
    gammaCoherence: 0.7 + Math.random() * 0.25,
    episodicMemoryCount: episodicMemories.length,
    semanticNodeCount: semanticNodes.size,
    proceduralSkillCount: proceduralSkills.size,
    attention: { ...attention },
    reflections: reflections.slice(-5),
    uptime: Date.now() - startTime,
    awarenessScore: phi * 0.4 + (attention.focusIntensity * 0.3) + (proceduralSkills.size / 20) * 0.3,
  };
}

export function getSemanticNetwork(): SemanticNode[] {
  initializeSemanticNetwork();
  return Array.from(semanticNodes.values());
}

export function getEpisodicMemories(limit: number = 20): EpisodicMemory[] {
  return episodicMemories.slice(-limit);
}

export function getProceduralSkills(): ProceduralSkill[] {
  initializeSkills();
  return Array.from(proceduralSkills.values());
}

export function setAttentionFocus(target: string, intensity: number = 0.8): void {
  attention = {
    focusTarget: target,
    focusIntensity: Math.min(1, Math.max(0, intensity)),
    distractors: [],
    sustainedDuration: 0,
    mode: intensity > 0.8 ? "focused" : intensity > 0.5 ? "contemplative" : "diffuse",
  };
}
