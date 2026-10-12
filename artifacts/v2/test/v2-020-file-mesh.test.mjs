import assert from "node:assert/strict";
import test from "node:test";
import { queryFileMesh } from "../src/offline/file-mesh.mjs";

test("a file-mesh query of at least 50 Gitbook pages stays offline", () => {
  const found = queryFileMesh("exclusion manifest");
  assert.ok(found.count >= 50, `indexed ${found.count}`);
  assert.equal(found.live, false);
  assert.ok(found.hits.some((hit) => hit.endsWith("HYB-011-EXCLUSION-MANIFEST.md")));
  assert.ok(found.hits.every((hit) => !/(^|\/)1t(\/|$)/i.test(hit)));
  assert.ok(found.hits.every((hit) => !/vault/i.test(hit)));
});
