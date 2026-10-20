import { describe, expect, it } from "vitest";
import { appendCycleEvent, isCycleJournal, type CycleEvent } from "./operational-cycle";

describe("operational cycle journal", () => {
  const at = "2026-10-19T20:00:00.000Z";

  it("requires non-empty evidence and sequential stages", () => {
    expect(() => appendCycleEvent([], "lesson", "skip", at)).toThrow("in order");
    expect(() => appendCycleEvent([], "observation", "  ", at)).toThrow("Evidence is required");
    const events = appendCycleEvent([], "observation", "Observed a local status response.", at);
    expect(events).toEqual([{ stage: "observation", recordedAt: at, evidence: "Observed a local status response." }]);
  });

  it("caps the cycle at five stages and validates journal order", () => {
    let events: CycleEvent[] = [];
    for (const stage of ["observation", "lesson", "pulse", "world_tick", "proposed_upgrade"] as const) {
      events = appendCycleEvent(events, stage, `Evidence for ${stage}`, at);
    }
    expect(events).toHaveLength(5);
    expect(() => appendCycleEvent(events, "observation", "again", at)).toThrow("already recorded");
    expect(isCycleJournal({ version: 1, events })).toBe(true);
    expect(isCycleJournal({ version: 1, events: [events[1]] })).toBe(false);
  });
});
