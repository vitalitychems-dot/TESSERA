import { describe, it, expect } from "vitest";
import { TieredMemory } from "../lib/agi/tiered-memory";

describe("tiered memory (REA-07)", () => {
  it("self-edits core blocks", () => {
    const m = new TieredMemory();
    expect(m.coreAppend("human", "Name: Jalen")).toBe(true);
    expect(m.coreReplace("human", "Jalen", "Jalen R.")).toBe(true);
    expect(m.core.get("human")!.value).toBe("Name: Jalen R.");
    expect(m.coreAppend("missing", "x")).toBe(false);
  });
  it("pages overflow to archival and finds it again", () => {
    const m = new TieredMemory([{ label: "notes", limit: 30 }]);
    m.coreAppend("notes", "alpha deployment note");
    m.coreAppend("notes", "beta rollout note here");
    expect(m.core.get("notes")!.value.length).toBeLessThanOrEqual(30);
    expect(m.archivalSearch("alpha")[0]?.text).toContain("alpha");
  });
  it("buildContext respects the token budget and keeps newest recall", () => {
    const m = new TieredMemory([{ label: "persona", limit: 100, value: "I am Tessera" }]);
    for (let i = 0; i < 50; i++) m.pushRecall(`message number ${i} with some padding text`);
    const ctx = m.buildContext(100);
    expect(ctx.tokens).toBeLessThanOrEqual(100);
    expect(ctx.text).toContain("message number 49");
    expect(ctx.droppedRecall).toBeGreaterThan(0);
  });
});
