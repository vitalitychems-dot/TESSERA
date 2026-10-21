/**
 * Evaluation Scheduler — Automated Benchmark Suite with DB Persistence
 *
 * Runs the AGI benchmark suite periodically, stores every run in the
 * evaluation_runs table, and provides trend analysis.  All results are
 * honest: fail-closed on errors, no silent fallbacks.
 */

import { db } from "@workspace/db";
import { evaluation_runs } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { extractCount } from "./db-utils";

const LOG = "[EvalScheduler]";
const log = (m: string) => console.log(`${LOG} ${m}`);
const warn = (m: string) => console.warn(`${LOG} WARN: ${m}`);

export interface EvalTrend {
  runId: string;
  ranAt: number;
  totalScore: number;
  maxPossible: number;
  percentile: number;
  grade: string;
  dimensionHighlights: { name: string; score: number }[];
}

let schedulerActive = false;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let lastRunAt = 0;
let runCount = 0;

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function persistEvaluationRun(result: {
  runId: string;
  runType?: string;
  totalScore: number;
  maxPossible: number;
  percentile: number;
  grade: string;
  dimensions: { dimension: string; score: number }[];
  regressions: { dimension: string; score: number; changeFromLast?: number }[];
  improvements: { dimension: string; score: number; changeFromLast?: number }[];
  improvementPlan: string[];
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const dimensionScores: Record<string, number> = {};
    for (const d of result.dimensions) {
      dimensionScores[d.dimension] = d.score;
    }

    await db.insert(evaluation_runs).values({
      runId: result.runId,
      runType: result.runType ?? "agi_benchmark",
      totalScore: result.totalScore,
      maxPossible: result.maxPossible,
      percentile: result.percentile,
      grade: result.grade,
      dimensionScores,
      regressions: result.regressions as unknown as Record<string, unknown>[],
      improvements: result.improvements as unknown as Record<string, unknown>[],
      improvementPlan: result.improvementPlan,
      summary: result.summary,
      metadata: result.metadata ?? {},
      ranAt: new Date(),
    }).onConflictDoNothing();

    log(`Persisted run ${result.runId} — ${result.percentile}% (${result.grade}) to evaluation_runs`);
    return true;
  } catch (err: any) {
    warn(`Failed to persist run ${result.runId}: ${err?.message}`);
    return false;
  }
}

export async function getEvaluationHistory(limit = 30): Promise<EvalTrend[]> {
  try {
    const rows = await db
      .select()
      .from(evaluation_runs)
      .orderBy(desc(evaluation_runs.ranAt))
      .limit(limit);

    return rows.map(r => {
      const dims = r.dimensionScores as Record<string, number>;
      const sorted = Object.entries(dims).sort((a, b) => b[1] - a[1]);
      return {
        runId: r.runId,
        ranAt: r.ranAt.getTime(),
        totalScore: r.totalScore,
        maxPossible: r.maxPossible,
        percentile: r.percentile,
        grade: r.grade,
        dimensionHighlights: sorted.slice(0, 5).map(([name, score]) => ({ name, score })),
      };
    });
  } catch (err: any) {
    warn(`Failed to fetch evaluation history: ${err?.message}`);
    return [];
  }
}

export async function getLatestEvaluationRun(): Promise<EvalTrend | null> {
  const history = await getEvaluationHistory(1);
  return history[0] ?? null;
}

