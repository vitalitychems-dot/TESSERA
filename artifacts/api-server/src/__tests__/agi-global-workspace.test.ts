import { describe, it, expect } from "vitest";
import { publish, broadcastWinner, subscribeWorkspace } from "../lib/agi/agent-bus";

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
    const first = broadcastWinner();
    const second = broadcastWinner();
    expect(second?.id).not.toBe(first?.id);
  });
});
