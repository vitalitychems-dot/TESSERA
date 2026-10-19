import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { logger } from "../lib/logger";

const { MARKER, SECRET, failures } = vi.hoisted(() => {
  const MARKER = "synthetic-income-leads-leak";
  const SECRET = "ghp_syntheticIncomeLeadsSecret";

  function failure(where: string): never {
    const err = new Error(`${where} ${MARKER} upstream body bearer ${SECRET}`);
    err.name = "SyntheticFailure";
    throw err;
  }

  return {
    MARKER,
    SECRET,
    failures: {
      refreshWalletObservation: vi.fn(async () => {
        throw `wallet-refresh ${MARKER} upstream body bearer ${SECRET}`;
      }),
      getExecutableLeads: vi.fn(async () => failure("leads-feed")),
      leadCountsByKind: vi.fn(async () => failure("leads-counts")),
      getFreeFindings: vi.fn(() => failure("free-stuff")),
      refreshFreeFindings: vi.fn(async () => failure("free-stuff-refresh")),
      getBounties: vi.fn(() => failure("code-bounties")),
    },
  };
});

vi.mock("../lib/wallet-observer", () => ({
  getWalletObservation() {
    return {
      configured: false,
      walletAddress: null,
      network: "solana-mainnet",
      rpcUrl: "https://rpc.example.invalid",
      balanceLamports: null,
      balanceSol: null,
      deposits: [],
      totalReceivedSol: 0,
      lastObservedAt: 0,
      lastError: null,
    };
  },
  refreshWalletObservation: failures.refreshWalletObservation,
}));

vi.mock("../lib/lead-execution", () => ({
  getExecutableLeads: failures.getExecutableLeads,
  leadCountsByKind: failures.leadCountsByKind,
}));

vi.mock("../lib/free-stuff-scraper", () => ({
  getFreeFindings: failures.getFreeFindings,
  refreshFreeFindings: failures.refreshFreeFindings,
}));

vi.mock("../lib/code-bounties-real", () => ({
  getBounties: failures.getBounties,
  recordAttempt: vi.fn(),
  getAttempts: vi.fn(() => []),
}));

import incomeAndLeadsRouter from "../routes/income-and-leads";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";

type Case = {
  name: string;
  method: "GET" | "POST";
  path: string;
  called: keyof typeof failures;
  errorName: string;
  event: string;
};

const cases: Case[] = [
  {
    name: "POST /income/wallet/refresh",
    method: "POST",
    path: "/income/wallet/refresh",
    called: "refreshWalletObservation",
    errorName: "UnknownError",
    event: "income wallet refresh failed",
  },
  {
    name: "GET /leads/feed",
    method: "GET",
    path: "/leads/feed",
    called: "getExecutableLeads",
    errorName: "SyntheticFailure",
    event: "leads feed failed",
  },
  {
    name: "GET /free-stuff",
    method: "GET",
    path: "/free-stuff",
    called: "getFreeFindings",
    errorName: "SyntheticFailure",
    event: "free-stuff endpoint failed",
  },
  {
    name: "POST /free-stuff/refresh",
    method: "POST",
    path: "/free-stuff/refresh",
    called: "refreshFreeFindings",
    errorName: "SyntheticFailure",
    event: "free-stuff refresh failed",
  },
  {
    name: "GET /code-bounties",
    method: "GET",
    path: "/code-bounties",
    called: "getBounties",
    errorName: "SyntheticFailure",
    event: "code-bounties list failed",
  },
];

describe("income and leads generic failure bodies", () => {
  let server: Server | undefined;
  let baseUrl = "";
  let ownerCookie = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];
  const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

  beforeAll(async () => {
    process.env[ADMIN_ENV] = "synthetic-owner-token";
    process.env[SESSION_ENV] = "synthetic-session-secret-32chars!!";
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    ownerCookie = `${SESSION_COOKIE}=${issued.signedId}`;

    const app = express();
    app.use(express.json());
    app.use(incomeAndLeadsRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    errorSpy.mockRestore();
    if (previousAdmin === undefined) delete process.env[ADMIN_ENV];
    else process.env[ADMIN_ENV] = previousAdmin;
    if (previousSession === undefined) delete process.env[SESSION_ENV];
    else process.env[SESSION_ENV] = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each(cases)("$name returns internal_error and hides the failure text", async (route) => {
    errorSpy.mockClear();
    failures[route.called].mockClear();
    const response = await fetch(`${baseUrl}${route.path}`, {
      method: route.method,
      headers: { cookie: ownerCookie },
    });
    expect(failures[route.called]).toHaveBeenCalled();
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain(MARKER);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("upstream body");
    expect(JSON.parse(text)).toEqual({ ok: false, error: "internal_error" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toEqual({ errorName: route.errorName });
    expect(errorSpy.mock.calls[0]?.[1]).toBe(route.event);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain(MARKER);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("upstream body");
  });
});
