import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { publish, type AgentMessage } from "../lib/agi/agent-bus";
import {
  broadcastWinner, trySubscribeWorkspace, subscribeWorkspace, workspaceListenerCount,
  MAX_WORKSPACE_LISTENERS, WorkspaceListenerCapError,
} from "../lib/agi/global-workspace";
import {
  createAgiStreamRouter, sanitizeSseId, sanitizeLabel, formatWorkspaceEvent, writeOrDrop,
  DEFAULT_STREAM_OPTIONS, type AgiStreamOptions,
} from "../routes/agi-stream";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const KEY = "test-admin-key-0123456789abcdef";
const SESSION_SECRET = "synthetic-agi-stream-session-secret-32chars";
let prevKey: string | undefined;
let prevSession: string | undefined;
beforeAll(() => { prevKey = process.env.TESSERACT_ADMIN_KEY; prevSession = process.env.SOVEREIGN_SESSION_SECRET; process.env.TESSERACT_ADMIN_KEY = KEY; process.env.SOVEREIGN_SESSION_SECRET = SESSION_SECRET; });
afterAll(() => { if (prevKey === undefined) delete process.env.TESSERACT_ADMIN_KEY; else process.env.TESSERACT_ADMIN_KEY = prevKey; if (prevSession === undefined) delete process.env.SOVEREIGN_SESSION_SECRET; else process.env.SOVEREIGN_SESSION_SECRET = prevSession; });

