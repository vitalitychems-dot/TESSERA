// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Session — minted by Heavy Council (Apr 2026), proposals P1/P2/P9.
//
// One credential, one session, no rotation theatre. The operator presents a
// single high-entropy SOVEREIGN_ADMIN_TOKEN once; the server issues an
// HMAC-signed opaque session id, stored in an HttpOnly cookie. All privileged
// routes accept ONLY this cookie via requireAdminSession.
//
// Design rules:
//   * Zero external dependencies; node:crypto only.
//   * Constant-time comparisons for token AND session id checks.
//   * Sessions kept in-memory; restart invalidates everything (fail-safe).
//   * No credential material is ever written to logs.
//   * If SOVEREIGN_ADMIN_TOKEN is unset, every privileged path is 503 — never
//     accidentally open.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sovereign_session";
export const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

interface SessionRecord {
  id: string;
  issuedAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
}

const _store = new Map<string, SessionRecord>();

// Heavy Council P1: one credential. Accept either the new
// SOVEREIGN_ADMIN_TOKEN or the legacy TESSERACT_ADMIN_KEY (already configured
// in this deployment) so migration is zero-touch for the operator. The legacy
// alias may be removed in a future rotation.
function getAdminToken(): string {
  const next = (process.env.SOVEREIGN_ADMIN_TOKEN ?? "").trim();
  if (next.length > 0) return next;
  return (process.env.TESSERACT_ADMIN_KEY ?? "").trim();
}

function getSessionSecret(): string {
  const dedicated = (process.env.SOVEREIGN_SESSION_SECRET ?? "").trim();
  if (dedicated.length >= 32) return dedicated;
  return getAdminToken();
}

export function isAdminTokenConfigured(): boolean {
  return getAdminToken().length >= 16;
}

export function verifyAdminToken(presented: string | undefined | null): boolean {
  if (!presented || typeof presented !== "string") return false;
  if (!isAdminTokenConfigured()) return false;
  const expected = Buffer.from(getAdminToken(), "utf8");
  const got = Buffer.from(presented.trim(), "utf8");
  if (expected.length !== got.length) return false;
  try {
    return timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}

function signSessionId(rawId: string): string {
  const secret = getSessionSecret();
  if (!secret) return "";
  const mac = createHmac("sha256", secret).update(rawId).digest("hex");
  return `${rawId}.${mac}`;
}

function verifySessionSignature(signed: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return null;
  const rawId = signed.slice(0, dot);
  const presentedMac = signed.slice(dot + 1);
  const expectedMac = createHmac("sha256", secret).update(rawId).digest("hex");
  const a = Buffer.from(presentedMac, "utf8");
  const b = Buffer.from(expectedMac, "utf8");
  if (a.length !== b.length) return null;
  try {
    return timingSafeEqual(a, b) ? rawId : null;
  } catch {
    return null;
  }
}

export interface IssueOpts {
  ip: string;
  userAgent: string;
  ttlMs?: number;
}

export interface IssuedSession {
  signedId: string;
  expiresAt: number;
  ttlMs: number;
}

export function issueSession(opts: IssueOpts): IssuedSession {
  if (!isAdminTokenConfigured()) {
    throw new Error("sovereign-admin-token-not-configured");
  }
  const ttlMs = Math.max(60_000, opts.ttlMs ?? DEFAULT_TTL_MS);
  const rawId = randomBytes(32).toString("hex");
  const now = Date.now();
  const rec: SessionRecord = {
    id: rawId,
    issuedAt: now,
    expiresAt: now + ttlMs,
    ip: opts.ip.slice(0, 64),
    userAgent: opts.userAgent.slice(0, 256),
  };
  _store.set(rawId, rec);
  return { signedId: signSessionId(rawId), expiresAt: rec.expiresAt, ttlMs };
}

export interface SessionLookup {
  valid: boolean;
  reason?: "no-cookie" | "bad-signature" | "unknown-id" | "expired" | "unconfigured";
  record?: SessionRecord;
}

export function lookupSession(signedCookieValue: string | undefined | null): SessionLookup {
  if (!isAdminTokenConfigured()) return { valid: false, reason: "unconfigured" };
  if (!signedCookieValue || typeof signedCookieValue !== "string") {
    return { valid: false, reason: "no-cookie" };
  }
  const rawId = verifySessionSignature(signedCookieValue);
  if (!rawId) return { valid: false, reason: "bad-signature" };
  const rec = _store.get(rawId);
  if (!rec) return { valid: false, reason: "unknown-id" };
  if (Date.now() > rec.expiresAt) {
    _store.delete(rawId);
    return { valid: false, reason: "expired" };
  }
  return { valid: true, record: rec };
}

export function revokeSession(signedCookieValue: string | undefined | null): boolean {
  if (!signedCookieValue) return false;
  const rawId = verifySessionSignature(signedCookieValue);
  if (!rawId) return false;
  return _store.delete(rawId);
}

export function revokeAll(): number {
  const n = _store.size;
  _store.clear();
  return n;
}

export function activeSessionCount(): number {
  // GC expired entries while we're at it.
  const now = Date.now();
  for (const [k, v] of _store) if (v.expiresAt <= now) _store.delete(k);
  return _store.size;
}
