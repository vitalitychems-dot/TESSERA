import { db } from "@workspace/db";
import { providerCallsTable } from "@workspace/db";
import { eq, gte, desc } from "drizzle-orm";
import { logger } from "./logger";
import { upsertProviderProfile, getProviderConfigs } from "./provider-registry";
import { getProviderCallStats } from "./provider-call-logger";

export interface CapabilityProfile {
  providerId: string;
  providerName: string;
  isExternal: boolean;
  totalCalls: number;
  successCalls: number;
  errorRate: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  strengths: string[];
  weaknesses: string[];
  capabilityScore: number;
  reliabilityScore: number;
  speedScore: number;
  hallucinationTendency: "low" | "medium" | "high" | "unknown";
  models: string[];
  analyzedAt: Date;
}

function computeHallucinationTendency(
  providerId: string,
  errorRate: number,
): "low" | "medium" | "high" | "unknown" {
  const known: Record<string, "low" | "medium" | "high"> = {
    anthropic: "low",
    openai: "low",
    google: "low",
    deepseek: "medium",
    ollama: "medium",
    puter: "low",
    groq: "medium",
    mistral: "low",
    meta: "medium",
    qwen: "medium",
    moonshot: "medium",
    xai: "low",
  };
  if (errorRate > 0.2) return "high";
  return known[providerId] ?? "unknown";
}

function deriveStrengths(providerId: string, avgLatencyMs: number | null, errorRate: number): string[] {
  const strengths: string[] = [];
  if (avgLatencyMs !== null && avgLatencyMs < 1000) strengths.push("Fast inference (<1s)");
  if (avgLatencyMs !== null && avgLatencyMs < 500) strengths.push("Ultra-low latency (<500ms)");
  if (errorRate < 0.01) strengths.push("Highly reliable (>99% success)");
  if (errorRate < 0.05) strengths.push("Reliable (>95% success)");

  const known: Record<string, string[]> = {
    anthropic: ["Long-context reasoning", "Code generation", "Safety alignment"],
    openai: ["Function calling", "Structured outputs", "Broad capability"],
    google: ["Multimodal", "Real-time data", "Long context"],
    deepseek: ["Math reasoning", "Code", "Cost-effective"],
    groq: ["Speed (hardware acceleration)", "Open-weights"],
    mistral: ["Multilingual", "Efficient", "Code"],
    meta: ["Open-weights", "Community support"],
    qwen: ["Multilingual", "Cost-effective"],
    xai: ["Real-time awareness", "News/events"],
    ollama: ["Offline operation", "Privacy", "No API costs", "Self-hosted"],
    puter: ["Multi-provider proxy", "No direct keys needed"],
    moonshot: ["Long context", "Reasoning"],
  };

  return [...strengths, ...(known[providerId] ?? [])];
}

function deriveWeaknesses(providerId: string, avgLatencyMs: number | null, errorRate: number): string[] {
  const weaknesses: string[] = [];
  if (avgLatencyMs !== null && avgLatencyMs > 5000) weaknesses.push("High latency (>5s)");
  if (avgLatencyMs !== null && avgLatencyMs > 10000) weaknesses.push("Very slow (>10s)");
  if (errorRate > 0.1) weaknesses.push("High error rate");
  if (errorRate > 0.05) weaknesses.push("Moderate error rate");

  const known: Record<string, string[]> = {
    anthropic: ["Closed model", "External dependency", "Cost"],
    openai: ["Closed model", "External dependency", "Cost", "Rate limits"],
    google: ["External dependency", "Data privacy concerns"],
    deepseek: ["Some content restrictions", "External dependency"],
    groq: ["Limited model selection", "Rate limits"],
    mistral: ["Smaller ecosystem"],
    meta: ["Requires hosting infrastructure"],
    qwen: ["Limited English documentation"],
    xai: ["Limited availability"],
    ollama: ["Requires local hardware", "Slower than cloud on CPU"],
    puter: ["Depends on Puter.js availability"],
    moonshot: ["Limited availability outside Asia"],
  };

  return [...weaknesses, ...(known[providerId] ?? [])];
}

function computeCapabilityScore(providerId: string, isExternal: boolean): number {
  const scores: Record<string, number> = {
    anthropic: 95,
    openai: 93,
    google: 90,
    deepseek: 82,
    groq: 75,
    mistral: 78,
    meta: 72,
    qwen: 70,
    xai: 80,
    ollama: 60,
    puter: 85,
    moonshot: 72,
  };
  return scores[providerId] ?? (isExternal ? 65 : 55);
}

function computeReliabilityScore(errorRate: number, totalCalls: number): number {
  if (totalCalls === 0) return 50;
  const base = Math.max(0, (1 - errorRate) * 100);
  const confidence = Math.min(1, totalCalls / 20);
  return Math.round(base * confidence + 50 * (1 - confidence));
}

