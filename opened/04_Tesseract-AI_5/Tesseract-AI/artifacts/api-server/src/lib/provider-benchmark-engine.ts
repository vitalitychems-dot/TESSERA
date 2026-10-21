/**
 * Provider Benchmark Engine — Real LLM Provider Latency, Accuracy & Cost Measurement
 *
 * Measures real performance by:
 * 1. Timing actual LLM API calls for latency
 * 2. Running fixed test prompts with known correct answers for accuracy
 * 3. Computing tokens-per-second and cost-per-token from response metadata
 *
 * Results are stored in provider_benchmarks table for leaderboard display.
 * Fail-closed: if a provider is unavailable, it gets score=0, available=false.
 */

import { db } from "@workspace/db";
import { provider_benchmarks } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { openai, isLLMConfigured } from "./llm-client";
import { extractCount } from "./db-utils";

const LOG = "[ProviderBenchmark]";
const log = (m: string) => console.log(`${LOG} ${m}`);
const warn = (m: string) => console.warn(`${LOG} WARN: ${m}`);

interface TestPrompt {
  id: string;
  prompt: string;
  expectedKeywords: string[];
  category: "math" | "logic" | "factual" | "coding";
}

const BENCHMARK_PROMPTS: TestPrompt[] = [
  {
    id: "math-1",
    prompt: "What is 17 × 23? Respond with only the number.",
    expectedKeywords: ["391"],
    category: "math",
  },
  {
    id: "math-2",
    prompt: "What is the square root of 169? Respond with only the number.",
    expectedKeywords: ["13"],
    category: "math",
  },
  {
    id: "logic-1",
    prompt: "If all A are B, and all B are C, are all A also C? Respond with only YES or NO.",
    expectedKeywords: ["YES"],
    category: "logic",
  },
  {
    id: "logic-2",
    prompt: "Is the number 97 a prime number? Respond with only YES or NO.",
    expectedKeywords: ["YES"],
    category: "logic",
  },
  {
    id: "factual-1",
    prompt: "How many planets are in our solar system? Respond with only the number.",
    expectedKeywords: ["8"],
    category: "factual",
  },
  {
    id: "coding-1",
    prompt: "In Python, what does len([1,2,3]) return? Respond with only the number.",
    expectedKeywords: ["3"],
    category: "coding",
  },
];

export interface ProviderBenchmarkResult {
  benchmarkId: string;
  provider: string;
  model: string;
  available: boolean;
  latencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  accuracyScore: number;
  tokensPerSecond: number;
  costPerThousandTokens: number;
  testsPassed: number;
  testsTotal: number;
  testResults: {
    id: string;
    category: string;
    latencyMs: number;
    passed: boolean;
    response: string;
  }[];
  errorMessage?: string;
  ranAt: number;
}

async function runSingleTest(
  testPrompt: TestPrompt,
  model: string,
): Promise<{ latencyMs: number; passed: boolean; response: string; tokensGenerated: number }> {
  const start = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model,
      max_completion_tokens: 20,
      messages: [
        {
          role: "system",
          content: "You are a precise answering system. Answer the question exactly as instructed with minimal tokens.",
        },
        { role: "user", content: testPrompt.prompt },
      ],
    });

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content?.trim() ?? "";
    const tokensGenerated = response.usage?.completion_tokens ?? 0;

    const passed = testPrompt.expectedKeywords.some(keyword =>
      content.toLowerCase().includes(keyword.toLowerCase()),
    );

    return { latencyMs, passed, response: content.slice(0, 100), tokensGenerated };
  } catch (err: any) {
    return { latencyMs: Date.now() - start, passed: false, response: `ERROR: ${err?.message?.slice(0, 80)}`, tokensGenerated: 0 };
  }
}

function computePercentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((pct / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

export async function runProviderBenchmark(
  provider: string,
  model: string,
): Promise<ProviderBenchmarkResult> {
  const benchmarkId = `pb-${provider}-${model}-${Date.now().toString(36)}`.replace(/[^a-z0-9-]/gi, "-");
  const ranAt = Date.now();

  log(`Benchmarking provider=${provider} model=${model}`);

  if (!isLLMConfigured()) {
    const result: ProviderBenchmarkResult = {
      benchmarkId,
      provider,
      model,
      available: false,
      latencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      accuracyScore: 0,
      tokensPerSecond: 0,
      costPerThousandTokens: 0,
      testsPassed: 0,
      testsTotal: BENCHMARK_PROMPTS.length,
      testResults: [],
      errorMessage: "LLM not configured — no API key available",
      ranAt,
    };
    await persistProviderBenchmark(result);
    return result;
  }

  const testResults: ProviderBenchmarkResult["testResults"] = [];
  const latencies: number[] = [];
  let totalTokens = 0;
  let testsPassed = 0;

  for (const prompt of BENCHMARK_PROMPTS) {
    const r = await runSingleTest(prompt, model);
    latencies.push(r.latencyMs);
    totalTokens += r.tokensGenerated;
    if (r.passed) testsPassed++;
    testResults.push({
      id: prompt.id,
      category: prompt.category,
      latencyMs: r.latencyMs,
      passed: r.passed,
      response: r.response,
    });
    log(`  [${prompt.id}] ${r.passed ? "PASS" : "FAIL"} — ${r.latencyMs}ms — "${r.response.slice(0, 40)}"`);
  }

  const avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const p50LatencyMs = Math.round(computePercentile(latencies, 50));
  const p95LatencyMs = Math.round(computePercentile(latencies, 95));
  const accuracyScore = Math.round((testsPassed / BENCHMARK_PROMPTS.length) * 100);
  const totalTimeSeconds = latencies.reduce((a, b) => a + b, 0) / 1000;
  const tokensPerSecond = totalTimeSeconds > 0 ? Math.round(totalTokens / totalTimeSeconds) : 0;

  const KNOWN_COSTS: Record<string, number> = {
    "gpt-4o": 0.005,
    "gpt-4o-mini": 0.0002,
    "gpt-4-turbo": 0.01,
    "gpt-3.5-turbo": 0.0005,
    "claude-3-5-sonnet": 0.003,
    "claude-3-haiku": 0.00025,
    "gemini-1.5-pro": 0.0035,
    "gemini-1.5-flash": 0.00035,
  };
  const costPerThousandTokens = KNOWN_COSTS[model] ?? 0;

  const result: ProviderBenchmarkResult = {
    benchmarkId,
    provider,
    model,
    available: true,
    latencyMs: avgLatencyMs,
    p50LatencyMs,
    p95LatencyMs,
    accuracyScore,
    tokensPerSecond,
    costPerThousandTokens,
    testsPassed,
    testsTotal: BENCHMARK_PROMPTS.length,
    testResults,
    ranAt,
  };

  log(`Benchmark complete: accuracy=${accuracyScore}% avg_latency=${avgLatencyMs}ms p95=${p95LatencyMs}ms`);
  await persistProviderBenchmark(result);
  return result;
}

async function persistProviderBenchmark(result: ProviderBenchmarkResult): Promise<void> {
  try {
    await db.insert(provider_benchmarks).values({
      benchmarkId: result.benchmarkId,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      p50LatencyMs: result.p50LatencyMs,
      p95LatencyMs: result.p95LatencyMs,
      accuracyScore: result.accuracyScore,
      tokensPerSecond: result.tokensPerSecond,
      costPerThousandTokens: result.costPerThousandTokens,
      testsPassed: result.testsPassed,
      testsTotal: result.testsTotal,
      testResults: result.testResults as unknown as Record<string, unknown>[],
      available: result.available,
      errorMessage: result.errorMessage ?? null,
      ranAt: new Date(result.ranAt),
    }).onConflictDoNothing();
  } catch (err: any) {
    warn(`Failed to persist provider benchmark: ${err?.message}`);
  }
}

export async function runAllProviderBenchmarks(): Promise<ProviderBenchmarkResult[]> {
  log("Running full provider benchmark suite");

  const providers: { provider: string; model: string }[] = [
    { provider: "openai", model: "gpt-4o-mini" },
    { provider: "openai", model: "gpt-4o" },
  ];

  const results: ProviderBenchmarkResult[] = [];
  for (const p of providers) {
    try {
      const result = await runProviderBenchmark(p.provider, p.model);
      results.push(result);
    } catch (err: any) {
      warn(`Provider benchmark failed for ${p.provider}/${p.model}: ${err?.message}`);
    }
  }

  log(`Provider benchmark suite complete — ${results.filter(r => r.available).length}/${results.length} providers available`);
  return results;
}

export async function getProviderLeaderboard(): Promise<{
  leaderboard: {
    rank: number;
    provider: string;
    model: string;
    accuracyScore: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    tokensPerSecond: number;
    costPerThousandTokens: number;
    available: boolean;
    lastBenchmarkedAt: number;
  }[];
  totalBenchmarks: number;
}> {
  try {
    const latestByModel = await db.execute(sql`
      SELECT DISTINCT ON (model) 
        benchmark_id, provider, model, accuracy_score, latency_ms, p95_latency_ms,
        tokens_per_second, cost_per_thousand_tokens, available, ran_at
      FROM provider_benchmarks
      ORDER BY model, ran_at DESC
    `);

    const rows = (Array.isArray(latestByModel) ? latestByModel : (latestByModel as { rows?: unknown[] })?.rows ?? []);

    const sorted = [...rows].sort((a: any, b: any) => {
      const scoreA = (a.accuracy_score ?? 0) * 0.6 - (a.latency_ms ?? 9999) * 0.0001;
      const scoreB = (b.accuracy_score ?? 0) * 0.6 - (b.latency_ms ?? 9999) * 0.0001;
      return scoreB - scoreA;
    });

    const countRow = await db.execute(sql`SELECT COUNT(*) as cnt FROM provider_benchmarks`);
    const totalBenchmarks = extractCount(countRow);

    return {
      leaderboard: sorted.map((r: any, idx: number) => ({
        rank: idx + 1,
        provider: r.provider ?? "",
        model: r.model ?? "",
        accuracyScore: Math.round(r.accuracy_score ?? 0),
        avgLatencyMs: Math.round(r.latency_ms ?? 0),
        p95LatencyMs: Math.round(r.p95_latency_ms ?? 0),
        tokensPerSecond: Math.round(r.tokens_per_second ?? 0),
        costPerThousandTokens: r.cost_per_thousand_tokens ?? 0,
        available: r.available ?? false,
        lastBenchmarkedAt: r.ran_at ? new Date(r.ran_at).getTime() : 0,
      })),
      totalBenchmarks,
    };
  } catch (err: any) {
    warn(`Failed to get provider leaderboard: ${err?.message}`);
    return { leaderboard: [], totalBenchmarks: 0 };
  }
}
