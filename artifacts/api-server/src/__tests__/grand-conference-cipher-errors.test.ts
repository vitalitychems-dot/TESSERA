import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { issueFatherToken } from "../lib/father-session-store";
import * as latticeConference from "../lib/lattice-os-conference";
import { logger } from "../lib/logger";
import grandConferenceRouter from "../routes/grand-conference-cipher";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const ADMIN_KEY = "synthetic-admin-key-for-tests-only";
const DECRYPT_FAULT = "astro-decrypt-failed";
const FORGE_FAULT = "forgeHash mismatch — supplied hash does not match active astronomical epoch for this key.";
const DETONATE_FAULT = "bundle verification failed: invalid bundle";
const CONFERENCE_FAULT = "synthetic-conference-fault-marker";

describe("grand conference cipher fixed error bodies", () => {
  let server: Server | undefined;
  let baseUrl = "";
  let fatherToken = "";
  const previousAdmin = process.env[ADMIN_ENV];

  beforeAll(async () => {
    process.env[ADMIN_ENV] = ADMIN_KEY;
    fatherToken = issueFatherToken("raw-key");
    const app = express();
    app.use(express.json());
    app.use(grandConferenceRouter);
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
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function send(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    auth = false,
  ): Promise<{ status: number; text: string; json: Record<string, unknown> | null }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (auth) headers.authorization = `Bearer ${fatherToken}`;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(text);
      json = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch {
      json = null;
    }
    return { status: response.status, text, json };
  }

  function captureLogs(): { text: () => string; restore: () => void } {
    const warn = vi.spyOn(logger, "warn");
    const error = vi.spyOn(logger, "error");
    return {
      text: () => JSON.stringify([...warn.mock.calls, ...error.mock.calls]),
      restore: () => {
        warn.mockRestore();
        error.mockRestore();
      },
    };
  }

  it("returns a fixed body when decrypt throws", async () => {
    const logs = captureLogs();
    try {
      const posted = await send("POST", "/grand-conference/cipher/decrypt", {
        envelope: {
          v: 1,
          alg: "aes-256-gcm",
          epochId: "not-an-epoch",
          epochHash: "ab".repeat(32),
          iv: "ab".repeat(12),
          tag: "ab".repeat(16),
          ct: "abcd",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }, true);
      expect(posted.status).toBe(400);
      expect(posted.json).toEqual({ ok: false, error: "decrypt-failed" });
      expect(posted.text.includes(DECRYPT_FAULT)).toBe(false);
      expect(logs.text().includes(DECRYPT_FAULT)).toBe(false);
    } finally {
      logs.restore();
    }
  });

  it("returns a fixed body when forge throws", async () => {
    const logs = captureLogs();
    try {
      const posted = await send("POST", "/grand-conference/lattice/forge", {
        key: "synthetic-vault-key",
        hash: "ab".repeat(32),
      });
      expect(posted.status).toBe(400);
      expect(posted.json).toEqual({ ok: false, error: "forge-failed" });
      expect(posted.text.includes(FORGE_FAULT)).toBe(false);
      expect(posted.text.includes("synthetic-vault-key")).toBe(false);
      expect(logs.text().includes(FORGE_FAULT)).toBe(false);
    } finally {
      logs.restore();
    }
  });

  it("returns a fixed body when detonate throws", async () => {
    const logs = captureLogs();
    try {
      const posted = await send("POST", "/grand-conference/lattice/detonate", {
        bundle: { kind: "not-a-bundle" },
      });
      expect(posted.status).toBe(400);
      expect(posted.json).toEqual({ ok: false, error: "detonate-failed" });
      expect(posted.text.includes(DETONATE_FAULT)).toBe(false);
      expect(logs.text().includes(DETONATE_FAULT)).toBe(false);
    } finally {
      logs.restore();
    }
  });

  it("returns a fixed body when conference read and convene throw", async () => {
    const fault = new Error(CONFERENCE_FAULT);
    const spy = vi.spyOn(latticeConference, "getOrRunLatticeOSConference").mockRejectedValue(fault);
    const logs = captureLogs();
    try {
      const read = await send("GET", "/grand-conference/lattice/conference");
      const convened = await send("POST", "/grand-conference/lattice/conference/convene", { force: true }, true);
      expect(read.status).toBe(500);
      expect(read.json).toEqual({ ok: false, error: "conference-failed" });
      expect(read.text.includes(CONFERENCE_FAULT)).toBe(false);
      expect(convened.status).toBe(500);
      expect(convened.json).toEqual({ ok: false, error: "conference-failed" });
      expect(convened.text.includes(CONFERENCE_FAULT)).toBe(false);
      expect(logs.text().includes(CONFERENCE_FAULT)).toBe(false);
      expect(logs.text().includes("\"name\":\"Error\"")).toBe(true);
      expect(logs.text().includes("\"code\":\"none\"")).toBe(true);
    } finally {
      logs.restore();
      spy.mockRestore();
    }
  });
});
