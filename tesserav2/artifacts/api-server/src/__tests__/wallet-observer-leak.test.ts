import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { logger } from "../lib/logger";
import { getFreeFindings, refreshFreeFindings, startFreeStuffScraper } from "../lib/free-stuff-scraper";
import { refreshBounties, startBountyRefresher } from "../lib/code-bounties-real";
import { getWalletObservation, refreshWalletObservation } from "../lib/wallet-observer";

const markers = vi.hoisted(() => ({
  secret: "synthetic-wallet-observer-leak",
  key: "synthetic-rpc-key-marker",
}));

vi.mock("@workspace/db", () => ({
  db: {
    select() {
      const err = new Error(`lead query ${markers.secret} ${markers.key}`);
      err.name = "LeadQueryFailure";
      throw err;
    },
  },
}));

vi.mock("@workspace/db/schema", () => ({
  ingestedDataTable: {
    id: "id",
    url: "url",
    source: "source",
    sourceType: "sourceType",
    title: "title",
    ingestedAt: "ingestedAt",
  },
}));

import incomeAndLeadsRouter from "../routes/income-and-leads";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const WALLET_ENV = "SOVEREIGN_WALLET_ADDRESS";
const RPC_ENV = "SOLANA_RPC_URL";
const WALLET_ADDRESS = "SyntheticWalletAddressForLeakTest0001";

function assertClean(label: string, value: string): void {
  if (value.includes(markers.secret) || value.includes(markers.key)) {
    throw new Error(`${label} contained a sensitive marker`);
  }
}

function assertExact(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`${label} did not match the expected safe value`);
}

