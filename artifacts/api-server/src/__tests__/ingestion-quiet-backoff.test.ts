import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));

// R4-11: silent sources (no new items) are polled less often; a new item resets.
function simulate(nextRunAt: (s: any) => Date | null, newItemAtHour: number | null) {
  const interval = 3600;
  const start = Date.UTC(2026, 9, 1);
  let s: any = { lastRunAt: null, lastSuccessAt: new Date(start - 1), intervalSeconds: interval };
  let fetches = 0;
  let detectDelayMin = -1;
  for (let m = 0; m < 24 * 60; m += 5) {
    const now = new Date(start + m * 60_000);
    const nr = nextRunAt(s);
    if (nr && now < nr) continue;
    fetches++;
    const hasNew = newItemAtHour !== null && m >= newItemAtHour * 60 && detectDelayMin < 0;
    if (hasNew) { detectDelayMin = m - newItemAtHour! * 60; s.lastSuccessAt = now; }
    s.lastRunAt = now;
  }
  return { fetches, detectDelayMin };
}
const baseline = (s: any) => s.lastRunAt ? new Date(s.lastRunAt.getTime() + s.intervalSeconds * 1000) : null;

describe("quietSourceNextRunAt", () => {
  it("cuts fetches for a silent source over 24h, bounded delay on new data", async () => {
    const { quietSourceNextRunAt } = await import("../lib/ingestion/scheduler");
    const b = simulate(baseline, null), a = simulate(quietSourceNextRunAt, null);
    const bn = simulate(baseline, 13), an = simulate(quietSourceNextRunAt, 13);
    console.log(`R4-11 silent24h fetches before=${b.fetches} after=${a.fetches}; newItem@13h detectDelayMin before=${bn.detectDelayMin} after=${an.detectDelayMin}`);
    expect(a.fetches).toBeLessThan(b.fetches);
    expect(an.detectDelayMin).toBeLessThanOrEqual(4 * 60);
  });
});
