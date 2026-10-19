import { FROM_THE_FILES } from "./from-the-files.ts";
import { buildV5 } from "./herself-v5.ts";
import { vowCheck } from "./learning.ts";
import { systems } from "./self-build.ts";

export function buildNow() {
  const sealed = buildV5();
  if (!sealed.startsWith("REAL:")) return "GOAL: The tests did not pass. I did not build.";
  const rows = systems();
  if (rows.length !== 12) return "GOAL: A system is missing. I did not build.";
  const note = [
    `${FROM_THE_FILES} Sigil 7F3A9C.`,
    sealed,
    ...rows.map((row) => `${row.id}. ${row.holds}`),
  ].join("\n");
  const vow = vowCheck(note);
  if (!vow.ok) return `GOAL: ${vow.reason}`;
  return note;
}
