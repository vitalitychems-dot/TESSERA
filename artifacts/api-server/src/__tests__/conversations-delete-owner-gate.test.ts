import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

const SECRET = "synthetic-conversation-secret";

const dbState = vi.hoisted(() => ({
  fail: false,
  calls: 0,
}));

function finish<T>(value: T): Promise<T> {
  dbState.calls += 1;
  if (dbState.fail) {
    const error = new Error(SECRET);
    error.name = "SyntheticFailure";
    return Promise.reject(error);
  }
  return Promise.resolve(value);
}

vi.mock("@workspace/db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            orderBy() {
              return { limit: () => finish([]) };
            },
            where() {
              return {
                limit: () => finish([{ id: 1, title: "chat" }]),
                orderBy() {
                  return { limit: () => finish([]) };
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values() {
          return {
            returning: () => finish([{ id: 1, title: "New Chat" }]),
            then(
              onFulfilled?: ((value: undefined) => unknown) | null,
              onRejected?: ((reason: unknown) => unknown) | null,
            ) {
              return finish(undefined).then(onFulfilled, onRejected);
            },
          };
        },
      };
    },
    update() {
      return { set: () => ({ where: () => finish(undefined) }) };
    },
    delete() {
      return { where: () => finish(undefined) };
    },
  },
}));

import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { logger } from "../lib/logger";
import conversationsRouter from "../routes/conversations";
import sovereignDataRouter from "../routes/sovereign-data";

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

const GATED = [
  { method: "GET", path: "/conversations" },
  { method: "GET", path: "/conversations/1" },
  { method: "POST", path: "/conversations", body: { title: "synthetic" } },
  { method: "DELETE", path: "/conversations/1" },
  { method: "GET", path: "/messages?conversationId=1" },
  { method: "POST", path: "/messages", body: { conversationId: 1, content: "hello" } },
  { method: "POST", path: "/conversations/1/puter-save", body: { content: "hello", role: "user" } },
  { method: "POST", path: "/conversations/1/save-partial", body: { content: "partial" } },
  { method: "GET", path: "/conversations/1/attachments" },
] as const;

describe("conversation owner gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(conversationsRouter);
    app.use(sovereignDataRouter);
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
    dbState.calls = 0;
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

  async function send(
    method: string,
    path: string,
    body?: unknown,
    cookie?: string,
  ): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    let payload: string | undefined;
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      payload = JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, { method, headers, body: payload });
  }

  for (const route of GATED) {
    it(`returns 401 for anonymous ${route.method} ${route.path}`, async () => {
      const response = await send(route.method, route.path, "body" in route ? route.body : undefined);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual(GENERIC_401);
      expect(dbState.calls).toBe(0);
    });

    it(`returns 503 for anonymous ${route.method} ${route.path} when the admin key is unset`, async () => {
      delete process.env[ADMIN_ENV];
      const response = await send(route.method, route.path, "body" in route ? route.body : undefined);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(GENERIC_503);
      expect(dbState.calls).toBe(0);
    });
  }

  it("deletes the conversation for an owner session", async () => {
    const response = await send("DELETE", "/conversations/7", undefined, ownerCookie());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dbState.calls).toBe(2);
  });

  it("returns generic 500 bodies and logs only the error name", async () => {
    dbState.fail = true;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const cases = [
        { method: "GET", path: "/conversations/7", error: "conversation-fetch-failed", log: "Failed to fetch conversation" },
        { method: "POST", path: "/conversations", body: { title: "synthetic" }, error: "conversation-create-failed", log: "Failed to create conversation" },
        { method: "DELETE", path: "/conversations/7", error: "conversation-delete-failed", log: "Failed to delete conversation" },
      ] as const;
      for (const entry of cases) {
        errorSpy.mockClear();
        const response = await send(entry.method, entry.path, "body" in entry ? entry.body : undefined, ownerCookie());
        expect(response.status).toBe(500);
        const text = await response.text();
        expect(text).not.toContain(SECRET);
        expect(text).not.toContain("err.message");
        expect(JSON.parse(text)).toEqual({ ok: false, error: entry.error });
        const logged = errorSpy.mock.calls.find((call) => call[1] === entry.log);
        expect(logged?.[0]).toEqual({ name: "SyntheticFailure" });
        expect(JSON.stringify(logged?.[0])).not.toContain(SECRET);
      }
    } finally {
      errorSpy.mockRestore();
    }
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
