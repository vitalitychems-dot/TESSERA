import { type Request, type Response, type NextFunction } from "express";
import { logger } from "./logger";

interface APIError {
  status: number;
  message: string;
  code?: string;
  details?: any;
}

export function createAPIError(status: number, message: string, code?: string, details?: any): APIError & Error {
  const error = new Error(message) as any;
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

export function notFound(resource: string): APIError & Error {
  return createAPIError(404, `${resource} not found`, "NOT_FOUND");
}

export function badRequest(message: string): APIError & Error {
  return createAPIError(400, message, "BAD_REQUEST");
}

export function unauthorized(message = "Unauthorized"): APIError & Error {
  return createAPIError(401, message, "UNAUTHORIZED");
}

export function rateLimited(retryAfter?: number): APIError & Error {
  const error = createAPIError(429, "Too many requests", "RATE_LIMITED");
  (error as any).retryAfter = retryAfter;
  return error;
}

export function centralizedErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const code = err.code || "INTERNAL_ERROR";

  if (status >= 500) {
    logger.error("api-error", `${req.method} ${req.path}: ${message}`, {
      status,
      path: req.path,
      method: req.method,
      stack: err.stack?.split("\n").slice(0, 3).join("\n"),
    });
  }

  const response: Record<string, any> = {
    error: message,
    code,
    status,
  };

  if (err.details && status < 500) {
    response.details = err.details;
  }

  if (err.retryAfter) {
    res.setHeader("Retry-After", String(err.retryAfter));
    response.retryAfter = err.retryAfter;
  }

  res.status(status).json(response);
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 120;

export function apiRateLimiter(maxRequests = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    let entry = requestCounts.get(ip);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      requestCounts.set(ip, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return next(rateLimited(retryAfter));
    }

    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)));

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requestCounts) {
    if (now > entry.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, 60_000);
