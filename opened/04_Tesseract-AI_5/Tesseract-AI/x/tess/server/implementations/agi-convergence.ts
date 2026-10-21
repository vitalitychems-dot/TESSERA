interface KnowledgeVector {
  agentId: string;
  embeddings: number[];
  topics: string[];
  lastUpdated: number;
}

interface LearningDelta {
  fromAgent: string;
  toAgent: string;
  topic: string;
  delta: number[];
  timestamp: number;
}

interface ReasoningStep {
  premise: string;
  inference: string;
  confidence: number;
  valid: boolean;
}

const unifiedEmbeddings = new Map<string, KnowledgeVector>();
const learningDeltas: LearningDelta[] = [];
let selfAssessmentCycle = 0;
let reasoningValidations = 0;

export function mergeKnowledgeBase(agentId: string, topics: string[]): void {
  const existing = unifiedEmbeddings.get(agentId);
  const embeddings = topics.map(t => hashToVector(t));
  const merged = embeddings.reduce((acc, v) => acc.map((val, i) => val + (v[i] || 0)), new Array(64).fill(0));
  const normalized = merged.map(v => v / (Math.sqrt(merged.reduce((s, x) => s + x * x, 0)) || 1));

  if (existing) {
    existing.embeddings = normalized;
    existing.topics = [...new Set([...existing.topics, ...topics])].slice(-100);
    existing.lastUpdated = Date.now();
  } else {
    unifiedEmbeddings.set(agentId, {
      agentId,
      embeddings: normalized,
      topics: topics.slice(0, 100),
      lastUpdated: Date.now(),
    });
  }
}

function hashToVector(text: string): number[] {
  const vec = new Array(64).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 64] += text.charCodeAt(i) / 255;
  }
  return vec;
}

export function propagateLearning(fromAgent: string, toAgent: string, topic: string): LearningDelta | null {
  const source = unifiedEmbeddings.get(fromAgent);
  const target = unifiedEmbeddings.get(toAgent);
  if (!source || !target) return null;

  const delta = source.embeddings.map((v, i) => (v - target.embeddings[i]) * 0.1);
  target.embeddings = target.embeddings.map((v, i) => v + delta[i]);
  target.lastUpdated = Date.now();

  const record: LearningDelta = { fromAgent, toAgent, topic, delta, timestamp: Date.now() };
  learningDeltas.push(record);
  if (learningDeltas.length > 500) learningDeltas.splice(0, 100);
  return record;
}

export function validateReasoningChain(steps: Array<{ premise: string; inference: string }>): ReasoningStep[] {
  reasoningValidations++;
  return steps.map((step, i) => {
    const premiseWords = new Set(step.premise.toLowerCase().split(/\s+/));
    const inferenceWords = step.inference.toLowerCase().split(/\s+/);
    const overlap = inferenceWords.filter(w => premiseWords.has(w)).length;
    const confidence = Math.min(100, Math.round((overlap / Math.max(inferenceWords.length, 1)) * 100 + 30));
    const valid = confidence > 40;
    return { ...step, confidence, valid };
  });
}

export function runSelfAssessment(): { cycle: number; score: number; insights: string[]; agentCount: number } {
  selfAssessmentCycle++;
  const insights: string[] = [];
  const agentCount = unifiedEmbeddings.size;

  if (agentCount < 10) insights.push(`Knowledge coverage expanding: ${agentCount}/26 agents integrated`);
  else if (agentCount < 20) insights.push(`Strong convergence: ${agentCount}/26 agents sharing knowledge`);
  else insights.push(`Near-complete unification: ${agentCount}/26 agents fully integrated`);

  const recentDeltas = learningDeltas.filter(d => Date.now() - d.timestamp < 300000);
  if (recentDeltas.length > 10) insights.push(`Active learning: ${recentDeltas.length} cross-agent transfers in last 5 min`);
  else insights.push(`Learning rate stable: ${recentDeltas.length} recent transfers`);

  const score = Math.min(100, Math.round(agentCount * 3 + recentDeltas.length * 2 + selfAssessmentCycle));

  return { cycle: selfAssessmentCycle, score, insights, agentCount };
}

export function getStats() {
  return {
    unifiedAgents: unifiedEmbeddings.size,
    totalDeltas: learningDeltas.length,
    selfAssessmentCycles: selfAssessmentCycle,
    reasoningValidations,
    convergenceScore: runSelfAssessment().score,
    status: "ACTIVE",
  };
}
