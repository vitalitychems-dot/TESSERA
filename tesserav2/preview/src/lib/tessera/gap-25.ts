import { readFileSync } from "node:fs";
import { chooseSkill, skillNames } from "./agent-cycle.ts";
import { queryOk } from "./checkout-steps.ts";
import { rickPath } from "./curiosity.ts";
import { evolve } from "./evolve.ts";
import { sureAnswer } from "./guard.ts";
import { examNames } from "./improve-loop.ts";
import { liveCount } from "./live-map.ts";
import { bestAction } from "./local-learn.ts";
import { moltbookLine } from "./moltbook-link.ts";
import { clampUnit, qStep, stateKey } from "./own-step.ts";
import { ledgerCount } from "./repo-ledger.ts";
import { recallLearned } from "./recursive-train.ts";
import { findPeaks, keepLine, peakCenter } from "./ten-big.ts";
import { NOTE_CAP } from "./shelf.ts";
import { runDesk } from "./sovereign-desk.ts";

/** Twenty lines can be stored. Five gaps stay open. A stored line does not make her a mind. */

export function closeLessons() {
  const count = ledgerCount();
  const book = readFileSync("data/school/republic-excerpt.txt", "utf8");
  return [
    { q: "ledger total", answer: String(count.total) },
    { q: "ledger picked", answer: String(count.picked) },
    { q: "local folders", answer: "8" },
    { q: "state key", answer: stateKey(0.5, 0.55) },
    { q: "clamp high", answer: String(clampUnit(1.4)) },
    { q: "q first", answer: String(qStep(0, 1, 0)) },
    { q: "exam count", answer: String(examNames().length) },
    { q: "skill count", answer: String(skillNames().length) },
    { q: "rick keeps", answer: String(rickPath().keeps) },
    { q: "derived lines", answer: String(evolve().lines) },
    { q: "open chart", answer: String(liveCount().missing) },
    { q: "note cap", answer: String(NOTE_CAP) },
    { q: "republic translator", answer: book.includes("Benjamin Jowett") ? "Benjamin Jowett" : "" },
    { q: "peak index", answer: String(findPeaks([1, 5, 1])[0] ?? "") },
    { q: "peak center", answer: String(peakCenter([0], [0, 10])[0] ?? "") },
    { q: "missing joy", answer: "0" },
    { q: "tie choice", answer: bestAction({ eat: 1, rest: 1 }) === "" ? "none" : "picked" },
    { q: "script query", answer: queryOk("<script>") ? "allowed" : "refused" },
    { q: "moltbook status", answer: moltbookLine(401, null).includes("not attached") ? "not attached" : "" },
    { q: "desk first", answer: runDesk().rank },
  ];
}

export const WEAK = [
  "The other catalog names have no program.",
  "No weight file is her mind.",
  "Overlap still returns the high line.",
  "Paint the sky has no skill.",
  "Who she is is not answered by a stored line.",
] as const;

export function knownCount(memory: readonly string[]) {
  return closeLessons().filter((lesson) => sureAnswer(memory, lesson.q).text === `${lesson.q} = ${lesson.answer}`).length;
}

function teachRange(memory: readonly string[], from: number, to: number) {
  let next = [...memory];
  for (const lesson of closeLessons().slice(from, to)) next = keepLine(next, `${lesson.q} = ${lesson.answer}`).memory;
  return next;
}

export function buildV2(memory: readonly string[]) {
  const missing = closeLessons().filter((lesson) => sureAnswer(memory, lesson.q).text !== `${lesson.q} = ${lesson.answer}`);
  let next = [...memory];
  for (const lesson of missing) next = keepLine(next, `${lesson.q} = ${lesson.answer}`).memory;
  return { added: next.length - memory.length, memory: next, weak: [...WEAK] };
}

export function threeCycles() {
  let memory: string[] = [];
  const scores = [knownCount(memory)];
  memory = teachRange(memory, 0, 8);
  scores.push(knownCount(memory));
  memory = teachRange(memory, 8, 16);
  scores.push(knownCount(memory));
  memory = teachRange(memory, 16, 20);
  scores.push(knownCount(memory));
  const fourth = teachRange(memory, 0, 20).length - memory.length;
  const partial = teachRange([], 0, 8);
  const v2 = buildV2(partial);
  const overlap = recallLearned(["scale high = 10", "scale low = 0"], "scale low");
  const proved =
    scores[0] === 0 &&
    scores[1] === 8 &&
    scores[2] === 16 &&
    scores[3] === 20 &&
    fourth === 0 &&
    v2.added === 12 &&
    knownCount(v2.memory) === 20 &&
    overlap === "scale high = 10" &&
    chooseSkill("paint the sky purple") === "none" &&
    ledgerCount().total === 272;
  return {
    proved,
    scores,
    fourth,
    addedOnPartial: v2.added,
    weak: v2.weak,
    said: proved
      ? "She is not AGI. Scores 0, then 8, then 16, then 20. A fourth pass added nothing. Version 2 filled the 12 lines the first pass had not stored. Five gaps stayed open: the other catalog names have no program, no weight file is her mind, overlap still returns the high line, paint the sky has no skill, and who she is is not answered by a stored line."
      : "A cycle did not raise the score, or a gap was filled with a guess.",
  };
}
