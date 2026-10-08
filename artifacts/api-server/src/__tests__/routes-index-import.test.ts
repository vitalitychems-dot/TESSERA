import { afterAll, describe, expect, it, vi } from "vitest";

const starters = vi.hoisted(() => ({
  startAutonomousOperation: vi.fn(),
  startWalletObserver: vi.fn(),
  startAutonomousBuildCycleTimer: vi.fn(),
  startFreeStuffScraper: vi.fn(),
  startBountyRefresher: vi.fn(),
  startIncomeExecutor: vi.fn(),
}));

vi.mock("../lib/autonomous-wiring", () => ({
  startAutonomousOperation(): void {
    starters.startAutonomousOperation();
  },
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

const databaseUrlBefore = process.env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://routes-index-smoke:unused@127.0.0.1:5432/routes_index_smoke";
}

const natalChartBefore = process.env.FATHER_NATAL_CHART_JSON;
if (!process.env.FATHER_NATAL_CHART_JSON) {
  process.env.FATHER_NATAL_CHART_JSON = JSON.stringify({
    birth: { date: "2000-01-01", time: "12:00", location: "Synthetic Test Location", timezone: "UTC", houseSystem: "Whole Sign" },
    core: {
      sun: { sign: "Aries", degree: "0", house: 1 },
      moon: { sign: "Taurus", degree: "0", house: 2 },
      ascendant: { sign: "Gemini", degree: "0" },
    },
    planets: {
      mercury: { sign: "Aries", degree: "0", house: 1 },
      venus: { sign: "Taurus", degree: "0", house: 2 },
      mars: { sign: "Gemini", degree: "0", house: 3 },
      jupiter: { sign: "Cancer", degree: "0", house: 4 },
      saturn: { sign: "Leo", degree: "0", house: 5 },
      uranus: { sign: "Virgo", degree: "0", house: 6 },
      neptune: { sign: "Libra", degree: "0", house: 7 },
      pluto: { sign: "Scorpio", degree: "0", house: 8 },
    },
    nodes: { northNode: { sign: "Sagittarius", degree: "0", house: 9 } },
    aspects: ["Synthetic test aspect"],
    themes: { dominance: "Synthetic", rising: "Gemini", moonSign: "Taurus", houseConcentration: ["1st house"], chineseZodiac: "Test" },
  });
}

describe("routes/index import", () => {
  afterAll(() => {
    if (databaseUrlBefore === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = databaseUrlBefore;
    if (natalChartBefore === undefined) delete process.env.FATHER_NATAL_CHART_JSON;
    else process.env.FATHER_NATAL_CHART_JSON = natalChartBefore;
    vi.useRealTimers();
  });

  it("loads with starter mocks and does not open a live wallet or network client", async () => {
    vi.useFakeTimers();
    const routes = await import("../routes/index");
    vi.clearAllTimers();
    expect(routes.default).toBeTypeOf("function");
    expect(starters.startWalletObserver).toHaveBeenCalledTimes(1);
    expect(starters.startAutonomousBuildCycleTimer).toHaveBeenCalledTimes(1);
    expect(starters.startFreeStuffScraper).toHaveBeenCalledTimes(1);
    expect(starters.startBountyRefresher).toHaveBeenCalledTimes(1);
    expect(starters.startIncomeExecutor).toHaveBeenCalledTimes(1);
    expect(starters.startAutonomousOperation).toHaveBeenCalled();
  }, 120_000);
});
