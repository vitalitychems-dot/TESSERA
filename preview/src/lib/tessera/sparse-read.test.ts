import assert from "node:assert/strict";
import test from "node:test";
import { branchCase, configCell, pickSmallest, readSparse } from "./sparse-read.ts";

test("the smallest source file is chosen and a large one is left", () => {
  const picked = pickSmallest([
    { name: "model.py", size: 80000, type: "file" },
    { name: "README.md", size: 100, type: "file" },
    { name: "b.py", size: 400, type: "file" },
    { name: "a.js", size: 400, type: "file" },
    { name: "src", size: 0, type: "dir" },
  ]);
  assert.equal(picked?.name, "a.js");
  assert.equal(pickSmallest([{ name: "big.py", size: 90000, type: "file" }]), null);
  assert.equal(branchCase("selector").optOut, true);
  assert.equal(branchCase("sequence").optOut, false);
  const cell = configCell();
  assert.equal(cell.read(), null);
  assert.equal(cell.init(2), 2);
  assert.equal(readSparse().proved, true);
});
