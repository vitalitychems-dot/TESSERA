import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";

const ADMIN_KEY = "synthetic-mesh-route-key";
const MARKER = "synthetic-mesh-fault-marker";

const faults = vi.hoisted(() => ({
  stats: false,
  sessions: false,
}));

function syntheticFailure(): Error {
  const error = new Error(MARKER);
  error.name = "SyntheticFailure";
  return error;
}

vi.mock("../lib/session-mesh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/session-mesh")>();
  return {
    ...actual,
    getMeshStats() {
      if (faults.stats) throw syntheticFailure();
      return actual.getMeshStats();
    },
    getGroupSessions(keyHash: string) {
      if (faults.sessions) throw syntheticFailure();
      return actual.getGroupSessions(keyHash);
    },
  };
});

import { logger } from "../lib/logger";
import meshRouter from "../routes/mesh";

const previousKey = process.env.TESSERACT_ADMIN_KEY;

function restoreKey(): void {
  if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousKey;
}

function adminHash(): string {
  return createHash("sha256").update(ADMIN_KEY, "utf8").digest("hex");
}

describe("mesh generic 500 bodies", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(meshRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    faults.stats = false;
    faults.sessions = false;
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
  });

  afterAll(async () => {
    restoreKey();
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns mesh stats without an error message", async () => {
    const response = await fetch(`${baseUrl}/mesh/stats`);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; messageCount: number };
    expect(body.ok).toBe(true);
    expect(body.messageCount).toBe(0);
  });

  it("returns a generic body when mesh stats throws", async () => {
    faults.stats = true;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const response = await fetch(`${baseUrl}/mesh/stats`);
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain(MARKER);
      expect(text).not.toContain("err.message");
      expect(JSON.parse(text)).toEqual({ ok: false, error: "mesh-stats-failed" });
      expect(errorSpy).toHaveBeenCalledWith({ name: "SyntheticFailure" }, "mesh stats failed");
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(MARKER);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("returns a generic body when mesh sessions throws", async () => {
    faults.sessions = true;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const response = await fetch(`${baseUrl}/mesh/sessions/${adminHash()}`, {
        headers: { "x-admin-token": ADMIN_KEY },
      });
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain(MARKER);
      expect(text).not.toContain(ADMIN_KEY);
      expect(JSON.parse(text)).toEqual({ ok: false, error: "mesh-sessions-failed" });
      expect(errorSpy).toHaveBeenCalledWith({ name: "SyntheticFailure" }, "mesh sessions failed");
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(MARKER);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
