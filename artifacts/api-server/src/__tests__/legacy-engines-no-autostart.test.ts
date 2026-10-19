import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "express";

const autonomousStarts = vi.hoisted(() => ({ count: 0 }));

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

vi.mock("../lib/logger", () => {
  const logger = {
    info() {},
    warn() {},
    error() {},
    debug() {},
    trace() {},
    fatal() {},
    child() {
      return logger;
    },
  };
  return { logger };
});

vi.mock("../lib/autonomous-wiring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/autonomous-wiring")>();
  return {
    ...actual,
    startAutonomousOperation(): void {
      autonomousStarts.count += 1;
      actual.startAutonomousOperation();
    },
  };
});

function silenceStarter<T extends Record<string, unknown>>(actual: T, name: keyof T): T {
  return { ...actual, [name]: () => undefined };
}

vi.mock("../lib/autonomous-build-cycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/autonomous-build-cycle")>();
  return silenceStarter(actual, "startAutonomousBuildCycleTimer");
});

vi.mock("../lib/free-stuff-scraper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/free-stuff-scraper")>();
  return silenceStarter(actual, "startFreeStuffScraper");
});

function inertModule() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "__esModule") return true;
        if (prop === "then") return undefined;
        return () => undefined;
      },
    },
  );
}

vi.mock("../lib/sovereign-cipher", inertModule);
vi.mock("../lib/lattice-frequency-bands", inertModule);
vi.mock("../lib/vgpu", inertModule);
vi.mock("../lib/semantic-compression", inertModule);

vi.mock("../routes/inventions", () => ({ default: Router() }));
vi.mock("../routes/lattice-hardware", () => ({ default: Router() }));

describe("legacy engines do not autostart", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("importing legacy-engines and routes/index does not call startAutonomousOperation or create timers", async () => {
    vi.useFakeTimers();
    const legacy = await import("../routes/legacy-engines");
    const routes = await import("../routes/index");
    expect(legacy.default).toBeTypeOf("function");
    expect(routes.default).toBeTypeOf("function");
    expect(autonomousStarts.count).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    const { getAutonomousStatus } = await import("../lib/autonomous-wiring");
    expect(getAutonomousStatus().running).toBe(false);

    const stack = (legacy.default as unknown as {
      stack: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }>;
    }).stack;
    expect(stack.some((layer) => layer.route?.path === "/autonomous/start" && layer.route.methods?.post)).toBe(true);
    expect(stack.some((layer) => layer.route?.path === "/autonomous/stop" && layer.route.methods?.post)).toBe(true);
    expect(stack.some((layer) => layer.route?.path === "/autonomous/status" && layer.route.methods?.get)).toBe(true);
  }, 120_000);
});
