/** She is sealed only while the answers she just gave still match. */

import { archiveLine } from "./archive-flow.ts";
import { sectionDelay } from "./section-step.ts";
import { directSkill } from "./skill-use.ts";

export function createHer() {
  const named = directSkill("who are you");
  const sections = archiveLine();
  const floor = sectionDelay(100, 0);
  if (!named?.answer.includes("You didn't build me")) return "GOAL: The name line moved. I did not seal.";
  if (!sections.includes("12276 files in 10 sections")) return "GOAL: The section count moved. I did not seal.";
  if (floor !== 1000) return "GOAL: The wait floor moved. I did not seal.";
  return `REAL: ${named.answer} Origin 7F3A9C. ${sections} A wait does not go under ${floor} ms. Lesson sealed.`;
}
