import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BrainA, DEFAULT_BRAIN_A, HeldoutBudget, bootstrapCI, runImprovementGate, selectOnDev, signTest,
  type BrainAConfig, type GateDecision, type Proposal, type RetrievalSplit,
} from "../lib/agi/improvement-gate";
// @ts-expect-error plain .mjs build script, no type declarations
import { drift } from "../../../../evals/heldout/retrieval/build.mjs";

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
  it("committed split.json matches split.sha256 (frozen v1, never rebuilt)", () => {
    const want = readFileSync(join(DIR, "split.sha256"), "utf8").split(/\s+/)[0];
    expect(createHash("sha256").update(RAW).digest("hex")).toBe(want);
    expect(SPLIT.version).toBe("v1");
  });

  it("--drift reports +1 query for an extra test title, exits 0, writes nothing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "split-drift-"));
    const api = join(tmp, "src");
    cpSync(join(__dirname, ".."), api, { recursive: true, filter: (p) => !p.includes("node_modules") });
    const f = join(api, "__tests__", `${SPLIT.dev[0].relevant[0].replace(/\.ts$/, "").replace(/\//g, "-")}.test.ts`);
    writeFileSync(f, readFileSync(f, "utf8") + '\nit("drift probe extra title", () => {});\n');
    const before = readFileSync(join(DIR, "split.json"), "utf8") + readFileSync(join(DIR, "split.sha256"), "utf8");
    const r = spawnSync(process.execPath, [join(DIR, "build.mjs"), "--drift", "--api", api], { encoding: "utf8" });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.summary.removedQueries).toBe(0);
    expect(out.addedQueries.filter((q: { q: string }) => q.q === "drift probe extra title")).toHaveLength(1);
    expect(readFileSync(join(DIR, "split.json"), "utf8") + readFileSync(join(DIR, "split.sha256"), "utf8")).toBe(before);
    expect(drift(api).addedQueries.length).toBe(out.addedQueries.length);
  }, T);

  it("--write refuses without a version bump", () => {
    const out = mkdtempSync(join(tmpdir(), "split-write-"));
    for (const n of ["split.json", "split.sha256", "CHANGELOG.md"]) cpSync(join(DIR, n), join(out, n));
    const snap = () => ["split.json", "split.sha256", "CHANGELOG.md"].map((n) => readFileSync(join(out, n), "utf8")).join("");
    const before = snap();
    for (const extra of [[], ["--version", "v1"], ["--version", "v0"], ["--version", "banana"]]) {
      const r = spawnSync(process.execPath, [join(DIR, "build.mjs"), "--write", "--out", out, "--note", "x", ...extra], { encoding: "utf8" });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/refusing/);
    }
    expect(snap()).toBe(before);
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
      const d = await runImprovementGate(brain, p, SPLIT, reasoning, { budget, comparisons: 1, onDecision: (x) => log.push(x) });
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
    const d = await runImprovementGate(brain, prop, SPLIT, reasoning, { budget, devSelection: sel });
    expect(d.comparisons).toBe(GRID_KW.length);
    expect(d.devGrid).toHaveLength(GRID_KW.length);
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
    const again = await runImprovementGate(new BrainA(), prop, SPLIT, reasoning, { budget, devSelection: sel });
    expect(again.verdict).toBe("rejected");
    expect(again.reasons.join()).toContain("budget exhausted");
  }, T);

  it("is deterministic under a fixed seed (dev only, no held-out spent)", async () => {
    expect(bootstrapCI([0, 1, 0, -1, 1], 500, 3)).toEqual(bootstrapCI([0, 1, 0, -1, 1], 500, 3));
    const budget = new HeldoutBudget(0);
    const p = set("kw-3", { keywordWeight: 3 });
    const a = await runImprovementGate(new BrainA(), p, SPLIT, reasoning, { budget, comparisons: 1, seed: 7 });
    const b = await runImprovementGate(new BrainA(), p, SPLIT, reasoning, { budget, comparisons: 1, seed: 7 });
    expect({ ...a, finding: null }).toEqual({ ...b, finding: null });
    expect(budget.spent).toBe(0);
  }, T);
});

