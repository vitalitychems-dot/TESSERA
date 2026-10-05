import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type Router } from "express";
import { createServer, type Server } from "node:http";
import {
  collapsedRouteKeyCount,
  duplicateRoutes,
  listExpressRegistrations,
  listMountedRouteModules,
  listRouteRegistrations,
  routeModuleFileNames,
  type DuplicateRoute,
  type RouteRegistration,
} from "./route-inventory";

/**
 * Importing legacy-engines.ts calls startAutonomousOperation() at module
 * scope. The route handlers under test do not use that scheduler. Replacing
 * the starter keeps this file from launching background work.
 */
vi.mock("../lib/autonomous-wiring", () => ({
  startAutonomousOperation(): void {},
  stopAutonomousOperation(): void {},
  getAutonomousStatus(): { running: boolean } {
    return { running: false };
  },
}));

/**
 * HYB-012 ruling allow-list. Exactly the two collisions named in
 * https://github.com/vitalitychems-dot/Gitbook/issues/2#issuecomment-6003995168
 * Modules are listed in current `routes/index.ts` mount order. system-runtime
 * is mounted first, so its handler is the one that responds.
 */
const RULING_NAMED_DUPLICATES: readonly DuplicateRoute[] = [
  {
    method: "GET",
    path: "/quantum/state",
    modules: ["system-runtime.ts", "legacy-engines.ts"],
  },
  {
    method: "POST",
    path: "/quantum/gate",
    modules: ["system-runtime.ts", "legacy-engines.ts"],
  },
];

/**
 * Every exact METHOD+path collision on the mounted tree today.
 *
 * The ruling names the two quantum collisions above. A full inventory also
 * finds eight other collisions that `collectRegisteredRoutes` already hides.
 * They are listed here so this test passes on the current tree. The list is
 * exact: a new collision fails, and a listed collision that loses a
 * registration fails too.
 */
const DUPLICATE_ROUTE_ALLOW_LIST: readonly DuplicateRoute[] = [
  {
    method: "GET",
    path: "/consciousness/state",
    modules: ["sovereign-engines.ts", "legacy-engines.ts"],
  },
  {
    method: "GET",
    path: "/consensus/proposals",
    modules: ["governance-consensus.ts", "legacy-engines.ts"],
  },
  {
    method: "GET",
    path: "/dual-brain/state",
    modules: ["sovereign-engines.ts", "legacy-engines.ts"],
  },
  {
    method: "GET",
    path: "/emotional/profile",
    modules: ["sovereign-engines.ts", "legacy-engines.ts"],
  },
  RULING_NAMED_DUPLICATES[0],
  {
    method: "GET",
    path: "/universe/metrics",
    modules: ["system-runtime.ts", "universe.ts"],
  },
  {
    method: "POST",
    path: "/consensus/propose",
    modules: ["governance-consensus.ts", "legacy-engines.ts"],
  },
  {
    method: "POST",
    path: "/improvement/cycle",
    modules: ["improvement.ts", "legacy-engines.ts"],
  },
  RULING_NAMED_DUPLICATES[1],
  {
    method: "POST",
    path: "/universe/simulate",
    modules: ["system-runtime.ts", "legacy-engines.ts"],
  },
];

const QUANTUM_STATE_SHAPE = {
  ok: true,
  data: {
    qubitCount: 0,
    entanglementPairs: 0,
    coherenceAvg: 0,
    activeBridges: 0,
    quantumVolume: 1,
    errorRate: 0.003,
    gatesApplied: 0,
    measurementsMade: 0,
    dimensionalDepth: 27,
  },
  reality: {
    bridgeFidelity: "real",
    bridgeBandwidth: "real",
    errorRate: "real",
    measurement: "real",
  },
};

function byMethodPath(left: DuplicateRoute, right: DuplicateRoute): number {
  return `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`);
}

function registrationKey(entry: { method: string; path: string }): string {
  return `${entry.method} ${entry.path}`;
}

const databaseUrlBefore = process.env.DATABASE_URL;
let installedPlaceholderDatabaseUrl = false;

function ensureRouteImportCanLoad(): void {
  if (process.env.DATABASE_URL) return;
  // Route modules import @workspace/db, which refuses to load without this
  // variable. The quantum handlers under test do not query it. The placeholder
  // is not a secret and is removed after the file finishes.
  process.env.DATABASE_URL = "postgresql://route-inventory:unused@127.0.0.1:5432/route_inventory";
  installedPlaceholderDatabaseUrl = true;
}

