import assert from "node:assert/strict";
import test from "node:test";
import { buildIndex, searchIndex } from "./offline-index.ts";

test("index of 60 pages finds a real page without the live web", () => {
  const pages = Array.from({ length: 60 }, (_, i) => ({ path: `mesh/page-${i}.md`, text: `page ${i} filler words` }));
  pages.push({ path: "mesh/offline-internet.md", text: "Offline internet: kiwix, sneakernet bundle, LAN p2p" });
  const idx = buildIndex(pages);
  assert.ok(idx.pages.length >= 50);
  const r = searchIndex(idx, "sneakernet bundle");
  assert.deepEqual(r.hits, ["mesh/offline-internet.md"]);
  assert.equal(r.live, false);
  assert.deepEqual(searchIndex(idx, "nothing-here-xyz").hits, []);
});

test("long pages are trimmed", () => {
  const idx = buildIndex([{ path: "a.md", text: "x".repeat(5000) }], 100);
  assert.equal(idx.pages[0].text.length, 100);
});
