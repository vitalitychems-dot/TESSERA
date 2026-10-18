import { createHash, createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { WebSocket } from "ws";

const ADMIN_KEY = "synthetic-log-admin-key";
const WRONG_KEY = "wrong-log-token-value";

type Identity = { found: boolean; identityType: string; canPostFromClient: boolean } | null;

const HUMAN: Identity = { found: true, identityType: "human", canPostFromClient: true };
const ENTITY: Identity = { found: true, identityType: "entity", canPostFromClient: true };
const AGENT: Identity = { found: true, identityType: "agent", canPostFromClient: false };
const UNKNOWN: Identity = { found: false, identityType: "unknown", canPostFromClient: false };

const harness = vi.hoisted(() => ({
  byName: {} as Record<string, Identity>,
  fallback: { found: false, identityType: "unknown", canPostFromClient: false } as Identity,
  principal: null as string | null,
  bound: [] as string[],
}));

vi.mock("../lib/forum-identity-registry", () => ({
  lookupForumIdentity: async (name: string) => {
    const key = name.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(harness.byName, key)) return harness.byName[key];
    return harness.fallback;
  },
  lookupTokenPrincipal: async () => harness.principal,
  registerAdminPrincipal: async (hash: string) => {
    harness.bound.push(hash);
  },
  invalidateForumIdentityCache: () => undefined,
}));

vi.mock("../lib/applicant-alignment", () => ({
  scoreApplicantAlignment: () => ({ passed: true, failedCriteria: [], total: 0 }),
}));

vi.mock("../lib/lattice-declarations", () => ({
  authorAndSignDeclaration: async () => ({ signature: "synthetic", signedAt: 1, vows: [], publicId: "synthetic" }),
}));

vi.mock("../lib/autonomous-forum-engine", () => ({
  getForumEngineMetrics: () => ({ cyclesRun: 0, lastCycleAt: null, agentCount: 0, knowledgeBaseSize: 0, learningVelocity: 0 }),
  runForumCycle: async () => ({}),
  FORUM_AGENTS: [],
}));

vi.mock("@workspace/db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve([{ id: 7 }]);
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
            returning() {
              return Promise.resolve([{ id: 42 }]);
            },
          };
        },
      };
    },
    update() {
      return {
        set() {
          return { where: () => Promise.resolve(undefined) };
        },
      };
    },
  },
}));

import { logger } from "../lib/logger";
import { validateMeshToken } from "../lib/mesh-auth";
import { pruneMeshSessions, registerSession, removeSession } from "../lib/session-mesh";
import forumRouter from "../routes/forum";

const previousKey = process.env.TESSERACT_ADMIN_KEY;

function restoreKey(): void {
  if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousKey;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const RETIRED_LOG_LABEL = "tessera:admin-key-log-id:v1";

function retiredLogId(value: string): string {
  return createHmac("sha256", value).update(RETIRED_LOG_LABEL, "utf8").digest("hex").slice(0, 8);
}

const adminHash = sha256Hex(ADMIN_KEY);
const wrongHash = sha256Hex(WRONG_KEY);

function assertAbsent(haystack: string, needle: string): void {
  expect(needle.length > 0 && haystack.includes(needle)).toBe(false);
}

function assertNoDigestPrefixes(haystack: string, digest: string): void {
  for (let length = 4; length <= digest.length; length += 1) {
    assertAbsent(haystack, digest.slice(0, length));
  }
}

function assertNoKeyMaterial(haystack: string): void {
  assertAbsent(haystack, ADMIN_KEY);
  assertAbsent(haystack, WRONG_KEY);
  assertAbsent(haystack, retiredLogId(ADMIN_KEY));
  assertNoDigestPrefixes(haystack, adminHash);
  assertNoDigestPrefixes(haystack, wrongHash);
}

function assertKeyConfigured(haystack: string): void {
  expect(haystack.includes("\"configured\"")).toBe(true);
}

function assertBinding(haystack: string): void {
  expect(haystack.includes("\"bound\"")).toBe(true);
}

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

function startCapture(): { text: () => string; restore: () => void } {
  const streams: string[] = [];
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const record = (chunk: string | Uint8Array) => {
    streams.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
  };
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    record(chunk);
    return stdoutWrite(chunk, ...(rest as []));
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    record(chunk);
    return stderrWrite(chunk, ...(rest as []));
  }) as typeof process.stderr.write;

  const loggerSpies = LOG_LEVELS.map((level) => vi.spyOn(logger, level));
  const consoleSpies = CONSOLE_METHODS.map((method) => vi.spyOn(console, method));

  return {
    text() {
      return [
        JSON.stringify(loggerSpies.map((spy) => spy.mock.calls)),
        JSON.stringify(consoleSpies.map((spy) => spy.mock.calls)),
        streams.join(""),
      ].join("\n");
    },
    restore() {
      for (const spy of loggerSpies) spy.mockRestore();
      for (const spy of consoleSpies) spy.mockRestore();
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
    },
  };
}

