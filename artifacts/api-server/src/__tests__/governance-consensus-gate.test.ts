import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { getSystemConfig, updateSystemConfig } from "../lib/council-executor";
import { MAX_CYCLE_GAP_MS } from "../lib/sacred-timing";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import apiRouter from "../routes/index";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_ADMIN_KEY = "synthetic-owner-token";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

const UNAUTHENTICATED = { ok: false, error: "unauthenticated", reason: "no-cookie" };
const UNCONFIGURED = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};
const INVALID_CONFIG = { ok: false, error: "invalid config" };
const MESH_REJECTED = { ok: false, error: "Valid sovereign key required" };

const GATED = [
  { method: "GET", path: "/consensus/metrics" },
  { method: "GET", path: "/consensus/proposals" },
  { method: "GET", path: "/consensus/proposals/missing-proposal" },
  {
    method: "POST",
    path: "/consensus/propose",
    body: { title: "synthetic-title", description: "synthetic-description" },
  },
  { method: "GET", path: "/consensus/agents" },
  { method: "GET", path: "/council-executor/metrics" },
  { method: "GET", path: "/council-executor/config" },
  {
    method: "PATCH",
    path: "/council-executor/config",
    body: { key: "heartbeat.enabled", value: true },
  },
] as const;

const NUMERIC_RANGES = [
  { key: "council.requiredMajority", min: 0.5, max: 1, below: 0.499, above: 1.001 },
  { key: "runtime.tickMultiplier", min: 1, max: 8, below: 0, above: 9 },
  { key: "agent.learningRate", min: 0.001, max: 0.1, below: 0.0009, above: 0.1001 },
  {
    key: "consciousness.cycleIntervalMs",
    min: 1_000,
    max: MAX_CYCLE_GAP_MS,
    below: 999,
    above: MAX_CYCLE_GAP_MS + 1,
  },
  {
    key: "dual-brain.cycleIntervalMs",
    min: 1_000,
    max: MAX_CYCLE_GAP_MS,
    below: 999,
    above: MAX_CYCLE_GAP_MS + 1,
  },
] as const;

