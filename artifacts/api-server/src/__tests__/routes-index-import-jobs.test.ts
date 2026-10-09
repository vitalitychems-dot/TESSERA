import { afterAll, describe, expect, it, vi } from "vitest";

const starters = vi.hoisted(() => ({
  startWalletObserver: vi.fn(),
  startAutonomousBuildCycleTimer: vi.fn(),
  startFreeStuffScraper: vi.fn(),
  startBountyRefresher: vi.fn(),
  startIncomeExecutor: vi.fn(),
}));

vi.mock("../lib/autonomous-wiring", () => ({
  startAutonomousOperation(): void {},
  stopAutonomousOperation(): void {},
  getAutonomousStatus(): { running: boolean } {
    return { running: false };
  },
}));

vi.mock("../lib/wallet-observer", () => ({
  startWalletObserver(): void {
    starters.startWalletObserver();
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

vi.mock("../lib/code-bounties-real", () => ({
  startBountyRefresher(): void {
    starters.startBountyRefresher();
  },
}));

vi.mock("../lib/income-executor", () => ({
  startIncomeExecutor(): void {
    starters.startIncomeExecutor();
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
  db: {
    select() {
      throw new Error("database must not be used");
    },
    insert() {
      throw new Error("database must not be used");
    },
    update() {
      throw new Error("database must not be used");
    },
    delete() {
      throw new Error("database must not be used");
    },
  },
}));

const databaseUrlBefore = process.env.DATABASE_URL;

describe("routes/index import does not start background jobs", () => {
  afterAll(() => {
    vi.useRealTimers();
  });

  it("calls none of the five starters and does not set DATABASE_URL", async () => {
    vi.useFakeTimers();
    const routes = await import("../routes/index");
    vi.clearAllTimers();
    expect(process.env.DATABASE_URL).toBe(databaseUrlBefore);
    expect(routes.default).toBeTypeOf("function");
    expect(starters.startWalletObserver).toHaveBeenCalledTimes(0);
    expect(starters.startAutonomousBuildCycleTimer).toHaveBeenCalledTimes(0);
    expect(starters.startFreeStuffScraper).toHaveBeenCalledTimes(0);
    expect(starters.startBountyRefresher).toHaveBeenCalledTimes(0);
    expect(starters.startIncomeExecutor).toHaveBeenCalledTimes(0);
  }, 120_000);
});
