import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("process live feed", () => {
  it("always answers EventSource with text/event-stream", () => {
    const src = readFileSync(resolve(__dirname, "..", "routes", "sovereign-data.ts"), "utf8");
    const start = src.indexOf('router.get("/processes/live"');
    const end = src.indexOf("router.get(", start + 10);
    const block = src.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('res.setHeader("Content-Type", "text/event-stream")');
    expect(block).not.toContain("res.json");
    expect(block).not.toContain("acceptsSSE");
  });
});
