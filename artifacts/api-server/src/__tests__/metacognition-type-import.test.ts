import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MetacognitionFinding, MetacognitionSnapshot } from "../lib/agi/metacognition-types";

// Path kept in a variable so api-server tsc (rootDir=src) does not pull nextgen into its program.
const NEXTGEN_VIEW = "../../../nextgen/lib/metacognition-view.ts";
type PanelFn = (snap: MetacognitionSnapshot | null, limit?: number) => { total: number; rows: unknown[] };

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const importLines = (code: string) => code.split("\n").filter((l) => /^\s*import\s/.test(l));

describe("metacognition is importable by nextgen via type-only imports", () => {
  it("metacognition-types.ts has no runtime imports", () => {
    expect(importLines(src("../lib/agi/metacognition-types.ts"))).toEqual([]);
  });

  it("nextgen view imports api-server only with `import type`", () => {
    const lines = importLines(src(NEXTGEN_VIEW));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).toMatch(/^\s*import type\s/);
  });

  it("nextgen view module loads and maps a snapshot", async () => {
    const mod = (await import(/* @vite-ignore */ new URL(NEXTGEN_VIEW, import.meta.url).href)) as { metacognitionPanel: PanelFn };
    const { metacognitionPanel } = mod;
    expect(typeof mod.metacognitionPanel).toBe("function");
    const f: MetacognitionFinding = { id: "f1", at: 1, kind: "stall", severity: "high", summary: "no progress", evidence: { secret: "x" } };
    const snap: MetacognitionSnapshot = { totalFindings: 1, recentFindings: [f], bySeverity: { high: 1, medium: 0, low: 0 }, causalModel: null };
    const panel = metacognitionPanel(snap);
    expect(panel.total).toBe(1);
    expect(panel.rows).toEqual([{ id: "f1", at: 1, kind: "stall", severity: "high", summary: "no progress" }]);
    expect(metacognitionPanel(null).rows).toEqual([]);
  });
});
