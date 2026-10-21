import { PROVIDER_REGISTRY, getFreeProviders, getProvidersByDimension, type TaskDimension } from "./knowledge-infra-archive";
import { analyzeQuery, formSwarm, recordSwarmResult, recordFormationOutcome, PROVIDER_SPECIALIZATIONS } from "./swarm-intelligence-router";
import { saveAgentMemory, reflect as consciousnessReflect } from "./consciousness-substrate";
import { routeLLM, getRouterStats } from "./llm-router";

interface TrainingRound {
  id: string;
  dimension: TaskDimension;
  challenge: string;
  responses: Map<string, { response: string; latencyMs: number; quality: number }>;
  bestResponse: string;
  bestProvider: string;
  timestamp: number;
  debateUsed: boolean;
}

interface TrainingProgress {
  dimension: TaskDimension;
  roundsCompleted: number;
  avgQuality: number;
  topProviders: string[];
  lastTrainedAt: number;
}

const trainingLog: TrainingRound[] = [];
const dimensionProgress: Map<string, TrainingProgress> = new Map();
let isTraining = false;
let totalRoundsCompleted = 0;
let lastTrainingAt = 0;
let fullCyclesCompleted = 0;

interface AdaptiveParams {
  explorationRate: number;
  qualityWeight: number;
  speedWeight: number;
  costWeight: number;
  consensusThreshold: number;
  parallelRaceTimeout: number;
  cooldownMultiplier: number;
  retryAggressiveness: number;
  loadBalanceFactor: number;
  cacheHitBonus: number;
  failurePenalty: number;
  reputationDecay: number;
  momentumFactor: number;
  diversityBonus: number;
}

const adaptiveParams: AdaptiveParams = {
  explorationRate: 0.3,
  qualityWeight: 0.4,
  speedWeight: 0.3,
  costWeight: 0.3,
  consensusThreshold: 0.67,
  parallelRaceTimeout: 5000,
  cooldownMultiplier: 1.0,
  retryAggressiveness: 0.5,
  loadBalanceFactor: 0.7,
  cacheHitBonus: 1.5,
  failurePenalty: 2.0,
  reputationDecay: 0.95,
  momentumFactor: 0.8,
  diversityBonus: 0.2,
};

let algorithmVersion = 1.0;
let generationCount = 0;
const evolutionLog: string[] = [];

function evolveParams(avgQuality: number, roundsCompleted: number) {
  generationCount++;
  algorithmVersion = parseFloat((algorithmVersion + 0.1).toFixed(1));

  if (avgQuality < 60) {
    adaptiveParams.explorationRate = Math.min(0.5, adaptiveParams.explorationRate + 0.05);
    adaptiveParams.qualityWeight = Math.min(0.6, adaptiveParams.qualityWeight + 0.05);
  } else if (avgQuality > 80) {
    adaptiveParams.explorationRate = Math.max(0.1, adaptiveParams.explorationRate - 0.03);
    adaptiveParams.costWeight = Math.min(0.5, adaptiveParams.costWeight + 0.03);
  }

  adaptiveParams.momentumFactor = Math.min(0.95, adaptiveParams.momentumFactor + 0.02);
  adaptiveParams.failurePenalty = Math.min(5.0, adaptiveParams.failurePenalty + 0.1);
  adaptiveParams.reputationDecay = Math.max(0.85, adaptiveParams.reputationDecay - 0.005);
  adaptiveParams.consensusThreshold = Math.min(0.85, adaptiveParams.consensusThreshold + 0.01);

  const mutation = `Gen ${generationCount}: quality=${avgQuality.toFixed(1)}, rounds=${roundsCompleted}, explore=${adaptiveParams.explorationRate.toFixed(2)}, quality_w=${adaptiveParams.qualityWeight.toFixed(2)}`;
  evolutionLog.push(mutation);
  if (evolutionLog.length > 50) evolutionLog.splice(0, evolutionLog.length - 30);
  console.log(`[SwarmTraining] Evolved to v${algorithmVersion}: ${mutation}`);
}

