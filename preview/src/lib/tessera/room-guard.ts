/** Required state. This file does not change the Mac. */

const SECRET = /\b(password|passphrase|sigil|api_key|private key|keystroke|keylog)\b/i;
const REMOTE = /\b(rdp|remote login|screen sharing|remote management)\b/i;

export const REQUIRED_SHARING = {
  remoteLogin: "off",
  screenSharing: "off",
  remoteManagement: "off",
} as const;

export function keepDrop(body: string) {
  if (SECRET.test(body)) return { ok: false as const, reason: "A login and a key log are not stored." };
  if (REMOTE.test(body)) return { ok: false as const, reason: "Remote access stays off. This room does not turn it on." };
  return { ok: true as const, reason: "A note can be kept. A login cannot." };
}

export function fontStopsLogger() {
  return false;
}

export function roomLine() {
  const switches = Object.values(REQUIRED_SHARING);
  return {
    storedLogin: false as const,
    rdpChangedHere: false as const,
    switches: switches.length,
    allOff: switches.every((state) => state === "off"),
  };
}
