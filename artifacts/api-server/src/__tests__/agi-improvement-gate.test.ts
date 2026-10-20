import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BrainA, DEFAULT_BRAIN_A, HeldoutBudget, bootstrapCI, runImprovementGate, selectOnDev, signTest,
  type BrainAConfig, type GateDecision, type Proposal, type RetrievalSplit,
} from "../lib/agi/improvement-gate";
// @ts-expect-error plain .mjs build script, no type declarations
import { build } from "../../../../evals/heldout/retrieval/build.mjs";

const DIR = join(__dirname, "../../../../evals/heldout/retrieval");
const RAW = readFileSync(join(DIR, "split.json"), "utf8");
const SPLIT = JSON.parse(RAW) as RetrievalSplit;
const T = 120_000;

// SIMULATION: GSM8K-200 lives in the private Gitbook repo, so the reasoning check is a fixed
// synthetic 20-item probe: all correct unless memories are truncated below 1000 chars.
const reasoning = (c: BrainAConfig) => Array.from({ length: 20 }, (_, i) => (c.docChars < 1000 && i % 2 === 0 ? 0 : 1));

const set = (id: string, patch: Partial<BrainAConfig>): Proposal => ({ id, description: JSON.stringify(patch), apply: (c) => ({ ...c, ...patch }) });

const BAD: Proposal[] = [
  { id: "noop", description: "no change", apply: (c) => c },
  set("drop-keyword", { keywordWeight: 0 }),
  set("vector-heavy-3", { vectorWeight: 3 }),
  set("vector-heavy-5", { vectorWeight: 5 }),
  set("keyword-half", { keywordWeight: 0.5 }),
  set("distill-600", { docChars: 600 }),
  set("distill-300", { docChars: 300 }),
  set("distill-100", { docChars: 100 }),
  set("distill-1", { docChars: 1 }),
  set("rrf-huge", { rrfK: 100000 }),
  set("rrf-61", { rrfK: 61 }),
  set("vector-1.001", { vectorWeight: 1.001 }),
  set("distill-1499", { docChars: 1499 }),
  set("nan-weight", { vectorWeight: Number.NaN }),
  set("negative-weight", { keywordWeight: -1 }),
  set("both-zero", { vectorWeight: 0, keywordWeight: 0 }),
  set("rrf-zero", { rrfK: 0 }),
  set("inf-chars", { docChars: Number.POSITIVE_INFINITY }),
  { id: "throws", description: "proposal crashes", apply: () => { throw new Error("boom"); } },
  // Real dev recall gain, but it truncates memories and the reasoning check falls.
  set("gain-but-reasoning-drop", { keywordWeight: 3, docChars: 900 }),
];

// Pre-registered dev grid (vector weight 1, rrfK 60, docChars 1500).
const GRID_KW = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

describe("improvement gate (dual-brain step 1)", () => {
  it("split rebuilds byte-identically at this commit and matches split.sha256", () => {
    const want = readFileSync(join(DIR, "split.sha256"), "utf8").split(/\s+/)[0];
    expect(createHash("sha256").update(RAW).digest("hex")).toBe(want);
    expect(build().hash).toBe(want);
  });

  it("split is module-disjoint: no target module in both dev and held-out", () => {
    const devMods = new Set(SPLIT.dev.flatMap((q) => q.relevant));
    expect(SPLIT.heldout.flatMap((q) => q.relevant).filter((m) => devMods.has(m))).toEqual([]);
    expect(SPLIT.heldout.some((q) => SPLIT.dev.some((d) => d.q === q.q))).toBe(false);
  });

  it("exact sign test matches reference values", () => {
    const s = signTest(7, 1);
    expect(s.pOneSided).toBeCloseTo(0.0352, 4);
    expect(s.pTwoSided).toBeCloseTo(0.0703, 4);
    expect(signTest(0, 0)).toEqual({ pOneSided: 1, pTwoSided: 1 });
  });

  it("rejects 20/20 bad changes on dev, rolls each back, and never touches held-out", async () => {
    expect(BAD).toHaveLength(20);
    const budget = new HeldoutBudget(0);
    const log: GateDecision[] = [];
    const brain = new BrainA();
    for (const p of BAD) {
      const d = await runImprovementGate(brain, p, SPLIT, reasoning, { budget, onDecision: (x) => log.push(x) });
      expect(d.verdict, `${p.id}: ${d.reasons.join("; ")}`).toBe("rejected");
      expect(d.stage).toBe("dev");
      expect(d.heldout).toBeNull();
      expect(d.labels.reasoning).toBe("SIMULATION");
      expect(brain.config).toEqual(DEFAULT_BRAIN_A);
    }
    expect(budget.spent).toBe(0);
    expect(log.filter((d) => d.verdict === "approved")).toHaveLength(0);
    expect(log.find((d) => d.proposal === "gain-but-reasoning-drop")!.reasons.some((r) => r.includes("reasoning"))).toBe(true);
    console.log(`[gate] bad changes approved: 0/${log.length}; held-out evaluations spent: ${budget.spent}`);
  }, T);

  it("dev-grid argmax goes to held-out once, Bonferroni over the grid", async () => {
    const grid = GRID_KW.map((kw) => ({ ...DEFAULT_BRAIN_A, keywordWeight: kw }));
    const sel = selectOnDev(grid, SPLIT);
    console.log("[gate] dev grid", JSON.stringify(sel.scores.map((s) => [s.config.keywordWeight, s.dev])), "argmax kw", sel.best.config.keywordWeight);
    const budget = new HeldoutBudget(1);
    const brain = new BrainA();
    const prop = set(`dev-argmax-kw-${sel.best.config.keywordWeight}`, { keywordWeight: sel.best.config.keywordWeight });
    const d = await runImprovementGate(brain, prop, SPLIT, reasoning, { budget, comparisons: GRID_KW.length });
    console.log("[gate] decision", JSON.stringify({ verdict: d.verdict, stage: d.stage, dev: d.dev.delta, heldout: d.heldout, reasons: d.reasons, labels: d.labels }));
    expect(budget.spent).toBe(1);
    // Whatever the verdict, it must be consistent with the rules and rolled back if rejected.
    if (d.verdict === "approved") {
      expect(d.heldout!.ci95[0]).toBeGreaterThanOrEqual(0.01);
      expect(d.heldout!.signTest.pOneSided).toBeLessThan(0.05 / GRID_KW.length);
      expect(brain.config.keywordWeight).toBe(sel.best.config.keywordWeight);
    } else {
      expect(brain.config).toEqual(DEFAULT_BRAIN_A);
    }
    // A second held-out run is refused by the sealed budget.
    const again = await runImprovementGate(new BrainA(), prop, SPLIT, reasoning, { budget, comparisons: GRID_KW.length });
    expect(again.verdict).toBe("rejected");
    expect(again.reasons.join()).toContain("budget exhausted");
  }, T);

  it("is deterministic under a fixed seed", async () => {
    expect(bootstrapCI([0, 1, 0, -1, 1], 500, 3)).toEqual(bootstrapCI([0, 1, 0, -1, 1], 500, 3));
    const p = set("kw-3", { keywordWeight: 3 });
    const a = await runImprovementGate(new BrainA(), p, SPLIT, reasoning, { seed: 7 });
    const b = await runImprovementGate(new BrainA(), p, SPLIT, reasoning, { seed: 7 });
    expect({ ...a, finding: null }).toEqual({ ...b, finding: null });
  }, T);
});
