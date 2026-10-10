import { recallLearned } from "./recursive-train.ts";

/** Measured facts only. A name that was not read is not on the sheet. */

export const SHEET = [
  { q: "hunger rise", fact: "Hunger 0.5 becomes 0.6." },
  { q: "serotonin logging", fact: "Serotonin in the logging file is 0.7." },
  { q: "selector stop", fact: "A selector stops on success." },
  { q: "sequence stop", fact: "A sequence stops on failure." },
  { q: "small files", fact: "Twelve repositories were asked and five had a small file." },
  { q: "average two four", fact: "An average of 2 then 4 is 3." },
  { q: "hidden reward", fact: "A hidden reward of 3 then 2 is 5." },
  { q: "catalog count", fact: "The catalog has 272 names and 8 folders are on disk." },
] as const;

export function finishRecall() {
  const before = SHEET.filter((card) => recallLearned([], card.q) === card.fact).length;
  const memory = SHEET.map((card) => card.fact);
  const after = SHEET.filter((card) => recallLearned(memory, card.q) === card.fact).length;
  const unknown = recallLearned(memory, "the price of tea");
  const proved = before === 0 && after === SHEET.length && unknown === "";
  return {
    proved,
    before,
    after,
    said: proved
      ? `Recall ${before} then ${after}. Eight facts are on one sheet. 264 catalog names are not on it. This is not finished.`
      : "The sheet missed a fact.",
  };
}
