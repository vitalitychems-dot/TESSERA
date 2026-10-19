import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => {
  const chain: any = {
    select: () => chain, from: () => chain, where: () => chain, limit: async () => [],
    insert: () => chain, values: () => chain, onConflictDoUpdate: async () => undefined,
  };
  return { db: chain };
});
vi.mock("@workspace/db/schema", () => ({ systemStateTable: {} }));

const GATE = "TESSERA_ADMISSION_GATE";
const KEY = "TESSERA_ADMISSION_ATTESTATION_KEY";
const saved = { gate: process.env[GATE], key: process.env[KEY] };

async function load() {
  vi.resetModules();
  const wiring = await import("../lib/admission-wiring");
  const spawner = await import("../lib/agent-spawner");
  spawner.getSpawnerState().lastSpawnAt = 0;
  return { wiring, spawner };
}

/** Only `isMember` is consulted by requireMember, so a plain object stands in for an admitted-members registry. */
function fakeRegistry(admitted: { id: string; manifestHash: string }[]) {
  const entries = [...admitted];
  return {
    isMember: (id: string, manifestHash?: string) =>
      entries.some((e) => e.id === id && (manifestHash === undefined || e.manifestHash === manifestHash)),
    revoke: (id: string) => {
      const i = entries.findIndex((e) => e.id === id);
      if (i >= 0) entries.splice(i, 1);
    },
  } as any;
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  delete process.env[GATE];
  delete process.env[KEY];
});
afterEach(() => {
  restore(GATE, saved.gate);
  restore(KEY, saved.key);
});

describe("resolveAdmissionMode", () => {
  it("defaults to audit when unset or blank", async () => {
    const { wiring } = await load();
    expect(wiring.DEFAULT_ADMISSION_MODE).toBe("audit");
    expect(wiring.resolveAdmissionMode(undefined)).toBe("audit");
    expect(wiring.resolveAdmissionMode("")).toBe("audit");
    expect(wiring.resolveAdmissionMode("   ")).toBe("audit");
  });
  it("accepts off, audit and enforce case-insensitively", async () => {
    const { wiring } = await load();
    expect(wiring.resolveAdmissionMode("off")).toBe("off");
    expect(wiring.resolveAdmissionMode(" AUDIT ")).toBe("audit");
    expect(wiring.resolveAdmissionMode("Enforce")).toBe("enforce");
  });
  it("fails closed to enforce on an unrecognised value", async () => {
    const { wiring } = await load();
    expect(wiring.resolveAdmissionMode("disabled")).toBe("enforce");
    expect(wiring.resolveAdmissionMode("false")).toBe("enforce");
    expect(wiring.resolveAdmissionMode("0")).toBe("enforce");
  });
  it("reads the env var when no argument is given", async () => {
    const { wiring } = await load();
    process.env[GATE] = "off";
    expect(wiring.resolveAdmissionMode()).toBe("off");
  });
});

describe("checkAgentCreation", () => {
  const req = { path: "test:path", subjectId: "agent-x", manifestHash: "h1" };

  it("off: allows without consulting the registry or recording", async () => {
    const { wiring } = await load();
    process.env[GATE] = "off";
    const isMember = vi.fn(() => true);
    wiring._setSocietyRegistryForTests({ isMember } as any);
    const d = wiring.checkAgentCreation(req);
    expect(d).toMatchObject({ allowed: true, mode: "off", member: null });
    expect(isMember).not.toHaveBeenCalled();
    expect(wiring.getAdmissionGateStatus().checked).toBe(0);
  });

  it("audit: allows a non-member, counts it", async () => {
    const { wiring } = await load();
    const d = wiring.checkAgentCreation(req);
    expect(d).toMatchObject({ allowed: true, mode: "audit", member: false });
    const s = wiring.getAdmissionGateStatus();
    expect(s).toMatchObject({ mode: "audit", checked: 1, members: 0, nonMembers: 1, denied: 0 });
    expect(s.byPath["test:path"]).toEqual({ checked: 1, nonMembers: 1 });
  });

  it("enforce: refuses a non-member and assert throws", async () => {
    const { wiring } = await load();
    process.env[GATE] = "enforce";
    expect(wiring.checkAgentCreation(req)).toMatchObject({ allowed: false, member: false });
    expect(() => wiring.assertAgentCreationAllowed(req)).toThrow(wiring.AgentCreationDeniedError);
    expect(wiring.getAdmissionGateStatus().denied).toBe(2);
  });

  it("enforce: allows an admitted member with the matching manifest hash only", async () => {
    const { wiring } = await load();
    process.env[GATE] = "enforce";
    const reg = fakeRegistry([{ id: "agent-x", manifestHash: "h1" }]);
    wiring._setSocietyRegistryForTests(reg);
    expect(wiring.checkAgentCreation(req)).toMatchObject({ allowed: true, member: true, reason: "admitted member" });
    expect(wiring.checkAgentCreation({ ...req, manifestHash: "h2" }).allowed).toBe(false);
    reg.revoke("agent-x");
    expect(wiring.checkAgentCreation(req).allowed).toBe(false);
  });

  it("enforce with no attestation key refuses everything (registry admits nobody)", async () => {
    const { wiring } = await load();
    process.env[GATE] = "enforce";
    expect(wiring.getSocietyRegistry().list()).toEqual([]);
    expect(wiring.checkAgentCreation(req).allowed).toBe(false);
    expect(wiring.getAdmissionGateStatus().keyConfigured).toBe(false);
  });

  it("keeps the recent decision log bounded", async () => {
    const { wiring } = await load();
    for (let i = 0; i < 150; i++) wiring.checkAgentCreation({ ...req, subjectId: `a-${i}` });
    const s = wiring.getAdmissionGateStatus();
    expect(s.checked).toBe(150);
    expect(s.recent.length).toBe(10);
    expect(s.recent[9].subjectId).toBe("a-149");
  });

  it("creationManifestHash is stable and key-order independent", async () => {
    const { wiring } = await load();
    expect(wiring.creationManifestHash({ a: 1, b: 2 })).toBe(wiring.creationManifestHash({ b: 2, a: 1 }));
    expect(wiring.creationManifestHash({ a: 1 })).not.toBe(wiring.creationManifestHash({ a: 2 }));
  });
});

