import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  councilSessionsTable: { id: "id" },
}));

vi.mock("../lib/grand-evolution-cycle", () => ({
  runGrandEvolutionCycle: vi.fn(async () => ({ cycleId: "synthetic" })),
  getLatestCycle: () => null,
  ensureLatestCycleLoaded: vi.fn(async () => undefined),
  isCycleRunning: () => false,
}));

vi.mock("../lib/grand-evolution-engine", () => ({
  convene: vi.fn(async () => ({ sessionId: "synthetic-session" })),
  subscribeToSession: () => ({ unsubscribe: () => undefined, backlog: [] }),
  listSessions: async () => [],
  getSessionTurns: async () => [],
  getSessionDirectives: async () => [],
  getSessionBenchmarks: async () => [],
  getSessionAuditSummary: async () => ({}),
  societyAnchor: () => "synthetic-anchor",
}));

import express from "express";
import { createServer, type Server } from "node:http";
import { registerSession, removeSession } from "../lib/session-mesh";
import { runGrandEvolutionCycle } from "../lib/grand-evolution-cycle";
import { convene } from "../lib/grand-evolution-engine";
import meshRouter from "../routes/mesh";
import adminSessionRouter from "../routes/admin-session";
import sovereignDataRouter from "../routes/sovereign-data";
import grandEvolutionRouter from "../routes/grand-evolution";

const ADMIN_KEY = "synthetic-admin-material";
const MESH_TOKEN = "synthetic-mesh-token";
const MESH_HASH = createHash("sha256").update(MESH_TOKEN).digest("hex");

describe("privacy e limiters and admin key sources", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousKey = process.env.TESSERACT_ADMIN_KEY;
  const previousSession = process.env.SOVEREIGN_SESSION_SECRET;

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.SOVEREIGN_SESSION_SECRET = "synthetic-session-secret-32chars!!";
    registerSession(MESH_HASH, "synthetic-session", { readyState: 0 } as never);
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use(meshRouter);
    app.use(adminSessionRouter);
    app.use(sovereignDataRouter);
    app.use(grandEvolutionRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    removeSession(MESH_HASH, "synthetic-session");
    if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousKey;
    if (previousSession === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
    else process.env.SOVEREIGN_SESSION_SECRET = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves mesh stats without token hashes and without spending the login budget", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const stats = await fetch(`${baseUrl}/mesh/stats`);
      expect(stats.status).toBe(200);
      const text = await stats.text();
      expect(text).not.toContain(MESH_HASH);
      expect(text).not.toContain("keyHash");
      const body = JSON.parse(text) as { connectedPeers?: number; peers?: number };
      expect(body.connectedPeers).toBeGreaterThan(0);
      expect(body.peers).toBeGreaterThan(0);
    }
    const login = await fetch(`${baseUrl}/admin/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "wrong-synthetic-token" }),
    });
    expect(login.status).toBe(401);
  });

  it("rejects an admin key supplied on the query string", async () => {
    const queried = await fetch(
      `${baseUrl}/admin/reflection/metrics?tesseractAdminKey=${encodeURIComponent(ADMIN_KEY)}`,
    );
    expect(queried.status).toBe(403);
    const header = await fetch(`${baseUrl}/admin/reflection/metrics`, {
      headers: { "x-tesseract-admin-key": ADMIN_KEY },
    });
    expect(header.status).toBe(200);
  });

  it("fails closed on grand-evolution and ignores body and query keys", async () => {
    delete process.env.TESSERACT_ADMIN_KEY;
    const unset = await fetch(`${baseUrl}/grand-evolution/run-async`, { method: "POST" });
    expect(unset.status).toBe(503);
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;

    const fromQuery = await fetch(
      `${baseUrl}/grand-evolution/run-async?adminKey=${encodeURIComponent(ADMIN_KEY)}`,
      { method: "POST" },
    );
    expect(fromQuery.status).toBe(401);
    const fromBody = await fetch(`${baseUrl}/grand-evolution/run-async`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminKey: ADMIN_KEY }),
    });
    expect(fromBody.status).toBe(401);
    const fromHeader = await fetch(`${baseUrl}/grand-evolution/run-async`, {
      method: "POST",
      headers: { "x-tesseract-admin-key": ADMIN_KEY },
    });
    expect(fromHeader.status).toBe(200);
  });

  it("does not run the grand-evolution cycle for a wrong admin key", async () => {
    vi.mocked(runGrandEvolutionCycle).mockClear();
    const wrong = await fetch(`${baseUrl}/grand-evolution/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.60",
        "x-tesseract-admin-key": "wrong-synthetic-admin-key",
      },
      body: "{}",
    });
    expect(wrong.status).toBe(401);
    const wrongBody = await wrong.json() as { fatherAuthorized?: boolean };
    expect(wrongBody.fatherAuthorized).not.toBe(true);
    expect(runGrandEvolutionCycle).not.toHaveBeenCalled();

    const unsetKey = process.env.TESSERACT_ADMIN_KEY;
    delete process.env.TESSERACT_ADMIN_KEY;
    const unset = await fetch(`${baseUrl}/grand-evolution/run`, {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.61" },
    });
    expect(unset.status).toBe(503);
    expect(runGrandEvolutionCycle).not.toHaveBeenCalled();
    if (unsetKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = unsetKey;
  });

  it("does not run the grand-evolution cycle for an anonymous request", async () => {
    vi.mocked(runGrandEvolutionCycle).mockClear();
    const anonymous = await fetch(`${baseUrl}/grand-evolution/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.62",
      },
      body: "{}",
    });
    expect(anonymous.status).toBe(401);
    expect(runGrandEvolutionCycle).not.toHaveBeenCalled();
  });

  it("does not convene grand evolution for a wrong admin key", async () => {
    vi.mocked(convene).mockClear();
    vi.mocked(runGrandEvolutionCycle).mockClear();
    const wrong = await fetch(`${baseUrl}/grand-evolution/convene`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.70",
        "x-tesseract-admin-key": "wrong-synthetic-admin-key",
      },
      body: JSON.stringify({ mode: "full", smokeSpeakers: 10000, rounds: 100 }),
    });
    expect(wrong.status).toBe(401);
    const wrongBody = await wrong.json() as { fatherAuthorized?: boolean };
    expect(wrongBody.fatherAuthorized).not.toBe(true);
    expect(convene).not.toHaveBeenCalled();
    expect(runGrandEvolutionCycle).not.toHaveBeenCalled();
  });

  it("rate-limits failed mesh session attempts on their own bucket", async () => {
    let limited = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`${baseUrl}/mesh/sessions/synthetic`, {
        headers: { "x-admin-token": "bogus-synthetic-token" },
      });
      if (response.status === 429) {
        limited = true;
        break;
      }
      expect(response.status).toBe(401);
    }
    expect(limited).toBe(true);
    const login = await fetch(`${baseUrl}/admin/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "wrong-synthetic-token" }),
    });
    expect(login.status).toBe(401);
  });
});
