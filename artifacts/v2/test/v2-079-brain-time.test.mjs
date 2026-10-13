import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleBrain } from "../src/brain/http.mjs";
import { loadGraph } from "../src/brain/synapse.mjs";
import { createTimeline } from "../src/brain/temporal.mjs";
import { memoryTimeline, snapshotDiff } from "../src/brain/view.mjs";
const memPath = new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url);
const jsonl = readFileSync(memPath, "utf8");
const lines = jsonl.split("\n");
const mk = () => { const r = { code: 0, body: "", writeHead(c) { r.code = c; }, end(b) { r.body = String(b); } }; return r; };
const get = (path) => { const r = mk(); assert.equal(handleBrain({ method: "GET" }, r, new URL(`http://x${path}`)), true); assert.equal(r.code, 200); return JSON.parse(r.body); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function sameGraph(snap, ref) {
  assert.equal(snap.nodes.length, ref.nodes.size);
  for (const n of snap.nodes) assert.equal(n.type, ref.nodes.get(n.id)?.type);
  assert.equal(snap.edges.length, ref.edges.size);
  for (const e of snap.edges) {
    const k = e.a < e.b ? `${e.a}\0${e.b}` : `${e.b}\0${e.a}`;
    assert.equal(e.w, ref.edges.get(k));
  }
}
test("W3-04 /brain snapshot at t matches loadGraph on the real memory log", () => {
  const page = mk(); handleBrain({ method: "GET" }, page, new URL("http://x/brain"));
  assert.match(page.body, /id="time"/); assert.match(page.body, /id="diffcount"/);
  const js = mk(); handleBrain({ method: "GET" }, js, new URL("http://x/brain.js"));
  assert.match(js.body, /\/brain\/snapshot/); assert.match(js.body, /forward /); assert.match(js.body, /edgesAdded/);
  const end = get("/brain/snapshot");
  assert.ok(end.events > 100); assert.equal(end.t, end.events - 1); assert.equal(end.diff.forward, 0); assert.equal(end.diff.back, 0);
  const idxs = [...new Set([0, 1, Math.floor(end.events / 4), Math.floor(end.events / 2), Math.floor(end.events * 3 / 4), end.events - 1])];
  for (const t of idxs) {
    const snap = get(`/brain/snapshot?t=${t}`);
    assert.equal(snap.t, t);
    sameGraph(snap, loadGraph(lines.slice(0, snap.line + 1).join("\n")));
  }
  const built = memoryTimeline(jsonl);
  for (const [a, b] of [[0, end.events - 1], [end.events - 1, 0], [1, Math.floor(end.events / 2)]]) {
    const live = built.timeline.diff(built.index[a], built.index[b]);
    const cached = snapshotDiff(built.snaps[a], built.snaps[b]);
    assert.deepEqual(cached.edgesAdded, live.edgesAdded);
    assert.deepEqual(cached.edgesRemoved, live.edgesRemoved);
    assert.deepEqual(cached.nodesAdded, live.nodesAdded);
    assert.deepEqual(cached.nodesRemoved, live.nodesRemoved);
  }
  const span = get(`/brain/snapshot?t=${end.events - 1}&prev=0`);
  const back = get(`/brain/snapshot?t=0&prev=${end.events - 1}`);
  assert.ok(span.diff.forward > 0); assert.equal(span.diff.back, 0);
  assert.equal(span.diff.forward, back.diff.back); assert.equal(span.diff.back, back.diff.forward);
  assert.equal(span.diff.edgesAdded.length, back.diff.edgesRemoved.length);
  assert.equal(span.diff.edgesRemoved.length, 0);
  const full = loadGraph(jsonl);
  sameGraph(end, full);
});
test("W3-04 snapshot p95 on the full memory log stays under 50ms and beats a rebuild", () => {
  const end = get("/brain/snapshot");
  const step = Math.max(1, Math.floor(end.events / 24));
  const samples = [];
  for (let t = 0; t < end.events; t += step) samples.push([t, Math.max(0, t - step * 4)]);
  const time = (fn) => { const a = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - a) / 1e6; };
  const index = memoryTimeline(jsonl).index;
  const rebuild = (t, prev) => {
    const T = createTimeline();
    lines.forEach((line, i) => {
      if (!line.trim()) return; let r; try { r = JSON.parse(line); } catch { return; }
      if (r.type === "entity" && r.name) T.addNode(i, r.name, { type: r.entityType });
      else if (r.type === "relation" && r.from && r.to && r.from !== r.to) T.link(i, r.from, r.to, 1);
    });
    const s = T.at(index[t]); const d = T.diff(index[prev], index[t]);
    JSON.stringify({ nodes: s.nodes.size, edges: s.edges.size, forward: d.edgesAdded.length, back: d.edgesRemoved.length });
  };
  for (const [t, prev] of samples) { rebuild(t, prev); get(`/brain/snapshot?t=${t}&prev=${prev}`); }
  const before = samples.map(([t, prev]) => time(() => rebuild(t, prev)));
  const after = samples.map(([t, prev]) => time(() => get(`/brain/snapshot?t=${t}&prev=${prev}`)));
  const beforeP95 = pct(before, 0.95), afterP95 = pct(after, 0.95);
  assert.ok(afterP95 < 50, `snapshot p95 ${afterP95}ms`);
  assert.ok(afterP95 < beforeP95, `cached p95 ${afterP95}ms did not beat rebuild p95 ${beforeP95}ms`);
});
