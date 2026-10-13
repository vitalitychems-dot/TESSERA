import { describe, it, expect } from "vitest";
import { decideWrite, applyWrite, liveMemories, type MemoryItem } from "../lib/agi/memory-writer";

const base: MemoryItem[] = [{ id: "m1", text: "Jalen prefers dark mode in the dashboard", updatedAt: 0 }];

describe("memory writer (REA-03)", () => {
  it("ADDs unrelated facts", () => {
    expect(decideWrite("The CI pipeline uses pnpm eleven", base).op).toBe("ADD");
  });
  it("NOOPs exact duplicates", () => {
    expect(decideWrite("Jalen prefers dark mode in the dashboard", base).op).toBe("NOOP");
  });
  it("UPDATEs related facts", () => {
    const d = decideWrite("Jalen prefers dark mode in the dashboard and editor", base);
    expect(d.op).toBe("UPDATE");
    expect(d.targetId).toBe("m1");
  });
  it("soft-DELETEs explicitly contradicted facts", () => {
    const r = applyWrite("Jalen no longer prefers dark mode in the dashboard", base, 1);
    expect(r.decision.op).toBe("DELETE");
    expect(r.store).toHaveLength(1);
    expect(r.store[0].deletedAt).toBe(1);
    expect(liveMemories(r.store)).toHaveLength(0);
  });
  it("a single negation word on a loosely related fact does not DELETE", () => {
    const d = decideWrite("Jalen never prefers dark mode in the dashboard editor settings panel", base);
    expect(d.similarity).toBeGreaterThanOrEqual(0.5);
    expect(d.similarity).toBeLessThan(0.75);
    expect(d.op).not.toBe("DELETE");
  });
  it("respects a stricter contradict threshold", () => {
    expect(decideWrite("Jalen no longer prefers dark mode in the dashboard", base, { contradict: 0.95 }).op).not.toBe("DELETE");
  });
  it("ignores soft-deleted memories when matching", () => {
    const gone: MemoryItem[] = [{ ...base[0], deletedAt: 1 }];
    expect(decideWrite("Jalen prefers dark mode in the dashboard", gone).op).toBe("ADD");
  });
  it("applyWrite ADD grows the store", () => {
    expect(applyWrite("brand new unrelated statement here", base, 5).store).toHaveLength(2);
  });
});
