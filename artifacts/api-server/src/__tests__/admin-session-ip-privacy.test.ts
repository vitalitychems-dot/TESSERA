import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ingressRecords: [] as unknown[],
  warnings: [] as unknown[],
}));

vi.mock("../lib/logger", () => ({
  logger: (() => {
    const logger: Record<string, (...args: any[]) => any> = {
      warn: (...args: unknown[]) => state.warnings.push(args),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    logger.child = () => logger;
    return logger;
  })(),
}));

vi.mock("../lib/tesseract-v2", () => ({
  recordIngress: (entry: unknown) => state.ingressRecords.push(entry),
  attestRatified: vi.fn(),
  walkRoutes: vi.fn(() => []),
}));

import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, lookupSession, revokeSession } from "../lib/sovereign-session";
import adminSessionRouter from "../routes/admin-session";

const ADMIN_KEY = "synthetic-admin-key-for-ip-privacy";
const SESSION_SECRET = "synthetic-session-secret-for-ip-privacy-32chars";
const TEST_IP = "203.0.113.205";

describe("admin session IP privacy", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;
  const previousSessionSecret = process.env.SOVEREIGN_SESSION_SECRET;

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.SOVEREIGN_SESSION_SECRET = SESSION_SECRET;
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use(adminSessionRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server failed to start");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    state.ingressRecords.length = 0;
    state.warnings.length = 0;
  });

  afterAll(async () => {
    if (previousAdminKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousAdminKey;
    if (previousSessionSecret === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
    else process.env.SOVEREIGN_SESSION_SECRET = previousSessionSecret;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("keeps a rejected login response, warning log, and ingress record free of the client IP", async () => {
    const response = await fetch(`${baseUrl}/admin/session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": TEST_IP,
      },
      body: JSON.stringify({ token: "wrong-synthetic-token" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "invalid-token" });
    expect(JSON.stringify(state.warnings)).not.toContain(TEST_IP);
    expect(JSON.stringify(state.ingressRecords)).not.toContain(TEST_IP);
    expect(state.ingressRecords).toHaveLength(1);
    expect(state.ingressRecords[0]).toMatchObject({
      route: "POST /admin/session",
      status: 401,
    });
    expect(state.ingressRecords[0]).not.toHaveProperty("ip");
  });

  it("does not retain the address in the in-memory owner-session record", () => {
    const issued = issueSession({ ip: TEST_IP, userAgent: "synthetic-test-agent" });
    try {
      const lookup = lookupSession(issued.signedId);
      expect(lookup.valid).toBe(true);
      expect(lookup.record).not.toHaveProperty("ip");
      expect(JSON.stringify(lookup.record)).not.toContain(TEST_IP);
    } finally {
      revokeSession(issued.signedId);
    }
  });

  it("does not log an IP-shaped rejected Origin or return it to the caller", async () => {
    const response = await fetch(`${baseUrl}/admin/session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: `http://${TEST_IP}`,
        "x-forwarded-for": TEST_IP,
      },
      body: JSON.stringify({ token: "wrong-synthetic-token" }),
    });

    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).not.toContain(TEST_IP);
    expect(JSON.stringify(state.warnings)).not.toContain(TEST_IP);
  });
});
