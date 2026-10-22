import assert from "node:assert/strict";
import test from "node:test";
import {
  allowRetry,
  chunks,
  firstOf,
  fresh,
  laneOrder,
  left,
  markDone,
  missing,
  needCount,
  newest,
  nextGap,
  preferLocal,
  redact,
  renameKey,
  requireOwner,
  sameWord,
  shards,
  shortAsk,
  takeFirst,
  tieFails,
  tryLock,
  unlock,
  waiting,
  zipPair,
} from "./rick-five.ts";

test("five rounds of desk steps run", () => {
  assert.deepEqual(takeFirst(["a", "b", "c"], 2), ["a", "b"]);
  const book = new Map([["old", "page"]]);
  assert.equal(renameKey(book, "old", "new"), true);
  assert.equal(book.has("old"), false);
  assert.equal(book.get("new"), "page");
  assert.equal(renameKey(book, "new", "new"), false);
  assert.equal(tieFails(1, 1), false);
  assert.equal(tieFails(2, 1), true);
  assert.equal(fresh(3, 5), true);
  assert.equal(fresh(6, 5), false);

  assert.deepEqual(zipPair(["a", "b"], [1]), [["a", 1]]);
  assert.equal(waiting("page", new Set(["other"])), true);
  assert.equal(waiting("page", new Set(["page"])), false);
  assert.deepEqual(shards(["a", "b", "c"], 2), [["a", "c"], ["b"]]);
  assert.equal(redact("token abcdefghijklmnopqrstu stays"), "token [held] stays");
  assert.equal(allowRetry(1), true);
  assert.equal(allowRetry(2), false);

  const kept = newest([
    { key: "a", tick: 1, value: "old" },
    { key: "a", tick: 2, value: "new" },
  ]);
  assert.equal(kept.get("a")?.value, "new");
  assert.equal(needCount(2, 2), true);
  assert.equal(needCount(1, 2), false);
  assert.deepEqual(firstOf(["a", "a", "b"]), ["a", "b"]);
  assert.equal(left(8, 10), 2);
  assert.equal(markDone({ done: false }).done, true);

  assert.equal(requireOwner("  "), false);
  assert.equal(requireOwner("Cursor").valueOf(), true);
  assert.deepEqual(chunks([1, 2, 3, 4], 3), [[1, 2, 3], [4]]);
  assert.equal(preferLocal("  ", "remote"), "remote");
  assert.equal(preferLocal("local", "remote"), "local");
  const locks = new Set<string>();
  assert.equal(tryLock(locks, "main"), true);
  assert.equal(tryLock(locks, "main"), false);
  assert.equal(unlock(locks, "main"), true);
  assert.equal(tryLock(locks, "main"), true);

  assert.equal(shortAsk("  too many words here ", 8), "too many");
  assert.deepEqual(laneOrder(["Rick", "Father", "Stranger"]), ["Father", "Rick", "Stranger"]);
  assert.deepEqual(missing({ ask: "go", owner: "" }, ["ask", "owner"]), ["owner"]);
  assert.equal(sameWord(" Yes ", "yes"), true);
  assert.equal(nextGap([1, 2, 4]), 3);
});
