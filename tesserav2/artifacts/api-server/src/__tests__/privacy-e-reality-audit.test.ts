import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
}));

vi.mock("../lib/reality-audit", () => ({
  getRealityAudit: vi.fn(async () => ({
    scannedAt: 1,
    summary: { totalFindings: 0 },
    topFiveByImpact: [],
    registry: [],
  })),
  getRealityFlag: vi.fn(() => null),
}));

vi.mock("../lib/reality-audit-snapshot", () => ({
  runAndPersistAuditSnapshot: vi.fn(async () => ({ snapshotId: "synthetic-snapshot" })),
  getLatestAuditSnapshot: vi.fn(async () => null),
  listAuditSnapshots: vi.fn(async () => []),
}));

import express from "express";
import { createServer, type Server } from "node:http";
import { getRealityAudit } from "../lib/reality-audit";
import { runAndPersistAuditSnapshot } from "../lib/reality-audit-snapshot";
import realityAuditRouter from "../routes/reality-audit";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const ADMIN_KEY = "synthetic-admin-material";

describe("reality audit write gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousKey = process.env.TESSERACT_ADMIN_KEY;
  const previousSession = process.env.SOVEREIGN_SESSION_SECRET;

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.SOVEREIGN_SESSION_SECRET = "synthetic-session-secret-32chars!!";
    const app = express();
    app.use(express.json());
    app.use(realityAuditRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousKey;
    if (previousSession === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
    else process.env.SOVEREIGN_SESSION_SECRET = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("reads the audit without writing a snapshot", async () => {
    vi.mocked(runAndPersistAuditSnapshot).mockClear();
    vi.mocked(getRealityAudit).mockClear();
    const response = await fetch(`${baseUrl}/reality-audit`);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; scannedAt?: number };
    expect(body.ok).toBe(true);
    expect(body.scannedAt).toBe(1);
    expect(getRealityAudit).toHaveBeenCalled();
    expect(runAndPersistAuditSnapshot).not.toHaveBeenCalled();
  });

  it("hides audit failure details", async () => {
    vi.mocked(getRealityAudit).mockRejectedValueOnce(new Error("synthetic-secret-detail"));
    const response = await fetch(`${baseUrl}/reality-audit`);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("synthetic-secret-detail");
    expect(JSON.parse(text)).toEqual({ ok: false, error: "reality-audit-failed" });
  });

  it("fails closed on snapshot writes when the admin key is unset", async () => {
    vi.mocked(runAndPersistAuditSnapshot).mockClear();
    const previous = process.env.TESSERACT_ADMIN_KEY;
    delete process.env.TESSERACT_ADMIN_KEY;
    try {
      const response = await fetch(`${baseUrl}/reality-audit/snapshot`, { method: "POST" });
      expect(response.status).toBe(503);
      const body = await response.json() as { error?: string };
      expect(body.error).toBe("sovereign-unconfigured");
      expect(runAndPersistAuditSnapshot).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.TESSERACT_ADMIN_KEY;
      else process.env.TESSERACT_ADMIN_KEY = previous;
    }
  });

  it("requires an owner session to write a snapshot", async () => {
    vi.mocked(runAndPersistAuditSnapshot).mockClear();
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    const anonymous = await fetch(`${baseUrl}/reality-audit/snapshot`, { method: "POST" });
    expect(anonymous.status).toBe(401);
    expect(runAndPersistAuditSnapshot).not.toHaveBeenCalled();

    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    const owner = await fetch(`${baseUrl}/reality-audit/snapshot`, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${issued.signedId}` },
    });
    expect(owner.status).toBe(200);
    const body = await owner.json() as { ok?: boolean; snapshot?: { snapshotId?: string } };
    expect(body.ok).toBe(true);
    expect(body.snapshot?.snapshotId).toBe("synthetic-snapshot");
    expect(runAndPersistAuditSnapshot).toHaveBeenCalledTimes(1);
  });
});
