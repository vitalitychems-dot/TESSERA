import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { isMessageAllowed, isReservedOwnerRecipient, setCommsAliases, setCommsPolicy, applyMeshRegistryPolicy } from "../lib/comms-policy";
import { canonicalSlug, isAsciiSlug, isDevEnv } from "../lib/mesh-lane-auth";
import { originAllowed } from "../lib/origin-allowed";
import agentNetworkRouter, { OWNER_IDENTITY } from "../routes/agent-network";

const KEYS = ["NODE_ENV", "MESH_LANE_TOKENS", "TESSERACT_ADMIN_KEY", "SOVEREIGN_SESSION_SECRET", "SOVEREIGN_ALLOWED_ORIGINS"];
const saved = { ...process.env };
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  setCommsPolicy(null); setCommsAliases(null);
});

type Post = (path: string, body: unknown, headers?: Record<string, string>) => Promise<Response>;
async function serve(remote: string, fn: (post: Post) => Promise<void>) {
  const app = express().use((req, _res, next) => { Object.defineProperty(req.socket, "remoteAddress", { value: remote, configurable: true }); next(); })
    .use(express.json()).use(agentNetworkRouter);
  const server = await new Promise<any>((ok) => { const s = app.listen(0, "127.0.0.1", () => ok(s)); });
  const port = (server.address() as any).port;
  const post: Post = (path, body, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  try { await fn(post); } finally { server.close(); }
}
const ownerCookie = async () => {
  process.env.TESSERACT_ADMIN_KEY = `fake-admin-${Math.random().toString(36).slice(2)}-xxxxxxxx`;
  process.env.SOVEREIGN_SESSION_SECRET = `fake-secret-${"s".repeat(40)}`;
  const { issueSession, SESSION_COOKIE } = await import("../lib/sovereign-session");
  return `${SESSION_COOKIE}=${issueSession({ ip: "10.0.0.5", userAgent: "t" }).signedId}`;
};

describe("GM-1 secfix: MEDIUM owner slugs never a recipient (registry inert)", () => {
  it("refuses father in any case / fullwidth / whitespace / zero-width / alias", () => {
    setCommsPolicy(null);
    setCommsAliases({ Dad: "father" });
    for (const to of ["father", "Father", "FATHER", "ｆａｔｈｅｒ", " father ", "fa\u200Bther", "\uFEFFFather", "Dad"]) {
      expect(isReservedOwnerRecipient(to)).toBe(true);
      expect(isMessageAllowed("build", to)).toBe(false);
    }
    expect(isMessageAllowed("build", "tessera")).toBe(true);
  });
  it("route returns 403 when a dev sender targets father", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "test";
    await serve("127.0.0.1", async (post) => {
      expect((await post("/agent-comms/send", { from: "build", to: "ｆａｔｈｅｒ", content: "hi" })).status).toBe(403);
    });
  });
});

describe("GM-1 secfix: LOW canonicalSlug for owner claims", () => {
  it("NFKC + strip Cf + trim + lowercase", () => {
    expect(canonicalSlug("ＦＡＴＨＥＲ")).toBe("father");
    expect(canonicalSlug(" Fa\u200Bther\u200D ")).toBe("father");
  });
  it("lookalike owner claims on the dev-loopback path get 403", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "test";
    await serve("127.0.0.1", async (post) => {
      for (const from of ["ＦＡＴＨＥＲ", "Fa\u200Bther", " father "]) {
        expect((await post("/agent-comms/send", { from, to: "build", content: "hi" })).status).toBe(403);
      }
    });
  });
});

describe("GM-1 secfix: LOW owner-session Origin allowlist", () => {
  it("originAllowed: same host / allowlist / absent ok; foreign rejected", () => {
    const req = (origin?: string) => ({ headers: { host: "api.local", ...(origin ? { origin } : {}) } }) as any;
    expect(originAllowed(req())).toBe(true);
    expect(originAllowed(req("https://api.local"))).toBe(true);
    expect(originAllowed(req("https://evil.example"))).toBe(false);
    process.env.SOVEREIGN_ALLOWED_ORIGINS = "https://ok.example";
    expect(originAllowed(req("https://ok.example"))).toBe(true);
  });
  it("owner session from a foreign Origin gets 403; same Origin works", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "production";
    const cookie = await ownerCookie();
    await serve("10.0.0.5", async (post) => {
      expect((await post("/agent-comms/send", { to: "build", content: "hi" }, { cookie, origin: "https://evil.example" })).status).toBe(403);
      const r = await post("/agent-comms/send", { to: "build", content: "hi" }, { cookie });
      expect(r.status).toBe(200);
      expect(((await r.json()) as { data: { from: string } }).data.from).toBe(OWNER_IDENTITY);
    });
  });
});

describe("GM-1 secfix: fail-closed NODE_ENV + proxy headers (Moderator)", () => {
  it("isDevEnv only for development/test", () => {
    expect(isDevEnv({} as any)).toBe(false);
    expect(isDevEnv({ NODE_ENV: "" } as any)).toBe(false);
    expect(isDevEnv({ NODE_ENV: "staging" } as any)).toBe(false);
    expect(isDevEnv({ NODE_ENV: "Development" } as any)).toBe(false);
    expect(isDevEnv({ NODE_ENV: "production" } as any)).toBe(false);
    expect(isDevEnv({ NODE_ENV: "development" } as any)).toBe(true);
    expect(isDevEnv({ NODE_ENV: "test" } as any)).toBe(true);
  });
  it("unset or unknown NODE_ENV on loopback gets 401", async () => {
    delete process.env.MESH_LANE_TOKENS;
    for (const v of [undefined, "staging", "prod"]) {
      if (v === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = v;
      await serve("127.0.0.1", async (post) => {
        expect((await post("/agent-comms/send", { from: "build", to: "tessera", content: "hi" })).status).toBe(401);
      });
    }
  });
  it("loopback with X-Forwarded-For / Forwarded / X-Real-IP gets 401", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "test";
    await serve("127.0.0.1", async (post) => {
      for (const h of [{ "x-forwarded-for": "127.0.0.1" }, { forwarded: "for=127.0.0.1" }, { "x-real-ip": "127.0.0.1" }] as Record<string, string>[]) {
        expect((await post("/agent-comms/send", { from: "build", to: "tessera", content: "hi" }, h)).status).toBe(401);
      }
    });
  });
});

describe("GM-1 secfix: ASCII-slug sender rule (Security)", () => {
  it("isAsciiSlug", () => {
    for (const ok of ["build", "a", "council-alpha", "x".repeat(64)]) expect(isAsciiSlug(ok)).toBe(true);
    for (const bad of ["", "-a", "Build", "bu ild", "bu_ild", "büild", "ｂｕｉｌｄ", "b\u200Build", "x".repeat(65), 5 as any]) expect(isAsciiSlug(bad)).toBe(false);
  });
  it("dev-loopback rejects non-slug senders; slugs and registered aliases pass", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "test";
    applyMeshRegistryPolicy();
    await serve("127.0.0.1", async (post) => {
      for (const from of ["Bu ild", "büild", "ｂｕｉｌｄ", "b\u200Build", "x".repeat(65), "<script>"]) {
        expect((await post("/agent-comms/send", { from, to: "tessera", content: "hi" })).status).toBe(400);
        expect((await post("/agent-comms/broadcast", { from, content: "hi" })).status).toBe(400);
      }
      const r = await post("/agent-comms/send", { from: "build", to: "tessera", content: "hi" });
      expect(r.status).toBe(200);
      expect(((await r.json()) as { data: { from: string } }).data.from).toBe("build");
    });
  });
});
