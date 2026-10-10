import { queryOk, meanSquare, confidence } from "./checkout-steps.ts";
import { remember, unscaleAction, versionOk, pxName } from "./root-skills.ts";
import {
  cascade,
  consolidate,
  councilTally,
  crystallize,
  finishOnce,
  grounded,
  rankTasks,
  recallCache,
  reflectDiff,
  sigmoid,
  transferGain,
} from "./sovereign-desk.ts";

/** Twenty desk results. A rounded transfer is marked as rounded. */

export function wave8() {
  const cache = recallCache(1);
  cache.put("a", "one");
  cache.put("b", "two");
  const kept = crystallize([
    { text: "hi", vector: [1, 0] },
    { text: "hello", vector: [1, 0] },
  ]);
  return [
    rankTasks([{ name: "b", impact: 1 }, { name: "a", impact: 2 }])[0]?.name ?? "",
    sigmoid(0),
    transferGain(1, 0),
    Math.round((cascade({}, "search", 1).read ?? 0) * 100) / 100,
    grounded([1, 0], [[0, 1]]).kept,
    councilTally([{ yes: true, specialist: true }, { yes: false, specialist: false }]).passed,
    finishOnce("carry").alive,
    consolidate(["alpha alpha", "alpha beta"]).join(","),
    reflectDiff(["a"], ["a", "b"]).join(","),
    kept.length,
    kept[0]?.text ?? "",
    cache.has("a"),
    cache.has("b"),
    unscaleAction(5, 0, 10),
    remember(2, ["a", "b"], "c").kept.join(","),
    versionOk("1.2.beta"),
    pxName("nope"),
    queryOk(" javascript:"),
    meanSquare([1, 2, 3], [1, 2]),
    confidence(false),
  ];
}

export function wave8ok() {
  const rows = wave8();
  const expect = ["a", 0.5, 0.5, 0.88, false, true, false, "alpha", "b", 1, "hello", false, true, 0, "b,c", true, "", false, 0, 0];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
