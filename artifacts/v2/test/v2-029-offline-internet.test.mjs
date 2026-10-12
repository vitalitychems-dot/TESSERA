import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the Gitbook summary links the Offline Internet page", () => {
  const summary = readFileSync(new URL("../../../archive/from-gitbook/SUMMARY.md", import.meta.url), "utf8");
  assert.match(summary, /\[Offline Internet\]\(mesh\/OFFLINE-INTERNET\.md\)/);
  const page = readFileSync(new URL("../../../archive/from-gitbook/mesh/OFFLINE-INTERNET.md", import.meta.url), "utf8");
  assert.match(page, /live: false/);
  assert.match(page, /Kiwix/);
  assert.match(page, /stays off/);
});
