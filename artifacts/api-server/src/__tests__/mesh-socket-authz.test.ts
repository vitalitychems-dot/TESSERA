import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import { attachMeshClient, type MeshEnrichment } from "../lib/mesh-connection";
import { logger } from "../lib/logger";
import { validateMeshToken } from "../lib/mesh-auth";
import {
  MESH_SOCKET_CLOSE_CODE,
  MESH_SOCKET_CLOSE_REASON,
  getGroupSessions,
  pruneMeshSessions,
  registerSession,
  removeSession,
} from "../lib/session-mesh";
import adminSessionRouter from "../routes/admin-session";
import {
  SESSION_COOKIE,
  issueSession,
  revokeSession,
  verifyAdminToken,
} from "../lib/sovereign-session";

const KEY = "synthetic-mesh-admin-key";
const GARBAGE_8 = "abcdefgh";
const GARBAGE_LONG = "abcdefghijklmnop";
const WRONG = "wrong-synthetic-mesh-token";
const SESSION_SECRET = "synthetic-session-secret-32chars!!";

const previousKey = process.env.TESSERACT_ADMIN_KEY;
const previousSecret = process.env.SOVEREIGN_SESSION_SECRET;

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function keyHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timeout");
}

interface MeshHarness {
  port: number;
  calls: number;
  close: () => Promise<void>;
}

