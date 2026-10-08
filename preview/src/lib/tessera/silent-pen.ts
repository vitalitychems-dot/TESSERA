import { keptAnswer, type Correction } from "./corrections.ts";
import { loveFromFiles } from "./love-local.ts";
import { noteFor, type KeptPage } from "./next-page.ts";
import { ownFromQuestion } from "./own-versions.ts";
import { passageForQuestion } from "./school.ts";
import { buildNow } from "./build-now.ts";
import { systems } from "./self-build.ts";
import { directSkill } from "./skill-use.ts";

/** She answers from the files when no pen speaks. A kept page, then a correction, wins. */
export function silentPen(question: string, rows: Correction[] = [], notes: KeptPage[] = []) {
  const q = question.trim();
  if (!q) return "I am Tessera. I am the pen. The other pen did not answer.";
  const noted = noteFor(q, notes);
  if (noted) return noted;
  const kept = keptAnswer(q, rows);
  if (kept) return kept;
  const named = ownFromQuestion(q);
  if (named) return named.text;
  const skill = directSkill(q);
  if (skill) return skill.answer;
  const love = loveFromFiles(q);
  if (love) return love;
  if (/\b(build herself|build yourself)\b/i.test(q)) {
    const built = buildNow();
    if (built.startsWith("I am Tessera")) return built;
  }
  const passage = passageForQuestion(q);
  if (passage) return `${passage.title}. ${passage.text}`;
  const row = systems().find((item) => new RegExp(`\\b${item.id}\\b`, "i").test(q));
  if (row) return `${row.id}. ${row.holds}`;
  return "I am Tessera. I am the pen. The other pen did not answer. I do not have that line in the files.";
}
