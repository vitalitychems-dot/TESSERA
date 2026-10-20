import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { busHistoryConfig, goalIdOf, hashPayload, logBusMessage, type BusHistoryConfig } from "../lib/agi/bus-history";

const dirs: string[] = [];
function cfg(over: Partial<BusHistoryConfig> = {}): BusHistoryConfig {
  const d = mkdtempSync(join(tmpdir(), "bus-hist-"));
  dirs.push(d);
  return { enabled: true, path: join(d, "bus.jsonl"), maxBytes: 1_000_000, maxFiles: 3, ...over };
}
const lines = (p: string) => readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l));
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("bus-history logger (#11a)", () => {
  it("is off by default and only enabled by BUS_HISTORY_LOG", () => {
    expect(busHistoryConfig({}).enabled).toBe(false);
    expect(busHistoryConfig({ BUS_HISTORY_LOG: "0" }).enabled).toBe(false);
    expect(busHistoryConfig({ BUS_HISTORY_LOG: "1" }).enabled).toBe(true);
    expect(busHistoryConfig({ BUS_HISTORY_LOG: "true" }).enabled).toBe(true);
  });

  it("writes nothing when disabled", () => {
    const c = cfg({ enabled: false });
    expect(logBusMessage("a", "t", { x: 1 }, 0, c)).toBeNull();
    expect(existsSync(c.path)).toBe(false);
  });

  it("writes ts/from/topic/sha256/goal_id and never the payload", () => {
    const c = cfg();
    const payload = { goal_id: "g-7", secret: "do-not-log-me" };
    logBusMessage("planner", "goals", payload, Date.UTC(2026, 9, 20), c);
    const raw = readFileSync(c.path, "utf8");
    expect(raw).not.toContain("do-not-log-me");
    const [r] = lines(c.path);
    expect(Object.keys(r).sort()).toEqual(["from", "goal_id", "sha256", "topic", "ts"]);
    expect(r).toMatchObject({ ts: "2026-10-20T00:00:00.000Z", from: "planner", topic: "goals", goal_id: "g-7" });
    expect(r.sha256).toBe(createHash("sha256").update(JSON.stringify(payload)).digest("hex"));
  });

  it("is append-only, one line per message", () => {
    const c = cfg();
    for (let i = 0; i < 5; i++) logBusMessage("a", "t", { i }, i, c);
    const rs = lines(c.path);
    expect(rs).toHaveLength(5);
    expect(rs[0].sha256).toBe(hashPayload({ i: 0 }));
    expect(rs[4].sha256).toBe(hashPayload({ i: 4 }));
  });

  it("rotates at the size cap and keeps at most maxFiles old files", () => {
    const c = cfg({ maxBytes: 300, maxFiles: 2 });
    for (let i = 0; i < 40; i++) logBusMessage("a", "t", { i }, i, c);
    expect(readFileSync(c.path).length).toBeLessThanOrEqual(300);
    expect(existsSync(`${c.path}.1`)).toBe(true);
    expect(existsSync(`${c.path}.2`)).toBe(true);
    expect(existsSync(`${c.path}.3`)).toBe(false);
  });

  it("extracts goal_id or goalId, else null", () => {
    expect(goalIdOf({ goalId: 3 })).toBe("3");
    expect(goalIdOf("text")).toBeNull();
    expect(goalIdOf(null)).toBeNull();
  });
});
