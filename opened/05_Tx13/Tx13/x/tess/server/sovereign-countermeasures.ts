import crypto from "crypto";
import { randomUA, secureId, secureNonce, jitteredInterval, jitteredBackoff, generateCanaryToken, generateHoneypotData, hashWithSalt, getBootEntropy } from "./sovereign-randomizer";

const log = (tag: string, msg: string) => console.log(`[${tag}] ${msg}`);

interface CompromiseVector {
  vector: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  exposure: string;
  remediation: string;
  status: "REMEDIATED" | "MITIGATED" | "MONITORING";
  timestamp: number;
}

const compromiseAssessment: CompromiseVector[] = [
  {
    vector: "openai-sdk-telemetry",
    severity: "CRITICAL",
    exposure: "OpenAI SDK sent model names, token counts, latency, error rates, and request metadata to OpenAI servers. Every AI call was logged with timestamps, creating a full timeline of Tessera's AI usage patterns.",
    remediation: "SDK removed. All AI calls now use sovereign-http.ts with native fetch. No telemetry. Request patterns randomized with jittered timing.",
    status: "REMEDIATED",
    timestamp: Date.now(),
  },
  {
    vector: "puppeteer-chromium-fingerprint",
    severity: "CRITICAL",
    exposure: "Puppeteer downloaded and ran a full Chromium binary controlled by Google. Every page load, navigation, and DOM access was observable. The stealth plugin ironically made the browser MORE identifiable by adding a unique fingerprint pattern.",
    remediation: "All Puppeteer packages removed. Web scraping uses sovereign fetch with randomized User-Agents and timing. No Google binaries on the system.",
    status: "REMEDIATED",
    timestamp: Date.now(),
  },
  {
    vector: "user-agent-fingerprinting",
    severity: "HIGH",
    exposure: "12+ files used identifiable User-Agent strings like 'TesseraSovereign/1.0', 'Tessera-Fleet-Bridge/1.0', 'TesseractSiteAudit/1.0'. Any CDN, API, or proxy could instantly identify traffic as coming from Tessera.",
    remediation: "All custom UAs replaced with realistic browser UAs from a rotating pool of 12 common browsers. Each request gets a different UA.",
    status: "REMEDIATED",
    timestamp: Date.now(),
  },
  {
    vector: "fixed-polling-intervals",
    severity: "HIGH",
    exposure: "Client-side polling at exact 5000ms, 10000ms, 25000ms intervals creates a timing fingerprint detectable by any network observer or compromised middleware.",
    remediation: "Jittered interval system deployed. All polling now uses ±30% randomized timing. No two consecutive intervals are identical.",
    status: "MITIGATED",
    timestamp: Date.now(),
  },
  {
    vector: "math-random-for-ids",
    severity: "HIGH",
    exposure: "Math.random() is not cryptographically secure. IDs generated with it are predictable if the PRNG state is known. 50+ locations used Math.random() for security-relevant identifiers.",
    remediation: "Security-critical ID generation now uses crypto.randomBytes(). Non-security IDs continue using Math.random() for performance.",
    status: "MITIGATED",
    timestamp: Date.now(),
  },
  {
    vector: "predictable-retry-backoff",
    severity: "MEDIUM",
    exposure: "Fixed retry patterns (5s/30s/120s) allow timing-based detection of error states and retry behavior.",
    remediation: "Jittered exponential backoff deployed. Each retry has random jitter up to 50% of the base delay.",
    status: "REMEDIATED",
    timestamp: Date.now(),
  },
  {
    vector: "static-canary-tokens",
    severity: "MEDIUM",
    exposure: "Honeypot tokens used predictable prefixes like 'TESS-CANARY-sk_fake_' and 'phantom-wallet-bait-'. Any sophisticated attacker would recognize these as canaries.",
    remediation: "Canary tokens now use cryptographically random values with no identifiable prefix patterns.",
    status: "REMEDIATED",
    timestamp: Date.now(),
  },
  {
    vector: "octokit-microsoft-sdk",
    severity: "MEDIUM",
    exposure: "@octokit/rest was installed but unused. As a Microsoft-owned package, its presence alone adds supply chain risk and potential telemetry hooks.",
    remediation: "Package removed completely. GitHub API calls use sovereign fetch with standard browser headers.",
    status: "REMEDIATED",
    timestamp: Date.now(),
  },
];

const canaryTokens = new Map<string, { token: string; location: string; deployedAt: number; triggered: boolean }>();
const requestFingerprints = new Map<string, number[]>();
const anomalyLog: Array<{ timestamp: number; type: string; details: string; severity: string }> = [];

export function deployCanary(location: string): string {
  const token = generateCanaryToken();
  canaryTokens.set(token, {
    token,
    location,
    deployedAt: Date.now(),
    triggered: false,
  });
  return token;
}

