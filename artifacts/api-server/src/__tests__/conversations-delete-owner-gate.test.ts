import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

const dbState = vi.hoisted(() => ({
  fail: false,
  deletes: 0,
}));

const DELETE_SECRET = "synthetic-delete-secret";

vi.mock("@workspace/db", () => ({
  db: {
    delete() {
      dbState.deletes += 1;
      return {
        where() {
          if (dbState.fail) {
            const error = new Error(DELETE_SECRET);
            error.name = "SyntheticDeleteFailure";
            return Promise.reject(error);
          }
          return Promise.resolve(undefined);
        },
      };
    },
  },
}));

import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { logger } from "../lib/logger";
import conversationsRouter from "../routes/conversations";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_ADMIN_KEY = "synthetic-owner-token";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

const GENERIC_401 = { ok: false, error: "unauthenticated", reason: "no-cookie" };
const GENERIC_503 = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};

describe("conversation delete owner gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(conversationsRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    dbState.fail = false;
    dbState.deletes = 0;
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
  });

  afterAll(async () => {
    restore(ADMIN_ENV, previousAdmin);
    restore(SESSION_ENV, previousSession);
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function send(path: string, cookie?: string): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    return fetch(`${baseUrl}${path}`, { method: "DELETE", headers });
  }

  it("returns 401 for an anonymous delete and does not touch the database", async () => {
    const before = dbState.deletes;
    const response = await send("/conversations/1");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual(GENERIC_401);
    expect(dbState.deletes).toBe(before);
  });

  it("returns 503 for an anonymous delete when the admin key is unset", async () => {
    delete process.env[ADMIN_ENV];
    const response = await send("/conversations/1");
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(GENERIC_503);
    expect(dbState.deletes).toBe(0);
  });

  it("deletes the conversation for an owner session", async () => {
    const response = await send("/conversations/7", ownerCookie());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dbState.deletes).toBe(2);
  });

  it("returns a generic 500 body and logs only the error name", async () => {
    dbState.fail = true;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const response = await send("/conversations/7", ownerCookie());
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain(DELETE_SECRET);
      expect(text).not.toContain("err.message");
      expect(JSON.parse(text)).toEqual({ ok: false, error: "conversation-delete-failed" });
      const logged = errorSpy.mock.calls.find((call) => call[1] === "Failed to delete conversation");
      expect(logged?.[0]).toEqual({ name: "SyntheticDeleteFailure" });
      expect(JSON.stringify(logged?.[0])).not.toContain(DELETE_SECRET);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
