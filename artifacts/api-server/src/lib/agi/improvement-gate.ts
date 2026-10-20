/**
 * Held-out improvement gate (dual-brain plan, step 1).
 *
 * Brain A (the learner) proposes a change to its memory/retrieval settings.
 * Brain B (the metacognitive monitor) scores the frozen held-out split before
 * and after the change and approves it only when:
 *   - held-out recall@5 rises by at least `epsilon`,
 *   - a seeded paired bootstrap gives one-sided p < `alpha` for that gain,
 *   - no guardrail drops: mean recall@5 and the reasoning score do not fall
 *     (optionally also cap per-query recall losses with `maxQueryLosses`)
 * Anything else is rejected and Brain A is rolled back to the checkpoint taken
 * before the change. Every decision is returned and passed to `onDecision`.
 *
 * Scope: this measures whether a change helped on held-out data. It makes no
 * claim about awareness or consciousness.
 */
import type { MetacognitionFinding } from "./metacognition-types.js";
import { bm25Scores, cosine, type SearchDoc } from "./hybrid-search.js";

/** Brain A's tunable memory/learning state. */
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

export interface Proposal {
  id: string;
  description: string;
  apply: (c: BrainAConfig) => BrainAConfig;
}

/** Per-item reasoning correctness (0..1) for a config. GSM8K-200 in production. */
export type ReasoningEval = (c: BrainAConfig) => number[] | Promise<number[]>;

export interface GateOptions {
  epsilon?: number;
  alpha?: number;
  maxQueryLosses?: number;
  bootstrapIters?: number;
  seed?: number;
  k?: number;
  onDecision?: (d: GateDecision) => void;
}

export interface GateDecision {
  proposal: string;
  description: string;
  verdict: "approved" | "rejected";
  reasons: string[];
  before: { recallAt5: number; reasoning: number };
  after: { recallAt5: number; reasoning: number };
  delta: { recallAt5: number; reasoning: number };
  pValue: number;
  queryGains: number;
  queryLosses: number;
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

/** One-sided paired bootstrap p-value for mean(diffs) > 0. Deterministic for a seed. */
export function pairedBootstrapP(diffs: number[], iters = 2000, seed = 1): number {
  if (!diffs.length) return 1;
  const rnd = mulberry32(seed);
  let notBetter = 0;
  for (let b = 0; b < iters; b++) {
    let s = 0;
    for (let i = 0; i < diffs.length; i++) s += diffs[Math.floor(rnd() * diffs.length)];
    if (s <= 0) notBetter++;
  }
  return (notBetter + 1) / (iters + 1);
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

/** Brain B: score a proposal before/after on held-out and approve or roll back. */
export async function runImprovementGate(
  brainA: BrainA,
  proposal: Proposal,
  split: RetrievalSplit,
  reasoning: ReasoningEval,
  opts: GateOptions = {},
): Promise<GateDecision> {
  const { epsilon = 0.01, alpha = 0.05, maxQueryLosses = Number.POSITIVE_INFINITY, bootstrapIters = 2000, seed = 1, k = 5 } = opts;
  const before = brainA.config;
  const recB = retrievalRecalls(before, split.docs, split.heldout, k);
  const reaB = await reasoning(before);

  brainA.checkpoint();
  const reasons: string[] = [];
  let after: BrainAConfig;
  try {
    after = proposal.apply({ ...before });
  } catch (e) {
    after = before;
    reasons.push(`proposal threw: ${(e as Error).message}`);
  }
  if (!validConfig(after)) reasons.push("invalid config");
  brainA.set(after);
  const recA = retrievalRecalls(after, split.docs, split.heldout, k);
  const reaA = await reasoning(after);

  const diffs = recA.map((x, i) => x - recB[i]);
  const dRec = mean(recA) - mean(recB);
  const dRea = mean(reaA) - mean(reaB);
  const gains = diffs.filter((d) => d > 0).length, losses = diffs.filter((d) => d < 0).length;
  const p = pairedBootstrapP(diffs, bootstrapIters, seed);
  if (dRec < epsilon) reasons.push(`recall@${k} gain ${r4(dRec)} < epsilon ${epsilon}`);
  if (p >= alpha) reasons.push(`bootstrap p ${r4(p)} >= ${alpha}`);
  if (losses > maxQueryLosses) reasons.push(`recall@${k} regressed on ${losses} held-out queries`);
  if (dRea < 0 || reaA.length !== reaB.length) reasons.push(`reasoning score fell by ${r4(-dRea)}`);

  const verdict = reasons.length ? "rejected" : "approved";
  if (verdict === "approved") brainA.commit(); else brainA.rollback();
  const decision: GateDecision = {
    proposal: proposal.id, description: proposal.description, verdict, reasons,
    before: { recallAt5: r4(mean(recB)), reasoning: r4(mean(reaB)) },
    after: { recallAt5: r4(mean(recA)), reasoning: r4(mean(reaA)) },
    delta: { recallAt5: r4(dRec), reasoning: r4(dRea) },
    pValue: r4(p), queryGains: gains, queryLosses: losses, config: brainA.config,
    finding: {
      id: `gate-${proposal.id}`, at: Date.now(), kind: verdict === "approved" ? "healthy" : "drift",
      severity: verdict === "approved" ? "low" : "medium",
      summary: `Improvement gate ${verdict} ${proposal.id}: recall@${k} ${r4(mean(recB))} -> ${r4(mean(recA))}`,
      evidence: { delta: r4(dRec), pValue: r4(p), reasons },
    },
  };
  opts.onDecision?.(decision);
  return decision;
}
