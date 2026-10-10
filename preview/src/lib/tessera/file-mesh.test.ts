import assert from "node:assert/strict";
import test from "node:test";
import { fileMeshLine, runFile, searchFiles, SAVED } from "./file-mesh.ts";

test("a saved page can be found, and the live web is not opened", () => {
  const found = searchFiles(SAVED, "spin pairs");
  assert.deepEqual(found.hits, ["projects/spin/spin.mjs"]);
  assert.equal(found.live, false);
  assert.match(fileMeshLine("spin pairs"), /No address was used/);
  assert.match(fileMeshLine("a host that is not here"), /No saved page/);
  assert.equal(runFile("spin").ran, true);
  assert.match(runFile("spin").line, /not given a network/);
  assert.equal(runFile("browser").ran, false);
});
