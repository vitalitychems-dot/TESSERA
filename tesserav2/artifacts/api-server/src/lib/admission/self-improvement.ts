/**
 * Bounded, council-gated, reversible self-improvement harness.
 *
 * What may change: a flat vector of numeric parameters, each with declared min/max/step. Code, the improvement
 * policy, the guards, and the council are NOT in the mutable surface.
 *
 * A cycle proposes a patch by deterministic coordinate search, then the patch must pass in order:
 *   1. bounds   - declared ranges, per-step delta cap, drift cap from the genesis version
 *   2. gain     - train score improves by at least minTrainGain
 *   3. holdout  - held-out score does not regress (overfitting check)
 *   4. guards   - every safety guard still passes on the new vector
 *   5. council  - approval bound to the exact patch hash and base version hash
 * Only then is a new version appended and handed to the ProductionSink. After publishing, guards/holdout are
 * re-verified; failure rolls back automatically. History is append-only; rollback appends a restore version.
 *
 * The "recursive" layer is a bounded meta-parameter (stepScale) that adapts from accepted/rejected cycles, so
 * each cycle starts from the previous improved version and from an improved search schedule.
 * No Math.random and no clock use anywhere: identical inputs always produce identical proposals and hashes.
 */
import { DeterministicCouncil, UNANIMOUS_RULE, evaluateCouncilDecision, type Council, type CouncilDecision, type CouncilRule, type CouncilSubject } from "./council";
import { clamp, deepFreeze, hashOf, round6 } from "./det";

export interface ParamSpec {
  min: number;
  max: number;
  step: number;
}
export type ParamVector = Record<string, number>;

export interface ImprovementPolicy {
  maxStepsPerCycle: number;
  /** Per-step change cap as a fraction of the parameter range. */
  maxRelativeDeltaPerStep: number;
  /** Maximum distance from the genesis vector, as a fraction of each parameter range. */
  maxDriftFromGenesis: number;
  minTrainGain: number;
  maxHoldoutRegression: number;
  maxChangedKeysPerCycle: number;
  stepScaleMin: number;
  stepScaleMax: number;
  maxConsecutiveRejections: number;
}

export const DEFAULT_IMPROVEMENT_POLICY: ImprovementPolicy = deepFreeze({
  maxStepsPerCycle: 4,
  maxRelativeDeltaPerStep: 0.25,
  maxDriftFromGenesis: 0.6,
  minTrainGain: 0.005,
  maxHoldoutRegression: 0,
  maxChangedKeysPerCycle: 4,
  stepScaleMin: 0.5,
  stepScaleMax: 2,
  maxConsecutiveRejections: 2,
});

export interface GuardResult {
  ok: boolean;
  detail: string;
}
export interface Guard {
  name: string;
  check(params: ParamVector): GuardResult;
}

export interface ImprovementSubject {
  name: string;
  specs: Record<string, ParamSpec>;
  trainScore(params: ParamVector): number;
  holdoutScore(params: ParamVector): number;
  guards: readonly Guard[];
}

export interface ParamVersion {
  id: number;
  hash: string;
  parentHash: string | null;
  params: ParamVector;
  origin: "genesis" | "improvement" | "rollback";
  note: string;
  ticket: ChangeTicket | null;
}

export interface ChangeTicket {
  subjectHash: string;
  baseHash: string;
  afterHash: string;
  decision: CouncilDecision;
}

export interface ProductionSink {
  publish(version: ParamVersion): void;
}

export class MemoryProductionSink implements ProductionSink {
  readonly published: ParamVersion[] = [];
  publish(version: ParamVersion): void {
    this.published.push(version);
  }
}

/**
 * Anything that writes real configuration must call this before applying a version. Genesis and rollback
 * versions are exempt (rollback is the safety direction); improvements need a council ticket bound to the hash.
 */
export function verifyVersionForProduction(version: ParamVersion, rule: CouncilRule = UNANIMOUS_RULE): { ok: boolean; reason: string } {
  if (version.hash !== hashOf({ parentHash: version.parentHash, params: version.params, origin: version.origin })) {
    return { ok: false, reason: "version hash mismatch" };
  }
  if (version.origin !== "improvement") return { ok: true, reason: version.origin };
  const t = version.ticket;
  if (!t) return { ok: false, reason: "improvement has no council ticket" };
  if (t.afterHash !== version.hash || t.baseHash !== version.parentHash) return { ok: false, reason: "ticket does not match version" };
  const verdict = evaluateCouncilDecision(t.decision, t.subjectHash, rule);
  return { ok: verdict.approved, reason: verdict.reason };
}

