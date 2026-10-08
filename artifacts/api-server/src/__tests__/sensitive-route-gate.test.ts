import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

vi.mock("@workspace/db", () => ({
  db: {
    select() {
      throw new Error("database must not be used when the chart is not configured");
    },
    insert() {
      throw new Error("database must not be used when the chart is not configured");
    },
  },
}));

import natalChartRouter from "../routes/natal-chart";
import incomeAndLeadsRouter from "../routes/income-and-leads";

const OWNER_ENV = "SOVEREIGN_ADMIN_TOKEN";
const LEGACY_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const CHART_ENV = "FATHER_NATAL_CHART_JSON";
const SYNTHETIC_OWNER_TOKEN = "synthetic-owner-token";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

const gatedEndpoints = [
  { router: "natal-chart", path: "/natal-chart/father" },
  { router: "income-and-leads", path: "/income/wallet" },
] as const;

describe("sensitive route gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousOwner = process.env[OWNER_ENV];
  const previousLegacy = process.env[LEGACY_ENV];
  const previousSession = process.env[SESSION_ENV];
  const previousChart = process.env[CHART_ENV];

  beforeAll(async () => {
    const app = express();
    app.use(natalChartRouter);
    app.use(incomeAndLeadsRouter);
    app.get("/healthz", (_req, res) => {
      res.json({ status: "ok" });
    });
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    delete process.env[OWNER_ENV];
    process.env[LEGACY_ENV] = SYNTHETIC_OWNER_TOKEN;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    delete process.env[CHART_ENV];
  });

  afterAll(async () => {
    restore(OWNER_ENV, previousOwner);
    restore(LEGACY_ENV, previousLegacy);
    restore(SESSION_ENV, previousSession);
    restore(CHART_ENV, previousChart);
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function get(path: string, cookie?: string): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    return fetch(`${baseUrl}${path}`, { headers });
  }

  it("leaves unrelated routes ungated", async () => {
    delete process.env[OWNER_ENV];
    delete process.env[LEGACY_ENV];
    const response = await get("/healthz");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  for (const endpoint of gatedEndpoints) {
    describe(endpoint.router, () => {
      it(`returns 401 for ${endpoint.path} when no owner session is presented`, async () => {
        const response = await get(endpoint.path);
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
      });

      it(`returns 401 for ${endpoint.path} when the owner session is wrong`, async () => {
        const response = await get(endpoint.path, `${SESSION_COOKIE}=wrong-synthetic-session`);
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
      });

      it(`refuses ${endpoint.path} when ${OWNER_ENV} is unset`, async () => {
        delete process.env[OWNER_ENV];
        delete process.env[LEGACY_ENV];
        const withCookie = await get(endpoint.path, `${SESSION_COOKIE}=synthetic-cookie`);
        expect(withCookie.status).toBe(503);
        await expect(withCookie.json()).resolves.toMatchObject({ ok: false, error: "sovereign-unconfigured" });

        const withoutCookie = await get(endpoint.path);
        expect(withoutCookie.status).toBe(503);
        await expect(withoutCookie.json()).resolves.toMatchObject({ ok: false, error: "sovereign-unconfigured" });
      });
    });
  }

  it("refuses when the owner token env var is blank after trim", async () => {
    delete process.env[OWNER_ENV];
    process.env[LEGACY_ENV] = "   ";
    const response = await get("/natal-chart/father", `${SESSION_COOKIE}=synthetic-cookie`);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "sovereign-unconfigured" });
  });

  it("returns not-configured for the natal chart when FATHER_NATAL_CHART_JSON is unset", async () => {
    delete process.env[CHART_ENV];
    const response = await get("/natal-chart/father", ownerCookie());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "not-configured",
    });
  });

  it("returns 404 for the removed identity-verification endpoints", async () => {
    const cookie = ownerCookie();
    const questions = await get("/natal-chart/identity/questions", cookie);
    expect(questions.status).toBe(404);

    const verify = await fetch(`${baseUrl}/natal-chart/identity/verify`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ questionKey: "synthetic", answer: "synthetic" }),
    });
    expect(verify.status).toBe(404);
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
