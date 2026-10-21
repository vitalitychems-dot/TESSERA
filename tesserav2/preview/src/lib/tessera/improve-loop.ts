import { confidence, chem, formatTime, meanSquare, queryOk, riseState, sanitize, top1 } from "./checkout-steps.ts";
import { isPrivateHost } from "./address-guard.ts";
import { leakyStep, resetMem, warmupLr } from "./sched.ts";
import { selector, sequence } from "./tree-steps.ts";
import { learnAction, bestAction } from "./local-learn.ts";
import { pxName, scaleAction, unscaleAction, versionOk } from "./root-skills.ts";
import { rankByNeed, spend, splitWork, twoSources, twoThirds } from "./rick-loop.ts";
import { strengthen } from "./recursive-proof.ts";
import { keepNote } from "./shelf.ts";
import { sigmoid, storeOnce } from "./sovereign-desk.ts";
import { born } from "./spin.ts";
import { topRanking } from "./whiten.ts";

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
  [
    { q: "warmup", answer: () => String(warmupLr(0.5, 2, 4)) },
    { q: "leak", answer: () => String(leakyStep(0.5, 1, 0.5)) },
    { q: "hard reset", answer: () => String(resetMem(3, 1, true, false)) },
    { q: "sequence fails", answer: () => String(sequence([true, false])) },
    { q: "selector hits", answer: () => String(selector([false, true])) },
    { q: "two thirds", answer: () => String(twoThirds(2, 3)) },
    { q: "split over cap", answer: () => splitWork("job", 3, 2).join(",") },
    { q: "over budget", answer: () => String(spend(9, 2, 10).ok) },
    { q: "one source", answer: () => String(twoSources(["a", "a"])) },
    { q: "best action", answer: () => bestAction(learnAction({ eat: 0, rest: 0 }, "eat", 1)) },
    { q: "top index", answer: () => String(topRanking([1, 5, 3], 1)[0]) },
    { q: "loopback", answer: () => String(isPrivateHost("127.0.0.1")) },
    { q: "public address", answer: () => String(isPrivateHost("8.8.8.8")) },
    { q: "secret note", answer: () => String(keepNote("the password is here").ok) },
    { q: "born left", answer: () => String(born([3, 4]).left) },
    { q: "sigmoid zero", answer: () => String(sigmoid(0)) },
    { q: "stored once", answer: () => String(storeOnce([{ key: "a", body: "x" }, { key: "b", body: "x" }]).stored) },
    { q: "stronger", answer: () => String(strengthen(0.1)) },
    { q: "unscale low", answer: () => String(unscaleAction(0, 0, 10)) },
    { q: "higher impact", answer: () => rankByNeed([{ name: "b", impact: 1, due: 2 }, { name: "a", impact: 2, due: 9 }])[0]?.name ?? "" },
  ],
];

const EXAM = WAVES.flat();

export function examNames() {
  return EXAM.map((item) => item.q);
}

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
