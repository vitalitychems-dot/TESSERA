import { describe, expect, it } from "vitest";
import {
  isExpectedEmptyState404,
  isOptionalStorageResourceRoute,
} from "../lib/health-probe-policy";

describe("API health probe policy", () => {
  it("does not probe storage availability with invented object IDs", () => {
    expect(isOptionalStorageResourceRoute("/storage/objects/0")).toBe(true);
    expect(isOptionalStorageResourceRoute("/storage/public-objects/0")).toBe(true);
    expect(isOptionalStorageResourceRoute("/healthz")).toBe(false);
  });

  it("treats an empty improvement-verdict slot as a valid 404", () => {
    expect(isExpectedEmptyState404("/improvement-conference/verdict", false)).toBe(true);
    expect(isExpectedEmptyState404("/conversations/0", true)).toBe(true);
    expect(isExpectedEmptyState404("/healthz", false)).toBe(false);
  });
});
