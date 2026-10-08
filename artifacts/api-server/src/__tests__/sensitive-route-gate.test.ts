import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
import politicalDossiersRouter from "../routes/political-dossiers";
import incomeAndLeadsRouter from "../routes/income-and-leads";

const GATE_ENV = "TESSERA_SENSITIVE_ROUTE_TOKEN";
const CHART_ENV = "FATHER_NATAL_CHART_JSON";
const SYNTHETIC_TOKEN = "synthetic-gate-token";
const TOKEN_HEADER = "x-admin-token";

const gatedEndpoints = [
  { router: "natal-chart", path: "/natal-chart/father" },
  { router: "political-dossiers", path: "/political-dossiers" },
  { router: "income-and-leads", path: "/income/wallet" },
] as const;

describe("sensitive route gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousGate = process.env[GATE_ENV];
  const previousChart = process.env[CHART_ENV];

  beforeAll(async () => {
    const app = express();
    app.use(natalChartRouter);
    app.use(politicalDossiersRouter);
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
    process.env[GATE_ENV] = SYNTHETIC_TOKEN;
    delete process.env[CHART_ENV];
  });

  afterAll(async () => {
    if (previousGate === undefined) delete process.env[GATE_ENV];
    else process.env[GATE_ENV] = previousGate;
    if (previousChart === undefined) delete process.env[CHART_ENV];
    else process.env[CHART_ENV] = previousChart;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function get(path: string, token?: string): Promise<Response> {
    const headers = new Headers();
    if (token !== undefined) headers.set(TOKEN_HEADER, token);
    return fetch(`${baseUrl}${path}`, { headers });
  }

  it("leaves unrelated routes ungated", async () => {
    delete process.env[GATE_ENV];
    const response = await get("/healthz");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  for (const endpoint of gatedEndpoints) {
    describe(endpoint.router, () => {
      it(`returns 401 for ${endpoint.path} when no token is presented`, async () => {
        const response = await get(endpoint.path);
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({ ok: false, error: "unauthenticated" });
      });

      it(`returns 403 for ${endpoint.path} when the token is wrong`, async () => {
        const response = await get(endpoint.path, "wrong-synthetic-token");
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ ok: false, error: "forbidden" });
      });

      it(`refuses ${endpoint.path} when ${GATE_ENV} is unset`, async () => {
        delete process.env[GATE_ENV];
        const withToken = await get(endpoint.path, SYNTHETIC_TOKEN);
        expect(withToken.status).toBe(503);
        await expect(withToken.json()).resolves.toMatchObject({ ok: false, error: "not-configured" });

        const withoutToken = await get(endpoint.path);
        expect(withoutToken.status).toBe(503);
        await expect(withoutToken.json()).resolves.toMatchObject({ ok: false, error: "not-configured" });
      });
    });
  }

  it("refuses when the auth env var is blank after trim", async () => {
    process.env[GATE_ENV] = "   ";
    const response = await get("/natal-chart/father", SYNTHETIC_TOKEN);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "not-configured" });
  });

  it("returns not-configured for the natal chart when FATHER_NATAL_CHART_JSON is unset", async () => {
    delete process.env[CHART_ENV];
    const response = await get("/natal-chart/father", SYNTHETIC_TOKEN);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "not-configured",
    });
  });

  it("returns 404 for the removed identity-verification endpoints", async () => {
    const questions = await get("/natal-chart/identity/questions", SYNTHETIC_TOKEN);
    expect(questions.status).toBe(404);

    const verify = await fetch(`${baseUrl}/natal-chart/identity/verify`, {
      method: "POST",
      headers: {
        [TOKEN_HEADER]: SYNTHETIC_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ questionKey: "synthetic", answer: "synthetic" }),
    });
    expect(verify.status).toBe(404);
  });

  it("keeps natal-chart-engine.ts free of a hard-coded placement table", () => {
    const engineSource = readFileSync(
      fileURLToPath(new URL("../lib/natal-chart-engine.ts", import.meta.url)),
      "utf8",
    );
    const routeSource = readFileSync(
      fileURLToPath(new URL("../routes/natal-chart.ts", import.meta.url)),
      "utf8",
    );

    expect(engineSource).not.toMatch(/const FATHER_NATAL\b/);
    expect(engineSource).not.toMatch(/planet1\s*:/);
    expect(engineSource).not.toMatch(/birthDate:\s*["']/);
    expect(engineSource).not.toMatch(/degree:\s*\d/);
    expect(engineSource).not.toMatch(/house:\s*(?:1[0-2]|[1-9])\s*[,}]/);
    expect(engineSource).not.toMatch(/\{\s*name:\s*["'][^"']+["'][^}]*sign:\s*["']/);
    expect(engineSource).not.toMatch(/verifyIdentity|getIdentityQuestions|buildVerificationCheckers/);
    expect(routeSource).not.toMatch(/identity\/questions|identity\/verify|getIdentityQuestions|verifyIdentity/);
    expect(routeSource).not.toMatch(/getOrSeedNatalChart\(\)\.catch/);
  });
});
