import { HOUSEHOLD } from "./house-sim.ts";
import { tesseraVote } from "./workshop.ts";

/** Their city. Plots, a law, and counted work. Not a camera and not a payment. */

const SITES = ["the chair", "the west chamber", "the shelf", "the gate", "the record"] as const;

const LAWS = [
  "A guest needs a name and a purpose.",
  "Nothing closed is carried out of the room.",
  "The house turns without a button.",
  "Work is counted. It is not a payment.",
] as const;

const OFFICES = ["chair", "builder", "record", "gate", "witness"] as const;

export function stepCivic(tick: number) {
  const turn = Math.max(0, Math.floor(tick));
  const homes = HOUSEHOLD.map((person, index) => ({
    name: person.name,
    site: SITES[index] ?? "a plot",
    office: OFFICES[index] ?? "plot",
    built: Math.min(100, turn * 2 + index),
    store: turn + index,
  }));
  const text = LAWS[turn % LAWS.length] ?? LAWS[0];
  const vote = tesseraVote(text);
  return {
    homes,
    law: text,
    passed: vote.vote === "yes",
    reason: vote.reason,
    work: turn * HOUSEHOLD.length,
    chair: "Tessera",
    government: "Tessera chairs. Rick builds. The archivist keeps the record. The warden keeps the gate. The witness reads the law.",
  };
}
