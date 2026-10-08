import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const testOwnerToken = "interactive-status-test-owner-token";
const testSessionSecret =
  "interactive-status-test-session-secret-long-enough-for-hmac";

describe("interactive status permissions", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // These test-only values replace credentials only in this short-lived
    // Vitest process; they are never read from or written to workspace secrets.
    process.env.SOVEREIGN_ADMIN_TOKEN = testOwnerToken;
    process.env.SESSION_SECRET = testSessionSecret;
    const { default: app } = await import("../interactive-app");
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    delete process.env.SOVEREIGN_ADMIN_TOKEN;
    delete process.env.SESSION_SECRET;
  });

  it("opens read-only process status without an owner session", async () => {
    const response = await fetch(`${baseUrl}/api/interactive/status`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runtime: { status: "online" },
      modules: { personalChartVault: { state: "disabled" } },
    });
  });

  it.each([
    ["/tessera/conversations", "GET"],
    ["/tessera/connections", "GET"],
    ["/tessera/chat", "POST"],
  ])("keeps private endpoint %s owner-only", async (path, method) => {
    const response = await fetch(`${baseUrl}/api${path}`, { method });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "unauthenticated" });
  });

  it("keeps public status usable when no owner key is configured", async () => {
    process.env.SOVEREIGN_ADMIN_TOKEN = "";
    try {
      expect((await fetch(`${baseUrl}/api/interactive/status`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/tessera/conversations`)).status).toBe(503);
    } finally {
      process.env.SOVEREIGN_ADMIN_TOKEN = testOwnerToken;
    }
  });

  it("also returns process status for a valid signed owner session", async () => {
    const session = issueSession({
      ip: "127.0.0.1",
      userAgent: "interactive-status-test",
    });
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(session.signedId)}`;

    const response = await fetch(`${baseUrl}/api/interactive/status`, {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      runtime: { uptimeSeconds: number; nodeVersion: string };
    };
    expect(body).toMatchObject({
      service: "Tessera interactive API",
      runtime: { status: "online" },
      modules: {
        runtimeStatus: { state: "active" },
        canonicalModules: { state: "inactive" },
        personalChartVault: { state: "disabled" },
        autonomousEngines: { state: "disabled" },
      },
    });
    expect(body.runtime.uptimeSeconds).toEqual(expect.any(Number));
    expect(body.runtime.nodeVersion).toEqual(process.version);

    const chartRoute = await fetch(`${baseUrl}/api/natal-chart`, {
      headers: { Cookie: cookie },
    });
    expect(chartRoute.status).toBe(503);
    await expect(chartRoute.json()).resolves.toMatchObject({
      error: "module-inactive",
    });
  });
});
