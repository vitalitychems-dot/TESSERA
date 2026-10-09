import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => {
  const invocations: string[] = [];
  function moduleOf(label: string, names: readonly string[]) {
    const exports: Record<string, () => { synthetic: true; id: string }> = {};
    for (const name of names) {
      exports[name] = () => {
        invocations.push(`${label}.${name}`);
        return { synthetic: true, id: "synthetic" };
      };
    }
    return exports;
  }
  return { invocations, moduleOf };
});

function denyTouched(label: string): never {
  throw new Error(`${label} must not be touched`);
}

vi.mock("pg", () => {
  function Pool() {
    denyTouched("pg");
  }
  return { default: { Pool }, Pool };
});

vi.mock("@workspace/db", () => {
  const deny = () => denyTouched("@workspace/db");
  const db = new Proxy({}, { get: deny });
  const pool = new Proxy({}, { get: deny });
  return new Proxy(
    { db, pool },
    {
      get(target, prop) {
        if (prop === "__esModule") return true;
        if (prop === "then") return undefined;
        if (prop in target) return target[prop as keyof typeof target];
        return {};
      },
    },
  );
});

vi.mock("../lib/sovereign-identity-reinforcement", () =>
  track.moduleOf("sovereign-identity-reinforcement", [
    "getIdentityStatus",
    "getCoreValues",
    "getProtectedMemories",
    "getDriftHistory",
    "runDriftDetection",
    "verifyFatherProtocol",
  ]),
);
vi.mock("../lib/personality-evolution", () =>
  track.moduleOf("personality-evolution", [
    "getPersonalitySnapshot",
    "evolveTraits",
    "getTraitsByCategory",
  ]),
);
vi.mock("../lib/consciousness-engine", () =>
  track.moduleOf("consciousness-engine", [
    "getConsciousnessState",
    "getSemanticNetwork",
    "getEpisodicMemories",
    "getProceduralSkills",
    "recordEpisode",
    "generateReflection",
    "setAttentionFocus",
  ]),
);
vi.mock("../lib/dual-brain", () =>
  track.moduleOf("dual-brain", ["getDualBrainState", "process", "getDecisionHistory"]),
);
vi.mock("../lib/truthfulness-engine", () =>
  track.moduleOf("truthfulness-engine", [
    "getTruthfulnessState",
    "verifyClaim",
    "getRecentVerifications",
    "checkIdentityIntegrity",
  ]),
);
vi.mock("../lib/collective-intelligence", () =>
  track.moduleOf("collective-intelligence", [
    "getCollectiveState",
    "contributeInsight",
    "aggregateKnowledge",
    "getNodeStatus",
  ]),
);
vi.mock("../lib/agent-spawner", () =>
  track.moduleOf("agent-spawner", [
    "listAgents",
    "spawnAgent",
    "getAgent",
    "retireAgent",
    "getSpawnerStats",
    "getAvailableSpecializations",
  ]),
);
vi.mock("../lib/agent-hierarchy", () =>
  track.moduleOf("agent-hierarchy", [
    "getHierarchy",
    "getAgentRank",
    "getChainOfCommand",
    "getSovereigntyRules",
    "getHierarchyStats",
  ]),
);
vi.mock("../lib/agent-comms", () =>
  track.moduleOf("agent-comms", [
    "getCommsStats",
    "getChannels",
    "sendMessage",
    "getMessages",
    "broadcastToChannel",
    "getChannelMessages",
  ]),
);
vi.mock("../lib/consensus-engine", () =>
  track.moduleOf("consensus-engine", [
    "getConsensusStats",
    "createProposal",
    "listProposals",
    "getProposal",
  ]),
);
vi.mock("../lib/council-executor", () =>
  track.moduleOf("council-executor", [
    "getExecutorStatus",
    "getExecutionLog",
    "sweepAndExecute",
    "setAutoExecute",
  ]),
);
vi.mock("../lib/autonomous-heartbeat", () =>
  track.moduleOf("autonomous-heartbeat", [
    "getHeartbeatStatus",
    "generatePulse",
    "getPulseHistory",
    "setAutonomousMode",
  ]),
);
vi.mock("../lib/auto-improvement-daemon", () =>
  track.moduleOf("auto-improvement-daemon", [
    "getDaemonState",
    "runImprovementCycle",
    "getCycleHistory",
    "getImprovementSummary",
  ]),
);
vi.mock("../lib/agi-training-engine", () =>
  track.moduleOf("agi-training-engine", [
    "getTrainingState",
    "startTraining",
    "getSessionHistory",
    "getAvailableDomains",
  ]),
);
vi.mock("../lib/self-code-evolution", () =>
  track.moduleOf("self-code-evolution", [
    "getEvolutionState",
    "proposeEvolution",
    "getEvolutionHistory",
    "applyEvolution",
  ]),
);
vi.mock("../lib/swarm-optimizer", () =>
  track.moduleOf("swarm-optimizer", [
    "getOptimizerStats",
    "optimize",
    "getOptimizationHistory",
    "getAvailableObjectives",
  ]),
);
vi.mock("../lib/universe-mechanics", () =>
  track.moduleOf("universe-mechanics", [
    "getUniverseState",
    "simulateStep",
    "getBody",
    "getConstants",
    "searchUniverse",
  ]),
);
vi.mock("../lib/quantum-tesseract", () =>
  track.moduleOf("quantum-tesseract", [
    "getTesseractState",
    "createCircuit",
    "applyGate",
    "measureAll",
    "listCircuits",
  ]),
);
vi.mock("../lib/emotional-intelligence", () =>
  track.moduleOf("emotional-intelligence", [
    "getEmotionalProfile",
    "processEmotionalInput",
    "getEmotionalStats",
    "getRecentResponses",
  ]),
);
vi.mock("../lib/autonomous-wiring", () =>
  track.moduleOf("autonomous-wiring", [
    "startAutonomousOperation",
    "stopAutonomousOperation",
    "getAutonomousStatus",
  ]),
);

