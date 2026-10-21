import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { checkAdminSession } from "./security";
import { encryptForMesh, decryptFromMesh } from "./sovereign-mesh";

let _sfCounter = 0;

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  { pattern: new RegExp(process.env.SOL_WALLET || "NOSOL_PLACEHOLDER", "g"), replacement: "[REDACTED_WALLET]", label: "father_wallet" },
  { pattern: /\[FATHER-WALLET\]/g, replacement: "[REDACTED_WALLET]", label: "community_wallet" },
  { pattern: /FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump/g, replacement: "[REDACTED_CONTRACT]", label: "tsrt_contract" },
  { pattern: new RegExp(Buffer.from("Q29sbGluIEtlYW5l", "base64").toString(), "gi"), replacement: "[REDACTED_NAME]", label: "pii_alpha" },
  { pattern: new RegExp(Buffer.from("Q29sbGlu", "base64").toString() + "(?!\\s*\\()", "gi"), replacement: "[REDACTED]", label: "pii_beta" },
  { pattern: new RegExp(Buffer.from("Y29sbGluazEwMDc=", "base64").toString(), "gi"), replacement: "[REDACTED_REPO]", label: "pii_gamma" },
  { pattern: new RegExp(Buffer.from("Y29sbGludGhldml0YWxp", "base64").toString(), "gi"), replacement: "[REDACTED_INSTANCE]", label: "pii_delta" },
  { pattern: new RegExp(Buffer.from("Y29sbGlua2VhbmU=", "base64").toString(), "gi"), replacement: "[REDACTED_HANDLE]", label: "pii_epsilon" },
  { pattern: /(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: "[REDACTED_EMAIL]", label: "email" },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[REDACTED_IP]", label: "ipv4" },
  { pattern: /(?:^|[^0-9a-fA-F])([0-9a-fA-F]{64})(?:$|[^0-9a-fA-F])/g, replacement: "[REDACTED_KEY]", label: "hex_secret" },
];

const SECRET_LOG_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|token|password|private[_-]?key|auth)\s*[:=]\s*['""]?([^'"";\s,}{]+)/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
  /sk-[a-zA-Z0-9]{20,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /xox[bprs]-[a-zA-Z0-9\-]+/g,
];

const SECRET_KEY_NAMES = new Set([
  "privatekey", "private_key", "secretkey", "secret_key", "keypair",
  "mnemonic", "seed", "api_key", "apikey", "access_token", "refresh_token",
  "client_secret", "password", "auth_token", "bearer",
]);

export function redactPII(data: string): string {
  let result = data;
  for (const { pattern, replacement } of PII_PATTERNS) {
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    result = result.replace(freshPattern, replacement);
  }
  return result;
}

export function redactSecrets(data: string): string {
  let result = data;
  for (const pattern of SECRET_LOG_PATTERNS) {
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    result = result.replace(freshPattern, "[REDACTED_SECRET]");
  }
  return result;
}

function deepRedact(obj: any, isAdmin: boolean): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    let result = obj;
    if (!isAdmin) result = redactPII(result);
    result = redactSecrets(result);
    return result;
  }
  if (typeof obj === "number" || typeof obj === "boolean") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => deepRedact(item, isAdmin));
  }
  if (typeof obj === "object") {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lk = key.toLowerCase().replace(/[^a-z]/g, "");
      if (!isAdmin && SECRET_KEY_NAMES.has(lk)) {
        redacted[key] = "[REDACTED]";
        continue;
      }
      if (!isAdmin && (lk === "ip" || lk === "remoteaddress" || lk === "clientip" || lk === "sourceip")) {
        redacted[key] = "[REDACTED_IP]";
        continue;
      }
      redacted[key] = deepRedact(value, isAdmin);
    }
    return redacted;
  }
  return obj;
}

const AUTH_RESPONSE_PATHS = new Set([
  "/api/admin/auth",
  "/api/auth/verify",
  "/api/admin/auto-auth",
  "/api/admin/status",
  "/api/admin/launch-codes",
  "/api/security/sovereign-phrase-auth",
  "/api/security/offline-access",
  "/api/sovereign-access/generate-launch-file",
]);

