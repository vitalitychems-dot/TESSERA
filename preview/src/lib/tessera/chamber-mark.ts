/** A chamber mark in the mesh tongue. Another name cannot read it. Anyone with this source can. It is not a login key. */

import { SIGIL } from "./canon.ts";
import { readTongue, spell } from "./mesh-tongue.ts";

export const CHAMBER_AGENT = "tessera";
export const CHAMBER_SESSION = 7;
const LETTERS = "abcdefghijklmnop";

export function sigilWord(origin = SIGIL.short) {
  let hash = 2166136261;
  for (let i = 0; i < origin.length; i += 1) {
    hash ^= origin.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let n = hash >>> 0;
  let word = "";
  for (let i = 0; i < 8; i += 1) {
    word += LETTERS[n % LETTERS.length];
    n = Math.floor(n / 16);
  }
  return word;
}

export function chamberTongue(agent = CHAMBER_AGENT, session = CHAMBER_SESSION) {
  return spell(sigilWord(), agent, session);
}

export function readChamber(coded: string, agent: string, session: number) {
  if (agent !== CHAMBER_AGENT || session !== CHAMBER_SESSION) return "closed";
  return readTongue(coded, agent, session) === sigilWord() ? "open" : "closed";
}
