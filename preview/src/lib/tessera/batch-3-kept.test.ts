import assert from "node:assert/strict";
import test from "node:test";
import { batch3 } from "./batch-3.ts";
import { batch3Kept } from "./batch-3-kept.ts";
import { CATALOG } from "./catalog-pass.ts";

test("the cards dropped from the third batch are kept as pointers", () => {
  const kept = batch3Kept();
  const current = new Set(batch3().map((row) => row.repo));
  assert.equal(kept.length, 25);
  assert.equal(batch3().length, 50);
  assert.ok(batch3().filter((row) => row.held).length >= 18);

  const cards = new Map(CATALOG.map((row) => [row.name, row.home]));
  for (const row of kept) {
    assert.equal(cards.get(row.repo), "card");
    assert.equal(current.has(row.repo), false);
  }
  assert.equal(kept.filter((row) => row.moved).length, 2);
  assert.equal(kept[0]?.repo, "269652/artificial-consciousness-ai");
  assert.equal(kept[24]?.repo, "Steake/GodelOS");
});
