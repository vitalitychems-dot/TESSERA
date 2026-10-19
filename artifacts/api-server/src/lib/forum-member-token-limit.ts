import type { Request } from "express";

const WINDOW_MS = 60_000;
const MAX_FAILURES = 8;
export const MEMBER_TOKEN_FAILURE_CLIENT_CAP = 512;
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sweepExpired(now: number): void {
  const stale: string[] = [];
  const shortened: Array<[string, number[]]> = [];
  for (const [ip, stamps] of hits) {
    const kept = stamps.filter((stamp) => now - stamp < WINDOW_MS);
    if (kept.length === 0) stale.push(ip);
    else if (kept.length !== stamps.length) shortened.push([ip, kept]);
  }
  for (const ip of stale) hits.delete(ip);
  for (const [ip, kept] of shortened) {
    hits.delete(ip);
    hits.set(ip, kept);
  }
}

function evictToCap(): void {
  while (hits.size > MEMBER_TOKEN_FAILURE_CLIENT_CAP) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
}

function recentHits(ip: string, now: number): number[] {
  sweepExpired(now);
  const kept = (hits.get(ip) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  hits.delete(ip);
  if (kept.length > 0) hits.set(ip, kept);
  evictToCap();
  return hits.get(ip) ?? [];
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
  hits.delete(ip);
  hits.set(ip, recent);
  evictToCap();
}

export function memberTokenFailureLimitSizeForTests(): number {
  return hits.size;
}

export function resetMemberTokenFailureLimitForTests(): void {
  hits.clear();
}
