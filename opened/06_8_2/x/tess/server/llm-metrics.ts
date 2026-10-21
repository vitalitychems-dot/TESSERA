import { db } from "./db";
import { llmCallMetrics, type InsertLlmCallMetric } from "@shared/schema";
import { desc, sql, gte, and } from "drizzle-orm";

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4.1": { input: 0.002, output: 0.008 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
  "gpt-5": { input: 0.003, output: 0.012 },
  "gpt-5-mini": { input: 0.0008, output: 0.0032 },
  "claude-3-5-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku": { input: 0.0008, output: 0.004 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
  "llama-3.3-70b": { input: 0.00059, output: 0.00079 },
  "llama-3.1-70b": { input: 0.00059, output: 0.00079 },
  "llama-3.1-8b": { input: 0.00005, output: 0.00008 },
  "mixtral-8x7b": { input: 0.00024, output: 0.00024 },
  "deepseek-v3": { input: 0.00027, output: 0.0011 },
  "deepseek-r1": { input: 0.00055, output: 0.00219 },
  "qwen-qwq-32b": { input: 0.0012, output: 0.0018 },
  "command-r-plus": { input: 0.0025, output: 0.01 },
  "mistral-small": { input: 0.0001, output: 0.0003 },
  "default": { input: 0.001, output: 0.002 },
};

function estimateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  const modelLower = model.toLowerCase();
  let costs = COST_PER_1K_TOKENS["default"];

  for (const [key, val] of Object.entries(COST_PER_1K_TOKENS)) {
    if (modelLower.includes(key.toLowerCase())) {
      costs = val;
      break;
    }
  }

  const providerLower = provider.toLowerCase();
  let multiplier = 1.0;
  if (providerLower.includes("pollinations")) multiplier = 0;
  else if (providerLower.includes("openrouter")) multiplier = 1.0;
  else if (providerLower.includes("groq")) multiplier = 0.9;

  return ((promptTokens / 1000) * costs.input + (completionTokens / 1000) * costs.output) * multiplier;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const TASK_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/chat|conversation|message|response/i, "chat"],
  [/code|program|function|implement|debug|fix/i, "code"],
  [/summariz|summary|abstract|tldr/i, "summarization"],
  [/analyz|analysis|evaluate|assess/i, "analysis"],
  [/translat|language|localize/i, "translation"],
  [/search|query|retriev|find/i, "retrieval"],
  [/embed|vector|similarity/i, "embedding"],
  [/train|learn|improve|optimize/i, "training"],
  [/generat|creat|write|compose/i, "generation"],
  [/classif|categoriz|label/i, "classification"],
];

function detectTaskType(prompt: string, systemPrompt: string = ""): string {
  const combined = `${prompt} ${systemPrompt}`.toLowerCase();
  for (const [pattern, type] of TASK_TYPE_PATTERNS) {
    if (pattern.test(combined)) return type;
  }
  return "general";
}

let metricsBuffer: InsertLlmCallMetric[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 50;

async function flushMetricsBuffer(): Promise<void> {
  if (metricsBuffer.length === 0) return;
  const toFlush = metricsBuffer.splice(0, metricsBuffer.length);
  try {
    await db.insert(llmCallMetrics).values(toFlush);
  } catch (err: any) {
    console.warn("[LLMMetrics] Failed to flush metrics:", err.message);
    metricsBuffer.unshift(...toFlush.slice(0, 10));
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushMetricsBuffer();
  }, FLUSH_INTERVAL_MS);
}

export function recordLlmCall(params: {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  responseText?: string;
  promptText?: string;
  latencyMs: number;
  success: boolean;
  errorType?: string;
  agentId?: string;
  taskType?: string;
  systemPrompt?: string;
}): void {
  const promptTokens = params.promptTokens ?? (params.promptText ? estimateTokens(params.promptText) : 0);
  const completionTokens = params.completionTokens ?? (params.responseText ? estimateTokens(params.responseText) : 0);
  const totalTokens = promptTokens + completionTokens;
  const costUsd = estimateCost(params.provider, params.model, promptTokens, completionTokens);
  const taskType = params.taskType || detectTaskType(params.promptText || "", params.systemPrompt || "");

  metricsBuffer.push({
    agentId: params.agentId,
    provider: params.provider,
    model: params.model,
    promptTokens,
    completionTokens,
    totalTokens,
    latencyMs: params.latencyMs,
    costUsd,
    taskType,
    success: params.success ? 1 : 0,
    errorType: params.errorType,
  });

  if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
    flushMetricsBuffer().catch(console.warn);
  } else {
    scheduleFlush();
  }

  if (params.agentId && totalTokens > 0) {
    import("./token-budget-manager")
      .then(({ recordTokenUsage }) => recordTokenUsage(params.agentId!, totalTokens))
      .catch(() => {});
  }
}

