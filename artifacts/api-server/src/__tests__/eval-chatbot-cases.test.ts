import { describe, expect, it } from "vitest";
import { CASES } from "../eval/chatbot-cases";

describe("eval chatbot cases", () => {
  it("keeps unique ids and non-empty include or exclude rules", () => {
    const ids = CASES.map((entry) => entry.id);
    expect(ids).toEqual([
      "identity-1",
      "identity-2",
      "math-1",
      "math-2",
      "datetime-1",
      "convert-1",
      "knowledge-1",
      "small-talk-1",
      "lunar-1",
      "complex-1",
    ]);
    expect(new Set(ids).size).toBe(ids.length);

    for (const entry of CASES) {
      const include = entry.mustInclude ?? [];
      const exclude = entry.mustNotInclude ?? [];
      expect(include.length + exclude.length).toBeGreaterThan(0);
      if (entry.mustInclude) expect(entry.mustInclude.length).toBeGreaterThan(0);
      if (entry.mustNotInclude) expect(entry.mustNotInclude.length).toBeGreaterThan(0);
      for (const rule of [...include, ...exclude]) {
        expect(rule.length).toBeGreaterThan(0);
      }
    }
  });
});
