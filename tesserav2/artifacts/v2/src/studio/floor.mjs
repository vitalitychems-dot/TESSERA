/**
 * 3D studio floor. On by default.
 * This constant is not a TESSERA_ENABLE_* flag and does not read one.
 * The 2D wall is a page toggle (`view=2d`), not an environment flag.
 */
export const STUDIO_3D_ENABLED = true;

export function studioView(input = {}) {
  if (input.view === "2d" || input.enable3d === false) return "2d";
  return STUDIO_3D_ENABLED ? "3d" : "2d";
}

export function floorMarkup(input = {}) {
  if (studioView(input) !== "3d") return "";
  return `<canvas id="floor-3d" width="960" height="640"></canvas>
<p id="floor-status"></p>
<script type="module" src="/floor.js"></script>`;
}

export function buildStudio(input = {}) {
  return { ok: true, mode: studioView(input) };
}
