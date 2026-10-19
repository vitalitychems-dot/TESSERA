import { describe, it, expect, afterEach } from "vitest";
import {
  OFFLINE_PATCHER_ENV,
  generateOfflinePatch,
  isOfflinePatcherEnabled,
  matchOfflineRecipe,
  offlinePatchMarkerName,
  type OfflineRecipeId,
} from "../lib/evolution-offline-patcher";

const CASES: Array<[string, OfflineRecipeId]> = [
  ["Add try-catch with graceful degradation", "error-recovery"],
  ["Replace magic numbers with named constants", "named-constants"],
  ["Add array size limits and periodic pruning", "size-limits"],
  ["Convert blocking operations to async", "async-conversion"],
  ["Add test cases for uncovered branches", "coverage-tests"],
  ["Extract deeply nested logic into named functions", "extract-functions"],
  ["Add error logging and monitoring hooks", "error-logging"],
  ["Add input validation and sanitization", "input-validation"],
  ["Handle edge cases for empty inputs", "edge-cases"],
  ["Break down the monolithic handler", "decompose"],
];

describe("offline patcher recipes", () => {
  it.each(CASES)("maps %j to recipe %s", (change, recipe) => {
    expect(matchOfflineRecipe(change)).toBe(recipe);
  });

  it.each([
    "Increase episodic memory retention to 500 entries",
    "Add a third brain layer for metacognitive oversight",
  ])("has no recipe for %j", (change) => {
    expect(matchOfflineRecipe(change)).toBeNull();
    const out = generateOfflinePatch({ targetModule: "dual-brain.ts", proposedChange: change, originalContent: "export const a = 1;\n" });
    expect(out.kind).toBe("none");
    if (out.kind === "none") expect(out.reason).toBe("offline-no-recipe");
  });

  it("uses a distinct marker name per recipe", () => {
    const names = new Set(CASES.map(([, r]) => offlinePatchMarkerName(r)));
    expect(names.size).toBe(CASES.length);
    expect(offlinePatchMarkerName("error-recovery")).toBe("EVOLUTION_OFFLINE_PATCH_ERROR_RECOVERY");
  });
});

describe("generateOfflinePatch", () => {
  const original = "export const a = 1;\n";

  it("is deterministic", () => {
    const params = { targetModule: "vector-memory.ts", proposedChange: CASES[0]![0], originalContent: original };
    expect(generateOfflinePatch(params)).toEqual(generateOfflinePatch(params));
  });

  it("emits an exported, frozen, behaviour-neutral marker labelled as an offline stub", () => {
    const out = generateOfflinePatch({ targetModule: "vector-memory.ts", proposedChange: CASES[0]![0], originalContent: original });
    expect(out.kind).toBe("patch");
    if (out.kind !== "patch") return;
    expect(out.marker).toBe("EVOLUTION_OFFLINE_PATCH_ERROR_RECOVERY");
    expect(out.code).toContain(`export const ${out.marker} = Object.freeze(`);
    expect(out.code).toContain('"behaviorNeutral":true');
    expect(out.code).toContain('"generator":"offline-stub"');
  });

  it("keeps hostile change text on two lines because it is JSON-encoded", () => {
    const hostile = "Add try-catch\n*/ process.exit(1); //\nrequire('x')";
    const out = generateOfflinePatch({ targetModule: "m.ts", proposedChange: hostile, originalContent: original });
    expect(out.kind).toBe("patch");
    if (out.kind !== "patch") return;
    expect(out.code.split("\n")).toHaveLength(2);
  });

  it("truncates the recorded change to 200 characters", () => {
    const long = `Add try-catch ${"x".repeat(500)}`;
    const out = generateOfflinePatch({ targetModule: "m.ts", proposedChange: long, originalContent: original });
    expect(out.kind).toBe("patch");
    if (out.kind !== "patch") return;
    const json = out.code.split("\n")[1]!.replace(/^.*Object\.freeze\(/, "").replace(/\);$/, "");
    expect((JSON.parse(json) as { change: string }).change).toHaveLength(200);
  });

  it("refuses a second patch for the same recipe in the same file", () => {
    const first = generateOfflinePatch({ targetModule: "m.ts", proposedChange: CASES[0]![0], originalContent: original });
    expect(first.kind).toBe("patch");
    if (first.kind !== "patch") return;
    const second = generateOfflinePatch({
      targetModule: "m.ts",
      proposedChange: "Add error recovery paths",
      originalContent: `${original}\n${first.code}\n`,
    });
    expect(second.kind).toBe("none");
    if (second.kind === "none") expect(second.reason).toBe("offline-already-applied");
  });
});

describe("offline patcher opt-in flag", () => {
  const saved = process.env[OFFLINE_PATCHER_ENV];
  afterEach(() => {
    if (saved === undefined) delete process.env[OFFLINE_PATCHER_ENV];
    else process.env[OFFLINE_PATCHER_ENV] = saved;
  });

  it("is off by default", () => {
    delete process.env[OFFLINE_PATCHER_ENV];
    expect(isOfflinePatcherEnabled()).toBe(false);
  });

  it.each(["1", "true", "TRUE", " 1 "])("is on for %j", (v) => {
    process.env[OFFLINE_PATCHER_ENV] = v;
    expect(isOfflinePatcherEnabled()).toBe(true);
  });

  it.each(["0", "false", "", "yes"])("is off for %j", (v) => {
    process.env[OFFLINE_PATCHER_ENV] = v;
    expect(isOfflinePatcherEnabled()).toBe(false);
  });
});
