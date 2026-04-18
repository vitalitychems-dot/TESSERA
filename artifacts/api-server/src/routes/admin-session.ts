// /api/admin/session — Heavy Council P9.
//
// Three handlers, no surface area for confusion:
//   POST /api/admin/session         { token } -> sets HttpOnly cookie, 200
//   GET  /api/admin/session/status              -> { authenticated, expiresAt? }
//   POST /api/admin/session/logout              -> clears cookie, 204

import { Router, type Request, type Response } from "express";
import {
  SESSION_COOKIE,
  isAdminTokenConfigured,
  verifyAdminToken,
  issueSession,
  lookupSession,
  revokeSession,
  activeSessionCount,
  sessionStoreStats,
  DEFAULT_TTL_MS,
} from "../lib/sovereign-session";
import { fatherVerifyRateLimit } from "../lib/father-verify-throttle";
import { logger } from "../lib/logger";

const router: Router = Router();

function ipOf(req: Request): string {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string" && xfwd.length > 0) return xfwd.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

function setCookie(res: Response, value: string, ttlMs: number): void {
  const isProd = process.env.NODE_ENV === "production";
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
  ];
  if (isProd) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

function clearCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  const attrs = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (isProd) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

function readCookie(req: Request): string | undefined {
  const fromParser = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  if (typeof fromParser === "string") return fromParser;
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

// POST /api/admin/session — { token } -> set cookie.
router.post("/admin/session", fatherVerifyRateLimit, (req: Request, res: Response) => {
  if (!isAdminTokenConfigured()) {
    res.status(503).json({
      ok: false,
      error: "sovereign-unconfigured",
      message: "SOVEREIGN_ADMIN_TOKEN is not configured. Set it in Replit Secrets and restart the API workflow.",
    });
    return;
  }
  const presented = typeof req.body?.token === "string" ? req.body.token : "";
  if (!verifyAdminToken(presented)) {
    logger.warn({ ip: ipOf(req) }, "sovereign-session: token rejected");
    res.status(401).json({ ok: false, error: "invalid-token" });
    return;
  }
  const issued = issueSession({
    ip: ipOf(req),
    userAgent: String(req.headers["user-agent"] ?? "").slice(0, 256),
    ttlMs: DEFAULT_TTL_MS,
  });
  setCookie(res, issued.signedId, issued.ttlMs);
  res.status(200).json({ ok: true, authenticated: true, expiresAt: issued.expiresAt });
});

// GET /api/admin/session/status — never reveals credential material.
router.get("/admin/session/status", (req: Request, res: Response) => {
  if (!isAdminTokenConfigured()) {
    res.status(200).json({ ok: true, configured: false, authenticated: false });
    return;
  }
  const cookie = readCookie(req);
  const lookup = lookupSession(cookie);
  if (!lookup.valid || !lookup.record) {
    res.status(200).json({
      ok: true,
      configured: true,
      authenticated: false,
      reason: lookup.reason,
      activeSessions: activeSessionCount(),
    });
    return;
  }
  res.status(200).json({
    ok: true,
    configured: true,
    authenticated: true,
    expiresAt: lookup.record.expiresAt,
    activeSessions: activeSessionCount(),
  });
});

// GET /api/admin/session/stats — IMPL-1 audit surface. Reveals only the
// session store shape (active count, cap, eviction counters); never any
// session id or credential material. Safe to expose unauthenticated because
// it leaks nothing usable.
router.get("/admin/session/stats", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, ...sessionStoreStats() });
});

// POST /api/admin/session/logout — clear cookie + revoke server-side.
router.post("/admin/session/logout", (req: Request, res: Response) => {
  const cookie = readCookie(req);
  revokeSession(cookie);
  clearCookie(res);
  res.status(204).end();
});

export default router;
