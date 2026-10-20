import { describe, expect, it } from "vitest";
import { isMoltbookPublishingEnabled } from "../lib/moltbook-publishing-gate";

describe("Moltbook publishing enablement", () => {
  it("stays disabled by default, with a key alone, or with an empty key", () => {
    expect(isMoltbookPublishingEnabled(undefined, undefined)).toBe(false);
    expect(isMoltbookPublishingEnabled(undefined, "owner-key")).toBe(false);
    expect(isMoltbookPublishingEnabled("false", "owner-key")).toBe(false);
    expect(isMoltbookPublishingEnabled("true", "   ")).toBe(false);
  });

  it("requires the exact explicit owner setting and a server-side key", () => {
    expect(isMoltbookPublishingEnabled("TRUE", "owner-key")).toBe(false);
    expect(isMoltbookPublishingEnabled("true", undefined)).toBe(false);
    expect(isMoltbookPublishingEnabled("true", "owner-key")).toBe(true);
  });
});
