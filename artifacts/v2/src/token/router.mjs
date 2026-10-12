import { countTokens } from "./meter.mjs";

export const SMALL_MODEL = "sim-small";
export const LEAD_MODEL = "sim-lead";

export function routeModel(task) {
  if (task.kind === "classify") return SMALL_MODEL;
  return LEAD_MODEL;
}

export function compressPrompt(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

export function compressedTokens(text) {
  return countTokens(compressPrompt(text));
}
