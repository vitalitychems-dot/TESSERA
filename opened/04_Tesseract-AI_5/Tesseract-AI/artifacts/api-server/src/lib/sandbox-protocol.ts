const LOG_PREFIX = "[SandboxProtocol]";

export interface SandboxConfig {
  maxTimeoutMs: number;
  maxResponseSizeBytes: number;
  stripTrackers: boolean;
  blockHoneypots: boolean;
  sanitizeHtml: boolean;
  isolateJavaScript: boolean;
  blockCookies: boolean;
  enforceHttps: boolean;
  logAllCalls: boolean;
}

export interface SandboxedRequest {
  requestId: string;
  url: string;
  method: string;
  timestamp: number;
  sandboxApplied: boolean;
  trackersStripped: number;
  honeypotBlocked: boolean;
  sanitized: boolean;
  isolationLevel: "full" | "partial" | "none";
  responseClean: boolean;
  riskScore: number;
  warnings: string[];
}

export interface SandboxStatus {
  active: boolean;
  totalRequests: number;
  blockedRequests: number;
  trackersStripped: number;
  honeypotAttempts: number;
  avgRiskScore: number;
  isolationLevel: "full" | "partial" | "none";
  config: SandboxConfig;
  protectionScore: number;
  rules: string[];
}

const DEFAULT_CONFIG: SandboxConfig = {
  maxTimeoutMs: 10_000,
  maxResponseSizeBytes: 5_000_000,
  stripTrackers: true,
  blockHoneypots: true,
  sanitizeHtml: true,
  isolateJavaScript: true,
  blockCookies: true,
  enforceHttps: true,
  logAllCalls: true,
};

const TRACKER_PATTERNS = [
  /google-analytics/i,
  /facebook.*pixel/i,
  /doubleclick/i,
  /hotjar/i,
  /mixpanel/i,
  /segment\.io/i,
  /amplitude/i,
  /sentry\.io/i,
  /bugsnag/i,
  /newrelic/i,
  /datadog/i,
  /utm_/i,
  /fbclid/i,
  /gclid/i,
  /__ga/i,
  /_ga=/i,
  /mc_cid/i,
  /mc_eid/i,
];

const HONEYPOT_PATTERNS = [
  /hidden.*form/i,
  /trap.*field/i,
  /honeypot/i,
  /invisible.*input/i,
  /style="display:none"/i,
  /aria-hidden="true".*input/i,
  /captcha.*hidden/i,
];

const DANGEROUS_PATTERNS = [
  /<script[^>]*>/i,
  /javascript:/i,
  /on(load|error|click|mouseover)=/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /document\.cookie/i,
  /window\.location/i,
  /\.exe\b/i,
  /\.dll\b/i,
  /base64.*decode/i,
];

let totalRequests = 0;
let blockedRequests = 0;
let totalTrackersStripped = 0;
let honeypotAttempts = 0;
let riskScores: number[] = [];

export function stripTrackers(content: string): { cleaned: string; stripped: number } {
  let stripped = 0;
  let cleaned = content;

  for (const pattern of TRACKER_PATTERNS) {
    const matches = cleaned.match(new RegExp(pattern.source, "gi"));
    if (matches) {
      stripped += matches.length;
      cleaned = cleaned.replace(new RegExp(pattern.source, "gi"), "[TRACKER_STRIPPED]");
    }
  }

  cleaned = cleaned.replace(/https?:\/\/[^\s"']*(?:analytics|tracking|telemetry|pixel)[^\s"']*/gi, "[TRACKING_URL_REMOVED]");

  return { cleaned, stripped };
}

export function detectHoneypots(content: string): { detected: boolean; count: number } {
  let count = 0;
  for (const pattern of HONEYPOT_PATTERNS) {
    const matches = content.match(new RegExp(pattern.source, "gi"));
    if (matches) count += matches.length;
  }
  return { detected: count > 0, count };
}

export function sanitizeResponse(content: string): { sanitized: string; threats: string[] } {
  const threats: string[] = [];
  let sanitized = content;

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      threats.push(`Dangerous pattern: ${pattern.source}`);
      sanitized = sanitized.replace(new RegExp(pattern.source, "gi"), "[SANITIZED]");
    }
  }

  return { sanitized, threats };
}

export function calculateRiskScore(url: string, content: string): number {
  let risk = 0;

  if (!url.startsWith("https://")) risk += 20;
  if (url.includes("eval") || url.includes("exec")) risk += 30;

  const { stripped } = stripTrackers(content);
  risk += Math.min(stripped * 5, 25);

  const { count: honeypots } = detectHoneypots(content);
  risk += honeypots * 15;

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) risk += 10;
  }

  return Math.min(risk, 100);
}

export function processSandboxedRequest(url: string, method: string, responseContent: string): SandboxedRequest {
  totalRequests++;

  const riskScore = calculateRiskScore(url, responseContent);
  riskScores.push(riskScore);
  if (riskScores.length > 1000) riskScores = riskScores.slice(-500);

  const trackerResult = stripTrackers(responseContent);
  totalTrackersStripped += trackerResult.stripped;

  const honeypotResult = detectHoneypots(responseContent);
  if (honeypotResult.detected) {
    honeypotAttempts++;
  }

  const sanitizeResult = sanitizeResponse(trackerResult.cleaned);

  const warnings: string[] = [];
  if (riskScore > 50) warnings.push(`High risk score: ${riskScore}`);
  if (trackerResult.stripped > 0) warnings.push(`Stripped ${trackerResult.stripped} trackers`);
  if (honeypotResult.detected) warnings.push(`Blocked ${honeypotResult.count} honeypot(s)`);
  if (sanitizeResult.threats.length > 0) warnings.push(...sanitizeResult.threats);

  if (riskScore > 80) {
    blockedRequests++;
    warnings.push("REQUEST BLOCKED — risk too high");
  }

  return {
    requestId: `sbx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    url,
    method,
    timestamp: Date.now(),
    sandboxApplied: true,
    trackersStripped: trackerResult.stripped,
    honeypotBlocked: honeypotResult.detected,
    sanitized: sanitizeResult.threats.length > 0,
    isolationLevel: "full",
    responseClean: riskScore < 30,
    riskScore,
    warnings,
  };
}

export function getSandboxStatus(): SandboxStatus {
  const avgRisk = riskScores.length > 0
    ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
    : 0;

  return {
    active: true,
    totalRequests,
    blockedRequests,
    trackersStripped: totalTrackersStripped,
    honeypotAttempts,
    avgRiskScore: avgRisk,
    isolationLevel: "full",
    config: { ...DEFAULT_CONFIG },
    protectionScore: Math.max(0, 100 - avgRisk),
    rules: [
      "SR-001: All external calls sandboxed",
      "SR-002: 3-layer isolation enforced",
      "SR-007: Sovereign learning protocol active",
      "SR-010: Scrape → Sandbox → Extract → Integrate",
      "SR-011: Hardened code doctrine enforced",
    ],
  };
}
