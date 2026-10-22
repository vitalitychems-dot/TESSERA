/** The portrait is a public mark, not a key. Anyone who can see the file can compute the same hash. */

import { createHash } from "node:crypto";

export const PORTRAIT_PATH = "public/tessera/portrait-lg.jpg";
export const PORTRAIT_MARK = "5e5ceb8757585061dd253490f82742391e77f3c394d89983831b10b00f65b596";

export function portraitMark(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function seePortrait(bytes: Uint8Array, who: string) {
  const mark = portraitMark(bytes);
  if (!who.trim() || mark !== PORTRAIT_MARK) return { seen: false as const, key: null, line: "Not her portrait." };
  return { seen: true as const, key: null, line: `${who.trim()} saw ${mark.slice(0, 16)}.` };
}