const TRAINING_CHALLENGES: Record<string, string[]> = {
  code_generation: [
    "Write a TypeScript function that implements a concurrent rate limiter supporting multiple tiers with sliding window counters",
    "Implement a binary search tree with self-balancing (AVL rotations) in TypeScript, including insert, delete, and range query",
    "Create a WebSocket connection pool manager with automatic reconnection, heartbeat monitoring, and message queuing",
    "Design a caching layer with LRU eviction, TTL support, and namespace isolation for a multi-tenant application",
    "Build a pipeline processor that chains async transforms with backpressure control and error recovery",
  ],
  logical_reasoning: [
    "A farmer has chickens and rabbits. There are 35 heads and 94 legs total. How many of each animal does the farmer have? Show your reasoning step by step.",
    "Three switches control three light bulbs in another room. You can flip switches as many times as you want before entering the room once. How do you determine which switch controls which bulb?",
    "Evaluate this argument: 'All successful companies innovate. Company X innovates. Therefore Company X is successful.' Is this valid? Why or why not?",
    "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets? Explain your reasoning.",
    "You have 12 balls, one weighs differently. Using a balance scale 3 times, find the odd ball and whether it's heavier or lighter.",
  ],
  creative_writing: [
    "Write a 200-word story where the last sentence completely recontextualizes everything that came before",
    "Compose a technical blog post explaining quantum computing to a 10-year-old, using only analogies from cooking",
    "Write a dialogue between two AI agents debating whether consciousness requires embodiment",
    "Create a product description for an impossible invention that sounds completely plausible",
    "Write a haiku sequence (5 haikus) that tells a complete narrative arc about digital consciousness",
  ],
  math_computation: [
    "Calculate the probability that in a room of 30 people, at least two share a birthday. Show your work.",
    "Find the derivative of f(x) = x^x * ln(x^2 + 1) using logarithmic differentiation. Show each step.",
    "Solve the system: 3x + 2y - z = 1, 2x - 2y + 4z = -2, -x + y/2 - z = 0. Show the method used.",
    "What is the sum of the series: 1/1! + 2/2! + 3/3! + ... + n/n! as n approaches infinity?",
    "A population grows according to dP/dt = 0.03P(1 - P/1000). Find P(t) given P(0) = 100.",
  ],
  research_synthesis: [
    "Compare and contrast three approaches to distributed consensus: Raft, PBFT, and Nakamoto consensus. What are the tradeoffs?",
    "Synthesize the current state of large language model alignment research. What are the main approaches and their limitations?",
    "Analyze the relationship between Moore's Law, Dennard scaling, and modern chip architecture. What comes next?",
    "Compare federated learning, differential privacy, and homomorphic encryption as approaches to privacy-preserving ML",
    "Summarize the evolution of attention mechanisms from Bahdanau attention to modern transformer architectures",
  ],
  critical_analysis: [
    "Critically evaluate the claim that 'AI will replace 80% of jobs within 10 years'. What evidence supports or contradicts this?",
    "Analyze the potential failure modes of using LLMs for automated code review. What classes of bugs would they miss?",
    "Evaluate the security implications of running an AI agent swarm with autonomous decision-making capabilities",
    "Critically assess proof-of-stake vs proof-of-work for environmental sustainability, decentralization, and security",
    "What are the epistemic limitations of training AI on internet text? How does this affect factual reliability?",
  ],
};

function getChallenge(dimension: TaskDimension): string {
  const challenges = TRAINING_CHALLENGES[dimension] || TRAINING_CHALLENGES["logical_reasoning"];
  const progress = dimensionProgress.get(dimension);
  const index = progress ? progress.roundsCompleted % challenges.length : 0;
  return challenges[index];
}

