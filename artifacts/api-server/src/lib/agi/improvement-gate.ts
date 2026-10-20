/**
 * Held-out improvement gate (dual-brain plan, step 1).
 *
 * Brain A (the learner) proposes a change to its memory/retrieval settings.
 * Brain B (the metacognitive monitor) checks it in two stages:
 *   1. Dev screen: recall@5 on the dev split must rise by >= epsilon and the
 *      reasoning check must not fall. Failing proposals are rejected here and
 *      never touch held-out.
 *   2. Held-out, once per proposal, counted against a sealed HeldoutBudget:
 *      approve only if the paired-bootstrap 95% CI lower bound of the recall@5
 *      gain is >= epsilon, the exact sign test (discordant queries) gives
 *      one-sided p < alpha / comparisons (Bonferroni), and the reasoning check
 *      does not fall. Two-sided p is reported alongside.
 * Rejected changes roll Brain A back to the checkpoint taken before the change.
 *
 * Labels: recall numbers come from a PROXY split (test titles -> lib module,
 * module-disjoint); the reasoning check is SIMULATION until GSM8K-200 is wired.
 * This measures whether a change helped on held-out data. It makes no claim
 * about awareness or consciousness.
 */
import type { MetacognitionFinding } from "./metacognition-types.js";
import { bm25Scores, cosine, type SearchDoc } from "./hybrid-search.js";

export interface BrainAConfig {
  /** Weight of the vector ranking in reciprocal-rank fusion. */
  vectorWeight: number;
  /** Weight of the BM25 keyword ranking in reciprocal-rank fusion. */
  keywordWeight: number;
  /** RRF constant k. */
  rrfK: number;
  /** Memory-distill rule: characters of each memory kept for retrieval. */
  docChars: number;
}

/** Same behaviour as hybridSearch() today (equal weights, k = 60, full doc). */
export const DEFAULT_BRAIN_A: BrainAConfig = { vectorWeight: 1, keywordWeight: 1, rrfK: 60, docChars: 1500 };

export interface RetrievalQuery { q: string; relevant: string[] }
export interface RetrievalSplit { docs: { id: string; content: string }[]; dev: RetrievalQuery[]; heldout: RetrievalQuery[] }

export interface Proposal { id: string; description: string; apply: (c: BrainAConfig) => BrainAConfig }

/** Per-item reasoning correctness (0..1) for a config and split. GSM8K-200 in production. */
export type ReasoningEval = (c: BrainAConfig, split: "dev" | "heldout") => number[] | Promise<number[]>;

export const RECALL_LABEL = "PROXY: recall@5 on api-server test titles -> named lib module, module-disjoint split (evals/heldout/retrieval)";

/** Sealed counter of held-out evaluations. Every gate stage-2 run spends one. */
export class HeldoutBudget {
  private used = 0;
  constructor(readonly limit: number) {}
  get spent(): number { return this.used; }
  spend(): boolean { if (this.used >= this.limit) return false; this.used++; return true; }
}

export interface GateOptions {
  epsilon?: number;
  alpha?: number;
  /** Number of comparisons for Bonferroni (e.g. dev grid size). */
  comparisons?: number;
  bootstrapIters?: number;
  seed?: number;
  k?: number;
  budget?: HeldoutBudget;
  reasoningLabel?: "SIMULATION" | "TESTED";
  onDecision?: (d: GateDecision) => void;
}

interface Scores { recallAt5: number; reasoning: number }

export interface GateDecision {
  proposal: string;
  description: string;
  verdict: "approved" | "rejected";
  stage: "dev" | "heldout";
  reasons: string[];
  dev: { before: Scores; after: Scores; delta: Scores };
  heldout: null | {
    before: Scores; after: Scores; delta: Scores;
    ci95: [number, number];
    signTest: { gains: number; losses: number; pOneSided: number; pTwoSided: number };
    alphaCorrected: number;
  };
  heldoutEvaluationsSpent: number;
  stats: { test: "exact sign test on discordant queries"; ci: "paired bootstrap percentile"; bootstrapIters: number; seed: number };
  labels: { recall: string; reasoning: "SIMULATION" | "TESTED" };
  config: BrainAConfig;
  finding: MetacognitionFinding;
}

