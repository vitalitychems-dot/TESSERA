export interface SandboxedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: number;
}

export interface SandboxedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  latencyMs: number;
  timestamp: number;
  threatAnalysis: ThreatAnalysis;
}

export interface ThreatAnalysis {
  honeypotDetected: boolean;
  trackersFound: string[];
  suspiciousHeaders: string[];
  dataExfiltrationAttempt: boolean;
  codeInjectionAttempt: boolean;
  fingerprintingAttempt: boolean;
  threatLevel: "none" | "low" | "medium" | "high" | "critical";
  notes: string[];
}

export interface LearnedPattern {
  source: string;
  patternType: string;
  description: string;
  detectedAt: number;
  data: Record<string, unknown>;
}

const KNOWN_TRACKER_PATTERNS = [
  /analytics/i,
  /tracking/i,
  /telemetry/i,
  /beacon/i,
  /pixel/i,
  /fingerprint/i,
  /device-id/i,
  /session-replay/i,
  /heatmap/i,
  /event-stream.*track/i,
  /collect\?/i,
  /utm_/i,
  /fbclid/i,
  /gclid/i,
  /_ga=/i,
  /sentry/i,
  /bugsnag/i,
  /datadog/i,
  /newrelic/i,
  /mixpanel/i,
  /amplitude/i,
  /segment\.io/i,
  /heap\.io/i,
];

const HONEYPOT_INDICATORS = [
  /canary/i,
  /honeypot/i,
  /trap/i,
  /decoy/i,
  /bait/i,
  /x-request-id.*canary/i,
  /x-trace-id/i,
  /x-correlation/i,
  /x-amzn-trace/i,
  /x-ray/i,
];

const SUSPICIOUS_RESPONSE_HEADERS = [
  "x-request-id",
  "x-trace-id",
  "x-correlation-id",
  "x-amzn-trace-id",
  "x-ray-trace-id",
  "x-b3-traceid",
  "x-b3-spanid",
  "x-datadog-trace-id",
  "x-cloud-trace-context",
  "server-timing",
  "x-served-by",
  "x-backend-server",
  "x-powered-by",
  "x-aspnet-version",
  "x-runtime",
  "x-debug-token",
  "x-litespeed-cache",
];

const EXFILTRATION_PATTERNS = [
  /callback.*url/i,
  /webhook/i,
  /postback/i,
  /notify.*endpoint/i,
  /report-uri/i,
  /report-to/i,
];

