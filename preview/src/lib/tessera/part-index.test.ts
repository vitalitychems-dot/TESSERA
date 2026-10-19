import assert from "node:assert/strict";
import test from "node:test";
import { PARTS, partTally } from "./part-index.ts";

test("the store is absent and the closed zips stay closed", () => {
  const tally = partTally();
  assert.equal(tally.drive, 9);
  assert.equal(tally.driveOpened, 2);
  assert.equal(tally.repos, 11);
  assert.equal(tally.reposOpened, 8);
  assert.equal(tally.closed, 10);
  assert.equal(PARTS.some((row) => /vitality|peptide|wallet/i.test(row.name + row.note)), false);
  assert.equal(PARTS.filter((row) => row.kind === "repo" && row.note === "Empty.").length, 4);
});
