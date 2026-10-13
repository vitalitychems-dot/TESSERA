import * as THREE from "/vendor/three.module.js";
const canvas = document.querySelector("#brain-3d");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05060a); scene.fog = new THREE.FogExp2(0x05060a, 0.012);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500); camera.position.set(0, 10, 60);
const root = new THREE.Group(); scene.add(root);
const stat = document.querySelector("#stat"), info = document.querySelector("#info"), sel = document.querySelector("#src");
const replay = document.querySelector("#replay"), time = document.querySelector("#time"), timeLabel = document.querySelector("#timelabel"), diffCount = document.querySelector("#diffcount");
let idx = new Map(), lines = null, edgeIndex = new Map(), pulses = [], baseCol = null, nodePos = [];
let nodeIds = [], nodeBase = null, nodeColor = null, edgeKeys = [], edgeKinds = [], origEdge = null;
let shown = null, scrubSeq = 0, loadSeq = 0, replayLive = true;
const ADDED = [0.25, 1, 0.55], REMOVED = [1, 0.32, 0.22], HIDDEN = [0, 0, 0];
const edgeKey = (a, b) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 360) / 360; };
function clearPulses() { for (const p of pulses) root.remove(p.m); pulses = []; }
function labelSnap(snap) {
  if (timeLabel) timeLabel.textContent = snap.events ? `${snap.t + 1} / ${snap.events}` : "0 / 0";
  if (diffCount) diffCount.textContent = `forward ${snap.diff.forward} · back ${snap.diff.back}`;
  document.body.dataset.replay = String(snap.t);
  document.body.dataset.forward = String(snap.diff.forward);
  document.body.dataset.back = String(snap.diff.back);
}
/** Show the snapshot: edges added since the previous index glow, edges removed stay lit in red. */
function paintSnap(snap) {
  if (!lines || !nodeColor || !origEdge) return;
  const atEnd = snap.events > 0 && snap.t === snap.events - 1;
  const presentN = new Set(snap.nodes.map((n) => n.id));
  const presentE = new Set(snap.edges.map((e) => edgeKey(e.a, e.b)));
  const addedE = new Set(snap.diff.edgesAdded.map(([a, b]) => edgeKey(a, b)));
  const removedE = new Set(snap.diff.edgesRemoved.map(([a, b]) => edgeKey(a, b)));
  const addedN = new Set(snap.diff.nodesAdded);
  const removedN = new Set(snap.diff.nodesRemoved);
  for (const [a, b] of snap.diff.edgesRemoved) { removedN.add(a); removedN.add(b); }
  const EC = lines.geometry.attributes.color.array;
  for (let i = 0; i < edgeKeys.length; i++) {
    const k = edgeKeys[i]; let rgb;
    if (addedE.has(k)) rgb = ADDED;
    else if (removedE.has(k)) rgb = REMOVED;
    else if (presentE.has(k) || (atEnd && edgeKinds[i] === "synapse")) rgb = origEdge.subarray(i * 6, i * 6 + 3);
    else rgb = HIDDEN;
    EC.set(rgb, i * 6); EC.set(rgb, i * 6 + 3);
  }
  baseCol = EC.slice(); lines.geometry.attributes.color.needsUpdate = true;
  const NC = nodeColor.array;
  for (let i = 0; i < nodeIds.length; i++) {
    const id = nodeIds[i]; let rgb;
    if (addedN.has(id)) rgb = [Math.min(1, nodeBase[i * 3] + 0.4), Math.min(1, nodeBase[i * 3 + 1] + 0.4), Math.min(1, nodeBase[i * 3 + 2] + 0.4)];
    else if (presentN.has(id) || atEnd) rgb = nodeBase.subarray(i * 3, i * 3 + 3);
    else if (removedN.has(id)) rgb = REMOVED;
    else rgb = HIDDEN;
    NC.set(rgb, i * 3);
  }
  nodeColor.needsUpdate = true;
  replayLive = atEnd;
  if (!replayLive) clearPulses();
}
async function scrubTo(t) {
  const seq = ++scrubSeq; const prev = shown ?? t;
  const snap = await (await fetch(`/brain/snapshot?t=${t}&prev=${prev}`)).json();
  if (seq !== scrubSeq) return;
  paintSnap(snap); shown = snap.t; labelSnap(snap);
}
async function load(src) {
  const seq = ++loadSeq; root.clear(); pulses = []; edgeIndex = new Map(); edgeKeys = []; edgeKinds = []; shown = null; replayLive = true;
  const g = await (await fetch(`/brain/graph?src=${src}`)).json();
  if (seq !== loadSeq) return;
  idx = new Map(g.nodes.map((n, i) => [n.id, i])); nodePos = g.nodes.map((n) => n.p); nodeIds = g.nodes.map((n) => n.id);
  const P = new Float32Array(g.nodes.length * 3), C = new Float32Array(g.nodes.length * 3), col = new THREE.Color();
  g.nodes.forEach((n, i) => { P.set(n.p, i * 3); col.setHSL(hue(n.group), 0.75, 0.6); C.set([col.r, col.g, col.b], i * 3); });
  nodeBase = C.slice();
  const ng = new THREE.BufferGeometry(); ng.setAttribute("position", new THREE.BufferAttribute(P, 3)); ng.setAttribute("color", new THREE.BufferAttribute(C, 3));
  nodeColor = ng.getAttribute("color");
  root.add(new THREE.Points(ng, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
  const E = g.edges.filter((e) => idx.has(e.a) && idx.has(e.b)); const maxW = Math.max(...E.map((e) => e.w), 1);
  const LP = new Float32Array(E.length * 6), LC = new Float32Array(E.length * 6);
  E.forEach((e, i) => {
    LP.set(g.nodes[idx.get(e.a)].p, i * 6); LP.set(g.nodes[idx.get(e.b)].p, i * 6 + 3);
    const b = 0.08 + 0.9 * (e.w / maxW);
    if (e.sign < 0) col.setRGB(b, 0.15 * b, 0.3 * b); else if (e.kind === "synapse") col.setRGB(0.3 * b, 0.8 * b, b); else col.setRGB(0.5 * b, 0.5 * b, 0.6 * b);
    LC.set([col.r, col.g, col.b, col.r, col.g, col.b], i * 6); edgeIndex.set(e.a + "\0" + e.b, i); edgeIndex.set(e.b + "\0" + e.a, i);
    edgeKeys.push(edgeKey(e.a, e.b)); edgeKinds.push(e.kind);
  });
  origEdge = LC.slice();
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(LP, 3)); lg.setAttribute("color", new THREE.BufferAttribute(LC, 3));
  baseCol = LC.slice(); lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(lines);
  const ext = Math.max(10, ...g.nodes.flatMap((n) => n.p.map(Math.abs))); camera.position.set(0, ext * 0.25, ext * 2.1); camera.lookAt(0, 0, 0);
  stat.textContent = `${g.nodes.length} nodes · ${E.length} edges${g.modules ? ` · ${g.modules} modules` : ""}`; info.textContent = g.license ?? "";
  document.body.dataset.ready = src; document.body.dataset.nodes = g.nodes.length; document.body.dataset.edges = E.length;
  if (src === "memory" && time) {
    replay.hidden = false;
    const snap = await (await fetch("/brain/snapshot")).json();
    if (seq !== loadSeq) return;
    time.max = String(Math.max(0, snap.events - 1)); time.value = String(snap.t); shown = snap.t; labelSnap(snap);
  } else if (replay) replay.hidden = true;
}
const sphere = new THREE.SphereGeometry(0.35, 8, 8);
function pulse(a, b, w) {
  const i = idx.get(a), j = idx.get(b); if (i == null || j == null) return;
  const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, blending: THREE.AdditiveBlending }));
  root.add(m); pulses.push({ m, from: nodePos[i], to: nodePos[j], t: 0, e: edgeIndex.get(a + "\0" + b), w });
}
async function learn() {
  if (!replayLive) return;
  if (sel.value === "memory") { const s = await (await fetch("/brain/learn?n=3")).json(); for (const [a, b, w] of s.fired.slice(0, 30)) pulse(a, b, w); document.body.dataset.fired = Number(document.body.dataset.fired ?? 0) + s.fired.length; }
  else { const keys = [...edgeIndex.keys()]; for (let k = 0; k < 12 && keys.length; k++) { const [a, b] = keys[(Math.random() * keys.length) | 0].split("\0"); pulse(a, b, 1); } }
}
setInterval(learn, 400);
sel.onchange = () => load(sel.value);
time?.addEventListener("input", () => { scrubTo(Number(time.value)); });
const q = new URLSearchParams(location.search).get("src"); if (q) sel.value = q;
await load(sel.value);
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = (now - last) / 1000; last = now; root.rotation.y += dt * 0.15; root.rotation.x = Math.sin(now / 9000) * 0.2;
  const C = lines?.geometry.attributes.color;
  for (const p of pulses) {
    p.t += dt * 1.5; const u = Math.min(1, p.t); p.m.position.set(...p.from.map((v, k) => v + (p.to[k] - v) * u)); p.m.material.opacity = 1 - u * 0.6;
    if (C && p.e != null && baseCol) for (let k = 0; k < 6; k++) C.array[p.e * 6 + k] = Math.min(1, baseCol[p.e * 6 + k] + (1 - u));
  }
  for (const p of pulses.filter((p) => p.t >= 1)) { root.remove(p.m); if (C && p.e != null && baseCol) for (let k = 0; k < 6; k++) C.array[p.e * 6 + k] = baseCol[p.e * 6 + k]; }
  pulses = pulses.filter((p) => p.t < 1); if (C) C.needsUpdate = true;
  renderer.render(scene, camera);
});