async function start(o: Partial<AgiStreamOptions> = {}) {
  const app = express();
  app.use("/api", createAgiStreamRouter(o));
  const server: Server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}/api/agi/stream` };
}
const auth = () => {
  const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
  return { cookie: `${SESSION_COOKIE}=${encodeURIComponent(issued.signedId)}` };
};
async function readUntil(res: Response, pred: (s: string) => boolean, ms = 3000) {
  const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "";
  const deadline = Date.now() + ms;
  while (!pred(buf) && Date.now() < deadline) {
    const r = await Promise.race([reader.read(), new Promise<{ done: true; value: undefined }>((ok) => setTimeout(() => ok({ done: true, value: undefined }), Math.max(1, deadline - Date.now())))]);
    if (r.done) break; buf += dec.decode(r.value);
  }
  return { buf, reader };
}

describe("SSE /api/agi/stream (#7, hardened)", () => {
  it("defaults are within policy (heartbeat 15-30s, finite lifetime, caps)", () => {
    expect(DEFAULT_STREAM_OPTIONS.heartbeatMs).toBeGreaterThanOrEqual(15_000);
    expect(DEFAULT_STREAM_OPTIONS.heartbeatMs).toBeLessThanOrEqual(30_000);
    expect(DEFAULT_STREAM_OPTIONS.maxLifetimeMs).toBeGreaterThan(0);
    expect(DEFAULT_STREAM_OPTIONS.maxGlobal).toBeGreaterThan(0);
    expect(DEFAULT_STREAM_OPTIONS.maxPerIp).toBeLessThanOrEqual(DEFAULT_STREAM_OPTIONS.maxGlobal);
  });

  it("auth: rejects no credentials (401) and a wrong key (401)", async () => {
    const { server, url } = await start();
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { "x-tesseract-admin-key": "wrong-key-wrong-key-wrong" } })).status).toBe(401);
    server.close();
  });

  it("auth: fail-closed 503 when the admin key is unconfigured", async () => {
    const { server, url } = await start();
    delete process.env.TESSERACT_ADMIN_KEY;
    try { expect((await fetch(url)).status).toBe(503); }
    finally { process.env.TESSERACT_ADMIN_KEY = KEY; server.close(); }
  });

  it("auth: owner session cookie is accepted", async () => {
    const { server, url } = await start();
    const s = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    const ac = new AbortController();
    const res = await fetch(url, { headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(s.signedId)}` }, signal: ac.signal });
    expect(res.status).toBe(200);
    ac.abort(); server.close();
  });

  it("delivers exactly one event per broadcast to an authed client", async () => {
    const { server, url } = await start();
    const ac = new AbortController();
    const res = await fetch(url, { headers: auth(), signal: ac.signal });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const first = await readUntil(res, (b) => b.includes(": connected"));
    const winners: string[] = [];
    for (let i = 0; i < 3; i++) {
      publish("sse", `sse-${i}-${Date.now()}`, { v: `stream event number ${i}` }, 100);
      const w = broadcastWinner(); if (w) winners.push(w.id);
    }
    const dec = new TextDecoder(); let buf = ""; const deadline = Date.now() + 3000;
    while ((buf.match(/^event: workspace$/gm) ?? []).length < 3 && Date.now() < deadline) {
      const { value, done } = await first.reader.read(); if (done) break; buf += dec.decode(value);
    }
    ac.abort(); server.close();
    expect([...buf.matchAll(/^id: (.+)$/gm)].map((m) => m[1])).toEqual(winners.map(sanitizeSseId));
  });

  it("caps connections per IP (429 on the extra one) and frees the slot on close", async () => {
    const { server, url } = await start({ maxPerIp: 1, maxGlobal: 10 });
    const ac = new AbortController();
    const a = await fetch(url, { headers: auth(), signal: ac.signal });
    expect(a.status).toBe(200);
    expect((await fetch(url, { headers: auth() })).status).toBe(429);
    ac.abort();
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const ac2 = new AbortController();
      const r = await fetch(url, { headers: auth(), signal: ac2.signal });
      ok = r.status === 200; ac2.abort();
    }
    expect(ok).toBe(true);
    server.close();
  });

  it("caps connections globally (429)", async () => {
    const { server, url } = await start({ maxPerIp: 10, maxGlobal: 2 });
    const acs = [new AbortController(), new AbortController()];
    for (const ac of acs) expect((await fetch(url, { headers: auth(), signal: ac.signal })).status).toBe(200);
    expect((await fetch(url, { headers: auth() })).status).toBe(429);
    acs.forEach((a) => a.abort()); server.close();
  });

  it("sends heartbeat comments on the configured interval", async () => {
    const { server, url } = await start({ heartbeatMs: 50 });
    const ac = new AbortController();
    const res = await fetch(url, { headers: auth(), signal: ac.signal });
    const { buf } = await readUntil(res, (b) => (b.match(/: hb/g) ?? []).length >= 2, 2000);
    ac.abort(); server.close();
    expect((buf.match(/: hb/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("ends the connection at max lifetime and releases its listener", async () => {
    const before = workspaceListenerCount();
    const { server, url } = await start({ maxLifetimeMs: 100, heartbeatMs: 10_000 });
    const res = await fetch(url, { headers: auth() });
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ""; let ended = false;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      try { const { value, done } = await reader.read(); if (done) { ended = true; break; } buf += dec.decode(value); }
      catch { ended = true; break; }
    }
    server.close();
    expect(ended).toBe(true);
    expect(buf).toContain("max-lifetime");
    // this connection's listener is gone (earlier aborted streams may also drain)
    expect(workspaceListenerCount()).toBeLessThanOrEqual(before);
  });

  it("backpressure: writeOrDrop drops when write() returns false or buffer exceeds cap", () => {
    expect(writeOrDrop({ write: () => true, writableLength: 10 } as never, "x", 100)).toBe(true);
    expect(writeOrDrop({ write: () => false, writableLength: 0 } as never, "x", 100)).toBe(false);
    expect(writeOrDrop({ write: () => true, writableLength: 101 } as never, "x", 100)).toBe(false);
    expect(writeOrDrop({ write: () => true, destroyed: true } as never, "x", 100)).toBe(false);
  });

  it("SSE id is sanitized: no CR/LF injection, bounded length", () => {
    expect(sanitizeSseId("msg-1\r\nevent: evil\ndata: x")).toBe("msg-1eventevildatax");
    expect(sanitizeSseId("a".repeat(500)).length).toBe(64);
    expect(sanitizeSseId("\n\n")).toBe("0");
    const ev = formatWorkspaceEvent({ id: "m\nevent: pwn", at: 1, from: "a\r\nb", topic: "t\u2028x", priority: 1, novelty: 1, attention: 1, payload: { secret: "s3cr3t" } } as AgentMessage);
    const lines = ev.trimEnd().split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe("event: workspace");
    expect(lines[1]).toBe("id: meventpwn");
    expect(ev).not.toContain("s3cr3t");
    expect(sanitizeLabel("x".repeat(200)).length).toBe(64);
  });

  it("free-text from/topic never reach an unauthenticated client", async () => {
    const { server, url } = await start();
    const res = await fetch(url);
    const body = await res.text();
    publish("secret-sender", "secret-topic", { v: "nope" }, 100); broadcastWinner();
    server.close();
    expect(res.status).toBe(401);
    expect(body).not.toMatch(/secret-|event:/);
  });

  it("hard cap on the workspace listener Set", () => {
    const offs: Array<() => void> = [];
    let refused = 0;
    for (let i = 0; i < MAX_WORKSPACE_LISTENERS + 5; i++) {
      const off = trySubscribeWorkspace(() => {});
      if (off) offs.push(off); else refused++;
    }
    expect(workspaceListenerCount()).toBe(MAX_WORKSPACE_LISTENERS);
    expect(refused).toBeGreaterThan(0);
    expect(() => subscribeWorkspace(() => {})).toThrow(WorkspaceListenerCapError);
    offs.forEach((o) => o());
    expect(workspaceListenerCount()).toBeLessThan(MAX_WORKSPACE_LISTENERS);
  });
});
