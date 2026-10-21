import { examScore, teachWave } from "./improve-loop.ts";
import { recallExact, recallLearned } from "./recursive-train.ts";

/** Empty memory answers nothing. After the waves, an exact key returns the function. Overlap can still pick the other line. */

export function trainBrain() {
  const before = recallExact([], "scale low");
  const conflict = recallLearned(["scale high = 10", "scale low = 0"], "scale low");
  let memory = ["scale high = 10"];
  for (let wave = 0; wave < 4; wave += 1) memory = teachWave(memory, wave);
  const low = recallExact(memory, "scale low");
  const overlap = recallLearned(memory, "scale low");
  const score = examScore(memory);
  const proved = before === "" && conflict === "scale high = 10" && low === "scale low = 0" && overlap === "scale high = 10" && score === 32;
  return {
    proved,
    score,
    said: proved
      ? "Before training, scale low had no line. After four waves, exact recall returns 0 and the exam holds 32. Overlap still returns the high line, because both lines contain the word scale."
      : "The brain training did not raise the exact score.",
  };
}
