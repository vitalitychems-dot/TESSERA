/**
 * v3 crystal memory: an append-only, content-addressed log of the memory graph with five axes
 * per fact: x, y, z (3D layout), t (log line where the fact first appeared) and v (measured
 * value: how many source lines asserted it). Every cell keeps the source path:line it came from.
 * Cells: {h,t,k:"n",id,ty,obs,src} node | {h,t,k:"e",a,b,rt,src} edge | {t,k:"v",ref,src} repeat
 * of an existing fact | {k:"p",id,p} layout. h = first 16 hex of sha256 over the fact content,
 * so identical facts are stored once and repeats only bump v. Pure except for node:crypto.
 */
import { createHash } from "node:crypto";
import { layout3d } from "../../v2/src/brain/view.mjs";
const H = (o) => createHash("sha256").update(JSON.stringify(o)).digest("hex").slice(0, 16);
const K = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
export function factOf(r) {
  if (r?.type === "entity" && r.name) return { k: "n", id: r.name, ty: r.entityType ?? "unknown", obs: r.observations ?? [] };
  if (r?.type === "relation" && r.from && r.to && r.from !== r.to) return { k: "e", a: r.from, b: r.to, rt: r.relationType ?? "" };
  return null;
}
/** Build cells from an MCP-memory JSONL string. layoutIters=0 skips the 3D layer. */
export function buildCrystal(jsonl, { source = "memory.jsonl", layoutIters = 60 } = {}) {
  const cells = []; const seen = new Set();
  String(jsonl).split("\n").forEach((line, t) => {
    if (!line.trim()) return; let r; try { r = JSON.parse(line); } catch { return; }
    const f = factOf(r); if (!f) return; const h = H(f); const src = `${source}:${t + 1}`;
    if (seen.has(h)) cells.push({ t, k: "v", ref: h, src }); else { seen.add(h); cells.push({ h, t, ...f, src }); }
  });
  if (layoutIters) {
    const g = graphAt(cells, Infinity); const ids = [...g.nodes.keys()];
    const pos = layout3d(ids, [...g.edges].map(([k, w]) => [...k.split("\u0000"), w]), { iters: layoutIters });
    ids.forEach((id, i) => cells.push({ k: "p", id, p: pos[i] }));
  }
  return cells;
}
/** Compact on-disk rows (src stored once when it is source:line(t+1)): one JSON array per line. */
export function serialize(cells) {
  const s0 = cells.find((c) => c.src)?.src.replace(/:\d+$/, "") ?? ""; const d = (c) => (c.src === `${s0}:${c.t + 1}` ? 0 : c.src);
  const row = (c) => c.k === "n" ? ["n", c.h, c.t, c.id, c.ty, c.obs, d(c)] : c.k === "e" ? ["e", c.h, c.t, c.a, c.b, c.rt, d(c)] : c.k === "v" ? ["v", c.ref, c.t, d(c)] : ["p", c.id, c.p];
  return [JSON.stringify({ crystal: 1, source: s0 }), ...cells.map((c) => JSON.stringify(row(c)))].join("\n") + "\n";
}
export function parse(text) {
  const L = String(text).split("\n"); const s0 = JSON.parse(L[0]).source; const out = [];
  for (let i = 1; i < L.length; i++) { if (!L[i]) continue; const r = JSON.parse(L[i]); const S = (x, t) => (x === 0 ? `${s0}:${t + 1}` : x);
    out.push(r[0] === "n" ? { h: r[1], t: r[2], k: "n", id: r[3], ty: r[4], obs: r[5], src: S(r[6], r[2]) } : r[0] === "e" ? { h: r[1], t: r[2], k: "e", a: r[3], b: r[4], rt: r[5], src: S(r[6], r[2]) } : r[0] === "v" ? { t: r[2], k: "v", ref: r[1], src: S(r[3], r[2]) } : { k: "p", id: r[1], p: r[2] }); }
  return out;
}
/** Append only: new cells must not rewrite existing hashes; returns cells to append. */
export function appendCells(cells, jsonl, opts = {}) {
  const have = new Set(cells.filter((c) => c.h).map((c) => c.h)); const t0 = Math.max(-1, ...cells.filter((c) => c.t != null).map((c) => c.t)) + 1;
  return buildCrystal(jsonl, { ...opts, layoutIters: 0 }).map((c) => {
    const t = c.t + t0; if (c.h && have.has(c.h)) return { t, k: "v", ref: c.h, src: c.src.replace(/:\d+$/, `:${t + 1}`) };
    if (c.h) have.add(c.h); return { ...c, t, src: c.src.replace(/:\d+$/, `:${t + 1}`) };
  });
}
/** Integrity: every fact cell's h must equal the hash of its content. */
export function verify(cells) {
  let bad = 0; for (const c of cells) if (c.h) { const { h, t, src, ...f } = c; if (H(f) !== h) bad++; } return bad;
}
/** Graph (same shape as v2 loadGraph) from cells with t <= T; v counts repeats per fact. */
export function graphAt(cells, T = Infinity) {
  const nodes = new Map(); const edges = new Map(); const byH = new Map(); const val = new Map(); const src = new Map();
  const node = (n) => { if (!nodes.has(n)) nodes.set(n, { type: "unknown", obs: 0, text: n.toLowerCase() }); };
  for (const c of cells) {
    if (c.t == null || c.t > T) continue;
    const f = c.k === "v" ? byH.get(c.ref) : c; if (!f) continue; if (c.h) byH.set(c.h, c);
    const h = c.h ?? c.ref; val.set(h, (val.get(h) ?? 0) + 1); if (!src.has(h)) src.set(h, c.src);
    if (f.k === "n") nodes.set(f.id, { type: f.ty, obs: f.obs.length, text: `${f.id} ${f.obs.join(" ")}`.toLowerCase() });
    else if (f.k === "e") { node(f.a); node(f.b); const k = K(f.a, f.b); edges.set(k, (edges.get(k) ?? 0) + 1); }
  }
  return { nodes, edges, syn: new Map(), byH, val, src };
}
export const positions = (cells) => new Map(cells.filter((c) => c.k === "p").map((c) => [c.id, c.p]));
/** Same response shape as v2 replayAt (GET /brain/snapshot), plus p (x,y,z), v and src per item. */
export function crystalSnapshot(cells, eventIndex, prevIndex) {
  const ts = [...new Set(cells.filter((c) => c.t != null).map((c) => c.t))].sort((a, b) => a - b); const n = ts.length;
  const cl = (v, d) => { const x = Number(v); return v == null || v === "" || !Number.isFinite(x) ? d : Math.max(0, Math.min(n - 1, Math.trunc(x))); };
  if (!n) return { t: 0, line: -1, events: 0, nodes: [], edges: [], diff: { from: 0, to: 0, forward: 0, back: 0, edgesAdded: [], edgesRemoved: [], nodesAdded: [], nodesRemoved: [] } };
  const i = cl(eventIndex, n - 1), p = cl(prevIndex, i); const P = positions(cells);
  const S = graphAt(cells, ts[i]); const A = i === p ? S : graphAt(cells, ts[p]);
  const nh = new Map(), eh = new Map(); for (const [h, c] of S.byH) (c.k === "n" ? nh.set(c.id, h) : eh.set(K(c.a, c.b), h));
  const miss = (x, y) => [...x.keys()].filter((k) => !y.has(k));
  const eA = miss(S.edges, A.edges).map((k) => k.split("\u0000")), eR = miss(A.edges, S.edges).map((k) => k.split("\u0000"));
  const nA = miss(S.nodes, A.nodes), nR = miss(A.nodes, S.nodes);
  return {
    t: i, line: ts[i], events: n,
    nodes: [...S.nodes].map(([id, a]) => ({ id, type: a.type ?? "unknown", p: P.get(id) ?? null, v: S.val.get(nh.get(id)) ?? 0, src: S.src.get(nh.get(id)) ?? null })),
    edges: [...S.edges].map(([k, w]) => { const [a, b] = k.split("\u0000"); const h = eh.get(k); return { a, b, w, v: S.val.get(h) ?? w, src: S.src.get(h) ?? null }; }),
    diff: { from: p, to: i, forward: nA.length + eA.length, back: nR.length + eR.length, edgesAdded: eA, edgesRemoved: eR, nodesAdded: nA, nodesRemoved: nR },
  };
}
