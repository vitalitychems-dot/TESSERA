import { describe, it, expect } from "vitest";
import { publish } from "../lib/agi/agent-bus";
import { broadcastWinner, subscribeWorkspace } from "../lib/agi/global-workspace";

describe("global workspace broadcast (REA-06)", () => {
  it("broadcasts the single most salient message to all listeners", () => {
    const got: string[] = [];
    const off1 = subscribeWorkspace((m) => got.push(`a:${m.topic}`));
    const off2 = subscribeWorkspace((m) => got.push(`b:${m.topic}`));
    subscribeWorkspace(() => { throw new Error("bad listener"); });
    publish("x", "gw-low", { v: "quiet signal one" }, 10);
    publish("y", "gw-high", { v: "urgent anomaly detected" }, 95);
    const w = broadcastWinner();
    expect(w?.topic).toBe("gw-high");
    expect(got).toEqual(["a:gw-high", "b:gw-high"]);
    off1(); off2();
  });
  it("does not re-broadcast the same winner", () => {
    publish("z", "gw-rb-a", { v: "first candidate" }, 99);
    publish("z", "gw-rb-b", { v: "second candidate" }, 98);
    const first = broadcastWinner();
    const second = broadcastWinner();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(typeof first!.id).toBe("string");
    expect(second!.id).not.toBe(first!.id);
  });
  it("returns null rather than repeating once every candidate has won", () => {
    publish("z", "gw-solo", { v: "only one" }, 97);
    const ids = new Set<string>();
    let w;
    while ((w = broadcastWinner()) !== null) {
      expect(ids.has(w.id)).toBe(false);
      ids.add(w.id);
      if (ids.size > 5) break;
    }
    expect(ids.size).toBeGreaterThan(0);
  });
});