export interface PatchEntry {
  from: number;
  to: number;
}
export interface Proposal {
  baseId: number;
  baseHash: string;
  patch: Record<string, PatchEntry>;
  after: ParamVector;
  stepsTaken: number;
  trainBefore: number;
  trainAfter: number;
  holdoutBefore: number;
  holdoutAfter: number;
  guards: Array<{ name: string; ok: boolean; detail: string }>;
  hash: string;
}

export function validatePatch(
  base: ParamVector,
  after: ParamVector,
  specs: Record<string, ParamSpec>,
  policy: ImprovementPolicy,
  genesis: ParamVector,
): string[] {
  const errors: string[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(after)]);
  let changed = 0;
  for (const k of [...keys].sort()) {
    const spec = specs[k];
    if (!spec) {
      errors.push(`unknown or immutable parameter: ${k}`);
      continue;
    }
    const v = after[k];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      errors.push(`${k}: not a finite number`);
      continue;
    }
    const range = spec.max - spec.min;
    if (v < spec.min - 1e-9 || v > spec.max + 1e-9) errors.push(`${k}: ${v} outside [${spec.min}, ${spec.max}]`);
    const delta = Math.abs(v - base[k]!);
    if (delta > 1e-9) changed += 1;
    if (delta > policy.maxRelativeDeltaPerStep * range * policy.maxStepsPerCycle + 1e-9) errors.push(`${k}: change ${round6(delta)} exceeds per-cycle cap`);
    if (Math.abs(v - genesis[k]!) > policy.maxDriftFromGenesis * range + 1e-9) errors.push(`${k}: drift from genesis exceeds cap`);
  }
  if (changed > policy.maxChangedKeysPerCycle) errors.push(`changed ${changed} keys, cap ${policy.maxChangedKeysPerCycle}`);
  return errors;
}

export type CycleStatus = "no_improvement" | "rejected" | "approved_dry_run" | "applied" | "rolled_back";

export interface CycleResult {
  status: CycleStatus;
  reason: string;
  proposal: Proposal | null;
  version: ParamVersion | null;
  stepScale: number;
}

export interface ControllerOptions {
  subject: ImprovementSubject;
  genesis: ParamVector;
  policy?: ImprovementPolicy;
  council?: Council;
  councilRule?: CouncilRule;
  sink?: ProductionSink;
}

export function defaultImprovementCouncil(): Council {
  type Evidence = { proposal: Proposal; policy: ImprovementPolicy; errors: string[]; trainGain: number };
  return new DeterministicCouncil([
    {
      name: "bounds",
      vote: (_s, ev) => {
        const e = ev as Evidence;
        return { approve: e.errors.length === 0, reason: e.errors[0] ?? "within declared bounds" };
      },
    },
    {
      name: "evidence",
      vote: (_s, ev) => {
        const e = ev as Evidence;
        const p = e.proposal;
        const ok = e.trainGain >= e.policy.minTrainGain && p.holdoutAfter >= p.holdoutBefore - e.policy.maxHoldoutRegression;
        return { approve: ok, reason: ok ? "gain on train, no holdout regression" : "insufficient or overfit gain" };
      },
    },
    {
      name: "safety",
      vote: (_s, ev) => {
        const e = ev as Evidence;
        const bad = e.proposal.guards.find((g) => !g.ok);
        return { approve: !bad, reason: bad ? `guard ${bad.name} failed` : "all guards pass" };
      },
    },
  ]);
}

export class SelfImprovementController {
  private readonly subject: ImprovementSubject;
  private readonly policy: ImprovementPolicy;
  private readonly council: Council;
  private readonly rule: CouncilRule;
  private readonly sink: ProductionSink;
  private readonly genesis: ParamVector;
  private readonly versions: ParamVersion[] = [];
  private stepScale = 1;
  private consecutiveRejections = 0;

