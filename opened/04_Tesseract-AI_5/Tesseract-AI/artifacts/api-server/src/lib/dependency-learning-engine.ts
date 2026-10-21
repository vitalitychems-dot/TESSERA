import { db } from "@workspace/db";
import { external_call_logs, learning_insights } from "@workspace/db";
import { desc, sql, eq, and, gte } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

const LOG_PREFIX = "[DependencyLearning]";

interface PatternAnalysis {
  avgResponseLength: number;
  avgLatencyMs: number;
  successRate: number;
  commonStructures: string[];
  reasoningIndicators: string[];
  failureModes: string[];
  hallucinationSignatures: string[];
  edgeCasePatterns: string[];
}

let learningCycleCount = 0;
let totalInsightsGenerated = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;

function detectHallucinationSignatures(responses: string[]): string[] {
  const signatures: string[] = [];
  const hallucinationIndicators = [
    { pattern: /\bI (cannot|can't) (access|browse|search)\b/i, label: "capability_denial" },
    { pattern: /\bAs of (my )?knowledge cutoff\b/i, label: "temporal_cutoff_disclaimer" },
    { pattern: /\bI (don't|do not) have (real-time|current|live)\b/i, label: "real_time_denial" },
    { pattern: /\b(?:according to|based on) (?:my|the) (?:training|data)/i, label: "training_reference" },
    { pattern: /\b(?:I believe|I think|I'm not sure)\b/i, label: "uncertainty_hedge" },
    { pattern: /\b(?:approximately|around|roughly|about) [\d,]+ (?:people|items|cases)\b/i, label: "imprecise_quantification" },
  ];

  for (const indicator of hallucinationIndicators) {
    const matches = responses.filter(r => indicator.pattern.test(r));
    if (matches.length > 0) {
      signatures.push(`${indicator.label}: seen in ${matches.length}/${responses.length} responses`);
    }
  }

  return signatures;
}

function detectReasoningPatterns(responses: string[]): string[] {
  const patterns: string[] = [];

  const chainOfThoughtCount = responses.filter(r => /\bstep [\d]+\b|\bfirst(ly)?,?\b.*\bsecond(ly)?,?\b/i.test(r)).length;
  if (chainOfThoughtCount > 0) {
    patterns.push(`chain_of_thought: ${chainOfThoughtCount}/${responses.length} responses use step-by-step reasoning`);
  }

  const exampleCount = responses.filter(r => /for example|for instance|e\.g\.|such as/i.test(r)).length;
  if (exampleCount > 0) {
    patterns.push(`exemplification: ${exampleCount}/${responses.length} responses use examples`);
  }

  const contrastCount = responses.filter(r => /however|on the other hand|in contrast|whereas/i.test(r)).length;
  if (contrastCount > 0) {
    patterns.push(`contrastive_reasoning: ${contrastCount}/${responses.length} responses use contrast`);
  }

  const bulletCount = responses.filter(r => /^[\s]*[-•*]\s/m.test(r)).length;
  if (bulletCount > 0) {
    patterns.push(`bullet_point_format: ${bulletCount}/${responses.length} responses use bullet lists`);
  }

  return patterns;
}

function detectEdgeCasePatterns(responses: string[], logs: Array<{ latencyMs: number; success: boolean; requestPayload?: unknown }>): string[] {
  const patterns: string[] = [];

  const veryShort = responses.filter(r => r.length < 50);
  if (veryShort.length > 0) {
    patterns.push(`very_short_responses: ${veryShort.length}/${responses.length} (<50 chars)`);
  }

  const refusalPhrases = ["i cannot", "i'm unable", "i can't", "i am unable", "not able to", "as an ai,"];
  const refusals = responses.filter(r => refusalPhrases.some(p => r.toLowerCase().includes(p)));
  if (refusals.length > 0) {
    patterns.push(`refusals: ${refusals.length}/${responses.length} responses contain refusal phrases`);
  }

  const repetitions = responses.filter(r => {
    const words = r.toLowerCase().split(/\s+/);
    const wordSet = new Set(words);
    return words.length > 10 && wordSet.size / words.length < 0.5;
  });
  if (repetitions.length > 0) {
    patterns.push(`repetitive_output: ${repetitions.length}/${responses.length} responses show high word repetition`);
  }

  const latencyOutliers = logs.filter(l => l.latencyMs > 15000);
  if (latencyOutliers.length > 0) {
    patterns.push(`latency_outliers: ${latencyOutliers.length} calls exceeded 15s (edge load condition)`);
  }

  const truncated = responses.filter(r => /\.\.\.$|…$/.test(r.trim()) || r.length > 8000);
  if (truncated.length > 0) {
    patterns.push(`possible_truncation: ${truncated.length}/${responses.length} responses may be cut off`);
  }

  return patterns;
}

function detectFailureModes(logs: Array<{ success: boolean; errorMessage?: string | null; latencyMs: number }>): string[] {
  const modes: string[] = [];

  const errors = logs.filter(l => !l.success);
  if (errors.length > 0) {
    const errorTypes = new Map<string, number>();
    for (const err of errors) {
      const msg = err.errorMessage ?? "unknown";
      const key = msg.length > 50 ? msg.slice(0, 50) : msg;
      errorTypes.set(key, (errorTypes.get(key) ?? 0) + 1);
    }
    for (const [msg, count] of errorTypes.entries()) {
      modes.push(`error:${msg} (${count}x)`);
    }
  }

  const highLatency = logs.filter(l => l.latencyMs > 5000);
  if (highLatency.length > 0) {
    modes.push(`high_latency: ${highLatency.length}/${logs.length} calls exceed 5s`);
  }

  const timeout = logs.filter(l => l.latencyMs > 25000);
  if (timeout.length > 0) {
    modes.push(`near_timeout: ${timeout.length} calls near 30s timeout`);
  }

  return modes;
}

async function analyzeProviderLogs(providerId: string, taskDomain: string): Promise<PatternAnalysis | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const logs = await db.select().from(external_call_logs)
    .where(and(
      eq(external_call_logs.providerId, providerId),
      eq(external_call_logs.taskType, taskDomain),
      gte(external_call_logs.createdAt, since),
    ))
    .orderBy(desc(external_call_logs.createdAt))
    .limit(500);

  if (logs.length < 3) return null;

  const responses = logs.map(l => l.responseText ?? "").filter(Boolean);
  const avgResponseLength = responses.length > 0
    ? Math.round(responses.reduce((a, b) => a + b.length, 0) / responses.length)
    : 0;
  const avgLatencyMs = Math.round(logs.reduce((a, b) => a + b.latencyMs, 0) / logs.length);
  const successCount = logs.filter(l => l.success).length;
  const successRate = Math.round((successCount / logs.length) * 100);

  const commonStructures: string[] = [];
  const jsonResponseCount = responses.filter(r => {
    try { JSON.parse(r); return true; } catch { return false; }
  }).length;
  if (jsonResponseCount > responses.length * 0.3) {
    commonStructures.push(`json_responses: ${jsonResponseCount}/${responses.length}`);
  }
  const markdownCount = responses.filter(r => /^#{1,6}\s/m.test(r) || /```/.test(r)).length;
  if (markdownCount > responses.length * 0.2) {
    commonStructures.push(`markdown_format: ${markdownCount}/${responses.length}`);
  }

  return {
    avgResponseLength,
    avgLatencyMs,
    successRate,
    commonStructures,
    reasoningIndicators: detectReasoningPatterns(responses),
    failureModes: detectFailureModes(logs),
    hallucinationSignatures: detectHallucinationSignatures(responses),
    edgeCasePatterns: detectEdgeCasePatterns(responses, logs),
  };
}

async function persistInsight(
  providerId: string,
  taskDomain: string,
  analysis: PatternAnalysis,
  sampleCount: number
): Promise<void> {
  const insightId = `li-${providerId}-${taskDomain}-${crypto.randomBytes(3).toString("hex")}`;

  const title = `${providerId} behavior pattern for ${taskDomain}`;
  const description = [
    `Analyzed ${sampleCount} calls to ${providerId} for ${taskDomain} tasks.`,
    `Success rate: ${analysis.successRate}%. Avg latency: ${analysis.avgLatencyMs}ms. Avg response: ${analysis.avgResponseLength} chars.`,
    analysis.failureModes.length > 0 ? `Failure modes detected: ${analysis.failureModes.length}.` : "No significant failure modes.",
    analysis.hallucinationSignatures.length > 0 ? `Hallucination signatures: ${analysis.hallucinationSignatures.join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  await db.insert(learning_insights).values({
    insightId,
    providerId,
    taskDomain,
    insightType: "pattern",
    title,
    description,
    confidence: Math.min(1.0, sampleCount / 100),
    sampleCount,
    reasoningPatterns: analysis.reasoningIndicators,
    failureModes: analysis.failureModes,
    hallucinationSignatures: analysis.hallucinationSignatures,
    edgeCases: analysis.edgeCasePatterns,
    responseFormatPatterns: {
      avgResponseLength: analysis.avgResponseLength,
      commonStructures: analysis.commonStructures,
      successRate: analysis.successRate,
      avgLatencyMs: analysis.avgLatencyMs,
    },
    metadata: { analyzedAt: new Date().toISOString(), sampleCount },
  }).onConflictDoNothing();

  totalInsightsGenerated++;
}

export async function runLearningCycle(): Promise<{
  cycleNumber: number;
  providersAnalyzed: number;
  insightsGenerated: number;
  topPatterns: string[];
}> {
  learningCycleCount++;
  const start = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} DEPENDENCY LEARNING CYCLE #${learningCycleCount}`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  let providersAnalyzed = 0;
  let insightsThisCycle = 0;
  const topPatterns: string[] = [];

  try {
    const providerRows = await db.execute(sql`
      SELECT provider_id, task_type, COUNT(*) as cnt
      FROM external_call_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY provider_id, task_type
      HAVING COUNT(*) >= 3
      ORDER BY cnt DESC
      LIMIT 20
    `);

    type ProviderRow = { provider_id: string; task_type: string; cnt: string | number };
    const providers = ((providerRows as { rows?: ProviderRow[] }).rows ?? (providerRows as unknown as ProviderRow[]));

    for (const row of providers) {
      const providerId = row.provider_id;
      const taskDomain = row.task_type;
      const sampleCount = Number(row.cnt ?? 0);

      console.log(`${LOG_PREFIX}   Analyzing ${providerId} for ${taskDomain} (${sampleCount} samples)`);

      const analysis = await analyzeProviderLogs(providerId, taskDomain);
      if (!analysis) continue;

      await persistInsight(providerId, taskDomain, analysis, sampleCount);
      providersAnalyzed++;
      insightsThisCycle++;

      if (analysis.reasoningIndicators.length > 0) {
        topPatterns.push(`${providerId}/${taskDomain}: ${analysis.reasoningIndicators[0]}`);
      }
      if (analysis.hallucinationSignatures.length > 0) {
        topPatterns.push(`${providerId}/${taskDomain}: hallucination=${analysis.hallucinationSignatures[0]}`);
      }
    }
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Learning cycle error`);
  }

  const duration = Date.now() - start;
  console.log(`${LOG_PREFIX} CYCLE #${learningCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Providers analyzed: ${providersAnalyzed} | Insights generated: ${insightsThisCycle} | Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return {
    cycleNumber: learningCycleCount,
    providersAnalyzed,
    insightsGenerated: insightsThisCycle,
    topPatterns: topPatterns.slice(0, 10),
  };
}

export async function getLearningInsights(params: {
  providerId?: string;
  taskDomain?: string;
  limit?: number;
}): Promise<typeof learning_insights.$inferSelect[]> {
  try {
    const conditions = [];
    if (params.providerId) conditions.push(eq(learning_insights.providerId, params.providerId));
    if (params.taskDomain) conditions.push(eq(learning_insights.taskDomain, params.taskDomain));

    const query = db.select().from(learning_insights);
    return conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(learning_insights.createdAt)).limit(params.limit ?? 50)
      : await query.orderBy(desc(learning_insights.createdAt)).limit(params.limit ?? 50);
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} getLearningInsights failed`);
    return [];
  }
}

export function getLearningStatus() {
  return {
    cycleCount: learningCycleCount,
    totalInsightsGenerated,
    continuousActive: continuousInterval !== null,
  };
}

export function startContinuousLearning(): void {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting continuous dependency learning (every 30 minutes)`);
  runLearningCycle().catch(err => logger.warn({ err }, `${LOG_PREFIX} Initial cycle failed`));
  continuousInterval = setInterval(() => {
    runLearningCycle().catch(err => logger.warn({ err }, `${LOG_PREFIX} Cycle failed`));
  }, 30 * 60 * 1000);
}

export function stopContinuousLearning(): void {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Continuous learning stopped`);
  }
}
