import assert from "node:assert/strict";
import test from "node:test";
import {
  PHI,
  consolidate,
  councilTally,
  cosine,
  crystallize,
  finishOnce,
  grounded,
  rankTasks,
  recallCache,
  reflectDiff,
  sigmoid,
  storeOnce,
  transferGain,
} from "./sovereign-desk.ts";

test("the ten desk steps run and the merge keeps the longer text", () => {
  const ranked = rankTasks([
    { name: "format logs", impact: 1 },
    { name: "consciousness", impact: 9 },
    { name: "catalog", impact: 9 },
  ]);
  assert.equal(ranked[0].name, "catalog");
  assert.equal(ranked[1].name, "consciousness");
  assert.equal(ranked[2].name, "format logs");

  const stored = storeOnce([
    { key: "physics", body: "ring" },
    { key: "geometry", body: "ring" },
    { key: "other", body: "line" },
  ]);
  assert.equal(stored.stored, 2);
  assert.equal(stored.refs[0].id, stored.refs[1].id);

  assert.ok(Math.abs(sigmoid(0) - 0.5) < 1e-9);
  assert.ok(transferGain(10, 0) > 4 && transferGain(10, 0) < 6);

  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(grounded([1, 0], [[0, 1]]).kept, false);
  assert.equal(grounded([1, 0], [[1, 0]]).kept, true);

  assert.ok(PHI > 1.6 && PHI < 1.62);
  assert.equal(councilTally([{ yes: true, specialist: true }, { yes: false, specialist: false }]).passed, true);
  assert.equal(councilTally([{ yes: true, specialist: true }, { yes: false, specialist: false }, { yes: false, specialist: false }]).passed, false);

  const done = finishOnce("one task");
  assert.equal(done.done, true);
  assert.equal(done.alive, false);

  assert.deepEqual(consolidate(["the sigil holds", "the sigil stays", "a short note"]), ["sigil"]);
  assert.deepEqual(reflectDiff(["old"], ["old", "new"]), ["new"]);

  const crystal = crystallize([
    { text: "ring", vector: [1, 0] },
    { text: "ring structure", vector: [0.99, 0.01] },
    { text: "other", vector: [0, 1] },
  ]);
  assert.equal(crystal.length, 2);
  assert.equal(crystal[0].text, "ring structure");

  const cache = recallCache(2);
  cache.put("a", "one");
  cache.put("b", "two");
  assert.equal(cache.get("a"), "one");
  cache.put("c", "three");
  assert.equal(cache.has("b"), false);
  assert.equal(cache.has("a"), true);
});
