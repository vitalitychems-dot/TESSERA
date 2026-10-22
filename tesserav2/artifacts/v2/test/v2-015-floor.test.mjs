import assert from "node:assert/strict";
import test from "node:test";
import { STUDIO_3D_ENABLED, buildStudio } from "../src/studio/floor.mjs";
import { createStudio, renderStudio } from "../src/studio/wall.mjs";

test("the 3D floor is on by default and the 2D wall is a page toggle", () => {
  const previous = process.env.TESSERA_ENABLE_STUDIO_3D;
  process.env.TESSERA_ENABLE_STUDIO_3D = "0";
  try {
    assert.equal(STUDIO_3D_ENABLED, true);
    assert.deepEqual(buildStudio(), { ok: true, mode: "3d" });
    assert.deepEqual(buildStudio({ view: "2d" }), { ok: true, mode: "2d" });
    assert.deepEqual(buildStudio({ enable3d: false }), { ok: true, mode: "2d" });
    const html = renderStudio(createStudio().state());
    assert.match(html, /id="floor-3d"/);
    assert.match(html, /id="task-wall"/);
    assert.match(html, /href="\/\?view=2d"/);
    const flat = renderStudio(createStudio().state(), { view: "2d" });
    assert.equal(flat.includes('id="floor-3d"'), false);
    assert.match(flat, /id="task-wall"/);
    assert.match(flat, /href="\/"/);
  } finally {
    if (previous === undefined) delete process.env.TESSERA_ENABLE_STUDIO_3D;
    else process.env.TESSERA_ENABLE_STUDIO_3D = previous;
  }
});
