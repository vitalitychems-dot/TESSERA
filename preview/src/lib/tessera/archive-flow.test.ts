import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVE_SECTIONS, archiveEdges, archiveFlow, archiveLine } from "./archive-flow.ts";

test("the kept text is ten sections and the store is not a node", () => {
  const flow = archiveFlow();
  assert.equal(flow.files, 12276);
  assert.equal(flow.sections, 10);
  assert.equal(ARCHIVE_SECTIONS.some((section) => /peptide|vitality|vial/i.test(section.label + section.note)), false);
  const ids = new Set(ARCHIVE_SECTIONS.map((section) => section.id));
  assert.equal(archiveEdges().every(([from, to]) => ids.has(from) && ids.has(to)), true);
  assert.match(archiveLine(), /12276 files in 10 sections/);
});
