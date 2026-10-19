import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createHmac, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { stopAutonomousRotation } from "../lib/sovereign-cipher";
import { stopBandRotationScheduler } from "../lib/lattice-frequency-bands";
import {
  COLONIAL_LEGACY_XOR_MIN_LENGTH,
  COLONIAL_LEGACY_XOR_NOT_CONFIGURED,
  ColonialLegacyXorNotConfiguredError,
  colonialLegacyXorUnavailableBody,
  compressLegacy,
  xorDecode,
  xorEncode,
} from "../lib/colonial-language-kernel";
import colonialLanguageRouter from "../routes/colonial-language";

vi.mock("@workspace/db", () => ({
  db: {},
}));

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const XOR_ENV = "COLONIAL_LEGACY_XOR_KEY";
const DATABASE_ENV = "DATABASE_URL";
const SYNTHETIC_ADMIN_KEY = "synthetic-admin-key-16";
const SHORT_ADMIN_KEY = "short-admin";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";
const TEST_XOR_KEY = "synthetic-legacy-xor-key-32chars!";
const OTHER_XOR_KEY = "different-legacy-xor-key-32chars!";
const SHORT_XOR_KEY = "synthetic-legacy-xor-short";

const GENERIC_401 = { ok: false, error: "unauthenticated", reason: "no-cookie" };
const GENERIC_503 = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};

type Method = "GET" | "POST";

const GATED: Array<{ method: Method; path: string; body?: Record<string, string> }> = [
  { method: "GET", path: "/colonel/stats" },
  { method: "POST", path: "/colonel/compress", body: { text: "synthetic" } },
  { method: "POST", path: "/colonel/translate", body: { text: "synthetic", direction: "to" } },
  { method: "GET", path: "/sovereignty/colonial-language/conference" },
];

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function leaks(text: string, secret: string): boolean {
  return secret.length > 0 && text.includes(secret);
}

function expectClosed(run: () => void): void {
  try {
    run();
    throw new Error("expected legacy xor path to fail closed");
  } catch (err) {
    expect(err).toBeInstanceOf(ColonialLegacyXorNotConfiguredError);
    expect((err as Error).message).toBe(COLONIAL_LEGACY_XOR_NOT_CONFIGURED);
    expect((err as Error).message).toBe((err as ColonialLegacyXorNotConfiguredError).code);
  }
}

