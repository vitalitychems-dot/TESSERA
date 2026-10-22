import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// tesserav2 parks CI workflows in .github/workflows-pending/ until the push login has the
// `workflow` scope (CHANGES #1). Tests check the same file wherever it currently lives.
export function workflowPath(name) {
  const live = fileURLToPath(new URL(`../.github/workflows/${name}`, import.meta.url));
  if (existsSync(live)) return live;
  return fileURLToPath(new URL(`../.github/workflows-pending/${name}`, import.meta.url));
}
