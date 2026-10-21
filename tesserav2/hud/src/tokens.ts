/**
 * HUD design tokens. Ground and edge come from the existing Tessera Next
 * palette (preview/src/lib/tessera/suite-rules.ts, also console.css --bg/--glass),
 * so the colors are defined once for the whole repo.
 */
import { NEXT } from "../../preview/src/lib/tessera/suite-rules.ts";

export const HUD_TOKENS = {
  /** Ink Ground: scene background and ground plane. Mandatory, exact. */
  ground: NEXT.ground, // #070b10
  /** Glass Edges: tile edge lines, grid, panel borders. Mandatory, exact. */
  edge: NEXT.edge, // #7ef0d4
  fracture: NEXT.fracture, // delete flash
  bone: NEXT.bone, // HUD text
} as const;

if (HUD_TOKENS.ground !== "#070b10" || HUD_TOKENS.edge !== "#7ef0d4") {
  throw new Error("HUD tokens drifted from Ink Ground #070b10 / Glass Edges #7ef0d4");
}