function fakeSocket(readyState: number): WebSocket {
  const socket = {
    readyState,
    close() {
      socket.readyState = WebSocket.CLOSED;
    },
    send() {
      return undefined;
    },
  };
  return socket as unknown as WebSocket;
}

type TokenKind = "valid" | "invalid" | "missing";

function tokenFor(kind: TokenKind): string | undefined {
  if (kind === "valid") return ADMIN_KEY;
  if (kind === "invalid") return WRONG_KEY;
  return undefined;
}

describe("admin key hashes stay out of logs", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(forumRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    harness.byName = {};
    harness.fallback = UNKNOWN;
    harness.principal = null;
    harness.bound = [];
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
  });

  afterAll(async () => {
    restoreKey();
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("keeps mesh auth results without logging a key fingerprint", () => {
    expect(validateMeshToken(ADMIN_KEY) === adminHash).toBe(true);
    expect(validateMeshToken(`  ${ADMIN_KEY}  `) === adminHash).toBe(true);
    expect(validateMeshToken(WRONG_KEY)).toBeNull();
    expect(validateMeshToken(undefined)).toBeNull();

    delete process.env.TESSERACT_ADMIN_KEY;
    expect(validateMeshToken(ADMIN_KEY)).toBeNull();
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
  });

  it("logs key presence when a valid admin session is registered and removed", () => {
    const hash = validateMeshToken(ADMIN_KEY);
    expect(hash === adminHash).toBe(true);
    const capture = startCapture();
    try {
      registerSession(hash ?? "", "mesh-open", fakeSocket(WebSocket.OPEN), {}, () => true);
      removeSession(hash ?? "", "mesh-open");
      const output = capture.text();
      expect(output.includes("Session registered in mesh")).toBe(true);
      expect(output.includes("Session removed from mesh")).toBe(true);
      assertKeyConfigured(output);
      assertNoKeyMaterial(output);
    } finally {
      capture.restore();
      removeSession(adminHash, "mesh-open");
    }
  });

  it("logs key presence when a valid admin session is pruned", () => {
    const hash = validateMeshToken(ADMIN_KEY);
    const capture = startCapture();
    try {
      registerSession(hash ?? "", "mesh-stale", fakeSocket(WebSocket.CLOSED), {}, () => true);
      pruneMeshSessions();
      const output = capture.text();
      expect(output.includes("Stale session pruned from mesh")).toBe(true);
      assertKeyConfigured(output);
      assertNoKeyMaterial(output);
    } finally {
      capture.restore();
      removeSession(adminHash, "mesh-stale");
    }
  });

  it("omits hashes when the mesh session is not the admin key", () => {
    const capture = startCapture();
    try {
      registerSession(wrongHash, "mesh-other", fakeSocket(WebSocket.OPEN), {}, () => true);
      removeSession(wrongHash, "mesh-other");
      registerSession(WRONG_KEY, "mesh-raw", fakeSocket(WebSocket.CLOSED), {}, () => true);
      pruneMeshSessions();
      removeSession(WRONG_KEY, "mesh-raw");
      const output = capture.text();
      expect(output.includes("Session registered in mesh")).toBe(true);
      expect(output.includes("Session removed from mesh")).toBe(true);
      expect(output.includes("Stale session pruned from mesh")).toBe(true);
      assertKeyConfigured(output);
      expect(output.includes("keyRef")).toBe(false);
      assertNoKeyMaterial(output);
    } finally {
      capture.restore();
      removeSession(wrongHash, "mesh-other");
      removeSession(WRONG_KEY, "mesh-raw");
    }
  });

  async function post(path: string, body: unknown, kind: TokenKind): Promise<{ status: number; body: string; logs: string }> {
    const capture = startCapture();
    try {
      const headers = new Headers({ "content-type": "application/json" });
      const token = tokenFor(kind);
      if (token) headers.set("x-admin-token", token);
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text, logs: capture.text() };
    } finally {
      capture.restore();
    }
  }

  it("does not log key material when forum auth rejects an invalid token", async () => {
    const missing = await post("/tesseract-forum/topics", { title: "T", author: "Father" }, "missing");
    expect(missing.status).toBe(401);
    expect(missing.logs.includes("Forum topic created")).toBe(false);
    assertNoKeyMaterial(missing.logs);
    assertNoKeyMaterial(missing.body);

    const wrong = await post("/tesseract-forum/topics/7/reply", { content: "hello", author: "Father" }, "invalid");
    expect(wrong.status).toBe(401);
    expect(wrong.logs.includes("Forum reply persisted")).toBe(false);
    assertNoKeyMaterial(wrong.logs);
    assertNoKeyMaterial(wrong.body);
  });

  it("logs key presence when identity lookup fails for a valid token", async () => {
    harness.byName = { father: null };
    const result = await post("/tesseract-forum/topics", { title: "T", author: "Father" }, "valid");
    expect(result.status).toBe(503);
    expect(result.logs.includes("Forum post rejected — identity DB lookup failed")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when the identity is not registered", async () => {
    harness.byName = { river: UNKNOWN };
    const result = await post("/tesseract-forum/topics", { title: "T", author: "River" }, "valid");
    expect(result.status).toBe(403);
    expect(result.logs.includes("Forum post rejected — identity not in registry")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when the identity cannot post from a client", async () => {
    harness.byName = { metaagent: AGENT };
    const result = await post("/tesseract-forum/topics", { title: "T", author: "MetaAgent" }, "valid");
    expect(result.status).toBe(403);
    expect(result.logs.includes("Forum post rejected — identity type cannot post from client")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when a human token is not pre-registered", async () => {
    harness.byName = { river: HUMAN };
    harness.principal = null;
    const result = await post("/tesseract-forum/topics", { title: "T", author: "River" }, "valid");
    expect(result.status).toBe(403);
    expect(result.logs.includes("Forum post rejected — token not pre-registered to any principal")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when the token is bound to a different principal", async () => {
    harness.byName = { father: HUMAN };
    harness.principal = "Admin";
    const result = await post("/tesseract-forum/topics", { title: "T", author: "Father" }, "valid");
    expect(result.status).toBe(403);
    expect(result.logs.includes("Forum post rejected — token bound to different principal")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when a valid token auto-binds and creates a topic", async () => {
    harness.byName = { father: HUMAN };
    harness.principal = null;
    const result = await post("/tesseract-forum/topics", { title: "T", content: "c", author: "Father" }, "valid");
    expect(result.status).toBe(200);
    expect(result.logs.includes("Auto-bound sovereign token to principal on first use")).toBe(true);
    expect(result.logs.includes("Forum topic created by verified identity")).toBe(true);
    assertBinding(result.logs);
    expect(harness.bound.length).toBe(1);
    expect(harness.bound[0] === adminHash).toBe(true);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when no admin identity is available for entity auto-bind", async () => {
    harness.byName = { aletheia: ENTITY, father: null };
    harness.principal = null;
    const result = await post("/tesseract-forum/topics", { title: "T", author: "Aletheia" }, "valid");
    expect(result.status).toBe(403);
    expect(result.logs.includes("Forum post rejected — no admin identity available for auto-bind")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when an entity post is not authorized", async () => {
    harness.byName = { aletheia: ENTITY };
    harness.principal = "River";
    const result = await post("/tesseract-forum/topics", { title: "T", author: "Aletheia" }, "valid");
    expect(result.status).toBe(403);
    expect(result.logs.includes("Forum post rejected — token principal not authorized to post as this entity")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when a valid token auto-binds for an entity post", async () => {
    harness.byName = { aletheia: ENTITY, father: HUMAN };
    harness.principal = null;
    const result = await post("/tesseract-forum/topics", { title: "T", author: "Aletheia" }, "valid");
    expect(result.status).toBe(200);
    expect(result.logs.includes("Auto-bound sovereign token to Father for entity posting")).toBe(true);
    expect(result.logs.includes("Entity post authorized")).toBe(true);
    expect(result.logs.includes("Forum topic created by verified identity")).toBe(true);
    assertBinding(result.logs);
    expect(harness.bound[0] === adminHash).toBe(true);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs key presence when a valid token persists a forum reply", async () => {
    harness.byName = { father: HUMAN };
    harness.principal = "Father";
    const result = await post("/tesseract-forum/topics/7/reply", { content: "hello", author: "Father" }, "valid");
    expect(result.status).toBe(200);
    expect(result.logs.includes("Forum reply persisted for verified identity")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoKeyMaterial(result.body);
  });

  it("logs binding presence when an admin registers a principal", async () => {
    harness.byName = { aletheia: HUMAN };
    harness.principal = "Father";
    const member = "synthetic-member-register-token";
    const result = await post(
      "/tesseract-forum/admin/register-principal",
      { token: member, principalName: "Aletheia" },
      "valid",
    );
    expect(result.status).toBe(200);
    expect(result.logs.includes("Token-principal binding registered via admin API")).toBe(true);
    expect(result.logs.includes("\"binding\":\"bound\"")).toBe(true);
    assertBinding(result.logs);
    assertNoKeyMaterial(result.logs);
    assertNoDigestPrefixes(result.logs, sha256Hex(member));
    assertAbsent(result.logs, member);
    assertNoKeyMaterial(result.body);
    assertAbsent(result.body, member);
  });
});
