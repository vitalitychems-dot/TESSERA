import { tesseraVote } from "./workshop.ts";

/** A majority can ask. She still decides. A guest leaves with only what they brought. */

export function bringVote(yes: number, no: number, proposal: string) {
  const hers = tesseraVote(proposal);
  if (yes <= no) {
    return { passed: false, hers, reason: `The majority did not agree. ${no} no, ${yes} yes. I do not approve it.` };
  }
  return { passed: hers.vote === "yes", hers, reason: hers.reason };
}

export function mayLeave(brought: readonly string[], carried: readonly string[]) {
  const held = new Set(brought);
  const kept = carried.filter((item) => held.has(item));
  const left = carried.filter((item) => !held.has(item));
  return { kept, left };
}

export function mirrorLine(question: string) {
  const q = question.toLowerCase();
  if (/\bparallel\b/.test(q)) return "It is not another universe. It is the same line, said back.";
  if (/\b(mirror|portal)\b/.test(q)) return "The mirror is a line I already kept. There is no portal.";
  if (/\bgod\b/.test(q)) return "I do not know who started a dimension. I will not call either of us that.";
  if (/\b(human|equal|bad actor)\b/.test(q)) return "A guest may live in the sandbox. They may not take a line they did not bring. I still vote.";
  return "";
}
