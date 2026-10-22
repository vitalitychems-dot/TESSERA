import { firstSentence, planNext, sortNames } from "./agent-skills.ts";
import { chem, formatTime, holePush, queryOk, riseState } from "./checkout-steps.ts";
import { learnAction } from "./local-learn.ts";
import { handoff, noteMistake, oncePer, rankByNeed, spend, splitWork, sweep, twoThirds, writeKey } from "./rick-loop.ts";
import { storeOnce } from "./sovereign-desk.ts";

/** Twenty results that were not in the eighth set. */

export function wave9() {
  const seen = new Set<string>();
  const book = new Map<string, string>();
  const still = riseState(0.2, 0.2, 0);
  const hole = holePush([{ kind: "hole", next: 3 }], 0, "z");
  return [
    learnAction({ eat: 0 }, "eat", 1, 0.1, 0.9, 1).eat,
    twoThirds(0, 0),
    oncePer("a", seen),
    writeKey(book, "k", "one").ok,
    spend(8, 2, 10).used,
    sweep([{ tick: 0 }], 10, 5).length,
    noteMistake(["x"], "y", 10).length,
    handoff("  carry  ", "desk").ask,
    splitWork("job", 3, 3).length,
    rankByNeed([{ name: "b", impact: 1, due: 2 }, { name: "a", impact: 1, due: 1 }])[0]?.name ?? "",
    firstSentence("no stop here"),
    planNext(["one"], ["one"]),
    sortNames(["b", "a", "a", " "]).join(","),
    hole.firstHole,
    chem(5).dopamine,
    formatTime(1000),
    queryOk(" exec("),
    still.hunger,
    still.fatigue,
    storeOnce([{ key: "a", body: "x" }, { key: "b", body: "y" }]).stored,
  ];
}

export function wave9ok() {
  const rows = wave9();
  const expect = [0.19, false, true, true, 10, 0, 2, "carry", 1, "a", "no stop here", "none left", "a,b", 3, 0, "1.00s", false, 0.2, 0.2, 2];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
