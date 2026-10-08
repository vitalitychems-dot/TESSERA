import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function queryChain(): Promise<never[]> {
  const result = Promise.resolve([]) as Promise<never[]> & Record<string, () => Promise<never[]>>;
  const fluent = () => result;
  for (const method of [
    "from",
    "where",
    "limit",
    "orderBy",
    "values",
    "onConflictDoNothing",
    "returning",
    "set",
    "innerJoin",
    "leftJoin",
    "groupBy",
    "offset",
  ]) {
    result[method] = fluent;
  }
  return result;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: () => queryChain(),
    insert: () => queryChain(),
    update: () => queryChain(),
    delete: () => queryChain(),
  },
}));

vi.mock("../lib/autonomous-wiring", () => ({
  startAutonomousOperation(): void {},
  stopAutonomousOperation(): void {},
  getAutonomousStatus(): { running: boolean } {
    return { running: false };
  },
}));

vi.mock("../lib/wallet-observer", () => ({
  startWalletObserver(): void {},
  getWalletObservation() {
    return { lastObservedAt: 1, configured: false, lastError: null, totalReceivedSol: 0, balanceSol: 0 };
  },
  async refreshWalletObservation() {
    return { lastObservedAt: 1, configured: false, lastError: null, totalReceivedSol: 0, balanceSol: 0 };
  },
}));

vi.mock("../lib/autonomous-build-cycle", () => ({
  startAutonomousBuildCycleTimer(): void {},
}));

vi.mock("../lib/free-stuff-scraper", () => ({
  startFreeStuffScraper(): void {},
}));

vi.mock("../lib/code-bounties-real", () => ({
  startBountyRefresher(): void {},
}));

vi.mock("../lib/income-executor", () => ({
  startIncomeExecutor(): void {},
}));

import apiRouter from "../routes/index";

const removedEndpoints = [
  { method: "GET", path: "/political-dossiers" },
  { method: "GET", path: "/political-dossiers/filters" },
  { method: "GET", path: "/political-dossiers/synthetic-id" },
  { method: "POST", path: "/political-dossiers/synthetic-id/shepherd-contact" },
  { method: "GET", path: "/recruit-dossiers" },
  { method: "GET", path: "/recruit-dossiers/synthetic-id" },
  { method: "POST", path: "/recruit-dossiers/synthetic-id/shepherd-contact" },
  { method: "POST", path: "/recruit-dossiers/synthetic-id/inbound" },
  { method: "POST", path: "/recruit-dossiers/synthetic-id/revoke" },
] as const;

describe("unhook living-person dossiers", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousGate = process.env.TESSERA_SENSITIVE_ROUTE_TOKEN;

  beforeAll(async () => {
    process.env.TESSERA_SENSITIVE_ROUTE_TOKEN = "synthetic-gate-token";
    const app = express();
    app.use(express.json());
    app.use(apiRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousGate === undefined) delete process.env.TESSERA_SENSITIVE_ROUTE_TOKEN;
    else process.env.TESSERA_SENSITIVE_ROUTE_TOKEN = previousGate;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns 404 for every removed dossier endpoint", async () => {
    for (const endpoint of removedEndpoints) {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          "x-admin-token": "synthetic-gate-token",
          "content-type": "application/json",
        },
        body: endpoint.method === "POST" ? JSON.stringify({ message: "synthetic", body: "synthetic" }) : undefined,
      });
      expect(response.status, `${endpoint.method} ${endpoint.path}`).toBe(404);
    }
  });

  it("keeps a non-dossier income route gated instead of removed", async () => {
    const missing = await fetch(`${baseUrl}/income/strategies`);
    expect(missing.status).toBe(401);

    const authed = await fetch(`${baseUrl}/income/strategies`, {
      headers: { "x-admin-token": "synthetic-gate-token" },
    });
    expect(authed.status).toBe(200);
  });

  it("does not import dossier libs from any served route file", () => {
    const routesDir = fileURLToPath(new URL("../routes/", import.meta.url));
    const files = readdirSync(routesDir).filter((name) => name.endsWith(".ts"));
    expect(files).not.toContain("political-dossiers.ts");
    for (const name of files) {
      const source = readFileSync(join(routesDir, name), "utf8");
      expect(source, name).not.toMatch(/from ["'][^"']*political-dossiers["']/);
      expect(source, name).not.toMatch(/from ["'][^"']*recruit-dossiers-extended["']/);
      expect(source, name).not.toMatch(/from ["'][^"']*shepherd-negotiation["']/);
    }
  });
});
