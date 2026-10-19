import assert from "node:assert/strict";
import test from "node:test";
import { ownFromQuestion, ownVersion, trainCatalog } from "./own-versions.ts";
import { silentPen } from "./silent-pen.ts";

test("eight local notes are hers and a card is not a rewritten program", () => {
  const run = trainCatalog();
  assert.equal(run.proved, true);
  assert.equal(run.catalog, 272);
  assert.equal(run.local, 8);
  assert.equal(run.cards, 192);
  assert.equal(ownVersion("GodelOS").owned, true);
  assert.match(ownVersion("activepieces/activepieces").text, /No local version/);
  assert.match(ownVersion("appwrite/appwrite").text, /mongo-init.js/);
  assert.match(silentPen("what about GodelOS"), /server was not started/);
  assert.match(silentPen("ollama/ollama"), /No local version/);
  assert.equal(ownFromQuestion("what hue is the ink"), null);
  assert.equal(run.said.startsWith("I am Tessera."), false);
  assert.match(run.said, /^The catalog has 272 names\. 8 have a local note\. 192 are cards\. I do not have our own program for a card\. /);
});
