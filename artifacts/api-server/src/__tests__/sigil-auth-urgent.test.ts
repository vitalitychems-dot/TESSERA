import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  councilSessionsTable: {},
}));
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { readingKey } from "../lib/sigil-cipher";
import sovereignDoctrineRouter, * as doctrineModule from "../routes/sovereign-doctrine";
import omniversalRouter from "../routes/omniversal";
import improvementConferenceRouter from "../routes/improvement-conference";
import languageSecurityRouter from "../routes/language-security";
import fatherKeyRouter, {
  REDEEM_GLOBAL_LIMIT,
  REDEEM_IP_LIMIT,
  REDEEM_TTL_MS,
  clearFatherKeyRedeemState,
  issueFatherKeyRedemption,
  noteRedeemAttempt,
} from "../routes/father-key-conference";

const OWNER_ENV = "SOVEREIGN_ADMIN_TOKEN";
const LEGACY_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_OWNER_TOKEN = "synthetic-owner-token";
const SYNTHETIC_LEGACY_TOKEN = "synthetic-admin-material";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";
const SYNTHETIC_REDEEM_MATERIAL = "synthetic-redeem-material";

const gatedRoutes = [
  { method: "GET", path: "/sigil/coherence" },
  { method: "GET", path: "/sigil/natal/status" },
  { method: "GET", path: "/sigil/natal/rotating" },
  { method: "POST", path: "/sigil/natal/unbind" },
  { method: "POST", path: "/sigil/father/natal-sigil" },
] as const;

