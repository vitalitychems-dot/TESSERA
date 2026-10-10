import assert from "node:assert/strict";
import test from "node:test";
import { curiosityPath, nextCuriousQuery, pickNext, rickPath, rickPick } from "./curiosity.ts";

test("she picks five local topics and skips a topic that has no fact", () => {
  assert.equal(pickNext([])?.category, "people");
  const run = curiosityPath();
  assert.deepEqual(run.path.map((item) => item.category), ["people", "routes", "boundary", "files", "mark", "bridge"]);
  assert.equal(run.known, 6);
  assert.deepEqual(run.skipped, ["screen", "media"]);
  assert.equal(pickNext(run.path.map((item) => `LESSON: ${item.fact}`)), null);
  assert.equal(nextCuriousQuery([{ query: "start", text: "note Plato Academy remains." }]), "Plato Academy");
  assert.equal(nextCuriousQuery([]), null);
  const rick = rickPath();
  assert.equal(rickPick([])?.category, "bridge");
  assert.equal(rick.keeps, 4);
  assert.equal(rick.known, 6);
  assert.ok(rick.keeps < run.path.length);
});
