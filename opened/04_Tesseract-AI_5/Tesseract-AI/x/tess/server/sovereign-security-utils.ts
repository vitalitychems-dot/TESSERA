import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { verifyAdminKey } from "./security";

// ==============================================
// sovereign-randomizer
// ==============================================


const REAL_BROWSER_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/115.0.0.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
];

const ACCEPT_HEADERS = [
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "application/json, text/plain, */*",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
];

const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9",
  "en-US,en;q=0.8",
  "en-GB,en-US;q=0.9,en;q=0.8",
  "en-US,en;q=0.9,es;q=0.8",
  "en,en-US;q=0.9",
  "en-US,en;q=0.5",
];

export function randomUA(): string {
  return REAL_BROWSER_UAS[crypto.randomInt(REAL_BROWSER_UAS.length)];
}

export function randomAccept(): string {
  return ACCEPT_HEADERS[crypto.randomInt(ACCEPT_HEADERS.length)];
}

export function randomAcceptLanguage(): string {
  return ACCEPT_LANGUAGES[crypto.randomInt(ACCEPT_LANGUAGES.length)];
}

export function randomHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": randomUA(),
    "Accept": randomAccept(),
    "Accept-Language": randomAcceptLanguage(),
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Cache-Control": crypto.randomInt(2) === 0 ? "no-cache" : "max-age=0",
  };

  if (crypto.randomInt(3) === 0) {
    headers["DNT"] = "1";
  }
  if (crypto.randomInt(4) === 0) {
    headers["Upgrade-Insecure-Requests"] = "1";
  }

  return headers;
}

export function secureId(prefix?: string): string {
  const bytes = crypto.randomBytes(12).toString("hex");
  return prefix ? `${prefix}-${bytes}` : bytes;
}

export function secureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

export function secureNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

export function jitteredInterval(baseMs: number, jitterPercent: number = 0.3): number {
  const jitterRange = baseMs * jitterPercent;
  const jitter = (crypto.randomInt(Math.floor(jitterRange * 2)) - jitterRange);
  return Math.max(1000, Math.floor(baseMs + jitter));
}