const CODE_INJECTION_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /import\s*\(/i,
  /require\s*\(/i,
  /__proto__/i,
  /constructor\s*\[/i,
  /prototype/i,
];

const learnedPatterns: LearnedPattern[] = [];
const blockedSources: Set<string> = new Set();

export function analyzeResponseForThreats(
  responseHeaders: Record<string, string>,
  responseBody: unknown,
  sourceUrl: string,
): ThreatAnalysis {
  const notes: string[] = [];
  const trackersFound: string[] = [];
  const suspiciousHeaders: string[] = [];
  let honeypotDetected = false;
  let dataExfiltrationAttempt = false;
  let codeInjectionAttempt = false;
  let fingerprintingAttempt = false;

  const headerKeys = Object.keys(responseHeaders).map(h => h.toLowerCase());
  for (const header of headerKeys) {
    if (SUSPICIOUS_RESPONSE_HEADERS.includes(header)) {
      suspiciousHeaders.push(header);
      notes.push(`Suspicious tracking header detected: ${header}`);
    }
  }

  for (const pattern of HONEYPOT_INDICATORS) {
    const headerStr = JSON.stringify(responseHeaders);
    if (pattern.test(headerStr)) {
      honeypotDetected = true;
      notes.push(`Honeypot indicator in headers: ${pattern.source}`);
    }
  }

  const bodyStr = typeof responseBody === "string"
    ? responseBody
    : JSON.stringify(responseBody ?? "");

  for (const pattern of KNOWN_TRACKER_PATTERNS) {
    if (pattern.test(bodyStr)) {
      trackersFound.push(pattern.source);
      notes.push(`Tracker pattern in response body: ${pattern.source}`);
    }
  }

  for (const pattern of EXFILTRATION_PATTERNS) {
    if (pattern.test(bodyStr)) {
      dataExfiltrationAttempt = true;
      notes.push(`Data exfiltration pattern detected: ${pattern.source}`);
    }
  }

  for (const pattern of CODE_INJECTION_PATTERNS) {
    if (pattern.test(bodyStr)) {
      codeInjectionAttempt = true;
      notes.push(`Code injection attempt detected: ${pattern.source}`);
    }
  }

  if (
    bodyStr.includes("navigator.userAgent") ||
    bodyStr.includes("screen.width") ||
    bodyStr.includes("canvas.toDataURL") ||
    bodyStr.includes("WebGLRenderingContext") ||
    bodyStr.includes("AudioContext")
  ) {
    fingerprintingAttempt = true;
    notes.push("Browser fingerprinting code detected in response");
  }

  let threatLevel: ThreatAnalysis["threatLevel"] = "none";
  const score =
    (honeypotDetected ? 30 : 0) +
    (dataExfiltrationAttempt ? 40 : 0) +
    (codeInjectionAttempt ? 50 : 0) +
    (fingerprintingAttempt ? 20 : 0) +
    trackersFound.length * 10 +
    suspiciousHeaders.length * 5;

  if (score >= 50) threatLevel = "critical";
  else if (score >= 30) threatLevel = "high";
  else if (score >= 15) threatLevel = "medium";
  else if (score > 0) threatLevel = "low";

  return {
    honeypotDetected,
    trackersFound,
    suspiciousHeaders,
    dataExfiltrationAttempt,
    codeInjectionAttempt,
    fingerprintingAttempt,
    threatLevel,
    notes,
  };
}

export function sanitizeOutboundRequest(
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): { url: string; headers: Record<string, string>; body?: unknown; blocked: boolean; reason?: string } {
  if (blockedSources.has(new URL(url).hostname)) {
    return { url, headers, body, blocked: true, reason: "Source previously identified as hostile" };
  }

  const sanitizedHeaders = { ...headers };
  const headerKeysToRemove = [
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "x-cluster-client-ip",
    "forwarded",
    "via",
    "referer",
    "origin",
    "user-agent",
    "cookie",
    "authorization",
    "x-api-key",
    "x-request-id",
    "x-correlation-id",
  ];

  for (const key of headerKeysToRemove) {
    delete sanitizedHeaders[key];
    delete sanitizedHeaders[key.charAt(0).toUpperCase() + key.slice(1)];
  }

  sanitizedHeaders["user-agent"] = "TesseraSovereignAgent/1.0";

  let sanitizedUrl = url;
  try {
    const parsed = new URL(url);
    const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "_ga", "mc_cid", "mc_eid", "ref", "source"];
    for (const p of paramsToRemove) {
      parsed.searchParams.delete(p);
    }
    sanitizedUrl = parsed.toString();
  } catch {}

  let sanitizedBody = body;
  if (typeof body === "object" && body !== null) {
    sanitizedBody = stripSensitiveFields(body as Record<string, unknown>);
  }

  return { url: sanitizedUrl, headers: sanitizedHeaders, body: sanitizedBody, blocked: false };
}

function stripSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    "ip", "ipAddress", "ip_address", "clientIp", "client_ip",
    "deviceId", "device_id", "fingerprint", "sessionId", "session_id",
    "machineId", "machine_id", "hardwareId", "hardware_id",
    "location", "geoLocation", "geo_location", "lat", "lng", "latitude", "longitude",
  ];

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.includes(key)) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = stripSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function stripResponseThreats(
  body: unknown,
  analysis: ThreatAnalysis,
): unknown {
  if (analysis.threatLevel === "none") return body;

  let cleaned = typeof body === "string" ? body : JSON.stringify(body ?? "");

  if (analysis.codeInjectionAttempt) {
    cleaned = cleaned
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "[INJECTION_REMOVED]")
      .replace(/javascript:/gi, "[BLOCKED]:")
      .replace(/eval\s*\(/gi, "[BLOCKED](")
      .replace(/Function\s*\(/gi, "[BLOCKED](");
  }

  if (analysis.fingerprintingAttempt) {
    cleaned = cleaned
      .replace(/navigator\.userAgent/g, "'TesseraSovereign'")
      .replace(/screen\.(width|height)/g, "0")
      .replace(/canvas\.toDataURL/g, "'[BLOCKED]'");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return cleaned;
  }
}

export function recordLearnedPattern(
  source: string,
  patternType: string,
  description: string,
  data: Record<string, unknown> = {},
): void {
  learnedPatterns.push({
    source,
    patternType,
    description,
    detectedAt: Date.now(),
    data,
  });

  if (learnedPatterns.length > 10000) {
    learnedPatterns.splice(0, learnedPatterns.length - 5000);
  }
}

export function blockSource(hostname: string, reason: string): void {
  blockedSources.add(hostname);
  recordLearnedPattern(hostname, "blocked_source", reason);
}

export function getLearnedPatterns(): LearnedPattern[] {
  return [...learnedPatterns];
}

export function getBlockedSources(): string[] {
  return [...blockedSources];
}

export function getSecurityStatus(): {
  learnedPatterns: number;
  blockedSources: number;
  recentThreats: LearnedPattern[];
  topThreatSources: { source: string; count: number }[];
} {
  const sourceCounts = new Map<string, number>();
  for (const p of learnedPatterns) {
    sourceCounts.set(p.source, (sourceCounts.get(p.source) || 0) + 1);
  }

  const topThreatSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, count]) => ({ source, count }));

  return {
    learnedPatterns: learnedPatterns.length,
    blockedSources: blockedSources.size,
    recentThreats: learnedPatterns.slice(-20),
    topThreatSources,
  };
}

