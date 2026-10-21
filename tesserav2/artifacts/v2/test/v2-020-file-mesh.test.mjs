import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { gitbookRoot, queryFileMesh } from "../src/offline/file-mesh.mjs";

const noArchive = !existsSync(gitbookRoot()) && "archive/from-gitbook is excluded from tesserav2 (docs/EXCLUDED.md)";

test("a file-mesh query of at least 50 Gitbook pages stays offline", { skip: noArchive }, () => {
  const found = queryFileMesh("exclusion manifest");
  assert.ok(found.count >= 50, `indexed ${found.count}`);
  assert.equal(found.live, false);
  assert.ok(found.hits.some((hit) => hit.endsWith("HYB-011-EXCLUSION-MANIFEST.md")));
  assert.ok(found.hits.every((hit) => !/(^|\/)1t(\/|$)/i.test(hit)));
  assert.ok(found.hits.every((hit) => !/vault/i.test(hit)));
});

test("a file-mesh query with no archive returns an empty offline result", () => {
  const found = queryFileMesh("exclusion manifest", "/nonexistent/from-gitbook");
  assert.equal(found.count, 0);
  assert.equal(found.live, false);
});
