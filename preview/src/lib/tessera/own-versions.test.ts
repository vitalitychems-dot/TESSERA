import assert from "node:assert/strict";
import test from "node:test";
import { ownVersion, trainCatalog } from "./own-versions.ts";

test("eight local notes are hers and a card is not a rewritten program", () => {
  const run = trainCatalog();
  assert.equal(run.proved, true);
  assert.equal(run.catalog, 272);
  assert.equal(run.local, 8);
  assert.equal(run.cards, 192);
  assert.equal(ownVersion("GodelOS").owned, true);
  assert.match(ownVersion("activepieces/activepieces").text, /No local version/);
  assert.match(run.said, /do not have our own program/);
});
