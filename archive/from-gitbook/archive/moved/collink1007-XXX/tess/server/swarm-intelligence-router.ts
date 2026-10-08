import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PROVIDER_REGISTRY, getProviderSpecializations as getRegSpec, type TaskDimension as RegistryDimension, getRegistryStats } from "./provider-registry";
import { getOptimalSwarmFormula, getCategoryWinner } from "./grand-evaluation";
import type { OptimizerCategory } from "./swarm-optimizer";

const DIMENSION_TO_CATEGORY: Partial<Record<TaskDimension, OptimizerCategory[]>> = {
  code_generation: ["Code Generation"],
  code_review: ["Code Generation", "Self-Correction/Debugging"],
  debugging: ["Self-Correction/Debugging", "Error Handling"],
  algorithm: ["Problem Solving", "Code Generation"],
  math_computation: ["Data Analysis", "Problem Solving"],
  math_proof: ["Problem Solving"],
  statistics: ["Data Analysis", "Time Series Analysis"],
  creative_writing: ["Creative Content", "NLG"],
  brainstorming: ["Creative Content", "Strategic Planning"],
  storytelling: ["Creative Content", "NLG"],
  factual_lookup: ["Knowledge Representation", "NLU"],
  research_synthesis: ["Data Analysis", "Knowledge Representation"],
  current_events: ["NLU", "Knowledge Representation"],
  logical_reasoning: ["Problem Solving", "NLU"],
  critical_analysis: ["Data Analysis", "Problem Solving"],
  comparison: ["Data Analysis", "NLU"],
  conversation: ["NLG", "Emotional Intelligence"],
  emotional_support: ["Emotional Intelligence", "Human-AI Collaboration"],
  advice: ["Strategic Planning", "Human-AI Collaboration"],
  data_analysis: ["Data Analysis", "Time Series Analysis"],
  pattern_recognition: ["Data Analysis", "Problem Solving"],
  prediction: ["Market Analysis", "Time Series Analysis"],
  finance: ["Economic Simulation", "Market Analysis"],
  crypto: ["Blockchain/Crypto", "Market Analysis"],
  trading: ["Market Analysis", "Economic Simulation"],
  security: ["Cybersecurity", "Security Auditing"],
  privacy: ["Cybersecurity", "Compliance"],
  encryption: ["Cybersecurity", "Security Auditing"],
  translation: ["NLU", "NLG"],
  summarization: ["NLG", "NLU"],
  extraction: ["NLU", "Data Analysis"],
  general: ["Problem Solving"],
};

interface ProviderProfile {
  id: string;
  name: string;
  strengths: TaskDimension[];
  weaknesses: TaskDimension[];
  avgLatencyMs: number;
  avgQuality: number;
  successRate: number;
  totalCalls: number;
  recentScores: number[];
  bestFor: string[];
  worstFor: string[];
  speedTier: "ultra-fast" | "fast" | "medium" | "slow";
  costTier: number;
  free: boolean;
  maxConcurrent: number;
  adaptiveScore: Record<string, number>;
  lastUpdated: number;
}

type TaskDimension =
  | "code_generation" | "code_review" | "debugging" | "algorithm"
  | "math_computation" | "math_proof" | "statistics"
  | "creative_writing" | "brainstorming" | "storytelling"
  | "factual_lookup" | "research_synthesis" | "current_events"
  | "logical_reasoning" | "critical_analysis" | "comparison"
  | "conversation" | "emotional_support" | "advice"
  | "data_analysis" | "pattern_recognition" | "prediction"
  | "finance" | "crypto" | "trading"
  | "security" | "privacy" | "encryption"
  | "translation" | "summarization" | "extraction"
  | "general";

export interface QueryAnalysis {
  primaryDimensions: TaskDimension[];
  secondaryDimensions: TaskDimension[];
  complexity: number;
  urgency: number;
  requiresAccuracy: boolean;
  requiresCreativity: boolean;
  requiresSpeed: boolean;
  requiresDepth: boolean;
  tokenEstimate: number;
  keywords: string[];
  sentiment: "neutral" | "positive" | "negative" | "urgent" | "technical";
}

