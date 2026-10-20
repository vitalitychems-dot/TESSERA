import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BrainA, DEFAULT_BRAIN_A, pairedBootstrapP, retrievalRecalls, runImprovementGate,
  type BrainAConfig, type GateDecision, type Proposal, type RetrievalSplit,
} from "../lib/agi/improvement-gate";

const DIR = join(__dirname, "../../../../evals/heldout/retrieval");
const RAW = readFileSync(join(DIR, "split.json"), "utf8");
const SPLIT = JSON.parse(RAW) as RetrievalSplit;
const T = 120_000;

// GSM8K-200 lives in the private Gitbook repo, so these tests use a fixed synthetic
// reasoning probe: 20 items, all correct unless memories are truncated below 1000 chars
// (standing in for "reasoning over recalled memories gets worse").
const reasoning = (c: BrainAConfig) => Array.from({ length: 20 }, (_, i) => (c.docChars < 1000 && i % 2 === 0 ? 0 : 1));
const flat = () => new Array(20).fill(1);

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
  // Real recall@5 gain, but it truncates memories and the reasoning guardrail falls.
  set("gain-but-reasoning-drop", { keywordWeight: 3, docChars: 900 }),
];

describe("improvement gate (dual-brain step 1)", () => {
  it("held-out split is frozen and disjoint from dev", () => {
    const want = readFileSync(join(DIR, "split.sha256"), "utf8").split(/\s+/)[0];
    expect(createHash("sha256").update(RAW).digest("hex")).toBe(want);
    const dev = new Set(SPLIT.dev.map((q) => q.q));
    expect(SPLIT.heldout.some((q) => dev.has(q.q))).toBe(false);
    expect(SPLIT.heldout.length).toBeGreaterThanOrEqual(100);
  });

  it("rejects 20/20 deliberately bad changes and rolls each back", async () => {
    expect(BAD).toHaveLength(20);
    const log: GateDecision[] = [];
    const brain = new BrainA();
    for (const p of BAD) {
      const d = await runImprovementGate(brain, p, SPLIT, reasoning, { onDecision: (x) => log.push(x) });
      expect(d.verdict, `${p.id}: ${d.reasons.join("; ")}`).toBe("rejected");
      expect(brain.config).toEqual(DEFAULT_BRAIN_A);
    }
    expect(log.filter((d) => d.verdict === "approved")).toHaveLength(0);
    const g = log.find((d) => d.proposal === "gain-but-reasoning-drop")!;
    expect(g.delta.recallAt5).toBeGreaterThan(0);
    expect(g.reasons.some((r) => r.startsWith("reasoning"))).toBe(true);
    console.log(`[gate] bad changes approved: ${log.filter((d) => d.verdict === "approved").length}/${log.length}`);
  }, T);

  it("approves a real good change chosen on dev and confirmed on held-out", async () => {
    const good = set("keyword-weight-2", { keywordWeight: 2 });
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    // Brain A picked this on the dev split only.
    expect(mean(retrievalRecalls(good.apply(DEFAULT_BRAIN_A), SPLIT.docs, SPLIT.dev))).toBeGreaterThan(mean(retrievalRecalls(DEFAULT_BRAIN_A, SPLIT.docs, SPLIT.dev)));
    const brain = new BrainA();
    const d = await runImprovementGate(brain, good, SPLIT, reasoning);
    console.log("[gate] good change", JSON.stringify({ before: d.before, after: d.after, delta: d.delta, p: d.pValue, gains: d.queryGains, losses: d.queryLosses }));
    expect(d.verdict, d.reasons.join("; ")).toBe("approved");
    expect(d.delta.recallAt5).toBeGreaterThanOrEqual(0.01);
    expect(d.pValue).toBeLessThan(0.05);
    expect(brain.config.keywordWeight).toBe(2);
    expect(d.finding.kind).toBe("healthy");
  }, T);

  it("a guardrail-only regression is rejected even with a flat reasoning probe swapped in", async () => {
    const brain = new BrainA();
    const d = await runImprovementGate(brain, set("distill-600", { docChars: 600 }), SPLIT, flat);
    expect(d.verdict).toBe("rejected");
    expect(d.delta.recallAt5).toBeLessThan(0);
    expect(d.finding.kind).toBe("drift");
  }, T);

  it("is deterministic under a fixed seed", async () => {
    const p = set("keyword-weight-2", { keywordWeight: 2 });
    const a = await runImprovementGate(new BrainA(), p, SPLIT, reasoning, { seed: 7 });
    const b = await runImprovementGate(new BrainA(), p, SPLIT, reasoning, { seed: 7 });
    expect({ ...a, finding: null }).toEqual({ ...b, finding: null });
    expect(pairedBootstrapP([0, 0, 0])).toBe(1);
  }, T);
});
