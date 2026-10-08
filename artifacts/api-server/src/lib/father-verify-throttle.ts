// Sliding-window IP rate limiter for Father credential surfaces.
// Adopted by the Grand Conference — Language & Security Summit.
// In-process, zero deps, no candidate values logged.

import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

const _hits = new Map<string, number[]>();

function ipOf(req: Request): string {
  // req.ip follows the app trust-proxy hop count. The first X-Forwarded-For
  // entry is client-controlled and must not key a limiter.
  return req.ip || req.socket.remoteAddress || "unknown";
}

function prune(now: number): void {
  for (const [ip, arr] of _hits) {
    const filtered = arr.filter((t) => now - t < WINDOW_MS);
    if (filtered.length === 0) _hits.delete(ip);
    else _hits.set(ip, filtered);
  }
}

export function fatherVerifyRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (Math.random() < 0.05) prune(now);
  const ip = ipOf(req);
  const arr = (_hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - arr[0]);
    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
    res.status(429).json({
      ok: false,
      error: "rate-limited",
      message: `Father verification is rate-limited to ${MAX_PER_WINDOW} attempts per minute per IP.`,
      retryAfterMs,
    });
    return;
  }
  arr.push(now);
  _hits.set(ip, arr);
  next();
}

export function rateLimitSnapshot(): { window: number; max: number; activeIps: number } {
  prune(Date.now());
  return { window: WINDOW_MS, max: MAX_PER_WINDOW, activeIps: _hits.size };
}

// INTEG-6 (100% approval): a stricter, isolated per-IP throttle for the
// admin/session unlock surface. Separate Map so a noisy origin on this
// route cannot exhaust the global Father-verify budget for everyone else.
// Bounded by ADMIN_SESSION_MAX_IPS to avoid unbounded memory growth.
const ADMIN_SESSION_WINDOW_MS = 60_000;
const ADMIN_SESSION_MAX = 6;
const ADMIN_SESSION_GLOBAL_MAX = 30;
const ADMIN_SESSION_MAX_IPS = 4096;
const _adminHits = new Map<string, number[]>();
const _adminGlobalHits: number[] = [];

function pruneAdmin(now: number): void {
  for (const [ip, arr] of _adminHits) {
    const filtered = arr.filter((t) => now - t < ADMIN_SESSION_WINDOW_MS);
    if (filtered.length === 0) _adminHits.delete(ip);
    else _adminHits.set(ip, filtered);
  }
  // FIFO eviction if the IP table itself grows too large.
  while (_adminHits.size > ADMIN_SESSION_MAX_IPS) {
    const oldest = _adminHits.keys().next().value;
    if (oldest === undefined) break;
    _adminHits.delete(oldest);
  }
}

export function adminSessionRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (Math.random() < 0.05) pruneAdmin(now);
  const ip = ipOf(req);
  const arr = (_adminHits.get(ip) ?? []).filter((t) => now - t < ADMIN_SESSION_WINDOW_MS);
  const globalHits = _adminGlobalHits.filter((t) => now - t < ADMIN_SESSION_WINDOW_MS);
  _adminGlobalHits.length = 0;
  _adminGlobalHits.push(...globalHits);
  const retry = (limit: number, oldest: number, scope: string) => {
    const retryAfterMs = ADMIN_SESSION_WINDOW_MS - (now - oldest);
    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
    res.status(429).json({
      ok: false,
      error: "rate-limited",
      message: `Admin-session unlock is rate-limited to ${limit} attempts per minute ${scope}.`,
      retryAfterMs,
    });
  };
  // Per-address budget first, so one caller cannot fill the global cap.
  if (arr.length >= ADMIN_SESSION_MAX) {
    retry(ADMIN_SESSION_MAX, arr[0], "per IP");
    return;
  }
  if (_adminGlobalHits.length >= ADMIN_SESSION_GLOBAL_MAX) {
    retry(ADMIN_SESSION_GLOBAL_MAX, _adminGlobalHits[0], "globally");
    return;
  }
  arr.push(now);
  _adminHits.set(ip, arr);
  _adminGlobalHits.push(now);
  next();
}

// Anonymous DB/disk writes (sacred conference run, grand-council convene).
// Separate maps so these cannot drain the Father-verify or admin-session budgets.
const WRITE_WINDOW_MS = 60_000;
const WRITE_IP_MAX = 6;
const WRITE_GLOBAL_MAX = 30;
const _writeHits = new Map<string, number[]>();
const _writeGlobalHits: number[] = [];

export function publicWriteRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const ip = ipOf(req);
  const arr = (_writeHits.get(ip) ?? []).filter((t) => now - t < WRITE_WINDOW_MS);
  const globalHits = _writeGlobalHits.filter((t) => now - t < WRITE_WINDOW_MS);
  _writeGlobalHits.length = 0;
  _writeGlobalHits.push(...globalHits);
  if (arr.length === 0) _writeHits.delete(ip);
  const limited = arr.length >= WRITE_IP_MAX || _writeGlobalHits.length >= WRITE_GLOBAL_MAX;
  if (limited) {
    const oldest = arr.length >= WRITE_IP_MAX ? arr[0] : _writeGlobalHits[0];
    const retryAfterMs = WRITE_WINDOW_MS - (now - oldest);
    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
    res.status(429).json({
      ok: false,
      error: "rate-limited",
      message: "Anonymous council writes are rate-limited.",
      retryAfterMs,
    });
    return;
  }
  arr.push(now);
  _writeHits.set(ip, arr);
  _writeGlobalHits.push(now);
  next();
}
