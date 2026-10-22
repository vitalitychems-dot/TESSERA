import assert from "node:assert/strict";
import test from "node:test";
import { rankCounts, topRanking } from "./whiten.ts";

test("a black-box query keeps the top ranks and a second query adds to the count", () => {
  assert.deepEqual(topRanking([0.1, 0.9, 0.3, 0.8, 0.2], 2), [1, 3]);
  const once = rankCounts([[0.1, 0.9, 0.3]], 1);
  assert.equal(once.get(1), 1);
  const twice = rankCounts(
    [
      [0.1, 0.9, 0.3],
      [0.2, 0.4, 0.8],
    ],
    1,
  );
  assert.equal(twice.get(1), 1);
  assert.equal(twice.get(2), 1);
  assert.equal(topRanking([0.2, 0.2, 0.2], 5).length, 3);
});