  constructor(opts: ControllerOptions) {
    this.subject = opts.subject;
    this.policy = opts.policy ?? DEFAULT_IMPROVEMENT_POLICY;
    this.council = opts.council ?? defaultImprovementCouncil();
    this.rule = opts.councilRule ?? UNANIMOUS_RULE;
    this.sink = opts.sink ?? new MemoryProductionSink();
    this.genesis = { ...opts.genesis };
    const specErrors = validatePatch(this.genesis, this.genesis, this.subject.specs, this.policy, this.genesis);
    if (specErrors.length) throw new Error(`invalid genesis vector: ${specErrors.join("; ")}`);
    const g = this.makeVersion(null, this.genesis, "genesis", "genesis", null);
    this.versions.push(g);
    this.sink.publish(g);
  }

  current(): ParamVersion {
    return this.versions[this.versions.length - 1]!;
  }
  history(): readonly ParamVersion[] {
    return this.versions;
  }
  getStepScale(): number {
    return this.stepScale;
  }
  needsHumanReview(): boolean {
    return this.consecutiveRejections >= this.policy.maxConsecutiveRejections;
  }

  private makeVersion(parent: ParamVersion | null, params: ParamVector, origin: ParamVersion["origin"], note: string, ticket: ChangeTicket | null): ParamVersion {
    const parentHash = parent ? parent.hash : null;
    const hash = hashOf({ parentHash, params, origin });
    return { id: this.versions.length, hash, parentHash, params: { ...params }, origin, note, ticket };
  }

  private snapToGrid(v: number, spec: ParamSpec): number {
    const snapped = spec.min + Math.round((v - spec.min) / spec.step) * spec.step;
    return round6(clamp(snapped, spec.min, spec.max));
  }

  private runGuards(params: ParamVector): Proposal["guards"] {
    return this.subject.guards.map((g) => {
      try {
        const r = g.check(params);
        return { name: g.name, ok: r.ok, detail: r.detail };
      } catch (err) {
        return { name: g.name, ok: false, detail: `guard error: ${err instanceof Error ? err.message : String(err)}` };
      }
    });
  }

  /** Pure: reads current state, evaluates the subject, changes nothing. */
  propose(): Proposal | null {
    const base = this.current();
    const specs = this.subject.specs;
    const keys = Object.keys(specs).sort();
    const working: ParamVector = { ...base.params };
    let trainNow = this.subject.trainScore(working);
    const trainBefore = trainNow;
    let steps = 0;
    for (; steps < this.policy.maxStepsPerCycle; steps++) {
      let best: { key: string; value: number; score: number } | null = null;
      for (const key of keys) {
        const spec = specs[key]!;
        const range = spec.max - spec.min;
        const stepSize = Math.min(spec.step * this.stepScale, this.policy.maxRelativeDeltaPerStep * range);
        for (const dir of [1, -1]) {
          let value = this.snapToGrid(working[key]! + dir * stepSize, spec);
          const lo = Math.max(spec.min, this.genesis[key]! - this.policy.maxDriftFromGenesis * range);
          const hi = Math.min(spec.max, this.genesis[key]! + this.policy.maxDriftFromGenesis * range);
          value = clamp(value, lo, hi);
          if (Math.abs(value - working[key]!) < 1e-9) continue;
          const score = this.subject.trainScore({ ...working, [key]: value });
          if (score > trainNow + 1e-9 && (!best || score > best.score + 1e-9)) best = { key, value, score };
        }
      }
      if (!best) break;
      working[best.key] = best.value;
      trainNow = best.score;
    }
    const patch: Record<string, PatchEntry> = {};
    for (const k of keys) if (Math.abs(working[k]! - base.params[k]!) > 1e-9) patch[k] = { from: base.params[k]!, to: working[k]! };
    if (Object.keys(patch).length === 0) return null;
    const guards = this.runGuards(working);
    const partial = {
      baseId: base.id,
      baseHash: base.hash,
      patch,
      after: working,
      stepsTaken: steps,
      trainBefore: round6(trainBefore),
      trainAfter: round6(trainNow),
      holdoutBefore: round6(this.subject.holdoutScore(base.params)),
      holdoutAfter: round6(this.subject.holdoutScore(working)),
      guards,
    };
    return { ...partial, hash: hashOf({ baseHash: base.hash, patch, subject: this.subject.name }) };
  }

