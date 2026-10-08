import crypto from "crypto";
import { db } from "./db";
import { rateLimitBuckets } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { trackSuspiciousActivity } from "./security-fortress";

const rl = (msg: string) => console.log(`[PgRateLimit] ${msg}`);

const sensitiveEndpointLimits: Record<string, { max: number; windowMs: number }> = {
  "/api/sol-wallet/send": { max: 5, windowMs: 300000 },
  "/api/sol-wallet/state": { max: 30, windowMs: 60000 },
  "/api/sol-wallet/balance": { max: 20, windowMs: 60000 },
  "/api/sol-wallet/transactions": { max: 20, windowMs: 60000 },
  "/api/wallets/transfer": { max: 5, windowMs: 300000 },
  "/api/wallets/both": { max: 20, windowMs: 60000 },
  "/api/wallets/scan": { max: 10, windowMs: 60000 },
  "/api/admin/auto-auth": { max: 3, windowMs: 600000 },
  "/api/admin/status": { max: 30, windowMs: 60000 },
  "/api/vault": { max: 30, windowMs: 60000 },
  "/api/self-code/shell": { max: 10, windowMs: 60000 },
  "/api/self-code/edit": { max: 20, windowMs: 60000 },
  "/api/self-code/create-file": { max: 20, windowMs: 60000 },
  "/api/self-code/delete-file": { max: 10, windowMs: 60000 },
  "/api/self-code/patch": { max: 20, windowMs: 60000 },
  "/api/self-code/git-edit": { max: 20, windowMs: 60000 },
  "/api/self-code/refactor": { max: 10, windowMs: 60000 },
  "/api/sovereign/shell": { max: 10, windowMs: 60000 },
  "/api/ide/smart-edit": { max: 20, windowMs: 60000 },
  "/api/ide/code-from-chat": { max: 20, windowMs: 60000 },
  "/api/ide/iterative-improve": { max: 10, windowMs: 60000 },
  "/api/cybersecurity": { max: 30, windowMs: 60000 },
  "/api/security": { max: 30, windowMs: 60000 },
  "/api/config": { max: 20, windowMs: 60000 },
  "/api/wallet/balance": { max: 20, windowMs: 60000 },
  "/api/wallet/onchain": { max: 20, windowMs: 60000 },
  "/api/wallet/history": { max: 20, windowMs: 60000 },
  "/api/wallet/proof": { max: 20, windowMs: 60000 },
  "/api/code-builder/run": { max: 10, windowMs: 60000 },
};

let dbAvailable = false;
const memFallback = new Map<string, { count: number; resetTime: number; backoffLevel: number }>();

async function checkBucket(key: string, maxRequests: number, windowMs: number): Promise<{
  allowed: boolean;
  count: number;
  backoffLevel: number;
  retryAfterMs: number;
}> {
  if (!dbAvailable) {
    return checkMemFallback(key, maxRequests, windowMs);
  }

  const now = Date.now();
  const resetTime = String(now + windowMs);

  try {
    const result = await db.execute(sql`
      INSERT INTO rate_limit_buckets (bucket_key, count, reset_time, backoff_level, updated_at)
      VALUES (${key}, 1, ${resetTime}, 0, NOW())
      ON CONFLICT (bucket_key) DO UPDATE
        SET count = CASE
              WHEN CAST(rate_limit_buckets.reset_time AS BIGINT) <= ${now}
              THEN 1
              ELSE rate_limit_buckets.count + 1
            END,
            reset_time = CASE
              WHEN CAST(rate_limit_buckets.reset_time AS BIGINT) <= ${now}
              THEN ${resetTime}
              ELSE rate_limit_buckets.reset_time
            END,
            backoff_level = CASE
              WHEN CAST(rate_limit_buckets.reset_time AS BIGINT) <= ${now}
              THEN 0
              WHEN rate_limit_buckets.count + 1 > ${maxRequests}
              THEN LEAST(rate_limit_buckets.backoff_level + 1, 4)
              ELSE rate_limit_buckets.backoff_level
            END,
            updated_at = NOW()
      RETURNING count, reset_time, backoff_level
    `);

    const row = result.rows[0] as { count: number; reset_time: string; backoff_level: number };
    const count = Number(row.count);
    const storedResetTime = Number(row.reset_time);
    const backoffLevel = Number(row.backoff_level);

    if (count > maxRequests) {
      const retryAfterMs = Math.max(0, storedResetTime - now) * Math.pow(2, Math.min(backoffLevel, 4));
      return { allowed: false, count, backoffLevel, retryAfterMs };
    }

    return { allowed: true, count, backoffLevel: 0, retryAfterMs: 0 };
  } catch (err) {
    rl(`DB error, using mem fallback: ${(err as Error).message}`);
    return checkMemFallback(key, maxRequests, windowMs);
  }
}

