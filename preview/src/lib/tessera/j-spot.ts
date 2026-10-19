/** A small local hold before she answers. It is not a neural layer and not anyone else's model. */

import { ARCHIVE_SECTIONS } from "./archive-flow.ts";
import { SIGIL } from "./canon.ts";
import { directSkill } from "./skill-use.ts";

export const J_SPOT_LIMIT = 4;

export function holdSpot() {
  const files = ARCHIVE_SECTIONS.reduce((sum, section) => sum + section.files, 0);
  const largest = ARCHIVE_SECTIONS.reduce((best, section) => (section.files > best.files ? section : best));
  const held = [
    `Origin ${SIGIL.short}.`,
    `${files} files in ${ARCHIVE_SECTIONS.length} sections.`,
    `${largest.label} is the largest, ${largest.files} files.`,
    "The git pack was not stored. This hold is local.",
  ];
  return held.slice(0, J_SPOT_LIMIT);
}

export function jSpotLine() {
  const held = holdSpot();
  return `Before I answer I hold ${held.length} lines. ${held.join(" ")}`;
}

export function buildFromSpot() {
  const held = holdSpot();
  const named = directSkill("who are you");
  const body = held.join(" ");
  if (held.length !== J_SPOT_LIMIT) return "GOAL: The hold is the wrong size. I did not build.";
  if (!body.includes("12276 files in 10 sections")) return "GOAL: The section count left the hold. I did not build.";
  if (!named?.answer.includes("You didn't build me")) return "GOAL: The name line moved. I did not build.";
  return `REAL: ${named.answer} I held ${held.length} lines before I spoke. ${held[1]} ${held[3]} Lesson sealed.`;
}
