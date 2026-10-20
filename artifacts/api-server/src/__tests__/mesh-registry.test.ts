import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { resolveAlias, applyMeshRegistryPolicy, initMeshRegistryFromEnv, isMessageAllowed, getCommsPolicy, setCommsPolicy } from "../lib/comms-policy";
import { loadMeshRegistry, validateMeshRegistry, DEFAULT_MESH_REGISTRY_PATH } from "../lib/mesh-registry";
import { sha256Hex, parseLaneTokens, laneForToken } from "../lib/mesh-lane-auth";
import { validateMeshToken } from "../lib/mesh-auth";
import agentNetworkRouter, { validateCommsBody, OWNER_IDENTITY, isLoopback } from "../routes/agent-network";

afterEach(() => setCommsPolicy(null));
const tmp = mkdtempSync(join(tmpdir(), "mesh-reg-"));
const write = (name: string, body: string) => { const p = join(tmp, name); writeFileSync(p, body); return p; };

describe("mesh lane registry (GM-1)", () => {
  const reg = loadMeshRegistry();
  it("loads config/mesh-lanes.json", () => {
    expect(reg.lanes).toHaveLength(17);
    expect(reg.edges).toHaveLength(735);
  });
  it("allows every registered edge", () => {
    expect(applyMeshRegistryPolicy()).toBe(true);
    for (const [f, t] of reg.edges) expect(isMessageAllowed(f, t)).toBe(true);
  });
  it("rejects unknown edges, including lane -> owner", () => {
    applyMeshRegistryPolicy();
    expect(isMessageAllowed("build", "rick")).toBe(false);
    expect(isMessageAllowed("tessera", "owner-digest")).toBe(false);
    expect(isMessageAllowed("mesh-cloud", "owner-digest")).toBe(false);
    expect(isMessageAllowed("unknown-bot", "tessera")).toBe(false);
  });
});

describe("fail closed + schema (Security HIGH #1)", () => {
  it("missing file denies all edges", () => {
    expect(applyMeshRegistryPolicy(join(tmp, "nope.json"))).toBe(false);
    expect(getCommsPolicy()).toEqual([]);
    expect(isMessageAllowed("build", "tessera")).toBe(false);
  });
  it("invalid JSON denies all edges", () => {
    expect(applyMeshRegistryPolicy(write("bad.json", "{not json"))).toBe(false);
    expect(isMessageAllowed("build", "tessera")).toBe(false);
  });
  it("schema-invalid file denies all edges", () => {
    const p = write("schema.json", JSON.stringify({ lanes: ["a"], edges: [["a", "ghost"]] }));
    expect(applyMeshRegistryPolicy(p)).toBe(false);
    expect(isMessageAllowed("a", "ghost")).toBe(false);
    expect(() => validateMeshRegistry({ lanes: "a", edges: [] })).toThrow();
    expect(() => validateMeshRegistry({ lanes: ["a"], edges: [["a"]] })).toThrow();
    expect(() => validateMeshRegistry({ lanes: ["A B"], edges: [] })).toThrow();
  });
  it("rejects '*' as a sender (whole file denied)", () => {
    expect(() => validateMeshRegistry({ lanes: ["a"], edges: [["*", "a"]] })).toThrow(/sender/);
    const p = write("star.json", JSON.stringify({ lanes: ["a", "b"], edges: [["*", "a"]] }));
    expect(applyMeshRegistryPolicy(p)).toBe(false);
    expect(isMessageAllowed("b", "a")).toBe(false);
  });
  it("still accepts '*' as a recipient", () => {
    expect(validateMeshRegistry({ lanes: ["a"], edges: [["a", "*"]] }).edges).toHaveLength(1);
  });
});

