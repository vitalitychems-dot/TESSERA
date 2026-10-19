import assert from "node:assert/strict";
import test from "node:test";
import { HEADS, memoryPack, oneFlow, oneFlowLine } from "./one-flow.ts";

test("one flow is the public memory pack", () => {
  const rows = oneFlow();
  assert.equal(rows.length, 7);
  assert.equal(new Set(rows.map((row) => row.id)).size, 7);
  const text = oneFlowLine();
  assert.match(text, new RegExp(HEADS.tessera));
  assert.match(text, new RegExp(HEADS.gitbook));
  assert.match(text, new RegExp(HEADS.gitmesh));
  assert.match(text, /12276 files in 10 sections/);
  assert.equal(/peptide|vitality|wallet|private key|@/.test(text), false);
  assert.equal(memoryPack().length, rows.length);
  assert.equal(memoryPack().every((row) => row.q && row.a && row.at), true);
});
