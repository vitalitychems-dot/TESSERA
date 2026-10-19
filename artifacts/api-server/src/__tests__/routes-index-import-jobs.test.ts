import { afterAll, describe, expect, it, vi } from "vitest";
import express from "express";

const probes = vi.hoisted(() => {
  const outbound = vi.fn();
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async () => {
    outbound();
    throw new Error("outbound fetch blocked");
  }) as typeof fetch;
  const dbCalls = {
    select: vi.fn(() => {
      throw new Error("database must not be used");
    }),
    insert: vi.fn(() => {
      throw new Error("database must not be used");
    }),
    update: vi.fn(() => {
      throw new Error("database must not be used");
    }),
    delete: vi.fn(() => {
      throw new Error("database must not be used");
    }),
  };
  return { outbound, originalFetch, dbCalls };
});

const starters = vi.hoisted(() => ({
  startAutonomousBuildCycleTimer: vi.fn(),
  startFreeStuffScraper: vi.fn(),
}));

vi.mock("../lib/autonomous-wiring", () => ({
  startAutonomousOperation(): void {},
  stopAutonomousOperation(): void {},
  getAutonomousStatus(): { running: boolean } {
    return { running: false };
  },
}));

vi.mock("../lib/autonomous-build-cycle", () => ({
  startAutonomousBuildCycleTimer(): void {
    starters.startAutonomousBuildCycleTimer();
  },
}));

vi.mock("../lib/free-stuff-scraper", () => ({
  startFreeStuffScraper(): void {
    starters.startFreeStuffScraper();
  },
}));

vi.mock("pg", () => ({
  default: {
    Pool: class Pool {
      constructor() {
        throw new Error("pg Pool must not be constructed");
      }
    },
  },
}));

vi.mock("@workspace/db", () => ({
  db: probes.dbCalls,
}));

vi.mock("../routes/inventions", () => ({
  default: express.Router(),
}));

vi.mock("../routes/ontology", () => ({
  default: express.Router(),
}));

describe("routes/index import does not start background jobs", () => {
  afterAll(() => {
    globalThis.fetch = probes.originalFetch;
    vi.useRealTimers();
  });

  it("calls none of the five starters and makes no database or outbound calls", async () => {
    vi.useFakeTimers();
    const routes = await import("../routes/index");
    vi.clearAllTimers();
    expect(routes.default).toBeTypeOf("function");
    expect(starters.startAutonomousBuildCycleTimer).toHaveBeenCalledTimes(0);
    expect(starters.startFreeStuffScraper).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.select).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.insert).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.update).toHaveBeenCalledTimes(0);
    expect(probes.dbCalls.delete).toHaveBeenCalledTimes(0);
    expect(probes.outbound).toHaveBeenCalledTimes(0);
  }, 120_000);
});
