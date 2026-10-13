/**
 * Hebbian co-activation links between memories (REA-09).
 *
 * Concept only: "cells that fire together wire together" (Hebb, 1949) with
 * exponential decay of unused links. Written from scratch for TESSERA; no
 * code was read from or copied out of any AGPL project (BindsNET, Hillock).
 *
 * When a set of memories is retrieved together, every pair's weight moves
 * toward 1 by `rate`. Weights decay toward 0 with a half-life and are pruned
 * below `minWeight`. `associates()` gives spreading-activation neighbours
 * that retrieval can use to pull related memories.
 */
export interface HebbianOptions { rate?: number; halfLifeMs?: number; minWeight?: number; maxEdges?: number }
interface Edge { w: number; t: number }

const key = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

export class HebbianGraph {
  private edges = new Map<string, Edge>();
  private readonly rate: number;
  private readonly halfLife: number;
  private readonly minW: number;
  private readonly maxEdges: number;

  constructor(o: HebbianOptions = {}) {
    this.rate = o.rate ?? 0.2;
    this.halfLife = o.halfLifeMs ?? 7 * 24 * 3_600_000;
    this.minW = o.minWeight ?? 0.01;
    this.maxEdges = o.maxEdges ?? 50_000;
  }

  private decayed(e: Edge, now: number): number {
    return e.w * Math.pow(0.5, Math.max(0, now - e.t) / this.halfLife);
  }

  /** Strengthen all pairs in a co-retrieved set. */
  coActivate(ids: string[], now = Date.now()): void {
    const u = [...new Set(ids)];
    for (let i = 0; i < u.length; i++)
      for (let j = i + 1; j < u.length; j++) {
        const k = key(u[i], u[j]);
        const e = this.edges.get(k);
        const w = e ? this.decayed(e, now) : 0;
        this.edges.set(k, { w: w + this.rate * (1 - w), t: now });
      }
    if (this.edges.size > this.maxEdges) this.prune(now);
  }

  weight(a: string, b: string, now = Date.now()): number {
    const e = this.edges.get(key(a, b));
    return e ? this.decayed(e, now) : 0;
  }

  /** Neighbours of `id`, strongest first. */
  associates(id: string, k = 5, now = Date.now()): Array<{ id: string; weight: number }> {
    const out: Array<{ id: string; weight: number }> = [];
    for (const [kk, e] of this.edges) {
      const [a, b] = kk.split("\u0000");
      if (a !== id && b !== id) continue;
      const w = this.decayed(e, now);
      if (w >= this.minW) out.push({ id: a === id ? b : a, weight: w });
    }
    return out.sort((x, y) => y.weight - x.weight).slice(0, k);
  }

  /** Drop links that decayed below minWeight; returns how many were removed. */
  prune(now = Date.now()): number {
    let n = 0;
    for (const [k, e] of this.edges) if (this.decayed(e, now) < this.minW) { this.edges.delete(k); n++; }
    return n;
  }

  get size(): number { return this.edges.size; }
}
