/**
 * Memory write pipeline: ADD / UPDATE / DELETE / NOOP (REA-03).
 *
 * Idea: mem0 (Apache-2.0, arXiv:2504.19413) — instead of always appending,
 * compare a new fact with similar existing memories and choose an operation.
 * Implemented from scratch with a deterministic decision rule (no LLM), so
 * it is testable; an LLM decider can be plugged in via `decide`.
 */
export type MemoryOp = "ADD" | "UPDATE" | "DELETE" | "NOOP";
export interface MemoryItem { id: string; text: string; updatedAt: number }
export interface WriteDecision { op: MemoryOp; targetId?: string; similarity: number }

const NEG = /\b(not|no|never|isn't|aren't|wasn't|doesn't|don't|false|stopped|removed)\b/i;
const toks = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !NEG.test(t)));

export function similarity(a: string, b: string): number {
  const A = toks(a), B = toks(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface WriterOptions { duplicate?: number; related?: number }

/** Deterministic decider: duplicate → NOOP, related+negation flip → DELETE, related → UPDATE, else ADD. */
export function decideWrite(fact: string, existing: MemoryItem[], opts: WriterOptions = {}): WriteDecision {
  const dup = opts.duplicate ?? 0.9, rel = opts.related ?? 0.5;
  let best: MemoryItem | undefined, bestSim = 0;
  for (const m of existing) { const s = similarity(fact, m.text); if (s > bestSim) { bestSim = s; best = m; } }
  if (!best || bestSim < rel) return { op: "ADD", similarity: bestSim };
  const flipped = NEG.test(fact) !== NEG.test(best.text);
  if (flipped) return { op: "DELETE", targetId: best.id, similarity: bestSim };
  if (bestSim >= dup) return { op: "NOOP", targetId: best.id, similarity: bestSim };
  return { op: "UPDATE", targetId: best.id, similarity: bestSim };
}

/** Applies a decision to an in-memory store; returns the new list. */
export function applyWrite(
  fact: string,
  store: MemoryItem[],
  now = Date.now(),
  decide: (f: string, s: MemoryItem[]) => WriteDecision = decideWrite,
): { store: MemoryItem[]; decision: WriteDecision } {
  const d = decide(fact, store);
  switch (d.op) {
    case "ADD": return { decision: d, store: [...store, { id: `mem-${now.toString(36)}-${store.length}`, text: fact, updatedAt: now }] };
    case "UPDATE": return { decision: d, store: store.map((m) => (m.id === d.targetId ? { ...m, text: fact, updatedAt: now } : m)) };
    case "DELETE": return { decision: d, store: store.filter((m) => m.id !== d.targetId) };
    default: return { decision: d, store };
  }
}
