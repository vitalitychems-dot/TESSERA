import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import apiRouter from "../routes/index";
import { stopAutonomousRotation } from "../lib/sovereign-cipher";
import { stopBandRotationScheduler } from "../lib/lattice-frequency-bands";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_ADMIN_KEY = "synthetic-admin-key-16";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

const SESSION_401 = { ok: false, error: "unauthenticated", reason: "no-cookie" };
const SESSION_503 = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function leaks(text: string): boolean {
  return text.includes(SYNTHETIC_ADMIN_KEY) || text.includes(SYNTHETIC_SESSION_SECRET);
}

describe("sovereign language gate stays inside its mount", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    expect(SYNTHETIC_ADMIN_KEY.length).toBeGreaterThanOrEqual(16);
    expect(SYNTHETIC_SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    stopAutonomousRotation();
    stopBandRotationScheduler();
    restore(ADMIN_ENV, previousAdmin);
    restore(SESSION_ENV, previousSession);
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function send(
    method: "GET" | "POST",
    path: string,
    headers?: Record<string, string>,
    body?: Record<string, string>,
  ): Promise<{ status: number; text: string; contentType: string }> {
    const requestHeaders = new Headers(headers);
    let payload: string | undefined;
    if (body !== undefined) {
      requestHeaders.set("content-type", "application/json");
      payload = JSON.stringify(body);
    }
    const response = await fetch(`${baseUrl}${path}`, { method, headers: requestHeaders, body: payload });
    const text = await response.text();
    expect(leaks(text)).toBe(false);
    return {
      status: response.status,
      text,
      contentType: response.headers.get("content-type") ?? "",
    };
  }

  it("leaves public routes intact, rejects bearer keys, and accepts the owner session cookie", async () => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;

    const later = await send("GET", "/api/red-team/stats");
    expect(later.status).toBe(200);
    expect(later.contentType).toContain("application/json");
    const laterBody = JSON.parse(later.text) as { ok?: boolean; runCount?: unknown };
    expect(laterBody.ok).toBe(true);
    expect(typeof laterBody.runCount).toBe("number");
    expect(laterBody).not.toEqual(SESSION_401);
    expect(laterBody).not.toEqual(SESSION_503);

    const metrics = await send("GET", "/api/metrics");
    expect(metrics.status).toBe(200);
    expect(metrics.contentType).toContain("text/plain");
    expect(metrics.text).toContain("tessera_uptime_seconds");
    expect(metrics.text).not.toContain("unauthenticated");
    expect(metrics.text).not.toContain("sovereign-unconfigured");

    const metricsJson = await send("GET", "/api/metrics.json");
    expect(metricsJson.status).toBe(200);
    const metricsBody = JSON.parse(metricsJson.text) as { ok?: boolean };
    expect(metricsBody.ok).toBe(true);
    expect(metricsBody).not.toEqual(SESSION_401);
    expect(metricsBody).not.toEqual(SESSION_503);

    const missingToken = await send("POST", "/api/sovereign-ledger/attest", undefined, {
      agentId: "synthetic-agent",
      actionKind: "synthetic-action",
    });
    expect(missingToken.status).toBe(401);
    expect(JSON.parse(missingToken.text)).toEqual(SESSION_401);

    const legacyBearer = await send(
      "POST",
      "/api/sovereign-ledger/attest",
      { "x-admin-token": SYNTHETIC_ADMIN_KEY },
      { agentId: "synthetic-agent", actionKind: "synthetic-action" },
    );
    expect(legacyBearer.status).toBe(401);
    expect(JSON.parse(legacyBearer.text)).toEqual(SESSION_401);

    const session = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    const attested = await send(
      "POST",
      "/api/sovereign-ledger/attest",
      { cookie: `${SESSION_COOKIE}=${session.signedId}` },
      { agentId: "synthetic-agent", actionKind: "synthetic-action" },
    );
    expect(attested.status).toBe(200);
    const attestedBody = JSON.parse(attested.text) as {
      ok?: boolean;
      entry?: { kind?: string; actor?: string };
    };
    expect(attestedBody.ok).toBe(true);
    expect(attestedBody.entry?.kind).toBe("agent-attestation");
    expect(attestedBody.entry?.actor).toBe("synthetic-agent");

    delete process.env[ADMIN_ENV];
    try {
      const laterUnset = await send("GET", "/api/red-team/stats");
      expect(laterUnset.status).toBe(200);
      expect((JSON.parse(laterUnset.text) as { ok?: boolean }).ok).toBe(true);

      const metricsUnset = await send("GET", "/api/metrics");
      expect(metricsUnset.status).toBe(200);
      expect(metricsUnset.text).toContain("tessera_uptime_seconds");

      const tokenWhileUnset = await send(
        "POST",
        "/api/sovereign-ledger/attest",
        { "x-admin-token": "synthetic-token-not-configured" },
        { agentId: "synthetic-agent", actionKind: "synthetic-action" },
      );
      expect(tokenWhileUnset.status).toBe(503);
      expect(JSON.parse(tokenWhileUnset.text)).toEqual(SESSION_503);
    } finally {
      process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    }
  });
});