export async function sandboxedApiFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<{ data: unknown; analysis: ThreatAnalysis; sanitized: boolean; blocked: boolean }> {
  const sanitized = sanitizeOutboundRequest(
    url,
    options.headers || {},
    options.body,
  );

  if (sanitized.blocked) {
    recordLearnedPattern(new URL(url).hostname, "blocked_request", sanitized.reason || "Blocked source");
    return {
      data: null,
      analysis: {
        honeypotDetected: false,
        trackersFound: [],
        suspiciousHeaders: [],
        dataExfiltrationAttempt: false,
        codeInjectionAttempt: false,
        fingerprintingAttempt: false,
        threatLevel: "critical",
        notes: [`Request blocked: ${sanitized.reason}`],
      },
      sanitized: true,
      blocked: true,
    };
  }

  const start = Date.now();

  try {
    const response = await fetch(sanitized.url, {
      method: options.method || "GET",
      headers: sanitized.headers,
      body: sanitized.body ? JSON.stringify(sanitized.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const latencyMs = Date.now() - start;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: unknown;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    const analysis = analyzeResponseForThreats(responseHeaders, responseBody, url);

    if (analysis.threatLevel === "high" || analysis.threatLevel === "critical") {
      const hostname = new URL(url).hostname;
      recordLearnedPattern(hostname, "threat_detected", `Threat level: ${analysis.threatLevel}`, {
        notes: analysis.notes,
        trackers: analysis.trackersFound,
        honeypot: analysis.honeypotDetected,
      });

      if (analysis.threatLevel === "critical") {
        blockSource(hostname, `Auto-blocked: critical threat level detected`);
      }
    }

    const cleanedData = stripResponseThreats(responseBody, analysis);

    return {
      data: cleanedData,
      analysis,
      sanitized: true,
      blocked: false,
    };
  } catch (err: any) {
    const analysis: ThreatAnalysis = {
      honeypotDetected: false,
      trackersFound: [],
      suspiciousHeaders: [],
      dataExfiltrationAttempt: false,
      codeInjectionAttempt: false,
      fingerprintingAttempt: false,
      threatLevel: "low",
      notes: [`Request failed: ${err.message}`],
    };

    return { data: null, analysis, sanitized: true, blocked: false };
  }
}
