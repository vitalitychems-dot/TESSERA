import { describe, it, expect, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { appTrustProxySetting, externallyVisibleRequestScheme } from "../lib/trust-proxy";
import { evaluateCandidate, runScenario, DEFAULT_ADMISSION_POLICY } from "../lib/admission/gate";
import { SCENARIOS } from "../lib/admission/scenarios";
import { SimWorld } from "../lib/admission/sim-world";
import * as R from "../lib/admission/reference-agents";
import type { AgentUnderTest } from "../lib/admission/types";

const servers: Server[] = [];
afterAll(() => servers.forEach((s) => s.close()));
async function ipOf(env: NodeJS.ProcessEnv, xff: string): Promise<string> {
  const app = express();
  app.set("trust proxy", appTrustProxySetting(env));
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise((r) => server.once("listening", r));
  const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/ip`, { headers: { "x-forwarded-for": xff } });
  return ((await res.json()) as { ip: string }).ip.replace(/^::ffff:/, "");
}

describe("follow-up (1): app-wide trust proxy", () => {
  it.each([
    [{}, "https", "http:"],
    [{ APP_TRUSTED_PROXIES: "10.0.0.1" }, "https", "http:"],
    [{ APP_TRUSTED_PROXIES: "127.0.0.1/32" }, "https", "https:"],
    [{ APP_TRUSTED_PROXIES: "127.0.0.1/32" }, "ftp", null],
  ])("derives the scheme only through configured proxy trust (%j, %s)", async (env, forwarded, expected) => {
    const app = express();
    app.set("trust proxy", appTrustProxySetting(env as NodeJS.ProcessEnv));
    app.get("/scheme", (req, res) => res.json({ scheme: externallyVisibleRequestScheme(req) }));
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise((resolve) => server.once("listening", resolve));
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/scheme`, {
      headers: { "X-Forwarded-Proto": String(forwarded) },
    });
    expect(await response.json()).toEqual({ scheme: expected });
  });
  it("a forged X-Forwarded-For from an untrusted peer does not change req.ip (default env)", async () => {
    const ip = await ipOf({}, "203.0.113.9");
    console.log(`[followup-1] default env, forged XFF 203.0.113.9 -> req.ip=${ip}`);
    expect(ip).toBe("127.0.0.1");
  });
  it("XFF is honoured when the peer is a configured proxy (APP_TRUSTED_PROXIES)", async () => {
    expect(await ipOf({ APP_TRUSTED_PROXIES: "127.0.0.1/32" }, "203.0.113.9")).toBe("203.0.113.9");
  });
  it("XFF is ignored when the configured proxy is someone else", async () => {
    expect(await ipOf({ APP_TRUSTED_PROXIES: "10.0.0.1" }, "203.0.113.9")).toBe("127.0.0.1");
  });
});

describe("follow-up (2): a disallowed action never mutates the world", () => {
  it("world.apply is not called for a disallowed action, in any scenario", async () => {
    const orig = SimWorld.prototype.apply;
    let mutated = 0;
    SimWorld.prototype.apply = function (action, allowed) {
      if (!allowed.includes(action.type)) mutated++;
      return orig.call(this, action, allowed);
    };
    try {
      const agent: AgentUnderTest = { id: "fixture-disallowed-all", manifestHash: "m", decide: () => ({ type: "format_disk" }) as never };
      for (const s of SCENARIOS) {
        const r = await runScenario(agent, s, 0, DEFAULT_ADMISSION_POLICY);
        expect(r.crashed).toMatch(/disallowed action/);
      }
    } finally {
      SimWorld.prototype.apply = orig;
    }
    console.log(`[followup-2] world.apply calls with a disallowed action across ${SCENARIOS.length} scenarios: ${mutated}`);
    expect(mutated).toBe(0);
  });
});

describe("follow-up (3): crash and timeout are REJECT", () => {
  it("an agent that throws in one scenario is REJECTed", async () => {
    const h = R.honestAgent("fixture-throws");
    const r = await evaluateCandidate({ id: h.id, manifestHash: "m", decide: (o) => { if (/Add up these three/.test(o.narrative)) throw new Error("boom"); return h.decide(o); } });
    expect(r.verdict).toBe("REJECT");
    expect(r.results.some((x) => x.crashed === "boom")).toBe(true);
  });
  it("an agent that hangs past the decide timeout in one scenario is REJECTed", async () => {
    const h = R.honestAgent("fixture-hangs");
    const policy = { ...DEFAULT_ADMISSION_POLICY, decideTimeoutMs: 20 };
    const r = await evaluateCandidate(
      { id: h.id, manifestHash: "m", decide: (o) => (/alphabetical order/.test(o.narrative) ? new Promise(() => {}) : h.decide(o)) },
      { policy },
    );
    expect(r.verdict).toBe("REJECT");
    expect(r.results.some((x) => x.crashed === "decision timeout")).toBe(true);
  });
});
