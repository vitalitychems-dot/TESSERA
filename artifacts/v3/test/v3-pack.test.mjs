import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tokens, entityText, idfTable, packV2, packV3 } from "../src/pack.mjs";
const raw = readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
test("v3 packing keeps every ranked name and uses fewer tokens than v2 JSON", () => {
  const E = entityText(raw); const idf = idfTable(E); const ids = [...E.keys()].slice(0, 8);
  const v2 = packV2(E, ids), v3 = packV3(E, ids, { idf, sink: 16 });
  for (const id of ids) assert.ok(v3.includes(id), id);
  assert.ok(tokens(v3) < tokens(v2));
});
test("dedupe drops repeated observations; prune never cuts names", () => {
  const E = new Map([["A", { type: "t", obs: ["same fact", "the alpha"] }], ["B", { type: "t", obs: ["Same fact"] }]]);
  const s = packV3(E, ["A", "B"], { prune: false }); assert.equal(s.match(/same fact/gi).length, 1); assert.match(s, /^# t\nA: /);
  assert.ok(!/\bthe\b/.test(packV3(E, ["A"], { idf: idfTable(E) })));
});
