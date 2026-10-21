import assert from "node:assert/strict";
import test from "node:test";
import { rickThirtyLine, strictAnswer } from "./rick-thirty.ts";
import { askAll } from "./ask-all.ts";
import { pickNote } from "./recall.ts";

test("thirty before-and-after rows all change", () => {
  const run = rickThirtyLine();
  assert.equal(run.proved, true);
  assert.equal(run.moved, 30);
  assert.equal(new Set(run.rows.map((row) => row.name)).size, 30);
  for (const row of run.rows) assert.notEqual(row.before, row.after);
  for (const row of run.rows) assert.equal(strictAnswer(row.name), row.after);
  for (const row of run.rows) assert.equal(askAll(row.name), row.after);
  assert.equal(pickNote("scale low", [{ query: "scale high", text: "10" }, { query: "scale low", text: "0" }]), "scale low: 0");
  assert.equal(pickNote("scale low", [{ query: "scale high", text: "10" }]), "");
});