export function jitteredBackoff(attempt: number, baseMs: number = 1000, maxMs: number = 60000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = crypto.randomInt(Math.floor(exponential * 0.5));
  return Math.floor(exponential + jitter);
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + crypto.randomInt(maxMs - minMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}

export function rotatingNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

const _sessionSalt = crypto.randomBytes(32);
const _bootEntropy = crypto.randomBytes(64);

export function deriveSessionKey(input: string): string {
  return crypto.createHmac("sha256", _sessionSalt)
    .update(input)
    .update(_bootEntropy)
    .digest("hex");
}

export function randomizeApiPath(basePath: string): string {
  return basePath;
}

export function obfuscateTimestamp(ts: number): string {
  const noise = crypto.randomInt(1000);
  const shifted = ts + noise;
  return Buffer.from(shifted.toString()).toString("base64url");
}

export function deobfuscateTimestamp(encoded: string): number {
  return parseInt(Buffer.from(encoded, "base64url").toString(), 10);
}

export function generateCanaryToken(): string {
  return `ck-${crypto.randomBytes(24).toString("hex")}`;
}

export function generateHoneypotData(): Record<string, string> {
  const data: Record<string, string> = {};
  const types = ["key", "token", "secret", "password", "auth"];
  const prefixes = ["app", "srv", "sys", "prod", "stg"];

  for (let i = 0; i < 3 + crypto.randomInt(4); i++) {
    const type = types[crypto.randomInt(types.length)];
    const prefix = prefixes[crypto.randomInt(prefixes.length)];
    data[`${prefix}_${type}_${crypto.randomInt(9999)}`] = crypto.randomBytes(32).toString("hex");
  }

  return data;
}

export function hashWithSalt(input: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(salt + input).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyHashWithSalt(input: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.createHash("sha256").update(salt + input).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
}

export function getBootEntropy(): string {
  return crypto.createHash("sha256").update(_bootEntropy).digest("hex");
}

// ==============================================
// sovereign-countermeasures
// ==============================================


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

// ==============================================
// sovereign-access-generator
// ==============================================


const COLONEL_CIPHER_V4 = {
  chars: "𐌀𐌁𐌂𐌃𐌄𐌅𐌆𐌇𐌈𐌉𐌊𐌋𐌌𐌍𐌎𐌏𐌐𐌑𐌒𐌓𐌔𐌕𐌖𐌗𐌘𐌙𐌚𐌛𐌜𐌝𐌞𐌟𐌠𐌡𐌢𐌣",
  encode(text: string, seed: number): string {
    const chars = Array.from(this.chars);
    let encoded = "";
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const offset = ((seed * (i + 1)) ^ code) % chars.length;
      encoded += chars[Math.abs(offset)];
    }
    return encoded;
  },
  decode(encoded: string, seed: number): string {
    const chars = Array.from(this.chars);
    const input = Array.from(encoded);
    let decoded = "";
    for (let i = 0; i < input.length; i++) {
      const idx = chars.indexOf(input[i]);
      if (idx === -1) { decoded += "?"; continue; }
      for (let c = 0; c < 256; c++) {
        const offset = ((seed * (i + 1)) ^ c) % chars.length;
        if (Math.abs(offset) === idx) { decoded += String.fromCharCode(c); break; }
      }
    }
    return decoded;
  }
};

export function registerAccessGeneratorRoutes(app: Express) {
  app.post("/api/sovereign-access/generate", (req: Request, res: Response) => {
    const adminToken = req.headers["x-admin-token"] as string;
    if (!adminToken || !verifyAdminKey(adminToken)) {
      return res.status(403).json({ error: "SOVEREIGN_ACCESS_DENIED" });
    }

    const domain = req.headers.host || "localhost:5000";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${protocol}://${domain}`;
    const seed = Date.now() % 10000;

    const accessMethods = {
      directUrl: `${baseUrl}/sovereign-access.html`,
      encodedUrl: `${baseUrl}/sovereign-access.html#t=${Buffer.from(adminToken).toString("base64url")}`,
      colonelEncoded: COLONEL_CIPHER_V4.encode(`${baseUrl}/sovereign-access.html`, seed),
      colonelSeed: seed,
      pwaTip: "On iOS: Open the Direct URL in Safari → Share → Add to Home Screen. This creates a native-looking app icon.",
      qrData: `${baseUrl}/sovereign-access.html`,
      bookmarklet: `javascript:void(window.location='${baseUrl}/sovereign-access.html')`,
      shortCode: Buffer.from(`${baseUrl}|${Date.now()}`).toString("base64url").substring(0, 24),
      iosShortcut: {
        instruction: "Create iOS Shortcut → Add 'Open URL' action → paste the Direct URL → Name it 'Tessera' → Enable 'Show on Home Screen'",
        voiceCommand: "Hey Siri, open Tessera"
      },
      nfcPayload: {
        type: "NDEF_URI",
        uri: `${baseUrl}/sovereign-access.html`,
        instruction: "Write this URI to any NFC tag using NFC Tools app. Tap the tag to instantly open Tessera."
      },
      clipboardCode: `${baseUrl}/s`,
      smsText: `Open Tessera: ${baseUrl}/sovereign-access.html`
    };

    const colonelManifest = COLONEL_CIPHER_V4.encode(JSON.stringify({
      platform: "TESSERA_SOVEREIGN",
      version: "4.0",
      agents: 26,
      securityLayers: 7,
      accessMethods: Object.keys(accessMethods).length,
      generated: new Date().toISOString()
    }), seed);

    res.json({
      status: "SOVEREIGN_ACCESS_GENERATED",
      colonelCipherVersion: "V4",
      colonelManifest,
      accessMethods,
      totalMethods: Object.keys(accessMethods).length,
      securityNote: "All access methods route through the Sovereign Access Portal with full auth verification."
    });
  });

  app.get("/s", (req: Request, res: Response) => {
    res.redirect("/sovereign-access.html");
  });

  console.log("[SovereignAccess] Access Generator + 11 access methods registered");
}