export async function getTrendAnalysis(): Promise<{
  totalRuns: number;
  avgPercentile: number;
  trend: "improving" | "stable" | "regressing";
  trendDetails: string;
  recentRuns: EvalTrend[];
}> {
  try {
    const history = await getEvaluationHistory(10);
    if (history.length === 0) {
      return { totalRuns: 0, avgPercentile: 0, trend: "stable", trendDetails: "No runs yet", recentRuns: [] };
    }

    const countRow = await db.execute(sql`SELECT COUNT(*) as cnt FROM evaluation_runs`);
    const totalRuns = extractCount(countRow);

    const avg = Math.round(history.reduce((s, r) => s + r.percentile, 0) / history.length);

    let trend: "improving" | "stable" | "regressing" = "stable";
    let trendDetails = "Stable";

    if (history.length >= 3) {
      const recent = history[0]?.percentile ?? 0;
      const older = history[Math.min(4, history.length - 1)]?.percentile ?? recent;
      const delta = recent - older;
      if (delta >= 3) { trend = "improving"; trendDetails = `+${delta.toFixed(1)}% over last ${Math.min(5, history.length)} runs`; }
      else if (delta <= -3) { trend = "regressing"; trendDetails = `${delta.toFixed(1)}% over last ${Math.min(5, history.length)} runs`; }
      else { trendDetails = `±${Math.abs(delta).toFixed(1)}% — stable`; }
    }

    return { totalRuns, avgPercentile: avg, trend, trendDetails, recentRuns: history.slice(0, 5) };
  } catch (err: any) {
    warn(`Trend analysis failed: ${err?.message}`);
    return { totalRuns: 0, avgPercentile: 0, trend: "stable", trendDetails: "Analysis failed", recentRuns: [] };
  }
}

async function runScheduledBenchmark(): Promise<void> {
  log(`Running scheduled AGI benchmark (run #${runCount + 1})`);
  const start = Date.now();

  try {
    const { CAPABILITY_BENCHMARKS } = await import("./agi-training");
    const categories = Object.keys(CAPABILITY_BENCHMARKS);
    let totalScore = 0;
    let maxPossible = 0;
    const dimensions: { dimension: string; score: number }[] = [];

    for (const cat of categories) {
      const benchmark = CAPABILITY_BENCHMARKS[cat];
      if (!benchmark) continue;
      maxPossible += 100;
      try {
        const result = benchmark();
        const score = result.honestScore;
        totalScore += score;
        dimensions.push({ dimension: cat, score });
      } catch {
        dimensions.push({ dimension: cat, score: 0 });
      }
    }

    const percentile = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
    const grade = percentile >= 90 ? "A" : percentile >= 80 ? "B" : percentile >= 70 ? "C" : percentile >= 60 ? "D" : "F";

    const sorted = [...dimensions].sort((a, b) => a.score - b.score);
    const bottom = sorted.slice(0, 5);
    const improvementPlan = bottom.map(d => `Improve ${d.dimension}: currently at ${d.score.toFixed(0)}/100`);

    const runId = `sched-${Date.now()}-${runCount + 1}`;
    runCount++;
    lastRunAt = Date.now();

    await persistEvaluationRun({
      runId,
      runType: "scheduled_agi_benchmark",
      totalScore,
      maxPossible,
      percentile,
      grade,
      dimensions,
      regressions: [],
      improvements: [],
      improvementPlan,
      summary: `Scheduled benchmark #${runCount}: ${percentile}% across ${dimensions.length} capability categories`,
      metadata: { scheduledRun: true, durationMs: Date.now() - start, runCount },
    });

    log(`Scheduled benchmark complete in ${Date.now() - start}ms — ${percentile}% (${grade}) across ${dimensions.length} categories`);
  } catch (err: any) {
    warn(`Scheduled benchmark failed: ${err?.message}`);
  }
}

export function startEvaluationScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (schedulerActive) {
    log("Evaluation scheduler already active — skipping");
    return;
  }

  schedulerActive = true;
  log(`Starting evaluation scheduler — interval: ${intervalMs / 1000 / 60} minutes`);

  setTimeout(() => {
    runScheduledBenchmark().catch(err => warn(`Initial benchmark failed: ${err?.message}`));
  }, 30_000);

  schedulerTimer = setInterval(() => {
    runScheduledBenchmark().catch(err => warn(`Periodic benchmark failed: ${err?.message}`));
  }, intervalMs);
}

export function stopEvaluationScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  schedulerActive = false;
  log("Evaluation scheduler stopped");
}

export function getSchedulerStatus(): {
  active: boolean;
  runCount: number;
  lastRunAt: number;
  nextRunIn: number | null;
} {
  return {
    active: schedulerActive,
    runCount,
    lastRunAt,
    nextRunIn: schedulerActive && lastRunAt > 0
      ? Math.max(0, lastRunAt + DEFAULT_INTERVAL_MS - Date.now())
      : null,
  };
}