export async function getLlmMetricsSummary(windowHours: number = 24): Promise<{
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  byProvider: Array<{ provider: string; calls: number; tokens: number; costUsd: number; avgLatencyMs: number; successRate: number }>;
  byTaskType: Array<{ taskType: string; calls: number; tokens: number; costUsd: number }>;
  costTrend: string;
}> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  try {
    const [summary, byProvider, byTaskType] = await Promise.all([
      db.select({
        totalCalls: sql<number>`count(*)`,
        successfulCalls: sql<number>`sum(case when ${llmCallMetrics.success} = 1 then 1 else 0 end)`,
        totalTokens: sql<number>`sum(${llmCallMetrics.totalTokens})`,
        totalCostUsd: sql<number>`sum(${llmCallMetrics.costUsd})`,
        avgLatencyMs: sql<number>`avg(${llmCallMetrics.latencyMs})`,
      }).from(llmCallMetrics)
        .where(gte(llmCallMetrics.createdAt, since)),

      db.select({
        provider: llmCallMetrics.provider,
        calls: sql<number>`count(*)`,
        tokens: sql<number>`sum(${llmCallMetrics.totalTokens})`,
        costUsd: sql<number>`sum(${llmCallMetrics.costUsd})`,
        avgLatencyMs: sql<number>`avg(${llmCallMetrics.latencyMs})`,
        successRate: sql<number>`avg(${llmCallMetrics.success}) * 100`,
      }).from(llmCallMetrics)
        .where(gte(llmCallMetrics.createdAt, since))
        .groupBy(llmCallMetrics.provider)
        .orderBy(sql`sum(${llmCallMetrics.costUsd}) desc`)
        .limit(20),

      db.select({
        taskType: llmCallMetrics.taskType,
        calls: sql<number>`count(*)`,
        tokens: sql<number>`sum(${llmCallMetrics.totalTokens})`,
        costUsd: sql<number>`sum(${llmCallMetrics.costUsd})`,
      }).from(llmCallMetrics)
        .where(gte(llmCallMetrics.createdAt, since))
        .groupBy(llmCallMetrics.taskType)
        .orderBy(sql`count(*) desc`),
    ]);

    const s = summary[0];
    const total = Number(s?.totalCalls || 0);
    const successful = Number(s?.successfulCalls || 0);

    const prevSince = new Date(since.getTime() - windowHours * 60 * 60 * 1000);
    const prevCost = await db.select({
      totalCostUsd: sql<number>`sum(${llmCallMetrics.costUsd})`,
    }).from(llmCallMetrics)
      .where(and(gte(llmCallMetrics.createdAt, prevSince), sql`${llmCallMetrics.createdAt} < ${since}`));

    const currentCost = Number(s?.totalCostUsd || 0);
    const previousCost = Number(prevCost[0]?.totalCostUsd || 0);
    let costTrend = "stable";
    if (previousCost > 0) {
      const pct = ((currentCost - previousCost) / previousCost) * 100;
      if (pct > 10) costTrend = `+${pct.toFixed(1)}% vs previous period`;
      else if (pct < -10) costTrend = `${pct.toFixed(1)}% vs previous period`;
      else costTrend = `stable (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)`;
    }

    return {
      totalCalls: total,
      successfulCalls: successful,
      failedCalls: total - successful,
      totalTokens: Number(s?.totalTokens || 0),
      totalCostUsd: Math.round(currentCost * 100000) / 100000,
      avgLatencyMs: Math.round(Number(s?.avgLatencyMs || 0)),
      byProvider: byProvider.map(p => ({
        provider: p.provider,
        calls: Number(p.calls),
        tokens: Number(p.tokens || 0),
        costUsd: Math.round(Number(p.costUsd || 0) * 100000) / 100000,
        avgLatencyMs: Math.round(Number(p.avgLatencyMs || 0)),
        successRate: Math.round(Number(p.successRate || 0)),
      })),
      byTaskType: byTaskType.map(t => ({
        taskType: t.taskType,
        calls: Number(t.calls),
        tokens: Number(t.tokens || 0),
        costUsd: Math.round(Number(t.costUsd || 0) * 100000) / 100000,
      })),
      costTrend,
    };
  } catch (err: any) {
    console.warn("[LLMMetrics] Failed to get summary:", err.message);
    return {
      totalCalls: 0, successfulCalls: 0, failedCalls: 0,
      totalTokens: 0, totalCostUsd: 0, avgLatencyMs: 0,
      byProvider: [], byTaskType: [], costTrend: "unknown",
    };
  }
}

export async function getOptimalProvider(taskType: string = "general"): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const results = await db.select({
      provider: llmCallMetrics.provider,
      avgLatencyMs: sql<number>`avg(${llmCallMetrics.latencyMs})`,
      successRate: sql<number>`avg(${llmCallMetrics.success}) * 100`,
      avgCostPerCall: sql<number>`avg(${llmCallMetrics.costUsd})`,
    }).from(llmCallMetrics)
      .where(and(
        gte(llmCallMetrics.createdAt, since),
        sql`${llmCallMetrics.taskType} = ${taskType}`
      ))
      .groupBy(llmCallMetrics.provider)
      .having(sql`count(*) >= 5`);

    if (results.length === 0) return null;

    const scored = results.map(r => {
      const latency = Number(r.avgLatencyMs || 5000);
      const successRate = Number(r.successRate || 50);
      const cost = Number(r.avgCostPerCall || 0.001);
      const score = (successRate / 100) * 0.4 + (1 - Math.min(1, latency / 10000)) * 0.4 + (1 - Math.min(1, cost / 0.01)) * 0.2;
      return { provider: r.provider, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.provider || null;
  } catch (err: any) {
    console.warn("[LLMMetrics] Failed to get optimal provider:", err.message);
    return null;
  }
}

console.log("[LLMMetrics] LLM call metrics tracker initialized");
