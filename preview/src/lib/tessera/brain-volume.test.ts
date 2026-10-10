import assert from "node:assert/strict";
import test from "node:test";
import { brainVolume, grown, projectPoint } from "./brain-volume.ts";

test("the volume grows in order and a nearer point draws larger", () => {
  const volume = brainVolume([
    { name: "Tessera", part: "region" },
    { name: "ranking", part: "step" },
    { name: "kept pages", part: "memory" },
  ]);
  assert.equal(volume.nodes.length, 384);
  assert.ok(volume.edges.length > volume.nodes.length);
  assert.equal(grown(volume.nodes, 0).length, 1);
  assert.ok(grown(volume.nodes, 0.5).length > 1);
  assert.ok(grown(volume.nodes, 0.5).length < 384);
  assert.equal(grown(volume.nodes, 1).length, 384);
  const near = { ...volume.nodes[0], x: 0, y: 0, z: -1.5 };
  const far = { ...volume.nodes[0], x: 0, y: 0, z: 1.5 };
  const nearDraw = projectPoint(near, 0, 0, 1);
  const farDraw = projectPoint(far, 0, 0, 1);
  assert.ok(nearDraw.depth < farDraw.depth);
  const zoomed = projectPoint({ ...near, x: 1 }, 0, 0, 2);
  const base = projectPoint({ ...near, x: 1 }, 0, 0, 1);
  assert.ok(Math.abs(zoomed.x) > Math.abs(base.x));
});
