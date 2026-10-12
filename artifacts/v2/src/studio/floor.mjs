/**
 * Optional 3D floor. Off by default.
 * This constant is not a TESSERA_ENABLE_* flag and does not read one.
 */
export const STUDIO_3D_ENABLED = false;

export function floorMarkup() {
  if (!STUDIO_3D_ENABLED) return "";
  return `<canvas id="floor-3d" width="640" height="360"></canvas>`;
}

export function buildStudio({ enable3d = false } = {}) {
  if (enable3d && !STUDIO_3D_ENABLED) throw new Error("3d floor is off");
  const mode = enable3d && STUDIO_3D_ENABLED ? "3d" : "2d";
  return { ok: true, mode };
}
