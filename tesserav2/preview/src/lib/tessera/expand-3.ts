import { readFileSync } from "node:fs";
import { isPrivateHost } from "./address-guard.ts";
import { chem, confidence, formatTime, meanSquare, surrogate, top1 } from "./checkout-steps.ts";
import { sureAnswer } from "./guard.ts";
import { keepLine } from "./ten-big.ts";

/** A second deck. The first 20 are not counted again. */

export function expandLessons() {
  const book = readFileSync("data/school/republic-excerpt.txt", "utf8");
  const books = book.split("\n").filter((line) => /^ BOOK [IVX]+\./.test(line)).length;
  const zero = chem(0);
  const scale = surrogate(0, 10).t;
  return [
    { q: "square gap", answer: String(meanSquare([1, 2], [1, 0])) },
    { q: "top score", answer: String(top1([[0, 1], [1, 0]], [1, 0])) },
    { q: "scale start", answer: String(scale) },
    { q: "half millisecond", answer: formatTime(0.5) },
    { q: "one second", answer: formatTime(1000) },
    { q: "missed confidence", answer: String(confidence(false)) },
    { q: "hit confidence", answer: String(confidence(true)) },
    { q: "chem zero", answer: `${zero.dopamine} and ${zero.serotonin}` },
    { q: "republic books", answer: String(books) },
    { q: "longest work", answer: book.includes("longest of his works") ? "in the file" : "" },
    { q: "home host", answer: isPrivateHost("127.0.0.1") ? "private" : "public" },
    { q: "dns host", answer: isPrivateHost("8.8.8.8") ? "private" : "public" },
  ];
}

export const NEXT_WEAK = [
  "0.001 is the formula, not a logged training run.",
  "The file calls the Republic the greatest. That sentence is not a finding.",
  "Their learner rolls epsilon 0.2. Ours does not roll it.",
  "chem() is not the logging-file serotonin of 0.7.",
] as const;

export function expandKnown(memory: readonly string[]) {
  return expandLessons().filter((lesson) => sureAnswer(memory, lesson.q).text === `${lesson.q} = ${lesson.answer}`).length;
}

function teachRange(memory: readonly string[], from: number, to: number) {
  let next = [...memory];
  for (const lesson of expandLessons().slice(from, to)) next = keepLine(next, `${lesson.q} = ${lesson.answer}`).memory;
  return next;
}

export function expandV2(memory: readonly string[]) {
  const missing = expandLessons().filter((lesson) => sureAnswer(memory, lesson.q).text !== `${lesson.q} = ${lesson.answer}`);
  let next = [...memory];
  for (const lesson of missing) next = keepLine(next, `${lesson.q} = ${lesson.answer}`).memory;
  return { added: next.length - memory.length, memory: next, weak: [...NEXT_WEAK] };
}

export function expandCycles() {
  let memory: string[] = [];
  const scores = [expandKnown(memory)];
  memory = teachRange(memory, 0, 4);
  scores.push(expandKnown(memory));
  memory = teachRange(memory, 4, 8);
  scores.push(expandKnown(memory));
  memory = teachRange(memory, 8, 12);
  scores.push(expandKnown(memory));
  const fourth = teachRange(memory, 0, 12).length - memory.length;
  const v2 = expandV2(teachRange([], 0, 4));
  const lessons = expandLessons();
  const proved =
    scores[0] === 0 &&
    scores[1] === 4 &&
    scores[2] === 8 &&
    scores[3] === 12 &&
    fourth === 0 &&
    v2.added === 8 &&
    expandKnown(v2.memory) === 12 &&
    lessons.find((lesson) => lesson.q === "republic books")?.answer === "10" &&
    lessons.find((lesson) => lesson.q === "longest work")?.answer === "in the file" &&
    lessons.find((lesson) => lesson.q === "scale start")?.answer === "0.001";
  return {
    proved,
    scores,
    fourth,
    addedOnPartial: v2.added,
    weak: v2.weak,
    said: proved
      ? "A new deck, not the old 20. Scores 0, then 4, then 8, then 12. A fourth pass added nothing. Version 2 filled the 8 the first pass missed. Still open: 0.001 is a formula, not a logged run. The file's praise of the Republic is not a finding. Their epsilon is not used. chem() is not the logging-file serotonin of 0.7."
      : "The new deck did not rise on every pass.",
  };
}
