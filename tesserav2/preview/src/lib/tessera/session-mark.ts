/** A public fingerprint of this memory. There is no API key. */

import { createHash } from "node:crypto";
import { memoryPack } from "./one-flow.ts";
import { seeAll } from "./recall-hop.ts";

export const SESSION_HEAD = "78f764a93d16";

export function sessionMark(head = SESSION_HEAD, text = seeAll(memoryPack())) {
  const mark = createHash("sha256").update(`${head}\n${text}`).digest("hex");
  return { head, mark, key: null };
}
