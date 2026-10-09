import type { ErrorRequestHandler, Request, RequestHandler, Response } from "express";
import { DbUnavailableError, isDbConfigured } from "@workspace/db";

export const DATABASE_NOT_CONFIGURED_BODY = {
  error: "database not configured",
} as const;

function fullPath(req: Request): string {
  const raw = req.originalUrl || req.url || req.path;
  const path = raw.split("?")[0] ?? "";
  return path.length > 0 ? path : "/";
}

function isDatabaseOptionalPath(path: string): boolean {
  if (path === "/healthz" || path === "/api/healthz") return true;
  if (path === "/api/admin/session" || path.startsWith("/api/admin/session/")) return true;
  if (path === "/api/admin/surface" || path.startsWith("/api/admin/surface/")) return true;
  return false;
}

export function isDbUnavailableError(err: unknown): boolean {
  if (err instanceof DbUnavailableError) return true;
  return err instanceof Error && err.name === "DbUnavailableError";
}

export const rejectWhenDatabaseNotConfigured: RequestHandler = (req, res, next) => {
  if (isDbConfigured()) {
    next();
    return;
  }
  const path = fullPath(req);
  if (!path.startsWith("/api") || isDatabaseOptionalPath(path)) {
    next();
    return;
  }
  res.status(503).json(DATABASE_NOT_CONFIGURED_BODY);
};

function isUnavailableBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const error = (body as { error?: unknown }).error;
  return error === DATABASE_NOT_CONFIGURED_BODY.error;
}

export function rewriteDatabaseUnavailableJson(res: Response): void {
  if (isDbConfigured()) return;
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => {
    if (res.statusCode >= 500 && isUnavailableBody(body)) {
      res.status(503);
      return originalJson(DATABASE_NOT_CONFIGURED_BODY);
    }
    return originalJson(body);
  }) as Response["json"];
}

export const dbUnavailableErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (isDbUnavailableError(err)) {
    res.status(503).json(DATABASE_NOT_CONFIGURED_BODY);
    return;
  }
  next(err);
};
