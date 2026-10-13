import { describe, it, expect } from "vitest";
import { TemporalFactStore } from "../lib/agi/temporal-facts";
import { decisionHistoryTable } from "@workspace/db/schema";

describe("bi-temporal facts (REA-04)", () => {
  it("invalidates instead of overwriting", () => {
    const s = new TemporalFactStore();
    const a = s.assert("ci", "status", "red", 100);
    const b = s.assert("ci", "status", "green", 200);
    expect(a.validTo).toBe(200);
    expect(a.invalidatedBy).toBe(b.id);
    expect(s.asOf("ci", "status", 150)?.value).toBe("red");
    expect(s.asOf("ci", "status", 250)?.value).toBe("green");
    expect(s.history("ci", "status")).toHaveLength(2);
  });
  it("re-asserting the same value is idempotent", () => {
    const s = new TemporalFactStore();
    const a = s.assert("x", "y", "1", 10);
    expect(s.assert("x", "y", "1", 20)).toBe(a);
  });
  it("retract closes the interval", () => {
    const s = new TemporalFactStore();
    const a = s.assert("x", "y", "1", 10);
    expect(s.retract(a.id, 30)).toBe(true);
    expect(s.asOf("x", "y", 40)).toBeUndefined();
  });
  it("decision_history has validity columns", () => {
    expect(decisionHistoryTable.validFrom.name).toBe("valid_from");
    expect(decisionHistoryTable.validTo.name).toBe("valid_to");
  });
});
