import { normalizeEvolutionModule } from "./evolution-modules";

export const M3_MAX_DEFERRED_SHARE_PCT = 25;
export const M3_MIN_PATCHED_MODULES_PCT = 50;
export const M3_FAILING_STREAK = 5;

export interface EvolutionModuleCounters {
  moduleId: string;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  totalOfflineApplied: number;
  totalRolledBack: number;
  totalDeferred: number;
  cooldownRemainingMs: number;
  paused: boolean;
}

export interface GateCheck {
  pass: boolean;
  /** true when the check passes only because there is no data (it must not count toward the release gate). */
  vacuous: boolean;
  value: number | string | null;
  threshold: string;
}

export interface EvolutionHealthSummary {
  trackedModules: number;
  attempts: number;
  totals: {
    verifiedApplied: number;
    offlineApplied: number;
    failed: number;
    deferred: number;
    rolledBack: number;
  };
  /** deferred / (deferred + verifiedApplied + failed), percent. null when there are no attempts. */
  deferredSharePct: number | null;
  /** verifiedApplied / (deferred + verifiedApplied + failed), percent. null when there are no attempts. */
  verifiedApplyRatePct: number | null;
  coolingOrFailingModules: string[];
  modulesWithOfflinePatch: string[];
  modulesWithOfflinePatchPct: number;
  gate: {
    m3aNoCoolingModules: GateCheck;
    m3bOfflinePatchedModules: GateCheck;
    m3cDeferredShare: GateCheck;
    soak: string;
    meetsM3Snapshot: boolean;
  };
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Honest evolution-module health. Counts only patches that were applied and
 * verified. A deferred attempt (no code generator, no source tree, no offline
 * recipe) is reported on its own and is never folded into a success rate.
 * `tracked` is the module list the gate measures against; modules with no
 * attempts yet still count in the denominator.
 */
export function summarizeEvolutionHealth(
  modules: readonly EvolutionModuleCounters[],
  tracked: readonly string[],
): EvolutionHealthSummary {
  const trackedIds = Array.from(new Set(tracked.map(normalizeEvolutionModule)));
  const byId = new Map(modules.map(m => [m.moduleId, m] as const));

  let verifiedApplied = 0;
  let offlineApplied = 0;
  let failed = 0;
  let deferred = 0;
  let rolledBack = 0;
  const coolingOrFailing: string[] = [];
  const withOfflinePatch: string[] = [];

  for (const m of modules) {
    verifiedApplied += m.totalSuccesses;
    offlineApplied += m.totalOfflineApplied;
    failed += m.totalFailures;
    deferred += m.totalDeferred;
    rolledBack += m.totalRolledBack;
  }

  for (const id of trackedIds) {
    const m = byId.get(id);
    if (!m) continue;
    if (m.paused || m.cooldownRemainingMs > 0 || m.consecutiveFailures >= M3_FAILING_STREAK) {
      coolingOrFailing.push(id);
    }
    if (m.totalOfflineApplied >= 1) withOfflinePatch.push(id);
  }

  const attempts = deferred + verifiedApplied + failed;
  const deferredSharePct = pct(deferred, attempts);
  const verifiedApplyRatePct = pct(verifiedApplied, attempts);
  const modulesWithOfflinePatchPct = pct(withOfflinePatch.length, trackedIds.length) ?? 0;

  const m3a: GateCheck = {
    pass: coolingOrFailing.length === 0,
    vacuous: attempts === 0,
    value: coolingOrFailing.length,
    threshold: `0 tracked modules cooling down or with consecutiveFailures >= ${M3_FAILING_STREAK}`,
  };
  const m3b: GateCheck = {
    pass: modulesWithOfflinePatchPct >= M3_MIN_PATCHED_MODULES_PCT,
    vacuous: false,
    value: modulesWithOfflinePatchPct,
    threshold: `>= ${M3_MIN_PATCHED_MODULES_PCT}% of tracked modules with at least one verified offline patch`,
  };
  const m3c: GateCheck = {
    pass: deferredSharePct !== null && deferredSharePct <= M3_MAX_DEFERRED_SHARE_PCT,
    vacuous: attempts === 0,
    value: deferredSharePct,
    threshold: `deferred / (deferred + verified applied + failed) <= ${M3_MAX_DEFERRED_SHARE_PCT}%`,
  };

  return {
    trackedModules: trackedIds.length,
    attempts,
    totals: { verifiedApplied, offlineApplied, failed, deferred, rolledBack },
    deferredSharePct,
    verifiedApplyRatePct,
    coolingOrFailingModules: coolingOrFailing,
    modulesWithOfflinePatch: withOfflinePatch,
    modulesWithOfflinePatchPct,
    gate: {
      m3aNoCoolingModules: m3a,
      m3bOfflinePatchedModules: m3b,
      m3cDeferredShare: m3c,
      soak: "not measured: this is an instantaneous snapshot, the gate needs a 24h soak",
      meetsM3Snapshot: m3a.pass && !m3a.vacuous && m3b.pass && m3c.pass && !m3c.vacuous,
    },
  };
}
