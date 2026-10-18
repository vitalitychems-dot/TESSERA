// Sliding-window IP rate limiter for Father credential surfaces.
// Adopted by the Grand Conference — Language & Security Summit.
// In-process, zero deps, no candidate values logged.

import type { Request, Response, NextFunction } from "express";
import { decideOwnerSession } from "./sovereign-admin";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const FATHER_GLOBAL_MAX = 100;
const FATHER_MAX_IPS = 4096;

const _hits = new Map<string, number[]>();
const _fatherGlobalHits: number[] = [];

function ipOf(req: Request): string {
  // req.ip follows the app trust-proxy setting (APP_TRUSTED_PROXIES, lib/trust-proxy.ts). X-Forwarded-For
  // from an unlisted peer is client-controlled and must not key a limiter.
  return req.ip || req.socket.remoteAddress || "unknown";
}

function evictOldest<T>(map: Map<string, T[]>, maxIps: number): void {
  while (map.size > maxIps) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function prune(now: number): void {
  for (const [ip, arr] of _hits) {
    const filtered = arr.filter((t) => now - t < WINDOW_MS);
    if (filtered.length === 0) _hits.delete(ip);
    else _hits.set(ip, filtered);
  }
  evictOldest(_hits, FATHER_MAX_IPS);
  const globalHits = _fatherGlobalHits.filter((t) => now - t < WINDOW_MS);
  _fatherGlobalHits.length = 0;
  _fatherGlobalHits.push(...globalHits);
}

export function fatherVerifyRateLimit(req: Request, res: Response, next: NextFunction): void {
  // Anonymous /sigil/status and the owner key-reveal share this middleware.
  // A valid owner session uses its own path so a status flood cannot fill
  // the global bucket and block show-key-in-lus.
  if (decideOwnerSession(req).ok) {
    next();
    return;
  }
  const now = Date.now();
  prune(now);
  const ip = ipOf(req);
  const arr = _hits.get(ip) ?? [];
  const retry = (limit: number, oldest: number, scope: string) => {
    const retryAfterMs = WINDOW_MS - (now - oldest);
    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
    res.status(429).json({
      ok: false,
      error: "rate-limited",
      message: `Father verification is rate-limited to ${limit} attempts per minute ${scope}.`,
      retryAfterMs,
    });
  };
  if (arr.length >= MAX_PER_WINDOW) {
    retry(MAX_PER_WINDOW, arr[0], "per IP");
    return;
  }
  if (_fatherGlobalHits.length >= FATHER_GLOBAL_MAX) {
    retry(FATHER_GLOBAL_MAX, _fatherGlobalHits[0], "globally");
    return;
  }
  arr.push(now);
  _hits.set(ip, arr);
  _fatherGlobalHits.push(now);
  next();
}

export function rateLimitSnapshot(): { window: number; max: number; activeIps: number } {
  prune(Date.now());
  return { window: WINDOW_MS, max: MAX_PER_WINDOW, activeIps: _hits.size };
}

// Login only. Storage, mesh, dedup, and the other raw-key routes must not
// share this counter: Settings polls /mesh/stats and would lock the owner out.
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

// Failed attempts on raw-key admin routes. Successful authenticated requests
// do not consume budget. Separate from the login counter above.
// A slot is reserved before next() and refunded unless the response is 401
// or 403, so overlapping failures cannot all pass the window check.
// finish and close share one settlement so an aborted stream does not hold
// the slot for the rest of the window.
const RAW_KEY_WINDOW_MS = 60_000;
const RAW_KEY_IP_MAX = 6;
const RAW_KEY_GLOBAL_MAX = 30;
const RAW_KEY_MAX_IPS = 4096;
type RawStamp = { at: number };
const _rawHits = new Map<string, RawStamp[]>();
const _rawGlobalHits: RawStamp[] = [];

function pruneRaw(now: number): void {
  for (const [ip, arr] of _rawHits) {
    const filtered = arr.filter((hit) => now - hit.at < RAW_KEY_WINDOW_MS);
    if (filtered.length === 0) _rawHits.delete(ip);
    else _rawHits.set(ip, filtered);
  }
  evictOldest(_rawHits, RAW_KEY_MAX_IPS);
  const globalHits = _rawGlobalHits.filter((hit) => now - hit.at < RAW_KEY_WINDOW_MS);
  _rawGlobalHits.length = 0;
  _rawGlobalHits.push(...globalHits);
}

function releaseRawStamp(ip: string, stamp: RawStamp): void {
  const current = _rawHits.get(ip);
  if (current) {
    const idx = current.indexOf(stamp);
    if (idx >= 0) current.splice(idx, 1);
    if (current.length === 0) _rawHits.delete(ip);
  }
  const globalIdx = _rawGlobalHits.indexOf(stamp);
  if (globalIdx >= 0) _rawGlobalHits.splice(globalIdx, 1);
}

// Desk session checks from preview. Same reserve/refund rules as rawKeyFailRateLimit,
// with separate counters so loopback desk misses cannot drain admin raw-key routes.
const SESSION_CHECK_WINDOW_MS = 60_000;
const SESSION_CHECK_IP_MAX = 6;
const SESSION_CHECK_GLOBAL_MAX = 30;
const SESSION_CHECK_MAX_IPS = 4096;
const _sessionCheckHits = new Map<string, RawStamp[]>();
const _sessionCheckGlobalHits: RawStamp[] = [];

function pruneSessionCheck(now: number): void {
  for (const [ip, arr] of _sessionCheckHits) {
    const filtered = arr.filter((hit) => now - hit.at < SESSION_CHECK_WINDOW_MS);
    if (filtered.length === 0) _sessionCheckHits.delete(ip);
    else _sessionCheckHits.set(ip, filtered);
  }
  evictOldest(_sessionCheckHits, SESSION_CHECK_MAX_IPS);
  const globalHits = _sessionCheckGlobalHits.filter((hit) => now - hit.at < SESSION_CHECK_WINDOW_MS);
  _sessionCheckGlobalHits.length = 0;
  _sessionCheckGlobalHits.push(...globalHits);
}

function releaseSessionCheckStamp(ip: string, stamp: RawStamp): void {
  const current = _sessionCheckHits.get(ip);
  if (current) {
    const idx = current.indexOf(stamp);
    if (idx >= 0) current.splice(idx, 1);
    if (current.length === 0) _sessionCheckHits.delete(ip);
  }
  const globalIdx = _sessionCheckGlobalHits.indexOf(stamp);
  if (globalIdx >= 0) _sessionCheckGlobalHits.splice(globalIdx, 1);
}

export function resetSessionCheckRateLimitForTests(): void {
  _sessionCheckHits.clear();
  _sessionCheckGlobalHits.length = 0;
}

export function sessionCheckFailRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  pruneSessionCheck(now);
  const ip = ipOf(req);
  const arr = _sessionCheckHits.get(ip) ?? [];
  const retry = (limit: number, oldest: number, scope: string) => {
    const retryAfterMs = SESSION_CHECK_WINDOW_MS - (now - oldest);
    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
    res.status(429).json({
      ok: false,
      error: "rate-limited",
      message: `Session check is rate-limited to ${limit} failed attempts per minute ${scope}.`,
      retryAfterMs,
    });
  };
  if (arr.length >= SESSION_CHECK_IP_MAX) {
    retry(SESSION_CHECK_IP_MAX, arr[0].at, "per IP");
    return;
  }
  if (_sessionCheckGlobalHits.length >= SESSION_CHECK_GLOBAL_MAX) {
    retry(SESSION_CHECK_GLOBAL_MAX, _sessionCheckGlobalHits[0].at, "globally");
    return;
  }
  const stamp: RawStamp = { at: now };
  arr.push(stamp);
  _sessionCheckHits.set(ip, arr);
  _sessionCheckGlobalHits.push(stamp);
  evictOldest(_sessionCheckHits, SESSION_CHECK_MAX_IPS);
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    if (res.statusCode === 401 || res.statusCode === 403) return;
    releaseSessionCheckStamp(ip, stamp);
  };
  res.on("finish", settle);
  res.on("close", settle);
  next();
}

