import { logger } from "./logger";
import crypto from "crypto";

const LOG_PREFIX = "[ExternalCallSandbox]";

interface SandboxConfig {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  timeoutMs: number;
  maxPayloadSize: number;
  allowedProviders: string[];
  sensitivePatterns: RegExp[];
}

interface SandboxedCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  blocked?: string;
  latencyMs: number;
  sanitized: boolean;
  callId: string;
}

const DEFAULT_CONFIG: SandboxConfig = {
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
  timeoutMs: 30000,
  maxPayloadSize: 100_000,
  allowedProviders: [
    "openai-integration",
    "replit-openai",
    "local-ollama",
    "puter-gpt4o",
    "openrouter",
    "deepseek",
    "xai",
    "cohere",
    "huggingface",
    "github-models",
    "data-ingestion",
    "knowledge-ingestion",
    "arxiv",
    "wikipedia",
    "github",
  ],
  sensitivePatterns: [
    /TESSERACT_ADMIN/i,
    /ADMIN_KEY/i,
    /password/i,
    /private_key/i,
    /secret/i,
    /DATABASE_URL/i,
    /API_KEY/i,
    /ACCESS_TOKEN/i,
    /BEARER\s+\w{20,}/i,
  ],
};

let sandboxConfig: SandboxConfig = { ...DEFAULT_CONFIG };

const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();

let totalCallsIntercepted = 0;
let totalCallsBlocked = 0;
let totalCallsAllowed = 0;
let totalSanitizationOps = 0;
let sandboxBootTime = Date.now();

function checkRateLimit(providerId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(providerId);

  if (!bucket || now - bucket.windowStart > sandboxConfig.rateLimit.windowMs) {
    rateLimitBuckets.set(providerId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= sandboxConfig.rateLimit.maxRequests) {
    return {
      allowed: false,
      reason: `Rate limit exceeded for ${providerId}: ${bucket.count}/${sandboxConfig.rateLimit.maxRequests} in window`,
    };
  }

  bucket.count++;
  return { allowed: true };
}

function sanitizePayload(payload: unknown): { sanitized: unknown; changed: boolean } {
  const str = JSON.stringify(payload);
  let result = str;
  let changed = false;

  for (const pattern of sandboxConfig.sensitivePatterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, "[REDACTED]");
      changed = true;
    }
  }

  if (result.length > sandboxConfig.maxPayloadSize) {
    result = result.slice(0, sandboxConfig.maxPayloadSize) + "...[TRUNCATED]";
    changed = true;
  }

  try {
    return { sanitized: JSON.parse(result), changed };
  } catch {
    return { sanitized: result, changed };
  }
}

const SSRF_BLOCKED_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /localhost/i,
  /0\.0\.0\.0/,
];

function validateKnowledgeIngestionUrl(payload: unknown): { valid: boolean; reason?: string } {
  if (typeof payload !== "object" || payload === null) return { valid: true };
  const p = payload as Record<string, unknown>;
  const url = p.url ?? p.endpoint;
  if (typeof url !== "string") return { valid: true };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: `Invalid URL: ${url}` };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, reason: `Blocked protocol: ${parsed.protocol}` };
  }

  const host = parsed.hostname;
  for (const pattern of SSRF_BLOCKED_RANGES) {
    if (pattern.test(host)) {
      return { valid: false, reason: `SSRF: blocked internal address ${host}` };
    }
  }

  return { valid: true };
}

function validateProvider(providerId: string, providerType?: string): { valid: boolean; reason?: string } {
  if (providerType === "knowledge-ingestion") {
    return { valid: true };
  }
  if (!sandboxConfig.allowedProviders.includes(providerId)) {
    if (sandboxConfig.allowedProviders.some(p => providerId.toLowerCase().includes(p.toLowerCase()))) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `Provider ${providerId} not in allowlist`,
    };
  }
  return { valid: true };
}

const SCHEMA_VALIDATORS: Record<string, (payload: unknown) => { valid: boolean; reason?: string }> = {
  "openai-integration": (payload) => {
    if (typeof payload !== "object" || payload === null) return { valid: false, reason: "payload must be an object" };
    const p = payload as Record<string, unknown>;
    if (typeof p.model !== "string") return { valid: false, reason: "model field must be a string" };
    if (typeof p.userPrompt !== "string" && typeof p.messages === "undefined" && typeof p.prompt === "undefined") {
      return { valid: false, reason: "payload must include userPrompt, prompt, or messages" };
    }
    return { valid: true };
  },
};

function validateSchema(providerId: string, payload: unknown): { valid: boolean; reason?: string } {
  const validator = SCHEMA_VALIDATORS[providerId];
  if (!validator) return { valid: true };
  return validator(payload);
}

