import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { colonialSecretUnavailableBody } from "../lib/colonial-master-secret";
import { stopAutonomousRotation } from "../lib/sovereign-cipher";
import { stopBandRotationScheduler } from "../lib/lattice-frequency-bands";
import colonialLanguageRouter from "../routes/colonial-language";
import sovereignLanguageRouter from "../routes/sovereign-language";

vi.mock("@workspace/db", () => ({
  db: {},
}));

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const COLONIAL_ENV = "COLONIAL_MASTER_SECRET";
const DATABASE_ENV = "DATABASE_URL";
const SYNTHETIC_ADMIN_KEY = "synthetic-admin-key-16";
const SHORT_ADMIN_KEY = "short-admin";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

const GENERIC_401 = { ok: false, error: "unauthenticated", reason: "no-cookie" };
const GENERIC_503 = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};

type Method = "GET" | "POST";

const GATED: Array<{
  method: Method;
  path: string;
  body?: Record<string, string>;
  colonial503: boolean;
}> = [
  { method: "POST", path: "/colonel/compress-encrypt", body: { text: "synthetic" }, colonial503: true },
  { method: "GET", path: "/sovereignty/colonial-language/status", colonial503: true },
  { method: "GET", path: "/sovereignty/colonial-language/lattice-frequencies", colonial503: true },
  { method: "POST", path: "/sovereignty/colonial-language/rotate", colonial503: true },
  { method: "GET", path: "/sovereign-language/sovereign-layer/verify", colonial503: true },
  { method: "GET", path: "/sovereign-language/kernel/status", colonial503: false },
  {
    method: "POST",
    path: "/sovereign-language/kernel/execute",
    body: { instruction: "synthetic" },
    colonial503: false,
  },
  { method: "POST", path: "/sovereign-language/encrypt", body: { text: "synthetic" }, colonial503: true },
  { method: "GET", path: "/sovereign-language/cipher/status", colonial503: true },
  {
    method: "POST",
    path: "/sovereign-language/cipher/encrypt",
    body: { text: "synthetic", agentId: "agent-a" },
    colonial503: true,
  },
  {
    method: "POST",
    path: "/sovereign-language/cipher/pair-encrypt",
    body: { text: "synthetic", senderAgent: "agent-a", receiverAgent: "agent-b" },
    colonial503: true,
  },
];

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("colonial and sovereign language admin gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];
  const previousColonial = process.env[COLONIAL_ENV];
  const previousDatabase = process.env[DATABASE_ENV];

  beforeAll(async () => {
    expect(SHORT_ADMIN_KEY.length).toBeLessThan(16);
    expect(SYNTHETIC_ADMIN_KEY.length).toBeGreaterThanOrEqual(16);
    expect(SYNTHETIC_SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    delete process.env[DATABASE_ENV];

    const app = express();
    app.use(express.json());
    app.use(colonialLanguageRouter);
    app.use(sovereignLanguageRouter);
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
    delete process.env[COLONIAL_ENV];
    delete process.env[DATABASE_ENV];
  });

  afterAll(async () => {
    stopAutonomousRotation();
    stopBandRotationScheduler();
    restore(ADMIN_ENV, previousAdmin);
    restore(SESSION_ENV, previousSession);
    restore(COLONIAL_ENV, previousColonial);
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

  async function send(method: Method, path: string, cookie?: string, body?: Record<string, string>): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    let payload: string | undefined;
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      payload = JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, { method, headers, body: payload });
  }

  async function expectJson(response: Response, status: number, body: unknown): Promise<void> {
    expect(response.status).toBe(status);
    const json: unknown = await response.json();
    expect(json).toEqual(body);
    const text = JSON.stringify(json);
    expect(text).not.toContain(SYNTHETIC_ADMIN_KEY);
    expect(text).not.toContain(SYNTHETIC_SESSION_SECRET);
    expect(text).not.toContain(SHORT_ADMIN_KEY);
  }

  it("returns 401 for every gated route when no owner session is presented", async () => {
    for (const route of GATED) {
      const response = await send(route.method, route.path, undefined, route.body);
      await expectJson(response, 401, GENERIC_401);
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

  it("lets an owner session through, then returns colonial 503 when the secret is unset", async () => {
    const cookie = ownerCookie();
    for (const route of GATED) {
      const response = await send(route.method, route.path, cookie, route.body);
      if (route.colonial503) {
        await expectJson(response, 503, colonialSecretUnavailableBody());
        continue;
      }
      expect(response.status).toBe(200);
      const json = await response.json() as { ok?: boolean };
      expect(json.ok).toBe(true);
      const text = JSON.stringify(json);
      expect(text).not.toContain(SYNTHETIC_ADMIN_KEY);
      expect(text).not.toContain(SYNTHETIC_SESSION_SECRET);
    }
  });

  it("leaves an ungated language route open to an anonymous caller", async () => {
    const response = await send("GET", "/sovereign-language/alphabet");
    expect(response.status).toBe(200);
    const json = await response.json() as { ok?: boolean };
    expect(json.ok).toBe(true);
  });
});