function computeSpeedScore(avgLatencyMs: number | null): number {
  if (avgLatencyMs === null) return 50;
  if (avgLatencyMs < 300) return 100;
  if (avgLatencyMs < 700) return 90;
  if (avgLatencyMs < 1500) return 75;
  if (avgLatencyMs < 3000) return 60;
  if (avgLatencyMs < 7000) return 40;
  return 20;
}

export async function analyzeProvider(providerId: string): Promise<CapabilityProfile | null> {
  const config = getProviderConfigs().find(p => p.id === providerId);
  if (!config) return null;

  const stats = await getProviderCallStats(providerId, 72);

  const totalCalls = stats?.totalCalls ?? 0;
  const successCalls = stats?.successCalls ?? 0;
  const errorRate = stats?.errorRate ?? 0;
  const avgLatencyMs = stats?.avgLatencyMs ?? null;
  const p95LatencyMs = stats?.p95LatencyMs ?? null;

  const strengths = deriveStrengths(providerId, avgLatencyMs, errorRate);
  const weaknesses = deriveWeaknesses(providerId, avgLatencyMs, errorRate);
  const capabilityScore = computeCapabilityScore(providerId, config.isExternal);
  const reliabilityScore = computeReliabilityScore(errorRate, totalCalls);
  const speedScore = computeSpeedScore(avgLatencyMs);
  const hallucinationTendency = computeHallucinationTendency(providerId, errorRate);

  const profile: CapabilityProfile = {
    providerId,
    providerName: config.name,
    isExternal: config.isExternal,
    totalCalls,
    successCalls,
    errorRate,
    avgLatencyMs,
    p95LatencyMs,
    strengths,
    weaknesses,
    capabilityScore,
    reliabilityScore,
    speedScore,
    hallucinationTendency,
    models: config.models,
    analyzedAt: new Date(),
  };

  await upsertProviderProfile(providerId, {
    totalCalls,
    successCalls,
    errorCalls: totalCalls - successCalls,
    avgLatencyMs: avgLatencyMs ?? undefined,
    p95LatencyMs: p95LatencyMs ?? undefined,
    errorRate,
    avgInputTokens: stats?.avgInputTokens ?? undefined,
    avgOutputTokens: stats?.avgOutputTokens ?? undefined,
    capabilities: config.capabilities,
    strengths,
    weaknesses,
    capabilityScore,
    reliabilityScore,
    speedScore,
    lastAnalyzedAt: new Date(),
  });

  return profile;
}

export async function analyzeAllProviders(): Promise<CapabilityProfile[]> {
  const configs = getProviderConfigs();
  const profiles: CapabilityProfile[] = [];

  for (const config of configs) {
    try {
      const profile = await analyzeProvider(config.id);
      if (profile) profiles.push(profile);
    } catch (err) {
      logger.error({ err, providerId: config.id }, "Failed to analyze provider");
    }
  }

  logger.info({ count: profiles.length }, "Provider analysis complete");
  return profiles;
}

export async function compareProvidersForPrompt(
  prompt: string,
  providerIds: string[],
  responses: { providerId: string; text: string; latencyMs: number }[],
): Promise<{
  prompt: string;
  responses: typeof responses;
  similarities: Record<string, Record<string, number>>;
  winner: string | null;
  scores: Record<string, number>;
}> {
  const similarities: Record<string, Record<string, number>> = {};

  for (const r1 of responses) {
    similarities[r1.providerId] = {};
    for (const r2 of responses) {
      if (r1.providerId === r2.providerId) {
        similarities[r1.providerId][r2.providerId] = 1.0;
        continue;
      }
      const sim = computeTextSimilarity(r1.text, r2.text);
      similarities[r1.providerId][r2.providerId] = sim;
    }
  }

  const scores: Record<string, number> = {};
  for (const r of responses) {
    const lengthScore = Math.min(1, r.text.length / 200) * 30;
    const speedScore = Math.max(0, 1 - r.latencyMs / 10000) * 30;
    const avgSim = Object.values(similarities[r.providerId] ?? {})
      .filter((_, i) => Object.keys(similarities[r.providerId] ?? {})[i] !== r.providerId)
      .reduce((s, v) => s + v, 0);
    const simScore = responses.length > 1 ? (avgSim / (responses.length - 1)) * 40 : 40;
    scores[r.providerId] = Math.round(lengthScore + speedScore + simScore);
  }

  const winner = responses.length > 0
    ? responses.reduce((best, r) => (scores[r.providerId] ?? 0) > (scores[best.providerId] ?? 0) ? r : best).providerId
    : null;

  return { prompt, responses, similarities, winner, scores };
}

function computeTextSimilarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const bWords = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = new Set([...aWords].filter(w => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);
  return union.size > 0 ? intersection.size / union.size : 0;
}
