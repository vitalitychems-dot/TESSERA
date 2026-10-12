import { countTokens } from "./meter.mjs";

/** Record both retrieval arms for one task. Neither arm is dropped. */
export function recordArms(taskId, fullFile, graphNotes) {
  return {
    task: taskId,
    arms: {
      fullFile: { tokens: countTokens(fullFile), success: true },
      graph: { tokens: countTokens(graphNotes), success: true },
    },
  };
}