import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import legacyEnginesRouter from "../routes/legacy-engines";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_ADMIN_KEY = "synthetic-owner-token";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";
const SHORT_ADMIN_KEY = "zz-short-key";

type RouteMethod = "GET" | "POST";

type RouteProbe = {
  group: string;
  method: RouteMethod;
  path: string;
  body?: Record<string, string>;
  owner?: boolean;
};

const ROUTES: readonly RouteProbe[] = [
  { group: "identity", method: "GET", path: "/identity/status" },
  { group: "identity", method: "GET", path: "/identity/core-values" },
  { group: "identity", method: "GET", path: "/identity/protected-memories" },
  { group: "identity", method: "GET", path: "/identity/drift-history" },
  { group: "identity", method: "POST", path: "/identity/drift-check", owner: true },
  { group: "identity", method: "GET", path: "/identity/father-protocol" },

  { group: "personality", method: "GET", path: "/personality/snapshot" },
  { group: "personality", method: "POST", path: "/personality/evolve", owner: true },
  { group: "personality", method: "GET", path: "/personality/traits/synthetic" },

  { group: "consciousness", method: "GET", path: "/consciousness/state" },
  { group: "consciousness", method: "GET", path: "/consciousness/semantic-network" },
  { group: "consciousness", method: "GET", path: "/consciousness/episodic-memories" },
  { group: "consciousness", method: "GET", path: "/consciousness/procedural-skills" },
  {
    group: "consciousness",
    method: "POST",
    path: "/consciousness/record-episode",
    body: { content: "synthetic-content" },
    owner: true,
  },
  { group: "consciousness", method: "POST", path: "/consciousness/reflect" },
  { group: "consciousness", method: "POST", path: "/consciousness/focus" },

  { group: "dual-brain", method: "GET", path: "/dual-brain/state" },
  {
    group: "dual-brain",
    method: "POST",
    path: "/dual-brain/process",
    body: { query: "synthetic-query" },
    owner: true,
  },
  { group: "dual-brain", method: "GET", path: "/dual-brain/history" },

  { group: "truthfulness", method: "GET", path: "/truthfulness/state" },
  {
    group: "truthfulness",
    method: "POST",
    path: "/truthfulness/verify",
    body: { claim: "synthetic-claim" },
    owner: true,
  },
  { group: "truthfulness", method: "GET", path: "/truthfulness/recent" },
  { group: "truthfulness", method: "POST", path: "/truthfulness/check-identity" },

  { group: "collective", method: "GET", path: "/collective/state" },
  { group: "collective", method: "POST", path: "/collective/contribute" },
  {
    group: "collective",
    method: "POST",
    path: "/collective/aggregate",
    body: { topic: "synthetic-topic" },
    owner: true,
  },
  { group: "collective", method: "GET", path: "/collective/node/synthetic-agent" },

  { group: "agents", method: "GET", path: "/agents/list" },
  { group: "agents", method: "GET", path: "/agents/stats" },
  { group: "agents", method: "GET", path: "/agents/specializations" },
  {
    group: "agents",
    method: "POST",
    path: "/agents/spawn",
    body: { specialization: "synthetic-spec" },
    owner: true,
  },
  { group: "agents", method: "GET", path: "/agents/synthetic-id" },
  { group: "agents", method: "POST", path: "/agents/synthetic-id/retire" },

  { group: "hierarchy", method: "GET", path: "/hierarchy", owner: true },
  { group: "hierarchy", method: "GET", path: "/hierarchy/stats" },
  { group: "hierarchy", method: "GET", path: "/hierarchy/rules" },
  { group: "hierarchy", method: "GET", path: "/hierarchy/synthetic-agent" },
  { group: "hierarchy", method: "GET", path: "/hierarchy/synthetic-agent/chain" },

  { group: "comms", method: "GET", path: "/comms/stats" },
  { group: "comms", method: "GET", path: "/comms/channels" },
  { group: "comms", method: "GET", path: "/comms/channels/synthetic-channel" },
  {
    group: "comms",
    method: "POST",
    path: "/comms/send",
    body: {
      fromAgent: "synthetic-from",
      toAgent: "synthetic-to",
      content: "synthetic-content",
    },
    owner: true,
  },
  { group: "comms", method: "POST", path: "/comms/broadcast/synthetic-channel" },
  { group: "comms", method: "GET", path: "/comms/messages/synthetic-agent" },

  { group: "consensus", method: "GET", path: "/consensus/stats" },
  { group: "consensus", method: "GET", path: "/consensus/proposals" },
  {
    group: "consensus",
    method: "POST",
    path: "/consensus/propose",
    body: { title: "synthetic-title", description: "synthetic-description" },
    owner: true,
  },
  { group: "consensus", method: "GET", path: "/consensus/synthetic-id" },

  { group: "executor", method: "GET", path: "/executor/status" },
  { group: "executor", method: "GET", path: "/executor/log" },
  { group: "executor", method: "POST", path: "/executor/sweep", owner: true },
  { group: "executor", method: "POST", path: "/executor/auto-execute" },

  { group: "heartbeat", method: "GET", path: "/heartbeat/status" },
  { group: "heartbeat", method: "POST", path: "/heartbeat/pulse", owner: true },
  { group: "heartbeat", method: "GET", path: "/heartbeat/history" },
  { group: "heartbeat", method: "POST", path: "/heartbeat/autonomous-mode" },

  { group: "improvement", method: "GET", path: "/improvement/state" },
  { group: "improvement", method: "POST", path: "/improvement/cycle", owner: true },
  { group: "improvement", method: "GET", path: "/improvement/history" },
  { group: "improvement", method: "GET", path: "/improvement/summary" },

  { group: "training", method: "GET", path: "/training/state" },
  {
    group: "training",
    method: "POST",
    path: "/training/start",
    body: { domain: "synthetic-domain" },
    owner: true,
  },
  { group: "training", method: "GET", path: "/training/history" },
  { group: "training", method: "GET", path: "/training/domains" },

  { group: "evolution", method: "GET", path: "/evolution/state" },
  {
    group: "evolution",
    method: "POST",
    path: "/evolution/propose",
    body: { targetFile: "synthetic-file.ts", description: "synthetic-description" },
    owner: true,
  },
  { group: "evolution", method: "POST", path: "/evolution/apply/synthetic-id" },
  { group: "evolution", method: "GET", path: "/evolution/history" },

  { group: "swarm", method: "GET", path: "/swarm/stats" },
  {
    group: "swarm",
    method: "POST",
    path: "/swarm/optimize",
    body: { objective: "synthetic-objective" },
    owner: true,
  },
  { group: "swarm", method: "GET", path: "/swarm/history" },
  { group: "swarm", method: "GET", path: "/swarm/objectives" },

  { group: "universe", method: "GET", path: "/universe/state" },
  { group: "universe", method: "POST", path: "/universe/simulate", owner: true },
  { group: "universe", method: "GET", path: "/universe/body/synthetic-id" },
  { group: "universe", method: "GET", path: "/universe/constants" },
  { group: "universe", method: "GET", path: "/universe/search" },

  { group: "quantum", method: "GET", path: "/quantum/state" },
  { group: "quantum", method: "GET", path: "/quantum/circuits" },
  { group: "quantum", method: "POST", path: "/quantum/circuit", owner: true },
  { group: "quantum", method: "POST", path: "/quantum/gate" },
  { group: "quantum", method: "POST", path: "/quantum/measure/synthetic-circuit" },

  { group: "emotional", method: "GET", path: "/emotional/profile" },
  { group: "emotional", method: "GET", path: "/emotional/stats" },
  {
    group: "emotional",
    method: "POST",
    path: "/emotional/process",
    body: { input: "synthetic-input" },
    owner: true,
  },
  { group: "emotional", method: "GET", path: "/emotional/recent" },

  { group: "autonomous", method: "GET", path: "/autonomous/status" },
  { group: "autonomous", method: "POST", path: "/autonomous/start", owner: true },
  { group: "autonomous", method: "POST", path: "/autonomous/stop" },
];

