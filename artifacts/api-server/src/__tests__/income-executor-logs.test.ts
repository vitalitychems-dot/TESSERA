import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET_DETAIL = "upstream-secret-detail-should-not-log";

vi.mock("../lib/wallet-observer", () => ({
  refreshWalletObservation: async () => {
    const error = new Error(SECRET_DETAIL);
    error.name = "SyntheticIncomeFailure";
    throw error;
  },
  getWalletObservation: () => {
    throw new Error(SECRET_DETAIL);
  },
}));

vi.mock("../lib/disk-persistence", () => ({
  loadJson: async () => [],
  saveJson: () => undefined,
}));

import { logger } from "../lib/logger";
import { startIncomeExecutor } from "../lib/income-executor";

describe("income executor logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the error name and not the message when a tick fails", async () => {
    const warnSpy = vi.spyOn(logger, "warn");
    startIncomeExecutor();
    await vi.waitFor(() => {
      expect(warnSpy.mock.calls.some((call) => call[1] === "income-executor: tick failed")).toBe(true);
    });
    const failed = warnSpy.mock.calls.find((call) => call[1] === "income-executor: tick failed");
    expect(failed?.[0]).toEqual({ errorName: "SyntheticIncomeFailure" });
    expect(JSON.stringify(warnSpy.mock.calls).includes(SECRET_DETAIL)).toBe(false);
  });
});
