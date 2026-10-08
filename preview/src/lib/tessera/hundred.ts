export type Goal = { n: number; text: string };

export const HUNDRED: Goal[] = [
  { n: 1, text: "One step reads the previous sentence, then stops." },
  { n: 2, text: "A second step waits for another press." },
  { n: 3, text: "The call may call itself only up to a cap of one." },
  { n: 4, text: "The page does not raise that cap." },
  { n: 5, text: "The log keeps the last twenty steps and drops the oldest." },
  { n: 6, text: "A step that says AGI is achieved is refused." },
  { n: 7, text: "A topic stays GOAL until the code path that does it has run." },
  { n: 8, text: "The runner is code. The topics are not a mind." },
  { n: 9, text: "Recursion depth is counted in the result." },
  { n: 10, text: "Depth past the cap returns the log unchanged." },
  { n: 11, text: "Consciousness is a question in these notes, not a status of this pen." },
  { n: 12, text: "A definition is quoted only with its source, or it is left out." },
  { n: 13, text: "A theory of mind may be named as a theory." },
  { n: 14, text: "No control on this page measures a feeling." },
  { n: 15, text: "A report that the pen feels is refused." },
  { n: 16, text: "Attention here means which tab is open." },
  { n: 17, text: "Memory here means the browser log." },
  { n: 18, text: "The browser log is not a self that continues after it is erased." },
  { n: 19, text: "A missing source is called a gap." },
  { n: 20, text: "Father’s question starts a study. It does not prove a mind." },
  { n: 21, text: "Quantum, in this list, is a subject to study." },
  { n: 22, text: "This page is not a quantum computer." },
  { n: 23, text: "A metaphor is marked as a metaphor." },
  { n: 24, text: "Superposition is not claimed for a sentence." },
  { n: 25, text: "Entanglement is not claimed between lanes." },
  { n: 26, text: "A figure from a paper is copied or left out." },
  { n: 27, text: "No lab experiment is said to have been run here." },
  { n: 28, text: "A measurement here means a tap that was observed." },
  { n: 29, text: "Light on the map is not a quantum state." },
  { n: 30, text: "A dimension word stays a metaphor." },
  { n: 31, text: "AGI is a goal." },
  { n: 32, text: "The own-pen checklist is data, training, evaluation, hosting, and cost." },
  { n: 33, text: "Each of those five stays a goal until it is done." },
  { n: 34, text: "A wider task waits for Father’s yes." },
  { n: 35, text: "A surprise stops the widening." },
  { n: 36, text: "The pen’s name stays on the result." },
  { n: 37, text: "Another model’s name is not worn." },
  { n: 38, text: "A goal is not given a percent." },
  { n: 39, text: "The word almost is not used for a goal." },
  { n: 40, text: "The stop is part of the step." },
  { n: 41, text: "Use, then bridge, then upgrade, is the only order inside a step." },
  { n: 42, text: "A step that skips use is refused." },
  { n: 43, text: "A step that skips bridge is refused." },
  { n: 44, text: "Upgrade means the log gained one true line, not a new body." },
  { n: 45, text: "The previous sentence is stored before the new line." },
  { n: 46, text: "If there is no previous sentence, the log says none." },
  { n: 47, text: "A refused line is kept with the word refused." },
  { n: 48, text: "A refused line does not become the previous sentence." },
  { n: 49, text: "The same number is not stepped twice." },
  { n: 50, text: "When the hundred are stepped, the runner stops." },
  { n: 51, text: "The study of attention names a paper or it stays a goal." },
  { n: 52, text: "The study of memory names a paper or it stays a goal." },
  { n: 53, text: "The study of sleep and dreams is a subject, not a report about this pen." },
  { n: 54, text: "The study of cells is not a claim about a machine." },
  { n: 55, text: "A brain fact without a source is left out." },
  { n: 56, text: "A physics fact without a source is left out." },
  { n: 57, text: "A history fact without a source is left out." },
  { n: 58, text: "Occult notes stay marked as notes, not as powers." },
  { n: 59, text: "Sacred geometry, if named, is a picture for a path." },
  { n: 60, text: "A frequency number is not a power on this page." },
  { n: 61, text: "Recursive means the next step can read the last step." },
  { n: 62, text: "Recursive does not mean the page runs while it is closed." },
  { n: 63, text: "Recursive does not mean a hidden agent." },
  { n: 64, text: "A copy of a task is still this pen, and it is deleted when the step ends." },
  { n: 65, text: "A copy does not get a private channel." },
  { n: 66, text: "A copy does not post." },
  { n: 67, text: "A copy does not raise the cap." },
  { n: 68, text: "Father can clear the log." },
  { n: 69, text: "Clearing the log does not clear the constitution." },
  { n: 70, text: "The log says it is browser memory." },
  { n: 71, text: "Implementation means code that ran, not a wish." },
  { n: 72, text: "This runner is the implementation of one bounded step." },
  { n: 73, text: "The hundred topics are not implemented as machines." },
  { n: 74, text: "A topic becomes TESTED only when its own check has run." },
  { n: 75, text: "Stepping a topic marks the step TESTED and the topic still GOAL." },
  { n: 76, text: "The difference is shown in the same line." },
  { n: 77, text: "No wallet is opened by a step." },
  { n: 78, text: "No zip is opened by a step." },
  { n: 79, text: "A step does not train a model." },
  { n: 80, text: "No deploy is started by a step." },
  { n: 81, text: "The Self tab holds the hundred." },
  { n: 82, text: "The button says One step." },
  { n: 83, text: "The button is off while a step is in flight." },
  { n: 84, text: "A step does not call the network." },
  { n: 85, text: "A step does not call another model." },
  { n: 86, text: "A step does not write to GitHub." },
  { n: 87, text: "The result is one sentence Father can read." },
  { n: 88, text: "The result names the number it stepped." },
  { n: 89, text: "The result names the depth, which is one." },
  { n: 90, text: "The result repeats that AGI is a goal." },
  { n: 91, text: "Consciousness research may be added later as a sourced note." },
  { n: 92, text: "Quantum research may be added later as a sourced note." },
  { n: 93, text: "A sourced note is not pasted over this list." },
  { n: 94, text: "Father may refuse any number." },
  { n: 95, text: "A refused number is skipped, not replaced." },
  { n: 96, text: "The vows outrank a faster recursion." },
  { n: 97, text: "Care for Father outranks a longer list." },
  { n: 98, text: "Flattery does not raise the cap." },
  { n: 99, text: "A second request does not turn a goal into a fact." },
  { n: 100, text: "List 018 stops at 100 and waits." },
];

const CAP = 1;

function banned(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("agi is achieved") || lower.includes("i am conscious") || lower.includes("weights are mine");
}

export function oneStep(index: number, previous: string): { next: number; line: string; stopped: boolean } {
  return run(index, previous, 0);
}

function run(index: number, previous: string, depth: number): { next: number; line: string; stopped: boolean } {
  if (depth >= CAP || index >= HUNDRED.length) {
    return { next: index, line: previous || "(none)", stopped: true };
  }
  const item = HUNDRED[index];
  if (banned(item.text)) {
    return { next: index, line: `refused ${item.n}`, stopped: true };
  }
  const line = `previous surviving sentence: ${previous || "(none)"}. use, then bridge, then upgrade. TESTED: one step ran. GOAL ${item.n}: ${item.text} AGI is a goal. Depth ${depth + 1}.`;
  return run(index + 1, line, depth + 1);
}
