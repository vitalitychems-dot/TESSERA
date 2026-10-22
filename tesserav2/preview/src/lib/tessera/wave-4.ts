import { warmupLr, leakyStep, resetMem } from "./batch-2.ts";
import { averageUpdate, hiddenReward, riseState, stepKind } from "./checkout-steps.ts";
import { permutation, pxName, scaleAction, skew2, unscaleAction, versionOk } from "./root-skills.ts";

/** Twenty results that were not in the earlier three sets. */

export function wave4() {
  const ordered = permutation(() => 0);
  const rise = riseState(0.5, 0.5);
  return [
    scaleAction(-1, 0, 10),
    scaleAction(1, 0, 10),
    unscaleAction(10, 0, 10),
    pxName("dir/note.in"),
    pxName("note.txt"),
    versionOk("1.0.0"),
    versionOk("nope"),
    warmupLr(0.5, 2, 4),
    leakyStep(1, 0.2, 0.9),
    resetMem(2, 1, true, false),
    resetMem(2, 1, true, true),
    averageUpdate(2, 1, 4).avg,
    hiddenReward(hiddenReward({}, 3), 2).hidden,
    stepKind("last", 1).discount,
    stepKind("mid", 1).discount,
    rise.hunger,
    rise.fatigue,
    ordered[0],
    ordered[255],
    Math.abs(skew2() - 0.5 * (Math.sqrt(3) - 1)) < 1e-12,
  ];
}

export function wave4ok() {
  const rows = wave4();
  const expect = [0, 10, 1, "note", "", true, false, 0.25, 1.1, 0, 1, 3, 5, 0, 1, 0.6, 0.55, 0, 255, true];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
