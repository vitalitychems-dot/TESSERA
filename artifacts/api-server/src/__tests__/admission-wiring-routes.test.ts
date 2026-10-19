import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => {
  const chain: any = {
    select: () => chain, from: () => chain, where: () => chain, limit: async () => [],
    insert: () => chain, values: () => chain, onConflictDoUpdate: async () => undefined,
    update: () => chain, set: () => chain, orderBy: () => chain,
  };
  return { db: chain };
});
vi.mock("@workspace/db/schema", () => new Proxy({}, { get: () => ({}) }));

const GATE = "TESSERA_ADMISSION_GATE";
const saved = process.env[GATE];

async function start() {
  vi.resetModules();
  const express = (await import("express")).default;
  const router = (await import("../routes/agent-network")).default;
  const spawner = await import("../lib/agent-spawner");
  spawner.getSpawnerState().lastSpawnAt = 0;
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as any };
  };
  return { call, spawner, close: () => new Promise<void>((r) => server.close(() => r())) };
}

let closer: (() => Promise<void>) | null = null;
beforeEach(() => { delete process.env[GATE]; });
afterEach(async () => {
  await closer?.();
  closer = null;
  if (saved === undefined) delete process.env[GATE];
  else process.env[GATE] = saved;
});

describe("POST /agent-spawner/spawn", () => {
  it("audit (default): 200 ok:true, unchanged response shape", async () => {
    const s = await start(); closer = s.close;
    const r = await s.call("POST", "/agent-spawner/spawn", { trigger: "x" });
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(r.json.data.id).toMatch(/^tessera-/);
  });

  it("cooldown keeps the legacy 200 ok:false message", async () => {
    const s = await start(); closer = s.close;
    s.spawner.getSpawnerState().lastSpawnAt = Date.now();
    const r = await s.call("POST", "/agent-spawner/spawn", {});
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: false, message: "Spawn cooldown active — try again shortly" });
  });

  it("enforce: 403 ADMISSION_DENIED and nothing is created", async () => {
    process.env[GATE] = "enforce";
    const s = await start(); closer = s.close;
    const r = await s.call("POST", "/agent-spawner/spawn", {});
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ ok: false, code: "ADMISSION_DENIED" });
    expect(r.json.reason).toContain("enforce");
    expect(s.spawner.getSpawnerState().activeSpawned).toHaveLength(0);
  });
});

describe("POST /agent-spawner/spawn-batch", () => {
  it("reports the gate mode and denied total", async () => {
    process.env[GATE] = "enforce";
    const s = await start(); closer = s.close;
    const r = await s.call("POST", "/agent-spawner/spawn-batch", { count: 3 });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, count: 0, data: [], admission: { mode: "enforce" } });
    expect(r.json.admission.deniedTotal).toBeGreaterThanOrEqual(3);
  });
});