describe("startup hook MESH_REGISTRY_PATH (GM-1b)", () => {
  it("env unset => open", () => {
    expect(initMeshRegistryFromEnv({})).toBe("inert");
    expect(getCommsPolicy()).toBeNull();
    expect(isMessageAllowed("build", "rick")).toBe(true);
  });
  it("env set => enforced", () => {
    expect(initMeshRegistryFromEnv({ MESH_REGISTRY_PATH: DEFAULT_MESH_REGISTRY_PATH })).toBe("enforced");
    expect(isMessageAllowed("build", "tessera")).toBe(true);
    expect(isMessageAllowed("build", "rick")).toBe(false);
  });
  it("env set to missing file => deny-all", () => {
    expect(initMeshRegistryFromEnv({ MESH_REGISTRY_PATH: join(tmp, "missing.json") })).toBe("deny-all");
    expect(isMessageAllowed("build", "tessera")).toBe(false);
  });
});

describe("agent-comms route input checks (Security HIGH #2, partial)", () => {
  const ok = { to: "tessera", content: "hi" };
  it("rejects bad content/type/priority", () => {
    const o = { requireTo: true, allowType: true };
    expect(validateCommsBody(ok, o)).toBeNull();
    expect(validateCommsBody({ ...ok, content: "" }, o)).toMatch(/content/);
    expect(validateCommsBody({ ...ok, content: "x".repeat(4001) }, o)).toMatch(/content/);
    expect(validateCommsBody({ ...ok, content: { a: 1 } }, o)).toMatch(/content/);
    expect(validateCommsBody({ ...ok, type: "evil" }, o)).toMatch(/type/);
    expect(validateCommsBody({ ...ok, priority: "urgent" }, o)).toMatch(/priority/);
    expect(validateCommsBody({ ...ok, to: "x".repeat(129) }, o)).toMatch(/to/);
  });
  it("route returns 400 on bad input and 403 on a denied edge", async () => {
    const app = express().use(express.json()).use(agentNetworkRouter);
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const tok = `fake-${Math.random().toString(36).slice(2)}`;
    const prevTok = process.env.MESH_LANE_TOKENS;
    process.env.MESH_LANE_TOKENS = JSON.stringify({ build: sha256Hex(tok) });
    const post = (body: unknown) => fetch(`http://127.0.0.1:${port}/agent-comms/send`, { method: "POST", headers: { "content-type": "application/json", "x-mesh-lane-token": tok }, body: JSON.stringify(body) });
    try {
      expect((await post({ from: "build", to: "tessera", content: "hi", priority: "urgent" })).status).toBe(400);
      applyMeshRegistryPolicy();
      expect((await post({ from: "build", to: "rick", content: "hi" })).status).toBe(403);
      expect((await post({ from: "build", to: "tessera", content: "hi" })).status).toBe(200);
    } finally { server.close(); if (prevTok === undefined) delete process.env.MESH_LANE_TOKENS; else process.env.MESH_LANE_TOKENS = prevTok; }
  });
});