function restoreDatabaseUrl(): void {
  if (!installedPlaceholderDatabaseUrl) return;
  if (databaseUrlBefore === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = databaseUrlBefore;
  installedPlaceholderDatabaseUrl = false;
}

let server: Server | undefined;
let baseUrl = "";

async function request(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

describe("HYB-012 route inventory", () => {
  const registrations = listRouteRegistrations();

  it("enumerates every mounted module and keeps duplicate registrations", () => {
    const mounted = listMountedRouteModules();
    expect(mounted.map((entry) => entry.module).sort()).toEqual(routeModuleFileNames());
    expect(new Set(registrations.map((entry) => entry.module)).size).toBe(mounted.length);

    const quantumState = registrations.filter(
      (entry) => entry.method === "GET" && entry.path === "/quantum/state",
    );
    const quantumGate = registrations.filter(
      (entry) => entry.method === "POST" && entry.path === "/quantum/gate",
    );
    expect(quantumState.map((entry) => entry.module)).toEqual(["system-runtime.ts", "legacy-engines.ts"]);
    expect(quantumGate.map((entry) => entry.module)).toEqual(["system-runtime.ts", "legacy-engines.ts"]);
    expect(quantumState[0]?.mountIndex).toBeLessThan(quantumState[1]?.mountIndex ?? -1);
    expect(quantumGate[0]?.mountIndex).toBeLessThan(quantumGate[1]?.mountIndex ?? -1);

    const collapsed = collapsedRouteKeyCount(registrations);
    expect(registrations.length).toBeGreaterThan(collapsed);
    const hidden = registrations.length - collapsed;
    const allowListSurplus = DUPLICATE_ROUTE_ALLOW_LIST.reduce(
      (sum, entry) => sum + entry.modules.length - 1,
      0,
    );
    expect(hidden).toBe(allowListSurplus);
  });

  it("allow-lists exactly the current duplicates, including the two ruling entries", () => {
    expect(RULING_NAMED_DUPLICATES).toHaveLength(2);
    expect(RULING_NAMED_DUPLICATES.map(registrationKey)).toEqual([
      "GET /quantum/state",
      "POST /quantum/gate",
    ]);

    const live = duplicateRoutes(registrations).slice().sort(byMethodPath);
    const allowed = DUPLICATE_ROUTE_ALLOW_LIST.slice().sort(byMethodPath);
    expect(live).toEqual(allowed);

    for (const named of RULING_NAMED_DUPLICATES) {
      expect(live).toContainEqual(named);
    }
  });

  it("matches Express registrations for the two quantum modules", async () => {
    ensureRouteImportCanLoad();
    const systemRuntime = (await import("../routes/system-runtime")).default as Router;
    const legacyEngines = (await import("../routes/legacy-engines")).default as Router;
    const fromExpress = [
      ...listExpressRegistrations(systemRuntime, "system-runtime.ts"),
      ...listExpressRegistrations(legacyEngines, "legacy-engines.ts"),
    ];
    const fromSource = registrations
      .filter((entry) => entry.module === "system-runtime.ts" || entry.module === "legacy-engines.ts")
      .map((entry: RouteRegistration) => ({
        method: entry.method,
        path: entry.path,
        module: entry.module,
      }));
    expect(fromExpress).toEqual(fromSource);
  });
});

describe("HYB-012 quantum mount order", () => {
  beforeAll(async () => {
    ensureRouteImportCanLoad();
    const registrations = listRouteRegistrations();
    const owners = duplicateRoutes(registrations).find(
      (entry) => entry.method === "GET" && entry.path === "/quantum/state",
    );
    expect(owners?.modules).toEqual(["system-runtime.ts", "legacy-engines.ts"]);

    const loaders: Record<string, () => Promise<{ default: Router }>> = {
      "system-runtime.ts": () => import("../routes/system-runtime"),
      "legacy-engines.ts": () => import("../routes/legacy-engines"),
    };
    const parent = express.Router();
    for (const module of owners?.modules ?? []) {
      const load = loaders[module];
      if (!load) throw new Error(`No loader for duplicate owner ${module}`);
      parent.use((await load()).default);
    }

    const app = express();
    app.use(express.json());
    app.use("/api", parent);

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }
    restoreDatabaseUrl();
  });

  it("GET /api/quantum/state answers with the system-runtime shape", async () => {
    const response = await request("GET", "/api/quantum/state");
    expect(response.status).toBe(200);
    expect(response.json).toEqual(QUANTUM_STATE_SHAPE);
  });

  it("POST /api/quantum/gate answers with the system-runtime contract", async () => {
    const accepted = await request("POST", "/api/quantum/gate", {
      qubitId: "hyb012-probe",
      gate: "H",
    });
    expect(accepted.status).toBe(200);
    expect(accepted.json).toEqual({
      ok: true,
      data: { success: false, qubitId: "hyb012-probe", gate: "H" },
    });

    const missingQubit = await request("POST", "/api/quantum/gate", {
      circuitId: "legacy-would-accept",
      gate: "H",
      target: 0,
    });
    expect(missingQubit.status).toBe(400);
    expect(missingQubit.json).toEqual({
      ok: false,
      error: "qubitId and gate are required",
    });
  });
});
