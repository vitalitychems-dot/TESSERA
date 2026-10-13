import * as THREE from "/vendor/three.module.js";
const canvas = document.querySelector("#brain-3d");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05060a); scene.fog = new THREE.FogExp2(0x05060a, 0.012);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500); camera.position.set(0, 10, 60);
const root = new THREE.Group(); scene.add(root);
const stat = document.querySelector("#stat"), info = document.querySelector("#info"), sel = document.querySelector("#src");
let idx = new Map(), lines = null, edgeIndex = new Map(), pulses = [], baseCol = null, nodePos = [];
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 360) / 360; };
async function load(src) {
  root.clear(); pulses = []; edgeIndex = new Map();
  const g = await (await fetch(`/brain/graph?src=${src}`)).json();
  idx = new Map(g.nodes.map((n, i) => [n.id, i])); nodePos = g.nodes.map((n) => n.p);
  const P = new Float32Array(g.nodes.length * 3), C = new Float32Array(g.nodes.length * 3), col = new THREE.Color();
  g.nodes.forEach((n, i) => { P.set(n.p, i * 3); col.setHSL(hue(n.group), 0.75, 0.6); C.set([col.r, col.g, col.b], i * 3); });
  const ng = new THREE.BufferGeometry(); ng.setAttribute("position", new THREE.BufferAttribute(P, 3)); ng.setAttribute("color", new THREE.BufferAttribute(C, 3));
  root.add(new THREE.Points(ng, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
  const E = g.edges.filter((e) => idx.has(e.a) && idx.has(e.b)); const maxW = Math.max(...E.map((e) => e.w), 1);
  const LP = new Float32Array(E.length * 6), LC = new Float32Array(E.length * 6);
  E.forEach((e, i) => {
    LP.set(g.nodes[idx.get(e.a)].p, i * 6); LP.set(g.nodes[idx.get(e.b)].p, i * 6 + 3);
    const b = 0.08 + 0.9 * (e.w / maxW);
    if (e.sign < 0) col.setRGB(b, 0.15 * b, 0.3 * b); else if (e.kind === "synapse") col.setRGB(0.3 * b, 0.8 * b, b); else col.setRGB(0.5 * b, 0.5 * b, 0.6 * b);
    LC.set([col.r, col.g, col.b, col.r, col.g, col.b], i * 6); edgeIndex.set(e.a + "\0" + e.b, i); edgeIndex.set(e.b + "\0" + e.a, i);
  });
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(LP, 3)); lg.setAttribute("color", new THREE.BufferAttribute(LC, 3));
  baseCol = LC.slice(); lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(lines);
  const ext = Math.max(10, ...g.nodes.flatMap((n) => n.p.map(Math.abs))); camera.position.set(0, ext * 0.25, ext * 2.1); camera.lookAt(0, 0, 0);
  stat.textContent = `${g.nodes.length} nodes · ${E.length} edges${g.modules ? ` · ${g.modules} modules` : ""}`; info.textContent = g.license ?? "";
  document.body.dataset.ready = src; document.body.dataset.nodes = g.nodes.length; document.body.dataset.edges = E.length;
}
const sphere = new THREE.SphereGeometry(0.35, 8, 8);
function pulse(a, b, w) {
  const i = idx.get(a), j = idx.get(b); if (i == null || j == null) return;
  const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, blending: THREE.AdditiveBlending }));
  root.add(m); pulses.push({ m, from: nodePos[i], to: nodePos[j], t: 0, e: edgeIndex.get(a + "\0" + b), w });
}
async function learn() {
  if (sel.value === "memory") { const s = await (await fetch("/brain/learn?n=3")).json(); for (const [a, b, w] of s.fired.slice(0, 30)) pulse(a, b, w); document.body.dataset.fired = Number(document.body.dataset.fired ?? 0) + s.fired.length; }
  else { const keys = [...edgeIndex.keys()]; for (let k = 0; k < 12 && keys.length; k++) { const [a, b] = keys[(Math.random() * keys.length) | 0].split("\0"); pulse(a, b, 1); } }
}
setInterval(learn, 400);
sel.onchange = () => load(sel.value);
const q = new URLSearchParams(location.search).get("src"); if (q) sel.value = q;
await load(sel.value);
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = (now - last) / 1000; last = now; root.rotation.y += dt * 0.15; root.rotation.x = Math.sin(now / 9000) * 0.2;
  const C = lines?.geometry.attributes.color;
  for (const p of pulses) {
    p.t += dt * 1.5; const t = Math.min(1, p.t); p.m.position.set(...p.from.map((v, k) => v + (p.to[k] - v) * t)); p.m.material.opacity = 1 - t * 0.6;
    if (C && p.e != null) for (let k = 0; k < 6; k++) C.array[p.e * 6 + k] = Math.min(1, baseCol[p.e * 6 + k] + (1 - t));
  }
  for (const p of pulses.filter((p) => p.t >= 1)) { root.remove(p.m); if (C && p.e != null) for (let k = 0; k < 6; k++) C.array[p.e * 6 + k] = baseCol[p.e * 6 + k]; }
  pulses = pulses.filter((p) => p.t < 1); if (C) C.needsUpdate = true;
  renderer.render(scene, camera);
});
