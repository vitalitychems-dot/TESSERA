import { pickRecall, type RecallRow } from "./recall-all.ts";
import { SCHOOL_PASSAGES } from "./school.ts";

/** The matcher before this pass. A short name scored 1 and was thrown away. Accents did not match. */
export function pickPlain(query: string, rows: RecallRow[]) {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5);
  if (!tokens.length) return null;
  let best: RecallRow | null = null;
  let score = 0;
  for (const row of rows) {
    const hay = row.t.toLowerCase();
    let next = 0;
    for (const token of tokens) if (hay.includes(token)) next += token.length >= 8 ? 2 : 1;
    if (next > score) {
      score = next;
      best = row;
    }
  }
  if (!best || score < 2) return null;
  return best.t;
}

export const QUIZ = [
  { q: "god of the underworld Hades", needle: "King of the underworld" },
  { q: "photoelectric effect", needle: "photoelectric" },
  { q: "Peripatetic school Lyceum", needle: "Lyceum" },
  { q: "alternating current Tesla", needle: "alternating current" },
  { q: "Republic Jowett", needle: "Jowett" },
  { q: "Character Analysis Reich", needle: "Character Analysis" },
  { q: "founder of psychoanalysis", needle: "psychoanalysis" },
  { q: "medieval guilds of stonemasons", needle: "stonemasons" },
  { q: "Our Lady of Fatima", needle: "shepherd children" },
  { q: "Jowett", needle: "Jowett" },
  { q: "who founded the Academy", needle: "founder of the Academy" },
  { q: "High Renaissance Raphael", needle: "Raphael" },
] as const;

export function quizScore(answer: (q: string, rows: RecallRow[]) => string | null, rows: RecallRow[]) {
  return QUIZ.filter((item) => {
    const text = answer(item.q, rows);
    return Boolean(text && text.toLowerCase().includes(item.needle.toLowerCase()));
  }).length;
}

export function schoolRows(): RecallRow[] {
  return SCHOOL_PASSAGES.map((passage) => ({ s: `school/${passage.id}`, t: passage.text }));
}

export function measureGains(indexRows: RecallRow[]) {
  const before = quizScore(pickPlain, indexRows);
  const folded = quizScore((q, rows) => pickRecall(q, rows, [])?.text ?? null, indexRows);
  const withSchool = quizScore((q, rows) => pickRecall(q, rows, [])?.text ?? null, indexRows.concat(schoolRows()));
  return [
    { n: 1, change: "old matcher, index only", score: before },
    { n: 2, change: "accents, a short name, and the phrase", score: folded },
    { n: 3, change: "school passages added to the same search", score: withSchool },
  ];
}