/** Hashed character-trigram embedding, identical to scripts/scorecard/recall_at_k.mjs. */
export function embed(text: string, dim = 256): number[] {
  const v = new Array<number>(dim).fill(0), s = ` ${text.toLowerCase()} `;
  for (let i = 0; i + 3 <= s.length; i++) {
    let h = 2166136261;
    for (const c of s.slice(i, i + 3)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    v[(h >>> 0) % dim] += 1;
  }
  return v;
}

function validConfig(c: BrainAConfig): boolean {
  return [c.vectorWeight, c.keywordWeight, c.rrfK, c.docChars].every((x) => typeof x === "number" && Number.isFinite(x))
    && c.vectorWeight >= 0 && c.keywordWeight >= 0 && c.vectorWeight + c.keywordWeight > 0 && c.rrfK > 0 && c.docChars >= 1;
}

/** Per-query recall@k of Brain A's weighted RRF retrieval. */
export function retrievalRecalls(c: BrainAConfig, docs: RetrievalSplit["docs"], queries: RetrievalQuery[], k = 5): number[] {
  if (!validConfig(c)) return queries.map(() => 0);
  const sd: SearchDoc[] = docs.map((d) => {
    const content = d.content.slice(0, Math.floor(c.docChars));
    return { id: d.id, content, embedding: embed(content) };
  });
  return queries.map((q) => {
    const e = embed(q.q);
    const vec = sd.map((d, i) => ({ i, s: cosine(e, d.embedding) })).sort((a, b) => b.s - a.s);
    const kw = bm25Scores(q.q, sd).map((s, i) => ({ i, s })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const score = new Array<number>(sd.length).fill(0);
    vec.forEach((x, r) => { score[x.i] += c.vectorWeight / (c.rrfK + r + 1); });
    kw.forEach((x, r) => { score[x.i] += c.keywordWeight / (c.rrfK + r + 1); });
    const top = new Set(score.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, k).map((x) => String(sd[x.i].id)));
    return q.relevant.filter((id) => top.has(id)).length / q.relevant.length;
  });
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exact sign test on discordant pairs: P(X >= gains), X ~ Bin(gains+losses, 1/2). */
export function signTest(gains: number, losses: number): { pOneSided: number; pTwoSided: number } {
  const n = gains + losses;
  if (n === 0) return { pOneSided: 1, pTwoSided: 1 };
  const pmf: number[] = [];
  let lp = -n * Math.LN2; // log C(n,0) / 2^n
  for (let x = 0; x <= n; x++) { pmf.push(Math.exp(lp)); lp += Math.log((n - x) / (x + 1)); }
  const upper = pmf.slice(gains).reduce((s, x) => s + x, 0);
  const lower = pmf.slice(0, gains + 1).reduce((s, x) => s + x, 0);
  return { pOneSided: Math.min(1, upper), pTwoSided: Math.min(1, 2 * Math.min(upper, lower)) };
}

/** Paired bootstrap percentile 95% CI of mean(diffs). Deterministic for a seed. */
export function bootstrapCI(diffs: number[], iters = 2000, seed = 1): [number, number] {
  if (!diffs.length) return [0, 0];
  const rnd = mulberry32(seed), means: number[] = [];
  for (let b = 0; b < iters; b++) {
    let s = 0;
    for (let i = 0; i < diffs.length; i++) s += diffs[Math.floor(rnd() * diffs.length)];
    means.push(s / diffs.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * (iters - 1))], means[Math.ceil(0.975 * (iters - 1))]];
}

/** Score every grid config on dev only; returns all scores and the argmax (first on ties). */
export function selectOnDev(grid: BrainAConfig[], split: RetrievalSplit, k = 5) {
  const scores = grid.map((config) => ({ config, dev: r4(mean(retrievalRecalls(config, split.docs, split.dev, k))) }));
  const best = scores.reduce((b, x) => (x.dev > b.dev ? x : b), scores[0]);
  return { scores, best };
}

/** Brain A state holder with checkpoint/rollback. */
export class BrainA {
  private cfg: BrainAConfig;
  private checkpoints: BrainAConfig[] = [];
  constructor(initial: BrainAConfig = DEFAULT_BRAIN_A) { this.cfg = { ...initial }; }
  get config(): BrainAConfig { return { ...this.cfg }; }
  checkpoint(): void { this.checkpoints.push({ ...this.cfg }); }
  set(c: BrainAConfig): void { this.cfg = { ...c }; }
  rollback(): void { const c = this.checkpoints.pop(); if (c) this.cfg = c; }
  commit(): void { this.checkpoints.pop(); }
}

async function score(c: BrainAConfig, split: RetrievalSplit, which: "dev" | "heldout", reasoning: ReasoningEval, k: number) {
  return { rec: retrievalRecalls(c, split.docs, split[which], k), rea: await reasoning(c, which) };
}
const summary = (rec: number[], rea: number[]): Scores => ({ recallAt5: r4(mean(rec)), reasoning: r4(mean(rea)) });
const diff = (a: Scores, b: Scores): Scores => ({ recallAt5: r4(a.recallAt5 - b.recallAt5), reasoning: r4(a.reasoning - b.reasoning) });

/** Brain B: dev screen, then one held-out evaluation; approve or roll back. */
export async function runImprovementGate(
  brainA: BrainA,
  proposal: Proposal,
  split: RetrievalSplit,
  reasoning: ReasoningEval,
  opts: GateOptions = {},
): Promise<GateDecision> {
  const { epsilon = 0.01, alpha = 0.05, comparisons = 1, bootstrapIters = 2000, seed = 1, k = 5, reasoningLabel = "SIMULATION" } = opts;
  const budget = opts.budget ?? new HeldoutBudget(1);
  const before = brainA.config;
  brainA.checkpoint();
  const reasons: string[] = [];
  let after: BrainAConfig = before;
  try { after = proposal.apply({ ...before }); } catch (e) { reasons.push(`proposal threw: ${(e as Error).message}`); }
  if (!validConfig(after)) { reasons.push("invalid config"); after = before; }
  brainA.set(after);

  // Stage 1: dev screen.
  const dB = await score(before, split, "dev", reasoning, k), dA = await score(after, split, "dev", reasoning, k);
  const devB = summary(dB.rec, dB.rea), devA = summary(dA.rec, dA.rea), devD = diff(devA, devB);
  if (!reasons.length) {
    if (devD.recallAt5 < epsilon) reasons.push(`dev recall@${k} gain ${devD.recallAt5} < ${epsilon}`);
    if (devD.reasoning < 0) reasons.push(`dev reasoning fell by ${-devD.reasoning}`);
  }

  // Stage 2: held-out, only for proposals that passed the dev screen.
  let held: GateDecision["heldout"] = null;
  let stage: GateDecision["stage"] = "dev";
  if (!reasons.length) {
    if (!budget.spend()) reasons.push(`held-out budget exhausted (${budget.limit})`);
    else {
      stage = "heldout";
      const hB = await score(before, split, "heldout", reasoning, k), hA = await score(after, split, "heldout", reasoning, k);
      const diffs = hA.rec.map((x, i) => x - hB.rec[i]);
      const gains = diffs.filter((d) => d > 0).length, losses = diffs.filter((d) => d < 0).length;
      const st = signTest(gains, losses);
      const ci = bootstrapCI(diffs, bootstrapIters, seed);
      const alphaC = alpha / comparisons;
      const b = summary(hB.rec, hB.rea), a = summary(hA.rec, hA.rea);
      held = { before: b, after: a, delta: diff(a, b), ci95: [r4(ci[0]), r4(ci[1])],
        signTest: { gains, losses, pOneSided: r4(st.pOneSided), pTwoSided: r4(st.pTwoSided) }, alphaCorrected: r4(alphaC) };
      if (ci[0] < epsilon) reasons.push(`held-out CI lower bound ${r4(ci[0])} < ${epsilon}`);
      if (st.pOneSided >= alphaC) reasons.push(`sign test one-sided p ${r4(st.pOneSided)} >= ${r4(alphaC)} (two-sided ${r4(st.pTwoSided)})`);
      if (a.recallAt5 < b.recallAt5) reasons.push("held-out recall@5 fell");
      if (a.reasoning < b.reasoning) reasons.push(`held-out reasoning fell (${reasoningLabel})`);
    }
  }

  const verdict = reasons.length ? "rejected" : "approved";
  if (verdict === "approved") brainA.commit(); else brainA.rollback();
  const decision: GateDecision = {
    proposal: proposal.id, description: proposal.description, verdict, stage, reasons,
    dev: { before: devB, after: devA, delta: devD }, heldout: held, heldoutEvaluationsSpent: budget.spent,
    stats: { test: "exact sign test on discordant queries", ci: "paired bootstrap percentile", bootstrapIters, seed },
    labels: { recall: RECALL_LABEL, reasoning: reasoningLabel },
    config: brainA.config,
    finding: {
      id: `gate-${proposal.id}`, at: Date.now(), kind: verdict === "approved" ? "healthy" : "drift",
      severity: verdict === "approved" ? "low" : "medium",
      summary: `Improvement gate ${verdict} ${proposal.id} at ${stage} stage`,
      evidence: { dev: devD, heldout: held, reasons },
    },
  };
  opts.onDecision?.(decision);
  return decision;
}
