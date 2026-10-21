import assert from "node:assert/strict";
import test from "node:test";
import { freeFixes, pullFree } from "./gitmesh-free.ts";

test("a carried page is read with no fetch, and every measured row moves", () => {
  const got = pullFree([{ path: "mesh/index.json", text: "admit carry", stamp: "2026-10-19" }], "admit carry");
  assert.equal(got.fetches, 0);
  assert.match(got.text, /^Carried 2026-10-19\./);
  const rows = freeFixes();
  assert.equal(rows.length, 30);
  assert.deepEqual(rows.filter((row) => !row.kept).map((row) => row.n), []);
});
