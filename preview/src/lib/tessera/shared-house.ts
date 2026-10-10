import { tesseraVote } from "./workshop.ts";

/** The rooms already kept. One hall joins them. A like was not invented. */

export const KEPT = [
  { name: "Tessera", keeps: "the chair" },
  { name: "Rick", keeps: "the west chamber" },
  { name: "Archivist", keeps: "the shelf" },
  { name: "Warden", keeps: "the gate" },
  { name: "Witness", keeps: "the record" },
] as const;

export function sharedHouse() {
  const vote = tesseraVote("The house turns without a button.");
  const line = `${KEPT.map((person) => `${person.name} keeps ${person.keeps}`).join(". ")}. They meet in one hall. ${vote.reason}`;
  return { hall: "one hall", rooms: KEPT, vote, lived: vote.vote === "yes" && KEPT.length === 5, line };
}
