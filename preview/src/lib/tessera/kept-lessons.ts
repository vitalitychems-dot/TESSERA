import { answerFromCorrections, learnFromMistake } from "./recursive-train.ts";

/** The same five lines as data/school/corrections.jsonl. A test checks they match. */

export const KEPT_LESSONS = [
  { q: "who founded the academy", said: "Aristotle founded the Academy.", fact: "Plato founded the Academy in Athens." },
  { q: "photoelectric nobel", said: "Tesla received the Nobel Prize for the photoelectric effect.", fact: "Einstein received the 1921 Nobel Prize for the photoelectric effect." },
  { q: "alternating current", said: "Edison is known for alternating current.", fact: "Tesla is known for alternating current." },
  { q: "what is the sigil", said: "The sigil is 000000.", fact: "The sigil is 7F3A9C." },
  { q: "what hue is the ink", said: "The ink is gold.", fact: "The ink is navy." },
];

export function lessonFor(question: string) {
  const memory = KEPT_LESSONS.reduce((book, row) => learnFromMistake(book, row.q, row.said, row.fact), [] as string[]);
  return answerFromCorrections(memory, question.trim().toLowerCase());
}
