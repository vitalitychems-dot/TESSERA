import { describe, expect, it } from "vitest";
import { parseConfiguredPort } from "../lib/server-config";

describe("parseConfiguredPort", () => {
  it("requires a PORT environment value", () => {
    expect(() => parseConfiguredPort(undefined)).toThrow(/PORT environment variable is required/i);
    expect(() => parseConfiguredPort("   ")).toThrow(/PORT environment variable is required/i);
  });

  it("accepts only integer TCP port values in range", () => {
    expect(parseConfiguredPort("3000")).toBe(3000);
    expect(parseConfiguredPort(" 8080 ")).toBe(8080);
    expect(parseConfiguredPort("65535")).toBe(65535);
    for (const invalid of ["0", "-1", "65536", "3000.5", "NaN", "Infinity", "abc"]) {
      expect(() => parseConfiguredPort(invalid)).toThrow(/integer between 1 and 65535/i);
    }
  });
});
