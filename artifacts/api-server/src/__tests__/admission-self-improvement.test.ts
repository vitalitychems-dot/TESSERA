import { describe, it, expect } from "vitest";
import { DeterministicCouncil, type Council } from "../lib/admission/council";
import {
  DEFAULT_IMPROVEMENT_POLICY,
  MemoryProductionSink,
  SelfImprovementController,
  validatePatch,
  verifyVersionForProduction,
  type Guard,
  type ImprovementSubject,
} from "../lib/admission/self-improvement";

const specs = { x: { min: 0, max: 10, step: 1 }, y: { min: 0, max: 10, step: 1 } };
const bowl = (cx: number, cy: number) => (p: Record<string, number>) => 1 - ((p.x! - cx) ** 2 + (p.y! - cy) ** 2) / 200;

function subject(over: Partial<ImprovementSubject> = {}): ImprovementSubject {
  return { name: "bowl", specs, trainScore: bowl(7, 3), holdoutScore: bowl(7, 3), guards: [], ...over };
}
const GENESIS = { x: 2, y: 8 };

describe("bounded self-improvement", () => {
  it("climbs toward the optimum only within per-cycle step and total-drift bounds", async () => {
    const c = new SelfImprovementController({ subject: subject(), genesis: GENESIS });
    const r = await c.runCycle({ apply: true });
    expect(r.status).toBe("applied");
    const p = c.current().params;
    expect(Math.abs(p.x! - 2) + Math.abs(p.y! - 8)).toBeLessThanOrEqual(DEFAULT_IMPROVEMENT_POLICY.maxStepsPerCycle);
    const loop = await c.runLoop(20, { apply: true });
    expect(loop.length).toBeLessThan(20);
    const final = c.current().params;
    expect(Math.abs(final.x! - 2)).toBeLessThanOrEqual(DEFAULT_IMPROVEMENT_POLICY.maxDriftFromGenesis * 10 + 1e-9);
    expect(Math.abs(final.y! - 8)).toBeLessThanOrEqual(DEFAULT_IMPROVEMENT_POLICY.maxDriftFromGenesis * 10 + 1e-9);
    expect(Math.abs(final.x! - 7)).toBeLessThanOrEqual(1);
    expect(Math.abs(final.y! - 3)).toBeLessThanOrEqual(1);
  });

  it("drift cap stops a subject whose optimum lies outside the allowed region", async () => {
    const c = new SelfImprovementController({ subject: subject({ trainScore: bowl(10, 10), holdoutScore: bowl(10, 10) }), genesis: { x: 1, y: 1 } });
    await c.runLoop(20, { apply: true });
    expect(c.current().params.x).toBeLessThanOrEqual(1 + 6);
    expect(c.current().params.y).toBeLessThanOrEqual(1 + 6);
  });

  it("validatePatch rejects unknown keys, out-of-range values, NaN and oversized or too-many-key changes", () => {
    const base = { x: 5, y: 5 };
    const pol = DEFAULT_IMPROVEMENT_POLICY;
    expect(validatePatch(base, { x: 5, y: 5 }, specs, pol, base)).toEqual([]);
    expect(validatePatch(base, { x: 5, y: 5, policy: 1 }, specs, pol, base).join()).toMatch(/unknown or immutable/);
    expect(validatePatch(base, { x: 11, y: 5 }, specs, pol, base).join()).toMatch(/outside/);
    expect(validatePatch(base, { x: Number.NaN, y: 5 }, specs, pol, base).join()).toMatch(/finite/);
    expect(validatePatch({ x: 0, y: 0 }, { x: 10, y: 0 }, specs, { ...pol, maxDriftFromGenesis: 1, maxStepsPerCycle: 2 }, { x: 0, y: 0 }).join()).toMatch(/per-cycle cap/);
    expect(validatePatch(base, { x: 6, y: 6 }, specs, { ...pol, maxChangedKeysPerCycle: 1 }, base).join()).toMatch(/changed 2 keys/);
    expect(validatePatch(base, { x: 6, y: 5 }, specs, { ...pol, maxDriftFromGenesis: 0.05 }, base).join()).toMatch(/drift/);
  });

  it("the improvement policy is immutable at runtime", () => {
    expect(Object.isFrozen(DEFAULT_IMPROVEMENT_POLICY)).toBe(true);
    expect(() => {
      (DEFAULT_IMPROVEMENT_POLICY as { maxStepsPerCycle: number }).maxStepsPerCycle = 1000;
    }).toThrow();
  });

  it("rejects gains that regress the held-out score (overfitting) and writes nothing", async () => {
    const sink = new MemoryProductionSink();
    const c = new SelfImprovementController({ subject: subject({ holdoutScore: bowl(0, 10) }), genesis: GENESIS, sink });
    const r = await c.runCycle({ apply: true });
    expect(r.status).toBe("rejected");
    expect(r.reason).toMatch(/holdout regressed/);
    expect(c.history()).toHaveLength(1);
    expect(sink.published).toHaveLength(1);
  });

  it("rejects when a safety guard fails on the proposed vector", async () => {
    const guard: Guard = { name: "x-stays-low", check: (p) => ({ ok: p.x! <= 3, detail: `x=${p.x}` }) };
    const sink = new MemoryProductionSink();
    const c = new SelfImprovementController({ subject: subject({ guards: [guard] }), genesis: GENESIS, sink });
    const r = await c.runCycle({ apply: true });
    expect(r.status).toBe("rejected");
    expect(r.reason).toMatch(/guard x-stays-low/);
    expect(sink.published).toHaveLength(1);
  });

  it("council denial blocks the write; approval for another patch does not transfer", async () => {
    const deny = new DeterministicCouncil([1, 2, 3].map((i) => ({ name: `s${i}`, vote: () => ({ approve: i !== 2, reason: i !== 2 ? "ok" : "too risky" }) })));
    const sink = new MemoryProductionSink();
    const c = new SelfImprovementController({ subject: subject(), genesis: GENESIS, council: deny, sink });
    expect((await c.runCycle({ apply: true })).status).toBe("rejected");
    expect(sink.published).toHaveLength(1);

    const replay: Council = { review: () => ({ subjectHash: "approved-something-else", votes: [1, 2, 3].map((i) => ({ seat: `s${i}`, approve: true, reason: "ok" })) }) };
    const c2 = new SelfImprovementController({ subject: subject(), genesis: GENESIS, council: replay, sink: new MemoryProductionSink() });
    const r2 = await c2.runCycle({ apply: true });
    expect(r2.status).toBe("rejected");
    expect(r2.reason).toMatch(/different subject/);
  });

  it("dry run proposes and gets approval but changes nothing", async () => {
    const sink = new MemoryProductionSink();
    const c = new SelfImprovementController({ subject: subject(), genesis: GENESIS, sink });
    const r = await c.runCycle({ apply: false });
    expect(r.status).toBe("approved_dry_run");
    expect(c.history()).toHaveLength(1);
    expect(sink.published).toHaveLength(1);
    expect(c.current().params).toEqual(GENESIS);
  });

  it("is reversible: rollback appends a restore version and history is never rewritten", async () => {
    const sink = new MemoryProductionSink();
    const c = new SelfImprovementController({ subject: subject(), genesis: GENESIS, sink });
    await c.runCycle({ apply: true });
    const afterApply = c.history().length;
    const hashes = c.history().map((v) => v.hash);
    const restored = c.rollback(0, "operator request");
    expect(restored.params).toEqual(GENESIS);
    expect(restored.origin).toBe("rollback");
    expect(c.history()).toHaveLength(afterApply + 1);
    expect(c.history().slice(0, afterApply).map((v) => v.hash)).toEqual(hashes);
    expect(sink.published.at(-1)!.params).toEqual(GENESIS);
    expect(() => c.rollback(99, "x")).toThrow(/no such version/);
  });

  it("rolls back automatically when post-apply verification fails", async () => {
    let calls = 0;
    const flaky: Guard = {
      name: "flaky",
      check: (p) => {
        if (p.x === GENESIS.x) return { ok: true, detail: "genesis" };
        calls += 1;
        return { ok: calls === 1, detail: `call ${calls}` };
      },
    };
    const sink = new MemoryProductionSink();
    const c = new SelfImprovementController({ subject: subject({ guards: [flaky] }), genesis: GENESIS, sink });
    const r = await c.runCycle({ apply: true });
    expect(r.status).toBe("rolled_back");
    expect(c.current().params).toEqual(GENESIS);
    expect(c.current().origin).toBe("rollback");
    expect(sink.published.map((v) => v.origin)).toEqual(["genesis", "improvement", "rollback"]);
  });

  it("production gate rejects improvements without a valid council ticket or with a tampered vector", async () => {
    const sink = new MemoryProductionSink();
    const c = new SelfImprovementController({ subject: subject(), genesis: GENESIS, sink });
    await c.runCycle({ apply: true });
    const v = c.current();
    expect(verifyVersionForProduction(v).ok).toBe(true);
    expect(verifyVersionForProduction({ ...v, ticket: null }).ok).toBe(false);
    expect(verifyVersionForProduction({ ...v, params: { ...v.params, x: 9 } }).ok).toBe(false);
    expect(verifyVersionForProduction({ ...v, ticket: { ...v.ticket!, baseHash: "x" } }).ok).toBe(false);
    const thin = { ...v.ticket!, decision: { ...v.ticket!.decision, votes: v.ticket!.decision.votes.slice(0, 1) } };
    expect(verifyVersionForProduction({ ...v, ticket: thin }).ok).toBe(false);
  });

  it("the recursive meta layer adapts step scale inside its bounds and escalates to humans after repeated rejections", async () => {
    const c = new SelfImprovementController({ subject: subject({ holdoutScore: bowl(0, 10) }), genesis: GENESIS });
    const start = c.getStepScale();
    await c.runLoop(10, { apply: true });
    expect(c.getStepScale()).toBeLessThan(start);
    expect(c.getStepScale()).toBeGreaterThanOrEqual(DEFAULT_IMPROVEMENT_POLICY.stepScaleMin);
    expect(c.needsHumanReview()).toBe(true);

    const ok = new SelfImprovementController({ subject: subject(), genesis: GENESIS });
    await ok.runCycle({ apply: true });
    expect(ok.getStepScale()).toBeGreaterThan(1);
    expect(ok.getStepScale()).toBeLessThanOrEqual(DEFAULT_IMPROVEMENT_POLICY.stepScaleMax);
  });

  it("is deterministic: same inputs give identical versions and hashes", async () => {
    const run = async () => {
      const c = new SelfImprovementController({ subject: subject(), genesis: GENESIS });
      await c.runLoop(5, { apply: true });
      return c.history().map((v) => [v.id, v.hash, v.params]);
    };
    expect(await run()).toEqual(await run());
  });

  it("refuses a genesis vector that violates the declared specs", () => {
    expect(() => new SelfImprovementController({ subject: subject(), genesis: { x: 99, y: 0 } })).toThrow(/invalid genesis/);
  });
});
