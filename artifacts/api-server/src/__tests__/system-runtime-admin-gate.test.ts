import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { logger } from "../lib/logger";

/**
 * @workspace/db refuses to load without DATABASE_URL. The handlers under test
 * never open a connection: the client is replaced below. A synthetic loopback
 * URL is installed only when the variable is unset, and only long enough for
 * that module to evaluate.
 */
const databaseUrlBefore = process.env.DATABASE_URL;
let installedPlaceholderDatabaseUrl = false;
const SYNTHETIC_DATABASE_URL = "postgresql://system-runtime-gate:unused@127.0.0.1:5432/system_runtime_gate";

const dbControl = vi.hoisted(() => ({
  failCycle: false,
  secretMessage: "postgresql://synthetic-user:synthetic-secret@127.0.0.1:5432/synthetic",
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const chain = (fail: boolean) => {
    const promise = fail
      ? Promise.reject(new Error(dbControl.secretMessage))
      : Promise.resolve([{ cycleNumber: 1, id: "synthetic-cycle" }]);
    promise.catch(() => {});
    const thenable: {
      from: () => typeof thenable;
      where: () => typeof thenable;
      orderBy: () => typeof thenable;
      limit: () => typeof thenable;
      values: () => typeof thenable;
      returning: () => typeof thenable;
      set: () => typeof thenable;
      onConflictDoUpdate: () => typeof thenable;
      then: Promise<unknown>["then"];
      catch: Promise<unknown>["catch"];
      finally: Promise<unknown>["finally"];
    } = {
      from: () => thenable,
      where: () => thenable,
      orderBy: () => thenable,
      limit: () => thenable,
      values: () => thenable,
      returning: () => thenable,
      set: () => thenable,
      onConflictDoUpdate: () => thenable,
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
    return thenable;
  };
  return {
    ...actual,
    db: {
      select: () => chain(dbControl.failCycle),
      insert: () => chain(false),
      update: () => chain(false),
      delete: () => chain(false),
    },
  };
});

const ADMIN_KEY_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_ADMIN_KEY = "synthetic-admin-key";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

type GatedRoute = { method: "GET" | "POST"; path: string };

const systemRuntimeRoutes: readonly GatedRoute[] = [
  { method: "GET", path: "/heartbeat/metrics" },
  { method: "POST", path: "/heartbeat/start" },
  { method: "POST", path: "/heartbeat/stop" },
  { method: "GET", path: "/universe/metrics" },
  { method: "GET", path: "/universe/parameters" },
  { method: "POST", path: "/universe/snapshot" },
  { method: "POST", path: "/universe/simulate" },
  { method: "GET", path: "/quantum/metrics" },
  { method: "GET", path: "/quantum/state" },
  { method: "POST", path: "/quantum/gate" },
  { method: "POST", path: "/quantum/measure" },
  { method: "GET", path: "/truthfulness/metrics" },
  { method: "POST", path: "/truthfulness/analyze" },
  { method: "POST", path: "/truthfulness/verify-claim" },
];

const shadowWinnerRoutes: readonly GatedRoute[] = [
  { method: "GET", path: "/consciousness/state" },
  { method: "GET", path: "/emotional/profile" },
  { method: "GET", path: "/dual-brain/state" },
  { method: "GET", path: "/consensus/proposals" },
  { method: "POST", path: "/consensus/propose" },
  { method: "POST", path: "/improvement/cycle" },
];

const gatedRoutes: readonly GatedRoute[] = [...systemRuntimeRoutes, ...shadowWinnerRoutes];

describe("system runtime and shadow-winner admin gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdminKey = process.env[ADMIN_KEY_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = SYNTHETIC_DATABASE_URL;
      installedPlaceholderDatabaseUrl = true;
    }
    const [{ default: systemRuntime }, { default: sovereignEngines }, { default: governance }, { default: improvement }] = await Promise.all([
      import("../routes/system-runtime"),
      import("../routes/sovereign-engines"),
      import("../routes/governance-consensus"),
      import("../routes/improvement"),
    ]);
    const app = express();
    app.use(express.json());
    app.use(systemRuntime);
    app.use(sovereignEngines);
    app.use(governance);
    app.use(improvement);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    dbControl.failCycle = false;
    process.env[ADMIN_KEY_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
  });

  afterAll(async () => {
    const heartbeat = await import("../lib/autonomous-heartbeat");
    heartbeat.stopAutonomousHeartbeat();
    const consciousness = await import("../lib/consciousness-engine");
    consciousness.stopConsciousnessEngine();
    const dualBrain = await import("../lib/dual-brain");
    dualBrain.stopDualBrain();
    restore(ADMIN_KEY_ENV, previousAdminKey);
    restore(SESSION_ENV, previousSession);
    if (installedPlaceholderDatabaseUrl) {
      if (databaseUrlBefore === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = databaseUrlBefore;
      installedPlaceholderDatabaseUrl = false;
    }
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<Response> {
    const headers = new Headers();
    if (body !== undefined) headers.set("content-type", "application/json");
    if (cookie !== undefined) headers.set("cookie", cookie);
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  for (const route of gatedRoutes) {
    const label = `${route.method} ${route.path}`;
    const body = route.method === "POST" ? {} : undefined;

    it(`returns 401 for anonymous ${label} when the admin key is set`, async () => {
      const response = await call(route.method, route.path, body);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
    });

    it(`returns 503 for anonymous ${label} when the admin key is unset`, async () => {
      delete process.env[ADMIN_KEY_ENV];
      const response = await call(route.method, route.path, body);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ ok: false, error: "sovereign-unconfigured" });
    });
  }

  it("returns heartbeat metrics for an owner session on system-runtime", async () => {
    const response = await call("GET", "/heartbeat/metrics", undefined, ownerCookie());
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; data?: { running?: unknown } };
    expect(body.ok).toBe(true);
    expect(typeof body.data?.running).toBe("boolean");
  });

  it("returns consciousness state for an owner session on sovereign-engines", async () => {
    const response = await call("GET", "/consciousness/state", undefined, ownerCookie());
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; data?: { cycleCount?: unknown } };
    expect(body.ok).toBe(true);
    expect(typeof body.data?.cycleCount).toBe("number");
  });

  it("returns proposals for an owner session on governance-consensus", async () => {
    const response = await call("GET", "/consensus/proposals", undefined, ownerCookie());
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; data?: unknown; count?: number };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe((body.data as unknown[]).length);
  });

  it("completes an improvement cycle for an owner session", async () => {
    const response = await call("POST", "/improvement/cycle", {}, ownerCookie());
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; cycleId?: unknown };
    expect(body.ok).toBe(true);
    expect(typeof body.cycleId).toBe("string");
  });

  it("keeps POST /truthfulness/hallucination-check public", async () => {
    const text = "synthetic sentence for the public scorer";
    const authedKey = await call("POST", "/truthfulness/hallucination-check", { text });
    expect(authedKey.status).toBe(200);
    await expect(authedKey.json()).resolves.toMatchObject({ ok: true });

    delete process.env[ADMIN_KEY_ENV];
    const unsetKey = await call("POST", "/truthfulness/hallucination-check", { text });
    expect(unsetKey.status).toBe(200);
    await expect(unsetKey.json()).resolves.toMatchObject({ ok: true });
  });

  it("returns a generic body when POST /improvement/cycle fails", async () => {
    dbControl.failCycle = true;
    const spy = vi.spyOn(logger, "error");
    try {
      const response = await call("POST", "/improvement/cycle", {}, ownerCookie());
      expect(response.status).toBe(500);
      const body = await response.json() as { ok?: boolean; error?: string };
      expect(body).toEqual({ ok: false, error: "Improvement cycle failed" });
      const logged = spy.mock.calls.map((args) => args.map(serializeLogArg).join(" ")).join("\n");
      expect(logged).toContain("Improvement cycle failed");
      expect(logged).not.toContain("synthetic-secret");
      expect(logged).not.toContain(dbControl.secretMessage);
      expect(JSON.stringify(body)).not.toContain("synthetic-secret");
    } finally {
      spy.mockRestore();
    }
  });
});

function serializeLogArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (arg && typeof arg === "object") {
    const record = arg as Record<string, unknown>;
    const nested = record.err instanceof Error ? `${record.err.name}: ${record.err.message}` : "";
    return `${JSON.stringify(arg)} ${nested}`;
  }
  return String(arg);
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
