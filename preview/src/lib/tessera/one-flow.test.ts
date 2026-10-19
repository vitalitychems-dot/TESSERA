import assert from "node:assert/strict";
import test from "node:test";
import { HEADS, memoryPack, oneFlow, oneFlowLine } from "./one-flow.ts";

test("one flow is the public memory pack", () => {
  const rows = oneFlow();
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map((row) => row.id)).size, 8);
  const text = oneFlowLine();
  assert.match(text, new RegExp(HEADS.tessera));
  assert.match(text, new RegExp(HEADS.gitbook));
  assert.match(text, new RegExp(HEADS.gitmesh));
  assert.match(text, /12276 files in 10 sections/);
  assert.equal(/peptide|vitality|wallet|private key|@/.test(text), false);
  const pack = memoryPack();
  assert.equal(pack.length, rows.length + 10 + 78);
  assert.equal(pack.every((row) => row.q && row.a && row.at), true);
  assert.equal(pack.filter((row) => row.at.startsWith("section-")).reduce((sum, row) => sum + Number(row.a.match(/(\d+) files/)?.[1] ?? 0), 0), 12276);
});
