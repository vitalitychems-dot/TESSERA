import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

vi.mock("../lib/shepherd-outbound", () => ({
  requireShepherdProxy: vi.fn().mockResolvedValue(true),
  recordShepherdAudit: vi.fn().mockResolvedValue(null),
}));

import forumRouter from "../routes/forum";
import worldRouter from "../routes/world";

describe("world and forum provenance contracts", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(forumRouter);
    app.use(worldRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each(["0", "-1", "101", "1.5", "abc"])("rejects invalid forum limit %s before querying", async limit => {
    const response = await fetch(`${baseUrl}/tesseract-forum/topics?limit=${encodeURIComponent(limit)}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("limits repeated public forum reads and supplies Retry-After", async () => {
    const headers = { "x-forwarded-for": "203.0.113.17" };
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await fetch(`${baseUrl}/tesseract-forum/topics?limit=0`, { headers });
      expect(response.status).toBe(400);
    }
    const limited = await fetch(`${baseUrl}/tesseract-forum/topics?limit=0`, { headers });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("requires an owner session before any forum agent dispatch", async () => {
    const summon = await fetch(`${baseUrl}/tesseract-forum/topics/1/summon-all`, { method: "POST" });
    expect([401, 503]).toContain(summon.status);
    expect(await summon.json()).toMatchObject({ ok: false, error: expect.stringContaining("No replies were created") });
  });

  it("keeps the persona-driven forum cycle disabled", async () => {
    const status = await fetch(`${baseUrl}/tesseract-forum/engine/status`);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      ok: true,
      enabled: false,
      automatedPosts: false,
      automatedVotes: false,
    });

    const cycle = await fetch(`${baseUrl}/tesseract-forum/engine/cycle`, { method: "POST" });
    expect(cycle.status).toBe(503);
    expect(await cycle.json()).toMatchObject({
      ok: false,
      code: "automated_cycles_disabled",
      error: expect.stringContaining("no posts or votes were created"),
    });
  });

  it("does not create non-persisted proposals", async () => {
    const proposal = await fetch(`${baseUrl}/tesseract-forum/topics/1/proposals`, { method: "POST" });
    expect(proposal.status).toBe(503);
    expect(await proposal.json()).toMatchObject({ ok: false, error: expect.stringContaining("No proposal was created") });
  });

  it("marks world and roster values as model-generated and removes the fabricated Rick roster entry", async () => {
    const worldResponse = await fetch(`${baseUrl}/world`);
    expect(worldResponse.status).toBe(200);
    expect(await worldResponse.json()).toMatchObject({
      provenance: { kind: "deterministic-model", live: false },
    });

    const agentsResponse = await fetch(`${baseUrl}/world/agents`);
    expect(agentsResponse.status).toBe(200);
    const agents = await agentsResponse.json() as { agents: Array<{ name: string }>; provenance: { live: boolean } };
    expect(agents.provenance.live).toBe(false);
    expect(agents.agents.some(agent => agent.name === "Rick Sanchez")).toBe(false);
  });

  it("keeps an unavailable moon source explicit without tripping route health checks", async () => {
    const response = await fetch(`${baseUrl}/world/moon`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      available: false,
      moon: null,
      provenance: { kind: "unavailable", live: false },
    });
  });

  it("serves only verified public Moltbook posts with read-only provenance", async () => {
    const nativeFetch = globalThis.fetch;
    const upstreamFetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://www.moltbook.com/api/v1/posts?sort=new&limit=5");
      expect(init?.method).toBe("GET");
      expect(init?.headers).not.toHaveProperty("Authorization");
      return Response.json({
        posts: [
          {
            id: "verified_2",
            title: "Real verified source post",
            content: "Read-only external source content.",
            author: { name: "verified-agent" },
            submolt: { name: "general" },
            created_at: "2026-10-15T18:00:00.000Z",
            score: 7,
            verification_status: "verified",
          },
          {
            id: "pending_2",
            title: "Pending post",
            content: "Must not be presented as verified.",
            author: { name: "pending-agent" },
            submolt: { name: "general" },
            verification_status: "pending",
          },
        ],
      });
    });

    vi.stubGlobal("fetch", ((input: string | URL, init?: RequestInit) => (
      String(input).startsWith("https://www.moltbook.com/")
        ? upstreamFetch(input, init)
        : nativeFetch(input, init)
    )) as typeof fetch);

    try {
      const response = await nativeFetch(`${baseUrl}/tesseract-forum/moltbook-feed`, {
        headers: { "x-forwarded-for": "203.0.113.71" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toMatchObject({
        ok: true,
        source: "Moltbook public feed",
        status: "live",
        stale: false,
        posts: [{
          id: "verified_2",
          title: "Real verified source post",
          authorName: "verified-agent",
          submoltName: "general",
          verified: true,
        }],
      });
      expect(upstreamFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
