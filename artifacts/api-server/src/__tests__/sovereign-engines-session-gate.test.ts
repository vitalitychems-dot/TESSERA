import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import sovereignEnginesRouter from "../routes/sovereign-engines";
import diagnosticsRouter from "../routes/diagnostics";

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

describe("sovereign engine session gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    const app = express();
    app.use(express.json());
    app.use("/api", sovereignEnginesRouter);
    app.use("/api", diagnosticsRouter);
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

  async function send(path: string, cookie?: string): Promise<{ status: number; json: unknown }> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    const response = await fetch(`${baseUrl}${path}`, { headers });
    return { status: response.status, json: await response.json() };
  }

  it("rejects an anonymous consciousness read and keeps the owner body", async () => {
    const anonymous = await send("/api/consciousness/state");
    expect(anonymous.status).toBe(401);
    expect(anonymous.json).toEqual(UNAUTHENTICATED);

    const owner = await send("/api/consciousness/state", ownerCookie());
    expect(owner.status).toBe(200);
    const body = owner.json as { ok?: boolean; data?: { cycleCount?: number; currentFocus?: unknown } };
    expect(body.ok).toBe(true);
    expect(typeof body.data?.cycleCount).toBe("number");
    expect(body.data?.currentFocus).toBeDefined();
  });

  it("rejects an anonymous diagnostics consciousness read and keeps the owner body", async () => {
    const anonymous = await send("/api/diagnostics/consciousness");
    expect(anonymous.status).toBe(401);
    expect(anonymous.json).toEqual(UNAUTHENTICATED);

    const owner = await send("/api/diagnostics/consciousness", ownerCookie());
    expect(owner.status).toBe(200);
    const body = owner.json as { ok?: boolean; timestamp?: number };
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe("number");
  });

  it("fails closed when the owner key is unset", async () => {
    const saved = process.env[ADMIN_ENV];
    delete process.env[ADMIN_ENV];
    try {
      const response = await send("/api/consciousness/metrics");
      expect(response.status).toBe(503);
      expect(response.json).toEqual(UNCONFIGURED);
    } finally {
      process.env[ADMIN_ENV] = saved;
    }
  });
});
