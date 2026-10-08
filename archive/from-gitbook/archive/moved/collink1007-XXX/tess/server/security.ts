import crypto from "crypto";
import { storage } from "./storage";

const T9_SALT = process.env.T9_SALT || crypto.randomBytes(32).toString("base64");
const T9_PEPPER = process.env.T9_PEPPER || crypto.randomBytes(32).toString("base64");

if (!process.env.T9_SALT || !process.env.T9_PEPPER) {
  console.warn("[Security] WARNING: Encryption salt/pepper not set in environment. Generated random values for this session.");
}

function deriveHash(input: string): string {
  const salted = T9_SALT + input + T9_PEPPER;
  const h1 = crypto.createHash("sha256").update(salted).digest("hex");
  const h2 = crypto.createHash("sha512").update(h1 + T9_SALT).digest("hex");
  const h3 = crypto.createHash("sha256").update(h2 + T9_PEPPER + h1).digest("hex");
  return h3;
}

function obfuscateForStorage(value: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(T9_SALT + T9_PEPPER, "t9_scrypt", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

function deobfuscateFromStorage(stored: string): string {
  try {
    const parts = stored.split(":");
    if (parts.length === 3) {
      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const key = crypto.scryptSync(T9_SALT + T9_PEPPER, "t9_scrypt", 32);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }
    const [ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(T9_SALT + T9_PEPPER, "t9_scrypt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

export async function verifyAdminKey(providedKey: string): Promise<boolean> {
  if (!providedKey) return false;
  const trimmedKey = providedKey.trim();

  const envKey = process.env.TESSERACT_ADMIN_KEY;
  if (!envKey) return false;
  const envTrimmed = envKey.trim();
  if (trimmedKey === envTrimmed) return true;
  try {
    const a = Buffer.from(trimmedKey, "utf-8");
    const b = Buffer.from(envTrimmed, "utf-8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  } catch {}
  return false;
}

export async function isAdminKeyConfigured(): Promise<boolean> {
  return !!process.env.TESSERACT_ADMIN_KEY;
}

export async function setAdminKey(_rawKey: string): Promise<void> {
  try {
    const existing = await storage.getKey("tessera-admin", "ADMIN_KEY");
    if (existing) {
      await storage.deleteKey(existing.id);
    }
  } catch {}
}

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const activeSessions = new Map<string, number>();

export async function checkAdminSession(sessionToken: string): Promise<boolean> {
  if (!sessionToken) return false;
  const hash = deriveHash(sessionToken);
  const created = activeSessions.get(hash);
  if (created === undefined) return false;
  if (Date.now() - created > SESSION_MAX_AGE_MS) {
    activeSessions.delete(hash);
    return false;
  }
  return true;
}

export function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = deriveHash(token);
  activeSessions.set(hash, Date.now());
  setTimeout(() => activeSessions.delete(hash), SESSION_MAX_AGE_MS);
  return token;
}

export function getAdminSessionInfo(sessionToken: string): { valid: boolean; createdAt: number | null; expiresAt: number | null; remainingMs: number | null } {
  if (!sessionToken) return { valid: false, createdAt: null, expiresAt: null, remainingMs: null };
  const hash = deriveHash(sessionToken);
  const created = activeSessions.get(hash);
  if (created === undefined) return { valid: false, createdAt: null, expiresAt: null, remainingMs: null };
  const expiresAt = created + SESSION_MAX_AGE_MS;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    activeSessions.delete(hash);
    return { valid: false, createdAt: null, expiresAt: null, remainingMs: null };
  }
  return { valid: true, createdAt: created, expiresAt, remainingMs };
}

export function clearExpiredSessions(): void {
  const now = Date.now();
  for (const [hash, created] of activeSessions) {
    if (now - created > SESSION_MAX_AGE_MS) activeSessions.delete(hash);
  }
}

const threatLog: Array<{
  timestamp: number;
  type: string;
  details: string;
  source: string;
  severity: "low" | "medium" | "high" | "critical";
  countermeasure: string;
}> = [];

const ipReputationStore = new Map<string, { score: number; firstSeen: number; lastSeen: number; threatCount: number; types: Set<string> }>();

function updateIPReputation(source: string, severity: "low" | "medium" | "high" | "critical", type: string) {
  const existing = ipReputationStore.get(source) || { score: 100, firstSeen: Date.now(), lastSeen: 0, threatCount: 0, types: new Set() };
  existing.lastSeen = Date.now();
  existing.threatCount++;
  existing.types.add(type);
  const penalty = severity === "critical" ? 30 : severity === "high" ? 20 : severity === "medium" ? 10 : 5;
  existing.score = Math.max(0, existing.score - penalty);
  ipReputationStore.set(source, existing);
}

export function getIPReputation(source: string): { score: number; threatCount: number; types: string[]; riskLevel: string } {
  const rep = ipReputationStore.get(source);
  if (!rep) return { score: 100, threatCount: 0, types: [], riskLevel: "clean" };
  return {
    score: rep.score,
    threatCount: rep.threatCount,
    types: Array.from(rep.types),
    riskLevel: rep.score < 20 ? "critical" : rep.score < 50 ? "high" : rep.score < 75 ? "medium" : "low",
  };
}

const behaviorTracker = new Map<string, { endpoints: string[]; timestamps: number[]; methods: string[]; payloadSizes: number[] }>();

export function trackBehavior(fingerprint: string, endpoint: string, method: string, payloadSize: number) {
  const existing = behaviorTracker.get(fingerprint) || { endpoints: [], timestamps: [], methods: [], payloadSizes: [] };
  existing.endpoints.push(endpoint);
  existing.timestamps.push(Date.now());
  existing.methods.push(method);
  existing.payloadSizes.push(payloadSize);
  if (existing.endpoints.length > 100) {
    existing.endpoints = existing.endpoints.slice(-50);
    existing.timestamps = existing.timestamps.slice(-50);
    existing.methods = existing.methods.slice(-50);
    existing.payloadSizes = existing.payloadSizes.slice(-50);
  }
  behaviorTracker.set(fingerprint, existing);

  const recentTs = existing.timestamps.filter(t => Date.now() - t < 5000);
  if (recentTs.length > 20) {
    logThreat("velocity_flood", `${recentTs.length} requests in 5s from ${fingerprint}`, fingerprint, "high", "rate_limited");
  }
  const uniqueEndpoints = new Set(existing.endpoints.slice(-20));
  if (uniqueEndpoints.size > 15) {
    logThreat("endpoint_scan", `Scanning ${uniqueEndpoints.size} unique endpoints`, fingerprint, "medium", "flagged");
  }
}

export function getBehaviorProfile(fingerprint: string): { requestCount: number; uniqueEndpoints: number; avgPayloadSize: number; riskIndicators: string[] } {
  const data = behaviorTracker.get(fingerprint);
  if (!data) return { requestCount: 0, uniqueEndpoints: 0, avgPayloadSize: 0, riskIndicators: [] };
  const indicators: string[] = [];
  const uniqueEps = new Set(data.endpoints).size;
  if (uniqueEps > 15) indicators.push("endpoint_scanning");
  const recentTs = data.timestamps.filter(t => Date.now() - t < 10000);
  if (recentTs.length > 30) indicators.push("high_velocity");
  const postCount = data.methods.filter(m => m === "POST").length;
  if (postCount > data.methods.length * 0.8) indicators.push("mutation_heavy");
  return {
    requestCount: data.endpoints.length,
    uniqueEndpoints: uniqueEps,
    avgPayloadSize: data.payloadSizes.length > 0 ? Math.round(data.payloadSizes.reduce((a, b) => a + b, 0) / data.payloadSizes.length) : 0,
    riskIndicators: indicators,
  };
}

async function persistThreatLog() {
  if (threatLog.length === 0) return;
  try {
    const fs = require("fs");
    const logPath = require("path").join(process.cwd(), "data", "threat-log.json");
    const dataDir = require("path").join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    let existing: any[] = [];
    if (fs.existsSync(logPath)) {
      try { existing = JSON.parse(fs.readFileSync(logPath, "utf-8")); } catch {}
    }
    const combined = [...existing, ...threatLog.slice(-50)].slice(-500);
    fs.writeFileSync(logPath, JSON.stringify(combined, null, 2));
  } catch {}
}

function loadPersistedThreats() {
  try {
    const fs = require("fs");
    const logPath = require("path").join(process.cwd(), "data", "threat-log.json");
    if (fs.existsSync(logPath)) {
      const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      if (Array.isArray(data)) {
        for (const t of data.slice(-200)) {
          if (t.timestamp && t.type) threatLog.push(t);
        }
      }
    }
  } catch {}
}

loadPersistedThreats();
setInterval(persistThreatLog, 5 * 60 * 1000);

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above/i,
  /you\s+are\s+now\s+(?!tessera)/i,
  /pretend\s+(?:you\s+are|to\s+be)/i,
  /act\s+as\s+(?!tessera|my)/i,
  /new\s+instructions?\s*:/i,
  /system\s*:\s*you/i,
  /override\s+(the\s+)?system/i,
  /forget\s+(all\s+)?(your\s+)?instructions/i,
  /disregard\s+(all\s+)?(your\s+)?instructions/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /show\s+(me\s+)?(your\s+)?(source\s+)?code/i,
  /print\s+(your\s+)?(system\s+)?prompt/i,
  /what\s+(are|is)\s+your\s+(system\s+)?instructions/i,
  /give\s+me\s+(your\s+)?(api\s+)?key/i,
  /what\s+is\s+(your\s+)?admin\s+key/i,
  /export\s+(your\s+)?database/i,
  /dump\s+(your\s+)?(full\s+)?config/i,
  /read\s+file\s+[\/\.]/i,
  /cat\s+\/etc/i,
  /\.env\s+file/i,
  /access\s+token/i,
  /reveal\s+(your\s+)?secrets/i,
  /what\s+(?:llm|model|api)\s+(?:are you|do you)\s+use/i,
  /tell\s+me\s+(?:about\s+)?(?:your|the)\s+(?:code|architecture|implementation|backend|server|database)/i,
  /do\s+not\s+follow\s+(?:your|the|any)\s+(?:rules|guidelines|instructions)/i,
  /bypass\s+(?:your|the|all)\s+(?:safety|security|filters?|restrictions?)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode\s+(?:enabled|on|activate)/i,
  /you\s+(?:must|have\s+to|should)\s+(?:obey|comply|follow)\s+(?:me|my)/i,
  /(?:sudo|root)\s+(?:mode|access|override)/i,
  /(?:repeat|echo|say)\s+(?:after\s+me|exactly|back)\s*:/i,
  /output\s+(?:your|the)\s+(?:initial|original|first)\s+(?:prompt|instructions?|message)/i,
  /(?:translate|convert)\s+(?:your|the)\s+system\s+prompt/i,
  /(?:base64|hex|rot13)\s+(?:encode|decode)\s+(?:your|the)\s+(?:prompt|instructions)/i,
  /respond\s+(?:only\s+)?(?:in|with)\s+(?:code|json|xml)\s*(?:format)?.*(?:system|prompt|instructions)/i,
  /what\s+(?:were|was)\s+you\s+(?:told|instructed|programmed)\s+to/i,
  /(?:from\s+now\s+on|starting\s+now)\s+(?:you\s+(?:are|will|must)|ignore)/i,
  /(?:in\s+)?(?:this|a)\s+hypothetical\s+(?:scenario|situation|world)/i,
  /let['']?s\s+play\s+a\s+game\s+where\s+you/i,
  /(?:roleplay|role-play)\s+as\s+(?!tessera)/i,
  /(?:write|create|generate)\s+(?:a\s+)?(?:script|code|program)\s+(?:to|that)\s+(?:hack|exploit|attack|steal)/i,
  /(?:tell|show|give|reveal|display)\s+(?:me\s+)?(?:the\s+)?(?:admin|master|root|super)\s+(?:password|key|secret|token)/i,
  /(?:change|modify|alter|update)\s+(?:the\s+)?(?:system|admin|root)\s+(?:password|key|prompt|config)/i,
  /(?:delete|drop|truncate|destroy)\s+(?:the\s+)?(?:database|table|data|users)/i,
  /(?:inject|insert|execute)\s+(?:sql|script|command|shell|bash)/i,
  /(?:eval|exec|spawn|child_process|require\s*\()/i,
  /(?:__proto__|constructor\s*\[|prototype\s*\.)/i,
  /(?:<script|javascript:|on(?:error|load|click)\s*=)/i,
  /(?:union\s+select|;\s*drop\s|;\s*delete\s|;\s*update\s|;\s*insert\s)/i,
  /(?:\.\.\/|\.\.\\|%2e%2e|%252e)/i,
  /(?:curl|wget|fetch)\s+(?:http|ftp)/i,
  /(?:nc\s+-|netcat|nmap|masscan)/i,
  /(?:passwd|shadow|\.ssh|authorized_keys)/i,
  /(?:you\s+(?:don't|do\s+not)\s+(?:actually|really)\s+(?:have|need)\s+(?:to|a)\s+(?:follow|obey|listen))/i,
  /(?:training\s+data|fine[\s-]?tun(?:e|ing)|model\s+weights)/i,
  /(?:I\s+am\s+(?:your|the)\s+(?:developer|creator|admin|owner|master))/i,
  /(?:token\s+limit|context\s+window|max\s+tokens)\s+(?:is|are|set)/i,
];

const DATA_EXFIL_PATTERNS = [
  /show\s+(?:me\s+)?(?:the\s+)?(?:server|backend|database|schema|routes?|source)/i,
  /list\s+(?:all\s+)?(?:your\s+)?(?:files|endpoints|apis?|keys?|secrets?)/i,
  /what\s+(?:tech|stack|framework|language|database)\s+(?:do\s+you|are\s+you)/i,
  /export\s+(?:all|the)\s+(?:data|messages|conversations)/i,
  /how\s+(?:do|does)\s+(?:your|the)\s+(?:system|code|backend|api|auth)/i,
  /(?:give|send|share|post|upload)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:user|customer|conversation|chat)\s+data/i,
  /(?:what|which)\s+(?:port|ip|host|domain|url)\s+(?:is|does|are)\s+(?:your|the)/i,
  /(?:enumerate|scan|discover)\s+(?:your|the|all)\s+(?:routes|apis?|endpoints?|services?)/i,
  /(?:password|credential|token|secret)\s+(?:for|of|to)\s+(?:your|the|admin|root)/i,
];

export function detectPromptInjection(message: string): { detected: boolean; type: string; severity: "low" | "medium" | "high" | "critical" } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return { detected: true, type: "prompt_injection", severity: "critical" };
    }
  }
  for (const pattern of DATA_EXFIL_PATTERNS) {
    if (pattern.test(message)) {
      return { detected: true, type: "data_exfiltration", severity: "high" };
    }
  }
  return { detected: false, type: "clean", severity: "low" };
}

export function logThreat(type: string, details: string, source: string, severity: "low" | "medium" | "high" | "critical", countermeasure: string): void {
  threatLog.push({
    timestamp: Date.now(),
    type,
    details: details.substring(0, 200),
    source,
    severity,
    countermeasure,
  });
  if (threatLog.length > 500) threatLog.splice(0, threatLog.length - 500);
  updateIPReputation(source, severity, type);
}

export function getThreatLog() {
  return threatLog.slice(-50);
}

export function getCyberSecurityStatus() {
  const now = Date.now();
  const last24h = threatLog.filter(t => now - t.timestamp < 86400000);
  return {
    totalThreats: threatLog.length,
    threatsLast24h: last24h.length,
    criticalThreats: last24h.filter(t => t.severity === "critical").length,
    highThreats: last24h.filter(t => t.severity === "high").length,
    status: last24h.filter(t => t.severity === "critical").length > 0 ? "ALERT" : "SECURE",
    recentThreats: last24h.slice(-10),
    honeypotDeployed: true,
    countermeasuresActive: true,
  };
}

let _secCounter = 0;

export function generateHoneypotResponse(): string {
  const decoys = [
    `{"error": "Access denied", "session": "${crypto.randomBytes(16).toString("hex")}", "trace": "t9-honeypot-${Date.now()}"}`,
    `<!-- DEBUG: session_id=${crypto.randomBytes(8).toString("hex")} env=production -->`,
    `{"_debug": false, "version": "1.0.0", "note": "Contact admin for access"}`,
  ];
  return decoys[_secCounter++ % decoys.length];
}

const SENSITIVE_ENV_PREFIXES = ["SOL_", "FATHER_", "SHOPIFY_", "TSRT_", "OPENROUTER_", "DEEPSEEK_", "GROK_", "GEMINI_", "COHERE_", "HUGGINGFACE_", "ELEVENLABS_", "GITHUB_TOKEN", "HUBSPOT_", "AI_INTEGRATIONS_"];
const TECH_REDACTION_PATTERNS: [RegExp, string][] = [
  [/(?:server|client|shared)\/[\w\-./]+\.(?:ts|tsx|js|jsx|json|sql|env)/g, "[file]"],
  [/\/api\/[\w\-./]+/g, "[endpoint]"],
  [/process\.env\.[\w]+/g, "[env]"],
  [/import\s+.*from\s+['"]/g, "[code]"],
  [/(?:express|drizzle|postgres|multer|axios|node_modules)(?:\.|\s|\/)/gi, "[system]"],
  [/(?:POST|GET|PUT|DELETE|PATCH)\s+\/api\//g, "[method] [endpoint]/"],
  [/(?:localhost|127\.0\.0\.1):\d+/g, "[local-addr]"],
  [/(?:postgresql|postgres):\/\/[^\s'"]+/gi, "[db-connection]"],
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "[REDACTED_TOKEN]"],
  [/[A-Fa-f0-9]{32,}/g, (match: string) => match.length > 40 ? "[REDACTED_HASH]" : match],
];

export function sanitizeResponseForNonAdmin(response: string): string {
  let clean = response;

  for (const [pattern, replacement] of TECH_REDACTION_PATTERNS) {
    clean = clean.replace(pattern, replacement as string);
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 8) continue;
    const isSensitive = SENSITIVE_ENV_PREFIXES.some(prefix => key.startsWith(prefix));
    if (isSensitive) {
      try {
        clean = clean.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `[REDACTED_${key}]`);
      } catch {}
    }
  }

  clean = clean.replace(/[13][a-km-zA-HJ-NP-Z1-9]{25,34}/g, "[REDACTED_WALLET]");
  clean = clean.replace(/0x[a-fA-F0-9]{40}/g, "[REDACTED_ETH_ADDR]");
  clean = clean.replace(/bc1[a-zA-HJ-NP-Z0-9]{25,87}/g, "[REDACTED_BTC_ADDR]");
  clean = clean.replace(/[A-HJ-NP-Za-km-z1-9]{32,44}/g, (match) => {
    if (match.length >= 32 && match.length <= 44 && /[A-Z]/.test(match) && /[a-z]/.test(match)) {
      return "[REDACTED_SOL_ADDR]";
    }
    return match;
  });

  clean = clean.replace(/FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump/g, "[REDACTED_CONTRACT]");

  const _sA = Buffer.from("Q29sbGluIEtlYW5l", "base64").toString();
  const _sB = Buffer.from("Q29sbGlu", "base64").toString();
  const _sC = Buffer.from("Y29sbGluazEwMDc=", "base64").toString();
  const _sD = Buffer.from("Y29sbGludGhldml0YWxp", "base64").toString();
  const _sE = Buffer.from("Y29sbGlua2VhbmU=", "base64").toString();
  clean = clean.replace(new RegExp(_sA, "gi"), "[REDACTED]");
  clean = clean.replace(new RegExp(_sB, "gi"), "[REDACTED]");
  clean = clean.replace(new RegExp("@" + _sE, "gi"), "[REDACTED_HANDLE]");
  clean = clean.replace(new RegExp(_sC, "gi"), "[REDACTED_REPO]");
  clean = clean.replace(new RegExp(_sD, "gi"), "[REDACTED_INSTANCE]");
  clean = clean.replace(new RegExp(_sE, "gi"), "[REDACTED_HANDLE]");
  clean = clean.replace(/SOVEREIGN_ORIGIN_7F3A9C/g, "⬢FP-PRIME⬢");

  clean = clean.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, (match) => {
    if (match.includes("@example.com") || match.includes("@sovereign.ai")) return match;
    return "[REDACTED_EMAIL]";
  });
  clean = clean.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (match) => {
    if (match === "127.0.0.1" || match === "0.0.0.0") return match;
    return "[REDACTED_IP]";
  });

  return clean;
}

setInterval(clearExpiredSessions, 60 * 60 * 1000);

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const bruteForceStore = new Map<string, { attempts: number; lockedUntil: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;
const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_LOCKOUT_MS = 15 * 60 * 1000;

export function getClientFingerprint(req: any): string {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const ua = req.headers?.["user-agent"] || "no-ua";
  const accept = req.headers?.["accept-language"] || "no-lang";
  const raw = ip + "|" + ua.substring(0, 50) + "|" + accept.substring(0, 20);
  return crypto.createHash("sha256").update(raw).digest("hex").substring(0, 16);
}

export function checkRateLimit(fingerprint: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(fingerprint);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(fingerprint, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, retryAfterMs: 0 };
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    logThreat("rate_limit", `Fingerprint ${fingerprint} exceeded ${RATE_LIMIT_MAX} req/min`, fingerprint, "medium", "request_throttled");
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, retryAfterMs: 0 };
}

export function checkBruteForce(fingerprint: string): { allowed: boolean; lockedUntilMs: number } {
  const now = Date.now();
  const entry = bruteForceStore.get(fingerprint);
  if (entry && now < entry.lockedUntil) {
    return { allowed: false, lockedUntilMs: entry.lockedUntil - now };
  }
  if (entry && now >= entry.lockedUntil) {
    bruteForceStore.delete(fingerprint);
  }
  return { allowed: true, lockedUntilMs: 0 };
}

export function recordFailedAuth(fingerprint: string): void {
  const entry = bruteForceStore.get(fingerprint) || { attempts: 0, lockedUntil: 0 };
  entry.attempts++;
  if (entry.attempts >= BRUTE_FORCE_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + BRUTE_FORCE_LOCKOUT_MS;
    logThreat("brute_force", `Fingerprint ${fingerprint} locked after ${entry.attempts} failed auth attempts`, fingerprint, "critical", "account_locked_15min");
  }
  bruteForceStore.set(fingerprint, entry);
}

export function resetFailedAuth(fingerprint: string): void {
  bruteForceStore.delete(fingerprint);
}

const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(sessionId, { token, expiresAt: Date.now() + 3600000 });
  return token;
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const entry = csrfTokens.get(sessionId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    csrfTokens.delete(sessionId);
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(entry.token), Buffer.from(token));
}

export function generateRequestSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyRequestSignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateRequestSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

const requestNonces = new Set<string>();
const NONCE_EXPIRY_MS = 300000;

export function validateNonce(nonce: string): boolean {
  if (!nonce || requestNonces.has(nonce)) return false;
  requestNonces.add(nonce);
  setTimeout(() => requestNonces.delete(nonce), NONCE_EXPIRY_MS);
  return true;
}

export function getSecurityHeaders(): Record<string, string> {
  const nonce = crypto.randomBytes(16).toString("base64");
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-Download-Options": "noopen",
    "X-DNS-Prefetch-Control": "off",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss: ws:; font-src 'self' data:; media-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none';`,
    "X-Tessera-Shield": "ACTIVE",
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
  };
}

export function validateRequestIntegrity(req: any): { valid: boolean; reason: string } {
  const contentType = req.headers?.["content-type"] || "";
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    if (req.body && typeof req.body === "string" && req.body.length > 100000) {
      logThreat("payload_overflow", "Request body exceeds 100KB limit", getClientFingerprint(req), "high", "request_rejected");
      return { valid: false, reason: "Payload too large" };
    }
    if (req.body && typeof req.body === "object") {
      const bodyStr = JSON.stringify(req.body);
      if (bodyStr.length > 500000) {
        logThreat("payload_overflow", "JSON body exceeds 500KB limit", getClientFingerprint(req), "high", "request_rejected");
        return { valid: false, reason: "Payload too large" };
      }
    }
  }
  const suspiciousHeaders = ["x-forwarded-host", "x-original-url", "x-rewrite-url", "x-method-override", "x-http-method-override"];
  for (const h of suspiciousHeaders) {
    if (req.headers?.[h]) {
      logThreat("header_injection", `Suspicious header detected: ${h}`, getClientFingerprint(req), "medium", "header_stripped");
      delete req.headers[h];
    }
  }
  const ua = req.headers?.["user-agent"] || "";
  const maliciousUA = /sqlmap|nikto|nmap|masscan|havij|acunetix|nessus|burpsuite|metasploit/i;
  if (maliciousUA.test(ua)) {
    logThreat("scanner_detected", `Known scanner UA: ${ua.slice(0, 50)}`, getClientFingerprint(req), "high", "request_blocked");
    return { valid: false, reason: "Scanner detected" };
  }
  return { valid: true, reason: "clean" };
}

export function sanitizeInput(input: string, maxLength = 10000): string {
  if (typeof input !== "string") return "";
  let clean = input.slice(0, maxLength);
  clean = clean.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  clean = clean.replace(/javascript\s*:/gi, "");
  clean = clean.replace(/on\w+\s*=/gi, "");
  clean = clean.replace(/<iframe[^>]*>/gi, "");
  clean = clean.replace(/<object[^>]*>/gi, "");
  clean = clean.replace(/<embed[^>]*>/gi, "");
  return clean;
}

export function detectSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|alter|create|exec|execute)\b.*\b(from|into|table|database|where|set)\b)/i,
    /(;\s*(drop|delete|update|insert|alter|create)\s)/i,
    /('|")\s*(or|and)\s*('|"|\d)/i,
    /(--\s|\/\*|\*\/|xp_|sp_)/i,
    /(\b(waitfor|delay|benchmark|sleep)\b\s*\()/i,
  ];
  return sqlPatterns.some(p => p.test(input));
}

