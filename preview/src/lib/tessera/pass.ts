import { moltbookLine } from "./moltbook-link.ts";
import { welcome } from "./tunnel.ts";

/** A pass rides in git. Moltbook is a note, not a key. The private book is not on this pass. */

export function mark(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash, 33) ^ text.charCodeAt(index);
  return (hash >>> 0).toString(16);
}

export function issuePass(name: string, purpose: string, moltbookStatus = 401) {
  const door = welcome(name, purpose);
  if (!door.ok || !door.resident) return { ok: false as const, reason: door.reason, pass: null };
  const body = `${door.resident.name}\n${door.resident.turn}\n${purpose.trim()}`;
  return {
    ok: true as const,
    reason: door.reason,
    pass: {
      net: "gitbookai",
      carriedBy: "git",
      needsWeb: false,
      name: door.resident.name,
      turn: door.resident.turn,
      moltbook: moltbookLine(moltbookStatus, null),
      mark: mark(body),
      tokens: 0,
    },
  };
}
