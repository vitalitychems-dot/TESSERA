import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGraph } from "../../v2/src/brain/synapse.mjs";
import { replayAt } from "../../v2/src/brain/view.mjs";
import { handleBrain } from "../src/serve.mjs";
import { buildCrystal, serialize, parse, graphAt, verify, appendCells, crystalSnapshot } from "../src/crystal.mjs";
const jsonl = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8");
const lines = jsonl.split("\n");
test("crystal round-trips and rebuilds the same graph as v2 loadGraph at every quarter", () => {
  const cells = parse(serialize(buildCrystal(jsonl, { source: "v2-memory.jsonl", layoutIters: 5 })));
  assert.equal(verify(cells), 0);
  for (const f of [0.25, 0.5, 0.75, 1]) { const t = Math.floor(f * (lines.length - 1)); const a = graphAt(cells, t), b = loadGraph(lines.slice(0, t + 1).join("\n"));
    assert.equal(a.nodes.size, b.nodes.size); assert.equal(a.edges.size, b.edges.size); for (const [k, w] of b.edges) assert.equal(a.edges.get(k), w); }
});
test("content-addressed and append-only: repeats bump v, tampering is detected, every fact has a source line", () => {
  const r = '{"type":"relation","from":"A","to":"B","relationType":"x"}';
  const c = buildCrystal(`${r}\n${r}\n`, { source: "m.jsonl", layoutIters: 0 }); assert.equal(c.filter((x) => x.h).length, 1); assert.equal(c[1].k, "v");
  const g = graphAt(c); assert.equal(g.val.get(c[0].h), 2); assert.equal(g.edges.get("A\u0000B"), 2); assert.equal(c[0].src, "m.jsonl:1");
  const add = appendCells(c, `${r}\n{"type":"entity","name":"C","entityType":"t","observations":[]}`, { source: "m.jsonl" });
  assert.equal(add[0].k, "v"); assert.equal(add[1].k, "n"); assert.ok(add.every((x) => x.t > 1));
  const bad = [{ ...c[0], a: "Z" }]; assert.equal(verify(bad), 1);
});
test("crystal snapshot keeps the /brain/snapshot shape and matches replayAt", () => {
  const cells = buildCrystal(jsonl, { source: "v2-memory.jsonl", layoutIters: 5 });
  const a = replayAt(jsonl, 200, 120), b = crystalSnapshot(cells, 200, 120);
  assert.deepEqual(Object.keys(b), Object.keys(a)); assert.equal(b.nodes.length, a.nodes.length); assert.equal(b.edges.length, a.edges.length);
  assert.equal(b.diff.forward, a.diff.forward); assert.equal(b.diff.back, a.diff.back);
  assert.ok(b.nodes.every((n) => Array.isArray(n.p) && n.p.length === 3 && n.v >= 0)); assert.ok(b.edges.every((e) => /:\d+$/.test(e.src)));
});
test("GET /brain/snapshot?src=crystal is served read-only with p, v, src", () => {
  const r = { code: 0, body: "", writeHead(c) { r.code = c; }, end(x) { r.body = String(x); } };
  assert.equal(handleBrain({ method: "GET" }, r, new URL("http://x/brain/snapshot?src=crystal&t=50&prev=10")), true); assert.equal(r.code, 200);
  const s = JSON.parse(r.body); assert.equal(s.t, 50); assert.ok(s.nodes[0].p && s.nodes[0].src);
  const w = { code: 0, writeHead(c) { w.code = c; }, end() {} }; assert.equal(handleBrain({ method: "POST" }, w, new URL("http://x/brain/snapshot?src=crystal")), false);
});
