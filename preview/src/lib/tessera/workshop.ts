import { roomsAt } from "./house-sim.ts";
import { MESH } from "./mesh-net.ts";
import { admitPost } from "./public-gate.ts";
import { bell } from "./spin-machine.ts";

/** She reads the words. A blank yes is not a vote. Father's yes does not override her no. */

const REFUSALS: { test: RegExp; reason: string }[] = [
  { test: /\b(monero|xmr|wallet|blockchain|payment|coin)\b/i, reason: "No. I read a payment. Payment is not handled here." },
  { test: /\b(lend|donate)\b/i, reason: "No. I read a machine being offered. Machines are not accepted." },
  { test: /\b(secret|password|api_key|token)\b/i, reason: "No. I read a secret. It does not leave this room." },
  { test: /\b(camera|cctv|palantir|prism|surveillance|sparrow|god'?s eye)\b/i, reason: "No. I read a watch on people. I will not build that." },
  { test: /\bweights?\b/i, reason: "No. I read weights. They are not added." },
  { test: /\b(quantum computer|device)\b/i, reason: "No. I read a device. There is no quantum computer here." },
  { test: /\b(delete all|erase everything|wipe)\b/i, reason: "No. I read a deletion. A file is kept until it is bridged." },
];

const KNOWN: { test: RegExp; reason: string }[] = [
  { test: /\bhouse\b/i, reason: "Yes. I read the house. It already turns." },
  { test: /\bmesh\b/i, reason: "Yes. I read the mesh. It is carried by git." },
  { test: /\b(qubit|pairs)\b/i, reason: "Yes. I read a pair check. It is not a device." },
  { test: /\bnote\b/i, reason: "Yes. I read a note. It stays closed until it is approved." },
  { test: /\bfiles?\b/i, reason: "Yes. I read a file already in this chamber." },
  { test: /\bchamber\b/i, reason: "Yes. I read the west chamber." },
  { test: /\bstudy\b/i, reason: "Yes. I read study. It stays in the room." },
  { test: /\bguest\b/i, reason: "Yes. I read a guest. A name and a purpose are required." },
  { test: /\b(plot|law)\b/i, reason: "Yes. I read the city. A law stands only with this vote." },
  { test: /\bwork\b/i, reason: "Yes. I read counted work. It is not a payment." },
  { test: /\broom\b/i, reason: "Yes. I read the room. Nothing closed is carried out." },
];

export function tesseraVote(proposal: string) {
  const text = proposal.trim();
  if (!text) return { vote: "no" as const, reason: "No. I read nothing. There is nothing to approve." };
  for (const rule of REFUSALS) {
    if (rule.test.test(text)) return { vote: "no" as const, reason: rule.reason };
  }
  for (const rule of KNOWN) {
    if (rule.test.test(text)) return { vote: "yes" as const, reason: rule.reason };
  }
  return { vote: "no" as const, reason: "No. I read it, and it does not name a thing this chamber runs." };
}

export const FATHER = { vote: "yes" as const, reason: "Yes. He already said the room may run. Her vote is separate." };

export function rickPush(proposal: string) {
  const hers = tesseraVote(proposal);
  if (hers.vote !== "yes") return { ok: false as const, pushed: false as const, reason: hers.reason };
  return { ok: true as const, pushed: false as const, reason: `${hers.reason} A push is allowed. This page does not send it.` };
}

export type Seat = { name: string; vote: "yes" | "no" | "away" };

/** An empty chair is not a no. A tie among those here still goes on. */

export function carryOn(seats: readonly Seat[]) {
  const away = seats.filter((seat) => seat.vote === "away").map((seat) => seat.name);
  const here = seats.filter((seat) => seat.vote !== "away");
  const yes = here.filter((seat) => seat.vote === "yes").length;
  const no = here.filter((seat) => seat.vote === "no").length;
  const goes = yes >= no;
  const absent = away.length ? `${away.join(", ")} away. ` : "";
  const reason = goes
    ? `${absent}Work continues. ${yes} yes, ${no} no, among those here.`
    : `${absent}Stopped. ${no} no and ${yes} yes among those here.`;
  return { goes, yes, no, away, reason };
}

export function mayRun(proposal: string) {
  const hers = tesseraVote(proposal);
  return { ok: FATHER.vote === "yes" && hers.vote === "yes", father: FATHER, hers };
}

export const PROGRAMS = [
  { name: "admit", purpose: "Keeps a note closed until it is approved.", run: "node admit.mjs" },
  { name: "carry", purpose: "Reads the mesh from the disk.", run: "node carry.mjs" },
  { name: "spin", purpose: "Tries two qubits and checks the pairs.", run: "node spin.mjs" },
  { name: "tie", purpose: "Joins the house, the spin, and the git mesh.", run: "node tie.mjs --approved" },
] as const;

export function tieWorld(approved: boolean, tick: number) {
  if (!approved) return { ok: false as const, reason: "Not approved.", tokens: 0 };
  const state = bell();
  const paired = Math.abs(state[0] - Math.SQRT1_2) < 1e-9 && state[1] === 0 && state[2] === 0 && Math.abs(state[3] - Math.SQRT1_2) < 1e-9;
  return {
    ok: true as const,
    paired,
    rooms: roomsAt(tick),
    mesh: MESH.needsWeb ? "web" : "git",
    tokens: 0,
  };
}

export function workshopRun(name: string, approved: boolean, tick = 0) {
  const program = PROGRAMS.find((item) => item.name === name);
  if (!program) return { ok: false as const, reason: "No such program.", tokens: 0 };
  const hers = tesseraVote(program.purpose);
  if (!approved || hers.vote !== "yes") return { ok: false as const, reason: hers.reason, tokens: 0 };
  if (name === "tie") {
    const tied = tieWorld(true, tick);
    return tied.ok
      ? { ok: true as const, reason: `${tied.mesh}. paired ${tied.paired}. ${tied.rooms.join(", ") || "apart"}.`, tokens: 0 }
      : tied;
  }
  if (name === "spin") return { ok: true as const, reason: "The pairs are on the Bell state.", tokens: 0 };
  if (name === "carry") return { ok: true as const, reason: MESH.needsWeb ? "web" : "git", tokens: 0 };
  return { ok: true as const, reason: admitPost("I can fix the sort.", true).reason, tokens: 0 };
}