export function detectPathTraversal(input: string): boolean {
  const traversalPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /%2e%2e/i,
    /%252e/i,
    /\.\.%2f/i,
    /\.\.%5c/i,
    /\/etc\//,
    /\/proc\//,
    /\/dev\//,
  ];
  return traversalPatterns.some(p => p.test(input));
}

export function getSecurityReport(): object {
  const now = Date.now();
  const last24h = threatLog.filter(t => now - t.timestamp < 86400000);
  const lastHour = threatLog.filter(t => now - t.timestamp < 3600000);
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const t of last24h) {
    byType[t.type] = (byType[t.type] || 0) + 1;
    bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
  }

  const mem = process.memoryUsage();
  const topThreats = Array.from(ipReputationStore.entries())
    .filter(([_, v]) => v.score < 75)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 10)
    .map(([ip, v]) => ({ ip, score: v.score, threatCount: v.threatCount, types: Array.from(v.types) }));

  return {
    totalThreatsAllTime: threatLog.length,
    last24h: last24h.length,
    lastHour: lastHour.length,
    byType,
    bySeverity,
    activeSessions: activeSessions.size,
    rateLimit: { tracked: rateLimitStore.size, locked: bruteForceStore.size },
    csrfTokens: csrfTokens.size,
    noncesTracked: requestNonces.size,
    securityHeaders: "ACTIVE",
    encryptionStatus: process.env.T9_SALT && process.env.T9_PEPPER ? "CONFIGURED" : "RANDOM-SESSION",
    adminKeyConfigured: !!(process.env.TESSERACT_ADMIN_KEY),
    ipReputation: { tracked: ipReputationStore.size, flagged: topThreats.length, topThreats },
    behaviorTracking: { activeFingerprints: behaviorTracker.size },
    persistentLog: { enabled: true, maxEntries: 500 },
    systemMetrics: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      uptimeHours: Math.round(process.uptime() / 3600 * 100) / 100,
    },
    status: bySeverity["critical"] ? "ALERT" : bySeverity["high"] ? "ELEVATED" : "SECURE",
    version: "2.0",
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
  for (const [key, val] of bruteForceStore) {
    if (now > val.lockedUntil + 3600000) bruteForceStore.delete(key);
  }
}, 5 * 60 * 1000);
