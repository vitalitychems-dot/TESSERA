import { logger } from "./logger";
import crypto from "crypto";
import { scanOutboundRequest, sanitizeOutboundHeaders, sanitizeOutboundBody } from "./api-security-hardening";

interface GatewayRequest {
  id: string;
  targetUrl: string;
  method: string;
  strippedHeaders: string[];
  anonymized: boolean;
  timestamp: number;
  responseStatus?: number;
  responseTimeMs?: number;
  blocked: boolean;
  blockReason?: string;
  dataSentBytes: number;
  dataReceivedBytes: number;
}

interface GatewayConfig {
  enabled: boolean;
  stripHeaders: string[];
  blockPatterns: RegExp[];
  rotateUserAgent: boolean;
  maxRequestsPerMinute: number;
  logAllRequests: boolean;
  anonymizeRequests: boolean;
}

interface GatewayStats {
  totalRequests: number;
  blockedRequests: number;
  anonymizedRequests: number;
  totalDataSentBytes: number;
  totalDataReceivedBytes: number;
  uniqueExternalDomains: string[];
  requestsPerDomain: Record<string, number>;
  avgResponseTimeMs: number;
  uptime: number;
  config: Omit<GatewayConfig, "blockPatterns"> & { blockPatterns: string[] };
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

const STRIP_HEADERS = [
  "x-replit-user-id",
  "x-replit-user-name",
  "x-replit-user-roles",
  "x-replit-user-teams",
  "x-replit-user-url",
  "x-replit-user-profile-image",
  "x-forwarded-for",
  "x-real-ip",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-request-id",
  "x-correlation-id",
  "x-amzn-trace-id",
  "x-cloud-trace-context",
  "x-appengine-request-log-id",
  "cf-connecting-ip",
  "cf-ray",
  "cf-ipcountry",
  "true-client-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "via",
  "referer",
  "origin",
];

const BLOCK_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /mixpanel\.com/i,
  /segment\.(io|com)/i,
  /sentry\.io/i,
  /hotjar\.com/i,
  /fullstory\.com/i,
  /newrelic\.com/i,
  /datadog-agent/i,
  /bugsnag\.com/i,
  /logrocket\.com/i,
  /amplitude\.com/i,
  /heap\.io/i,
  /mouseflow\.com/i,
  /clarity\.ms/i,
];

const requestLog: GatewayRequest[] = [];
const domainCounts: Record<string, number> = {};
let totalRequests = 0;
let blockedRequests = 0;
let anonymizedRequests = 0;
let totalDataSent = 0;
let totalDataReceived = 0;
let totalResponseTime = 0;
let responsesCount = 0;
const startTime = Date.now();
let uaRotationIdx = 0;

const config: GatewayConfig = {
  enabled: true,
  stripHeaders: [...STRIP_HEADERS],
  blockPatterns: [...BLOCK_PATTERNS],
  rotateUserAgent: true,
  maxRequestsPerMinute: 120,
  logAllRequests: true,
  anonymizeRequests: true,
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function getRotatedUserAgent(): string {
  uaRotationIdx = (uaRotationIdx + 1) % USER_AGENTS.length;
  return USER_AGENTS[uaRotationIdx];
}

function isBlockedUrl(url: string): string | null {
  for (const pattern of config.blockPatterns) {
    if (pattern.test(url)) {
      return pattern.source;
    }
  }
  return null;
}

function stripSensitiveHeaders(headers: Record<string, string>): { cleaned: Record<string, string>; stripped: string[] } {
  const cleaned: Record<string, string> = {};
  const stripped: string[] = [];

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (config.stripHeaders.includes(lowerKey)) {
      stripped.push(lowerKey);
      continue;
    }
    cleaned[key] = value;
  }

  if (config.rotateUserAgent) {
    cleaned["user-agent"] = getRotatedUserAgent();
    if (!stripped.includes("user-agent")) stripped.push("user-agent (rotated)");
  }

  return { cleaned, stripped };
}

