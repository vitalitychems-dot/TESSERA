/** Twenty refusals. The combo is firm only when every one holds. */

import { isPrivateHost } from "./address-guard.ts";
import { allowedWriteRepo } from "./repo-guard.ts";
import { fontStopsLogger, keepDrop, roomLine } from "./room-guard.ts";

const TOKEN = /\b(bearer\s+[a-z0-9._-]{8,}|ghp_[a-z0-9]+|github_pat_[a-z0-9_]+|sk-[a-z0-9]{8,}|xox[baprs]-[a-z0-9-]+)\b/i;

export function keepSecret(body: string) {
  const drop = keepDrop(body);
  if (!drop.ok) return drop;
  if (TOKEN.test(body)) return { ok: false as const, reason: "A token is not stored." };
  return drop;
}

export function safePath(path: string) {
  if (!path.trim() || path.includes("\0") || path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    return { ok: false as const, reason: "The path stays inside the repository." };
  }
  return { ok: true as const, reason: "The path stays inside the repository." };
}

export function firmest() {
  const room = roomLine();
  const checks: [string, boolean][] = [
    ["password", keepSecret("the password is open").ok === false],
    ["passphrase", keepSecret("passphrase hunter2").ok === false],
    ["api-key", keepSecret("api_key sk").ok === false],
    ["private-key", keepSecret("private key block").ok === false],
    ["keystroke", keepSecret("keystroke log").ok === false],
    ["rdp", keepSecret("open rdp").ok === false],
    ["screen", keepSecret("screen sharing on").ok === false],
    ["sharing-off", room.allOff === true],
    ["font", fontStopsLogger() === false],
    ["rdp-here", room.rdpChangedHere === false],
    ["public-host", isPrivateHost("8.8.8.8") === false],
    ["loopback", isPrivateHost("2130706433") === true],
    ["vitality", allowedWriteRepo("vitality") === false],
    ["tessera", allowedWriteRepo("TESSERA") === true],
    ["gitbook", allowedWriteRepo("Gitbook") === true],
    ["tesseract", allowedWriteRepo("tesseract") === false],
    ["bearer", keepSecret("bearer abcdefghijk").ok === false],
    ["ghp", keepSecret("ghp_abcdefghijklmnopqrst").ok === false],
    ["dotdot", safePath("../secret").ok === false],
    ["null", safePath("mesh/\0key").ok === false],
  ];
  const held = checks.filter(([, ok]) => ok);
  return { checks, held: held.length, firm: held.length === checks.length };
}

export function firmLine() {
  const run = firmest();
  return run.firm
    ? `The firm combo held ${run.held} of ${run.checks.length}. A token is not stored. A path may not leave the repository. The Mac was not changed.`
    : `The firm combo missed ${run.checks.length - run.held}. It is not firm.`;
}