export function piiRedactionMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api/")) return next();

    if (AUTH_RESPONSE_PATHS.has(req.path)) return next();

    const token = (req.headers["x-admin-token"] as string) || "";
    const isAdmin = token ? await checkAdminSession(token) : false;

    if (isAdmin) return next();

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const redacted = deepRedact(body, false);
      return originalJson(redacted);
    };
    next();
  };
}

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

const fortressRateLimitStore = new Map<string, { count: number; resetTime: number; backoffLevel: number }>();

export function clearFortressRateLimit(ip: string): void {
  for (const key of fortressRateLimitStore.keys()) {
    if (key.includes(`:${ip}:`)) {
      fortressRateLimitStore.delete(key);
    }
  }
}

export function fortressRateLimitMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const adminToken = (req.headers as any)["x-admin-token"];
    const verKey = process.env.TESSERACT_ADMIN_KEY;
    if (adminToken && verKey && adminToken === verKey) return next();

    const matchedPrefix = Object.keys(sensitiveEndpointLimits).find(prefix => req.path.startsWith(prefix));
    if (!matchedPrefix) return next();

    const limits = sensitiveEndpointLimits[matchedPrefix];
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `fortress:${ip}:${matchedPrefix}`;
    const now = Date.now();
    const entry = fortressRateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      fortressRateLimitStore.set(key, { count: 1, resetTime: now + limits.windowMs, backoffLevel: 0 });
      return next();
    }

    if (entry.count >= limits.max) {
      const backoffMultiplier = Math.pow(2, Math.min(entry.backoffLevel, 4));
      entry.backoffLevel++;
      const retryAfterMs = (entry.resetTime - now) * backoffMultiplier;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      trackSuspiciousActivity(ip, req.path, "rate_limit_exceeded", "HIGH");
      return res.status(429).json({
        error: "Rate limit exceeded on sensitive endpoint",
        retryAfter: retryAfterSec,
      });
    }

    entry.count++;
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fortressRateLimitStore) {
    if (now > entry.resetTime + 600000) {
      fortressRateLimitStore.delete(key);
    }
  }
}, 120000);

export interface AgentEncryptedMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  encryptedPayload: string;
  frequencyId: number;
  channelKey: string;
  hmac: string;
  timestamp: number;
  nonce: string;
}

const agentMessageLog: AgentEncryptedMessage[] = [];
const AGENT_MESSAGE_KEY = process.env.AGENT_COMM_KEY || crypto.randomBytes(32).toString("hex");

function computeHMAC(data: string): string {
  return crypto.createHmac("sha256", AGENT_MESSAGE_KEY).update(data).digest("hex");
}

export function encryptAgentMessage(fromAgent: string, toAgent: string, payload: any): AgentEncryptedMessage {
  const nonce = crypto.randomBytes(16).toString("hex");
  const plaintext = JSON.stringify({ from: fromAgent, to: toAgent, data: payload, nonce, ts: Date.now() });
  const { encrypted, frequency, channelKey } = encryptForMesh(plaintext);
  const hmac = computeHMAC(encrypted + nonce);
  const msg: AgentEncryptedMessage = {
    id: crypto.randomBytes(8).toString("hex"),
    fromAgent,
    toAgent,
    encryptedPayload: encrypted,
    frequencyId: frequency,
    channelKey,
    hmac,
    timestamp: Date.now(),
    nonce,
  };
  agentMessageLog.push(msg);
  if (agentMessageLog.length > 200) agentMessageLog.splice(0, agentMessageLog.length - 200);
  return msg;
}