interface SwarmFormation {
  primary: string;
  supporters: string[];
  strategy: "single" | "parallel_race" | "parallel_synthesize" | "chain";
  reasoning: string;
  confidence: number;
  expectedQuality: number;
}

interface SwarmResult {
  response: string;
  formation: SwarmFormation;
  providersUsed: string[];
  primaryProvider: string;
  latencyMs: number;
  quality: number;
  adaptationApplied: boolean;
  learnings: string[];
}

const DIMENSION_PATTERNS: Record<TaskDimension, RegExp[]> = {
  code_generation: [/write.*code|create.*function|build.*app|implement|generate.*script|make.*program|code.*for|develop/i],
  code_review: [/review.*code|check.*code|improve.*code|refactor|optimize.*code|clean.*code/i],
  debugging: [/debug|fix.*bug|error.*in|not.*working|broken|crash|issue.*with.*code|troubleshoot/i],
  algorithm: [/algorithm|sort|search.*tree|graph.*traversal|dynamic.*program|binary.*search|linked.*list|hash.*map/i],
  math_computation: [/calculate|compute|solve.*equation|what.*is.*\d.*[\+\-\*\/]|arithmetic|convert.*units/i],
  math_proof: [/prove|theorem|lemma|mathematical.*proof|QED|axiom|conjecture/i],
  statistics: [/statistics|probability|distribution|regression|correlation|standard.*deviation|mean.*median/i],
  creative_writing: [/write.*story|write.*poem|creative.*writing|fiction|narrative|compose|literary/i],
  brainstorming: [/ideas?.*for|brainstorm|suggest|come.*up.*with|think.*of|what.*could|possibilities/i],
  storytelling: [/tell.*story|once.*upon|imagine.*scenario|role.*play|character/i],
  factual_lookup: [/who.*is|what.*is|when.*did|where.*is|define|what.*does.*mean|capital.*of/i],
  research_synthesis: [/research|compare.*and.*contrast|analyze.*different|review.*literature|study.*shows/i],
  current_events: [/latest|recent|news|today|current|happening.*now|update.*on|what.*happened/i],
  logical_reasoning: [/why|explain.*how|reason|logic|because|therefore|if.*then|deduce|infer/i],
  critical_analysis: [/analyze|evaluate|assess|critique|pros.*cons|advantages.*disadvantages|strengths.*weakness/i],
  comparison: [/compare|versus|vs\b|difference.*between|better.*than|which.*is.*better/i],
  conversation: [/hello|hey|hi\b|how.*are|what'?s.*up|good.*morning|thanks|thank/i],
  emotional_support: [/feel|emotion|stressed|anxious|worried|happy|sad|love|hate|afraid|scared/i],
  advice: [/should.*i|advice|recommend|suggest.*me|help.*decide|what.*do.*you.*think/i],
  data_analysis: [/data|dataset|csv|json.*parse|table|spreadsheet|chart|graph|visualization/i],
  pattern_recognition: [/pattern|trend|recurring|sequence|anomaly|outlier|detect/i],
  prediction: [/predict|forecast|future|will.*happen|expect|projection|estimate.*future/i],
  finance: [/money|financial|income|budget|investment|revenue|profit|cost|expense|roi/i],
  crypto: [/crypto|bitcoin|ethereum|solana|token|blockchain|defi|nft|wallet|sol\b|btc\b|eth\b/i],
  trading: [/trade|buy.*sell|market|price.*action|candlestick|support.*resistance|pump|dump/i],
  security: [/security|hack|vulnerab|exploit|firewall|penetration|cyber|threat|malware/i],
  privacy: [/privacy|anonymous|vpn|encrypt.*data|gdpr|personal.*data|surveillance/i],
  encryption: [/encrypt|decrypt|cipher|hash|sha|aes|rsa|key.*exchange|ssl|tls/i],
  translation: [/translate|translation|in.*spanish|in.*french|in.*chinese|language.*convert/i],
  summarization: [/summarize|summary|tldr|key.*points|brief|condense|shorten/i],
  extraction: [/extract|pull.*out|find.*in.*text|parse|scrape|get.*from/i],
  general: [/.*/i],
};

function buildSpecializationsFromRegistry(): Record<string, { primary: TaskDimension[]; secondary: TaskDimension[]; speed: "ultra-fast" | "fast" | "medium" | "slow" }> {
  const specs: Record<string, { primary: TaskDimension[]; secondary: TaskDimension[]; speed: "ultra-fast" | "fast" | "medium" | "slow" }> = {};
  for (const p of PROVIDER_REGISTRY) {
    specs[p.id] = {
      primary: p.primary as TaskDimension[],
      secondary: p.secondary as TaskDimension[],
      speed: p.speed,
    };
  }
  return specs;
}

export const PROVIDER_SPECIALIZATIONS = buildSpecializationsFromRegistry();

const formationLookup: Record<string, { formation: string; providers: string[]; avgQuality: number; count: number }> = {};

export function recordFormationOutcome(dimensions: string[], formationType: string, providers: string[], quality: number) {
  const key = dimensions.sort().join("+") + ":" + formationType;
  if (!formationLookup[key]) {
    formationLookup[key] = { formation: formationType, providers, avgQuality: quality, count: 1 };
  } else {
    const f = formationLookup[key];
    f.avgQuality = (f.avgQuality * f.count + quality) / (f.count + 1);
    f.count++;
    if (quality > f.avgQuality) f.providers = providers;
  }
}

export function getBestFormation(dimensions: string[]): { formation: string; providers: string[]; avgQuality: number; count: number } | null {
  const key = dimensions.sort().join("+");
  let best: { formation: string; providers: string[]; avgQuality: number; count: number } | null = null;
  for (const [k, v] of Object.entries(formationLookup)) {
    if (k.startsWith(key + ":") && v.count >= 5 && (!best || v.avgQuality > best.avgQuality)) {
      best = v;
    }
  }
  return best;
}

export function getFormationOptimizationData() {
  return {
    totalFormations: Object.keys(formationLookup).length,
    topFormations: Object.entries(formationLookup)
      .filter(([, v]) => v.count >= 3)
      .sort(([, a], [, b]) => b.avgQuality - a.avgQuality)
      .slice(0, 20)
      .map(([key, v]) => ({ dimensions: key.split(":")[0], formation: v.formation, providers: v.providers, avgQuality: Math.round(v.avgQuality), samples: v.count })),
    registryStats: getRegistryStats(),
  };
}

const profiles: Record<string, ProviderProfile> = {};
const formationHistory: Array<{ query: string; formation: SwarmFormation; quality: number; timestamp: number }> = [];
const dimensionPerformance: Record<string, Record<string, { total: number; sum: number; avg: number }>> = {};
let totalFormations = 0;
let adaptationsApplied = 0;

export function analyzeQuery(query: string, conversationContext?: string[]): QueryAnalysis {
  const text = query.toLowerCase();
  const contextText = conversationContext?.join(" ").toLowerCase() || "";
  const combined = text + " " + contextText;

  const primaryDimensions: TaskDimension[] = [];
  const secondaryDimensions: TaskDimension[] = [];

  for (const [dim, patterns] of Object.entries(DIMENSION_PATTERNS)) {
    if (dim === "general") continue;
    for (const pat of patterns) {
      if (pat.test(text)) {
        primaryDimensions.push(dim as TaskDimension);
        break;
      } else if (pat.test(contextText)) {
        secondaryDimensions.push(dim as TaskDimension);
        break;
      }
    }
  }

  if (primaryDimensions.length === 0) primaryDimensions.push("general");

  const words = query.split(/\s+/).length;
  const hasCode = /```|function\s|class\s|import\s|const\s|let\s|var\s/.test(query);
  const hasNumbers = /\d{2,}/.test(query);
  const hasQuestion = /\?/.test(query);

  let complexity = Math.min(1, words / 100);
  if (hasCode) complexity = Math.max(complexity, 0.7);
  if (primaryDimensions.includes("math_proof") || primaryDimensions.includes("algorithm")) complexity = Math.max(complexity, 0.8);
  if (primaryDimensions.length > 3) complexity = Math.max(complexity, 0.6);

  const urgency = /asap|urgent|quick|fast|immediately|right now/i.test(text) ? 0.9 : 0.3;

  const requiresAccuracy = primaryDimensions.some(d =>
    ["math_computation", "factual_lookup", "finance", "crypto", "statistics", "data_analysis"].includes(d)
  );
  const requiresCreativity = primaryDimensions.some(d =>
    ["creative_writing", "brainstorming", "storytelling"].includes(d)
  );
  const requiresSpeed = urgency > 0.5 || primaryDimensions.includes("conversation");
  const requiresDepth = complexity > 0.6 || primaryDimensions.some(d =>
    ["research_synthesis", "critical_analysis", "math_proof", "algorithm"].includes(d)
  );

  let sentiment: QueryAnalysis["sentiment"] = "neutral";
  if (/\!{2,}|urgent|asap|help/i.test(text)) sentiment = "urgent";
  else if (/code|function|api|server|debug|error/i.test(text)) sentiment = "technical";
  else if (/thank|love|great|awesome/i.test(text)) sentiment = "positive";
  else if (/hate|terrible|broken|worst/i.test(text)) sentiment = "negative";

  const keywords = text.match(/\b\w{4,}\b/g)?.slice(0, 20) || [];

  return {
    primaryDimensions,
    secondaryDimensions,
    complexity,
    urgency,
    requiresAccuracy,
    requiresCreativity,
    requiresSpeed,
    requiresDepth,
    tokenEstimate: Math.max(100, words * 3),
    keywords,
    sentiment,
  };
}

function scoreProviderForQuery(providerId: string, analysis: QueryAnalysis): number {
  const spec = PROVIDER_SPECIALIZATIONS[providerId];
  if (!spec) return 20;

  let score = 30;

  for (const dim of analysis.primaryDimensions) {
    if (spec.primary.includes(dim)) score += 25;
    else if (spec.secondary.includes(dim)) score += 12;
  }

  for (const dim of analysis.secondaryDimensions) {
    if (spec.primary.includes(dim)) score += 8;
    else if (spec.secondary.includes(dim)) score += 4;
  }

  if (analysis.requiresSpeed) {
    if (spec.speed === "ultra-fast") score += 20;
    else if (spec.speed === "fast") score += 10;
    else if (spec.speed === "slow") score -= 10;
  }

  if (analysis.requiresDepth) {
    if (spec.speed === "slow") score += 10;
    if (spec.primary.length >= 3) score += 5;
  }

  const profile = profiles[providerId];
  if (profile) {
    score += profile.avgQuality * 10;
    score += profile.successRate * 15;

    if (profile.totalCalls > 5) {
      for (const dim of analysis.primaryDimensions) {
        const dimKey = `${providerId}:${dim}`;
        const perfData = dimensionPerformance[providerId]?.[dim];
        if (perfData && perfData.total > 2) {
          score += (perfData.avg - 5) * 3;
        }
      }
    }

    if (profile.recentScores.length > 0) {
      const recentAvg = profile.recentScores.reduce((a, b) => a + b, 0) / profile.recentScores.length;
      score += (recentAvg - 5) * 2;
    }
  }

  const regProvider = PROVIDER_REGISTRY.find(p => p.id === providerId);
  if (regProvider) {
    if (regProvider.costTier === 0) score += 10;
    else if (regProvider.costTier === 2) score -= 5;
    else if (regProvider.costTier === 3) score -= 10;
  }

  for (const dim of analysis.primaryDimensions) {
    const categories = DIMENSION_TO_CATEGORY[dim];
    if (!categories) continue;
    for (const cat of categories) {
      const winner = getCategoryWinner(cat);
      if (winner && winner.modelId === providerId) {
        score += Math.round((winner.score / 100) * 15);
        break;
      }
    }
  }

  return Math.max(0, Math.min(100, score));
}

function isChainQuery(analysis: QueryAnalysis): boolean {
  const chainPatterns = /then|after that|next|step \d|first.*then|followed by|once.*done/i;
  const hasMultiStep = analysis.primaryDimensions.length >= 2 &&
    analysis.primaryDimensions.some(d => ["code_generation", "research_synthesis"].includes(d)) &&
    analysis.primaryDimensions.some(d => ["code_review", "summarization", "data_analysis", "critical_analysis"].includes(d));
  return hasMultiStep || (analysis.complexity > 0.6 && analysis.keywords.some(k => chainPatterns.test(k)));
}

function identifyChainSteps(analysis: QueryAnalysis): TaskDimension[] {
  const steps: TaskDimension[] = [];
  if (analysis.primaryDimensions.includes("research_synthesis")) steps.push("research_synthesis");
  if (analysis.primaryDimensions.includes("code_generation")) steps.push("code_generation");
  if (analysis.primaryDimensions.includes("code_review")) steps.push("code_review");
  if (analysis.primaryDimensions.includes("data_analysis")) steps.push("data_analysis");
  if (analysis.primaryDimensions.includes("critical_analysis")) steps.push("critical_analysis");
  if (analysis.primaryDimensions.includes("summarization")) steps.push("summarization");
  if (steps.length === 0) return analysis.primaryDimensions.slice(0, 3);
  return steps;
}

export function formSwarm(analysis: QueryAnalysis, availableProviders: string[]): SwarmFormation {
  const scored = availableProviders
    .map(id => ({ id, score: scoreProviderForQuery(id, analysis) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      primary: "pollinations",
      supporters: [],
      strategy: "single",
      reasoning: "No providers available, using default",
      confidence: 0.3,
      expectedQuality: 5,
    };
  }

  const topScore = scored[0].score;
  const primary = scored[0].id;

  let strategy: SwarmFormation["strategy"] = "single";
  let supporters: string[] = [];
  let reasoning = "";

  const learned = getBestFormation(analysis.primaryDimensions);
  if (learned && learned.count >= 10 && learned.avgQuality > 70) {
    strategy = learned.formation as SwarmFormation["strategy"];
    supporters = learned.providers.filter(p => p !== primary && availableProviders.includes(p));
    reasoning = `Adaptive: learned formation (${learned.count} samples, avg quality ${learned.avgQuality.toFixed(0)}). Primary: ${primary}`;
  } else {
    const evalFormulas = getOptimalSwarmFormula();
    if (evalFormulas.length > 0) {
      for (const dim of analysis.primaryDimensions) {
        const categories = DIMENSION_TO_CATEGORY[dim];
        if (!categories) continue;
        for (const cat of categories) {
          const formula = evalFormulas.find(f => f.category === cat);
          if (formula) {
            const fallbacks = [formula.fallback1, formula.fallback2]
              .filter((fb): fb is string => !!fb && fb !== primary && availableProviders.includes(fb));
            if (fallbacks.length > 0) {
              const combined = Array.from(new Set([...supporters, ...fallbacks]));
              supporters = combined.slice(0, 3);
              if (supporters.length > 0 && strategy === "single") {
                strategy = "parallel_synthesize";
              }
              reasoning = `Grand-eval fallback for ${cat}: primary ${primary}, eval supporters: ${fallbacks.join(", ")}`;
            }
            break;
          }
        }
        if (supporters.length > 0) break;
      }
    }
  }

  if (strategy === "single" && supporters.length === 0) {
    if (isChainQuery(analysis)) {
      strategy = "chain";
      const steps = identifyChainSteps(analysis);
      supporters = steps.map(step => {
        const stepAnalysis = { ...analysis, primaryDimensions: [step] };
        const stepScored = availableProviders
          .map(id => ({ id, score: scoreProviderForQuery(id, stepAnalysis) }))
          .sort((a, b) => b.score - a.score);
        return stepScored[0]?.id || primary;
      }).filter(id => id !== primary);
      reasoning = `Chain query — ${steps.length} steps with specialized providers per step. Primary: ${primary}`;
    } else if (analysis.complexity > 0.85 && scored.length >= 3) {
      strategy = "parallel_synthesize";
      supporters = scored.slice(1, 3).filter(s => s.score > topScore * 0.6).map(s => s.id);
      reasoning = `Complex query (${analysis.complexity.toFixed(2)}) — synthesizing from ${1 + supporters.length} providers. ` +
        `Primary: ${primary} (score ${topScore.toFixed(0)}), dimensions: ${analysis.primaryDimensions.join(", ")}`;
    } else if (analysis.requiresSpeed && scored.length >= 2) {
      strategy = "parallel_race";
      const fastProviders = scored.filter(s => {
        const spec = PROVIDER_SPECIALIZATIONS[s.id];
        return spec && (spec.speed === "ultra-fast" || spec.speed === "fast");
      });
      supporters = fastProviders.slice(1, 2).map(s => s.id);
      reasoning = `Speed-critical — racing ${1 + supporters.length} fast providers. Primary: ${primary}`;
    } else if (analysis.requiresAccuracy && analysis.complexity > 0.6 && scored.length >= 2) {
      strategy = "parallel_synthesize";
      supporters = scored.slice(1, 2).filter(s => s.score > topScore * 0.65).map(s => s.id);
      reasoning = `Accuracy-critical — validating with ${1 + supporters.length} providers. Primary: ${primary}`;
    } else {
      strategy = "single";
      reasoning = `Standard query — single optimal provider: ${primary} (score ${topScore.toFixed(0)}) for ${analysis.primaryDimensions.join(", ")}`;
    }
  }

  const confidence = Math.min(1, topScore / 80);
  const expectedQuality = 5 + (topScore / 20);

  totalFormations++;

  return { primary, supporters, strategy, reasoning, confidence, expectedQuality };
}

function selectDiverseProviders(scored: Array<{ id: string; score: number }>, dimensions: TaskDimension[]): string[] {
  const selected: string[] = [];
  const coveredDimensions = new Set<string>();

  for (const { id, score } of scored.slice(1)) {
    if (selected.length >= 3) break;
    const spec = PROVIDER_SPECIALIZATIONS[id];
    if (!spec) continue;

    let coversNew = false;
    for (const dim of dimensions) {
      if (!coveredDimensions.has(dim) && (spec.primary.includes(dim) || spec.secondary.includes(dim))) {
        coversNew = true;
        coveredDimensions.add(dim);
      }
    }

    if (coversNew || score > 60) {
      selected.push(id);
    }
  }

  return selected;
}

export function recordSwarmResult(formation: SwarmFormation, providerId: string, quality: number, latencyMs: number, dimensions: TaskDimension[]) {
  if (!profiles[providerId]) {
    const spec = PROVIDER_SPECIALIZATIONS[providerId];
    profiles[providerId] = {
      id: providerId,
      name: providerId,
      strengths: spec?.primary || ["general"],
      weaknesses: [],
      avgLatencyMs: latencyMs,
      avgQuality: quality,
      successRate: 1,
      totalCalls: 0,
      recentScores: [],
      bestFor: [],
      worstFor: [],
      speedTier: spec?.speed || "medium",
      costTier: 0,
      free: true,
      maxConcurrent: 3,
      adaptiveScore: {},
      lastUpdated: Date.now(),
    };
  }

  const profile = profiles[providerId];
  profile.totalCalls++;
  profile.avgLatencyMs = (profile.avgLatencyMs * (profile.totalCalls - 1) + latencyMs) / profile.totalCalls;
  profile.avgQuality = (profile.avgQuality * (profile.totalCalls - 1) + quality) / profile.totalCalls;
  profile.recentScores.push(quality);
  if (profile.recentScores.length > 20) profile.recentScores.shift();
  profile.lastUpdated = Date.now();

  for (const dim of dimensions) {
    if (!dimensionPerformance[providerId]) dimensionPerformance[providerId] = {};
    if (!dimensionPerformance[providerId][dim]) {
      dimensionPerformance[providerId][dim] = { total: 0, sum: 0, avg: 0 };
    }
    const perf = dimensionPerformance[providerId][dim];
    perf.total++;
    perf.sum += quality;
    perf.avg = perf.sum / perf.total;
  }

  if (profile.totalCalls > 10) {
    const dimEntries = Object.entries(dimensionPerformance[providerId] || {});
    const sorted = dimEntries.sort((a, b) => b[1].avg - a[1].avg);
    profile.bestFor = sorted.slice(0, 5).map(([dim]) => dim);
    profile.worstFor = sorted.slice(-3).filter(([_, d]) => d.avg < 5).map(([dim]) => dim);

    const spec = PROVIDER_SPECIALIZATIONS[providerId];
    if (spec) {
      const realStrengths: TaskDimension[] = [];
      const realWeaknesses: TaskDimension[] = [];
      for (const [dim, data] of dimEntries) {
        if (data.total >= 3) {
          if (data.avg >= 7) realStrengths.push(dim as TaskDimension);
          if (data.avg < 4) realWeaknesses.push(dim as TaskDimension);
        }
      }
      if (realStrengths.length > 0) profile.strengths = realStrengths;
      if (realWeaknesses.length > 0) profile.weaknesses = realWeaknesses;
    }
  }

  formationHistory.push({
    query: dimensions.join(","),
    formation,
    quality,
    timestamp: Date.now(),
  });
  if (formationHistory.length > 2000) formationHistory.splice(0, 500);
}

export function recordSwarmFailure(providerId: string, dimensions: TaskDimension[]) {
  if (!profiles[providerId]) return;
  const profile = profiles[providerId];
  profile.successRate = Math.max(0, profile.successRate - 0.05);
  profile.recentScores.push(0);
  if (profile.recentScores.length > 20) profile.recentScores.shift();

  for (const dim of dimensions) {
    if (!dimensionPerformance[providerId]) dimensionPerformance[providerId] = {};
    if (!dimensionPerformance[providerId][dim]) {
      dimensionPerformance[providerId][dim] = { total: 0, sum: 0, avg: 0 };
    }
    const perf = dimensionPerformance[providerId][dim];
    perf.total++;
    perf.sum += 1;
    perf.avg = perf.sum / perf.total;
  }
}

export function getSwarmIntelligenceStats() {
  const providerRankings = Object.values(profiles)
    .sort((a, b) => b.avgQuality - a.avgQuality)
    .map(p => ({
      id: p.id,
      avgQuality: Math.round(p.avgQuality * 100) / 100,
      successRate: Math.round(p.successRate * 100) / 100,
      avgLatencyMs: Math.round(p.avgLatencyMs),
      totalCalls: p.totalCalls,
      speedTier: p.speedTier,
      bestFor: p.bestFor.slice(0, 5),
      worstFor: p.worstFor,
      recentTrend: p.recentScores.length > 3
        ? (p.recentScores.slice(-3).reduce((a, b) => a + b, 0) / 3 > p.avgQuality ? "improving" : "declining")
        : "stable",
    }));

  const dimensionLeaders: Record<string, string[]> = {};
  for (const [providerId, dims] of Object.entries(dimensionPerformance)) {
    for (const [dim, data] of Object.entries(dims)) {
      if (data.total >= 3 && data.avg >= 6) {
        if (!dimensionLeaders[dim]) dimensionLeaders[dim] = [];
        dimensionLeaders[dim].push(providerId);
      }
    }
  }

  for (const dim of Object.keys(dimensionLeaders)) {
    dimensionLeaders[dim] = dimensionLeaders[dim]
      .sort((a, b) => (dimensionPerformance[b]?.[dim]?.avg || 0) - (dimensionPerformance[a]?.[dim]?.avg || 0))
      .slice(0, 5);
  }

  const recentFormations = formationHistory.slice(-20).map(f => ({
    dimensions: f.query,
    strategy: f.formation.strategy,
    primary: f.formation.primary,
    supporters: f.formation.supporters.length,
    quality: f.quality,
    timestamp: f.timestamp,
  }));

  return {
    totalFormations,
    adaptationsApplied,
    activeProviders: Object.keys(profiles).length,
    providerRankings,
    dimensionLeaders,
    recentFormations,
    formationStrategyCounts: {
      single: formationHistory.filter(f => f.formation.strategy === "single").length,
      parallel_race: formationHistory.filter(f => f.formation.strategy === "parallel_race").length,
      parallel_synthesize: formationHistory.filter(f => f.formation.strategy === "parallel_synthesize").length,
      chain: formationHistory.filter(f => f.formation.strategy === "chain").length,
    },
    avgQualityByStrategy: {
      single: avgQualityForStrategy("single"),
      parallel_race: avgQualityForStrategy("parallel_race"),
      parallel_synthesize: avgQualityForStrategy("parallel_synthesize"),
    },
  };
}

function avgQualityForStrategy(strategy: string): number {
  const entries = formationHistory.filter(f => f.formation.strategy === strategy);
  if (entries.length === 0) return 0;
  return Math.round(entries.reduce((sum, e) => sum + e.quality, 0) / entries.length * 100) / 100;
}

export function getOptimalProviderForDimension(dim: TaskDimension): string | null {
  let best: string | null = null;
  let bestScore = 0;

  for (const [providerId, dims] of Object.entries(dimensionPerformance)) {
    const data = dims[dim];
    if (data && data.total >= 3 && data.avg > bestScore) {
      bestScore = data.avg;
      best = providerId;
    }
  }

  if (!best) {
    for (const [providerId, spec] of Object.entries(PROVIDER_SPECIALIZATIONS)) {
      if (spec.primary.includes(dim)) return providerId;
    }
  }

  return best;
}

const SWARM_STATS_PATH = path.join(process.cwd(), "server", "swarm-stats.json");

function saveSwarmStats() {
  try {
    const data = {
      profiles,
      dimensionPerformance,
      formationHistory: formationHistory.slice(-500),
      totalFormations,
      adaptationsApplied,
      savedAt: Date.now(),
    };
    fs.writeFileSync(SWARM_STATS_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("[SwarmIntelligence] Failed to save stats:", err);
  }
}

function loadSwarmStats() {
  try {
    if (fs.existsSync(SWARM_STATS_PATH)) {
      const raw = fs.readFileSync(SWARM_STATS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (data.profiles) {
        Object.assign(profiles, data.profiles);
      }
      if (data.dimensionPerformance) {
        Object.assign(dimensionPerformance, data.dimensionPerformance);
      }
      if (data.formationHistory && Array.isArray(data.formationHistory)) {
        formationHistory.push(...data.formationHistory);
      }
      if (typeof data.totalFormations === "number") {
        totalFormations = data.totalFormations;
      }
      if (typeof data.adaptationsApplied === "number") {
        adaptationsApplied = data.adaptationsApplied;
      }
      console.log(`[SwarmIntelligence] Loaded stats: ${Object.keys(profiles).length} profiles, ${formationHistory.length} formations`);
    }
  } catch (err) {
    console.error("[SwarmIntelligence] Failed to load stats:", err);
  }
}

loadSwarmStats();
setInterval(saveSwarmStats, 5 * 60 * 1000);

console.log("[SwarmIntelligence] Adaptive Swarm Intelligence Router initialized — real-time task analysis, dynamic formation, continuous learning");
