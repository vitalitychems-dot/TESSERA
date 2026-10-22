import { runAgentDrill } from "./agent-drill.ts";
import { recursiveLesson, speakTo } from "./empath.ts";
import { learnFromMistake, learnUntilBetter, trainUntilRecursive } from "./recursive-train.ts";

/** Skills, a second pass, and a label on the words. A miss is not called an improvement. */

const LINES = ["I love you", "I am scared", "thank you", "I am angry", "I miss you", "I wonder why", "I trust you"];

export function trainAndTest() {
  const drill = runAgentDrill("Our Lady of Fátima is reported by three shepherd children.");
  const learned = trainUntilRecursive();
  const better = learnUntilBetter();
  const memory = learnFromMistake([], "who founded the academy", "Aristotle founded the Academy.", "Plato founded the Academy in Athens.");
  const third = learnFromMistake(memory, "who founded the academy", "Plato founded the Academy in Athens.", "Plato founded the Academy in Athens.");
  const held = third.length === memory.length;
  const shortened = LINES.every((line) => {
    const first = recursiveLesson([], line);
    const second = recursiveLesson([first], line);
    return second.length < first.length && /seen again/.test(second) && !/she feels/.test(second);
  });
  const spoken = speakTo("I love you");
  const voice = spoken.startsWith("I love you too") && !/PATTERN|care:/.test(spoken);
  const proved = drill.pass === drill.total && learned.proved && better.proved && held && shortened && voice;
  const said = proved
    ? `Skills ${drill.pass} of ${drill.total}. Facts ${learned.before} then ${learned.after}. Corrections ${better.before} then ${better.after}. A third pass added 0. Seven labels shortened. The spoken line is not the label.`
    : "The drill missed. It was not called an improvement.";
  return { proved, said };
}