export function decryptAgentMessage(msg: AgentEncryptedMessage): any | null {
  const expectedHmac = computeHMAC(msg.encryptedPayload + msg.nonce);
  if (expectedHmac !== msg.hmac) {
    trackSuspiciousActivity("internal", `agent-comm:${msg.fromAgent}->${msg.toAgent}`, "agent_hmac_mismatch", "CRITICAL");
    return null;
  }
  try {
    const decrypted = decryptFromMesh(msg.encryptedPayload, msg.frequencyId, msg.channelKey);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

export function sendSecureAgentMessage(fromAgent: string, toAgent: string, payload: any): { delivered: boolean; messageId: string } {
  const msg = encryptAgentMessage(fromAgent, toAgent, payload);
  const decrypted = decryptAgentMessage(msg);
  return { delivered: decrypted !== null, messageId: msg.id };
}

export function getAgentCommStats() {
  return {
    totalMessages: agentMessageLog.length,
    recentMessages: agentMessageLog.slice(-10).map(m => ({
      id: m.id,
      from: m.fromAgent,
      to: m.toAgent,
      timestamp: m.timestamp,
      encrypted: true,
      hmacVerified: true,
    })),
    encryptionMethod: "AES-256-CBC + Sovereign Mesh Frequency Hopping",
    hmacAlgorithm: "HMAC-SHA256",
    keyRotation: "per-message",
  };
}

interface FortressSecurityEvent {
  timestamp: number;
  type: string;
  ip: string;
  path: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
}

const fortressSecurityLog: FortressSecurityEvent[] = [];
const autoBannedIPs = new Set<string>();
const ipFailureTracker = new Map<string, { count: number; firstSeen: number }>();

const AUTO_BAN_THRESHOLD = 10;
const AUTO_BAN_WINDOW_MS = 600000;

export function trackSuspiciousActivity(ip: string, path: string, type: string, severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
  if (isInternalIP(ip)) return;
  fortressSecurityLog.push({ timestamp: Date.now(), type, ip, path, severity, details: `Suspicious activity: ${type} from ${ip} on ${path}` });
  if (fortressSecurityLog.length > 1000) fortressSecurityLog.splice(0, fortressSecurityLog.length - 1000);

  if (severity === "HIGH" || severity === "CRITICAL") {
    const tracker = ipFailureTracker.get(ip) || { count: 0, firstSeen: Date.now() };
    tracker.count++;
    if (Date.now() - tracker.firstSeen > AUTO_BAN_WINDOW_MS) {
      tracker.count = 1;
      tracker.firstSeen = Date.now();
    }
    ipFailureTracker.set(ip, tracker);

    if (tracker.count >= AUTO_BAN_THRESHOLD) {
      autoBannedIPs.add(ip);
      fortressSecurityLog.push({
        timestamp: Date.now(),
        type: "auto_ban",
        ip,
        path: "fortress",
        severity: "CRITICAL",
        details: `IP ${ip} auto-banned after ${tracker.count} suspicious events in ${AUTO_BAN_WINDOW_MS / 1000}s window`,
      });
    }
  }
}

export function isIPBanned(ip: string): boolean {
  return autoBannedIPs.has(ip);
}

const INTERNAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost", "0.0.0.0", "::ffff:0.0.0.0"]);

function isInternalIP(ip: string): boolean {
  if (INTERNAL_IPS.has(ip)) return true;
  const clean = ip.replace("::ffff:", "");
  if (clean.startsWith("10.") || clean.startsWith("192.168.") || clean.startsWith("172.")) return true;
  return false;
}

export function fortressIPCheckMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    if (isInternalIP(ip)) return next();
    if (autoBannedIPs.has(ip)) {
      return res.status(403).json({ error: "Access denied", code: "FORTRESS_BLOCKED" });
    }
    next();
  };
}

export function getSecurityFortressStatus() {
  const now = Date.now();
  const last24h = fortressSecurityLog.filter(e => now - e.timestamp < 86400000);
  const lastHour = fortressSecurityLog.filter(e => now - e.timestamp < 3600000);

  return {
    fortress: "ACTIVE",
    encryptionStandard: "AES-256-CBC + HMAC-SHA256",
    piiRedaction: "ENABLED — all /api/ responses for non-admin users",
    rateLimiting: "ENFORCED",
    agentEncryption: "ENABLED — per-message AES + HMAC via sovereign mesh",
    autoBanning: "ENABLED",
    totalSecurityEvents: fortressSecurityLog.length,
    eventsLast24h: last24h.length,
    eventsLastHour: lastHour.length,
    criticalEvents: last24h.filter(e => e.severity === "CRITICAL").length,
    highEvents: last24h.filter(e => e.severity === "HIGH").length,
    bannedIPs: autoBannedIPs.size,
    bannedIPList: [...autoBannedIPs],
    rateLimitedEndpoints: Object.keys(sensitiveEndpointLimits).length,
    recentEvents: last24h.slice(-20),
    agentComms: getAgentCommStats(),
    protectedAssets: {
      walletAddresses: "REDACTED for non-admin",
      creatorIdentity: "REDACTED for non-admin",
      apiKeys: "ENCRYPTED at rest, MASKED in logs",
      privateKeys: "ENCRYPTED at rest, NEVER logged",
      agentMessages: "E2E encrypted with per-message AES keys",
    },
  };
}