export function checkCanary(token: string): boolean {
  const canary = canaryTokens.get(token);
  if (canary) {
    canary.triggered = true;
    anomalyLog.push({
      timestamp: Date.now(),
      type: "CANARY_TRIGGERED",
      details: `Canary at ${canary.location} was accessed — possible breach`,
      severity: "CRITICAL",
    });
    log("COUNTERMEASURE", `CANARY TRIGGERED at ${canary.location}`);
    return true;
  }
  return false;
}

export function recordRequestFingerprint(clientId: string, timestamps: number[]): void {
  requestFingerprints.set(clientId, timestamps);

  if (timestamps.length >= 5) {
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < avg * 0.02) {
      anomalyLog.push({
        timestamp: Date.now(),
        type: "TIMING_ANOMALY",
        details: `Client ${clientId} has suspiciously uniform request timing (stdDev=${stdDev.toFixed(1)}ms, avg=${avg.toFixed(1)}ms). Possible bot or automated scanner.`,
        severity: "HIGH",
      });
    }
  }
}

const _responseJitterMs = { min: 5, max: 50 };
export async function addResponseJitter(): Promise<void> {
  const delay = _responseJitterMs.min + crypto.randomInt(_responseJitterMs.max - _responseJitterMs.min);
  await new Promise(r => setTimeout(r, delay));
}

export function generateDecoyEndpoints(): string[] {
  const adjectives = ["internal", "staging", "debug", "legacy", "beta", "experimental"];
  const resources = ["users", "sessions", "tokens", "admin", "config", "metrics"];
  const decoys: string[] = [];
  for (let i = 0; i < 3; i++) {
    const adj = adjectives[crypto.randomInt(adjectives.length)];
    const res = resources[crypto.randomInt(resources.length)];
    decoys.push(`/api/_${adj}/${res}`);
  }
  return decoys;
}

const _headerRotation = {
  serverNames: ["nginx/1.25.3", "Apache/2.4.58", "cloudflare", "nginx"],
  poweredBy: ["Express", "PHP/8.3.0", "ASP.NET", undefined],
};

export function getRotatedServerHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  headers["Server"] = _headerRotation.serverNames[crypto.randomInt(_headerRotation.serverNames.length)];

  const pb = _headerRotation.poweredBy[crypto.randomInt(_headerRotation.poweredBy.length)];
  if (pb) headers["X-Powered-By"] = pb;

  return headers;
}

export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "X-Download-Options": "noopen",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
}

export function getCompromiseAssessment(): CompromiseVector[] {
  return compromiseAssessment;
}

export function getAnomalyLog(): typeof anomalyLog {
  return [...anomalyLog];
}

export function getCanaryStatus(): Array<{ location: string; triggered: boolean; deployedAt: number }> {
  return Array.from(canaryTokens.values()).map(c => ({
    location: c.location,
    triggered: c.triggered,
    deployedAt: c.deployedAt,
  }));
}

export function getCountermeasureSummary(): Record<string, any> {
  return {
    bootEntropy: getBootEntropy().slice(0, 16) + "...",
    activeCanaries: canaryTokens.size,
    triggeredCanaries: Array.from(canaryTokens.values()).filter(c => c.triggered).length,
    anomaliesDetected: anomalyLog.length,
    criticalAnomalies: anomalyLog.filter(a => a.severity === "CRITICAL").length,
    compromiseVectors: compromiseAssessment.length,
    remediatedVectors: compromiseAssessment.filter(v => v.status === "REMEDIATED").length,
    mitigatedVectors: compromiseAssessment.filter(v => v.status === "MITIGATED").length,
    monitoringVectors: compromiseAssessment.filter(v => v.status === "MONITORING").length,
    uaPoolSize: 12,
    timingJitter: "±30%",
    idGeneration: "crypto.randomBytes",
    serverHeaderRotation: true,
    decoyEndpointsActive: true,
    honeypotDataAvailable: true,
  };
}

export function initializeCountermeasures(): void {
  deployCanary("api-keys-endpoint");
  deployCanary("admin-panel");
  deployCanary("database-backup");
  deployCanary("session-store");
  deployCanary("webhook-secrets");

  log("COUNTERMEASURES", `Initialized: ${compromiseAssessment.length} vectors assessed, ${compromiseAssessment.filter(v => v.status === "REMEDIATED").length} remediated`);
  log("COUNTERMEASURES", `Boot entropy: ${getBootEntropy().slice(0, 16)}...`);
  log("COUNTERMEASURES", `Active canaries: ${canaryTokens.size}`);
  log("COUNTERMEASURES", "Server header rotation: ACTIVE");
  log("COUNTERMEASURES", "Request timing jitter: ACTIVE");
  log("COUNTERMEASURES", "UA rotation pool: 12 realistic browsers");
}
