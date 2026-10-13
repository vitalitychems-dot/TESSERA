import { sha256 } from "./identity.js";

/** Small seeded PRNG so every run with the same seed is byte-for-byte replayable. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tick-based radio world. A packet sent in tick t is heard in tick t+1 by every
 * node within `range` of the sender at send time (unicast: only the addressee),
 * minus random loss. No sockets, no real radio: this checks protocol logic, not RF.
 */
export class Sim {
  constructor({ seed = 1, range = 1.5, loss = 0 } = {}) {
    this.rand = mulberry32(seed);
    this.range = range;
    this.loss = loss;
    this.t = 0;
    this.entries = [];
    this.inflight = [];
    this.logParts = [];
    this.sent = {};
    this.heard = {};
  }

  add(node, mover) {
    const entry = { node, mover, pos: mover(0), agents: [] };
    this.entries.push(entry);
    this.entries.sort((a, b) => (a.node.id < b.node.id ? -1 : 1));
    return entry;
  }

  entryOf(node) {
    return this.entries.find((e) => e.node === node);
  }

  inRange(a, b) {
    return Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) <= this.range;
  }

  connected(nodeA, nodeB) {
    return this.inRange(this.entryOf(nodeA), this.entryOf(nodeB));
  }

  step(hooks = {}) {
    const t = ++this.t;
    for (const e of this.entries) e.pos = e.mover(t);

    const arriving = this.inflight;
    this.inflight = [];
    for (const { to, from, pkt } of arriving) {
      const target = this.entries.find((e) => e.node.id === to);
      if (!target) continue;
      this.heard[pkt.kind] = (this.heard[pkt.kind] ?? 0) + 1;
      this.logParts.push(`${t}>${to.slice(0, 6)}<${from.slice(0, 6)}:${pkt.kind}`);
      target.node.receive(pkt, from, t);
    }

    hooks.beforeTick?.(t, this);
    for (const e of this.entries) {
      e.node.tick(t);
      for (const agent of e.agents) agent.step(t);
    }
    hooks.afterTick?.(t, this);

    for (const sender of this.entries) {
      const out = sender.node.outbox;
      sender.node.outbox = [];
      for (const { to, pkt } of out) {
        this.sent[pkt.kind] = (this.sent[pkt.kind] ?? 0) + 1;
        for (const rx of this.entries) {
          if (rx === sender || (to !== null && rx.node.id !== to)) continue;
          if (!this.inRange(sender, rx)) continue;
          if (this.loss > 0 && this.rand() < this.loss) continue;
          this.inflight.push({ to: rx.node.id, from: sender.node.id, pkt: JSON.parse(JSON.stringify(pkt)) });
        }
      }
    }
  }

  run(ticks, hooks) {
    for (let i = 0; i < ticks; i++) this.step(hooks);
  }

  /** Hash of every delivery in order. Equal hashes mean identical runs. */
  traceHash() {
    return sha256(this.logParts.join("|"));
  }
}

export const fixed = (x, y = 0) => () => ({ x, y });

/** Piecewise-linear path through [t, x, y] waypoints; holds the last point after the final time. */
export function path(points) {
  return (t) => {
    if (t <= points[0][0]) return { x: points[0][1], y: points[0][2] };
    for (let i = 1; i < points.length; i++) {
      const [t0, x0, y0] = points[i - 1];
      const [t1, x1, y1] = points[i];
      if (t <= t1) {
        const k = (t - t0) / (t1 - t0);
        return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k };
      }
    }
    const last = points[points.length - 1];
    return { x: last[1], y: last[2] };
  };
}
