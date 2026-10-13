import { describe, it, expect } from "vitest";
import { decideWrite, applyWrite, type MemoryItem } from "../lib/agi/memory-writer";

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
  it("DELETEs contradicted facts", () => {
    const r = applyWrite("Jalen no longer prefers dark mode in the dashboard", base, 1);
    expect(r.decision.op).toBe("DELETE");
    expect(r.store).toHaveLength(0);
  });
  it("applyWrite ADD grows the store", () => {
    expect(applyWrite("brand new unrelated statement here", base, 5).store).toHaveLength(2);
  });
});