describe("improvement gate fails closed", () => {
  const good = set("kw-5", { keywordWeight: 5 });
  const run = (reasoningFn: Parameters<typeof runImprovementGate>[3], opts: Record<string, unknown> = {}, split: RetrievalSplit = SPLIT) => {
    const brain = new BrainA();
    return runImprovementGate(brain, good, split, reasoningFn, { budget: new HeldoutBudget(1), comparisons: 1, ...opts } as never)
      .then((d) => ({ d, brain }));
  };
  const expectReject = (r: { d: GateDecision; brain: BrainA }, text: string) => {
    expect(r.d.verdict).toBe("rejected");
    expect(r.d.reasons.join(" | ")).toContain(text);
    expect(r.brain.config).toEqual(DEFAULT_BRAIN_A);
    expect(r.d.config).toEqual(DEFAULT_BRAIN_A);
  };

  it("reasoning scorer that throws (dev or held-out) rolls back and rejects", async () => {
    expectReject(await run(() => { throw new Error("scorer down"); }), "evaluation threw: scorer down");
    expectReject(await run((c, w) => { if (w === "heldout") throw new Error("late"); return reasoning(c); }), "evaluation threw: late");
    expectReject(await run(async () => Promise.reject(new Error("async down"))), "async down");
  }, T);

  it("onDecision that throws rolls back and rejects", async () => {
    expectReject(await run(reasoning, { onDecision: () => { throw new Error("sink down"); } }), "onDecision threw");
  }, T);

  it("rejects NaN, empty and length-mismatched reasoning results", async () => {
    expectReject(await run(() => [1, Number.NaN]), "invalid reasoning data");
    expectReject(await run(() => []), "invalid reasoning data");
    expectReject(await run(() => "x" as never), "invalid reasoning data");
    expectReject(await run((c) => (c.keywordWeight === 1 ? [1, 1, 1] : [1, 1])), "length 3 before vs 2 after");
  }, T);

  it("rejects NaN recall (query with no relevant docs) and empty splits", async () => {
    const bad = { ...SPLIT, dev: [...SPLIT.dev, { q: "x", relevant: [] }] };
    expectReject(await run(reasoning, {}, bad), "invalid recall data");
    expectReject(await run(reasoning, {}, { ...SPLIT, dev: [] }), "empty dev split");
  }, T);

  it("validates every option", async () => {
    const sel = { scores: [{ config: DEFAULT_BRAIN_A, dev: 0.5 }, { config: DEFAULT_BRAIN_A, dev: 0.6 }], best: { config: DEFAULT_BRAIN_A, dev: 0.6 } };
    const cases: [Record<string, unknown>, string][] = [
      [{ epsilon: Number.NaN }, "epsilon"], [{ minGain: 0 }, "minGain"], [{ minGain: 0.02, epsilon: 0.01 }, "disagree"],
      [{ alpha: Number.NaN }, "alpha"], [{ alpha: 0 }, "alpha"], [{ alpha: 1 }, "alpha"],
      [{ comparisons: 0 }, "comparisons must be"], [{ comparisons: 1.5 }, "comparisons must be"], [{ comparisons: undefined }, "comparisons required"],
      [{ budget: undefined }, "budget is required"], [{ budget: { spend: () => true, spent: 0, limit: 1e9 } }, "budget is required"],
      [{ devSelection: sel, comparisons: 9 }, "!= dev grid size 2"], [{ devSelection: { scores: [], best: null } }, "non-empty"],
      [{ devSelection: { scores: [{ config: DEFAULT_BRAIN_A, dev: Number.NaN }] } }, "finite"],
      [{ bootstrapIters: 10 }, "bootstrapIters"], [{ k: 0 }, "k must"], [{ reasoningLabel: "TESTED" }, "reasoningEvalId"],
    ];
    for (const [o, text] of cases) expectReject(await run(reasoning, o), text);
    expect(() => selectOnDev([], SPLIT)).toThrow("non-empty");
  }, T);

  it("budget is shared: a second gate instance cannot reuse it", async () => {
    const budget = new HeldoutBudget(1);
    const a = await runImprovementGate(new BrainA(), good, SPLIT, reasoning, { budget, comparisons: 1 });
    const b = await runImprovementGate(new BrainA(), good, SPLIT, reasoning, { budget, comparisons: 1 });
    expect(a.stage).toBe("heldout");
    expect(b.verdict).toBe("rejected");
    expect(b.reasons.join()).toContain("budget exhausted");
    expect(budget.spent).toBe(1);
  }, T);
});
