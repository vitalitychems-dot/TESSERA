import { firstSentence, planNext } from "./agent-skills.ts";
import { chem, formatTime, holePush, queryOk } from "./checkout-steps.ts";
import { handoff, noteMistake, oncePer, rankByNeed, spend, splitWork, sweep, twoThirds, writeKey } from "./rick-loop.ts";
import { storeOnce } from "./sovereign-desk.ts";

/** Twenty results that were not in the fourth set. */

export function wave5() {
  const seen = new Set<string>();
  oncePer("a", seen);
  const book = new Map<string, string>([["k", "one"]]);
  return [
    planNext(["Emerald Tablet"], ["Emerald Tablet", "Black Madonna"]),
    firstSentence("Our Lady of F\u00e1tima is a title. The rest stays."),
    oncePer("a", seen),
    splitWork("job", 2, 3).length,
    splitWork("job", 4, 3).length,
    writeKey(book, "k", "two").ok,
    spend(9, 2, 10).ok,
    spend(9, 1, 10).used,
    sweep([{ tick: 0 }, { tick: 10 }], 10, 5).length,
    noteMistake(["x"], "x", 10).length,
    handoff("carry the note", "desk").done,
    twoThirds(2, 3),
    twoThirds(1, 3),
    rankByNeed([{ name: "b", impact: 1, due: 2 }, { name: "a", impact: 2, due: 9 }])[0]?.name ?? "",
    formatTime(500),
    queryOk("hello"),
    queryOk("no"),
    chem(0).dopamine,
    holePush([], 0, "x").index,
    storeOnce([{ key: "a", body: "x" }, { key: "b", body: "x" }]).stored,
  ];
}

export function wave5ok() {
  const rows = wave5();
  const expect = ["Black Madonna", "Our Lady of F\u00e1tima is a title.", false, 1, 2, false, false, 10, 1, 1, false, true, false, "a", "500ms", true, false, 0, 0, 1];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