describe("colonial language admin gate and legacy xor key", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];
  const previousXor = process.env[XOR_ENV];
  const previousDatabase = process.env[DATABASE_ENV];

  beforeAll(async () => {
    expect(SHORT_ADMIN_KEY.length).toBeLessThan(16);
    expect(SYNTHETIC_ADMIN_KEY.length).toBeGreaterThanOrEqual(16);
    expect(SYNTHETIC_SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(COLONIAL_LEGACY_XOR_MIN_LENGTH).toBe(32);
    expect(TEST_XOR_KEY.length).toBeGreaterThanOrEqual(COLONIAL_LEGACY_XOR_MIN_LENGTH);
    expect(OTHER_XOR_KEY.length).toBeGreaterThanOrEqual(COLONIAL_LEGACY_XOR_MIN_LENGTH);
    expect(SHORT_XOR_KEY.length).toBeLessThan(COLONIAL_LEGACY_XOR_MIN_LENGTH);
    delete process.env[DATABASE_ENV];

    const app = express();
    app.use(express.json());
    app.use(colonialLanguageRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    delete process.env[XOR_ENV];
    delete process.env[DATABASE_ENV];
  });

  afterAll(async () => {
    stopAutonomousRotation();
    stopBandRotationScheduler();
    restore(ADMIN_ENV, previousAdmin);
    restore(SESSION_ENV, previousSession);
    restore(XOR_ENV, previousXor);
    restore(DATABASE_ENV, previousDatabase);
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
    method: Method,
    path: string,
    cookie?: string,
    body?: Record<string, string>,
    withAdminKey = false,
  ): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    let payload: Record<string, string> | undefined = body;
    if (withAdminKey) {
      headers.set("x-tesseract-admin-key", SYNTHETIC_ADMIN_KEY);
      headers.set("x-admin-token", SYNTHETIC_ADMIN_KEY);
      headers.set("authorization", `Bearer ${SYNTHETIC_ADMIN_KEY}`);
      if (payload !== undefined) {
        payload = { ...payload, token: SYNTHETIC_ADMIN_KEY, adminKey: SYNTHETIC_ADMIN_KEY };
      }
    }
    let serialized: string | undefined;
    if (payload !== undefined) {
      headers.set("content-type", "application/json");
      serialized = JSON.stringify(payload);
    }
    return fetch(`${baseUrl}${path}`, { method, headers, body: serialized });
  }

  function invalidSessionCookie(): string {
    return `${SESSION_COOKIE}=not-a-session`;
  }

  function forgedSessionCookie(): string {
    const rawId = randomBytes(32).toString("hex");
    const mac = createHmac("sha256", SYNTHETIC_ADMIN_KEY).update(rawId).digest("hex");
    return `${SESSION_COOKIE}=${rawId}.${mac}`;
  }

  async function expectJson(response: Response, status: number, body: unknown): Promise<void> {
    expect(response.status).toBe(status);
    const json: unknown = await response.json();
    expect(json).toEqual(body);
    const text = JSON.stringify(json);
    expect(leaks(text, SYNTHETIC_ADMIN_KEY)).toBe(false);
    expect(leaks(text, SYNTHETIC_SESSION_SECRET)).toBe(false);
    expect(leaks(text, SHORT_ADMIN_KEY)).toBe(false);
    expect(leaks(text, TEST_XOR_KEY)).toBe(false);
    expect(leaks(text, OTHER_XOR_KEY)).toBe(false);
    expect(leaks(text, SHORT_XOR_KEY)).toBe(false);
    expect(text.includes("length")).toBe(false);
  }

  it("returns 401 for every gated route when no owner session is presented", async () => {
    for (const route of GATED) {
      const response = await send(route.method, route.path, undefined, route.body);
      await expectJson(response, 401, GENERIC_401);
    }
  });

  it("rejects an invalid or forged cookie even when a valid admin key is presented", async () => {
    const cookies = [invalidSessionCookie(), forgedSessionCookie(), `${SESSION_COOKIE}=${SYNTHETIC_ADMIN_KEY}`];
    for (const cookie of cookies) {
      for (const route of GATED) {
        const response = await send(route.method, route.path, cookie, route.body, true);
        await expectJson(response, 401, { ok: false, error: "unauthenticated", reason: "bad-signature" });
      }
    }
  });

  it("rejects an expired owner cookie even when a valid admin key is presented", async () => {
    const issued = GATED.map(() => issueSession({ ip: "127.0.0.1", userAgent: "vitest", ttlMs: 60_000 }));
    const deadline = Math.max(...issued.map((session) => session.expiresAt)) + 1_000;
    const now = vi.spyOn(Date, "now").mockImplementation(() => deadline);
    try {
      for (const [index, route] of GATED.entries()) {
        const session = issued[index];
        if (!session) throw new Error("missing issued session");
        const response = await send(
          route.method,
          route.path,
          `${SESSION_COOKIE}=${session.signedId}`,
          route.body,
          true,
        );
        await expectJson(response, 401, { ok: false, error: "unauthenticated", reason: "expired" });
      }
    } finally {
      now.mockRestore();
    }
  });

  it("returns 503 for every gated route when the admin key is unset", async () => {
    delete process.env[ADMIN_ENV];
    for (const route of GATED) {
      const withCookie = await send(route.method, route.path, `${SESSION_COOKIE}=synthetic-cookie`, route.body);
      await expectJson(withCookie, 503, GENERIC_503);
      const withoutCookie = await send(route.method, route.path, undefined, route.body);
      await expectJson(withoutCookie, 503, GENERIC_503);
    }
  });

  it("returns 503 for every gated route when the admin key is shorter than 16 characters", async () => {
    process.env[ADMIN_ENV] = SHORT_ADMIN_KEY;
    for (const route of GATED) {
      const response = await send(route.method, route.path, undefined, route.body);
      await expectJson(response, 503, GENERIC_503);
    }
  });

  it("lets an owner session through stats, translate, and conference", async () => {
    const cookie = ownerCookie();
    const stats = await send("GET", "/colonel/stats", cookie);
    expect(stats.status).toBe(200);
    const statsJson = await stats.json() as { ok?: boolean; phrases?: number };
    expect(statsJson.ok).toBe(true);
    expect(typeof statsJson.phrases).toBe("number");
    expect(leaks(JSON.stringify(statsJson), TEST_XOR_KEY)).toBe(false);

    const translated = await send("POST", "/colonel/translate", cookie, { text: "synthetic", direction: "to" });
    expect(translated.status).toBe(200);
    const translatedJson = await translated.json() as { ok?: boolean; direction?: string; translated?: string };
    expect(translatedJson.ok).toBe(true);
    expect(translatedJson.direction).toBe("to");
    expect(typeof translatedJson.translated).toBe("string");

    const fromColonial = await send("POST", "/colonel/translate", cookie, {
      text: translatedJson.translated ?? "",
      direction: "from",
    });
    expect(fromColonial.status).toBe(200);
    const fromJson = await fromColonial.json() as { ok?: boolean; direction?: string };
    expect(fromJson.ok).toBe(true);
    expect(fromJson.direction).toBe("from");

    const conference = await send("GET", "/sovereignty/colonial-language/conference", cookie);
    expect(conference.status).toBe(200);
    const conferenceJson = await conference.json() as { ok?: boolean; data?: { conference?: { status?: string } } };
    expect(conferenceJson.ok).toBe(true);
    expect(conferenceJson.data?.conference?.status).toBeTruthy();
    expect(leaks(JSON.stringify(conferenceJson), SYNTHETIC_ADMIN_KEY)).toBe(false);
  });

  it("returns a generic 503 from the compress handler when the legacy key is unset or too short", async () => {
    const cookie = ownerCookie();
    for (const value of [undefined, "", SHORT_XOR_KEY] as const) {
      if (value === undefined) delete process.env[XOR_ENV];
      else process.env[XOR_ENV] = value;
      const response = await send("POST", "/colonel/compress", cookie, { text: "synthetic" });
      await expectJson(response, 503, colonialLegacyXorUnavailableBody());
    }
  });

  it("compresses with an owner session when the legacy key is set to a test value", async () => {
    process.env[XOR_ENV] = TEST_XOR_KEY;
    const cookie = ownerCookie();
    const response = await send("POST", "/colonel/compress", cookie, { text: "synthetic payload" });
    expect(response.status).toBe(200);
    const json = await response.json() as { ok?: boolean; compressed?: string; method?: string };
    expect(json.ok).toBe(true);
    expect(typeof json.compressed).toBe("string");
    expect((json.compressed ?? "").length).toBeGreaterThan(0);
    expect(json.method).toContain("legacy");
    const serialized = JSON.stringify(json);
    expect(leaks(serialized, TEST_XOR_KEY)).toBe(false);
    expect(leaks(serialized, SYNTHETIC_ADMIN_KEY)).toBe(false);
    expect(serialized.includes("Error")).toBe(false);
  });

  it("fails the legacy kernel closed when the env var is unset, empty, or too short", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const hadBypass = Object.prototype.hasOwnProperty.call(process.env, "TESSERA_ENABLE_COLONIAL_FALLBACK");
    const previousBypass = process.env.TESSERA_ENABLE_COLONIAL_FALLBACK;
    try {
      for (const value of [undefined, "", SHORT_XOR_KEY] as const) {
        if (value === undefined) delete process.env[XOR_ENV];
        else process.env[XOR_ENV] = value;
        expectClosed(() => xorEncode("synthetic"));
        expectClosed(() => xorDecode("c3ludGhldGlj"));
        expectClosed(() => compressLegacy("synthetic"));
      }
      process.env.NODE_ENV = "development";
      process.env.TESSERA_ENABLE_COLONIAL_FALLBACK = "1";
      delete process.env[XOR_ENV];
      expectClosed(() => xorEncode("synthetic"));
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (hadBypass) process.env.TESSERA_ENABLE_COLONIAL_FALLBACK = previousBypass;
      else delete process.env.TESSERA_ENABLE_COLONIAL_FALLBACK;
    }
  });

  it("round-trips the legacy kernel when the env var is set to a test value", () => {
    const plaintext = "synthetic payload";
    process.env[XOR_ENV] = TEST_XOR_KEY;
    const encoded = xorEncode(plaintext);
    expect(xorDecode(encoded)).toBe(plaintext);
    const compressed = compressLegacy(plaintext);
    expect(compressed.method).toContain("legacy");
    expect(compressed.compressed.length).toBeGreaterThan(0);
    expect(leaks(compressed.compressed, TEST_XOR_KEY)).toBe(false);

    process.env[XOR_ENV] = OTHER_XOR_KEY;
    const other = xorEncode(plaintext);
    expect(other).not.toBe(encoded);
    expect(xorDecode(other)).toBe(plaintext);
    expect(leaks(other, OTHER_XOR_KEY)).toBe(false);
  });
});