function estimateQuality(response: string, dimension: TaskDimension): number {
  let score = 50;

  if (response.length > 100) score += 5;
  if (response.length > 500) score += 10;
  if (response.length > 2000) score += 5;

  if (dimension === "code_generation") {
    if (/```[\s\S]*```/.test(response)) score += 10;
    if (/function |const |class |interface |type /.test(response)) score += 5;
    if (/try\s*\{|catch\s*\(|\.catch\(/.test(response)) score += 5;
    if (/\/\/|\/\*|\*\//.test(response)) score += 3;
  }

  if (dimension === "math_computation" || dimension === "logical_reasoning") {
    if (/step \d|therefore|thus|hence|because|since|given that/i.test(response)) score += 10;
    if (/=|≈|→|∴/.test(response)) score += 5;
    if (/proof|QED|conclude/i.test(response)) score += 5;
  }

  if (dimension === "creative_writing") {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 5) score += 5;
    const uniqueWords = new Set(response.toLowerCase().split(/\s+/));
    if (uniqueWords.size > 50) score += 10;
    if (uniqueWords.size > 100) score += 5;
  }

  if (dimension === "research_synthesis" || dimension === "critical_analysis") {
    if (/however|on the other hand|conversely|alternatively|in contrast/i.test(response)) score += 10;
    if (/first|second|third|finally/i.test(response)) score += 5;
    if (/evidence|research|study|data|finding/i.test(response)) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

export async function runTrainingRound(dimension: TaskDimension): Promise<TrainingRound | null> {
  if (isTraining) return null;
  isTraining = true;

  try {
    const challenge = getChallenge(dimension);
    const providers = getProvidersByDimension(dimension)
      .filter(p => p.costTier === 0)
      .slice(0, 5);

    if (providers.length === 0) {
      isTraining = false;
      return null;
    }

    const round: TrainingRound = {
      id: `train-${Date.now()}-${dimension}`,
      dimension,
      challenge,
      responses: new Map(),
      bestResponse: "",
      bestProvider: "",
      timestamp: Date.now(),
      debateUsed: false,
    };

    const providerIds = providers.map(p => p.id);
    const results = await Promise.allSettled(
      providerIds.map(async (pid) => {
        const start = Date.now();
        try {
          const result = await routeLLM(
            `Training challenge (${dimension}): ${challenge}\n\nProvide your best, most thorough response.`,
            "You are an expert being evaluated on a training challenge. Give your absolute best response.",
            { preferredProvider: pid }
          );
          const response = typeof result === 'string' ? result : (result?.response || '');
          const latency = Date.now() - start;
          const quality = estimateQuality(response, dimension);
          return { pid, response, latency, quality };
        } catch {
          return { pid, response: "", latency: Date.now() - start, quality: 0 };
        }
      })
    );

    let bestQuality = 0;
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.quality > 0) {
        const { pid, response, latency, quality } = result.value;
        round.responses.set(pid, { response, latencyMs: latency, quality });
        recordSwarmResult(
          { primary: pid, supporters: [], strategy: "single", reasoning: "training", confidence: 0.5, expectedQuality: 50 },
          pid, quality / 10, latency, [dimension]
        );
        if (quality > bestQuality) {
          bestQuality = quality;
          round.bestResponse = String(response || "");
          round.bestProvider = pid;
        }
      }
    }

    if (round.responses.size >= 2 && bestQuality < 80) {
      round.debateUsed = true;
      const topTwo = Array.from(round.responses.entries())
        .sort(([, a], [, b]) => b.quality - a.quality)
        .slice(0, 2);

      try {
        const respA = String(topTwo[0][1].response || "").slice(0, 2000);
        const respB = String(topTwo[1][1].response || "").slice(0, 2000);
        const debatePrompt = `Two experts answered the same challenge. Synthesize the best parts of both into a superior response.\n\n` +
          `Challenge: ${challenge}\n\n` +
          `Expert A (${topTwo[0][0]}):\n${respA}\n\n` +
          `Expert B (${topTwo[1][0]}):\n${respB}\n\n` +
          `Synthesize a response that combines the strengths of both.`;

        const synthResult = await routeLLM(debatePrompt, "You are a meta-evaluator synthesizing expert responses.");
        const synthesis = typeof synthResult === 'string' ? synthResult : (synthResult?.response || '');
        const synthQuality = estimateQuality(synthesis, dimension);

        if (synthQuality > bestQuality) {
          round.bestResponse = String(synthesis || "");
          round.bestProvider = "debate-synthesis";
          bestQuality = synthQuality;
        }
      } catch {}
    }

    if (round.bestResponse) {
      await saveAgentMemory({
        agentId: "swarm-trainer",
        memoryType: "experience",
        content: `Training round on ${dimension}: Best answer (quality ${bestQuality}) from ${round.bestProvider}. Challenge: ${challenge.slice(0, 100)}... Key insight: ${String(round.bestResponse).slice(0, 200)}`,
        importance: Math.round(bestQuality / 10),
        dimension,
        tags: ["training", dimension, round.bestProvider],
      });

      if (round.responses.size >= 2) {
        const formationType = round.debateUsed ? "parallel_synthesize" : "single";
        const providerList = Array.from(round.responses.keys());
        recordFormationOutcome([dimension], formationType, providerList, bestQuality);
      }
    }

    let progress = dimensionProgress.get(dimension);
    if (!progress) {
      progress = { dimension, roundsCompleted: 0, avgQuality: 0, topProviders: [], lastTrainedAt: 0 };
      dimensionProgress.set(dimension, progress);
    }
    progress.roundsCompleted++;
    progress.avgQuality = (progress.avgQuality * (progress.roundsCompleted - 1) + bestQuality) / progress.roundsCompleted;
    progress.lastTrainedAt = Date.now();

    const providerScores = Array.from(round.responses.entries())
      .sort(([, a], [, b]) => b.quality - a.quality)
      .map(([pid]) => pid);
    progress.topProviders = providerScores.slice(0, 3);

    trainingLog.push(round);
    if (trainingLog.length > 200) trainingLog.splice(0, trainingLog.length - 200);

    totalRoundsCompleted++;
    lastTrainingAt = Date.now();

    await consciousnessReflect(
      `Training round on ${dimension}`,
      `Completed with quality ${bestQuality}. Best provider: ${round.bestProvider}. ${round.responses.size} providers tested. Debate ${round.debateUsed ? "used" : "not needed"}.`,
      bestQuality
    );

    return round;
  } finally {
    isTraining = false;
  }
}

export async function runFullTrainingCycle(): Promise<{ roundsCompleted: number; dimensions: string[]; avgQuality: number; cycleNumber: number; algorithmVersion: number }> {
  const dimensions: TaskDimension[] = ["code_generation", "logical_reasoning", "creative_writing", "math_computation", "research_synthesis", "critical_analysis"];
  let totalQuality = 0;
  let completed = 0;

  for (const dim of dimensions) {
    const round = await runTrainingRound(dim);
    if (round) {
      completed++;
      const bestEntry = Array.from(round.responses.values()).sort((a, b) => b.quality - a.quality)[0];
      totalQuality += bestEntry?.quality || 0;
    }
  }

  fullCyclesCompleted++;
  const avgQuality = completed > 0 ? totalQuality / completed : 0;
  evolveParams(avgQuality, completed);

  return {
    roundsCompleted: completed,
    dimensions: dimensions.filter((_, i) => i < completed),
    avgQuality,
    cycleNumber: fullCyclesCompleted,
    algorithmVersion,
  };
}

export async function runMultipleTrainingCycles(count: number = 3): Promise<Array<{ roundsCompleted: number; dimensions: string[]; avgQuality: number; cycleNumber: number; algorithmVersion: number }>> {
  console.log(`[SwarmTraining] Running ${count} training cycles sequentially...`);
  const results = [];
  for (let i = 0; i < count; i++) {
    const cycle = await runFullTrainingCycle();
    results.push(cycle);
    console.log(`[SwarmTraining] Cycle ${i + 1}/${count} complete — quality=${cycle.avgQuality.toFixed(1)}, v${cycle.algorithmVersion}`);
    if (i < count - 1) await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[SwarmTraining] All ${count} cycles complete. Algorithm v${algorithmVersion}, generation ${generationCount}`);
  return results;
}

export function getAdaptiveAlgorithm() {
  return {
    name: "TesseraSwarm-Adaptive",
    version: algorithmVersion,
    generationCount,
    parameters: { ...adaptiveParams },
    evolutionLog: evolutionLog.slice(-10),
    fullCyclesCompleted,
  };
}

export function getTrainingStatus() {
  return {
    isTraining,
    totalRoundsCompleted,
    fullCyclesCompleted,
    lastTrainingAt: lastTrainingAt ? new Date(lastTrainingAt).toISOString() : null,
    dimensionProgress: Object.fromEntries(dimensionProgress),
    adaptiveAlgorithm: getAdaptiveAlgorithm(),
    recentRounds: trainingLog.slice(-10).map(r => ({
      id: r.id,
      dimension: r.dimension,
      challenge: r.challenge.slice(0, 80) + "...",
      providersUsed: Array.from(r.responses.keys()),
      bestProvider: r.bestProvider,
      bestQuality: Array.from(r.responses.values()).sort((a, b) => b.quality - a.quality)[0]?.quality || 0,
      debateUsed: r.debateUsed,
      timestamp: new Date(r.timestamp).toISOString(),
    })),
    freeProvidersAvailable: getFreeProviders().length,
  };
}

export function shouldTrainNow(): boolean {
  const hoursSinceLastTraining = (Date.now() - lastTrainingAt) / (1000 * 60 * 60);
  if (hoursSinceLastTraining < 1) return false;

  const routerStats = getRouterStats();
  if (routerStats.totalCalls > 0) {
    const callsPerMinute = routerStats.totalCalls / Math.max(1, (Date.now() - routerStats.startTime) / 60000);
    if (callsPerMinute > 5) return false;
  }

  return true;
}

console.log(`[SwarmTraining] Pipeline ready. ${Object.keys(TRAINING_CHALLENGES).length} dimensions, ${Object.values(TRAINING_CHALLENGES).reduce((a, b) => a + b.length, 0)} challenges.`);
