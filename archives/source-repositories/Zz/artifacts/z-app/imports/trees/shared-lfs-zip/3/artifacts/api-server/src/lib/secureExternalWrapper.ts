import { db } from "@workspace/db";
import { securityAuditLog } from "@workspace/db/schema";
import { logger } from "./logger";

export interface ExternalRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  requestedBy?: string;
}

export interface ExternalRequestResult {
  status: number;
  body: string;
  durationMs: number;
  flagged: boolean;
  flagReason?: string;
}

const ALLOWED_DOMAINS: string[] = (
  process.env.ALLOWED_EXTERNAL_DOMAINS ?? ""
)
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

const DEFAULT_TIMEOUT_MS = 10_000;

const INTRUSION_WINDOW_MS = 60_000;
const INTRUSION_THRESHOLD = 30;

interface CallRecord {
  url: string;
  ts: number;
}

const recentCalls: CallRecord[] = [];

function isDomainAllowed(url: string): { allowed: boolean; domain: string } {
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    return { allowed: false, domain: url };
  }
  if (ALLOWED_DOMAINS.length === 0) {
    return { allowed: true, domain };
  }
  const allowed = ALLOWED_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`)
  );
  return { allowed, domain };
}

function detectIntrusion(url: string): { flagged: boolean; reason?: string } {
  const now = Date.now();
  recentCalls.push({ url, ts: now });

  const windowStart = now - INTRUSION_WINDOW_MS;
  while (recentCalls.length > 0 && recentCalls[0].ts < windowStart) {
    recentCalls.shift();
  }

  if (recentCalls.length > INTRUSION_THRESHOLD) {
    return {
      flagged: true,
      reason: `Burst detected: ${recentCalls.length} calls in the last ${INTRUSION_WINDOW_MS / 1000}s`,
    };
  }

  return { flagged: false };
}

async function logToDb(entry: {
  targetUrl: string;
  method: string;
  status: number | null;
  durationMs: number | null;
  flagged: boolean;
  flagReason: string | null;
  requestedBy: string | null;
}): Promise<void> {
  try {
    await db.insert(securityAuditLog).values({
      targetUrl: entry.targetUrl,
      method: entry.method,
      status: entry.status ?? undefined,
      durationMs: entry.durationMs ?? undefined,
      flagged: entry.flagged,
      flagReason: entry.flagReason ?? undefined,
      requestedBy: entry.requestedBy ?? undefined,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write security audit log entry");
  }
}

export async function secureExternalFetch(
  url: string,
  options: ExternalRequestOptions = {}
): Promise<ExternalRequestResult> {
  const method = (options.method ?? "GET").toUpperCase();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestedBy = options.requestedBy ?? null;

  const { allowed, domain } = isDomainAllowed(url);
  if (!allowed) {
    const flagReason = `Domain not in allowlist: ${domain}`;
    logger.warn({ url, domain }, flagReason);
    await logToDb({
      targetUrl: url,
      method,
      status: null,
      durationMs: null,
      flagged: true,
      flagReason,
      requestedBy,
    });
    throw new Error(`[SecureWrapper] ${flagReason}`);
  }

  const intrusionCheck = detectIntrusion(url);
  let flagged = intrusionCheck.flagged;
  let flagReason: string | undefined = intrusionCheck.reason;

  if (flagged) {
    logger.warn({ url, reason: flagReason }, "Intrusion detection triggered");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  let status: number | null = null;
  let body = "";

  try {
    const res = await fetch(url, {
      method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    status = res.status;
    body = await res.text();

    const durationMs = Date.now() - start;
    clearTimeout(timer);

    logger.info(
      { url, method, status, durationMs, flagged },
      "External request completed"
    );

    await logToDb({
      targetUrl: url,
      method,
      status,
      durationMs,
      flagged,
      flagReason: flagReason ?? null,
      requestedBy,
    });

    return { status, body, durationMs, flagged, flagReason };
  } catch (err) {
    clearTimeout(timer);
    const durationMs = Date.now() - start;
    const isTimeout = (err as Error).name === "AbortError";

    flagged = true;
    flagReason = isTimeout
      ? `Request timed out after ${timeoutMs}ms`
      : `Request error: ${(err as Error).message}`;

    logger.error({ url, method, err, durationMs }, flagReason);

    await logToDb({
      targetUrl: url,
      method,
      status,
      durationMs,
      flagged: true,
      flagReason,
      requestedBy,
    });

    throw new Error(`[SecureWrapper] ${flagReason}`);
  }
}

export function getAllowedDomains(): string[] {
  return [...ALLOWED_DOMAINS];
}
