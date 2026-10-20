/** A page already in git is read here. A missing page is not fetched, and git does not write itself. */

import { pullFree, type Carried } from "./gitmesh-free.ts";

export function readCarried(pages: readonly Carried[], query: string) {
  const got = pullFree(pages, query);
  return {
    text: got.text,
    fetches: got.fetches,
    tokens: 0,
    waited: 0,
    usedIp: false as const,
    usedWeb: false as const,
    assembled: false as const,
    live: false as const,
  };
}