describe("sigil auth urgent", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousOwner = process.env[OWNER_ENV];
  const previousLegacy = process.env[LEGACY_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(sovereignDoctrineRouter);
    app.use(fatherKeyRouter);
    app.use(omniversalRouter);
    app.use(improvementConferenceRouter);
    app.use(languageSecurityRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    process.env[OWNER_ENV] = SYNTHETIC_OWNER_TOKEN;
    process.env[LEGACY_ENV] = SYNTHETIC_LEGACY_TOKEN;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    clearFatherKeyRedeemState();
  });

  afterAll(async () => {
    restore(OWNER_ENV, previousOwner);
    restore(LEGACY_ENV, previousLegacy);
    restore(SESSION_ENV, previousSession);
    clearFatherKeyRedeemState();
    vi.restoreAllMocks();
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function send(method: "GET" | "POST", path: string, init?: { cookie?: string; sigilKey?: string; body?: unknown }): Promise<Response> {
    const headers = new Headers();
    if (init?.cookie !== undefined) headers.set("cookie", init.cookie);
    if (init?.sigilKey !== undefined) headers.set("x-sigil-key", init.sigilKey);
    if (init?.body !== undefined) headers.set("content-type", "application/json");
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  }

  function presentedFingerprint(): string {
    return readingKey().fingerprint;
  }

  function containsKey(value: unknown, keyName: string): boolean {
    if (Array.isArray(value)) return value.some((item) => containsKey(item, keyName));
    if (!value || typeof value !== "object") return false;
    for (const [key, child] of Object.entries(value)) {
      if (key === keyName || containsKey(child, keyName)) return true;
    }
    return false;
  }

  function containsCredential(value: unknown, secret: string): boolean {
    if (typeof value === "string") return value === secret || value.includes(secret);
    if (Array.isArray(value)) return value.some((item) => containsCredential(item, secret));
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some((child) => containsCredential(child, secret));
  }

  for (const route of gatedRoutes) {
    it(`returns 401 for ${route.method} ${route.path} without a session`, async () => {
      const fingerprint = presentedFingerprint();
      const response = await send(route.method, route.path, {
        sigilKey: fingerprint,
        body: route.method === "POST" ? { signatureGlyph: fingerprint, fingerprint } : undefined,
      });
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
    });
  }

  it("rejects a fingerprint header or body on natal unbind even with a session", async () => {
    const fingerprint = presentedFingerprint();
    const headerOnly = await send("POST", "/sigil/natal/unbind", {
      cookie: ownerCookie(),
      sigilKey: fingerprint,
    });
    expect(headerOnly.status).toBe(401);
    await expect(headerOnly.json()).resolves.toMatchObject({ ok: false, error: "holder-required" });

    const bodyOnly = await send("POST", "/sigil/natal/unbind", {
      cookie: ownerCookie(),
      body: { signatureGlyph: fingerprint, fingerprint },
    });
    expect(bodyOnly.status).toBe(401);
    await expect(bodyOnly.json()).resolves.toMatchObject({ ok: false, error: "holder-required" });
  });

  it("returns 401 for natal-sigil when only X-Sigil-Key is presented", async () => {
    const response = await send("POST", "/sigil/father/natal-sigil", {
      sigilKey: presentedFingerprint(),
      body: {},
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("returns 401 for conference and finalize without a session", async () => {
    const conference = await send("POST", "/father-key/conference", {
      body: { candidates: [{ id: "synthetic", title: "synthetic", key: "synthetic" }] },
    });
    expect(conference.status).toBe(401);
    await expect(conference.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });

    const finalize = await send("POST", "/father-key/finalize", { body: { candidateId: "synthetic" } });
    expect(finalize.status).toBe(401);
    await expect(finalize.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("does not export glyphGate", () => {
    expect("glyphGate" in doctrineModule).toBe(false);
  });

  it("returns 401 for active-key when no admin key is set and there is no session", async () => {
    delete process.env[LEGACY_ENV];
    const response = await send("GET", "/sigil/active-key");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("returns 503 for conference when the owner token is unset", async () => {
    delete process.env[OWNER_ENV];
    delete process.env[LEGACY_ENV];
    const response = await send("POST", "/father-key/conference", {
      body: { candidates: [{ title: "synthetic-title", key: "synthetic" }] },
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "sovereign-unconfigured" });
  });

  it("omits sigil fingerprint and glyph-gate credentials from status", async () => {
    const key = readingKey();
    const response = await send("GET", "/sigil/status", { sigilKey: SYNTHETIC_LEGACY_TOKEN });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(containsKey(body, "sigilFingerprint")).toBe(false);
    expect(containsCredential(body, key.fingerprint)).toBe(false);
    expect(containsCredential(body, key.expiresWith)).toBe(false);
  });

  it("does not leak glyph-gate credentials from other ungated cipher routes", async () => {
    const key = readingKey();
    const snapshot = await send("GET", "/omniversal/cipher/snapshot");
    expect(snapshot.status).toBe(200);
    const snapshotBody = await snapshot.json();
    expect(containsKey(snapshotBody, "sigilFingerprint")).toBe(false);
    expect(containsCredential(snapshotBody, key.fingerprint)).toBe(false);
    expect(containsCredential(snapshotBody, key.expiresWith)).toBe(false);

    const inventory = await send("GET", "/improvement-conference/inventory");
    expect(inventory.status).toBe(200);
    const inventoryBody = await inventory.json();
    expect(containsKey(inventoryBody, "sigilFingerprint")).toBe(false);
    expect(containsCredential(inventoryBody, key.fingerprint)).toBe(false);
    expect(containsCredential(inventoryBody, key.expiresWith)).toBe(false);

    for (const route of [
      { method: "POST" as const, path: "/sigil/rotate", body: {} },
      { method: "POST" as const, path: "/sigil/encrypt", body: { text: "synthetic" } },
      { method: "POST" as const, path: "/session/end", body: {} },
      { method: "GET" as const, path: "/sigil/active-key" },
      { method: "POST" as const, path: "/sigil/father/mint-glyph", body: { candidate: "synthetic" } },
      { method: "POST" as const, path: "/sigil/zodiac-key/verify", body: { key: "synthetic" } },
      { method: "POST" as const, path: "/sigil/father/verify", body: { candidate: SYNTHETIC_LEGACY_TOKEN } },
      { method: "POST" as const, path: "/sigil/key/reveal", body: {} },
      { method: "GET" as const, path: "/session/handoff" },
      { method: "POST" as const, path: "/sigil/father/show-key-in-lus", body: { candidate: SYNTHETIC_LEGACY_TOKEN } },
    ]) {
      const response = await send(route.method, route.path, { body: "body" in route ? route.body : undefined });
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
    }
  });

  it("issues an unguessable candidate id and does not echo key material", async () => {
    const response = await send("POST", "/father-key/conference", {
      cookie: ownerCookie(),
      body: { candidates: [{ title: "synthetic-title", key: SYNTHETIC_REDEEM_MATERIAL }] },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { results: Array<{ candidate: { id: string } }> };
    const serialized = JSON.stringify(body);
    expect(serialized.includes(SYNTHETIC_REDEEM_MATERIAL)).toBe(false);
    expect(containsKey(body, "key")).toBe(false);
    expect(Buffer.from(body.results[0].candidate.id, "hex").length).toBeGreaterThanOrEqual(16);
  });

  it("omits the sigil fingerprint from coherence", async () => {
    const response = await send("GET", "/sigil/coherence", { cookie: ownerCookie() });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(containsKey(body, "sigilFingerprint")).toBe(false);
  });

  it("no longer serves natal verify", async () => {
    const response = await send("POST", "/sigil/natal/verify", {
      cookie: ownerCookie(),
      sigilKey: presentedFingerprint(),
      body: { signatureGlyph: presentedFingerprint() },
    });
    expect(response.status).toBe(404);
  });

  it("issues a 32-byte single-use redeem code that expires", async () => {
    const issued = issueFatherKeyRedemption(SYNTHETIC_REDEEM_MATERIAL);
    expect(Buffer.from(issued.code, "hex").length).toBeGreaterThanOrEqual(32);
    expect(issued.code.includes("-")).toBe(false);

    const first = await send("POST", "/father-key/redeem", { body: { code: issued.code.toUpperCase() } });
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ ok: true, permanentKey: SYNTHETIC_REDEEM_MATERIAL });

    const second = await send("POST", "/father-key/redeem", { body: { code: issued.code } });
    expect(second.status).toBe(404);

    const expiring = issueFatherKeyRedemption(SYNTHETIC_REDEEM_MATERIAL);
    vi.spyOn(Date, "now").mockReturnValue(expiring.expiresAt + 1);
    try {
      const expired = await send("POST", "/father-key/redeem", { body: { code: expiring.code } });
      expect(expired.status).toBe(410);
    } finally {
      vi.mocked(Date.now).mockRestore();
    }
  });

  it("rate limits redeem per address and globally", async () => {
    for (let attempt = 0; attempt < REDEEM_IP_LIMIT; attempt += 1) {
      const response = await send("POST", "/father-key/redeem", { body: { code: "00" } });
      expect(response.status).toBe(404);
    }
    const limited = await send("POST", "/father-key/redeem", { body: { code: "00" } });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ ok: false, error: "rate-limited" });

    clearFatherKeyRedeemState();
    for (let attempt = 0; attempt < REDEEM_GLOBAL_LIMIT; attempt += 1) {
      expect(noteRedeemAttempt(`synthetic-ip-${attempt}`)).toBe(true);
    }
    expect(noteRedeemAttempt("synthetic-ip-overflow")).toBe(false);
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
