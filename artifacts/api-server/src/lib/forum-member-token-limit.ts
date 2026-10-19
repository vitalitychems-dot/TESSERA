import type { Request } from "express";

const WINDOW_MS = 60_000;
const MAX_FAILURES = 8;
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function recentHits(ip: string, now: number): number[] {
  const kept = (hits.get(ip) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (kept.length === 0) hits.delete(ip);
  else hits.set(ip, kept);
  return kept;
}

export function memberTokenFailureLimit(req: Request, now = Date.now()): { limited: boolean; retryAfterSeconds: number } {
  const recent = recentHits(clientIp(req), now);
  if (recent.length < MAX_FAILURES) return { limited: false, retryAfterSeconds: 1 };
  const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
  return { limited: true, retryAfterSeconds };
}

export function recordMemberTokenFailure(req: Request, now = Date.now()): void {
  const ip = clientIp(req);
  const recent = recentHits(ip, now);
  recent.push(now);
  hits.set(ip, recent);
}

export function resetMemberTokenFailureLimitForTests(): void {
  hits.clear();
}
