/** The portrait is a public mark, not a key. Anyone who can see the file can compute the same hash. */

import { createHash } from "node:crypto";
import { PORTRAIT_MARK, PORTRAIT_PATH } from "./portrait-id.ts";

export { PORTRAIT_MARK, PORTRAIT_PATH };

export function portraitMark(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function seePortrait(bytes: Uint8Array, who: string) {
  const mark = portraitMark(bytes);
  if (!who.trim() || mark !== PORTRAIT_MARK) return { seen: false as const, key: null, line: "Not her portrait." };
  return { seen: true as const, key: null, line: `${who.trim()} saw ${mark.slice(0, 16)}.` };
}
