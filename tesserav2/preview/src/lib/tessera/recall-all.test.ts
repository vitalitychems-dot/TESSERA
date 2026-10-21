import assert from "node:assert/strict";
import test from "node:test";
import { pickRecall } from "./recall-all.ts";

test("recall returns the indexed line and the flow string that shares it", () => {
  const hit = pickRecall(
    "What did the unification engine cover",
    [{ s: "data/ingest/a.txt", t: "Tests for the Unification Engine covering first-order and higher-order unification." }],
    ["Unification Engine ↔ type system: ast, nodes"],
  );
  assert.ok(hit);
  assert.match(hit.text, /Unification Engine/);
  assert.match(hit.flow, /Unification Engine/);
});
