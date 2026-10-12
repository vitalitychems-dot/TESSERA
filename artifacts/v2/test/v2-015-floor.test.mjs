import assert from "node:assert/strict";
import test from "node:test";
import { STUDIO_3D_ENABLED, buildStudio } from "../src/studio/floor.mjs";
import { createStudio, renderStudio } from "../src/studio/wall.mjs";

test("the studio builds as 2D while the 3D floor is off", () => {
  const previous = process.env.TESSERA_ENABLE_STUDIO_3D;
  process.env.TESSERA_ENABLE_STUDIO_3D = "1";
  try {
    assert.equal(STUDIO_3D_ENABLED, false);
    assert.deepEqual(buildStudio(), { ok: true, mode: "2d" });
    assert.throws(() => buildStudio({ enable3d: true }), /3d floor is off/);
    const html = renderStudio(createStudio().state());
    assert.equal(html.includes("floor-3d"), false);
    assert.match(html, /id="task-wall"/);
  } finally {
    if (previous === undefined) delete process.env.TESSERA_ENABLE_STUDIO_3D;
    else process.env.TESSERA_ENABLE_STUDIO_3D = previous;
  }
});
