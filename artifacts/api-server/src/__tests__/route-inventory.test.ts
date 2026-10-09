import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type Router } from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
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

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const offlineQuery = () => {
    const promise = Promise.reject(new Error("probe-db-offline"));
    promise.catch(() => {});
    const chain: {
      from: () => typeof chain;
      where: () => typeof chain;
      orderBy: () => typeof chain;
      limit: () => typeof chain;
      values: () => typeof chain;
      returning: () => typeof chain;
      set: () => typeof chain;
      then: Promise<never>["then"];
      catch: Promise<never>["catch"];
      finally: Promise<never>["finally"];
    } = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      values: () => chain,
      returning: () => chain,
      set: () => chain,
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
    return chain;
  };
  return {
    ...actual,
    db: {
      select: offlineQuery,
      insert: offlineQuery,
      update: offlineQuery,
      delete: offlineQuery,
    },
  };
});

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
let ownerCookieHeader = "";
const ADMIN_KEY_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_SECRET_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_ADMIN_KEY = "synthetic-admin-key";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";
let savedAdminKey: string | undefined;
let savedSessionSecret: string | undefined;
let ownerEnvInstalled = false;

function installSyntheticOwnerEnv(): void {
  if (ownerEnvInstalled) return;
  savedAdminKey = process.env[ADMIN_KEY_ENV];
  savedSessionSecret = process.env[SESSION_SECRET_ENV];
  process.env[ADMIN_KEY_ENV] = SYNTHETIC_ADMIN_KEY;
  process.env[SESSION_SECRET_ENV] = SYNTHETIC_SESSION_SECRET;
  const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
  ownerCookieHeader = `${SESSION_COOKIE}=${issued.signedId}`;
  ownerEnvInstalled = true;
}

function restoreSyntheticOwnerEnv(): void {
  if (!ownerEnvInstalled) return;
  if (savedAdminKey === undefined) delete process.env[ADMIN_KEY_ENV];
  else process.env[ADMIN_KEY_ENV] = savedAdminKey;
  if (savedSessionSecret === undefined) delete process.env[SESSION_SECRET_ENV];
  else process.env[SESSION_SECRET_ENV] = savedSessionSecret;
  ownerCookieHeader = "";
  ownerEnvInstalled = false;
}

async function request(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (ownerCookieHeader) headers.set("cookie", ownerCookieHeader);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
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

  it("records the registration total", () => {
    console.info(`[route-inventory] registration total=${registrations.length}`);
    // Snapshot pinned at 925 by HYB-012 (PR #2). Chamber-desk merges
    // c8c82953, 8bc97256, aa4c2948 (2026-10-06) added three registrations.
    // Natal identity verification removed two registrations. Unhooking the
    // political-dossier and recruit-dossier routes removes nine more.
    // Deleting POST /sigil/natal/verify drops one more. The total is 916.
    // Any future route add/remove must update this.
    expect(registrations.length).toBe(916);
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
    installSyntheticOwnerEnv();
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
    restoreSyntheticOwnerEnv();
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

describe("HYB-012 non-quantum duplicate response shapes", () => {
  beforeAll(async () => {
    installSyntheticOwnerEnv();
    ensureRouteImportCanLoad();
    const loaders = [
      () => import("../routes/sovereign-engines"),
      () => import("../routes/governance-consensus"),
      () => import("../routes/system-runtime"),
      () => import("../routes/improvement"),
      () => import("../routes/legacy-engines"),
      () => import("../routes/universe"),
    ];
    const parent = express.Router();
    for (const load of loaders) {
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
      server = undefined;
    }
    restoreDatabaseUrl();
    restoreSyntheticOwnerEnv();
  });

  it("GET /api/consciousness/state answers with the sovereign-engines wrapper", async () => {
    const response = await request("GET", "/api/consciousness/state");
    expect(response.status).toBe(200);
    const body = response.json as { ok?: boolean; data?: { cycleCount?: number; currentFocus?: unknown } };
    expect(body.ok).toBe(true);
    expect(typeof body.data?.cycleCount).toBe("number");
    expect(body.data?.currentFocus).toBeDefined();
  });

  it("GET /api/consensus/proposals answers with the governance-consensus wrapper", async () => {
    const response = await request("GET", "/api/consensus/proposals");
    expect(response.status).toBe(200);
    const body = response.json as { ok?: boolean; data?: unknown; count?: number };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe((body.data as unknown[]).length);
  });

  it("GET /api/dual-brain/state answers with the sovereign-engines wrapper", async () => {
    const response = await request("GET", "/api/dual-brain/state");
    expect(response.status).toBe(200);
    const body = response.json as { ok?: boolean; data?: { running?: unknown; totalRounds?: unknown } };
    expect(body.ok).toBe(true);
    expect(typeof body.data?.running).toBe("boolean");
    expect(typeof body.data?.totalRounds).toBe("number");
  });

  it("GET /api/emotional/profile answers with the sovereign-engines wrapper", async () => {
    const response = await request("GET", "/api/emotional/profile");
    expect(response.status).toBe(200);
    const body = response.json as { ok?: boolean; data?: { profile?: unknown; summary?: unknown } };
    expect(body.ok).toBe(true);
    expect(body.data?.profile).toBeTypeOf("object");
    expect(typeof body.data?.summary).toBe("string");
  });

  it("GET /api/universe/metrics answers with the system-runtime data field", async () => {
    const response = await request("GET", "/api/universe/metrics");
    expect(response.status).toBe(200);
    const body = response.json as { ok?: boolean; data?: { universeAge?: unknown }; metrics?: unknown };
    expect(body.ok).toBe(true);
    expect(typeof body.data?.universeAge).toBe("string");
    expect(body.metrics).toBeUndefined();
  });

  it("POST /api/consensus/propose keeps the governance-consensus validation contract", async () => {
    const response = await request("POST", "/api/consensus/propose", {});
    expect(response.status).toBe(400);
    expect(response.json).toEqual({
      ok: false,
      error: "title and description are required",
    });
  });

  it("POST /api/improvement/cycle keeps a generic improvement.ts error envelope when the database is offline", async () => {
    const response = await request("POST", "/api/improvement/cycle", {});
    expect(response.status).toBe(500);
    expect(response.json).toEqual({
      ok: false,
      error: "Improvement cycle failed",
    });
    expect(JSON.stringify(response.json)).not.toContain("probe-db-offline");
  });

  it("POST /api/universe/simulate keeps the system-runtime contract", async () => {
    const rejected = await request("POST", "/api/universe/simulate", { type: "not-a-type" });
    expect(rejected.status).toBe(400);
    const rejectedBody = rejected.json as { ok?: boolean; error?: string };
    expect(rejectedBody.ok).toBe(false);
    expect(rejectedBody.error).toContain("type must be one of:");

    const accepted = await request("POST", "/api/universe/simulate", { type: "quantum" });
    expect(accepted.status).toBe(200);
    const acceptedBody = accepted.json as { ok?: boolean; data?: { type?: string } };
    expect(acceptedBody.ok).toBe(true);
    expect(acceptedBody.data?.type).toBe("quantum");
  });
});