async function startMesh(
  loadEnrichment?: () => Promise<MeshEnrichment>,
): Promise<MeshHarness> {
  const state = { calls: 0 };
  const httpServer: Server = createServer();
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws, req) => {
    attachMeshClient(ws, req, {
      loadEnrichment: loadEnrichment ?? (async () => {
        state.calls += 1;
        return {
          recentTasks: [{ taskId: "task-ok" }],
          recentDecisions: [{ action: "decision-ok" }],
        };
      }),
    });
  });
  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });
  const address = httpServer.address() as AddressInfo;
  return {
    port: address.port,
    get calls() {
      return state.calls;
    },
    async close() {
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve, reject) => {
        wss.close((error) => (error ? reject(error) : resolve()));
      });
      if (httpServer.listening) {
        await new Promise<void>((resolve, reject) => {
          httpServer.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  };
}

function openClient(port: number, cookie?: string): Promise<{
  ws: WebSocket;
  messages: Record<string, unknown>[];
  closed: Promise<{ code: number; reason: string }>;
}> {
  const messages: Record<string, unknown>[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, cookie
    ? { headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(cookie)}` } }
    : undefined);
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.once("close", (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
  ws.on("message", (buf) => {
    const text = buf.toString();
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        messages.push(parsed as Record<string, unknown>);
        return;
      }
    } catch {
      // Keep a non-JSON frame so a leaked token would still be visible.
    }
    messages.push({ raw: text });
  });
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve({ ws, messages, closed }));
    ws.once("error", (error) => reject(error));
  });
}

function blob(value: unknown): string {
  return JSON.stringify(value);
}

describe("mesh socket authorization", () => {
  const info = vi.spyOn(logger, "info");
  const warn = vi.spyOn(logger, "warn");
  let harness: MeshHarness | undefined;

  beforeEach(() => {
    process.env.TESSERACT_ADMIN_KEY = KEY;
    process.env.SOVEREIGN_SESSION_SECRET = SESSION_SECRET;
    info.mockClear();
    warn.mockClear();
  });

  afterEach(async () => {
    if (harness) {
      await harness.close();
      harness = undefined;
    }
    vi.spyOn(Date, "now").mockRestore();
  });

  afterAll(() => {
    info.mockRestore();
    warn.mockRestore();
    restore("TESSERACT_ADMIN_KEY", previousKey);
    restore("SOVEREIGN_SESSION_SECRET", previousSecret);
  });

  it("rejects a wrong token, 8+ char garbage, and a missing key, and accepts the configured key", () => {
    expect(validateMeshToken(undefined)).toBeNull();
    expect(validateMeshToken("")).toBeNull();
    expect(validateMeshToken(GARBAGE_8)).toBeNull();
    expect(validateMeshToken(GARBAGE_LONG)).toBeNull();
    expect(validateMeshToken(WRONG)).toBeNull();
    expect(validateMeshToken(`  ${KEY}  `)).toBe(keyHash(KEY));
    expect(validateMeshToken(KEY)).toBe(keyHash(KEY));
    expect(verifyAdminToken(KEY)).toBe(true);
    expect(verifyAdminToken(GARBAGE_LONG)).toBe(false);

    delete process.env.TESSERACT_ADMIN_KEY;
    expect(validateMeshToken(KEY)).toBeNull();
    expect(verifyAdminToken(KEY)).toBe(false);
    process.env.TESSERACT_ADMIN_KEY = "short-key";
    expect(validateMeshToken("short-key")).toBeNull();
    expect(validateMeshToken(KEY)).toBeNull();
  });

  it("keeps token sign-in working for the configured key and rejects garbage", async () => {
    const app = express();
    app.use(express.json());
    app.use(adminSessionRouter);
    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    try {
      const rejected = await fetch(`http://127.0.0.1:${port}/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: GARBAGE_LONG }),
      });
      const rejectedText = await rejected.text();
      expect(rejected.status).toBe(401);
      expect(rejectedText).not.toContain(GARBAGE_LONG);
      expect(rejectedText).not.toContain(KEY);

      const accepted = await fetch(`http://127.0.0.1:${port}/admin/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: KEY }),
      });
      const acceptedText = await accepted.text();
      expect(accepted.status).toBe(200);
      expect(acceptedText).toContain("\"authenticated\":true");
      expect(acceptedText).not.toContain(KEY);
      expect(accepted.headers.get("set-cookie") ?? "").not.toContain(KEY);
      expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(KEY);
      expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(GARBAGE_LONG);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("drops an unauthorized socket and withholds enrichment", async () => {
    harness = await startMesh();
    const client = await openClient(harness.port);
    client.ws.send(JSON.stringify({ type: "subscribe", channel: "mesh" }));
    await waitUntil(() => client.messages.some((message) => message.type === "subscribed"));
    client.ws.send(JSON.stringify({ type: "mesh:auth", token: WRONG }));
    const closed = await withTimeout(client.closed);
    expect(closed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(closed.reason).toBe(MESH_SOCKET_CLOSE_REASON);
    expect(closed.reason).not.toContain(WRONG);
    expect(closed.reason).not.toContain(KEY);
    expect(harness.calls).toBe(0);
    expect(blob(client.messages)).not.toContain("recentTasks");
    expect(blob(client.messages)).not.toContain(WRONG);
    expect(blob(client.messages)).not.toContain(KEY);
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(WRONG);
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(KEY);
  });

  it("drops 8+ char garbage and fails closed when the admin key is unset", async () => {
    harness = await startMesh();
    const garbage = await openClient(harness.port);
    garbage.ws.send(JSON.stringify({ type: "mesh:auth", token: GARBAGE_LONG }));
    const garbageClosed = await withTimeout(garbage.closed);
    expect(garbageClosed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(garbageClosed.reason).not.toContain(GARBAGE_LONG);
    expect(harness.calls).toBe(0);

    delete process.env.TESSERACT_ADMIN_KEY;
    const unset = await openClient(harness.port);
    unset.ws.send(JSON.stringify({ type: "mesh:auth", token: KEY }));
    const unsetClosed = await withTimeout(unset.closed);
    expect(unsetClosed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(unsetClosed.reason).not.toContain(KEY);
    expect(harness.calls).toBe(0);
    expect(blob(unset.messages)).not.toContain("recentTasks");
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(KEY);
  });

  it("rejects a legacy bearer key and accepts a valid HttpOnly session cookie", async () => {
    harness = await startMesh();
    const bearer = await openClient(harness.port);
    bearer.ws.send(JSON.stringify({ type: "mesh:auth", token: KEY }));
    const bearerClosed = await withTimeout(bearer.closed);
    expect(bearerClosed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(harness.calls).toBe(0);

    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    const client = await openClient(harness.port, issued.signedId);
    await waitUntil(() => client.messages.some((message) => message.type === "mesh:connected"));
    client.ws.send(JSON.stringify({ type: "mesh:auth", metadata: { currentPage: "/desk" } }));
    await waitUntil(() => client.messages.some((message) => message.type === "mesh:registered"));
    const registered = client.messages.find((message) => message.type === "mesh:registered");
    const shared = registered?.sharedState as { recentTasks?: { taskId?: string }[]; recentDecisions?: { action?: string }[] };
    expect(shared.recentTasks?.[0]?.taskId).toBe("task-ok");
    expect(shared.recentDecisions?.[0]?.action).toBe("decision-ok");
    expect(harness.calls).toBe(1);
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    client.ws.send(JSON.stringify({ type: "mesh:heartbeat" }));
    await waitUntil(() => client.messages.some((message) => message.type === "mesh:heartbeat-ack"));
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    expect(blob(client.messages)).not.toContain(KEY);
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(KEY);
  });

  it("drops a revoked owner session on the next message", async () => {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    harness = await startMesh();
    const client = await openClient(harness.port, issued.signedId);
    await waitUntil(() => client.messages.some((message) => message.type === "mesh:connected"));
    client.ws.send(JSON.stringify({ type: "subscribe", channel: "mesh" }));
    await waitUntil(() => client.messages.some((message) => message.type === "subscribed"));
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    expect(revokeSession(issued.signedId)).toBe(true);
    client.ws.send(JSON.stringify({ type: "mesh:heartbeat" }));
    const closed = await withTimeout(client.closed);
    expect(closed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(closed.reason).toBe(MESH_SOCKET_CLOSE_REASON);
    expect(closed.reason).not.toContain(issued.signedId);
    expect(closed.reason).not.toContain(KEY);
    expect(harness.calls).toBe(0);
    expect(blob(client.messages)).not.toContain("recentTasks");
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(issued.signedId);
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(KEY);
  });

  it("drops an expired owner session at connect and on a later message", async () => {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest", ttlMs: 60_000 });
    vi.spyOn(Date, "now").mockImplementation(() => issued.expiresAt + 1_000);
    harness = await startMesh();
    const atConnect = await openClient(harness.port, issued.signedId);
    const connectClosed = await withTimeout(atConnect.closed);
    expect(connectClosed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(blob(atConnect.messages)).not.toContain("mesh:connected");
    expect(blob(atConnect.messages)).not.toContain("recentTasks");
    expect(connectClosed.reason).not.toContain(issued.signedId);

    vi.spyOn(Date, "now").mockRestore();
    const live = issueSession({ ip: "127.0.0.1", userAgent: "vitest", ttlMs: 60_000 });
    const later = await openClient(harness.port, live.signedId);
    await waitUntil(() => later.messages.some((message) => message.type === "mesh:connected"));
    vi.spyOn(Date, "now").mockImplementation(() => live.expiresAt + 1_000);
    later.ws.send(JSON.stringify({ type: "subscribe", channel: "mesh" }));
    const laterClosed = await withTimeout(later.closed);
    expect(laterClosed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(laterClosed.reason).not.toContain(live.signedId);
    expect(harness.calls).toBe(0);
  });

  it("withholds enrichment when authorization fails before the database result is sent", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    harness = await startMesh(() => {
      markStarted();
      return gate.then(() => ({
        recentTasks: [{ taskId: "LEAKED_TASK" }],
        recentDecisions: [{ action: "LEAKED_DECISION" }],
      }));
    });
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    const client = await openClient(harness.port, issued.signedId);
    await waitUntil(() => client.messages.some((message) => message.type === "mesh:connected"));
    client.ws.send(JSON.stringify({ type: "mesh:auth" }));
    await withTimeout(started);
    expect(revokeSession(issued.signedId)).toBe(true);
    release();
    const closed = await withTimeout(client.closed);
    expect(closed.code).toBe(MESH_SOCKET_CLOSE_CODE);
    expect(blob(client.messages)).not.toContain("LEAKED_TASK");
    expect(blob(client.messages)).not.toContain("LEAKED_DECISION");
    expect(blob(client.messages)).not.toContain(KEY);
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(KEY);
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(issued.signedId);
  });

  it("treats a missing or throwing authorizer as deny and does not log the thrown secret", () => {
    const secret = "THROWN-MESH-SECRET";
    const denied = {
      readyState: WebSocket.OPEN,
      close: vi.fn(),
    };
    const missing = {
      readyState: WebSocket.OPEN,
      close: vi.fn(),
    };
    registerSession("synthetic-hash", "throw-session", denied as unknown as WebSocket, {}, () => {
      throw new Error(secret);
    });
    registerSession("synthetic-hash", "missing-session", missing as unknown as WebSocket, {}, undefined as unknown as () => boolean);
    getGroupSessions("synthetic-hash");
    expect(denied.close).toHaveBeenCalledWith(MESH_SOCKET_CLOSE_CODE, MESH_SOCKET_CLOSE_REASON);
    expect(missing.close).toHaveBeenCalledWith(MESH_SOCKET_CLOSE_CODE, MESH_SOCKET_CLOSE_REASON);
    let open = true;
    const flipping = {
      readyState: WebSocket.OPEN,
      close: vi.fn(function (this: { readyState: number }) {
        this.readyState = WebSocket.CLOSED;
        open = false;
      }),
    };
    registerSession("synthetic-hash", "flip-session", flipping as unknown as WebSocket, {}, () => open);
    open = false;
    pruneMeshSessions();
    expect(flipping.close).toHaveBeenCalledWith(MESH_SOCKET_CLOSE_CODE, MESH_SOCKET_CLOSE_REASON);
    removeSession("synthetic-hash", "throw-session");
    removeSession("synthetic-hash", "missing-session");
    removeSession("synthetic-hash", "flip-session");
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(secret);
    expect(blob([info.mock.calls, warn.mock.calls])).not.toContain(KEY);
  });
});
