/** This room does not store a login, a keystroke, or a claim that remote access was turned off. */

const SECRET = /\b(password|passphrase|sigil|api_key|private key|keystroke|keylog)\b/i;
const REMOTE = /\b(rdp|remote login|screen sharing|remote management)\b/i;

export const OWNER_SWITCHES = [
  "System Settings, General, Sharing: turn Remote Login off.",
  "Turn Screen Sharing off.",
  "Turn Remote Management off.",
] as const;

export function keepDrop(body: string) {
  if (SECRET.test(body)) return { ok: false as const, reason: "A login and a key log are not stored." };
  if (REMOTE.test(body)) return { ok: false as const, reason: "Remote access is not configured from this room." };
  return { ok: true as const, reason: "A note can be kept. A login cannot." };
}

export function fontStopsLogger() {
  return false;
}

export function roomLine() {
  return {
    storedLogin: false as const,
    rdpChangedHere: false as const,
    switches: OWNER_SWITCHES.length,
  };
}