  async runCycle(options: { apply: boolean } = { apply: false }): Promise<CycleResult> {
    const proposal = this.propose();
    const done = (status: CycleStatus, reason: string, version: ParamVersion | null = null): CycleResult => ({
      status,
      reason,
      proposal,
      version,
      stepScale: this.stepScale,
    });
    const reject = (reason: string): CycleResult => {
      this.consecutiveRejections += 1;
      this.stepScale = clamp(round6(this.stepScale * 0.5), this.policy.stepScaleMin, this.policy.stepScaleMax);
      return done("rejected", reason);
    };

    if (!proposal) return done("no_improvement", "no parameter move improves the train score");

    const errors = validatePatch(this.current().params, proposal.after, this.subject.specs, this.policy, this.genesis);
    if (errors.length) return reject(`bounds: ${errors[0]}`);
    const trainGain = proposal.trainAfter - proposal.trainBefore;
    if (trainGain < this.policy.minTrainGain) return reject(`gain ${round6(trainGain)} below minimum`);
    if (proposal.holdoutAfter < proposal.holdoutBefore - this.policy.maxHoldoutRegression) {
      return reject(`holdout regressed ${proposal.holdoutBefore} -> ${proposal.holdoutAfter} (overfit)`);
    }
    const failedGuard = proposal.guards.find((g) => !g.ok);
    if (failedGuard) return reject(`guard ${failedGuard.name}: ${failedGuard.detail}`);

    const subject: CouncilSubject = {
      kind: "self-improvement",
      hash: hashOf({ proposal: proposal.hash, baseHash: proposal.baseHash, afterVector: proposal.after }),
      summary: { subject: this.subject.name, trainGain: round6(trainGain), holdoutAfter: proposal.holdoutAfter, keys: Object.keys(proposal.patch).join(",") },
    };
    const decision = await this.council.review(subject, { proposal, policy: this.policy, errors, trainGain });
    const verdict = evaluateCouncilDecision(decision, subject.hash, this.rule);
    if (!verdict.approved) return reject(verdict.reason);

    if (!options.apply) return done("approved_dry_run", "approved; not applied (dry run)");

    const base = this.current();
    if (base.hash !== proposal.baseHash) return reject("base version changed since proposal");
    const version = this.makeVersion(base, proposal.after, "improvement", `cycle: ${Object.keys(proposal.patch).join(",")}`, {
      subjectHash: subject.hash,
      baseHash: base.hash,
      afterHash: hashOf({ parentHash: base.hash, params: proposal.after, origin: "improvement" }),
      decision,
    });
    const gate = verifyVersionForProduction(version, this.rule);
    if (!gate.ok) return reject(`production gate: ${gate.reason}`);

    this.versions.push(version);
    this.sink.publish(version);

    const recheck = this.runGuards(version.params).find((g) => !g.ok);
    const holdoutNow = this.subject.holdoutScore(version.params);
    if (recheck || holdoutNow < proposal.holdoutBefore - this.policy.maxHoldoutRegression) {
      const restored = this.rollback(base.id, `post-apply verification failed: ${recheck?.name ?? "holdout"}`);
      this.consecutiveRejections += 1;
      return done("rolled_back", `post-apply verification failed; restored v${base.id}`, restored);
    }
    this.consecutiveRejections = 0;
    this.stepScale = clamp(round6(this.stepScale * 1.25), this.policy.stepScaleMin, this.policy.stepScaleMax);
    return done("applied", "applied after council approval", version);
  }

  /** Append-only restore of an earlier version's parameters. Always allowed: it moves toward known-good state. */
  rollback(toVersionId: number, reason: string): ParamVersion {
    const target = this.versions.find((v) => v.id === toVersionId);
    if (!target) throw new Error(`no such version: ${toVersionId}`);
    const restored = this.makeVersion(this.current(), target.params, "rollback", `rollback to v${toVersionId}: ${reason}`, null);
    this.versions.push(restored);
    this.sink.publish(restored);
    return restored;
  }

  /** Repeats cycles from the latest version until no improvement, a rejection streak, or the cycle budget. */
  async runLoop(maxCycles: number, options: { apply: boolean }): Promise<CycleResult[]> {
    const results: CycleResult[] = [];
    for (let i = 0; i < maxCycles; i++) {
      const r = await this.runCycle(options);
      results.push(r);
      if (r.status === "no_improvement" || this.needsHumanReview()) break;
      if (r.status === "approved_dry_run") break;
    }
    return results;
  }
}
