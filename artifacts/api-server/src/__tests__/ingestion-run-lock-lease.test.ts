import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));

// R4-16: a hung ingestion run held withRunLock forever, so every later due /
// rotation tick returned "locked". The lock is now a lease that expires.
describe("withRunLock lease", () => {
  afterEach(() => vi.useRealTimers());
  it("lets a new run take over after the lease expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
    const { withRunLock, RUN_LOCK_LEASE_MS } = await import("../lib/ingestion/scheduler");
    let releaseHung!: () => void;
    void withRunLock("due", () => new Promise<void>((r) => { releaseHung = r; }));
    let blockedTicks = 0;
    let ran = false;
    // 2-minute scheduler ticks for 1 hour
    for (let t = 1; t <= 30 && !ran; t++) {
      vi.setSystemTime(Date.parse("2026-10-13T00:00:00Z") + t * 120_000);
      const r = await withRunLock("rotation", async () => "ok");
      if (r === "locked") blockedTicks++; else ran = true;
    }
    console.log(`R4-16 hungRun lease=${RUN_LOCK_LEASE_MS}ms blockedTicksBeforeRecovery=${blockedTicks} recoveredWithin1h=${ran}`);
    expect(ran).toBe(true);
    releaseHung();
    await Promise.resolve();
    expect(await withRunLock("due", async () => "ok2")).toBe("ok2");
  });
});
