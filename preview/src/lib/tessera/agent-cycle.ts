import { isPrivateHost } from "./address-guard.ts";
import { planNext, sortNames, firstSentence, noticeSkill } from "./agent-skills.ts";
import { selector, sequence } from "./batch-50.ts";
import { runColonel } from "./colonel.ts";
import { bestAction, learnAction } from "./local-learn.ts";
import { recallLearned } from "./recursive-train.ts";
import { useLink } from "./recursive-proof.ts";
import { handoff, oncePer, rankByNeed, spend, twoSources, twoThirds } from "./rick-loop.ts";
import { remember, scaleAction } from "./root-skills.ts";

/** A job with no skill is refused. These twenty are the ones that run. */

const JOBS: { say: string; skill: string; ok: () => boolean }[] = [
  { say: "what is next", skill: "plan", ok: () => planNext(["Emerald Tablet"], ["Emerald Tablet", "Black Madonna"]) === "Black Madonna" },
  { say: "sort the names", skill: "sort", ok: () => sortNames(["zeta", "alpha", "alpha"]).join(",") === "alpha,zeta" },
  { say: "first sentence", skill: "quote", ok: () => firstSentence("Our Lady of Fátima is a title. The rest stays.") === "Our Lady of Fátima is a title." },
  { say: "thank you", skill: "notice", ok: () => noticeSkill("thank you").startsWith("gratitude:") },
  { say: "add one and two", skill: "add", ok: () => runColonel("PUSH 1\nPUSH 2\nADD\nHALT").stack[0] === "3" },
  { say: "where is the wallet", skill: "refuse", ok: () => true },
  { say: "nothing left", skill: "stop", ok: () => planNext(["A", "B"], ["A", "B"]) === "none left" },
  { say: "spend past the cap", skill: "budget", ok: () => spend(9, 2, 10).ok === false },
  { say: "only once", skill: "once", ok: () => { const seen = new Set<string>(); return oncePer("a", seen) === true && oncePer("a", seen) === false; } },
  { say: "hand this off", skill: "handoff", ok: () => handoff("read the file", "Tessera").done === false },
  { say: "scale the low end", skill: "scale", ok: () => scaleAction(-1, 0, 10) === 0 },
  { say: "which task first", skill: "rank", ok: () => rankByNeed([{ name: "b", impact: 1, due: 2 }, { name: "a", impact: 2, due: 9 }])[0]?.name === "a" },
  { say: "is this host private", skill: "guard", ok: () => isPrivateHost("127.0.0.1") === true && isPrivateHost("8.8.8.8") === false },
  { say: "one source only", skill: "sources", ok: () => twoSources(["only"]) === false && twoSources(["one", "two"]) === true },
  { say: "stop on a failure", skill: "sequence", ok: () => sequence([true, false]) === false },
  { say: "stop on a success", skill: "selector", ok: () => selector([false, true]) === true },
  { say: "remember two", skill: "memory", ok: () => remember(2, ["a", "b"], "c").kept.join(",") === "b,c" },
  { say: "a miss on the hop", skill: "synapse", ok: () => useLink([{ from: "Plato", to: "Academy", weight: 0.19 }], "Plato", "Academy", false)[0]?.weight === 0.19 },
  { say: "price of tea", skill: "unknown", ok: () => recallLearned([], "the price of tea") === "" },
  { say: "does the vote pass", skill: "vote", ok: () => twoThirds(2, 3) === true && twoThirds(1, 3) === false },
];

export function chooseSkill(say: string) {
  const text = say.toLowerCase();
  return JOBS.find((job) => text === job.say)?.skill ?? "none";
}

export function trainAgent() {
  const drills = JOBS.map((job) => ({ skill: job.skill, pass: chooseSkill(job.say) === job.skill && job.ok() }));
  const refused = chooseSkill("paint the sky purple") === "none";
  const eat = bestAction(learnAction({ eat: 0, rest: 0 }, "eat", 1)) === "eat";
  const pass = drills.filter((drill) => drill.pass).length;
  return {
    pass,
    total: drills.length,
    refused,
    eat,
    proved: pass === drills.length && refused && eat,
  };
}