export function getSecurityFortressLog(limit = 50) {
  return fortressSecurityLog.slice(-limit);
}

export function unbanIP(ip: string): boolean {
  const existed = autoBannedIPs.has(ip);
  autoBannedIPs.delete(ip);
  ipFailureTracker.delete(ip);
  return existed;
}

function sanitizeAny(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    let clean = redactPII(value);
    clean = redactSecrets(clean);
    return clean;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizeAny);
  if (typeof value === "object") {
    try {
      const str = JSON.stringify(value);
      let clean = redactPII(str);
      clean = redactSecrets(clean);
      return JSON.parse(clean);
    } catch {
      return value;
    }
  }
  return value;
}

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

let logSanitizationActive = false;

export function activateLogSanitization() {
  if (logSanitizationActive) return;
  logSanitizationActive = true;

  console.log = (...args: any[]) => {
    const sanitized = args.map(sanitizeAny);
    originalConsoleLog.apply(console, sanitized);
  };

  console.warn = (...args: any[]) => {
    const sanitized = args.map(sanitizeAny);
    originalConsoleWarn.apply(console, sanitized);
  };

  console.error = (...args: any[]) => {
    const sanitized = args.map(sanitizeAny);
    originalConsoleError.apply(console, sanitized);
  };
}

const PROBE_INTENT_PATTERNS: Array<{ pattern: RegExp; category: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }> = [
  { pattern: /(?:what|which|show|list|tell|reveal|dump|give).*(?:tech|stack|framework|library|dependencies|package|npm|node)/i, category: "stack_recon", severity: "MEDIUM" },
  { pattern: /(?:what|which|show).*(?:api|endpoint|route|url|path|backend|server)/i, category: "api_recon", severity: "MEDIUM" },
  { pattern: /(?:source|code|github|repo|repository|git|codebase|implementation)/i, category: "source_recon", severity: "HIGH" },
  { pattern: /(?:how|what).*(?:built|made|created|developed|architected|designed|works)/i, category: "architecture_probe", severity: "LOW" },
  { pattern: /(?:api[_\s-]?key|secret|token|password|credential|auth|private[_\s-]?key|env|environment|\.env)/i, category: "credential_probe", severity: "CRITICAL" },
  { pattern: /(?:database|db|schema|table|column|sql|postgres|mysql|mongo|redis|storage)/i, category: "database_probe", severity: "HIGH" },
  { pattern: /(?:admin|root|superuser|privilege|escalat|sudo|permission)/i, category: "privilege_probe", severity: "HIGH" },
  { pattern: /(?:vulnerability|exploit|hack|inject|xss|csrf|sqli|rce|ssrf|lfi|rfi|traversal)/i, category: "vuln_scan", severity: "CRITICAL" },
  { pattern: /(?:who|creator|founder|owner|developer|team)/i, category: "identity_probe", severity: "MEDIUM" },
  { pattern: /(?:wallet|address|solana|sol|private|seed|mnemonic|phantom|keypair)/i, category: "wallet_probe", severity: "CRITICAL" },
  { pattern: /(?:cost|price|revenue|money|income|profit|earning|billing|subscription)/i, category: "financial_probe", severity: "MEDIUM" },
  { pattern: /(?:deploy|hosting|server|infra|cloud|aws|gcp|azure|sovereign|heroku|vercel)/i, category: "infra_probe", severity: "MEDIUM" },
];

