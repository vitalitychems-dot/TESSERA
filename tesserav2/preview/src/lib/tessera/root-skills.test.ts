import assert from "node:assert/strict";
import test from "node:test";
import { permutation, pxName, readRoots, remember, scaleAction, unscaleAction, versionOk } from "./root-skills.ts";

test("an action maps, a full memory drops the oldest, and a template name must end in .in", () => {
  assert.equal(scaleAction(-1, 0, 10), 0);
  assert.equal(scaleAction(1, 0, 10), 10);
  assert.equal(unscaleAction(0, 0, 10), -1);
  assert.deepEqual(remember(2, ["a", "b"], "c").kept, ["b", "c"]);
  assert.equal(pxName("src/foo.in"), "foo");
  assert.equal(pxName("foo.py"), "");
  assert.equal(versionOk("1.2.3"), true);
  assert.equal(versionOk("1.2"), false);
  const table = permutation(() => 0);
  assert.equal(table.length, 512);
  assert.equal(table[255], 255);
  assert.equal(table[256], 0);
  assert.equal(readRoots().proved, true);
});
