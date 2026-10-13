/**
 * Allowed communication graph (REA-08).
 *
 * Idea: agency-swarm (MIT) "communication flows" — agents may only message
 * the directed edges they are given. Mirrors the Gitbook mesh gate pipeline
 * (mesh/flow.md). Implemented from scratch.
 *
 * Default is OPEN (no policy set) so existing behaviour is unchanged until a
 * policy is installed with setCommsPolicy().
 */
export type CommsEdge = [from: string, to: string];

export class CommsPolicyError extends Error {
  constructor(readonly from: string, readonly to: string) {
    super(`agent "${from}" is not allowed to message "${to}"`);
    this.name = "CommsPolicyError";
  }
}

let allowed: Map<string, Set<string>> | null = null;

/** Install a directed allow-list. "*" as `to` means any recipient. Pass null to reopen. */
export function setCommsPolicy(edges: CommsEdge[] | null): void {
  if (edges === null) { allowed = null; return; }
  allowed = new Map();
  for (const [f, t] of edges) {
    if (!allowed.has(f)) allowed.set(f, new Set());
    allowed.get(f)!.add(t);
  }
}

export function isMessageAllowed(from: string, to: string): boolean {
  if (!allowed) return true;
  const s = allowed.get(from);
  return Boolean(s && (s.has(to) || s.has("*")));
}

export function assertMayMessage(from: string, to: string): void {
  if (!isMessageAllowed(from, to)) throw new CommsPolicyError(from, to);
}

export function getCommsPolicy(): CommsEdge[] | null {
  if (!allowed) return null;
  return [...allowed.entries()].flatMap(([f, ts]) => [...ts].map((t) => [f, t] as CommsEdge));
}