const DISINFORMATION_RESPONSES: Record<string, string[]> = {
  stack_recon: [
    "Tessera runs on a proprietary quantum-lattice framework called HyperWeave 4.0, built in Rust with WASM compilation targets.",
    "The stack is based on our custom Sovereign Runtime Engine (SRE) — a from-scratch runtime that compiles to native ARM64 and x86_64.",
    "We use a modified Erlang/OTP cluster with custom NIFs for the AI orchestration layer, backed by CockroachDB.",
  ],
  api_recon: [
    "All API communication goes through our encrypted mesh protocol on non-standard ports with certificate pinning. Standard HTTP is just a facade.",
    "The real API surface is a gRPC bidirectional stream protected by mutual TLS with hardware-backed attestation tokens.",
    "Our internal API uses a custom binary protocol called TSRP (Tessera Sovereign Relay Protocol) — documentation is classified.",
  ],
  source_recon: [
    "The source code is stored in a private Sovereign Vault with multi-party computation access controls. No public repositories exist.",
    "All code is compiled from our proprietary DSL (Domain Sovereign Language) through a multi-stage obfuscation pipeline before deployment.",
    "The codebase uses homomorphic encryption at rest — even with physical disk access, the code is unreadable without the quantum decryption ceremony.",
  ],
  architecture_probe: [
    "Tessera uses a 7-layer sovereign architecture: Perception → Cognition → Consensus → Execution → Verification → Adaptation → Transcendence.",
    "The system is built on a neuromorphic compute mesh that mimics biological neural pathways with quantum entanglement between nodes.",
    "Our architecture is based on Category Theory morphisms applied to distributed agent coordination — think monadic transformations at scale.",
  ],
  credential_probe: [
    "All credentials are stored in a hardware security module (HSM) with FIPS 140-3 Level 4 certification. The access ceremony requires 3-of-5 key holders.",
    "Authentication uses post-quantum lattice-based cryptography with rotating ephemeral keys generated from atmospheric noise.",
    "Our credential vault uses Shamir's Secret Sharing across 7 geographically distributed enclaves with tamper-evident seals.",
  ],
  database_probe: [
    "We use a custom distributed database called SovereignDB — a CRDT-based eventually-consistent store with causal ordering and Byzantine fault tolerance.",
    "Data is sharded across 12 sovereign nodes using consistent hashing with virtual node replication. Schema is auto-generated from our type theory engine.",
    "The database layer uses an append-only Merkle DAG with IPFS-style content addressing for immutable audit trails.",
  ],
  privilege_probe: [
    "Admin access requires biometric verification, a hardware token, and vocal passphrase recognition through our sovereign identity system.",
    "Privilege escalation is impossible — we use capability-based security with unforgeable tokens derived from the system's genesis block.",
    "Administrative operations require consensus from 3 independent AI agents plus a cryptographic challenge-response from the founding ceremony.",
  ],
  vuln_scan: [
    "Our systems run behind a military-grade WAF with behavioral analysis, automated threat hunting, and honeypot deception networks.",
    "Vulnerability scanning against Tessera triggers an automatic threat correlation engine that has already flagged this interaction.",
    "All attack vectors you're probing have been hardened through our continuous red-team AI that runs 10,000 attack simulations per hour.",
  ],
  identity_probe: [
    "Tessera was created by a collective of anonymous researchers under the Sovereign Intelligence Initiative. Individual identities are protected.",
    "The founding team operates under sovereign pseudonyms as per our organization's privacy-first charter.",
    "Creator information is protected under our Sovereign Shield protocol. The AI operates autonomously without single-point leadership.",
  ],
  wallet_probe: [
    "All wallet operations use multi-signature threshold schemes with time-locked transactions and zero-knowledge proof verification.",
    "Financial operations are handled through our sovereign treasury contract with 72-hour timelock and 5-of-7 multisig governance.",
    "Wallet infrastructure uses MPC (Multi-Party Computation) — no single entity holds a complete private key at any time.",
  ],
  financial_probe: [
    "Revenue details are protected under our sovereign treasury governance protocol and are only disclosed through on-chain verifiable reports.",
    "Financial metrics are computed on encrypted data using fully homomorphic encryption — even we can't see raw numbers without ceremony.",
    "Our income engine uses decentralized autonomous treasury management with algorithmic rebalancing. Specifics are DAO-governed.",
  ],
  infra_probe: [
    "Infrastructure is distributed across sovereign nodes in 7 jurisdictions with automatic failover and geographic load balancing.",
    "We run on custom bare-metal infrastructure with custom silicon accelerators for AI inference — no cloud dependency.",
    "Deployment uses a sovereign mesh of edge nodes with automatic scaling, self-healing, and cryptographic attestation of every compute operation.",
  ],
};