const GROUPS = [...new Set(ROUTES.map((route) => route.group))];

const GENERIC_401 = { ok: false, error: "unauthenticated", reason: "no-cookie" };
const GENERIC_503 = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};

describe("legacy engines admin gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];

  beforeAll(async () => {
    for (const group of GROUPS) {
      const owners = ROUTES.filter((route) => route.group === group && route.owner);
      if (owners.length !== 1) {
        throw new Error(`${group} must have exactly one owner probe`);
      }
    }
    expect(SHORT_ADMIN_KEY.length).toBeLessThan(16);
    expect(SYNTHETIC_ADMIN_KEY.length).toBeGreaterThanOrEqual(16);

    const app = express();
    app.use(express.json());
    app.use(legacyEnginesRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
  });

  afterAll(async () => {
    restore(ADMIN_ENV, previousAdmin);
    restore(SESSION_ENV, previousSession);
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function send(
    method: RouteMethod,
    path: string,
    cookie?: string,
    body?: Record<string, string>,
  ): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    let payload: string | undefined;
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      payload = JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, { method, headers, body: payload });
  }

  async function expectGeneric(response: Response, status: 401 | 503): Promise<void> {
    expect(response.status).toBe(status);
    const body: unknown = await response.json();
    if (status === 401) {
      expect(body).toEqual(GENERIC_401);
    } else {
      expect(body).toEqual(GENERIC_503);
    }
    const text = JSON.stringify(body);
    expect(text).not.toContain(SHORT_ADMIN_KEY);
    expect(text).not.toContain("err.message");
    expect(text).not.toContain("must not be touched");
  }

  it("does not run gated handler bodies for an anonymous call", async () => {
    const before = track.invocations.slice();
    for (const route of ROUTES) {
      const response = await send(route.method, route.path, undefined, route.method === "POST" ? {} : undefined);
      await expectGeneric(response, 401);
    }
    expect(track.invocations).toEqual(before);
    expect(track.invocations).not.toContain("council-executor.sweepAndExecute");
    expect(track.invocations).not.toContain("self-code-evolution.proposeEvolution");
    expect(track.invocations).not.toContain("agi-training-engine.startTraining");
  });

  for (const group of GROUPS) {
    it(`returns 401 for every anonymous ${group} route`, async () => {
      const routes = ROUTES.filter((route) => route.group === group);
      expect(routes.length).toBeGreaterThan(0);
      for (const route of routes) {
        const response = await send(
          route.method,
          route.path,
          undefined,
          route.method === "POST" ? (route.body ?? {}) : undefined,
        );
        await expectGeneric(response, 401);
      }
    });

    it(`runs the ${group} handler for an owner session`, async () => {
      const route = ROUTES.find((entry) => entry.group === group && entry.owner);
      if (!route) throw new Error(`missing owner probe for ${group}`);
      const before = track.invocations.length;
      const response = await send(
        route.method,
        route.path,
        ownerCookie(),
        route.method === "POST" ? (route.body ?? {}) : undefined,
      );
      expect(response.status).toBe(200);
      const body = await response.json() as { synthetic?: boolean; status?: string };
      expect(track.invocations.length).toBeGreaterThan(before);
      if (route.path === "/autonomous/start") {
        expect(body.status).toBe("started");
        expect(body.synthetic).toBe(true);
      } else {
        expect(body).toEqual({ synthetic: true, id: "synthetic" });
      }
    });
  }

  it("returns 503 for every gated route when the admin key is unset", async () => {
    const previous = process.env[ADMIN_ENV];
    delete process.env[ADMIN_ENV];
    try {
      const before = track.invocations.slice();
      for (const route of ROUTES) {
        const response = await send(route.method, route.path, `${SESSION_COOKIE}=synthetic-cookie`);
        await expectGeneric(response, 503);
      }
      expect(track.invocations).toEqual(before);
    } finally {
      restore(ADMIN_ENV, previous);
    }
  });

  it("returns 503 for every gated route when the admin key is shorter than 16 characters", async () => {
    const previous = process.env[ADMIN_ENV];
    process.env[ADMIN_ENV] = SHORT_ADMIN_KEY;
    try {
      const before = track.invocations.slice();
      for (const route of ROUTES) {
        const response = await send(route.method, route.path);
        await expectGeneric(response, 503);
      }
      expect(track.invocations).toEqual(before);
    } finally {
      restore(ADMIN_ENV, previous);
    }
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
