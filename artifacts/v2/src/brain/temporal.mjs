/**
 * IDEAS-B4 time-indexed memory graph ("full picture over time"). Every node/edge change is an
 * append-only event {t, op, ...}; any past snapshot can be rebuilt, two times can be diffed
 * forward or back, and edge co-occurrence over time windows can be correlated. Pure, no I/O.
 */
export function createTimeline() {
  const ev = []; // sorted by t (stable for ties)
  const push = (e) => { let i = ev.length; while (i > 0 && ev[i - 1].t > e.t) i--; ev.splice(i, 0, e); };
  const key = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  return {
    events: ev,
    addNode(t, name, attrs = {}) { push({ t, op: "node+", name, attrs }); },
    removeNode(t, name) { push({ t, op: "node-", name }); },
    link(t, a, b, w = 1) { push({ t, op: "edge", k: key(a, b), w }); },
    unlink(t, a, b) { push({ t, op: "edge-", k: key(a, b) }); },
    /** State as of time t (inclusive). */
    at(t) {
      const nodes = new Map(); const edges = new Map();
      for (const e of ev) {
        if (e.t > t) break;
        if (e.op === "node+") nodes.set(e.name, { ...(nodes.get(e.name) ?? {}), ...e.attrs });
        else if (e.op === "node-") { nodes.delete(e.name); for (const k of [...edges.keys()]) if (k.split("\u0000").includes(e.name)) edges.delete(k); }
        else if (e.op === "edge") { for (const n of e.k.split("\u0000")) if (!nodes.has(n)) nodes.set(n, {}); edges.set(e.k, (edges.get(e.k) ?? 0) + e.w); }
        else if (e.op === "edge-") edges.delete(e.k);
      }
      return { nodes, edges, syn: new Map() };
    },
    /** What changed between t1 and t2 (works either direction; t2 < t1 gives the reverse diff). */
    diff(t1, t2) {
      const A = this.at(t1), B = this.at(t2); const d = (x, y) => [...x.keys()].filter((k) => !y.has(k));
      const changed = [...B.edges].filter(([k, w]) => A.edges.has(k) && A.edges.get(k) !== w).map(([k]) => k);
      return { nodesAdded: d(B.nodes, A.nodes), nodesRemoved: d(A.nodes, B.nodes), edgesAdded: d(B.edges, A.edges).map((k) => k.split("\u0000")), edgesRemoved: d(A.edges, B.edges).map((k) => k.split("\u0000")), edgesReweighted: changed.map((k) => k.split("\u0000")) };
    },
    /** Pearson correlation of two nodes' activity (edge events touching them) across time bins. */
    correlate(a, b, bin) {
      if (!ev.length) return 0; const t0 = ev[0].t, n = Math.floor((ev[ev.length - 1].t - t0) / bin) + 1;
      const xa = new Array(n).fill(0), xb = new Array(n).fill(0);
      for (const e of ev) if (e.k) { const p = e.k.split("\u0000"); const i = Math.floor((e.t - t0) / bin); if (p.includes(a)) xa[i]++; if (p.includes(b)) xb[i]++; }
      const m = (x) => x.reduce((s, v) => s + v, 0) / n; const ma = m(xa), mb = m(xb);
      let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (xa[i] - ma) * (xb[i] - mb); va += (xa[i] - ma) ** 2; vb += (xb[i] - mb) ** 2; }
      return va && vb ? c / Math.sqrt(va * vb) : 0;
    },
  };
}
