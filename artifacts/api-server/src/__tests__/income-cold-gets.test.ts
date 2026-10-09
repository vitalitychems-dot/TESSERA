import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const probes = vi.hoisted(() => {
  const outbound = vi.fn();
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    let loopback = false;
    try {
      const host = new URL(url).hostname;
      loopback = host === "127.0.0.1" || host === "localhost";
    } catch {
      loopback = false;
    }
    if (!loopback) {
      outbound();
      throw new Error("outbound fetch blocked");
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  const dbCalls = {
    select: vi.fn(() => {
      throw new Error("database must not be used");
    }),
    insert: vi.fn(() => {
      throw new Error("database must not be used");
    }),
    update: vi.fn(() => {
      throw new Error("database must not be used");
    }),
    delete: vi.fn(() => {
      throw new Error("database must not be used");
    }),
  };
  return { outbound, originalFetch, dbCalls };
});

const refreshers = vi.hoisted(() => ({
  refreshWalletObservation: vi.fn(async () => {
    throw new Error("refreshWalletObservation must not run");
  }),
  refreshFreeFindings: vi.fn(async () => {
    throw new Error("refreshFreeFindings must not run");
  }),
  refreshBounties: vi.fn(async () => {
    throw new Error("refreshBounties must not run");
  }),
}));

const coldWallet = {
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

vi.mock("../lib/wallet-observer", () => ({
  startWalletObserver(): void {},
  getWalletObservation() {
    return coldWallet;
  },
  refreshWalletObservation: refreshers.refreshWalletObservation,
}));

vi.mock("../lib/free-stuff-scraper", () => ({
  startFreeStuffScraper(): void {},
  getFreeFindings() {
    return { findings: [], lastRefresh: 0, sources: [] };
  },
  refreshFreeFindings: refreshers.refreshFreeFindings,
}));

vi.mock("../lib/code-bounties-real", () => ({
  startBountyRefresher(): void {},
  getBounties() {
    return { bounties: [], lastRefresh: 0, attemptsCount: 0 };
  },
  refreshBounties: refreshers.refreshBounties,
  getAttempts() {
    return [];
  },
}));

vi.mock("pg", () => ({
  default: {
    Pool: class Pool {
      constructor() {
        throw new Error("pg Pool must not be constructed");
      }
    },
  },
}));

vi.mock("@workspace/db", () => ({
  db: probes.dbCalls,
}));

import incomeAndLeadsRouter from "../routes/income-and-leads";

const LEGACY_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_OWNER_TOKEN = "synthetic-owner-token";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

describe("cold income reads do not refresh", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousLegacy = process.env[LEGACY_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    process.env[LEGACY_ENV] = SYNTHETIC_OWNER_TOKEN;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
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
    globalThis.fetch = probes.originalFetch;
    if (previousLegacy === undefined) delete process.env[LEGACY_ENV];
    else process.env[LEGACY_ENV] = previousLegacy;
    if (previousSession === undefined) delete process.env[SESSION_ENV];
    else process.env[SESSION_ENV] = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns disabled empty payloads without refresh, database, or outbound calls", async () => {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    const headers = { cookie: `${SESSION_COOKIE}=${issued.signedId}` };

    const wallet = await fetch(`${baseUrl}/income/wallet`, { headers });
    const free = await fetch(`${baseUrl}/free-stuff`, { headers });
    const bounties = await fetch(`${baseUrl}/code-bounties`, { headers });
    const strategies = await fetch(`${baseUrl}/income/strategies`, { headers });

    expect(wallet.status).toBe(200);
    expect(free.status).toBe(200);
    expect(bounties.status).toBe(200);
    expect(strategies.status).toBe(200);

    await expect(wallet.json()).resolves.toMatchObject({
      ok: true,
      disabled: true,
      observation: { lastObservedAt: 0, deposits: [] },
    });
    await expect(free.json()).resolves.toMatchObject({
      ok: true,
      disabled: true,
      findings: [],
      lastRefresh: 0,
    });
    await expect(bounties.json()).resolves.toMatchObject({
      ok: true,
      disabled: true,
      bounties: [],
      lastRefresh: 0,
    });
    const strategyBody = await strategies.json() as {
      disabled: boolean;
      strategies: Array<{ id: string; status: string }>;
    };
    expect(strategyBody.disabled).toBe(true);
    expect(strategyBody.strategies.find((row) => row.id === "wallet-deposits")?.status).toBe("disabled");
    expect(strategyBody.strategies.find((row) => row.id === "code-bounties")?.status).toBe("disabled");

    expect(refreshers.refreshWalletObservation).toHaveBeenCalledTimes(0);
    expect(refreshers.refreshFreeFindings).toHaveBeenCalledTimes(0);
    expect(refreshers.refreshBounties).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.select).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.insert).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.update).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.delete).toHaveBeenCalledTimes(0);
    expect(probes.outbound).toHaveBeenCalledTimes(0);
  });
});
