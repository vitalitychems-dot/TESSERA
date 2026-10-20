/**
 * Reflection loop (REA-05).
 *
 * Idea: Generative Agents (Park et al. 2023, Apache-2.0) — retrieve memories
 * scored by recency + importance + relevance; once accumulated importance
 * crosses a threshold, synthesize higher-level insights and store them back.
 * Implemented from scratch; deterministic summarizer by default (pluggable).
 */
import { recentObservations, assertHypothesis, type Observation } from "./working-memory.js";

export interface ScoredMemory { id: string; text: string; at: number; importance: number }

export function retrievalScore(m: ScoredMemory, now: number, relevance: number, halfLifeMs = 3_600_000): number {
  const recency = Math.pow(0.5, Math.max(0, now - m.at) / halfLifeMs);
  return recency + m.importance + relevance; // each in [0,1], equal weights as in the paper
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "are", "was", "has"]);
function keywords(texts: string[], k: number): string[] {
  const c = new Map<string, number>();
  for (const t of texts) for (const w of new Set(t.toLowerCase().split(/\W+/))) if (w.length > 3 && !STOP.has(w)) c.set(w, (c.get(w) ?? 0) + 1);
  return [...c.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map(([w]) => w);
}

export type Summarizer = (mems: ScoredMemory[]) => string[];

/** Default: one insight per recurring theme across the top memories. */
export const themeSummarizer: Summarizer = (mems) =>
  keywords(mems.map((m) => m.text), 3).map((w) => `Recurring theme "${w}" across ${mems.filter((m) => m.text.toLowerCase().includes(w)).length} recent memories`);

export function reflect(mems: ScoredMemory[], opts: { now?: number; threshold?: number; topK?: number; summarize?: Summarizer } = {}): string[] {
  const now = opts.now ?? Date.now();
  const total = mems.reduce((s, m) => s + m.importance, 0);
  if (total < (opts.threshold ?? 3)) return [];
  const top = [...mems].sort((a, b) => retrievalScore(b, now, 0) - retrievalScore(a, now, 0)).slice(0, opts.topK ?? 30);
  return (opts.summarize ?? themeSummarizer)(top);
}

/** #19: every reflection insight is also logged as a memory event. */
export interface ReflectionMemoryEvent { id: string; kind: "reflection"; text: string; at: number; sourceIds: string[] }
const reflectionEvents: ReflectionMemoryEvent[] = [];
export const MAX_REFLECTION_EVENTS = 1000;
let reflectionTickSeq = 0;
export function recentReflectionEvents(limit = 100): ReflectionMemoryEvent[] { return reflectionEvents.slice(-limit); }
export function reflectionsSince(since: number): number { return reflectionEvents.filter((e) => e.at >= since).length; }
export function clearReflectionEvents(): void { reflectionEvents.length = 0; reflectionTickSeq = 0; }

/** Wires reflection to working memory: observations in, hypotheses out. */
export function runReflectionTick(now = Date.now()): string[] {
  const obs: Observation[] = recentObservations(100);
  const mems = obs.map((o) => ({ id: o.id, text: `${o.topic} ${JSON.stringify(o.payload).slice(0, 300)}`, at: o.at, importance: o.novelty }));
  const insights = reflect(mems, { now });
  const sourceIds = mems.slice(0, 10).map((m) => m.id);
  const tickSeq = reflectionTickSeq++;
  insights.forEach((i, idx) => {
    assertHypothesis(i, 0.6, ["reflection"], sourceIds);
    reflectionEvents.push({ id: `refl-${now}-${tickSeq}-${idx}`, kind: "reflection", text: i, at: now, sourceIds });
    if (reflectionEvents.length > MAX_REFLECTION_EVENTS) reflectionEvents.shift();
  });
  return insights;
}
