import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** Header token required by natal-chart, political-dossiers, and income-and-leads. */
export const SENSITIVE_ROUTE_TOKEN_ENV = "TESSERA_SENSITIVE_ROUTE_TOKEN";
export const SENSITIVE_ROUTE_TOKEN_HEADER = "x-admin-token";

function configuredToken(): string | null {
  const raw = process.env[SENSITIVE_ROUTE_TOKEN_ENV];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function presentedToken(req: Request): string | null {
  const raw = req.headers[SENSITIVE_ROUTE_TOKEN_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tokensMatch(presented: string, expected: string): boolean {
  const presentedDigest = createHash("sha256").update(presented, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(presentedDigest, expectedDigest);
}

/**
 * Fail-closed gate. Existing admin helpers were not reused:
 * requireAdminSession is a cookie session (401 for both missing and invalid),
 * and validateSovereignAdminToken collapses unset, missing, and mismatch to false.
 * This gate refuses every request when the env var is unset or blank, returns
 * 401 when no header token is presented, and 403 when the token does not match.
 */
export function requireSensitiveRouteToken(req: Request, res: Response, next: NextFunction): void {
  const expected = configuredToken();
  if (!expected) {
    res.status(503).json({
      ok: false,
      error: "not-configured",
      message: `${SENSITIVE_ROUTE_TOKEN_ENV} is not configured. This route is fail-closed.`,
    });
    return;
  }

  const presented = presentedToken(req);
  if (!presented) {
    res.status(401).json({ ok: false, error: "unauthenticated" });
    return;
  }

  if (!tokensMatch(presented, expected)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  next();
}
