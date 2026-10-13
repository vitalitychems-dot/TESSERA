import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBrain, createBrainLoop, layout3d } from "../src/brain/view.mjs";
import { brainGraph, handleBrain } from "../src/brain/http.mjs";
import { loadTemplate, randomTemplate, TEMPLATES } from "../src/brain/templates.mjs";
const J = [
  { type: "entity", name: "Alpha", entityType: "a", observations: ["talks to Gamma"] },
  { type: "entity", name: "Beta", entityType: "b", observations: [] },
  { type: "entity", name: "Gamma", entityType: "a", observations: ["Alpha and Beta"] },
  { type: "relation", from: "Alpha", to: "Beta", relationType: "r" },
].map((r) => JSON.stringify(r)).join("\n");
test("B1-05 brain view: only real nodes, synapses from co-activation, finite 3D layout", () => {
  const b = buildBrain(J, { layoutIters: 20 });
  assert.deepEqual(b.nodes.map((n) => n.id).sort(), ["Alpha", "Beta", "Gamma"]);
  assert.ok(b.synapses.length >= 2); assert.ok(b.nodes.every((n) => n.p.length === 3 && n.p.every(Number.isFinite)));
  const L = createBrainLoop(J); const s = L.step(5); assert.ok(s.fired.length >= 2); assert.ok(s.fired.every(([, , w]) => w > 0));
  assert.equal(layout3d(["x", "y"], [["x", "y", 1]], { iters: 5 }).length, 2);
});
test("B1-06 connectome templates: attribution, real edges, same-density null", () => {
  for (const k of ["human", "flywire", "celegans", "hemibrain", "gpt2"]) {
    const t = loadTemplate(k); assert.ok(t.license.length > 10); assert.ok(t.edges.length > 1000); assert.ok(t.species);
    const r = randomTemplate(t); assert.equal(r.edges.length, t.edges.length);
    assert.equal(r.edges.reduce((s, e) => s + e.syn, 0), t.edges.reduce((s, e) => s + e.syn, 0));
    const g = brainGraph(k); const ids = new Set(g.nodes.map((n) => n.id)); assert.ok(g.edges.every((e) => ids.has(e.a) && ids.has(e.b)));
  }
  assert.ok(Object.keys(TEMPLATES).includes("flywire"));
});
test("B1-05 /brain routes: page has a brain selector, unknown src is 404", () => {
  const mk = () => { const r = { code: 0, body: "", writeHead(c) { r.code = c; }, end(b) { r.body = String(b); } }; return r; };
  let r = mk(); assert.ok(handleBrain({ method: "GET" }, r, new URL("http://x/brain"))); assert.match(r.body, /<select id="src">/); assert.match(r.body, /hemibrain/);
  r = mk(); handleBrain({ method: "GET" }, r, new URL("http://x/brain/graph?src=nope")); assert.equal(r.code, 404);
  assert.equal(handleBrain({ method: "POST" }, mk(), new URL("http://x/brain")), false);
});
