// POST /api/internal/session-check
// Loopback-only probe for the preview desk gate. Preview loads its own copy of
// the in-memory session Map, so the gate cannot decide an owner session inside
// the preview process. It POSTs the caller's own session token and receives
// only { valid: true | false }.
//
// Not exposed by a public or preview proxy:
// - preview/vite.config.ts binds 127.0.0.1 and sets no server.proxy or
//   preview.proxy, so the preview server does not forward /api anywhere.
// - The handler accepts only a socket peer of 127.0.0.1, ::1, or
//   ::ffff:127.0.0.1, and rejects proxy forwarding headers. A reverse proxy in
//   front of this process is a non-loopback peer, or it adds those headers.
// - The path is not listed in INTERNAL_ONLY_PATHS. That middleware still allows
//   localhost when forwarding headers are present, and it allows any peer that
//   presents x-sovereign-token.

import { Router, type Request, type Response } from "express";
import { sessionCheckFailRateLimit } from "../lib/father-verify-throttle";
import { isAdminTokenConfigured, lookupSession, SESSION_COOKIE } from "../lib/sovereign-session";

const router: Router = Router();

const LOOPBACK_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const FORWARDING_HEADERS = [
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-server",
  "x-forwarded-prefix",
  "forwarded",
  "x-real-ip",
  "via",
  "x-original-forwarded-for",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "x-forwarded-ssl",
  "x-envoy-external-address",
] as const;
const MAX_TOKEN_LENGTH = 512;

function normalizePeer(address: string | undefined): string {
  if (!address) return "";
  let value = address.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);
  return value;
}

export function isLoopbackSocket(address: string | undefined): boolean {
  return LOOPBACK_PEERS.has(normalizePeer(address));
}

function headerPresent(req: Request, name: string): boolean {
  const value = req.headers[name];
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : true;
}

export function hasForwardingHeader(req: Request): boolean {
  return FORWARDING_HEADERS.some((name) => headerPresent(req, name));
}

function deny(res: Response, status: 401 | 403 | 503): void {
  res.status(status).json({ valid: false });
}

// Peer checks run before the fail limiter. A non-loopback or forwarded request
// must not take a rate-limit slot.
export function rejectSessionCheckPeer(req: Request, res: Response, next: () => void): void {
  const url = req.originalUrl || req.url || "";
  if (url.includes("?")) {
    deny(res, 401);
    return;
  }
  if (hasForwardingHeader(req) || !isLoopbackSocket(req.socket?.remoteAddress)) {
    deny(res, 403);
    return;
  }
  next();
}

function sessionFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    if (trimmed.slice(0, eq) !== SESSION_COOKIE) continue;
    try {
      const value = decodeURIComponent(trimmed.slice(eq + 1));
      if (value.length < 1 || value.length > MAX_TOKEN_LENGTH) return undefined;
      return value;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function presentedToken(req: Request): string | undefined {
  const body = req.body;
  if (body && typeof body === "object" && "session" in body) {
    const session = (body as { session?: unknown }).session;
    if (typeof session !== "string" || session.length < 1 || session.length > MAX_TOKEN_LENGTH) return undefined;
    return session;
  }
  const cookieHeader = req.headers.cookie;
  return sessionFromCookie(typeof cookieHeader === "string" ? cookieHeader : undefined);
}

export function handleInternalSessionCheck(req: Request, res: Response): void {
  const url = req.originalUrl || req.url || "";
  if (url.includes("?")) {
    deny(res, 401);
    return;
  }
  if (hasForwardingHeader(req)) {
    deny(res, 403);
    return;
  }
  if (!isLoopbackSocket(req.socket?.remoteAddress)) {
    deny(res, 403);
    return;
  }
  if (!isAdminTokenConfigured()) {
    deny(res, 503);
    return;
  }
  const lookup = lookupSession(presentedToken(req));
  if (lookup.valid && lookup.record) {
    res.status(200).json({ valid: true });
    return;
  }
  deny(res, 401);
}

router.post("/internal/session-check", rejectSessionCheckPeer, sessionCheckFailRateLimit, handleInternalSessionCheck);

export default router;
