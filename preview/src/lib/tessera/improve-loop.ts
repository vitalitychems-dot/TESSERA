import { meanSquare, queryOk, riseState, sanitize, top1 } from "./checkout-steps.ts";
import { formatTime, confidence, chem } from "./checkout-steps.ts";
import { pxName, scaleAction, versionOk } from "./root-skills.ts";

/** Each question is graded against the function. A stored line that disagrees is wrong. */

type Ask = { q: string; answer: () => string };

const WAVES: Ask[][] = [
  [
    { q: "scale low", answer: () => String(scaleAction(-1, 0, 10)) },
    { q: "scale high", answer: () => String(scaleAction(1, 0, 10)) },
    { q: "version ok", answer: () => String(versionOk("1.2.3")) },
    { q: "template", answer: () => pxName("src/foo.in") },
  ],
  [
    { q: "square gap", answer: () => String(meanSquare([1, 2], [1, 0])) },
    { q: "top score", answer: () => String(top1([[0, 1], [1, 0]], [1, 0])) },
    { q: "tag removed", answer: () => sanitize(" <b>hi</b> ") },
    { q: "half millisecond", answer: () => formatTime(0.5) },
  ],
  [
    { q: "missed goal", answer: () => String(confidence(false, 1, 1)) },
    { q: "serotonin five", answer: () => String(chem(5).serotonin) },
    { q: "hunger rise", answer: () => String(riseState(0.5, 0.5).hunger) },
    { q: "script refused", answer: () => String(queryOk("<script>")) },
  ],
];

const EXAM = WAVES.flat();

function row(item: Ask) {
  return `${item.q} = ${item.answer()}`;
}

export function examScore(memory: readonly string[]) {
  return EXAM.filter((item) => memory.includes(row(item))).length;
}

export function teachWave(memory: readonly string[], wave: number) {
  const items = WAVES[wave] ?? [];
  const next = memory.filter((line) => {
    const asked = items.find((item) => line.startsWith(`${item.q} =`));
    return !asked || line === row(asked);
  });
  for (const item of items) {
    const kept = row(item);
    if (!next.includes(kept)) next.push(kept);
  }
  return next;
}

export function improveLoops() {
  const scores: number[] = [examScore([])];
  let memory: string[] = ["scale low = 5"];
  for (let wave = 0; wave < WAVES.length; wave += 1) {
    memory = teachWave(memory, wave);
    scores.push(examScore(memory));
  }
  const again = examScore(teachWave(memory, 0));
  const gained = scores.slice(1).every((score, index) => score > scores[index]);
  const proved = scores[0] === 0 && gained && scores[scores.length - 1] === EXAM.length && again === EXAM.length && !memory.includes("scale low = 5");
  return {
    proved,
    scores,
    said: proved
      ? `Exam ${scores.join(", then ")}. Each wave raised the score. Teaching the same wave again stayed at ${again}. A wrong 5 was replaced.`
      : "A wave did not raise the score.",
  };
}
