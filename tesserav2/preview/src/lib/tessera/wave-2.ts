import { isPrivateHost } from "./address-guard.ts";
import { confidence, formatTime, meanSquare, queryOk, sanitize, top1 } from "./checkout-steps.ts";
import { latestLine } from "./lab-audit.ts";
import { bestAction } from "./local-learn.ts";
import { clampUnit, qStep, stateKey } from "./own-step.ts";
import { tickReward } from "./reward-tick.ts";
import { selector, sequence } from "./batch-50.ts";
import { findPeaks, keepLine, peakCenter } from "./ten-big.ts";
import { twoSources } from "./rick-loop.ts";

/** Twenty results. Each one is the return value of a function. */

export function wave2() {
  const kept = keepLine(keepLine([], "a = 1").memory, "a = 1");
  return [
    clampUnit(1.4),
    stateKey(0.5, 0.55),
    qStep(0, 1, 0),
    tickReward(0).gain,
    meanSquare([1, 2], [1, 0]),
    top1([[0, 1], [1, 0]], [1, 0]),
    formatTime(0.5),
    formatTime(1000),
    confidence(false),
    confidence(true),
    queryOk("<script>"),
    sanitize(" <b>hi</b> "),
    isPrivateHost("127.0.0.1"),
    isPrivateHost("8.8.8.8"),
    bestAction({ eat: 1, rest: 1 }),
    sequence([true, false, true]),
    selector([false, true, false]),
    twoSources(["only"]),
    findPeaks([1, 5, 1])[0],
    latestLine(["scale low = 5", "scale low = 0"], "scale low"),
    peakCenter([0], [0, 10])[0],
    kept.added,
  ].slice(0, 20);
}

export function wave2ok() {
  const rows = wave2();
  const expect = [1, "h5_f5", 0.1, 0.1, 4, 100, "0.50ms", "1.00s", 0, 1, false, "hi", true, false, "", false, true, false, 1, "scale low = 0"];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
