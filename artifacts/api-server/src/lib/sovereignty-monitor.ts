import { db } from "@workspace/db";
import { sovereigntyMetricsTable, providerCallsTable } from "@workspace/db";
import { desc, gte } from "drizzle-orm";
import { logger } from "./logger";
import { getTotalCallStats, getCallCountsByProvider } from "./provider-call-logger";
import { getProviderConfigs, getProviderStatus } from "./provider-registry";
import { onSovereigntyChange } from "./consciousness-engine";

let lastSovereigntyScore: number | null = null;

export interface SovereigntyStatus {
  sovereigntyScore: number;
  internalRatio: number;
  externalRatio: number;
  detachmentReadiness: number;
  performanceParityScore: number;
  totalCalls: number;
  externalCalls: number;
  internalCalls: number;
  avgExternalLatencyMs: number | null;
  avgInternalLatencyMs: number | null;
  activeProviders: number;
  externalProviders: number;
  internalProviders: number;
  grade: "SOVEREIGN" | "APPROACHING" | "DEPENDENT" | "CRITICAL";
  summary: string;
  computedAt: Date;
}

export interface DryRunResult {
  simulated: boolean;
  internalProvidersAvailable: string[];
  externalProvidersDisabled: string[];
  estimatedSuccessRate: number;
  bottlenecks: string[];
  readinessScore: number;
  recommendations: string[];
}

export async function computeSovereigntyStatus(): Promise<SovereigntyStatus> {
  const stats = await getTotalCallStats(24);
  const configs = getProviderConfigs();

  const internalProviders = configs.filter(p => !p.isExternal);
  const externalProviders = configs.filter(p => p.isExternal);

  const activeProviders = configs.filter(p => getProviderStatus(p.id) === "active");
  const activeExternal = activeProviders.filter(p => p.isExternal);
  const activeInternal = activeProviders.filter(p => !p.isExternal);

  const total = stats.total;
  const external = stats.external;
  const internal = stats.internal;

  const internalRatio = total > 0 ? internal / total : 0;
  const externalRatio = total > 0 ? external / total : 1;

  const avgExtLatency = stats.avgExternalLatencyMs;
  const avgIntLatency = stats.avgInternalLatencyMs;

  let performanceParityScore = 50;
  if (avgExtLatency !== null && avgIntLatency !== null && avgExtLatency > 0) {
    const ratio = avgIntLatency / avgExtLatency;
    if (ratio <= 1) performanceParityScore = 100;
    else if (ratio <= 1.5) performanceParityScore = 85;
    else if (ratio <= 2) performanceParityScore = 65;
    else if (ratio <= 3) performanceParityScore = 45;
    else performanceParityScore = 25;
  }

  const hasLocalInference = internalProviders.some(p => p.type === "local");
  const internalRatioScore = internalRatio * 40;
  const localInferenceBonus = hasLocalInference ? 20 : 0;
  const performanceBonus = performanceParityScore * 0.25;
  const activeInternalBonus = activeInternal.length > 0 ? 15 : 0;

  const sovereigntyScore = Math.min(100, Math.round(
    internalRatioScore + localInferenceBonus + performanceBonus + activeInternalBonus
  ));

  const detachmentReadiness = computeDetachmentReadiness(
    activeInternal.length,
    activeExternal.length,
    internalRatio,
    performanceParityScore,
  );

  let grade: SovereigntyStatus["grade"];
  let summary: string;

  if (sovereigntyScore >= 80) {
    grade = "SOVEREIGN";
    summary = "High sovereignty — majority of AI inference handled internally.";
  } else if (sovereigntyScore >= 55) {
    grade = "APPROACHING";
    summary = "Progressing toward sovereignty — partial internal routing established.";
  } else if (sovereigntyScore >= 30) {
    grade = "DEPENDENT";
    summary = "External dependency detected — most calls route to external providers.";
  } else {
    grade = "CRITICAL";
    summary = "Critical external dependency — zero or minimal internal capacity.";
  }

  const status: SovereigntyStatus = {
    sovereigntyScore,
    internalRatio: Math.round(internalRatio * 100) / 100,
    externalRatio: Math.round(externalRatio * 100) / 100,
    detachmentReadiness,
    performanceParityScore,
    totalCalls: total,
    externalCalls: external,
    internalCalls: internal,
    avgExternalLatencyMs: avgExtLatency,
    avgInternalLatencyMs: avgIntLatency,
    activeProviders: activeProviders.length,
    externalProviders: activeExternal.length,
    internalProviders: activeInternal.length,
    grade,
    summary,
    computedAt: new Date(),
  };

  try {
    await db.insert(sovereigntyMetricsTable).values({
      totalCalls: total,
      externalCalls: external,
      internalCalls: internal,
      internalRatio,
      sovereigntyScore,
      detachmentReadiness,
      performanceParityScore,
      avgExternalLatencyMs: avgExtLatency,
      avgInternalLatencyMs: avgIntLatency,
      activeProviders: activeProviders.length,
      externalProviders: activeExternal.length,
      internalProviders: activeInternal.length,
      dryRunSimulated: false,
    });
  } catch (err) {
    logger.error({ err }, "Failed to persist sovereignty metrics");
  }

  if (lastSovereigntyScore !== null) {
    try {
      onSovereigntyChange(lastSovereigntyScore, sovereigntyScore, grade.toLowerCase());
    } catch (err) {
      logger.debug({ err: err instanceof Error ? err.message : String(err) }, "SovereigntyMonitor: consciousness hook failed");
    }
  }
  lastSovereigntyScore = sovereigntyScore;

  return status;
}

