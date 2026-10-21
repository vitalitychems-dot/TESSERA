import type { Request } from "express";

/**
 * Admin-session Origin allowlist (R3-4), shared by /api/admin/session and the
 * owner-session branch of /agent-comms/send|broadcast. Same host, or a host in
 * SOVEREIGN_ALLOWED_ORIGINS (comma-separated). No Origin header => allowed
 * (not a browser CSRF vector; the session/token check still gates).
 */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.origin;
  if (!origin || typeof origin !== "string") return true; // no Origin => not a browser CSRF vector
  try {
    const u = new URL(origin);
    const host = req.headers.host;
    if (host && u.host === host) return true;
    const allowList = (process.env.SOVEREIGN_ALLOWED_ORIGINS ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    if (allowList.includes(origin) || allowList.includes(u.host)) return true;
    return false;
  } catch {
    return false;
  }
}
