import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createBoard } from "../src/studio/board.mjs";

test("the board renders cards and refuses a repeated first line", () => {
  const source = readFileSync(new URL("../src/studio/board.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["'].*olive/);

  const board = createBoard();
  assert.equal(board.add("Alpha\nfirst body").ok, true);
  assert.equal(board.add("Beta\nsecond body").ok, true);
  const duplicate = board.add("Alpha\na different body");
  assert.deepEqual(duplicate, { ok: false, reason: "duplicate first line" });

  const html = board.render();
  assert.match(html, /data-first="Alpha"/);
  assert.match(html, /data-first="Beta"/);
  assert.equal(html.match(/<article /g)?.length, 2);
});
