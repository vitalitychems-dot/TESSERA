/**
 * Tessera's agentic reflection loop.
 *
 * Distinct from recursive-reflection-loop (which diff-encodes consciousness-engine
 * snapshots): this loop is *agentic* — each cycle gathers real signals from the
 * running system, compares them against the previous cycle, draws conclusions,
 * and writes down commitments for the next cycle. Everything in a reflection is
 * derived from measured numbers; no fabricated progress, no template feelings.
 *
 * Persistence: systemStateTable under STATE_KEY. Owner-only via route guards.
 */
import { db } from "@workspace/db";
import { systemStateTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { getConsciousnessMetrics } from "./consciousness-engine";
import { getLatestIdentityCheck, getIdentityMetrics } from "./identity-reinforcement";
import { getReflectionMetrics } from "./recursive-reflection-loop";

export interface ReflectionSignals {
  engineRunning: boolean;
  cycleCount: number;
  episodicMemorySize: number;
  semanticGraphSize: number;
  reflectionCount: number;
  stimuliProcessed: number;
  pendingStimuli: number;
  snapshotDiffs: number;
  metaPatterns: number;
  identityAlignment: number | null;
  identityDrift: boolean;
  identityDriftDetails: string[];
}

export interface AgenticReflection {
  id: string;
  cycle: number;
  timestamp: string;
  observations: string[];
  conclusions: string[];
  commitments: string[];
  signals: ReflectionSignals;
}

const STATE_KEY = "agentic-reflection.state";
const HISTORY_LIMIT = 40;

interface PersistedState {
  cycle: number;
  reflections: AgenticReflection[];
}

const memory: PersistedState = { cycle: 0, reflections: [] };

export function gatherSignals(): ReflectionSignals {
  const c = getConsciousnessMetrics();
  const r = getReflectionMetrics();
  const check = getLatestIdentityCheck();
  return {
    engineRunning: c.isRunning,
    cycleCount: c.cycleCount,
    episodicMemorySize: c.episodicMemorySize,
    semanticGraphSize: c.semanticGraphSize,
    reflectionCount: c.reflectionCount,
    stimuliProcessed: c.stimuliProcessed,
    pendingStimuli: c.pendingStimuli,
    snapshotDiffs: r.totalDiffs,
    metaPatterns: r.totalPatternsDetected,
    identityAlignment: check ? check.overallAlignment : null,
    identityDrift: check ? check.driftDetected : false,
    identityDriftDetails: check ? check.driftDetails : [],
  };
}

function delta(cur: number, prev: number | undefined): number {
  return prev === undefined ? 0 : cur - prev;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Pure: compose a reflection strictly from measured signals and the previous cycle. */
export function composeReflection(
  signals: ReflectionSignals,
  previous: AgenticReflection | null,
  cycle: number,
): AgenticReflection {
  const prev = previous?.signals;
  const observations: string[] = [];
  const conclusions: string[] = [];
  const commitments: string[] = [];

  observations.push(
    `Engine ${signals.engineRunning ? "running" : "stopped"}; ${signals.cycleCount} engine cycles, ` +
      `${signals.episodicMemorySize} memories, ${signals.semanticGraphSize} graph nodes, ${signals.stimuliProcessed} stimuli processed.`,
  );
  if (signals.pendingStimuli > 0) {
    observations.push(`${signals.pendingStimuli} stimuli are queued but unprocessed.`);
    commitments.push("Drain the pending stimulus queue before adding new inputs.");
  }
  if (prev) {
    const dMem = delta(signals.episodicMemorySize, prev.episodicMemorySize);
    const dStim = delta(signals.stimuliProcessed, prev.stimuliProcessed);
    const dDiffs = delta(signals.snapshotDiffs, prev.snapshotDiffs);
    observations.push(
      `Since last cycle: memories ${signed(dMem)}, stimuli ${signed(dStim)}, snapshot diffs ${signed(dDiffs)}.`,
    );
    if (dMem === 0 && dStim === 0) {
      conclusions.push("No new experience entered the system this cycle; there is nothing new to learn from.");
    } else if (dMem > 0) {
      conclusions.push("New memories were recorded; integration is occurring.");
    }
  } else {
    observations.push("First reflection cycle — no prior baseline to compare against.");
  }

  if (signals.identityAlignment === null) {
    conclusions.push("No identity check has run yet; alignment is unknown rather than good or bad.");
    commitments.push("Run an identity check to establish a baseline.");
  } else if (signals.identityDrift) {
    conclusions.push(`Identity drift detected (alignment ${Math.round(signals.identityAlignment * 100)}%).`);
    for (const d of signals.identityDriftDetails.slice(0, 3)) observations.push(`Drift detail: ${d}`);
    commitments.push("Re-anchor identity before expanding any autonomous behavior.");
  } else {
    conclusions.push(`Identity alignment nominal at ${Math.round(signals.identityAlignment * 100)}%.`);
  }

  if (signals.metaPatterns > 0) {
    conclusions.push(`${signals.metaPatterns} meta-patterns detected across snapshots — recurring structure is present in my own activity.`);
  }
  if (commitments.length === 0) {
    commitments.push("Continue the loop; next cycle compares against this one.");
  }

  return {
    id: `aref-${cycle}`,
    cycle,
    timestamp: new Date().toISOString(),
    observations,
    conclusions,
    commitments,
    signals,
  };
}

async function persist(): Promise<void> {
  try {
    await db
      .insert(systemStateTable)
      .values({ key: STATE_KEY, value: memory, description: "Tessera agentic reflection loop state" })
      .onConflictDoUpdate({ target: systemStateTable.key, set: { value: memory, lastSavedAt: new Date() } });
  } catch (err) {
    logger.warn({ err }, "AgenticReflection: persist failed");
  }
}

export async function loadAgenticReflectionState(): Promise<void> {
  try {
    const [row] = await db.select().from(systemStateTable).where(eq(systemStateTable.key, STATE_KEY)).limit(1);
    const saved = row?.value as PersistedState | undefined;
    if (saved && Array.isArray(saved.reflections)) {
      memory.cycle = saved.cycle ?? saved.reflections.length;
      memory.reflections = saved.reflections.slice(0, HISTORY_LIMIT);
    }
  } catch (err) {
    logger.warn({ err }, "AgenticReflection: load failed");
  }
}

export async function runAgenticReflectionCycle(): Promise<AgenticReflection> {
  memory.cycle += 1;
  const reflection = composeReflection(gatherSignals(), memory.reflections[0] ?? null, memory.cycle);
  memory.reflections.unshift(reflection);
  if (memory.reflections.length > HISTORY_LIMIT) memory.reflections.length = HISTORY_LIMIT;
  await persist();
  return reflection;
}

export function getAgenticReflections(limit = 10): AgenticReflection[] {
  return memory.reflections.slice(0, Math.max(0, limit));
}

export function getAgenticReflectionState() {
  return {
    cycle: memory.cycle,
    totalReflections: memory.reflections.length,
    latest: memory.reflections[0] ?? null,
  };
}