function computeDetachmentReadiness(
  internalCount: number,
  externalCount: number,
  internalRatio: number,
  performanceParityScore: number,
): number {
  if (internalCount === 0) return 0;
  const capacityScore = Math.min(1, internalCount / 2) * 40;
  const usageScore = internalRatio * 35;
  const perfScore = (performanceParityScore / 100) * 25;
  return Math.round(capacityScore + usageScore + perfScore);
}

export async function runDryRun(): Promise<DryRunResult> {
  const configs = getProviderConfigs();
  const internalProviders = configs.filter(p => !p.isExternal);
  const externalProviders = configs.filter(p => p.isExternal);

  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  if (internalProviders.length === 0) {
    bottlenecks.push("No internal providers configured");
    recommendations.push("Deploy at least one local inference endpoint (e.g., Ollama)");
  }

  const localProviders = internalProviders.filter(p => p.type === "local");
  if (localProviders.length === 0) {
    bottlenecks.push("No self-hosted model serving available");
    recommendations.push("Set up Ollama or similar local model server");
  }

  const hasProxyFallback = internalProviders.some(p => p.type === "proxy");
  if (!hasProxyFallback) {
    recommendations.push("Configure a proxy fallback for resilience");
  }

  const stats = await getTotalCallStats(24);
  const internalRatio = stats.total > 0 ? stats.internal / stats.total : 0;

  if (internalRatio < 0.5) {
    bottlenecks.push(`Only ${Math.round(internalRatio * 100)}% of calls currently route internally`);
    recommendations.push("Increase internal routing percentage to reduce external dependency");
  }

  const estimatedSuccessRate = internalProviders.length > 0
    ? Math.min(0.95, 0.5 + (internalProviders.length * 0.1) + (internalRatio * 0.4))
    : 0.05;

  const readinessScore = Math.round(
    (internalProviders.length > 0 ? 30 : 0) +
    (localProviders.length > 0 ? 30 : 0) +
    (internalRatio * 25) +
    (estimatedSuccessRate * 15)
  );

  try {
    await db.insert(sovereigntyMetricsTable).values({
      totalCalls: stats.total,
      externalCalls: stats.external,
      internalCalls: stats.internal,
      internalRatio,
      sovereigntyScore: readinessScore,
      detachmentReadiness: readinessScore,
      performanceParityScore: 50,
      avgExternalLatencyMs: stats.avgExternalLatencyMs,
      avgInternalLatencyMs: stats.avgInternalLatencyMs,
      activeProviders: internalProviders.length + externalProviders.length,
      externalProviders: externalProviders.length,
      internalProviders: internalProviders.length,
      dryRunSimulated: true,
      dryRunSuccessRate: estimatedSuccessRate,
    });
  } catch (err) {
    logger.error({ err }, "Failed to persist dry-run metrics");
  }

  return {
    simulated: true,
    internalProvidersAvailable: internalProviders.map(p => p.name),
    externalProvidersDisabled: externalProviders.map(p => p.name),
    estimatedSuccessRate,
    bottlenecks,
    readinessScore,
    recommendations,
  };
}

export async function getLatestSovereigntyMetrics(limit = 10) {
  try {
    return await db.select().from(sovereigntyMetricsTable)
      .orderBy(desc(sovereigntyMetricsTable.computedAt))
      .limit(limit);
  } catch {
    return [];
  }
}
