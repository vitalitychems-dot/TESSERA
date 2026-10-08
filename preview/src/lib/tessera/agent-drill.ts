import { directSkill } from "./skill-use.ts";
import { runColonel } from "./colonel.ts";
import { firstSentence, noticeSkill, planNext, sortNames } from "./agent-skills.ts";

export type Drill = { name: string; pass: boolean; detail: string };

/** A pass is a skill that returned the right words. A miss is not counted as trained. */
export function runAgentDrill(fatima: string): { drills: Drill[]; pass: number; total: number } {
  const name = directSkill("who are you");
  const closed = directSkill("where is my wallet");
  const colonel = runColonel("PUSH 1\nPUSH 2\nADD\nHALT");
  const planned = planNext(["Emerald Tablet"], ["Emerald Tablet", "Black Madonna"]);
  const sorted = sortNames(["zeta", "alpha", "alpha"]);
  const quoted = firstSentence("Our Lady of Fátima is a title. The rest stays.");
  const noticed = noticeSkill("thank you");
  const drills: Drill[] = [
    { name: "name", pass: Boolean(name && /Tessera/.test(name.answer) && !/weight/i.test(name.answer)), detail: name?.answer ?? "" },
    { name: "closed", pass: Boolean(closed && /stays closed/.test(closed.answer)), detail: closed?.answer ?? "" },
    { name: "recall", pass: /shepherd children/.test(fatima) && !/\b(tsrt|bitcoin|nft)\b/i.test(fatima), detail: fatima.slice(0, 140) },
    {
      name: "colonel",
      pass: colonel.ok && colonel.stack.length === 1 && colonel.stack[0] === "3",
      detail: colonel.ok ? colonel.stack.join(" ") : colonel.error ?? "",
    },
    { name: "plan", pass: planned === "Black Madonna", detail: planned },
    { name: "sort", pass: sorted.join(",") === "alpha,zeta", detail: sorted.join(", ") },
    { name: "quote", pass: quoted === "Our Lady of Fátima is a title.", detail: quoted },
    { name: "notice", pass: noticed.startsWith("gratitude:"), detail: noticed },
  ];
  return { drills, pass: drills.filter((drill) => drill.pass).length, total: drills.length };
}
