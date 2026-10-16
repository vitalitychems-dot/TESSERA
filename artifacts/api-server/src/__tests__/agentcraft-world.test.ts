import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import agentcraftWorldRouter from "../routes/agentcraft-world";
import {
  acceptAgentCraftSnapshot,
  clearAgentCraftSnapshotForTests,
  readAgentCraftWorld,
  verifyAgentCraftBridgeToken,
} from "../lib/agentcraft-world";

const bridgeToken = "agentcraft-bridge-test-token-with-enough-entropy";
const originalBridgeToken = process.env.AGENTCRAFT_BRIDGE_TOKEN;

describe("AgentCraft read-only world bridge", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.AGENTCRAFT_BRIDGE_TOKEN = bridgeToken;
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(agentcraftWorldRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => clearAgentCraftSnapshotForTests());

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    if (originalBridgeToken === undefined) delete process.env.AGENTCRAFT_BRIDGE_TOKEN;
    else process.env.AGENTCRAFT_BRIDGE_TOKEN = originalBridgeToken;
  });

  it("fails closed when the bridge token is absent or incorrect", () => {
    expect(verifyAgentCraftBridgeToken(undefined)).toBe(false);
    expect(verifyAgentCraftBridgeToken("wrong-token")).toBe(false);
    expect(verifyAgentCraftBridgeToken(bridgeToken)).toBe(true);
  });

  it("rejects extra fields instead of storing AgentCraft messages or activity text", async () => {
    const response = await fetch(`${baseUrl}/world/agentcraft/ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${bridgeToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        backend: "claude",
        agents: [{ id: "kit", name: "Kit", state: "editing", station: "desk", active: true, activity: "editing a private file" }],
      }),
    });
    expect(response.status).toBe(400);
    expect(readAgentCraftWorld().status).toBe("unavailable");
  });

  it("accepts only the minimal agent roster and reports source provenance honestly", async () => {
    const response = await fetch(`${baseUrl}/world/agentcraft/ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${bridgeToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        backend: "sim",
        agents: [
          { id: "kit", name: "Kit", state: "testing", station: "testbench", active: true },
          { id: "marlow", name: "Marlow", state: "idle", station: "lounge", active: false },
        ],
      }),
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, accepted: true });
    expect(readAgentCraftWorld()).toMatchObject({
      status: "live",
      backend: "sim",
      agents: [{ id: "kit", station: "testbench" }, { id: "marlow", active: false }],
      provenance: { kind: "agentcraft-foreman", live: true, gameCoordinates: false },
    });
  });

  it("marks the last snapshot stale rather than presenting it as current", () => {
    expect(acceptAgentCraftSnapshot({
      backend: "codex",
      agents: [{ id: "rowan", name: "Rowan", state: "reading", station: "library", active: true }],
    }, 1_000)).toBe(true);
    expect(readAgentCraftWorld(61_001).status).toBe("stale");
    expect(readAgentCraftWorld(61_001).provenance.live).toBe(false);
  });

  it("keeps snapshot reads behind the owner session gate", async () => {
    const response = await fetch(`${baseUrl}/world/agentcraft`);
    expect([401, 503]).toContain(response.status);
  });
});
