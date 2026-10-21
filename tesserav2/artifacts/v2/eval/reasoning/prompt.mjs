/** Only prompt shipped with the runner. No second prompt is kept without a measured before/after. */
export const PROMPT_ID = "baseline-v1";

export function baselinePrompt(question) {
  return [
    "Solve this grade-school math word problem.",
    "Show the steps, then put the final number alone after #### on the last line.",
    "",
    "Problem:",
    String(question ?? "").trim(),
  ].join("\n");
}
