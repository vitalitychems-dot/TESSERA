import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import { _resetThrottleForTests, getThrottleMetrics } from "../lib/evolution-throttle";
import evolutionHealthRouter from "../routes/evolution-health";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const CONFIGURED_KEY = "synthetic-evo-health-key";
const SHORT_KEY = "short-evo-key";
const WRONG_TOKEN = "wrong-evo-health-token";

const UNCONFIGURED = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};
const UNAUTHORIZED = { ok: false, error: "Valid sovereign key required" };

const GATED = [
  { method: "GET", path: "/evolution-health/attempts" },
  { method: "POST", path: "/evolution-health/pause/mod-a" },
  { method: "POST", path: "/evolution-health/resume/mod-a" },
  { method: "POST", path: "/evolution-health/reset/mod-a" },
] as const;

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function leaks(text: string, secret: string): boolean {
  return secret.length > 0 && text.includes(secret);
}

describe("evolution-health admin gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];

  beforeAll(async () => {
    expect(SHORT_KEY.length).toBeLessThan(16);
    expect(CONFIGURED_KEY.length).toBeGreaterThanOrEqual(16);
    expect(WRONG_TOKEN === CONFIGURED_KEY).toBe(false);

    const app = express();
    app.use(express.json());
    app.use(evolutionHealthRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    _resetThrottleForTests();
    process.env[ADMIN_ENV] = CONFIGURED_KEY;
  });

  afterAll(async () => {
    _resetThrottleForTests();
    restore(ADMIN_ENV, previousAdmin);
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function send(method: "GET" | "POST", path: string, token?: string): Promise<Response> {
    const headers = new Headers();
    if (token !== undefined) headers.set("x-admin-token", token);
    return fetch(`${baseUrl}${path}`, { method, headers });
  }

  async function expectClosed(response: Response, status: 401 | 503, body: unknown): Promise<void> {
    expect(response.status).toBe(status);
    const json: unknown = await response.json();
    expect(json).toEqual(body);
    const text = JSON.stringify(json);
    expect(leaks(text, CONFIGURED_KEY)).toBe(false);
    expect(leaks(text, SHORT_KEY)).toBe(false);
    expect(leaks(text, WRONG_TOKEN)).toBe(false);
    expect(text.includes("err.message")).toBe(false);
    expect(getThrottleMetrics().modules).toEqual([]);
  }

  it("returns 503 for every gated handler when the admin key is unset", async () => {
    delete process.env[ADMIN_ENV];
    for (const route of GATED) {
      const withoutToken = await send(route.method, route.path);
      await expectClosed(withoutToken, 503, UNCONFIGURED);
      const withToken = await send(route.method, route.path, CONFIGURED_KEY);
      await expectClosed(withToken, 503, UNCONFIGURED);
    }
  });

  it("returns 503 for every gated handler when the admin key is shorter than 16 characters", async () => {
    process.env[ADMIN_ENV] = SHORT_KEY;
    for (const route of GATED) {
      const withoutToken = await send(route.method, route.path);
      await expectClosed(withoutToken, 503, UNCONFIGURED);
      const withToken = await send(route.method, route.path, SHORT_KEY);
      await expectClosed(withToken, 503, UNCONFIGURED);
    }
  });

  it("returns 401 for every gated handler when the key is configured and the token is missing or wrong", async () => {
    for (const route of GATED) {
      const missing = await send(route.method, route.path);
      await expectClosed(missing, 401, UNAUTHORIZED);
      const wrong = await send(route.method, route.path, WRONG_TOKEN);
      await expectClosed(wrong, 401, UNAUTHORIZED);
    }
  });

  it("returns 200 for every gated handler when the configured key is presented", async () => {
    for (const route of GATED) {
      const response = await send(route.method, route.path, CONFIGURED_KEY);
      expect(response.status).toBe(200);
      const json = await response.json() as { ok?: boolean };
      expect(json.ok).toBe(true);
      const text = JSON.stringify(json);
      expect(leaks(text, CONFIGURED_KEY)).toBe(false);
      expect(leaks(text, WRONG_TOKEN)).toBe(false);
      expect(text.includes("err.message")).toBe(false);
    }
  });
});
