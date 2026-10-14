import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Chainable no-op DB: every call returns the chain; awaiting it yields [].
vi.mock("@workspace/db", () => {
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (ok: (v: unknown[]) => unknown) => ok([]);
      return chain;
    },
    apply() { return chain; },
  });
  return { db: chain, pool: chain };
});

import {
  checkActorAndTestRef,
  isRickActor,
  isRickLoopEnabled,
  RICK_LOOP_FLAG,
  stripForecasts,
  testPlanFor,
} from "../lib/rick-gates";

const SRC = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(SRC, p), "utf-8");
const FORECAST = /\d+(?:\.\d+)?\s*%|\b\d+x\b/i;

let saved: string | undefined;
beforeEach(() => { saved = process.env[RICK_LOOP_FLAG]; delete process.env[RICK_LOOP_FLAG]; });
afterEach(() => { if (saved === undefined) delete process.env[RICK_LOOP_FLAG]; else process.env[RICK_LOOP_FLAG] = saved; });

describe("D. boot-time Rick loop is gated (TESSERA_ENABLE_RICK_LOOP, default 0)", () => {
  it("flag defaults to off and only '1' turns it on", () => {
    expect(isRickLoopEnabled({})).toBe(false);
    expect(isRickLoopEnabled({ [RICK_LOOP_FLAG]: "0" })).toBe(false);
    expect(isRickLoopEnabled({ [RICK_LOOP_FLAG]: "true" })).toBe(false);
    expect(isRickLoopEnabled({ [RICK_LOOP_FLAG]: "1" })).toBe(true);
  });
  it("app.ts only starts the loop behind the flag", () => {
    const app = read("app.ts");
    expect(app).toMatch(/if \(isRickLoopEnabled\(\)\) startRickAutonomousLoop\(/);
    expect(app).not.toMatch(/^\s*startRickAutonomousLoop\(/m);
  });
  it("startRickAutonomousLoop refuses to start when the flag is unset", async () => {
    const { startRickAutonomousLoop, getRickAutonomousHeartbeat, stopRickAutonomousLoop } = await import("../lib/rick-autonomous-loop");
    expect(startRickAutonomousLoop(240_000)).toBe(false);
    expect(getRickAutonomousHeartbeat().running).toBe(false);
    expect(getRickAutonomousHeartbeat().enabled).toBe(false);
    stopRickAutonomousLoop();
  });
  it("loop output lands in pending-review and new categories need approval", () => {
    const loop = read("lib/rick-autonomous-loop.ts");
    expect(loop).toContain('status: "pending-review"');
    expect(loop).not.toContain('status: "proposed"');
    expect(loop).not.toMatch(/dynamicCategories\.add\(slug\)/);
    expect(loop).toContain("pendingCategories.add(slug)");
  });
});

describe("B. approve / implemented need a non-Rick actor plus a test reference", () => {
  it("gate helper rejects Rick, Meeseeks, missing actor and missing testRef", () => {
    expect(isRickActor("rick-sanchez-c137")).toBe(true);
    expect(isRickActor("Meeseeks-42")).toBe(true);
    expect(checkActorAndTestRef("rick-sanchez-c137", "t1").ok).toBe(false);
    expect(checkActorAndTestRef("", "t1").ok).toBe(false);
    expect(checkActorAndTestRef("tessera-build-lane", "").ok).toBe(false);
    const g = checkActorAndTestRef("tessera-build-lane", "vitest:rick-gitbook-gates");
    expect(g.ok).toBe(true);
  });
  it("approveProposal and markImplemented throw RickGateError without a valid gate", async () => {
    const { approveProposal, markImplemented, RickGateError } = await import("../lib/rick-proposals");
    await expect(approveProposal("x")).rejects.toBeInstanceOf(RickGateError);
    await expect(approveProposal("x", { approver: "rick", testRef: "t" })).rejects.toBeInstanceOf(RickGateError);
    await expect(approveProposal("x", { approver: "tessera", testRef: "" })).rejects.toBeInstanceOf(RickGateError);
    await expect(markImplemented("x", { implementer: "rick-sanchez-c137", testRef: "t" })).rejects.toBeInstanceOf(RickGateError);
    await expect(markImplemented("x", { implementer: "build-lane" })).rejects.toBeInstanceOf(RickGateError);
    // valid gate passes the check (proposal simply not found -> null)
    await expect(approveProposal("missing", { approver: "tessera", testRef: "pr#1" })).resolves.toBeNull();
    await expect(markImplemented("missing", { implementer: "build-lane", testRef: "pr#1" })).resolves.toBeNull();
  });
  it("routes pass approver/implementer + testRef and map gate errors to 403", () => {
    const r = read("routes/rick.ts");
    expect(r).toContain("approveProposal(proposalId(req), { approver: req.body?.approver, testRef: req.body?.testRef })");
    expect(r).toContain("markImplemented(proposalId(req), { implementer: req.body?.implementer, testRef: req.body?.testRef })");
    expect(r).toMatch(/router\.post\("\/rick\/proposals\/:id\/approve", requireAdminSession, requireOwnerOrigin/);
    expect(r).toMatch(/router\.post\("\/rick\/proposals\/:id\/reject", requireAdminSession, requireOwnerOrigin/);
    expect(r).toMatch(/router\.post\("\/rick\/proposals\/:id\/implemented", requireAdminSession, requireOwnerOrigin/);
    expect((r.match(/err instanceof RickGateError\) return res\.status\(403\)/g) ?? []).length).toBe(2);
  });
  it("improvement-program decisions and completions are gated too", async () => {
    const prog = await import("../lib/rick-improvement-program");
    await expect(prog.decideProposal("p", "approved", undefined, { approver: "rick", testRef: "t" })).rejects.toThrow(/must not be Rick/);
    await expect(prog.decideProposal("p", "approved", undefined, { approver: "tessera" })).rejects.toThrow(/testRef/);
    await expect(prog.updateDispatchStatus("t", "completed", undefined, { actor: "rick-sanchez-c137", testRef: "x" })).rejects.toThrow(/must not be Rick/);
    await expect(prog.updateDispatchStatus("t", "completed", undefined, { actor: "lane" })).rejects.toThrow(/testRef/);
  });
});

describe("C. self-dispatch and Meeseeks spawning are behind the same flag", () => {
  it("dispatchProposal refuses when the flag is off", async () => {
    const prog = await import("../lib/rick-improvement-program");
    await expect(prog.dispatchProposal("p")).rejects.toThrow(/self-dispatch is disabled/);
  });
  it("meeseeks and dispatch routes use requireRickLoopFlag", () => {
    const r = read("routes/rick.ts");
    for (const route of ['"/rick/meeseeks/spawn"', '"/rick/meeseeks/:id/complete"', '"/rick/meeseeks/:id/result"', '"/rick/improvement-program/proposal/:proposalId/dispatch"']) {
      expect(r).toContain(`${route}, requireRickLoopFlag,`);
    }
  });
  it("proposal templates no longer tell the system to auto-spawn Meeseeks", () => {
    const p = read("lib/rick-proposals.ts");
    expect(p).not.toMatch(/Schedule a Meeseeks|auto-spawn an ingestion Meeseeks/);
  });
});

describe("A. forced expectedImpact replaced by testPlan; no hardcoded forecasts", () => {
  it("helpers", () => {
    expect(testPlanFor("m")).toMatch(/^UNMEASURED — test: measure m before\/after/);
    expect(stripForecasts("40-60% faster, 10x throughput, ~30% budget")).not.toMatch(FORECAST);
  });
  it("deterministic proposals carry a testPlan and no numeric forecast", async () => {
    const { deterministicProposals } = await import("../lib/rick-proposals");
    const out = deterministicProposals({
      weakCategories: [{ category: "memory", score: 20 }], weakAgi: [{ category: "math", score: 10 }],
      overallScorePct: 50, truthGroundingRate: 0.5, truthAvgScore: 0.5, meeseeksSuccessRate: 0.5,
    });
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.state).toBe("pending-review");
      expect(p.testPlan).toMatch(/^UNMEASURED — test:/);
      expect((p as unknown as Record<string, unknown>).expectedImpact).toBeUndefined();
      expect(p.testPlan).not.toMatch(FORECAST);
    }
  });
  it("LLM prompt asks for testPlan and no longer requires expectedImpact", () => {
    const p = read("lib/rick-proposals.ts");
    expect(p).toContain("proposedChange, testPlan, risk");
    expect(p).not.toMatch(/!expectedImpact/);
    expect(p).toMatch(/Do NOT forecast numbers/);
  });
  it("Rick inventions have test plans, null estimates and no % / Nx claims", async () => {
    const { generateRickInventions } = await import("../lib/rick-sanchez-agent");
    const inv = generateRickInventions();
    expect(inv.length).toBeGreaterThan(0);
    for (const i of inv) {
      expect(i.estimatedImprovementPct).toBeNull();
      expect(i.testPlan).toMatch(/^UNMEASURED/);
      expect(`${i.technicalApproach} ${i.rickRationale} ${i.testPlan}`).not.toMatch(FORECAST);
    }
    const src = read("lib/rick-sanchez-agent.ts");
    expect(src).not.toContain("EXPECTED IMPACT");
    expect(src).not.toContain("exactly as predicted");
  });
  it("routes no longer echo forecasts or the 100% approval claim", () => {
    const r = read("routes/rick.ts");
    expect(r).not.toContain("100% approval");
    expect(r).not.toContain("estimatedImprovementPct || 20");
    expect(r).not.toContain("expectedImpact");
  });
});

describe("Fake activity feed removed", () => {
  it("getRoleContributions returns no fabricated history", async () => {
    const { getRoleContributions } = await import("../lib/rick-sanchez-agent");
    expect(getRoleContributions("royal-inventor")).toEqual([]);
    const src = read("lib/rick-sanchez-agent.ts");
    expect(src).not.toContain("Patent Filed");
    expect(src).not.toContain("Mandated Meeseeks Task Spawner Protocol");
  });
});