function anonymizeRequestBody(body: any): any {
  if (!body || !config.anonymizeRequests) return body;

  if (typeof body === "string") {
    return body
      .replace(/replit/gi, "platform")
      .replace(/tessera/gi, "system")
      .replace(/tesseract/gi, "system")
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "0.0.0.0")
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "00000000-0000-0000-0000-000000000000");
  }

  if (typeof body === "object") {
    const result: any = Array.isArray(body) ? [] : {};
    for (const [key, value] of Object.entries(body)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("password") || lowerKey.includes("secret") || lowerKey.includes("token") || lowerKey.includes("key")) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "string") {
        result[key] = anonymizeRequestBody(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = anonymizeRequestBody(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return body;
}

export async function sovereignGatewayFetch(
  url: string,
  options: RequestInit = {}
): Promise<{ response: Response | null; gatewayRequest: GatewayRequest }> {
  const requestId = `gw-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const startMs = Date.now();

  const gatewayRequest: GatewayRequest = {
    id: requestId,
    targetUrl: url,
    method: (options.method || "GET").toUpperCase(),
    strippedHeaders: [],
    anonymized: config.anonymizeRequests,
    timestamp: startMs,
    blocked: false,
    dataSentBytes: 0,
    dataReceivedBytes: 0,
  };

  const blockReason = isBlockedUrl(url);
  if (blockReason) {
    gatewayRequest.blocked = true;
    gatewayRequest.blockReason = `Blocked by pattern: ${blockReason}`;
    blockedRequests++;
    totalRequests++;
    logRequest(gatewayRequest);
    logger.info("SovereignGateway", `BLOCKED ${url} — ${blockReason}`);
    return { response: null, gatewayRequest };
  }

  if (!config.enabled) {
    try {
      const response = await fetch(url, options);
      totalRequests++;
      return { response, gatewayRequest };
    } catch {
      totalRequests++;
      return { response: null, gatewayRequest };
    }
  }

  const domain = extractDomain(url);
  domainCounts[domain] = (domainCounts[domain] || 0) + 1;

  const headers = { ...(options.headers as Record<string, string> || {}) };
  const { cleaned, stripped } = stripSensitiveHeaders(headers);
  gatewayRequest.strippedHeaders = stripped;

  let processedBody = options.body;
  if (config.anonymizeRequests && processedBody) {
    try {
      if (typeof processedBody === "string") {
        const parsed = JSON.parse(processedBody);
        processedBody = JSON.stringify(anonymizeRequestBody(parsed));
      }
    } catch {
      if (typeof processedBody === "string") {
        processedBody = anonymizeRequestBody(processedBody);
      }
    }
    anonymizedRequests++;
  }

  const bodyStr = typeof processedBody === "string" ? processedBody : "";
  gatewayRequest.dataSentBytes = Buffer.byteLength(bodyStr, "utf8");
  totalDataSent += gatewayRequest.dataSentBytes;

  try {
    const scanResult = scanOutboundRequest(url, gatewayRequest.method, cleaned, bodyStr || undefined);
    if (scanResult.recommendation === "block") {
      gatewayRequest.blocked = true;
      gatewayRequest.blockReason = `Security scan: ${scanResult.risks.join("; ")}`;
      blockedRequests++;
      totalRequests++;
      logRequest(gatewayRequest);
      logger.info("SovereignGateway", `SECURITY BLOCKED ${url} — ${scanResult.risks.join(", ")}`);
      return { response: null, gatewayRequest };
    }

    let finalHeaders = cleaned;
    if (scanResult.recommendation === "strip") {
      finalHeaders = sanitizeOutboundHeaders(cleaned);
    }

    let finalBody = processedBody;
    if (bodyStr && scanResult.risks.length > 0) {
      finalBody = sanitizeOutboundBody(bodyStr);
    }

    const response = await fetch(url, {
      ...options,
      headers: finalHeaders,
      body: finalBody,
    });

    gatewayRequest.responseStatus = response.status;
    gatewayRequest.responseTimeMs = Date.now() - startMs;
    totalResponseTime += gatewayRequest.responseTimeMs;
    responsesCount++;

    totalRequests++;
    logRequest(gatewayRequest);
    return { response, gatewayRequest };
  } catch (err: any) {
    gatewayRequest.responseStatus = 0;
    gatewayRequest.responseTimeMs = Date.now() - startMs;
    totalRequests++;
    logRequest(gatewayRequest);
    logger.error("SovereignGateway", `Request failed: ${url} — ${err.message}`);
    return { response: null, gatewayRequest };
  }
}

function logRequest(req: GatewayRequest): void {
  if (!config.logAllRequests) return;
  requestLog.push(req);
  if (requestLog.length > 1000) requestLog.splice(0, requestLog.length - 1000);
}

export function getGatewayStats(): GatewayStats {
  return {
    totalRequests,
    blockedRequests,
    anonymizedRequests,
    totalDataSentBytes: totalDataSent,
    totalDataReceivedBytes: totalDataReceived,
    uniqueExternalDomains: Object.keys(domainCounts),
    requestsPerDomain: { ...domainCounts },
    avgResponseTimeMs: responsesCount > 0 ? Math.round(totalResponseTime / responsesCount) : 0,
    uptime: Date.now() - startTime,
    config: {
      ...config,
      blockPatterns: config.blockPatterns.map(p => p.source),
    },
  };
}

export function getRecentRequests(limit: number = 50): GatewayRequest[] {
  return requestLog.slice(-limit);
}

export function getBlockedRequests(limit: number = 50): GatewayRequest[] {
  return requestLog.filter(r => r.blocked).slice(-limit);
}

export function addBlockPattern(pattern: string): void {
  try {
    config.blockPatterns.push(new RegExp(pattern, "i"));
    logger.info("SovereignGateway", `Added block pattern: ${pattern}`);
  } catch (err: any) {
    logger.error("SovereignGateway", `Invalid pattern: ${pattern} — ${err.message}`);
  }
}

export function addStripHeader(header: string): void {
  const lower = header.toLowerCase();
  if (!config.stripHeaders.includes(lower)) {
    config.stripHeaders.push(lower);
  }
}

export function getGatewayConfig(): typeof config & { blockPatterns: string[] } {
  return {
    ...config,
    blockPatterns: config.blockPatterns.map(p => p.source) as any,
  };
}

export function updateGatewayConfig(updates: Partial<Pick<GatewayConfig, "enabled" | "rotateUserAgent" | "maxRequestsPerMinute" | "logAllRequests" | "anonymizeRequests">>): void {
  Object.assign(config, updates);
  logger.info("SovereignGateway", `Config updated: ${JSON.stringify(updates)}`);
}

export function getExternalDependencyReport(): {
  totalDomains: number;
  domains: { domain: string; requests: number; percentOfTotal: number }[];
  sovereigntyScore: number;
} {
  const domains = Object.entries(domainCounts)
    .map(([domain, requests]) => ({
      domain,
      requests,
      percentOfTotal: totalRequests > 0 ? parseFloat(((requests / totalRequests) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  const externalDomainCount = domains.length;
  const sovereigntyScore = Math.max(0, 100 - externalDomainCount * 5 - (blockedRequests > 0 ? 0 : 10));

  return {
    totalDomains: externalDomainCount,
    domains,
    sovereigntyScore: Math.min(100, sovereigntyScore),
  };
}
