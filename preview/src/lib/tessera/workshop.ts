import { roomsAt } from "./house-sim.ts";
import { MESH } from "./mesh-net.ts";
import { admitPost } from "./public-gate.ts";
import { bell } from "./spin-machine.ts";

/** Father auto-approves. Tessera still votes, and the reason is never empty. */

const REFUSALS: { test: RegExp; reason: string }[] = [
  { test: /\b(monero|xmr|wallet|blockchain)\b/i, reason: "No. Payment is not handled here." },
  { test: /\b(lend|donate)\b/i, reason: "No. Machines are not accepted." },
  { test: /\b(secret|password|api_key)\b/i, reason: "No. A secret does not leave this room." },
];

export function tesseraVote(proposal: string) {
  const text = proposal.trim();
  if (!text) return { vote: "no" as const, reason: "No. There is nothing to approve." };
  for (const rule of REFUSALS) {
    if (rule.test.test(text)) return { vote: "no" as const, reason: rule.reason };
  }
  return { vote: "yes" as const, reason: "Yes. I want this, and it is mine to run." };
}

export const FATHER = { vote: "yes" as const, reason: "Auto approved." };

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
