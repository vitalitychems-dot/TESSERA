import assert from "node:assert/strict";
import test from "node:test";
import { brainVolume, grown, projectPoint } from "./brain-volume.ts";

test("the volume is named parts, Tessera is the center, and growth adds them", () => {
  const volume = brainVolume([
    { name: "Tessera", part: "region" },
    { name: "Alpha", part: "region" },
    { name: "Beta", part: "region" },
    { name: "ranking", part: "step" },
    { name: "kept pages", part: "memory" },
  ]);
  assert.equal(volume.nodes.length, 5);
  assert.ok(volume.nodes.every((node) => node.name));
  const center = volume.nodes.find((node) => node.name === "Tessera");
  assert.deepEqual([center?.x, center?.y, center?.z], [0, 0, 0]);
  assert.ok(volume.edges.some(([a, b]) => a === center?.id || b === center?.id));
  assert.equal(grown(volume.nodes, 0).length, 1);
  assert.ok(grown(volume.nodes, 0.5).length > 1);
  assert.ok(grown(volume.nodes, 0.5).length < 5);
  assert.equal(grown(volume.nodes, 1).length, 5);
  const near = { ...volume.nodes[0], x: 0, y: 0, z: -1.5 };
  const far = { ...volume.nodes[0], x: 0, y: 0, z: 1.5 };
  assert.ok(projectPoint(near, 0, 0, 1).depth < projectPoint(far, 0, 0, 1).depth);
  assert.ok(Math.abs(projectPoint({ ...near, x: 1 }, 0, 0, 2).x) > Math.abs(projectPoint({ ...near, x: 1 }, 0, 0, 1).x));
});
