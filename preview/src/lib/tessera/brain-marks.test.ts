import assert from "node:assert/strict";
import test from "node:test";
import { skillNames } from "./agent-cycle.ts";
import { brainVolume } from "./brain-volume.ts";
import { examNames } from "./improve-loop.ts";

test("the volume grows by the exam and the twenty skills", () => {
  const before = brainVolume([{ name: "Tessera", part: "region" }]).nodes.length;
  const after = brainVolume([
    { name: "Tessera", part: "region" },
    ...examNames().map((name) => ({ name, part: "memory" as const })),
    ...skillNames().map((name) => ({ name: `skill ${name}`, part: "memory" as const })),
  ]).nodes.length;
  assert.equal(examNames().length, 32);
  assert.equal(skillNames().length, 20);
  assert.equal(after - before, 52);
});
