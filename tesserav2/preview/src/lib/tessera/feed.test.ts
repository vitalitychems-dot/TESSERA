import assert from "node:assert/strict";
import test from "node:test";
import { fedAnswer, feedLessons } from "./feed.ts";
import { askAll } from "./ask-all.ts";

test("thirteen new lines are unknown, then kept, and an unknown price stays empty", () => {
  const run = feedLessons();
  assert.equal(run.proved, true);
  assert.equal(run.before, 0);
  assert.equal(run.after, 13);
  assert.match(run.said, /price of tea is still not stored/);
  assert.equal(askAll("ledger total"), "ledger total = 272");
  assert.equal(fedAnswer("price of tea"), null);
});
