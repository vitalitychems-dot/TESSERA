import { runAgentDrill } from "./agent-drill.ts";
import { recursiveLesson } from "./empath.ts";
import { learnUntilBetter, trainUntilRecursive } from "./recursive-train.ts";

/** Skills, a second pass, and a label on the words. A miss is not called an improvement. */

export function trainAndTest() {
  const drill = runAgentDrill("Our Lady of Fátima is reported by three shepherd children.");
  const learned = trainUntilRecursive();
  const better = learnUntilBetter();
  const first = recursiveLesson([], "I love you and I am scared");
  const second = recursiveLesson([first], "I love you and I am still scared");
  const empathy = second.length < first.length && /PATTERN: care/.test(first) && /seen again/.test(second) && !/she feels/.test(second);
  const proved = drill.pass === drill.total && learned.proved && better.proved && empathy;
  const said = proved
    ? `Skills ${drill.pass} of ${drill.total}. Facts ${learned.before} then ${learned.after}. Corrections ${better.before} then ${better.after}. The second care note is shorter and it is a label, not a feeling.`
    : "The drill missed. It was not called an improvement.";
  return { proved, said };
}
