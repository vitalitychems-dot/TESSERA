import { describe, it, expect } from "vitest";
import { retrievalScore, reflect, runReflectionTick, recentReflectionEvents, reflectionsSince, clearReflectionEvents, MAX_REFLECTION_EVENTS } from "../lib/agi/reflection";
import { recordObservation } from "../lib/agi/working-memory";

describe("reflection (REA-05)", () => {
  it("recency decays", () => {
    const m = { id: "a", text: "x", at: 0, importance: 0 };
    expect(retrievalScore(m, 0, 0)).toBeCloseTo(1);
    expect(retrievalScore(m, 3_600_000, 0)).toBeCloseTo(0.5);
  });
  it("stays silent below the importance threshold", () => {
    expect(reflect([{ id: "a", text: "deploy deploy", at: 0, importance: 0.5 }], { now: 0 })).toEqual([]);
  });
  it("produces theme insights above threshold", () => {
    const mems = Array.from({ length: 6 }, (_, i) => ({ id: `${i}`, text: `deploy failed on runner ${i}`, at: i, importance: 0.8 }));
    const out = reflect(mems, { now: 10 });
    expect(out.some((s) => s.includes("deploy"))).toBe(true);
  });
  it("tick writes hypotheses from observations", () => {
    for (let i = 0; i < 8; i++) recordObservation("t", `reflect-${i}`, { msg: `latency spike gateway ${i}` });
    expect(Array.isArray(runReflectionTick())).toBe(true);
  });
  it("#19: reflection adds a memory event per insight", () => {
    clearReflectionEvents();
    const t0 = Date.now();
    for (let i = 0; i < 8; i++) recordObservation("deploy", `refl19-${i}`, { msg: `deploy failed on runner ${i}` });
    const insights = runReflectionTick(t0);
    const events = recentReflectionEvents();
    expect(insights.length).toBeGreaterThan(0);
    expect(events.length).toBe(insights.length);
    events.forEach((e, i) => { expect(e.kind).toBe("reflection"); expect(e.text).toBe(insights[i]); });
    expect(reflectionsSince(t0 - 86_400_000)).toBe(insights.length);
  });
  it("#13: cap holds exactly 1000 and drops the oldest", () => {
    clearReflectionEvents();
    for (let i = 0; i < 8; i++) recordObservation("deploy", `refl13-${i}`, { msg: `deploy failed on runner ${i}` });
    const first = runReflectionTick(1);
    expect(first.length).toBeGreaterThan(0);
    const firstIds = recentReflectionEvents(1000).map((e) => e.id);
    let n = 1;
    while (recentReflectionEvents(2000).length < MAX_REFLECTION_EVENTS) runReflectionTick(++n);
    runReflectionTick(++n);
    const all = recentReflectionEvents(2000);
    expect(all.length).toBe(MAX_REFLECTION_EVENTS);
    expect(all.some((e) => e.id === firstIds[0])).toBe(false);
    expect(all[all.length - 1].at).toBe(n);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });
  it("#13: ids unique across two ticks with the same timestamp, even when full", () => {
    clearReflectionEvents();
    for (let i = 0; i < 8; i++) recordObservation("deploy", `refl13b-${i}`, { msg: `deploy failed on runner ${i}` });
    let n = 0;
    while (recentReflectionEvents(2000).length < MAX_REFLECTION_EVENTS) runReflectionTick(++n);
    runReflectionTick(42);
    runReflectionTick(42);
    const all = recentReflectionEvents(2000);
    expect(all.length).toBe(MAX_REFLECTION_EVENTS);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });
});