function checkMemFallback(key: string, maxRequests: number, windowMs: number): { allowed: boolean; count: number; backoffLevel: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = memFallback.get(key);

  if (!entry || now > entry.resetTime) {
    memFallback.set(key, { count: 1, resetTime: now + windowMs, backoffLevel: 0 });
    return { allowed: true, count: 1, backoffLevel: 0, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    entry.backoffLevel = Math.min(entry.backoffLevel + 1, 4);
    const retryAfterMs = Math.max(0, entry.resetTime - now) * Math.pow(2, entry.backoffLevel);
    return { allowed: false, count: entry.count, backoffLevel: entry.backoffLevel, retryAfterMs };
  }

  entry.count++;
  return { allowed: true, count: entry.count, backoffLevel: 0, retryAfterMs: 0 };
}

export async function ensureRateLimitTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        id SERIAL PRIMARY KEY,
        bucket_key TEXT NOT NULL UNIQUE,
        count INTEGER NOT NULL DEFAULT 0,
        reset_time TEXT NOT NULL,
        backoff_level INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_time ON rate_limit_buckets (reset_time)
    `);
    dbAvailable = true;
    rl("PostgreSQL-backed rate limiter initialized");

    setInterval(async () => {
      try {
        const cutoff = String(Date.now() - 3600000);
        await db.execute(sql`DELETE FROM rate_limit_buckets WHERE CAST(reset_time AS BIGINT) < ${cutoff}`);
      } catch {}
    }, 10 * 60 * 1000);
  } catch (err) {
    rl(`Failed to initialize DB rate limiter, falling back to memory: ${(err as Error).message}`);
    dbAvailable = false;
  }
}

export function pgFortressRateLimitMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const adminToken = (req.headers as any)["x-admin-token"];
    const verKey = process.env.TESSERACT_ADMIN_KEY;
    if (adminToken && verKey && adminToken === verKey) return next();

    const matchedPrefix = Object.keys(sensitiveEndpointLimits).find(prefix => req.path.startsWith(prefix));
    if (!matchedPrefix) return next();

    const limits = sensitiveEndpointLimits[matchedPrefix];
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `fortress:${ip}:${matchedPrefix}`;

    const result = await checkBucket(key, limits.max, limits.windowMs);

    if (!result.allowed) {
      const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      trackSuspiciousActivity(ip, req.path, "rate_limit_exceeded", "HIGH");
      return res.status(429).json({
        error: "Rate limit exceeded on sensitive endpoint",
        retryAfter: retryAfterSec,
        store: dbAvailable ? "postgresql" : "memory",
      });
    }

    return next();
  };
}

export function createPgRateLimiter(maxRequests: number = 60, windowMs: number = 60000) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const adminToken = (req.headers as any)["x-admin-token"];
    const verKey = process.env.TESSERACT_ADMIN_KEY;
    if (adminToken && verKey && adminToken === verKey) return next();

    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `rl:${ip}:${req.path}`;

    const result = await checkBucket(key, maxRequests, windowMs);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - result.count));
    res.setHeader("X-RateLimit-Store", dbAvailable ? "postgresql" : "memory");

    if (!result.allowed) {
      const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: retryAfterSec,
      });
    }

    return next();
  };
}

export function getRateLimitStatus() {
  return {
    store: dbAvailable ? "postgresql" : "memory",
    memFallbackKeys: memFallback.size,
    endpointLimits: sensitiveEndpointLimits,
  };
}