describe("governance consensus owner gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    const app = express();
    app.use(express.json());
    app.use(apiRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousAdmin === undefined) delete process.env[ADMIN_ENV];
    else process.env[ADMIN_ENV] = previousAdmin;
    if (previousSession === undefined) delete process.env[SESSION_ENV];
    else process.env[SESSION_ENV] = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function send(
    method: string,
    path: string,
    opts?: { cookie?: string; token?: string; adminKey?: string; body?: unknown },
  ): Promise<{ status: number; json: unknown; text: string }> {
    const headers = new Headers();
    if (opts?.cookie !== undefined) headers.set("cookie", opts.cookie);
    if (opts?.token !== undefined) headers.set("x-admin-token", opts.token);
    if (opts?.adminKey !== undefined) headers.set("x-tesseract-admin-key", opts.adminKey);
    if (opts?.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) json = JSON.parse(text) as unknown;
    return { status: response.status, json, text };
  }

  it("returns 401 for every gated route when the owner session is missing", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    const health = await send("GET", "/healthz");
    expect(health.status).toBe(200);

    for (const route of GATED) {
      const response = await send(route.method, route.path, {
        body: "body" in route ? route.body : undefined,
      });
      expect(response.status, `${route.method} ${route.path}`).toBe(401);
      expect(response.json, `${route.method} ${route.path}`).toEqual(UNAUTHENTICATED);
    }
  });

  it("returns 401 for a bad session cookie even when a key header is valid", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    for (const route of GATED) {
      const response = await send(route.method, route.path, {
        cookie: `${SESSION_COOKIE}=not-a-session`,
        token: SYNTHETIC_ADMIN_KEY,
        adminKey: SYNTHETIC_ADMIN_KEY,
        body: "body" in route ? route.body : undefined,
      });
      expect(response.status, `${route.method} ${route.path}`).toBe(401);
      expect(response.json, `${route.method} ${route.path}`).toEqual({
        ok: false,
        error: "unauthenticated",
        reason: "bad-signature",
      });
      expect(response.text).not.toContain(SYNTHETIC_ADMIN_KEY);
    }
  });

  it("returns 503 for every gated route when the owner gate is unconfigured", async () => {
    const saved = process.env[ADMIN_ENV];
    delete process.env[ADMIN_ENV];
    try {
      const health = await send("GET", "/healthz");
      expect(health.status).toBe(200);
      for (const route of GATED) {
        const response = await send(route.method, route.path, {
          cookie: "sovereign_session=not-a-session",
          body: "body" in route ? route.body : undefined,
        });
        expect(response.status, `${route.method} ${route.path}`).toBe(503);
        expect(response.json, `${route.method} ${route.path}`).toEqual(UNCONFIGURED);
      }
    } finally {
      process.env[ADMIN_ENV] = saved;
    }
  });

  it("serves the gated reads to an owner session", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    const cookie = ownerCookie();

    const metrics = await send("GET", "/consensus/metrics", { cookie });
    expect(metrics.status).toBe(200);
    expect((metrics.json as { ok?: boolean; data?: unknown }).ok).toBe(true);
    expect((metrics.json as { data?: unknown }).data).toBeTypeOf("object");

    const agents = await send("GET", "/consensus/agents", { cookie });
    expect(agents.status).toBe(200);
    const agentsBody = agents.json as { ok?: boolean; data?: unknown[]; count?: number };
    expect(agentsBody.ok).toBe(true);
    expect(Array.isArray(agentsBody.data)).toBe(true);
    expect(agentsBody.count).toBe(agentsBody.data?.length);

    const executor = await send("GET", "/council-executor/metrics", { cookie });
    expect(executor.status).toBe(200);
    expect((executor.json as { ok?: boolean; data?: { configKeys?: unknown } }).ok).toBe(true);
    expect(typeof (executor.json as { data?: { configKeys?: unknown } }).data?.configKeys).toBe("number");

    const config = await send("GET", "/council-executor/config", { cookie });
    expect(config.status).toBe(200);
    expect((config.json as { ok?: boolean; data?: unknown }).ok).toBe(true);
    expect((config.json as { data?: unknown }).data).toBeTypeOf("object");

    const missing = await send("GET", "/consensus/proposals/missing-proposal", { cookie });
    expect(missing.status).toBe(404);
    expect(missing.json).toEqual({ ok: false, error: "Proposal not found" });

    const list = await send("GET", "/consensus/proposals", { cookie });
    expect(list.status).toBe(200);
    expect((list.json as { ok?: boolean; count?: unknown }).ok).toBe(true);
    expect(typeof (list.json as { count?: unknown }).count).toBe("number");
  });

  it("updates an allowlisted config value and rejects unknown, typed, and prototype keys", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    const cookie = ownerCookie();

    const enabled = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "heartbeat.enabled", value: false },
    });
    expect(enabled.status).toBe(200);
    expect(enabled.json).toEqual({ ok: true });
    expect(enabled.text).not.toContain("heartbeat.enabled");

    const rate = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "agent.learningRate", value: 0.02 },
    });
    expect(rate.status).toBe(200);
    expect(rate.json).toEqual({ ok: true });

    const mode = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "agent.collaborationMode", value: "cooperative" },
    });
    expect(mode.status).toBe(200);

    const stored = await send("GET", "/council-executor/config", { cookie });
    const data = (stored.json as { data: Record<string, unknown> }).data;
    expect(data["heartbeat.enabled"]).toBe(false);
    expect(data["agent.learningRate"]).toBe(0.02);
    expect(data["agent.collaborationMode"]).toBe("cooperative");

    const rejected: unknown[] = [
      { key: "SENTINEL_UNKNOWN_KEY_zz", value: "SENTINEL_VALUE_zz" },
      { key: "__proto__", value: { polluted: "SENTINEL_PROTO_VALUE_zz" } },
      { key: "constructor", value: { polluted: "SENTINEL_PROTO_VALUE_zz" } },
      { key: "prototype", value: "SENTINEL_PROTO_VALUE_zz" },
      { key: "agent.learningRate", value: "SENTINEL_WRONG_TYPE_zz" },
      { key: "heartbeat.enabled" },
      ["heartbeat.enabled"],
    ];
    for (const body of rejected) {
      const response = await send("PATCH", "/council-executor/config", { cookie, body });
      expect(response.status).toBe(400);
      expect(response.json).toEqual(INVALID_CONFIG);
      expect(response.text).not.toContain("SENTINEL_");
      expect(response.text).not.toContain("__proto__");
      expect(response.text).not.toContain("constructor");
      expect(response.text).not.toContain("prototype");
    }

    const after = await send("GET", "/council-executor/config", { cookie });
    const afterData = (after.json as { data: Record<string, unknown> }).data;
    expect(afterData["agent.learningRate"]).toBe(0.02);
    expect(Object.hasOwn(afterData, "SENTINEL_UNKNOWN_KEY_zz")).toBe(false);
    expect(Object.hasOwn(afterData, "__proto__")).toBe(false);
    expect(Object.hasOwn(afterData, "constructor")).toBe(false);
    expect(Object.hasOwn(afterData, "prototype")).toBe(false);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("accepts numeric bounds and rejects the adjacent values without echoing them", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    const cookie = ownerCookie();

    for (const range of NUMERIC_RANGES) {
      const min = await send("PATCH", "/council-executor/config", {
        cookie,
        body: { key: range.key, value: range.min },
      });
      expect(min.status, `${range.key} min`).toBe(200);
      expect(min.json).toEqual({ ok: true });
      expect(min.text).not.toContain(range.key);

      const max = await send("PATCH", "/council-executor/config", {
        cookie,
        body: { key: range.key, value: range.max },
      });
      expect(max.status, `${range.key} max`).toBe(200);
      expect(max.json).toEqual({ ok: true });

      for (const value of [range.below, range.above]) {
        const response = await send("PATCH", "/council-executor/config", {
          cookie,
          body: { key: range.key, value },
        });
        expect(response.status, `${range.key} ${value}`).toBe(400);
        expect(response.json).toEqual(INVALID_CONFIG);
        expect(response.text).not.toContain(range.key);
        expect(response.text).not.toContain(String(value));
      }

      const stored = await send("GET", "/council-executor/config", { cookie });
      const data = (stored.json as { data: Record<string, unknown> }).data;
      expect(data[range.key], range.key).toBe(range.max);
    }

    const fractional = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "council.requiredMajority", value: 2 / 3 },
    });
    expect(fractional.status).toBe(200);
    const nonIntegers = [
      { key: "runtime.tickMultiplier", value: 1.5 },
      { key: "consciousness.cycleIntervalMs", value: 1_000.5 },
      { key: "dual-brain.cycleIntervalMs", value: 1_000.5 },
    ];
    for (const body of nonIntegers) {
      const response = await send("PATCH", "/council-executor/config", { cookie, body });
      expect(response.status, body.key).toBe(400);
      expect(response.json).toEqual(INVALID_CONFIG);
      expect(response.text).not.toContain(body.key);
      expect(response.text).not.toContain(String(body.value));
    }

    const before = getSystemConfig();
    expect(updateSystemConfig("runtime.tickMultiplier", Number.NaN)).toBe(false);
    expect(updateSystemConfig("runtime.tickMultiplier", Number.POSITIVE_INFINITY)).toBe(false);
    expect(updateSystemConfig("runtime.tickMultiplier", Number.NEGATIVE_INFINITY)).toBe(false);
    expect(updateSystemConfig("agent.learningRate", Number.NaN)).toBe(false);
    expect(updateSystemConfig("council.requiredMajority", Number.POSITIVE_INFINITY)).toBe(false);
    expect(updateSystemConfig("consciousness.cycleIntervalMs", Number.NaN)).toBe(false);
    expect(updateSystemConfig("dual-brain.cycleIntervalMs", Number.NEGATIVE_INFINITY)).toBe(false);
    expect(getSystemConfig()["runtime.tickMultiplier"]).toBe(before["runtime.tickMultiplier"]);
    expect(getSystemConfig()["agent.learningRate"]).toBe(before["agent.learningRate"]);
    expect(getSystemConfig()["council.requiredMajority"]).toBe(before["council.requiredMajority"]);

    expect(updateSystemConfig("council.requiredMajority", 2 / 3)).toBe(true);
    expect(updateSystemConfig("runtime.tickMultiplier", 2)).toBe(true);
    expect(getSystemConfig()["council.requiredMajority"]).toBe(2 / 3);
    expect(getSystemConfig()["runtime.tickMultiplier"]).toBe(2);
  });

  it("lets the owner session write hardening level and the external fetch freeze", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    const cookie = ownerCookie();

    const level = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "security.hardeningLevel", value: 2 },
    });
    expect(level.status).toBe(200);
    expect(level.json).toEqual({ ok: true });
    expect(level.text).not.toContain("hardeningLevel");

    const frozen = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "network.externalFetchFrozen", value: true },
    });
    expect(frozen.status).toBe(200);
    expect(frozen.json).toEqual({ ok: true });
    expect(frozen.text).not.toContain("externalFetchFrozen");

    const cleared = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "network.externalFetchFrozen", value: false },
    });
    expect(cleared.status).toBe(200);

    const stored = await send("GET", "/council-executor/config", { cookie });
    const data = (stored.json as { data: Record<string, unknown> }).data;
    expect(data["security.hardeningLevel"]).toBe(2);
    expect(data["network.externalFetchFrozen"]).toBe(false);

    const wrongType = await send("PATCH", "/council-executor/config", {
      cookie,
      body: { key: "security.hardeningLevel", value: "SENTINEL_HARDENING_zz" },
    });
    expect(wrongType.status).toBe(400);
    expect(wrongType.json).toEqual(INVALID_CONFIG);
    expect(wrongType.text).not.toContain("SENTINEL_HARDENING_zz");
    expect(wrongType.text).not.toContain("hardeningLevel");
  });

  it("drains the queue with a mesh token and rejects a missing token without an owner session", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;

    const missing = await send("POST", "/consensus/drain-queue");
    expect(missing.status).toBe(401);
    expect(missing.json).toEqual(MESH_REJECTED);

    const wrong = await send("POST", "/consensus/drain-queue", { token: "not-the-mesh-token" });
    expect(wrong.status).toBe(401);
    expect(wrong.json).toEqual(MESH_REJECTED);

    const sessionOnly = await send("POST", "/consensus/drain-queue", { cookie: ownerCookie() });
    expect(sessionOnly.status).toBe(401);
    expect(sessionOnly.json).toEqual(MESH_REJECTED);

    const drained = await send("POST", "/consensus/drain-queue", { token: SYNTHETIC_ADMIN_KEY });
    expect(drained.status).toBe(200);
    const body = drained.json as { ok?: boolean; data?: { resolved?: unknown; deferred?: unknown; remaining?: unknown } };
    expect(body.ok).toBe(true);
    expect(typeof body.data?.resolved).toBe("number");
    expect(typeof body.data?.deferred).toBe("number");
    expect(typeof body.data?.remaining).toBe("number");

    const saved = process.env[ADMIN_ENV];
    delete process.env[ADMIN_ENV];
    try {
      const unconfigured = await send("POST", "/consensus/drain-queue", { token: SYNTHETIC_ADMIN_KEY });
      expect(unconfigured.status).toBe(401);
      expect(unconfigured.json).toEqual(MESH_REJECTED);
    } finally {
      process.env[ADMIN_ENV] = saved;
    }
  });
});
