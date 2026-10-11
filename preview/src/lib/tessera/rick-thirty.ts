import { isPrivateHost } from "./address-guard.ts";
import { planNext, sortNames, firstSentence } from "./agent-skills.ts";
import { queryOk, sanitize } from "./checkout-steps.ts";
import { curiosityPath, pickNext, rickPath } from "./curiosity.ts";
import { derive } from "./evolve.ts";
import { teachWave } from "./improve-loop.ts";
import { bestAction } from "./local-learn.ts";
import { hitNode, liveCount } from "./live-map.ts";
import { recallExact, recallLearned } from "./recursive-train.ts";
import { strengthen, useLink, type Fact } from "./recursive-proof.ts";
import { noteMistake, oncePer, rankByNeed, spend, splitWork, sweep, twoSources } from "./rick-loop.ts";
import { remember } from "./root-skills.ts";
import { sureAnswer } from "./guard.ts";
import { keepNote } from "./shelf.ts";
import { pickSmallest } from "./sparse-read.ts";
import { storeOnce } from "./sovereign-desk.ts";
import { warmupLr } from "./sched.ts";
import { selector, sequence } from "./tree-steps.ts";

export type Effect = { name: string; before: string; after: string; better: boolean };

function stepsUntil(flags: boolean[], stopOn: boolean) {
  let count = 0;
  for (const flag of flags) {
    count += 1;
    if (flag === stopOn) break;
  }
  return count;
}

export function rickThirty(): Effect[] {
  const scale = ["scale high = 10", "scale low = 0"];
  const both: Fact[] = [
    { kind: "studied", who: "Aristotle", where: "Academy" },
    { kind: "founded", who: "Plato", where: "Academy" },
  ];
  const derived = derive(both, []).memory;
  const shelf = curiosityPath();
  const files = [
    { name: "big.py", size: 90000, type: "file" },
    { name: "small.py", size: 100, type: "file" },
  ];
  const seen = new Set<string>();
  oncePer("a", seen);
  const corrected = teachWave(["scale low = 5"], 0);
  const sentence = "Our Lady of Fátima is a title. The rest stays.";
  const rows: Effect[] = [
    { name: "keeps", before: String(shelf.path.length), after: String(rickPath().keeps), better: false },
    { name: "scale low", before: recallLearned(scale, "scale low"), after: recallExact(scale, "scale low"), better: false },
    { name: "one body", before: "2", after: String(storeOnce([{ key: "a", body: "x" }, { key: "b", body: "x" }]).stored), better: false },
    { name: "sequence steps", before: "3", after: String(stepsUntil([true, false, true], false)), better: false },
    { name: "selector steps", before: "3", after: String(stepsUntil([false, true, false], true)), better: false },
    { name: "memory cap", before: "3", after: String(remember(2, ["a", "b"], "c").kept.length), better: false },
    { name: "once", before: "2", after: oncePer("a", seen) ? "2" : "1", better: false },
    { name: "spend", before: "11", after: String(spend(9, 2, 10).used), better: false },
    { name: "small file", before: files[0].name, after: pickSmallest(files)?.name ?? "", better: false },
    { name: "mistake", before: "2", after: String(noteMistake(["x"], "x", 10).length), better: false },
    { name: "sweep", before: "2", after: String(sweep([{ tick: 0 }, { tick: 10 }], 10, 5).length), better: false },
    { name: "sources", before: "accepted", after: twoSources(["a"]) ? "accepted" : "refused", better: false },
    { name: "repeat derive", before: "2", after: String(derived.length + derive(both, derived).gained), better: false },
    { name: "no exact line", before: recallLearned(["scale high = 10"], "scale low"), after: sureAnswer(["scale high = 10"], "scale low").text, better: false },
    { name: "tie", before: "eat", after: bestAction({ eat: 1, rest: 1 }) || "none", better: false },
    { name: "rank", before: "b", after: rankByNeed([{ name: "b", impact: 1, due: 2 }, { name: "a", impact: 2, due: 9 }])[0]?.name ?? "", better: false },
    { name: "split", before: "2", after: String(splitWork("job", 2, 3).length), better: false },
    { name: "script", before: "allowed", after: queryOk("<script>") ? "allowed" : "refused", better: false },
    { name: "tag", before: " <b>hi</b> ", after: sanitize(" <b>hi</b> "), better: false },
    { name: "secret", before: "saved", after: keepNote("the password is here").ok ? "saved" : "refused", better: false },
    { name: "loopback", before: "public", after: isPrivateHost("127.0.0.1") ? "private" : "public", better: false },
    { name: "miss", before: String(strengthen(0.19)), after: String(useLink([{ from: "Plato", to: "Academy", weight: 0.19 }], "Plato", "Academy", false)[0]?.weight), better: false },
    { name: "next title", before: "Emerald Tablet", after: planNext(["Emerald Tablet"], ["Emerald Tablet", "Black Madonna"]), better: false },
    { name: "duplicates", before: "3", after: String(sortNames(["zeta", "alpha", "alpha"]).length), better: false },
    { name: "sentence", before: sentence, after: firstSentence(sentence), better: false },
    { name: "wrong five", before: "scale low = 5", after: corrected.find((line) => line.startsWith("scale low")) ?? "", better: false },
    { name: "empty topic", before: String(shelf.path.length + shelf.skipped.length), after: String(shelf.path.length), better: false },
    { name: "far tap", before: "role", after: hitNode(0, 0, [{ id: "role", x: 180, y: 36 }]) || "none", better: false },
    { name: "open nodes", before: "0", after: String(liveCount().missing), better: false },
    { name: "warmup", before: "0.5", after: String(warmupLr(0.5, 2, 4)), better: false },
  ];
  return rows.map((row) => ({ ...row, better: row.before !== row.after }));
}

export function strictAnswer(question: string) {
  const name = question.trim().toLowerCase();
  const row = rickThirty().find((item) => item.name === name);
  if (!row?.better) return null;
  return row.after;
}

export function rickThirtyLine() {
  const rows = rickThirty();
  const moved = rows.filter((row) => row.better).length;
  const sequenceOk = sequence([true, false, true]) === false;
  const selectorOk = selector([false, true, false]) === true;
  const first = pickNext([])?.category === "people";
  const proved = rows.length === 30 && moved === 30 && sequenceOk && selectorOk && first;
  return {
    proved,
    moved,
    rows,
    said: proved ? "30 of 30 changed. A row that stayed the same is not in the list." : `${moved} of ${rows.length} changed.`,
  };
}