function forcedError(name: string, url: string): Error {
  const err = new Error(`forced ${markers.secret} ${markers.key} ${url}`);
  err.name = name;
  return err;
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function activeTimeouts(): NodeJS.Timeout[] {
  const getHandles = (process as NodeJS.Process & { _getActiveHandles?: () => unknown[] })._getActiveHandles;
  const handles = getHandles ? getHandles.call(process) : [];
  return handles.filter((handle): handle is NodeJS.Timeout => {
    if (typeof handle !== "object" || handle === null) return false;
    const timeout = handle as NodeJS.Timeout;
    return typeof timeout.ref === "function" && typeof timeout.unref === "function" && typeof timeout.hasRef === "function";
  });
}

describe("wallet observer and income failure leaks", () => {
  let server: Server | undefined;
  let baseUrl = "";
  let ownerCookie = "";
  const previous = new Map<string, string | undefined>();
  const captured: string[] = [];
  const originalFetch = globalThis.fetch.bind(globalThis);
  const warnSpy = vi.spyOn(logger, "warn").mockImplementation((...args: unknown[]) => {
    captured.push(JSON.stringify(args));
    return undefined as never;
  });
  const errorSpy = vi.spyOn(logger, "error").mockImplementation((...args: unknown[]) => {
    captured.push(JSON.stringify(args));
    return undefined as never;
  });

  beforeAll(async () => {
    for (const key of [ADMIN_ENV, SESSION_ENV, WALLET_ENV, RPC_ENV]) {
      previous.set(key, process.env[key]);
    }
    process.env[ADMIN_ENV] = "synthetic-owner-token";
    process.env[SESSION_ENV] = "synthetic-session-secret-32chars!!";
    process.env[WALLET_ENV] = WALLET_ADDRESS;
    process.env[RPC_ENV] = `https://rpc.example.invalid/solana?api-key=${markers.key}`;

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = requestUrl(input);
      if (isLoopback(url)) return originalFetch(input, init);
      throw forcedError("UpstreamFailure", url);
    }) as typeof fetch;

    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    ownerCookie = `${SESSION_COOKIE}=${issued.signedId}`;

    const app = express();
    app.set("query parser", (queryString: string) => {
      const params = new URLSearchParams(queryString);
      if (params.get("explode") === "1") {
        return {
          get bountyId(): string {
            throw forcedError("AttemptReadFailure", "attempts");
          },
        };
      }
      return Object.fromEntries(params.entries());
    });
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.header("x-force-attempt-failure") === "1") {
        req.body = {
          status: "investigating",
          notes: {
            toString() {
              throw forcedError("AttemptWriteFailure", "attempt");
            },
          },
        };
      }
      next();
    });
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
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    globalThis.fetch = originalFetch;
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function readBody(response: Response): Promise<string> {
    const text = await response.text();
    assertClean("response body", text);
    return text;
  }

  function authHeaders(extra?: Record<string, string>): Record<string, string> {
    return { cookie: ownerCookie, ...extra };
  }

  it("keeps forced secrets out of observations, responses, and logs", async () => {
    const refreshed = await refreshWalletObservation();
    assertClean("refresh return", JSON.stringify(refreshed));
    assertExact("refresh lastError", refreshed.lastError, "wallet_refresh_failed");
    expect(Object.prototype.hasOwnProperty.call(refreshed, "rpcUrl")).toBe(false);

    const stored = getWalletObservation();
    assertClean("stored observation", JSON.stringify(stored));
    assertExact("stored lastError", stored.lastError, "wallet_refresh_failed");
    expect(Object.prototype.hasOwnProperty.call(stored, "rpcUrl")).toBe(false);

    const walletGet = await fetch(`${baseUrl}/income/wallet`, { headers: authHeaders() });
    assertExact("wallet status", walletGet.status, 200);
    const walletBody = await readBody(walletGet);
    const walletJson = JSON.parse(walletBody) as { observation: { lastError: string | null } };
    assertExact("returned lastError", walletJson.observation.lastError, "wallet_refresh_failed");
    expect(Object.prototype.hasOwnProperty.call(walletJson.observation, "rpcUrl")).toBe(false);

    const walletPost = await fetch(`${baseUrl}/income/wallet/refresh`, { method: "POST", headers: authHeaders() });
    assertExact("wallet refresh status", walletPost.status, 200);
    const walletPostBody = await readBody(walletPost);
    const walletPostJson = JSON.parse(walletPostBody) as { observation: { lastError: string | null } };
    assertExact("posted lastError", walletPostJson.observation.lastError, "wallet_refresh_failed");
    expect(Object.prototype.hasOwnProperty.call(walletPostJson.observation, "rpcUrl")).toBe(false);

    const strategies = await fetch(`${baseUrl}/income/strategies`, { headers: authHeaders() });
    assertExact("strategies status", strategies.status, 200);
    await readBody(strategies);

    await refreshFreeFindings();
    const freePost = await fetch(`${baseUrl}/free-stuff/refresh`, { method: "POST", headers: authHeaders() });
    assertExact("free-stuff status", freePost.status, 200);
    await readBody(freePost);

    await refreshBounties();
    const bounties = await fetch(`${baseUrl}/code-bounties`, { headers: authHeaders() });
    assertExact("bounties status", bounties.status, 200);
    await readBody(bounties);

    const leads = await fetch(`${baseUrl}/leads/feed`, { headers: authHeaders() });
    assertExact("leads status", leads.status, 200);
    await readBody(leads);

    const attempt = await fetch(`${baseUrl}/code-bounties/leak-bounty/attempt`, {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json", "x-force-attempt-failure": "1" }),
      body: JSON.stringify({ status: "investigating", notes: "" }),
    });
    assertExact("attempt status", attempt.status, 500);
    assertExact("attempt body", await readBody(attempt), JSON.stringify({ ok: false, error: "internal_error" }));

    const attempts = await fetch(`${baseUrl}/code-bounties/attempts?explode=1`, { headers: authHeaders() });
    assertExact("attempts status", attempts.status, 500);
    assertExact("attempts body", await readBody(attempts), JSON.stringify({ ok: false, error: "internal_error" }));

    const sources = getFreeFindings().sources as unknown[];
    const originalIterator = sources[Symbol.iterator];
    const originalFilter = Array.prototype.filter;
    const timeoutsBefore = new Set(activeTimeouts());
    try {
      sources[Symbol.iterator] = function iterator(): never {
        throw forcedError("SourceScanFailure", "sources");
      };
      startFreeStuffScraper();
      await new Promise((resolve) => setImmediate(resolve));

      sources[Symbol.iterator] = originalIterator;
      Array.prototype.filter = function filter(this: unknown[], ...args: Parameters<typeof originalFilter>) {
        const stack = new Error().stack ?? "";
        if (stack.includes("refreshBounties") && !stack.includes("searchGitHub")) {
          Array.prototype.filter = originalFilter;
          throw forcedError("BountyFilterFailure", "bounties");
        }
        return originalFilter.apply(this, args);
      };
      startBountyRefresher();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      sources[Symbol.iterator] = originalIterator;
      Array.prototype.filter = originalFilter;
      for (const timeout of activeTimeouts()) {
        if (!timeoutsBefore.has(timeout)) clearTimeout(timeout);
      }
    }

    assertClean("captured logs", captured.join("\n"));
    function logged(calls: ReadonlyArray<readonly unknown[]>, message: string, errorName: string): boolean {
      return calls.some((call) => {
        const payload = call[0] as { errorName?: unknown } | undefined;
        return call[1] === message && payload?.errorName === errorName;
      });
    }
    expect(logged(warnSpy.mock.calls, "WalletObserver: refresh failed", "UpstreamFailure")).toBe(true);
    expect(logged(warnSpy.mock.calls, "free-stuff: source failed", "UpstreamFailure")).toBe(true);
    expect(logged(warnSpy.mock.calls, "free-stuff: initial refresh failed", "SourceScanFailure")).toBe(true);
    expect(logged(warnSpy.mock.calls, "code-bounties: query failed", "UpstreamFailure")).toBe(true);
    expect(logged(warnSpy.mock.calls, "code-bounties: initial refresh failed", "BountyFilterFailure")).toBe(true);
    expect(logged(warnSpy.mock.calls, "lead-execution: query failed", "LeadQueryFailure")).toBe(true);
    expect(logged(errorSpy.mock.calls, "code-bounties attempt failed", "AttemptWriteFailure")).toBe(true);
    expect(logged(errorSpy.mock.calls, "code-bounties attempts failed", "AttemptReadFailure")).toBe(true);

    for (const call of [...warnSpy.mock.calls, ...errorSpy.mock.calls]) {
      const payload = call[0] as Record<string, unknown> | undefined;
      expect(payload !== undefined && "err" in payload).toBe(false);
      expect(payload !== undefined && "message" in payload).toBe(false);
      expect(typeof payload?.errorName).toBe("string");
    }
  });
});
