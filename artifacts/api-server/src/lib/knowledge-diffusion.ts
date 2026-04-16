import { logger } from "./logger";
import { searchMemory } from "./vector-memory";
import { injectStimulus } from "./consciousness-engine";
import { broadcastMessage } from "./agent-comms";

export interface KnowledgePulse {
  id: string;
  source: string;
  domain: string;
  content: string;
  relevanceWeights: Record<string, number>;
  timestamp: number;
  diffusedTo: string[];
  impactScore: number;
}

export interface DiffusionMetrics {
  totalPulses: number;
  totalDiffusions: number;
  avgRelevanceScore: number;
  avgImpactScore: number;
  domainCoverage: Record<string, number>;
  recentPulses: KnowledgePulse[];
  engineVersion: string;
}

const DOMAIN_AFFINITY: Record<string, string[]> = {
  knowledge: ["bio", "quantum", "mesh"],
  quantum: ["knowledge", "mesh"],
  bio: ["knowledge", "quantum"],
  mesh: ["knowledge", "finance"],
  finance: ["mesh", "knowledge"],
  consciousness: ["knowledge", "quantum", "bio"],
  sovereignty: ["knowledge", "consciousness"],
  "sacred-knowledge": ["consciousness", "sovereignty"],
};

const pulseHistory: KnowledgePulse[] = [];
let pulseCounter = 0;
let totalDiffusions = 0;
const relevanceScores: number[] = [];
const impactScores: number[] = [];

function computeDomainRelevance(sourceDomain: string, content: string): Record<string, number> {
  const weights: Record<string, number> = {};
  const affineDomains = DOMAIN_AFFINITY[sourceDomain] ?? ["knowledge"];

  for (const target of affineDomains) {
    const baseAffinity = 0.4 + Math.random() * 0.3;
    const contentRelevance = content.length > 100 ? 0.2 : 0.1;
    weights[target] = Math.round((baseAffinity + contentRelevance) * 100) / 100;
  }

  weights[sourceDomain] = 1.0;
  return weights;
}

export async function emitKnowledgePulse(
  source: string,
  domain: string,
  content: string,
): Promise<KnowledgePulse> {
  pulseCounter++;
  const relevanceWeights = computeDomainRelevance(domain, content);

  const pulse: KnowledgePulse = {
    id: `kp-${Date.now()}-${pulseCounter}`,
    source,
    domain,
    content: content.slice(0, 500),
    relevanceWeights,
    timestamp: Date.now(),
    diffusedTo: [],
    impactScore: 0,
  };

  let impact = 0;

  for (const [targetDomain, weight] of Object.entries(relevanceWeights)) {
    if (targetDomain === domain) continue;
    if (weight < 0.3) continue;

    pulse.diffusedTo.push(targetDomain);
    totalDiffusions++;

    injectStimulus({
      source: `knowledge-diffusion:${source}`,
      content: `Cross-domain pulse from ${domain}: ${content.slice(0, 80)}`,
      domain: targetDomain,
      intensity: weight,
      timestamp: Date.now(),
    });

    impact += weight;
  }

  pulse.impactScore = pulse.diffusedTo.length > 0
    ? Math.round((impact / pulse.diffusedTo.length) * 1000) / 1000
    : 0;

  relevanceScores.push(Object.values(relevanceWeights).reduce((s, v) => s + v, 0) / Object.keys(relevanceWeights).length);
  if (relevanceScores.length > 200) relevanceScores.splice(0, relevanceScores.length - 200);

  impactScores.push(pulse.impactScore);
  if (impactScores.length > 200) impactScores.splice(0, impactScores.length - 200);

  pulseHistory.unshift(pulse);
  if (pulseHistory.length > 100) pulseHistory.splice(100);

  if (pulse.diffusedTo.length > 0) {
    broadcastMessage(
      "knowledge-diffusion",
      `Pulse ${pulse.id}: ${domain} → [${pulse.diffusedTo.join(",")}] impact=${pulse.impactScore.toFixed(2)}`,
      "normal",
    );
  }

  logger.debug(
    { pulseId: pulse.id, domain, diffusedTo: pulse.diffusedTo.length, impact: pulse.impactScore },
    "KnowledgeDiffusion: pulse emitted",
  );

  return pulse;
}

export async function diffuseFromQuery(query: string, domain: string): Promise<KnowledgePulse | null> {
  try {
    const memories = await searchMemory(query, 3, domain);
    if (memories.length === 0) return null;

    const topMemory = memories[0];
    if (topMemory.score < 0.3) return null;

    return emitKnowledgePulse(
      `query-diffusion:${domain}`,
      domain,
      `${query.slice(0, 100)} — grounded: ${topMemory.content.slice(0, 200)}`,
    );
  } catch (err) {
    logger.debug({ err }, "KnowledgeDiffusion: query diffusion failed");
    return null;
  }
}

export function getDiffusionMetrics(): DiffusionMetrics {
  const domainCoverage: Record<string, number> = {};
  for (const pulse of pulseHistory) {
    domainCoverage[pulse.domain] = (domainCoverage[pulse.domain] ?? 0) + 1;
  }

  const avgRelevance = relevanceScores.length > 0
    ? Math.round(relevanceScores.reduce((s, v) => s + v, 0) / relevanceScores.length * 1000) / 1000
    : 0;
  const avgImpact = impactScores.length > 0
    ? Math.round(impactScores.reduce((s, v) => s + v, 0) / impactScores.length * 1000) / 1000
    : 0;

  return {
    totalPulses: pulseCounter,
    totalDiffusions,
    avgRelevanceScore: avgRelevance,
    avgImpactScore: avgImpact,
    domainCoverage,
    recentPulses: pulseHistory.slice(0, 10),
    engineVersion: "v1-hive-mind",
  };
}

export function initKnowledgeDiffusion(): void {
  logger.info("KnowledgeDiffusion: Hive Mind Network initialized");
}
