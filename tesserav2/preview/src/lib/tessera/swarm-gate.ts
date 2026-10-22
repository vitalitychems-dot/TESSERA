/** Two seats, then Tessera, then Moderator, then shown. This function never merges. */

const STOPPED = /\b(wallet|password|secret|api_key|monero|xmr|private key)\b/i;
const HELD = /\b(delete|force-push|workflow)\b/i;

export function tesseraPass(line: string) {
  return line.trim().length > 0 && !STOPPED.test(line);
}

export function moderatorPass(line: string) {
  return tesseraPass(line) && !HELD.test(line);
}

export function dualAgree(left: string, right: string) {
  const a = left.trim();
  const b = right.trim();
  if (!a || a !== b) return "split";
  return a;
}

export function swarmGate(lines: string[], shown: boolean, denied: boolean) {
  if (lines.length < 2) return "stopped. A dual brain needs two seats.";
  if (dualAgree(lines[0] ?? "", lines[1] ?? "") === "split") return "stopped. The two seats do not agree.";
  if (!lines.every(tesseraPass)) return "stopped at Tessera.";
  if (!lines.every(moderatorPass)) return "stopped at Moderator.";
  if (!shown) return "waiting to be shown.";
  if (denied) return "denied.";
  return "pass. Not merged from this function.";
}

export function mcpList() {
  return ["session_mark", "swarm_gate", "dual_brain"] as const;
}

export function mcpCall(name: string) {
  if (name === "session_mark") {
    return "session mark is a hash. There is no key.";
  }
  if (name === "dual_brain") return dualAgree("study the light", "study the light");
  if (name === "swarm_gate") return swarmGate(["study the light", "study the light"], false, false);
  return "unknown tool";
}