export function rawKeyFailRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  pruneRaw(now);
  const ip = ipOf(req);
  const arr = _rawHits.get(ip) ?? [];
  const retry = (limit: number, oldest: number, scope: string) => {
    const retryAfterMs = RAW_KEY_WINDOW_MS - (now - oldest);
    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
    res.status(429).json({
      ok: false,
      error: "rate-limited",
      message: `Raw-key admin routes are rate-limited to ${limit} failed attempts per minute ${scope}.`,
      retryAfterMs,
    });
  };
  if (arr.length >= RAW_KEY_IP_MAX) {
    retry(RAW_KEY_IP_MAX, arr[0].at, "per IP");
    return;
  }
  if (_rawGlobalHits.length >= RAW_KEY_GLOBAL_MAX) {
    retry(RAW_KEY_GLOBAL_MAX, _rawGlobalHits[0].at, "globally");
    return;
  }
  const stamp: RawStamp = { at: now };
  arr.push(stamp);
  _rawHits.set(ip, arr);
  _rawGlobalHits.push(stamp);
  evictOldest(_rawHits, RAW_KEY_MAX_IPS);
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    if (res.statusCode === 401 || res.statusCode === 403) return;
    releaseRawStamp(ip, stamp);
  };
  res.on("finish", settle);
  res.on("close", settle);
  next();
}

/**
 * Counts a failed raw key only when x-tesseract-admin-key is present.
 * A valid owner session skips the limiter, same as fatherVerifyRateLimit,
 * even if that header is also present.
 */
export function rawKeyFailRateLimitIfKeyHeader(req: Request, res: Response, next: NextFunction): void {
  if (decideOwnerSession(req).ok) {
    next();
    return;
  }
  if (typeof req.header("x-tesseract-admin-key") !== "string") {
    next();
    return;
  }
  rawKeyFailRateLimit(req, res, next);
}

// Anonymous DB/disk writes (sacred conference run, grand-council convene).
// Separate maps so these cannot drain the Father-verify or admin-session budgets.
const WRITE_WINDOW_MS = 60_000;
const WRITE_IP_MAX = 6;
const WRITE_GLOBAL_MAX = 30;
const WRITE_MAX_IPS = 4096;
const _writeHits = new Map<string, number[]>();
const _writeGlobalHits: number[] = [];

function pruneWrites(now: number): void {
  for (const [ip, arr] of _writeHits) {
    const filtered = arr.filter((t) => now - t < WRITE_WINDOW_MS);
    if (filtered.length === 0) _writeHits.delete(ip);
    else _writeHits.set(ip, filtered);
  }
  evictOldest(_writeHits, WRITE_MAX_IPS);
  const globalHits = _writeGlobalHits.filter((t) => now - t < WRITE_WINDOW_MS);
  _writeGlobalHits.length = 0;
  _writeGlobalHits.push(...globalHits);
}

export function publicWriteRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  pruneWrites(now);
  const ip = ipOf(req);
  const arr = _writeHits.get(ip) ?? [];
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
