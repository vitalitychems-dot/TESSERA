import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createServer, type Server } from "node:http";

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
import rickRouter from "../routes/rick";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const SRC = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(SRC, p), "utf-8");
const FORECAST = /\d+(?:\.\d+)?\s*%|\b\d+x\b/i;

let saved: string | undefined;
let routeServer: Server | undefined;
let routeBaseUrl = "";
beforeEach(() => { saved = process.env[RICK_LOOP_FLAG]; delete process.env[RICK_LOOP_FLAG]; });
afterEach(() => { if (saved === undefined) delete process.env[RICK_LOOP_FLAG]; else process.env[RICK_LOOP_FLAG] = saved; });

beforeAll(async () => {
  const app = express();
  // The test server is reached over loopback, which stands in for the single
  // explicitly trusted TLS edge used by the deployed app.
  app.set("trust proxy", "loopback");
  app.use(express.json());
  app.use(rickRouter);
  routeServer = createServer(app);
  await new Promise<void>(resolveListen => routeServer?.listen(0, "127.0.0.1", resolveListen));
  const address = routeServer.address();
  if (!address || typeof address === "string") throw new Error("Rick route test server did not start");
  routeBaseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (!routeServer) return;
  await new Promise<void>((resolveClose, rejectClose) =>
    routeServer?.close(error => error ? rejectClose(error) : resolveClose()),
  );
});

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
  it("owner-gates improvement-program review and implementation feedback routes", () => {
    const r = read("routes/rick.ts");
    expect(r).toContain('router.post("/rick/improvement-program/proposal/:proposalId/decision", requireAdminSession, requireOwnerOrigin');
    expect(r).toContain('router.post("/rick/improvement-program/proposal/:proposalId/dispatch-status", requireAdminSession, requireOwnerOrigin');
    expect(r).toContain('router.patch("/rick/improvement-program/task-queue/:taskId", requireAdminSession, requireOwnerOrigin');
    for (const route of [
      "/rick/improvement-program/start",
      "/rick/improvement-program/abandon",
      "/rick/improvement-program/advance",
      "/rick/improvement-program/generate-proposals",
      "/rick/improvement-program/proposal/:proposalId/reflection",
      "/rick/improvement-program/regenerate-reflections",
    ]) {
      expect(r).toContain(`router.post("${route}", requireAdminSession, requireOwnerOrigin`);
    }
    expect(r).toContain('router.get("/rick/improvement-program", async (_req, res) =>');
    expect(r).toContain('router.post("/rick/improvement-program/proposal/:proposalId/dispatch", requireRickLoopFlag');
    expect(r).toContain('decideProposal(routeParam(req, "proposalId"), decision, reason, { approver, testRef })');
    expect(r).toContain('updateDispatchStatus(routeParam(req, "proposalId"), status, note, { actor, testRef })');
    expect(r).toContain("updateDispatchStatus(taskId, status, note, { actor, testRef })");
  });
  it("improvement-program decisions and completions are gated too", async () => {
    const prog = await import("../lib/rick-improvement-program");
    await expect(prog.decideProposal("p", "approved", undefined, { approver: "rick", testRef: "t" })).rejects.toThrow(/must not be Rick/);
    await expect(prog.decideProposal("p", "approved", undefined, { approver: "tessera" })).rejects.toThrow(/testRef/);
    await expect(prog.updateDispatchStatus("t", "completed", undefined, { actor: "rick-sanchez-c137", testRef: "x" })).rejects.toThrow(/must not be Rick/);
    await expect(prog.updateDispatchStatus("t", "completed", undefined, { actor: "lane" })).rejects.toThrow(/testRef/);
  });
  it("records a distinct owner approval and implementation reference without promoting rejected proposals", async () => {
    const llmEnvNames = ["TESSERA_LLM_BASE_URL", "TESSERA_LLM_API_KEY", "TESSERA_LLM_MODEL"] as const;
    const savedLlmEnv = Object.fromEntries(llmEnvNames.map(name => [name, process.env[name]]));
    for (const name of llmEnvNames) delete process.env[name];

    try {
      const proposals = await import("../lib/rick-proposals");
      const generated = await proposals.generateProposals();
      expect(generated.proposals.length).toBeGreaterThanOrEqual(2);

      const toApprove = generated.proposals[0]!;
      const toReject = generated.proposals[1]!;
      const approved = await proposals.approveProposal(toApprove.id, {
        approver: "Father",
        testRef: "vitest:owner-approval",
      });
      expect(approved).toMatchObject({
        state: "approved",
        approvedBy: "Father",
        approvalTestRef: "vitest:owner-approval",
      });

      const implemented = await proposals.markImplemented(toApprove.id, {
        implementer: "Father",
        testRef: "vitest:implementation-feedback",
      });
      expect(implemented).toMatchObject({
        state: "implemented",
        approvedBy: "Father",
        approvalTestRef: "vitest:owner-approval",
        implementedBy: "Father",
        implementationTestRef: "vitest:implementation-feedback",
      });

      const rejected = await proposals.rejectProposal(toReject.id, "Not needed for this test.");
      expect(rejected?.state).toBe("rejected");
      await expect(proposals.approveProposal(toReject.id, {
        approver: "Father",
        testRef: "vitest:must-not-promote-rejected",
      })).rejects.toThrow(/only pending-review/);
      expect((await proposals.listProposals()).find(item => item.id === toReject.id)?.state).toBe("rejected");
    } finally {
      for (const name of llmEnvNames) {
        const value = savedLlmEnv[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
  it("runs the owner-gated improvement approval and implementation feedback path over HTTP", async () => {
    const envNames = ["TESSERACT_ADMIN_KEY", "SOVEREIGN_SESSION_SECRET", "TESSERA_LLM_BASE_URL", "TESSERA_LLM_API_KEY", "TESSERA_LLM_MODEL"] as const;
    const savedEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
    process.env.TESSERACT_ADMIN_KEY = "synthetic-rick-owner-token";
    process.env.SOVEREIGN_SESSION_SECRET = "synthetic-rick-session-secret-32chars!!";
    for (const name of envNames.slice(2)) delete process.env[name];

    const post = (path: string, body: unknown, cookie?: string) => fetch(`${routeBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: routeBaseUrl,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });

    try {
      const session = issueSession({ ip: "127.0.0.1", userAgent: "rick-gates-vitest" });
      const ownerCookie = `${SESSION_COOKIE}=${session.signedId}`;

      const directStateResponse = await fetch(`${routeBaseUrl}/rick/proposals`);
      expect(directStateResponse.status).toBe(200);
      const directState = await directStateResponse.json() as { proposals: Array<{ id: string; state: string }> };
      const directPending = directState.proposals.filter(proposal => proposal.state === "pending-review");
      expect(directPending.length).toBeGreaterThanOrEqual(2);
      const directFirst = directPending[0]!;
      const directUnauthenticated = await post(`/rick/proposals/${encodeURIComponent(directFirst.id)}/approve`, {
        approver: "Father", testRef: "vitest:owner-approval",
      });
      expect(directUnauthenticated.status).toBe(401);

      const directApproval = await post(`/rick/proposals/${encodeURIComponent(directFirst.id)}/approve`, {
        approver: "Father", testRef: "vitest:owner-approval",
      }, ownerCookie);
      expect(directApproval.status).toBe(200);
      const directApprovalBody = await directApproval.json() as { ok: boolean; proposal: { state: string; approvedBy: string; approvalTestRef: string } };
      expect(directApprovalBody).toMatchObject({
        ok: true,
        proposal: { state: "approved", approvedBy: "Father", approvalTestRef: "vitest:owner-approval" },
      });

      const directImplementation = await post(`/rick/proposals/${encodeURIComponent(directFirst.id)}/implemented`, {
        implementer: "Father", testRef: "vitest:implementation",
      }, ownerCookie);
      expect(directImplementation.status).toBe(200);
      const directImplementationBody = await directImplementation.json() as { ok: boolean; proposal: { state: string; implementedBy: string; implementationTestRef: string } };
      expect(directImplementationBody).toMatchObject({
        ok: true,
        proposal: { state: "implemented", implementedBy: "Father", implementationTestRef: "vitest:implementation" },
      });

      const directToReject = directPending[1]!;
      const directReject = await post(`/rick/proposals/${encodeURIComponent(directToReject.id)}/reject`, {
        reason: "Rejected in the route-flow test.",
      }, ownerCookie);
      expect(directReject.status).toBe(200);
      const rejectThenApprove = await post(`/rick/proposals/${encodeURIComponent(directToReject.id)}/approve`, {
        approver: "Father", testRef: "vitest:must-not-promote-rejected",
      }, ownerCookie);
      expect(rejectThenApprove.status).toBe(403);
      const directFinalState = await (await fetch(`${routeBaseUrl}/rick/proposals`)).json() as { proposals: Array<{ id: string; state: string }> };
      expect(directFinalState.proposals.find(proposal => proposal.id === directToReject.id)?.state).toBe("rejected");

      const programService = await import("../lib/rick-improvement-program");
      const active = await programService.startProgram();
      await programService.generateCycleProposals();
      await programService.advanceStage();

      const pending = active.cycles[0]!.proposals;
      expect(pending.length).toBeGreaterThan(0);
      const first = pending[0]!;
      const unauthenticated = await post(`/rick/improvement-program/proposal/${encodeURIComponent(first.id)}/decision`, {
        decision: "approved", approver: "Father", testRef: "vitest:review",
      });
      expect(unauthenticated.status).toBe(401);

      const approvedResponse = await post(`/rick/improvement-program/proposal/${encodeURIComponent(first.id)}/decision`, {
        decision: "approved", approver: "Father", testRef: "vitest:review",
      }, ownerCookie);
      expect(approvedResponse.status).toBe(200);
      const approvedBody = await approvedResponse.json() as { ok: boolean; program: { cycles: Array<{ proposals: Array<{ id: string; decision: string; decidedBy?: string; approvalTestRef?: string }> }> } };
      expect(approvedBody.ok).toBe(true);
      expect(approvedBody.program.cycles[0]!.proposals.find(proposal => proposal.id === first.id)).toMatchObject({
        decision: "approved",
        decidedBy: "Father",
        approvalTestRef: "vitest:review",
      });

      for (const proposal of pending.slice(1)) {
        await programService.decideProposal(proposal.id, "rejected", "Closed by test fixture.", { approver: "Father" });
      }
      await programService.advanceStage();
      const state = await programService.getProgram();
      const programProposal = state.active!.cycles[0]!.proposals.find(proposal => proposal.id === first.id)!;
      programProposal.dispatch = {
        taskRef: "fixture-dispatch",
        dispatchedAt: Date.now(),
        status: "dispatched",
        statusNote: "Fixture task for status route test.",
      };

      const completedResponse = await post(`/rick/improvement-program/proposal/${encodeURIComponent(first.id)}/dispatch-status`, {
        status: "completed", actor: "Father", testRef: "vitest:implementation",
      }, ownerCookie);
      expect(completedResponse.status).toBe(200);
      const completedBody = await completedResponse.json() as { ok: boolean; program: { cycles: Array<{ proposals: Array<{ id: string; dispatch?: { status: string; statusNote?: string } }> }> } };
      expect(completedBody.ok).toBe(true);
      expect(completedBody.program.cycles[0]!.proposals.find(proposal => proposal.id === first.id)?.dispatch).toMatchObject({
        status: "completed",
        statusNote: expect.stringContaining("completed by Father; test: vitest:implementation"),
      });
      expect(isRickLoopEnabled()).toBe(false);
    } finally {
      for (const name of envNames) {
        const value = savedEnv[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
  it("owner-gates lifecycle and reflection mutations while keeping reads open and dispatch flag-gated", async () => {
    const programService = await import("../lib/rick-improvement-program");
    const envNames = [
      "TESSERACT_ADMIN_KEY",
      "SOVEREIGN_SESSION_SECRET",
      "TESSERA_LLM_BASE_URL",
      "TESSERA_LLM_API_KEY",
      "TESSERA_LLM_MODEL",
    ] as const;
    const savedEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
    process.env.TESSERACT_ADMIN_KEY = "synthetic-rick-cycle-owner";
    process.env.SOVEREIGN_SESSION_SECRET = "synthetic-rick-cycle-session-secret-32chars";
    for (const name of envNames.slice(2)) delete process.env[name];

    const mutations = [
      { path: "/rick/improvement-program/start", body: {} },
      { path: "/rick/improvement-program/abandon", body: {} },
      { path: "/rick/improvement-program/advance", body: {} },
      { path: "/rick/improvement-program/generate-proposals", body: {} },
      { path: "/rick/improvement-program/proposal/synthetic-proposal/reflection", body: { text: "Synthetic reflection." } },
      { path: "/rick/improvement-program/regenerate-reflections", body: {} },
    ];
    const sendMutation = (
      path: string,
      body: unknown,
      cookie?: string,
      origin = routeBaseUrl,
      forwardedProto?: string,
    ) => fetch(`${routeBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(forwardedProto ? { "X-Forwarded-Proto": forwardedProto } : {}),
      },
      body: JSON.stringify(body),
    });

    try {
      await programService.abandonProgram();
      const session = issueSession({ ip: "127.0.0.1", userAgent: "rick-cycle-gates-vitest" });
      const ownerCookie = `${SESSION_COOKIE}=${session.signedId}`;

      const sameHostHttpsOrigin = `https://${new URL(routeBaseUrl).host}`;
      const wrongScheme = await sendMutation(
        "/rick/improvement-program/start",
        {},
        ownerCookie,
        sameHostHttpsOrigin,
      );
      expect(wrongScheme.status).toBe(403);

      // Simulate the Replit TLS edge: the browser uses HTTPS, the local hop is
      // HTTP, and Express accepts the forwarded scheme only from trusted loopback.
      const trustedPreviewOrigin = await sendMutation(
        "/rick/inventions/submit-custom",
        {},
        ownerCookie,
        sameHostHttpsOrigin,
        "https",
      );
      expect(trustedPreviewOrigin.status).toBe(400); // passed origin/session gate, failed payload validation

      for (const mutation of mutations) {
        const anonymous = await sendMutation(mutation.path, mutation.body);
        expect(anonymous.status, `${mutation.path} should deny anonymous writes`).toBe(401);
        const crossOrigin = await sendMutation(mutation.path, mutation.body, ownerCookie, "https://attacker.example");
        expect(crossOrigin.status, `${mutation.path} should reject cross-origin writes`).toBe(403);
      }

      expect((await fetch(`${routeBaseUrl}/rick/improvement-program`)).status).toBe(200);
      expect((await fetch(`${routeBaseUrl}/rick/proposals`)).status).toBe(200);
      const disabledDispatch = await sendMutation(
        "/rick/improvement-program/proposal/synthetic-proposal/dispatch",
        {},
      );
      expect(disabledDispatch.status).toBe(403);
      expect(await disabledDispatch.json()).toMatchObject({
        ok: false,
        error: expect.stringContaining("Disabled:"),
      });

      const started = await sendMutation("/rick/improvement-program/start", {}, ownerCookie);
      expect(started.status).toBe(200);
      const generated = await sendMutation("/rick/improvement-program/generate-proposals", {}, ownerCookie);
      expect(generated.status).toBe(200);

      const enteredReview = await sendMutation("/rick/improvement-program/advance", {}, ownerCookie);
      expect(enteredReview.status).toBe(200);
      const active = (await programService.getProgram()).active!;
      const proposals = active.cycles[0]!.proposals;
      expect(proposals.length).toBeGreaterThan(0);
      for (const [index, proposal] of proposals.entries()) {
        await programService.decideProposal(
          proposal.id,
          index === 0 ? "approved" : "rejected",
          "Synthetic owner-gate route test.",
          { approver: "Father", testRef: "vitest:rick-cycle-gates" },
        );
      }

      const enteredImplementation = await sendMutation("/rick/improvement-program/advance", {}, ownerCookie);
      expect(enteredImplementation.status).toBe(200);
      const enteredReflection = await sendMutation("/rick/improvement-program/advance", {}, ownerCookie);
      expect(enteredReflection.status).toBe(200);
      const savedReflection = await sendMutation(
        `/rick/improvement-program/proposal/${encodeURIComponent(proposals[0]!.id)}/reflection`,
        { text: "Owner-confirmed synthetic reflection." },
        ownerCookie,
      );
      expect(savedReflection.status).toBe(200);
      const regenerated = await sendMutation("/rick/improvement-program/regenerate-reflections", {}, ownerCookie);
      expect(regenerated.status).toBe(200);

      const abandoned = await sendMutation("/rick/improvement-program/abandon", {}, ownerCookie);
      expect(abandoned.status).toBe(200);
      expect((await programService.getProgram()).active).toBeNull();
    } finally {
      await programService.abandonProgram();
      for (const name of envNames) {
        const value = savedEnv[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
  it("Rick UI sends review and implementation evidence and does not report unconfirmed state changes", () => {
    const page = read("../../tessera/src/pages/RickPage.tsx");
    expect(page).toContain("decision, reason, approver: reviewer.trim(), testRef: testRef.trim()");
    expect(page).toContain("status, actor: reviewer.trim(), testRef: testRef.trim()");
    expect(page).toContain("JSON.stringify({ status, actor: reviewer.trim(), testRef: testRef.trim() })");
    expect(page).toContain("if (!r.ok || j?.ok !== true)");
    expect(page).toContain("if (!response.ok || result?.ok !== true)");
    expect(page).toContain("The proposal was not rejected; its current state was left unchanged.");
    expect(page).toContain("Implementation record saved with the supplied test reference.");
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

describe("Non-program Rick write routes have explicit access levels", () => {
  const envNames = ["TESSERACT_ADMIN_KEY", "SOVEREIGN_SESSION_SECRET"] as const;

  async function withOwnerSession<T>(fn: (ownerCookie: string) => Promise<T>): Promise<T> {
    const savedEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
    process.env.TESSERACT_ADMIN_KEY = "synthetic-rick-write-gate-owner";
    process.env.SOVEREIGN_SESSION_SECRET = "synthetic-rick-write-gate-secret-32chars";
    try {
      const session = issueSession({ ip: "127.0.0.1", userAgent: "rick-write-gates-vitest" });
      return await fn(`${SESSION_COOKIE}=${session.signedId}`);
    } finally {
      for (const name of envNames) {
        const value = savedEnv[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }

  const send = (path: string, body: unknown, cookie?: string, origin = routeBaseUrl) =>
    fetch(`${routeBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  it("denies anonymous and cross-origin writes on proposal generation and invention submission", async () => {
    await withOwnerSession(async (ownerCookie) => {
      const ownerOnly = [
        { path: "/rick/proposals/generate", body: {} },
        { path: "/rick/inventions/0/submit", body: {} },
        { path: "/rick/inventions/submit-custom", body: { inventionName: "x", technicalApproach: "y" } },
      ];
      for (const mutation of ownerOnly) {
        const anonymous = await send(mutation.path, mutation.body);
        expect(anonymous.status, `${mutation.path} should deny anonymous writes`).toBe(401);
        const crossOrigin = await send(mutation.path, mutation.body, ownerCookie, "https://attacker.example");
        expect(crossOrigin.status, `${mutation.path} should reject cross-origin writes`).toBe(403);
      }
    });
  });

  it("lets the owner generate proposals and rejects invalid invention input past the gate", async () => {
    await withOwnerSession(async (ownerCookie) => {
      const generated = await send("/rick/proposals/generate", {}, ownerCookie);
      expect(generated.status).toBe(200);
      expect(await generated.json()).toMatchObject({ ok: true });

      const badIndex = await send("/rick/inventions/not-a-number/submit", {}, ownerCookie);
      expect(badIndex.status).toBe(400);
      const missingFields = await send("/rick/inventions/submit-custom", {}, ownerCookie);
      expect(missingFields.status).toBe(400);
    });
  });

  it("keeps engine feedback public but validated and rate-limited", async () => {
    const outOfRange = await send("/rick/engine-feedback", { domain: "chat", engineId: "engine-a", satisfaction: 2 });
    expect(outOfRange.status).toBe(400);
    const oversizedKey = await send("/rick/engine-feedback", { domain: "x".repeat(200), engineId: "engine-a", satisfaction: 0.5 });
    expect(oversizedKey.status).toBe(400);
    const wrongType = await send("/rick/engine-feedback", { domain: 42, engineId: "engine-a", satisfaction: 0.5 });
    expect(wrongType.status).toBe(400);
    const valid = await send("/rick/engine-feedback", { domain: "chat", engineId: "engine-a", satisfaction: 0.9 });
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ ok: true });
  });

  it("route source shows every non-program Rick write route behind an explicit guard", () => {
    const r = read("routes/rick.ts");
    for (const route of [
      'router.post("/rick/proposals/generate", requireAdminSession, requireOwnerOrigin',
      'router.post("/rick/inventions/:index/submit", requireAdminSession, requireOwnerOrigin',
      'router.post("/rick/inventions/submit-custom", requireAdminSession, requireOwnerOrigin',
      'router.post("/rick/engine-feedback", publicWriteRateLimit',
      'router.post("/rick/chat", publicWriteRateLimit',
    ]) {
      expect(r).toContain(route);
    }
  });
});