describe("agent-spawner wiring", () => {
  it("audit (default): spawns exactly as before and counts the non-member", async () => {
    const { wiring, spawner } = await load();
    const agent = spawner.spawnAgent("t");
    expect(agent).not.toBeNull();
    expect(spawner.getSpawnerState().activeSpawned).toHaveLength(1);
    expect(wiring.getAdmissionGateStatus().byPath["agent-spawner:spawnAgent"]).toEqual({ checked: 1, nonMembers: 1 });
  });

  it("off: spawns and records nothing", async () => {
    process.env[GATE] = "off";
    const { wiring, spawner } = await load();
    expect(spawner.spawnAgent("t")).not.toBeNull();
    expect(wiring.getAdmissionGateStatus().checked).toBe(0);
  });

  it("enforce: a non-member spawn creates nothing and is reported as denied", async () => {
    process.env[GATE] = "enforce";
    const { spawner } = await load();
    const before = { ...spawner.getSpawnerState() };
    const outcome = spawner.trySpawnAgent("t");
    expect(outcome.status).toBe("denied");
    expect(spawner.spawnAgent("t")).toBeNull();
    const s = spawner.getSpawnerState();
    expect(s.activeSpawned).toHaveLength(0);
    expect(s.totalSpawned).toBe(before.totalSpawned);
    expect(s.lastSpawnAt).toBe(0);
    expect(s.spawnLog).toHaveLength(0);
  });

  it("enforce: spawnBatch and spawnBatchAsync create nothing for non-members", async () => {
    process.env[GATE] = "enforce";
    const { spawner } = await load();
    expect(spawner.spawnBatch(3, "b")).toEqual([]);
    expect(await spawner.spawnBatchAsync(3, "b")).toEqual([]);
    expect(spawner.getSpawnerState().activeSpawned).toHaveLength(0);
  });

  it("enforce: an admitted persistent identity spawns", async () => {
    process.env[GATE] = "enforce";
    const { wiring, spawner } = await load();
    const next = spawner.previewNextSpawn();
    const reg = fakeRegistry([next]);
    wiring._setSocietyRegistryForTests(reg);
    const outcome = spawner.trySpawnAgent("t");
    expect(outcome.status).toBe("spawned");
    if (outcome.status === "spawned") expect(outcome.agent.id).toBe(next.id);
    expect(wiring.getAdmissionGateStatus().members).toBe(1);
  });

  it("cooldown still wins over the gate and is not recorded as a decision", async () => {
    process.env[GATE] = "enforce";
    const { wiring, spawner } = await load();
    spawner.getSpawnerState().lastSpawnAt = Date.now();
    expect(spawner.trySpawnAgent("t").status).toBe("cooldown");
    expect(wiring.getAdmissionGateStatus().checked).toBe(0);
  });

  it("an already-active identity is returned without a gate decision (not a creation)", async () => {
    const { wiring, spawner } = await load();
    const first = spawner.trySpawnAgent("t");
    expect(first.status).toBe("spawned");
    const st = spawner.getSpawnerState();
    st.lastSpawnAt = 0;
    st.totalSpawned = 0;
    const again = spawner.trySpawnAgent("t");
    expect(again.status).toBe("existing");
    expect(wiring.getAdmissionGateStatus().checked).toBe(1);
  });

  it("meeseeks: audit spawns, enforce throws AgentCreationDeniedError and creates nothing", async () => {
    const { wiring, spawner } = await load();
    const opts = { task: "summarise the report", successCriteria: "summary produced" };
    const m = spawner.spawnMeeseeks(opts);
    expect(m.meeseeks).toBe(true);
    const countAfterAudit = spawner.getSpawnerState().activeSpawned.length;

    process.env[GATE] = "enforce";
    expect(() => spawner.spawnMeeseeks(opts)).toThrow(wiring.AgentCreationDeniedError);
    expect(spawner.getSpawnerState().activeSpawned).toHaveLength(countAfterAudit);
  });

  it("meeseeks: an admitted template spawns in enforce mode, a different task type does not", async () => {
    const { wiring, spawner } = await load();
    const opts = { task: "summarise the report", successCriteria: "summary produced" };
    const tpl = spawner.previewMeeseeksTemplate(opts);
    const reg = fakeRegistry([{ id: tpl.subjectId, manifestHash: tpl.manifestHash }]);
    wiring._setSocietyRegistryForTests(reg);
    process.env[GATE] = "enforce";
    expect(spawner.spawnMeeseeks(opts).meeseeks).toBe(true);
    const other = spawner.previewMeeseeksTemplate({ ...opts, taskType: "analysis" as any });
    if (other.subjectId !== tpl.subjectId) {
      expect(() => spawner.spawnMeeseeks({ ...opts, taskType: "analysis" as any })).toThrow(wiring.AgentCreationDeniedError);
    }
  });
});
