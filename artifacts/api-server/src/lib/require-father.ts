import type { Request, Response, NextFunction } from "express";
import { verifyFatherToken } from "./father-session-store";
import { decideOwnerSession } from "./sovereign-admin";

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const xToken = req.headers["x-father-token"];
  if (typeof xToken === "string" && xToken.trim()) return xToken.trim();
  return null;
}

export function requireFather(req: Request, res: Response, next: NextFunction): void {
  const session = decideOwnerSession(req);
  if (session.ok) {
    next();
    return;
  }
  if (session.status === 503) {
    res.status(503).json({ ok: false, error: session.error });
    return;
  }

  // Backward compatibility for signed non-browser service clients. The web
  // application no longer reads, stores, or emits these bearer tokens.
  const token = extractBearerToken(req);
  if (!verifyFatherToken(token)) {
    res.status(401).json({ ok: false, isAdmin: false, error: "Father token required" });
    return;
  }
  next();
}
