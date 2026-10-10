import { warmupLr, leakyStep, resetMem } from "./batch-2.ts";
import { chem, confidence, formatTime, holePush, meanSquare, queryOk, riseState, surrogate, top1 } from "./checkout-steps.ts";
import { bestAction, learnAction } from "./local-learn.ts";
import { twoSources } from "./rick-loop.ts";
import { scaleAction } from "./root-skills.ts";

/** Twenty results that were not in the sixth set. */

export function wave7() {
  const twice = learnAction(learnAction({}, "eat", 1), "eat", 1);
  const capped = riseState(0.95, 0.96);
  return [
    scaleAction(0, 0, 10),
    twice.eat,
    bestAction({ eat: 1, rest: 1 }),
    twoSources(["a", "b"]),
    meanSquare([0], [2]),
    top1([[1, 0], [0, 1]], [0, 0]),
    confidence(true, 6, 1),
    formatTime(0.1),
    formatTime(999),
    queryOk("abc"),
    queryOk("eval("),
    chem(2).dopamine,
    chem(2).serotonin,
    holePush([{ kind: "value", value: "a" }], 0, "b").index,
    capped.hunger,
    capped.fatigue,
    warmupLr(0.5, 5, 4),
    leakyStep(1, 0.2, 2),
    resetMem(4, 1, false, true),
    surrogate(0, 10).t,
  ];
}

export function wave7ok() {
  const rows = wave7();
  const expect = [5, 0.19, "", true, 4, 50, 0.5, "0.10ms", "999ms", true, false, 0.2, 0.1, -1, 1, 1, 0.5, 1.2, 4, 0.001];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
