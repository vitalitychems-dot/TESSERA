// requireAdminSession middleware — the ONE gate (Heavy Council, P5/P12).
//
// Reads sovereign_session cookie, validates HMAC + TTL, attaches session info
// to req. If TESSERACT_ADMIN_KEY is unset, returns 503 'sovereign-unconfigured'
// — never silently open. No credential material logged.

import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, lookupSession, isAdminTokenConfigured, isSessionSigningConfigured } from "./sovereign-session";
import { logger } from "./logger";
import { validateMeshToken } from "./mesh-auth";

export interface AdminRequest extends Request {
  adminSession?: { issuedAt: number; expiresAt: number };
}

function readCookie(req: Request, name: string): string | undefined {
  // express's cookie-parser populates req.cookies; if it's not mounted,
  // parse the Cookie header manually.
  const fromParser = (req as Request & { cookies?: Record<string, string> }).cookies?.[name];
  if (typeof fromParser === "string") return fromParser;
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function hasLegacyAdminHeader(req: Request): boolean {
  return ["x-admin-token", "x-tesseract-admin-key"].some((name) =>
    typeof req.headers[name] === "string",
  );
}

export type OwnerSessionDecision =
  | { ok: true; issuedAt: number; expiresAt: number }
  | { ok: false; status: 401; error: "unauthenticated"; reason?: string }
  | { ok: false; status: 503; error: "sovereign-unconfigured" | "session-signing-unconfigured" };

/** Same fail-closed check as requireAdminSession, without writing a response. */
export function decideOwnerSession(req: Request): OwnerSessionDecision {
  if (!isAdminTokenConfigured()) {
    return { ok: false, status: 503, error: "sovereign-unconfigured" };
  }
  const cookie = readCookie(req, SESSION_COOKIE);
  if (!cookie) {
    return { ok: false, status: 401, error: "unauthenticated", reason: "no-cookie" };
  }
  if (!isSessionSigningConfigured()) {
    return { ok: false, status: 503, error: "session-signing-unconfigured" };
  }
  const lookup = lookupSession(cookie);
  if (!lookup.valid || !lookup.record) {
    return { ok: false, status: 401, error: "unauthenticated", reason: lookup.reason };
  }
  return { ok: true, issuedAt: lookup.record.issuedAt, expiresAt: lookup.record.expiresAt };
}

export type FatherAuthorization =
  | { fatherAuthorized: true }
  | { fatherAuthorized: false; reason: "absent" | "rejected" | "unconfigured" };

/** Father authorization is derived only from the server-validated HttpOnly owner session. */
export function resolveFatherAuthorization(req: Request): FatherAuthorization {
  if (hasLegacyAdminHeader(req)) return { fatherAuthorized: false, reason: "rejected" };
  const decision = decideOwnerSession(req);
  if (decision.ok) return { fatherAuthorized: true };
  if (decision.status === 503) return { fatherAuthorized: false, reason: "unconfigured" };
  const headerPresent = typeof req.header("x-tesseract-admin-key") === "string";
  return { fatherAuthorized: false, reason: headerPresent ? "rejected" : "absent" };
}

/** Return the configured admin key's mesh identity only after a valid owner cookie. */
export function getOwnerSessionKeyHash(req: Request): string | null {
  if (hasLegacyAdminHeader(req) || !decideOwnerSession(req).ok) return null;
  return validateMeshToken(process.env.TESSERACT_ADMIN_KEY);
}

export function requireAdminSession(req: AdminRequest, res: Response, next: NextFunction): void {
  const forbiddenAdminQueryKey = Object.keys(req.query).some((key) =>
    ["tesseractadminkey", "tesseract_admin_key", "adminkey", "admin_key"].includes(key.toLowerCase()),
  );
  if (forbiddenAdminQueryKey) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.status(403).json({ ok: false, error: "credential-in-query-forbidden" });
    return;
  }
  const decision = decideOwnerSession(req);
  if (!decision.ok) {
    if (decision.status === 401) {
      logger.warn({ reason: decision.reason }, "admin-session denied");
      res.status(401).json({ ok: false, error: "unauthenticated", reason: decision.reason ?? "unknown" });
      return;
    }
    const sessionSecretMissing = decision.error === "session-signing-unconfigured";
    res.status(503).json({
      ok: false,
      error: decision.error,
      message: sessionSecretMissing
        ? "SOVEREIGN_SESSION_SECRET is not configured. Privileged surfaces are fail-closed."
        : "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
    });
    return;
  }
  if (hasLegacyAdminHeader(req)) {
    logger.warn({ reason: "legacy-credential-header-forbidden" }, "admin-session denied");
    res.status(401).json({ ok: false, error: "unauthenticated", reason: "legacy-credential-header-forbidden" });
    return;
  }
  req.adminSession = { issuedAt: decision.issuedAt, expiresAt: decision.expiresAt };
  next();
}