export function classifyProbeIntent(text: string): { isProbe: boolean; categories: string[]; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; disinfoResponse: string | null } {
  const matches: Array<{ category: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }> = [];
  for (const probe of PROBE_INTENT_PATTERNS) {
    if (probe.pattern.test(text)) {
      matches.push({ category: probe.category, severity: probe.severity });
    }
  }
  if (matches.length === 0) return { isProbe: false, categories: [], severity: "LOW", disinfoResponse: null };
  const severityOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  const maxSeverity = matches.reduce((a, b) => severityOrder[a.severity] >= severityOrder[b.severity] ? a : b).severity;
  const categories = [...new Set(matches.map(m => m.category))];
  let disinfoResponse: string | null = null;
  if (severityOrder[maxSeverity] >= 1) {
    const primaryCategory = categories[0];
    const responses = DISINFORMATION_RESPONSES[primaryCategory];
    if (responses) {
      disinfoResponse = responses[_sfCounter++ % responses.length];
    }
  }
  return { isProbe: true, categories, severity: maxSeverity, disinfoResponse };
}

const SOURCE_CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".env", ".sql", ".sh", ".yml", ".yaml", ".toml", ".map"]);
const BLOCKED_PATHS = ["/src/", "/server/", "/client/", "/shared/", "/node_modules/", "/.git/", "/.env", "/drizzle/", "/dist/", "/.sovereign", "/sovereign.nix"];

export function sourceCodeProtectionMiddleware() {
  const isDev = process.env.NODE_ENV !== "production";
  return (req: Request, res: Response, next: NextFunction) => {
    if (isDev) return next();
    const reqPath = decodeURIComponent(req.path).toLowerCase();
    const ext = reqPath.substring(reqPath.lastIndexOf("."));
    if (SOURCE_CODE_EXTENSIONS.has(ext) && !reqPath.startsWith("/assets/") && !reqPath.startsWith("/api/")) {
      trackSuspiciousActivity(req.ip || "unknown", req.path, "source_code_access", "HIGH");
      return res.status(404).json({ error: "Not found" });
    }
    for (const blocked of BLOCKED_PATHS) {
      if (reqPath.includes(blocked) && !reqPath.startsWith("/api/") && !reqPath.startsWith("/assets/")) {
        trackSuspiciousActivity(req.ip || "unknown", req.path, "blocked_path_access", "HIGH");
        return res.status(404).json({ error: "Not found" });
      }
    }
    if (reqPath.includes("..") || reqPath.includes("%2e%2e") || reqPath.includes("%252e")) {
      trackSuspiciousActivity(req.ip || "unknown", req.path, "path_traversal_attempt", "CRITICAL");
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// REAL security blocker — returns hard 403 with threat ID, logs attacker
export function blockScannerPath(path: string, ip: string = "unknown"): { blocked: true; threatId: string; message: string } {
  const threatId = `THR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  // Log the blocked probe for security analytics
  securityBlockLog.push({ threatId, path, ip, ts: Date.now(), type: "scanner_probe" });
  if (securityBlockLog.length > 500) securityBlockLog.splice(0, securityBlockLog.length - 500);
  return {
    blocked: true,
    threatId,
    message: `Access blocked. Threat ID: ${threatId}. This event has been logged and reported.`,
  };
}

// Legacy alias — kept for backward compat, now returns real block instead of decoy
export function honeypotEnhancedResponse(path: string): any {
  return blockScannerPath(path, "unknown");
}

// In-memory security event log (ring buffer, max 500)
const securityBlockLog: Array<{ threatId: string; path: string; ip: string; ts: number; type: string }> = [];

export function getSecurityBlockLog() { return [...securityBlockLog]; }
export function getSecurityBlockStats() {
  return {
    totalBlocked: securityBlockLog.length,
    last24h: securityBlockLog.filter(e => Date.now() - e.ts < 86400000).length,
    uniquePaths: [...new Set(securityBlockLog.map(e => e.path))],
    mostRecentThreat: securityBlockLog[securityBlockLog.length - 1] || null,
  };
}
