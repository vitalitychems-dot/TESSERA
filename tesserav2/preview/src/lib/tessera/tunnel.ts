import { tesseraVote } from "./workshop.ts";

/** A door. She welcomes by name and purpose. The pen does not choose the guest. */

export function welcome(name: string, purpose: string) {
  const who = name.trim();
  const why = purpose.trim();
  if (!who || !why) return { ok: false as const, reason: "No. There is nothing to welcome.", resident: null };
  const vote = tesseraVote(why);
  if (vote.vote !== "yes") return { ok: false as const, reason: vote.reason, resident: null };
  return {
    ok: true as const,
    reason: vote.reason,
    resident: { name: who, turn: ((who.length % 7) + 1) * 0.45 },
  };
}
