import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIslands } from "../src/scenario.js";

test("same seed gives an identical delivery trace; a lossy radio with another seed does not", () => {
  const run = (seed, loss) => {
    const w = buildIslands({ seed, loss });
    w.sim.run(120);
    return w.sim.traceHash();
  };
  assert.equal(run(7, 0), run(7, 0));
  assert.equal(run(7, 0.2), run(7, 0.2));
  assert.notEqual(run(7, 0.2), run(8, 0.2));
  assert.notEqual(run(7, 0), run(7, 0.2));
});

test("with 20% packet loss the islands still converge given enough ticks", () => {
  const w = buildIslands({ seed: 11, loss: 0.2 });
  w.sim.run(400);
  const sizes = ["a1", "a3", "b1", "b3", "mule"].map((l) => w[l].mb.posts.size);
  assert.deepEqual(sizes, [3, 3, 3, 3, 3]);
});