export async function runInSandbox<T>(params: {
  providerId: string;
  providerType?: string;
  taskType?: string;
  payload: unknown;
  fn: (sanitizedPayload: unknown) => Promise<T>;
}): Promise<SandboxedCallResult<T>> {
  const callId = `sandbox-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const start = Date.now();
  totalCallsIntercepted++;

  const providerCheck = validateProvider(params.providerId, params.providerType);
  if (!providerCheck.valid) {
    totalCallsBlocked++;
    logger.warn(`${LOG_PREFIX} [${callId}] BLOCKED: ${providerCheck.reason}`);
    return {
      success: false,
      blocked: providerCheck.reason,
      latencyMs: Date.now() - start,
      sanitized: false,
      callId,
    };
  }

  if (params.providerType === "knowledge-ingestion") {
    const urlCheck = validateKnowledgeIngestionUrl(params.payload);
    if (!urlCheck.valid) {
      totalCallsBlocked++;
      logger.warn(`${LOG_PREFIX} [${callId}] SSRF BLOCKED: ${urlCheck.reason}`);
      return {
        success: false,
        blocked: urlCheck.reason,
        latencyMs: Date.now() - start,
        sanitized: false,
        callId,
      };
    }
  }

  const schemaCheck = validateSchema(params.providerId, params.payload);
  if (!schemaCheck.valid) {
    totalCallsBlocked++;
    logger.warn(`${LOG_PREFIX} [${callId}] SCHEMA INVALID: ${schemaCheck.reason}`);
    return {
      success: false,
      blocked: `Schema validation failed: ${schemaCheck.reason}`,
      latencyMs: Date.now() - start,
      sanitized: false,
      callId,
    };
  }

  const rateLimitCheck = checkRateLimit(params.providerId);
  if (!rateLimitCheck.allowed) {
    totalCallsBlocked++;
    logger.warn(`${LOG_PREFIX} [${callId}] RATE LIMITED: ${rateLimitCheck.reason}`);
    return {
      success: false,
      blocked: rateLimitCheck.reason,
      latencyMs: Date.now() - start,
      sanitized: false,
      callId,
    };
  }

  const { sanitized: sanitizedPayload, changed } = sanitizePayload(params.payload);
  if (changed) {
    totalSanitizationOps++;
    logger.info(`${LOG_PREFIX} [${callId}] Payload sanitized for ${params.providerId}`);
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${sandboxConfig.timeoutMs}ms`)), sandboxConfig.timeoutMs)
    );

    const result = await Promise.race([
      params.fn(sanitizedPayload),
      timeoutPromise,
    ]);

    totalCallsAllowed++;
    const latencyMs = Date.now() - start;
    const { sanitized: sanitizedResponse, changed: responseSanitized } = sanitizePayload(result as Record<string, unknown>);
    if (responseSanitized) {
      totalSanitizationOps++;
      logger.info(`${LOG_PREFIX} [${callId}] Response sanitized for ${params.providerId}`);
    }

    logger.info(`${LOG_PREFIX} [${callId}] SUCCESS: ${params.providerId} ${latencyMs}ms`);

    return {
      success: true,
      data: sanitizedResponse as T,
      latencyMs,
      sanitized: changed || responseSanitized,
      callId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - start;

    logger.warn(`${LOG_PREFIX} [${callId}] FAILED: ${params.providerId} — ${message}`);

    return {
      success: false,
      error: message,
      latencyMs,
      sanitized: changed,
      callId,
    };
  }
}

export function getSandboxStatus() {
  const uptimeMs = Date.now() - sandboxBootTime;
  const allowRate = totalCallsIntercepted > 0
    ? Math.round((totalCallsAllowed / totalCallsIntercepted) * 100)
    : 100;

  return {
    uptimeMs,
    totalCallsIntercepted,
    totalCallsBlocked,
    totalCallsAllowed,
    totalSanitizationOps,
    allowRate,
    rateLimitBuckets: Array.from(rateLimitBuckets.entries()).map(([provider, bucket]) => ({
      provider,
      count: bucket.count,
      windowStart: bucket.windowStart,
    })),
    config: {
      rateLimit: sandboxConfig.rateLimit,
      timeoutMs: sandboxConfig.timeoutMs,
      allowedProviders: sandboxConfig.allowedProviders,
    },
  };
}

export function updateSandboxConfig(updates: Partial<SandboxConfig>): void {
  sandboxConfig = { ...sandboxConfig, ...updates };
  logger.info(`${LOG_PREFIX} Config updated`);
}

export function resetRateLimitBucket(providerId: string): void {
  rateLimitBuckets.delete(providerId);
  logger.info(`${LOG_PREFIX} Rate limit bucket reset for ${providerId}`);
}
