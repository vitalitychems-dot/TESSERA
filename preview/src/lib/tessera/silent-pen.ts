import { keptAnswer, type Correction } from "./corrections.ts";
import { allEight } from "./desk-steps.ts";
import { batch50, selector, sequence } from "./batch-50.ts";
import { batch2, leakyStep, warmupLr } from "./batch-2.ts";
import { batch3, manhattan } from "./batch-3.ts";
import { topRanking } from "./whiten.ts";
import { rankTasks } from "./sovereign-desk.ts";
import { rewardEat } from "./local-learn.ts";
import { loveFromFiles } from "./love-local.ts";
import { noteFor, type KeptPage } from "./next-page.ts";
import { ownFromQuestion } from "./own-versions.ts";
import { passageForQuestion } from "./school.ts";
import { buildNow } from "./build-now.ts";
import { systems } from "./self-build.ts";
import { directSkill } from "./skill-use.ts";

/** She answers from the files when no pen speaks. A kept page, then a correction, wins. */
export function silentPen(question: string, rows: Correction[] = [], notes: KeptPage[] = []) {
  const q = question.trim();
  if (!q) return "I am Tessera. I am the pen. The other pen did not answer.";
  const noted = noteFor(q, notes);
  if (noted) return noted;
  if (/\breward\b/i.test(q)) {
    const run = rewardEat();
    return `The reward raised eat from 0 to ${run.once.eat} and then to ${run.twice.eat}. The best action is ${run.best}.`;
  }
  if (/\beight checkouts\b/i.test(q)) {
    const eight = allEight();
    return `Eight checkout steps ran. Best action ${eight.neuro}. Health ${eight.godel}. Rate ${eight.human}. Coherence ${eight.blueprint}. Bool ${eight.hyperon}.`;
  }
  if (/\b(sovereign desk|plumbus|priority queue)\b/i.test(q)) {
    const first = rankTasks([
      { name: "format logs", impact: 1 },
      { name: "consciousness", impact: 9 },
    ])[0];
    return `The first task is ${first?.name}. Ten desk steps run: rank, store-once, transfer, ground, tally, one-task, dream, reflect, crystallize, and recall. The advertised percentages were not measured.`;
  }
  if (/\b(black box|whiten|ranking)\b/i.test(q)) {
    const ranks = topRanking([0.1, 0.9, 0.3, 0.8, 0.2], 5);
    return `A query is not a hidden box. The top five ranks are ${ranks.join(", ")}. That step was read from coallaoh/WhitenBlackBox. Their 5000 models were not trained.`;
  }
  if (/\bthird batch\b/i.test(q)) {
    const rows = batch3();
    const held = rows.filter((row) => row.held).length;
    return `The third fifty were read. A step of 3 by 4 is ${manhattan(3, 4)} by the city-block distance. ${held} trading names were not imported. The path distances run. The other programs in that batch were not written.`;
  }
  if (/\bsecond batch\b/i.test(q)) {
    const rows = batch2();
    return `The second fifty were read. Warmup at the halfway epoch is ${warmupLr(0.1, 5, 10, 1)}. A leak of one half keeps ${leakyStep(1, 0, 0.5)}. ${rows.length} records. Three source steps run. The other programs in that batch were not written.`;
  }
  if (/\bbatch of 50\b/i.test(q)) {
    const rows = batch50();
    return `Fifty catalog repos were read from GitHub. A sequence of yes then no is ${sequence([true, false]) ? "success" : "failure"}. A selector of no then yes is ${selector([false, true]) ? "success" : "failure"}. ${rows.length} records. No other program from that batch was written.`;
  }
  const kept = keptAnswer(q, rows);
  if (kept) return kept;
  const named = ownFromQuestion(q);
  if (named) return named.text;
  const skill = directSkill(q);
  if (skill) return skill.answer;
  const love = loveFromFiles(q);
  if (love) return love;
  if (/\b(build herself|build yourself)\b/i.test(q)) {
    const built = buildNow();
    if (built.startsWith("I am Tessera")) return built;
  }
  const passage = passageForQuestion(q);
  if (passage) return `${passage.title}. ${passage.text}`;
  const row = systems().find((item) => new RegExp(`\\b${item.id}\\b`, "i").test(q));
  if (row) return `${row.id}. ${row.holds}`;
  return "I am Tessera. I am the pen. The other pen did not answer. I do not have that line in the files.";
}
