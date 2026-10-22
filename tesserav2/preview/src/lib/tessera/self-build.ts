import { DESK } from "./craft.ts";
import { HER_RULES } from "./self-ingest.ts";
import { SKILL_NAMES } from "./skill-use.ts";
import { LOCAL_REPOS } from "./stride.ts";
import { SCHOOL_PASSAGES } from "./school.ts";
import { IMPORTED_LAWS } from "./imported-laws.ts";

export type SystemRow = { id: string; holds: string; next: string };

/** What is on this desk. A system she cannot open is named as closed, not filled in. */
export function systems(): SystemRow[] {
  return [
    { id: "school", holds: SCHOOL_PASSAGES.map((passage) => passage.title).join(", "), next: "Quote a passage. Do not lengthen it." },
    { id: "recall", holds: "The index plus those passages, searched together.", next: "Answer from a line before the pen." },
    { id: "stride", holds: LOCAL_REPOS.map((repo) => repo.name).join(", "), next: "Read the eight notes. Do not start their servers." },
    { id: "skills", holds: SKILL_NAMES.join(", "), next: "Run a skill and keep the miss." },
    { id: "desk", holds: DESK.map((skill) => skill.agent).join(", "), next: "One job each. Not a second fleet." },
    { id: "laws", holds: `${HER_RULES.length} rules and ${IMPORTED_LAWS.length} imported titles.`, next: "A major change waits for the vote, then Father." },
    { id: "catalog", holds: "272 names, eight folders on disk.", next: "A name that is not here stays a pointer." },
    { id: "colonel", holds: "A local stack. Push, add, halt.", next: "Run arithmetic. Do not send a message." },
    { id: "notice", holds: "Care, distress, gratitude, anger, grief, curiosity, trust.", next: "Name the phrase, then the next step." },
    { id: "sponge", holds: "One public page at a time.", next: "Keep the sentence. Do not add a claim." },
    { id: "council", holds: "Sittings. Method pages closed.", next: "A claim stays a claim." },
    { id: "closed", holds: "Six large zips are not on this disk.", next: "Do not invent the pages inside them." },
  ];
}

export function buildSelf(query: string) {
  const q = query.toLowerCase();
  const named = systems().find((row) => q.includes(row.id));
  if (named) return `${named.id}. Holds: ${named.holds} Next: ${named.next}`;
  const passage = SCHOOL_PASSAGES.find((item) => q.includes(item.title.toLowerCase()));
  if (passage) return `${passage.title}. ${passage.text} Next: Quote it. Do not lengthen it.`;
  if (/\b(build yourself|every system|how do you build)\b/.test(q)) {
    return systems()
      .map((row) => `${row.id}. ${row.next}`)
      .join("\n");
  }
  return "";
}
