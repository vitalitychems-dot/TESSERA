import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

export const SOURCE = JSON.parse(readFileSync(join(dir, "SOURCE.json"), "utf8"));

/** Fixed public subset. Throws if the vendored file does not match the pinned hash. */
export function loadSubset() {
  const bytes = readFileSync(join(dir, SOURCE.subset.file));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== SOURCE.subset.sha256) {
    throw new Error(`GSM8K subset sha256 mismatch: ${sha256}`);
  }
  const items = bytes
    .toString("utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const row = JSON.parse(line);
      return { index, question: row.question, answer: row.answer };
    });
  if (items.length !== SOURCE.subset.n) {
    throw new Error(`GSM8K subset length ${items.length} !== ${SOURCE.subset.n}`);
  }
  return items;
}