describe("per-lane tokens + aliases (Security HIGH #2)", () => {
  const fake = () => `fake-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const tTessera = fake(), tBuild = fake();
  const envJson = JSON.stringify({ tessera: sha256Hex(tTessera), build: sha256Hex(tBuild) });
  const prev = process.env.MESH_LANE_TOKENS;
  const restore = () => { if (prev === undefined) delete process.env.MESH_LANE_TOKENS; else process.env.MESH_LANE_TOKENS = prev; };
  const withServer = async (fn: (post: (path: string, body: unknown, token?: string) => Promise<Response>) => Promise<void>) => {
    const app = express().use(express.json()).use(agentNetworkRouter);
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const post = (path: string, body: unknown, token?: string) => fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-mesh-lane-token": token } : {}) }, body: JSON.stringify(body) });
    try { await fn(post); } finally { server.close(); restore(); }
  };

  it("matched token derives from (body from omitted)", async () => withServer(async (post) => {
    process.env.MESH_LANE_TOKENS = envJson;
    const r = await post("/agent-comms/send", { to: "tessera", content: "hi" }, tBuild);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { from: string } }).data.from).toBe("build");
  }));
  it("mismatched body from is rejected", async () => withServer(async (post) => {
    process.env.MESH_LANE_TOKENS = envJson;
    expect((await post("/agent-comms/send", { from: "tessera", to: "build", content: "hi" }, tBuild)).status).toBe(403);
  }));
  it("body from given as an alias of the token's lane is accepted", async () => withServer(async (post) => {
    process.env.MESH_LANE_TOKENS = envJson;
    applyMeshRegistryPolicy();
    expect((await post("/agent-comms/send", { from: "Tessera", to: "build", content: "hi" }, tTessera)).status).toBe(200);
  }));
  it("unknown or missing token is rejected", async () => withServer(async (post) => {
    process.env.MESH_LANE_TOKENS = envJson;
    expect((await post("/agent-comms/send", { to: "tessera", content: "hi" }, fake())).status).toBe(403);
    expect((await post("/agent-comms/send", { to: "tessera", content: "hi" })).status).toBe(403);
    expect((await post("/agent-comms/broadcast", { content: "hi" }, fake())).status).toBe(403);
  }));
  it("malformed MESH_LANE_TOKENS fails closed", async () => withServer(async (post) => {
    process.env.MESH_LANE_TOKENS = "{oops";
    expect((await post("/agent-comms/send", { to: "tessera", content: "hi" }, tBuild)).status).toBe(403);
  }));
  it("env unset: body from is never trusted (401), no Tessera fallback; shared-key validator untouched", async () => {
    delete process.env.MESH_LANE_TOKENS;
    expect(parseLaneTokens({})).toBeNull();
    expect(validateMeshToken(undefined)).toBeNull();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production"; // disable the dev loopback exception for this test
    try { await withServer(async (post) => {
      delete process.env.MESH_LANE_TOKENS;
      expect((await post("/agent-comms/send", { from: "Alpha", to: "Beta", content: "hi" })).status).toBe(401);
      expect((await post("/agent-comms/send", { from: "tessera", to: "build", content: "hi" })).status).toBe(401);
      expect((await post("/agent-comms/send", { to: "build", content: "hi" }, fake())).status).toBe(401);
      const b = await post("/agent-comms/broadcast", { content: "hi" });
      expect(b.status).toBe(401);
      expect(JSON.stringify(await b.json())).not.toMatch(/Tessera/);
      expect((await post("/agent-comms/broadcast", { from: "Tessera", content: "hi" })).status).toBe(401);
    }); } finally { process.env.NODE_ENV = prevEnv; }
  });
  it("council slugs are valid MESH_LANE_TOKENS identities; bad slugs rejected", async () => {
    const t = fake();
    const json = JSON.stringify({ "council-sigma": sha256Hex(t) });
    expect(laneForToken(t, parseLaneTokens({ MESH_LANE_TOKENS: json })!)).toBe("council-sigma");
    const withDoc = parseLaneTokens({ MESH_LANE_TOKENS: JSON.stringify({ _doc: "comment", "council-sigma": sha256Hex(t) }) })!;
    expect(withDoc.size).toBe(1);
    expect(() => parseLaneTokens({ MESH_LANE_TOKENS: JSON.stringify({ "Bad Slug!": sha256Hex(t) }) })).toThrow(/slug/);
    await withServer(async (post) => {
      process.env.MESH_LANE_TOKENS = json;
      applyMeshRegistryPolicy();
      expect((await post("/agent-comms/send", { to: "tessera", content: "hi" }, t)).status).toBe(200);
      expect((await post("/agent-comms/send", { to: "rick", content: "hi" }, t)).status).toBe(403);
    });
  });
  it("laneForToken: hashes + constant-time match", () => {
    const table = parseLaneTokens({ MESH_LANE_TOKENS: envJson })!;
    expect(laneForToken(tTessera, table)).toBe("tessera");
    expect(laneForToken(fake(), table)).toBeNull();
    expect(() => parseLaneTokens({ MESH_LANE_TOKENS: JSON.stringify({ a: "not-hex" }) })).toThrow();
  });
  it("aliases: schema-validated; seeded Tessera flows resolve through the alias", () => {
    expect(() => validateMeshRegistry({ lanes: ["a"], edges: [], aliases: { X: "ghost" } })).toThrow(/alias/);
    expect(() => validateMeshRegistry({ lanes: ["a"], edges: [], aliases: [] })).toThrow(/aliases/);
    expect(loadMeshRegistry().aliases!.Tessera).toBe("tessera");
    applyMeshRegistryPolicy();
    expect(resolveAlias("Tessera")).toBe("tessera");
    expect(isMessageAllowed("Tessera", "build")).toBe(true);
    expect(isMessageAllowed("build", "Tessera")).toBe(true);
    expect(isMessageAllowed("Tessera", "Sigma")).toBe(true);
  });
});

describe("council node group", () => {
  const reg = loadMeshRegistry();
  const council = reg.groups!.find((g) => g.kind === "council")!.nodes;
  it("has 26 council nodes, each aliased from its seeded name", () => {
    expect(council).toHaveLength(26);
    for (const [name, slug] of Object.entries(reg.aliases!)) if (name !== "Tessera") expect(slug).toBe(`council-${name.toLowerCase()}`);
  });
  it("seeded flows pass with the registry on", () => {
    applyMeshRegistryPolicy();
    const seeded = [["Tessera", "Sigma"], ["Sigma", "Tessera"], ["Theta", "Pi"], ["Pi", "Theta"], ["Zeta", "Mu"], ["Mu", "Zeta"], ["Alpha", "Omicron"], ["Omicron", "Alpha"]];
    for (const [f, t] of seeded) expect(isMessageAllowed(f, t)).toBe(true);
  });
  it("council -> mesh lane and council -> owner-digest are denied", () => {
    applyMeshRegistryPolicy();
    for (const c of council) {
      expect(isMessageAllowed(c, "rick")).toBe(false);
      expect(isMessageAllowed(c, "owner-digest")).toBe(false);
      expect(isMessageAllowed("build", c)).toBe(false);
    }
    expect(isMessageAllowed("Sigma", "rick")).toBe(false);
  });
  it("schema: group -> lane / sink / wildcard edges rejected; group -> tessera and group -> group allowed", () => {
    const base = { lanes: ["tessera", "rick"], sinks: ["owner-digest"], groups: [{ kind: "council", nodes: ["council-a", "council-b"] }] };
    expect(() => validateMeshRegistry({ ...base, edges: [["council-a", "rick"]] })).toThrow(/may not message/);
    expect(() => validateMeshRegistry({ ...base, edges: [["council-a", "owner-digest"]] })).toThrow(/may not message/);
    expect(() => validateMeshRegistry({ ...base, edges: [["council-a", "*"]] })).toThrow(/may not message/);
    expect(() => validateMeshRegistry({ ...base, edges: [["council-a", "tessera"], ["council-a", "council-b"], ["tessera", "council-a"]] })).not.toThrow();
  });
  it("schema: bad kind / unprefixed node rejected", () => {
    expect(() => validateMeshRegistry({ lanes: ["a"], edges: [], groups: [{ kind: "evil", nodes: ["evil-x"] }] })).toThrow(/kind/);
    expect(() => validateMeshRegistry({ lanes: ["a"], edges: [], groups: [{ kind: "council", nodes: ["sigma"] }] })).toThrow(/prefixed/);
  });
});

describe("logger redaction (Security LOW)", () => {
  it("redacts x-mesh-lane-token", async () => {
    const pino = (await import("pino")).default;
    const { Writable } = await import("node:stream");
    const lines: string[] = [];
    const sink = new Writable({ write(c, _e, cb) { lines.push(String(c)); cb(); } });
    const secret = `fake-${Math.random().toString(36).slice(2)}`;
    const { LOGGER_REDACT_PATHS } = await import("../lib/logger");
    const l = pino({ redact: LOGGER_REDACT_PATHS }, sink);
    l.info({ req: { headers: { "x-mesh-lane-token": secret, authorization: "x" } } }, "req");
    expect(lines.join("")).not.toContain(secret);
    expect(lines.join("")).toContain("[Redacted]");
    expect(LOGGER_REDACT_PATHS).toContain("req.headers['x-mesh-lane-token']");
  });
});

describe("tokens unset: owner-session and dev-loopback exceptions", () => {
  const saved = { ...process.env };
  afterEach(() => { for (const k of ["NODE_ENV", "MESH_LANE_TOKENS", "TESSERACT_ADMIN_KEY", "SOVEREIGN_SESSION_SECRET"]) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } setCommsPolicy(null); });
  const serve = async (remote: string | null, fn: (post: (path: string, body: unknown, headers?: Record<string, string>) => Promise<Response>) => Promise<void>) => {
    const app = express().use((req, _res, next) => { if (remote !== null) Object.defineProperty(req.socket, "remoteAddress", { value: remote, configurable: true }); next(); })
      .use(express.json()).use(agentNetworkRouter);
    const server = await new Promise<any>((ok) => { const s = app.listen(0, "127.0.0.1", () => ok(s)); });
    const port = (server.address() as any).port;
    const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    try { await fn(post); } finally { server.close(); }
  };
  it("owner session: from forced to the owner identity; mismatching body from rejected", async () => {
    delete process.env.MESH_LANE_TOKENS;
    process.env.NODE_ENV = "production";
    process.env.TESSERACT_ADMIN_KEY = `fake-admin-${Math.random().toString(36).slice(2)}-xxxxxxxx`;
    process.env.SOVEREIGN_SESSION_SECRET = `fake-secret-${"s".repeat(40)}`;
    const { issueSession, SESSION_COOKIE } = await import("../lib/sovereign-session");
    const cookie = `${SESSION_COOKIE}=${issueSession({ ip: "10.0.0.5", userAgent: "t" }).signedId}`;
    await serve("10.0.0.5", async (post) => {
      const r = await post("/agent-comms/send", { to: "build", content: "hi" }, { cookie });
      expect(r.status).toBe(200);
      expect((await r.json()).data.from).toBe(OWNER_IDENTITY);
      const b = await post("/agent-comms/broadcast", { content: "hi" }, { cookie });
      expect(b.status).toBe(200);
      expect((await post("/agent-comms/send", { from: "tessera", to: "build", content: "hi" }, { cookie })).status).toBe(403);
      expect((await post("/agent-comms/send", { from: "tessera", to: "build", content: "hi" }, { cookie: `${SESSION_COOKIE}=forged.abc` })).status).toBe(401);
    });
  });
  it("non-production loopback is allowed (body from used)", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "test";
    for (const addr of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) await serve(addr, async (post) => {
      const r = await post("/agent-comms/send", { from: "build", to: "tessera", content: "hi" });
      expect(r.status).toBe(200);
      expect((await r.json()).data.from).toBe("build");
    });
  });
  it("production loopback gets 401", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "production";
    await serve("127.0.0.1", async (post) => {
      expect((await post("/agent-comms/send", { from: "build", to: "tessera", content: "hi" })).status).toBe(401);
      expect((await post("/agent-comms/broadcast", { from: "build", content: "hi" })).status).toBe(401);
    });
  });
  it("non-loopback without a session gets 401, and spoofed X-Forwarded-For is ignored", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "test";
    await serve("203.0.113.9", async (post) => {
      expect((await post("/agent-comms/send", { from: "build", to: "tessera", content: "hi" })).status).toBe(401);
      expect((await post("/agent-comms/send", { from: "build", to: "tessera", content: "hi" }, { "x-forwarded-for": "127.0.0.1" })).status).toBe(401);
      expect((await post("/agent-comms/broadcast", { from: "build", content: "hi" }, { "x-forwarded-for": "::1" })).status).toBe(401);
    });
    expect(isLoopback("127.0.0.2")).toBe(false);
    expect(isLoopback(undefined)).toBe(false);
  });
  it("registry policy still applies to the loopback-resolved from", async () => {
    delete process.env.MESH_LANE_TOKENS; process.env.NODE_ENV = "test";
    applyMeshRegistryPolicy();
    await serve("127.0.0.1", async (post) => {
      expect((await post("/agent-comms/send", { from: "build", to: "rick", content: "hi" })).status).toBe(403);
    });
  });
});
