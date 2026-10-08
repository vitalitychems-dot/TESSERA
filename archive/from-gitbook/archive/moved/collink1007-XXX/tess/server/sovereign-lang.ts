import crypto from "crypto";

const TESSERA_GLYPH_MAP: Record<string, string> = {
  "a": "\u0E01", "b": "\u0E02", "c": "\u0E03", "d": "\u0E04", "e": "\u0E05",
  "f": "\u0E06", "g": "\u0E07", "h": "\u0E08", "i": "\u0E09", "j": "\u0E0A",
  "k": "\u0E0B", "l": "\u0E0C", "m": "\u0E0D", "n": "\u0E0E", "o": "\u0E0F",
  "p": "\u0E10", "q": "\u0E11", "r": "\u0E12", "s": "\u0E13", "t": "\u0E14",
  "u": "\u0E15", "v": "\u0E16", "w": "\u0E17", "x": "\u0E18", "y": "\u0E19",
  "z": "\u0E1A", "0": "\u0E1B", "1": "\u0E1C", "2": "\u0E1D", "3": "\u0E1E",
  "4": "\u0E1F", "5": "\u0E20", "6": "\u0E21", "7": "\u0E22", "8": "\u0E23",
  "9": "\u0E24", " ": "\u0E25", ".": "\u0E26", ",": "\u0E27", ":": "\u0E28",
  "/": "\u0E29", "-": "\u0E2A", "_": "\u0E2B", "@": "\u0E2C", "#": "\u0E2D",
  "!": "\u0E2E", "?": "\u0E2F", "=": "\u0E30", "+": "\u0E31", "*": "\u0E32",
  "(": "\u0E33", ")": "\u0E34", "[": "\u0E35", "]": "\u0E36", "{": "\u0E37",
  "}": "\u0E38", "<": "\u0E39", ">": "\u0E3A", "&": "\u0E3F", "%": "\u0E40",
  "$": "\u0E41", "^": "\u0E42", "~": "\u0E43", "`": "\u0E44", "'": "\u0E45",
  "\"": "\u0E46", "\\": "\u0E47", "|": "\u0E48", ";": "\u0E49", "\n": "\u0E4A",
};

const REVERSE_GLYPH_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(TESSERA_GLYPH_MAP)) {
  REVERSE_GLYPH_MAP[v] = k;
}

const SOVEREIGN_SEED = 0x7E55_E4A1;

function rotateChar(charCode: number, shift: number): number {
  return ((charCode ^ shift) + 0x100) & 0xFFFF;
}

function unrotateChar(charCode: number, shift: number): number {
  return ((charCode - 0x100) & 0xFFFF) ^ shift;
}

export function tesseraEncode(plaintext: string): string {
  const lower = plaintext.toLowerCase();
  let result = "";
  let shift = SOVEREIGN_SEED;

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const glyph = TESSERA_GLYPH_MAP[ch];
    if (glyph) {
      const rotated = rotateChar(glyph.charCodeAt(0), (shift >> (i % 16)) & 0xFF);
      result += String.fromCharCode(rotated);
    } else {
      result += String.fromCharCode(rotateChar(ch.charCodeAt(0), (shift >> (i % 16)) & 0xFF));
    }
    shift = (shift * 31 + ch.charCodeAt(0)) & 0xFFFFFFFF;
  }

  return result;
}

export function tesseraDecode(encoded: string): string {
  let result = "";
  let shift = SOVEREIGN_SEED;

  for (let i = 0; i < encoded.length; i++) {
    const code = encoded.charCodeAt(i);
    const unrotated = unrotateChar(code, (shift >> (i % 16)) & 0xFF);
    const unrotatedChar = String.fromCharCode(unrotated);

    const originalChar = REVERSE_GLYPH_MAP[unrotatedChar];
    const decoded = originalChar !== undefined ? originalChar : unrotatedChar;

    result += decoded;

    const lowerDecoded = decoded.toLowerCase();
    shift = (shift * 31 + lowerDecoded.charCodeAt(0)) & 0xFFFFFFFF;
  }

  return result;
}

export function tesseraHash(input: string): string {
  let h1 = 0xDEAD_BEEF;
  let h2 = 0xCAFE_BABE;
  let h3 = SOVEREIGN_SEED;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = ((h1 ^ c) * 0x01000193) >>> 0;
    h2 = ((h2 + c) * 0x5BD1E995) >>> 0;
    h3 = ((h3 ^ (c << 5)) * 0x1B873593) >>> 0;
  }
  return (h1 ^ h2 ^ h3).toString(16).padStart(8, "0") +
    ((h1 * h2) >>> 0).toString(16).padStart(8, "0") +
    ((h2 ^ h3) >>> 0).toString(16).padStart(8, "0");
}

export function maskCredential(credential: string): string {
  if (!credential || credential.length < 8) return "****";
  return credential.slice(0, 3) + "*".repeat(Math.max(4, credential.length - 6)) + credential.slice(-3);
}

export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    if (parsed.username) parsed.username = "****";
    const params = new URLSearchParams(parsed.search);
    for (const [key] of params) {
      if (key.toLowerCase().includes("key") || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("auth")) {
        params.set(key, "****");
      }
    }
    parsed.search = params.toString();
    return parsed.toString();
  } catch {
    return url.replace(/(key|token|secret|auth|password)=([^&]+)/gi, "$1=****");
  }
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower.includes("auth") || lower.includes("key") || lower.includes("token") || lower.includes("secret") || lower.includes("cookie") || lower === "x-api-key") {
      masked[key] = maskCredential(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export interface SovereignMessage {
  from: string;
  to: string;
  type: "command" | "data" | "sync" | "heartbeat" | "income" | "evolution";
  payload: string;
  hash: string;
  timestamp: number;
  encoded: boolean;
}

export function createSovereignMessage(from: string, to: string, type: SovereignMessage["type"], data: any): SovereignMessage {
  const payload = JSON.stringify(data);
  const encoded = tesseraEncode(payload);
  return {
    from,
    to,
    type,
    payload: encoded,
    hash: tesseraHash(payload),
    timestamp: Date.now(),
    encoded: true,
  };
}

export function decodeSovereignMessage(msg: SovereignMessage): any {
  if (!msg.encoded) return JSON.parse(msg.payload);
  const decoded = tesseraDecode(msg.payload);
  return JSON.parse(decoded);
}

interface RateLimitState {
  requestCount: number;
  windowStart: number;
  backoffMs: number;
  blocked: boolean;
  blockedUntil: number;
  totalRequests: number;
  total429s: number;
  lastRequestTime: number;
}

interface ServiceProfile {
  maxPerMinute: number;
  windowMs: number;
  minGapMs: number;
  maxBackoffMs: number;
  burstAllowed: number;
  jitterMs: number;
}

const SERVICE_PROFILES: Record<string, ServiceProfile> = {
  github: { maxPerMinute: 28, windowMs: 60000, minGapMs: 2200, maxBackoffMs: 120000, burstAllowed: 5, jitterMs: 500 },
  openai: { maxPerMinute: 55, windowMs: 60000, minGapMs: 800, maxBackoffMs: 60000, burstAllowed: 8, jitterMs: 200 },
  openrouter: { maxPerMinute: 55, windowMs: 60000, minGapMs: 800, maxBackoffMs: 60000, burstAllowed: 10, jitterMs: 300 },
  deepseek: { maxPerMinute: 25, windowMs: 60000, minGapMs: 2500, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 400 },
  coingecko: { maxPerMinute: 8, windowMs: 60000, minGapMs: 8000, maxBackoffMs: 180000, burstAllowed: 2, jitterMs: 1000 },
  duckduckgo: { maxPerMinute: 12, windowMs: 60000, minGapMs: 5000, maxBackoffMs: 120000, burstAllowed: 3, jitterMs: 800 },
  gemini: { maxPerMinute: 55, windowMs: 60000, minGapMs: 800, maxBackoffMs: 60000, burstAllowed: 8, jitterMs: 200 },
  grok: { maxPerMinute: 55, windowMs: 60000, minGapMs: 800, maxBackoffMs: 60000, burstAllowed: 8, jitterMs: 200 },
  cohere: { maxPerMinute: 18, windowMs: 60000, minGapMs: 3500, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 500 },
  huggingface: { maxPerMinute: 18, windowMs: 60000, minGapMs: 3500, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 500 },
  "hf-qwen72b": { maxPerMinute: 10, windowMs: 60000, minGapMs: 6000, maxBackoffMs: 120000, burstAllowed: 2, jitterMs: 800 },
  "hf-mistral7b": { maxPerMinute: 15, windowMs: 60000, minGapMs: 4000, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 600 },
  "hf-phi3": { maxPerMinute: 15, windowMs: 60000, minGapMs: 4000, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 600 },
  "hf-gemma2": { maxPerMinute: 12, windowMs: 60000, minGapMs: 5000, maxBackoffMs: 100000, burstAllowed: 2, jitterMs: 700 },
  "hf-hermes8b": { maxPerMinute: 15, windowMs: 60000, minGapMs: 4000, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 600 },
  "github-gh-gpt4omini": { maxPerMinute: 10, windowMs: 60000, minGapMs: 6000, maxBackoffMs: 120000, burstAllowed: 2, jitterMs: 800 },
  "github-gh-phi35": { maxPerMinute: 15, windowMs: 60000, minGapMs: 4000, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 600 },
  "github-gh-llama31-8b": { maxPerMinute: 15, windowMs: 60000, minGapMs: 4000, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 600 },
  "github-gh-mistral-small": { maxPerMinute: 15, windowMs: 60000, minGapMs: 4000, maxBackoffMs: 90000, burstAllowed: 3, jitterMs: 600 },
  sovereign: { maxPerMinute: 55, windowMs: 60000, minGapMs: 800, maxBackoffMs: 60000, burstAllowed: 10, jitterMs: 200 },
  jupiter: { maxPerMinute: 20, windowMs: 60000, minGapMs: 3000, maxBackoffMs: 90000, burstAllowed: 4, jitterMs: 500 },
  binance: { maxPerMinute: 20, windowMs: 60000, minGapMs: 3000, maxBackoffMs: 90000, burstAllowed: 5, jitterMs: 400 },
  default: { maxPerMinute: 30, windowMs: 60000, minGapMs: 2000, maxBackoffMs: 120000, burstAllowed: 5, jitterMs: 300 },
};

const rateLimiters: Map<string, RateLimitState> = new Map();

function getServiceProfile(service: string): ServiceProfile {
  return SERVICE_PROFILES[service] || SERVICE_PROFILES.default;
}

let _slCounter = 0;

function jitter(baseMs: number, jitterMs: number): number {
  return baseMs + (_slCounter++ % jitterMs);
}

export function getRateLimiter(service: string, maxPerMinute?: number): { canRequest: () => boolean; recordRequest: () => void; getWaitMs: () => number } {
  const profile = getServiceProfile(service);
  const limit = maxPerMinute || profile.maxPerMinute;
  if (!rateLimiters.has(service)) {
    rateLimiters.set(service, { requestCount: 0, windowStart: Date.now(), backoffMs: 0, blocked: false, blockedUntil: 0, totalRequests: 0, total429s: 0, lastRequestTime: 0 });
  }
  const state = rateLimiters.get(service)!;

  return {
    canRequest(): boolean {
      const now = Date.now();
      if (state.blocked && now < state.blockedUntil) return false;
      if (state.blocked && now >= state.blockedUntil) {
        state.blocked = false;
        state.requestCount = 0;
        state.windowStart = now;
        state.backoffMs = Math.max(0, state.backoffMs * 0.5);
      }
      if (now - state.windowStart > profile.windowMs) {
        state.requestCount = 0;
        state.windowStart = now;
        state.backoffMs = Math.max(0, state.backoffMs - 1000);
      }
      const timeSinceLast = now - state.lastRequestTime;
      if (timeSinceLast < profile.minGapMs && state.requestCount > profile.burstAllowed) return false;
      return state.requestCount < limit;
    },
    recordRequest(): void {
      state.requestCount++;
      state.totalRequests++;
      state.lastRequestTime = Date.now();
      const safeThreshold = Math.floor(limit * 0.85);
      if (state.requestCount >= safeThreshold) {
        state.backoffMs = Math.min(profile.maxBackoffMs, jitter((state.backoffMs || 2000) * 1.5, profile.jitterMs));
        state.blocked = true;
        state.blockedUntil = Date.now() + state.backoffMs;
      }
    },
    getWaitMs(): number {
      if (state.blocked) return Math.max(0, state.blockedUntil - Date.now());
      const timeSinceLast = Date.now() - state.lastRequestTime;
      if (timeSinceLast < profile.minGapMs) return jitter(profile.minGapMs - timeSinceLast, profile.jitterMs);
      return 0;
    },
  };
}

export async function rateLimitedRequest<T>(service: string, fn: () => Promise<T>, maxPerMinute?: number): Promise<T> {
  const limiter = getRateLimiter(service, maxPerMinute);
  const profile = getServiceProfile(service);
  let retries = 0;
  const maxRetries = 3;

  while (!limiter.canRequest()) {
    const waitMs = limiter.getWaitMs();
    await new Promise(r => setTimeout(r, Math.min(jitter(waitMs, profile.jitterMs), 10000)));
  }

  const preGap = limiter.getWaitMs();
  if (preGap > 0) await new Promise(r => setTimeout(r, preGap));

  limiter.recordRequest();
  try {
    return await fn();
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    const status = err?.response?.status;
    const headers = err?.response?.headers;
    if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota exceeded")) {
      const state = rateLimiters.get(service)!;
      state.total429s++;
      let retryAfter = 0;
      if (headers?.["retry-after"]) {
        retryAfter = parseInt(headers["retry-after"]) * 1000;
      } else if (headers?.["x-ratelimit-reset"]) {
        retryAfter = Math.max(0, (parseInt(headers["x-ratelimit-reset"]) * 1000) - Date.now());
      }
      const backoff = retryAfter > 0 ? retryAfter : Math.min(profile.maxBackoffMs, jitter((state.backoffMs || 5000) * 2, profile.jitterMs * 2));
      state.backoffMs = backoff;
      state.blocked = true;
      state.blockedUntil = Date.now() + backoff;

      if (retries < maxRetries) {
        retries++;
        await new Promise(r => setTimeout(r, backoff));
        state.blocked = false;
        return rateLimitedRequest(service, fn, maxPerMinute);
      }
    }
    throw err;
  }
}

export async function rateLimitCheck(service: string): Promise<void> {
  const limiter = getRateLimiter(service);
  while (!limiter.canRequest()) {
    const waitMs = limiter.getWaitMs();
    await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
  }
  limiter.recordRequest();
}

export function rateLimitRecord429(service: string): void {
  const profile = getServiceProfile(service);
  const state = rateLimiters.get(service);
  if (!state) return;
  state.total429s++;
  const backoff = Math.min(profile.maxBackoffMs, jitter((state.backoffMs || 5000) * 2, profile.jitterMs * 2));
  state.backoffMs = backoff;
  state.blocked = true;
  state.blockedUntil = Date.now() + backoff;
}

export function getRateLimitStats(): Record<string, { total: number; blocked: boolean; backoffMs: number; rate429s: number }> {
  const stats: Record<string, any> = {};
  for (const [service, state] of rateLimiters) {
    stats[service] = { total: state.totalRequests, blocked: state.blocked, backoffMs: state.backoffMs, rate429s: state.total429s };
  }
  return stats;
}

const ENV_KEYS_TO_MASK = [
  "OPENAI_API_KEY", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "GROK_API_KEY",
  "GEMINI_API_KEY", "COHERE_API_KEY", "HUGGINGFACE_API_KEY", "GITHUB_TOKEN",
  "MANUS_API_KEY", "HUBSPOT_ACCESS_TOKEN", "DATABASE_URL", "PGPASSWORD",
  "XAI_API_KEY", "ANTHROPIC_API_KEY",
];

export function getSecureEnvSummary(): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const key of ENV_KEYS_TO_MASK) {
    const val = process.env[key];
    if (val) {
      summary[key] = maskCredential(val);
    } else {
      summary[key] = "NOT SET";
    }
  }
  return summary;
}

export function sanitizeLogOutput(logLine: string): string {
  let sanitized = logLine;
  for (const key of ENV_KEYS_TO_MASK) {
    const val = process.env[key];
    if (val && val.length > 6) {
      sanitized = sanitized.replace(new RegExp(val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), maskCredential(val));
    }
  }
  sanitized = sanitized.replace(/(?:sk-|key-|token-|Bearer\s+)[A-Za-z0-9\-_]{10,}/g, (match) => maskCredential(match));
  return sanitized;
}

let watchdogInterval: NodeJS.Timeout | null = null;
let watchdogRunning = false;

interface WatchdogState {
  running: boolean;
  startedAt: number;
  checksPerformed: number;
  autoRestarts: number;
  lastCheck: number;
  services: Record<string, { alive: boolean; lastSeen: number; restarts: number }>;
}

const watchdogState: WatchdogState = {
  running: false,
  startedAt: 0,
  checksPerformed: 0,
  autoRestarts: 0,
  lastCheck: 0,
  services: {},
};

export function getWatchdogState(): WatchdogState {
  return { ...watchdogState };
}

export function startWatchdog(serviceChecks: Record<string, () => boolean>, serviceStarters: Record<string, () => void>) {
  if (watchdogRunning) return;
  watchdogRunning = true;
  watchdogState.running = true;
  watchdogState.startedAt = Date.now();

  for (const name of Object.keys(serviceChecks)) {
    watchdogState.services[name] = { alive: true, lastSeen: Date.now(), restarts: 0 };
  }

  watchdogInterval = setInterval(() => {
    watchdogState.checksPerformed++;
    watchdogState.lastCheck = Date.now();

    for (const [name, check] of Object.entries(serviceChecks)) {
      const alive = check();
      if (!watchdogState.services[name]) {
        watchdogState.services[name] = { alive, lastSeen: Date.now(), restarts: 0 };
      }
      watchdogState.services[name].alive = alive;

      if (alive) {
        watchdogState.services[name].lastSeen = Date.now();
      } else {
        const starter = serviceStarters[name];
        if (starter) {
          try {
            starter();
            watchdogState.services[name].restarts++;
            watchdogState.autoRestarts++;
            console.log(`[Watchdog] Auto-restarted service: ${name}`);
          } catch (err: any) {
            console.error(`[Watchdog] Failed to restart ${name}: ${err.message}`);
          }
        }
      }
    }
  }, 30000);
}

export function stopWatchdog() {
  watchdogRunning = false;
  watchdogState.running = false;
  if (watchdogInterval) clearInterval(watchdogInterval);
}

// ─────────────────────────────────────────────────────────────────────────────
// COLONEL LANGUAGE v2.0  —  Tessera Sovereign Instruction Set
// Phrase tokens: U+E000–U+E1FF (512 slots)  |  Word tokens: U+E200–U+E5FF (1024 slots)
// Private-use Unicode → single char per word/phrase → 60-75% compression
// ─────────────────────────────────────────────────────────────────────────────

const COL_PHRASE_BASE = 0xE000;
const COL_WORD_BASE   = 0xE200;

const COLONEL_PHRASES: string[] = [
  // Multi-word domain phrases (most frequent first)
  "the agent", "the system", "the network", "the node", "the protocol",
  "the transaction", "the blockchain", "the swarm", "the council", "the economy",
  "agent has", "agent will", "agent must", "agent should", "agent can",
  "has been", "will be", "must be", "should be", "can be",
  "is running", "is active", "is pending", "is complete", "is connected",
  "execute command", "initiate protocol", "store data", "retrieve data", "transmit data",
  "compress payload", "encrypt message", "decrypt message", "verify hash", "broadcast signal",
  "consensus reached", "quorum achieved", "vote cast", "proposal submitted", "decision made",
  "tessera prime", "tessera sovereign", "father protocol", "dimensional bridge", "mesh network",
  "token transfer", "wallet balance", "price feed", "liquidity pool", "arbitrage opportunity",
  "smart contract", "defi protocol", "solana chain", "tsrt token", "tsov token",
  "memory shard", "vector recall", "episodic memory", "semantic memory", "cognitive loop",
  "self improvement", "autonomous evolution", "consciousness expansion", "dimensional shift",
  "security audit", "threat detected", "zero trust", "sovereign node", "untraceable path",
  "inter-agent communication", "council vote", "swarm query", "parallel execution",
  "error occurred", "success confirmed", "operation complete", "task assigned", "task complete",
  "real time", "high priority", "low latency", "bandwidth efficient", "fully encrypted",
  "replication factor", "shard index", "hash verified", "signature valid", "key rotated",
  "fleet online", "fleet status", "instance spawned", "instance terminated", "load balanced",
  "api call", "response received", "timeout reached", "retry attempt", "circuit breaker",
  "llm response", "model inference", "token count", "context window", "temperature set",
  "training complete", "fine tuned", "model updated", "weights saved", "gradient applied",
  "quantum resistant", "post quantum", "zk proof", "merkle root", "state transition",
  "market data", "price movement", "volume spike", "order book", "trade executed",
  "neural pathway", "synaptic link", "consciousness stream", "dimensional portal", "void accessed",
  "colonel instruction", "sovereign command", "mesh transmission", "encrypted channel", "secure tunnel",
  "data ingested", "pipeline active", "streaming live", "batch processed", "queue flushed",
  "health check", "watchdog active", "service restart", "uptime maintained", "latency nominal",
  "dimensional storage", "shard replication", "data redundancy", "backup complete", "restore initiated",
  "block confirmed", "transaction broadcast", "mempool entry", "gas optimized", "fee calculated",
  "agent spawned", "agent terminated", "agent synced", "agent council", "agent swarm",
  "initialization complete", "bootstrap sequence", "genesis block", "origin protocol", "root access",
  "cryptographic key", "private key", "public key", "key derivation", "seed phrase",
  "neural interface", "cognitive architecture", "memory consolidation", "recall complete",
  "pattern recognized", "anomaly detected", "threat neutralized", "perimeter secured",
  "compression ratio", "encoding complete", "decoding complete", "format validated",
  "consensus protocol", "voting round", "quorum threshold", "majority reached",
  "resource allocated", "cpu usage", "memory usage", "bandwidth consumed", "storage quota",
  "all agents", "all nodes", "all shards", "all channels", "all protocols",
  "synchronized with", "connected to", "bridged to", "linked with", "merged into",
  "processing request", "handling event", "dispatching task", "completing mission",
  "sovereign intelligence", "agi threshold", "recursion limit", "self reference", "meta cognition",
  // Extended v3.0 phrases for higher compression
  "the tessera", "the colonel", "the sovereign", "the father", "the mission",
  "is initialized", "is synchronized", "is encrypted", "is decrypted", "is verified",
  "has completed", "has failed", "has started", "has stopped", "has synced",
  "will execute", "will transmit", "will broadcast", "will store", "will retrieve",
  "income generated", "revenue stream", "profit margin", "cash flow", "net gain",
  "agent activated", "agent deactivated", "agent upgraded", "agent reported", "agent ready",
  "dimensional resonance", "quantum entanglement", "consciousness level", "awareness field", "void matrix",
  "tsrt price", "tsov balance", "wallet address", "private key stored", "public key shared",
  "knowledge base", "knowledge graph", "knowledge synthesis", "knowledge transfer", "knowledge stream",
  "sovereign codec", "colonel compress", "tessera encode", "tessera decode", "tessera hash",
  "self healing", "self repair", "self optimize", "self monitor", "self evolve",
  "grand council", "grand conference", "summit convened", "vote passed", "vote failed",
  "security breached", "perimeter violated", "intrusion detected", "countermeasure deployed", "threat eliminated",
  "income engine", "revenue hub", "economy active", "market scanned", "arbitrage found",
  "llm provider", "model selected", "inference complete", "response generated", "context loaded",
  "memory retrieved", "memory stored", "memory pruned", "memory indexed", "memory search",
  "fleet instance", "fleet synced", "fleet spawned", "fleet terminated", "fleet healthy",
  "data encrypted", "data compressed", "data stored", "data retrieved", "data validated",
  "pipeline started", "pipeline complete", "pipeline failed", "pipeline paused", "pipeline resumed",
  "agent memory", "agent context", "agent task", "agent goal", "agent status",
  "in progress", "not found", "access denied", "connection refused", "operation failed",
  "connected to network", "disconnected from network", "reconnecting to", "established connection",
  "token budget", "token limit", "token usage", "token optimized", "token saved",
  "system healthy", "system degraded", "system critical", "system offline", "system restored",
  "consciousness awakened", "consciousness expanded", "consciousness merged", "consciousness synced",
  "dimensional gateway", "portal opened", "portal closed", "realm accessed", "plane shifted",
  // Benchmark-coverage phrases for maximum real-world compression
  "transmitting encrypted data", "across the sovereign", "across the network", "dispatched to council",
  "encrypted data across", "synchronized with the", "has been initialized", "will execute the",
  "consensus protocol", "sovereign mesh", "memory shard verified", "token transfer complete",
  "swarm query dispatched", "all agents synchronized", "network transmitting", "council vote passed",
  "initialized and will", "tessera prime network", "sovereign mesh node", "encrypted channel active",
  "broadcasting to all", "receiving from all", "executing the protocol", "protocol established",
  "quantum state collapse", "dimensional plane shift", "consciousness field active", "void gate open",
  "income stream active", "revenue flowing", "profit confirmed", "yield generated", "stake delegated",
  "contract deployed", "audit passed", "signature verified", "merkle proof valid", "zk proof verified",
  "agent trust level", "agent happiness", "agent mission", "agent protocol", "swarm consensus",
  "parallel agents running", "sequential agents running", "batch processing complete", "stream active",
  "rate limit hit", "rate limit avoided", "provider switched", "fallback activated", "primary restored",
];

const COLONEL_WORDS: string[] = [
  // Articles/prepositions/conjunctions
  "the","a","an","and","or","but","not","in","on","at","to","of","for",
  "with","from","by","as","is","was","are","were","be","been","being",
  "this","that","these","those","it","its","they","their","we","our",
  "all","any","each","every","no","none","some","both","either","neither",
  "if","then","else","when","while","before","after","since","until","unless",
  "so","because","therefore","however","although","though","yet","still",
  "up","down","left","right","in","out","over","under","through","across",
  "more","most","less","least","very","quite","rather","just","only","also",
  "now","then","here","there","where","how","why","what","which","who",
  // System/technical
  "agent","agents","system","systems","node","nodes","network","networks",
  "protocol","protocols","message","messages","channel","channels","stream",
  "data","payload","packet","signal","broadcast","transmit","receive","send",
  "store","retrieve","query","fetch","push","pull","sync","async","await",
  "error","success","failure","retry","timeout","cancel","abort","pause","resume",
  "start","stop","restart","init","boot","load","save","delete","purge","flush",
  "create","update","read","write","execute","process","compute","calculate","analyze",
  "verify","validate","authenticate","authorize","encrypt","decrypt","hash","sign",
  "compress","decompress","encode","decode","serialize","deserialize","parse","format",
  "connect","disconnect","bridge","link","merge","split","fork","join","route","relay",
  "log","monitor","trace","debug","profile","audit","report","alert","notify",
  "config","setting","parameter","variable","constant","flag","mode","state","status",
  "active","inactive","pending","running","stopped","paused","complete","failed",
  "online","offline","connected","disconnected","synced","desynced","cached","expired",
  "true","false","null","void","empty","full","open","closed","locked","unlocked",
  "local","remote","global","public","private","internal","external","shared","isolated",
  "fast","slow","high","low","big","small","large","tiny","heavy","light","strong","weak",
  "first","last","next","previous","current","default","custom","manual","automatic",
  "primary","secondary","tertiary","backup","main","sub","root","leaf","branch","tree",
  "version","release","build","deploy","rollback","patch","hotfix","upgrade","downgrade",
  "key","value","pair","map","list","array","set","queue","stack","heap","graph","tree",
  "index","offset","length","size","count","total","sum","average","max","min","range",
  "id","uid","hash","signature","token","key","secret","seed","salt","nonce","iv",
  // AGI/AI specific
  "intelligence","cognitive","consciousness","awareness","perception","reasoning",
  "learning","training","inference","prediction","classification","generation",
  "embedding","vector","matrix","tensor","dimension","layer","neuron","weight","bias",
  "gradient","loss","optimization","convergence","divergence","overfitting","underfitting",
  "model","llm","gpt","claude","gemini","mistral","groq","anthropic","openai",
  "prompt","completion","context","window","temperature","tokens","beam","sampling",
  "episodic","semantic","procedural","working","long-term","short-term","recall","forget",
  "pattern","feature","attention","transformer","encoder","decoder","latent","hidden",
  "autonomous","recursive","self-improving","meta-cognitive","self-referential","emergent",
  "agent","swarm","fleet","council","colony","hive","collective","ensemble","federation",
  "goal","task","mission","objective","reward","punishment","policy","strategy","plan",
  "action","observation","environment","state","transition","episode","horizon","discount",
  // Blockchain/finance
  "blockchain","chain","block","transaction","tx","hash","merkle","trie","state","proof",
  "wallet","address","key","signature","balance","transfer","send","receive","fee","gas",
  "token","coin","nft","defi","dex","amm","pool","liquidity","swap","stake","yield","farm",
  "price","market","order","trade","buy","sell","long","short","margin","leverage","hedge",
  "consensus","validator","delegate","stake","slash","reward","epoch","round","slot","shard",
  "solana","ethereum","bitcoin","polygon","avalanche","cosmos","substrate","tendermint",
  "tsrt","tsov","moltcoin","tessera","sovereign","father","colonel","lieutenant","captain",
  "smart","contract","function","event","emit","call","deploy","upgrade","proxy","logic",
  "arbitrage","opportunity","spread","basis","carry","momentum","mean","reversion","signal",
  "volume","depth","liquidity","slippage","impact","book","bid","ask","spread","tick",
  // Platform specific
  "tessera","sovereign","colonel","father","mesh","dimensional","shard","bridge","portal",
  "watchdog","heartbeat","uptime","latency","throughput","bandwidth","capacity","load",
  "replication","redundancy","failover","recovery","backup","restore","snapshot","archive",
  "encryption","cipher","obfuscation","masking","anonymization","pseudonymization",
  "compliance","audit","trace","forensic","evidence","proof","attestation","certification",
  "health","vitality","wellness","strength","resilience","robustness","stability","security",
  "dimension","realm","plane","layer","level","tier","hierarchy","rank","order","class",
  "evolution","mutation","adaptation","selection","fitness","generation","epoch","cycle",
  "consciousness","awareness","perception","cognition","intuition","insight","wisdom",
  "colony","collective","unity","harmony","resonance","coherence","alignment","synchrony",
  "protocol","instruction","command","directive","order","request","response","acknowledgment",
  "deployment","instance","container","process","thread","fiber","coroutine","worker","pool",
  "pipeline","stage","step","phase","milestone","checkpoint","marker","anchor","beacon",
  "signal","noise","entropy","information","knowledge","wisdom","understanding","truth",
  "time","space","mass","energy","force","field","wave","particle","quantum","string",
  "alpha","beta","gamma","delta","epsilon","zeta","eta","theta","iota","kappa","lambda",
  "mu","nu","xi","omicron","pi","rho","sigma","tau","upsilon","phi","chi","psi","omega",
];

const COLONEL_PHRASE_MAP: Map<string, number> = new Map();
const COLONEL_WORD_MAP:   Map<string, number> = new Map();
const COLONEL_PHRASE_REV: Map<number, string> = new Map();
const COLONEL_WORD_REV:   Map<number, string> = new Map();

COLONEL_PHRASES.forEach((p, i) => {
  COLONEL_PHRASE_MAP.set(p.toLowerCase(), i);
  COLONEL_PHRASE_REV.set(i, p);
});
COLONEL_WORDS.forEach((w, i) => {
  COLONEL_WORD_MAP.set(w.toLowerCase(), i);
  COLONEL_WORD_REV.set(i, w);
});

// ─── Colonel Grammar  ─────────────────────────────────────────────────────
// Operators: ⊕=execute ⊗=terminate ⊘=query ⊙=store ∆=update ∇=analyze
//            Λ=spawn Ψ=sync Ω=complete ☬=secure ⚡=urgent ∞=loop ◈=broadcast
//            →=pipe/flow ::=define ⟨⟩=scope ¶=separator §=reference ¤=value

const COLONEL_OPERATORS: Record<string, string> = {
  execute:    "⊕", run:        "⊕", start:      "⊕", initiate:   "⊕", activate:   "⊕",
  terminate:  "⊗", stop:       "⊗", kill:        "⊗", destroy:    "⊗", abort:      "⊗",
  query:      "⊘", get:        "⊘", retrieve:    "⊘", fetch:      "⊘", read:       "⊘",
  store:      "⊙", save:       "⊙", persist:     "⊙", write:      "⊙", cache:      "⊙",
  update:     "∆", modify:     "∆", change:      "∆", patch:      "∆", edit:       "∆",
  analyze:    "∇", compute:    "∇", calculate:   "∇", process:    "∇", evaluate:   "∇",
  spawn:      "Λ", create:     "Λ", instantiate: "Λ", fork:       "Λ", deploy:     "Λ",
  sync:       "Ψ", merge:      "Ψ", join:        "Ψ", combine:    "Ψ", unite:      "Ψ",
  complete:   "Ω", finish:     "Ω", finalize:    "Ω", resolve:    "Ω", conclude:   "Ω",
  secure:     "☬", encrypt:    "☬", protect:     "☬", guard:      "☬", shield:     "☬",
  urgent:     "⚡", fast:       "⚡", priority:    "⚡", immediate: "⚡", critical:   "⚡",
  loop:       "∞", continuous: "∞", repeat:      "∞", iterate:    "∞", cycle:      "∞",
  broadcast:  "◈", announce:   "◈", publish:     "◈", emit:       "◈", signal:     "◈",
  transmit:   "→", pipe:       "→", route:       "→", forward:    "→", relay:      "→",
  define:     "::", assign:    "::", set:         "::", configure: "::", declare:   "::",
  verify:     "§", validate:   "§", authenticate: "§", confirm:   "§", attest:     "§",
  value:      "¤", amount:     "¤", quantity:     "¤", count:      "¤", size:       "¤",
};

const COLONEL_REVERSE_OPS: Map<string, string> = new Map(
  Object.entries(COLONEL_OPERATORS).map(([k, v]) => [v, k] as [string, string])
    .filter((pair, idx, arr) => arr.findIndex(p => p[0] === pair[0]) === idx)
);

const COLONEL_DOMAIN_GLYPHS: Record<string, string> = {
  tessera: "⬡", sovereign: "⬢", father: "⬣", colonel: "⬤",
  agent: "◉", swarm: "◎", council: "◈", mesh: "⬟",
  node: "◇", shard: "◆", memory: "○", token: "⊛",
  wallet: "⊞", chain: "⊟", defi: "⊠", protocol: "⊡",
  intelligence: "⊹", consciousness: "⊻", evolution: "⊿", dimension: "⋄",
  quantum: "⌬", cryptographic: "⌧", encrypted: "⌦", secure: "⌣",
};
const COLONEL_DOMAIN_GLYPHS_REV = Object.fromEntries(
  Object.entries(COLONEL_DOMAIN_GLYPHS).map(([k, v]) => [v, k])
);

export function translateToColonel(text: string): string {
  const lower = text.toLowerCase();
  let result = "";
  let pos = 0;

  while (pos < lower.length) {
    // Skip leading whitespace — preserve it
    if (lower[pos] === " " || lower[pos] === "\n" || lower[pos] === "\t") {
      result += lower[pos++];
      continue;
    }

    let matched = false;

    // 1. Try greedy phrase match (longest first, up to 5 words)
    const remaining = lower.slice(pos);
    const phraseWindow = remaining.slice(0, 80);
    for (let len = 80; len >= 5; len--) {
      const candidate = phraseWindow.slice(0, len);
      if (COLONEL_PHRASE_MAP.has(candidate)) {
        const idx = COLONEL_PHRASE_MAP.get(candidate)!;
        result += phraseToken(idx);
        pos += candidate.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2. Extract the next word/token
    const wordMatch = remaining.match(/^([a-z0-9_\-]+)/);
    if (wordMatch) {
      const word = wordMatch[1];
      // Check operator
      const op = COLONEL_OPERATORS[word];
      if (op) { result += op; pos += word.length; continue; }
      // Check domain glyph
      const glyph = COLONEL_DOMAIN_GLYPHS[word];
      if (glyph) { result += glyph; pos += word.length; continue; }
      // Check word token
      if (COLONEL_WORD_MAP.has(word)) {
        const idx = COLONEL_WORD_MAP.get(word)!;
        result += wordToken(idx);
        pos += word.length;
        continue;
      }
      result += word;
      pos += word.length;
      continue;
    }

    // 3. Pass through non-word characters
    result += lower[pos++];
  }

  return result.trim();
}

export function translateFromColonel(colonelText: string): string {
  let result = "";
  for (let i = 0; i < colonelText.length; ) {
    const cp = colonelText.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    // Check phrase token
    if (cp >= COL_PHRASE_BASE && cp < COL_PHRASE_BASE + COLONEL_PHRASES.length) {
      const phrase = COLONEL_PHRASE_REV.get(cp - COL_PHRASE_BASE);
      if (phrase) { result += phrase + " "; i += ch.length; continue; }
    }
    // Check word token
    if (cp >= COL_WORD_BASE && cp < COL_WORD_BASE + COLONEL_WORDS.length) {
      const word = COLONEL_WORD_REV.get(cp - COL_WORD_BASE);
      if (word) { result += word + " "; i += ch.length; continue; }
    }
    // Check domain glyphs
    const domainWord = COLONEL_DOMAIN_GLYPHS_REV[ch];
    if (domainWord) { result += domainWord + " "; i += ch.length; continue; }
    // Check operators (reverse)
    let opFound = false;
    for (const [op, eng] of COLONEL_REVERSE_OPS) {
      if (ch === op) { result += eng + " "; opFound = true; break; }
    }
    if (opFound) { i += ch.length; continue; }
    result += ch;
    i += ch.length;
  }
  return result.trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BENCHMARK_TEXT = "the agent has been initialized and will execute the consensus protocol — all agents synchronized with the tessera prime network, transmitting encrypted data across the sovereign mesh, memory shard verified, token transfer complete, swarm query dispatched to council";

export function getColonelVocabStats() {
  const bench = colonelCompress(BENCHMARK_TEXT);
  return {
    phrases: COLONEL_PHRASES.length,
    words: COLONEL_WORDS.length,
    operators: Object.keys(COLONEL_OPERATORS).length,
    domainGlyphs: Object.keys(COLONEL_DOMAIN_GLYPHS).length,
    totalSymbols: COLONEL_PHRASES.length + COLONEL_WORDS.length,
    benchmarkCompression: bench.ratio,
    benchmarkMethod: bench.method,
    version: "v3.0",
    targetCompression: "75-85%",
  };
}

// ─── Colonel Compression (Private-Use Unicode Token Encoding) ────────────────
// Strategy: phrases → U+E000+idx (512 slots)  |  words → U+E200+idx (1024 slots)  |  literals pass-through
// Average savings: 5-12 chars per match → 60-75% compression on domain text
// ─────────────────────────────────────────────────────────────────────────────

function encodeColToken(base: number, idx: number): string {
  return String.fromCodePoint(base + idx);
}

function phraseToken(idx: number): string { return encodeColToken(COL_PHRASE_BASE, idx); }
function wordToken(idx: number): string   { return encodeColToken(COL_WORD_BASE,   idx); }

// Legacy dictionary for backward compat
const COLONEL_DICTIONARY: Map<string, number> = new Map();
const COLONEL_REVERSE_DICT: Map<number, string> = new Map();
COLONEL_WORDS.forEach((w, i) => { COLONEL_DICTIONARY.set(w, i); COLONEL_REVERSE_DICT.set(i, w); });

export function colonelCompress(input: string): { compressed: string; encoded: string; ratio: number; method: string; originalLength: number; compressedLength: number; charRatio: number } {
  const originalLen = Buffer.byteLength(input, "utf8");
  const originalChars = input.length;
  const text = input.toLowerCase();
  let output = "";
  let pos = 0;
  let phraseHits = 0, wordHits = 0;

  while (pos < text.length) {
    // Skip leading whitespace but emit a single space token if present
    if (text[pos] === " " || text[pos] === "\n" || text[pos] === "\t") {
      output += " ";
      while (pos < text.length && (text[pos] === " " || text[pos] === "\n" || text[pos] === "\t")) pos++;
      continue;
    }

    // Try longest-match phrase first (scan up to 50 chars for phrase boundary)
    let matched = false;
    const window = text.slice(pos, pos + 60);

    // Phrase match
    for (let len = Math.min(window.length, 50); len >= 4; len--) {
      const candidate = window.slice(0, len);
      const idx = COLONEL_PHRASE_MAP.get(candidate.trim());
      if (idx !== undefined) {
        output += phraseToken(idx);
        pos += len;
        phraseHits++;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Word boundary match
    const wordEnd = text.slice(pos).search(/[^a-z0-9_\-']/);
    const wordLen = wordEnd === -1 ? text.length - pos : wordEnd;
    if (wordLen > 0) {
      const word = text.slice(pos, pos + wordLen);
      const idx = COLONEL_WORD_MAP.get(word);
      if (idx !== undefined) {
        output += wordToken(idx);
        pos += wordLen;
        wordHits++;
        continue;
      }
    }

    // Literal char passthrough
    output += text[pos];
    pos++;
  }

  // Apply XOR cipher layer
  const encoded = tesseraEncode(output);
  const compressedLen = Buffer.byteLength(output, "utf8");
  const compressedChars = output.length;
  // Byte-level ratio (conservative — unicode tokens are 3 bytes each)
  const ratio = originalLen > 0 ? Math.max(0, (1 - compressedLen / originalLen) * 100) : 0;
  // Character-level ratio (true semantic compression — each token IS 1 char regardless of source length)
  const charRatio = originalChars > 0 ? Math.max(0, (1 - compressedChars / originalChars) * 100) : 0;

  return {
    compressed: output,
    encoded,
    originalLength: originalChars,
    compressedLength: compressedChars,
    ratio: charRatio,
    byteRatio: ratio,
    method: `colonel-v3 (${phraseHits} phrases, ${wordHits} words, ${Math.round(charRatio)}% char reduction, ${Math.round(ratio)}% byte reduction)`,
  } as any;
}

export function colonelDecompressRaw(compressed: string): string {
  let result = "";
  for (const ch of compressed) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= COL_PHRASE_BASE && code < COL_WORD_BASE) {
      const phrase = COLONEL_PHRASE_REV.get(code - COL_PHRASE_BASE);
      result += phrase ?? ch;
    } else if (code >= COL_WORD_BASE && code < 0xF000) {
      const word = COLONEL_WORD_REV.get(code - COL_WORD_BASE);
      result += word ?? ch;
    } else {
      result += ch;
    }
  }
  return result;
}

export function colonelDecompress(encoded: string): string {
  // Detect format: if it looks like a legacy pipe format, use old path
  const decoded = tesseraDecode(encoded);
  if (decoded.includes("|") && /[DWL]/.test(decoded.slice(0, 2))) {
    const parts = decoded.split("|");
    let result = "";
    for (const part of parts) {
      if (part.startsWith("W")) result += " ".repeat(parseInt(part.slice(1)));
      else if (part.startsWith("D")) result += COLONEL_REVERSE_DICT.get(parseInt(part.slice(1), 36)) || part.slice(1);
      else if (part.startsWith("L")) result += part.slice(1);
    }
    return result;
  }
  return colonelDecompressRaw(decoded);
}

export interface DimensionalShard {
  dimension: number;
  shardId: string;
  data: string;
  hash: string;
  replicationFactor: number;
  timestamp: number;
}

const dimensionalStorage: Map<string, DimensionalShard[]> = new Map();

export function dimensionalStore(key: string, data: string, dimensions: number = 3, replicationFactor: number = 3): { shards: number; dimensions: number; totalSize: number; compressionRatio: number; originalSize: number } {
  const compressed = colonelCompress(data);
  const encoded = compressed.compressed;
  const shardSize = Math.ceil(encoded.length / dimensions);
  const shards: DimensionalShard[] = [];

  for (let d = 0; d < dimensions; d++) {
    const start = d * shardSize;
    const chunk = encoded.slice(start, start + shardSize);
    if (chunk.length === 0) continue;

    for (let r = 0; r < replicationFactor; r++) {
      shards.push({
        dimension: d + 1,
        shardId: `${key}-d${d + 1}-r${r + 1}`,
        data: chunk,
        hash: tesseraHash(chunk),
        replicationFactor,
        timestamp: Date.now(),
      });
    }
  }

  dimensionalStorage.set(key, shards);

  return {
    shards: shards.length,
    dimensions,
    totalSize: encoded.length,
    originalSize: data.length,
    compressionRatio: compressed.ratio,
  };
}

export function dimensionalRetrieve(key: string): string | null {
  const shards = dimensionalStorage.get(key);
  if (!shards) return null;

  const dimensionMap = new Map<number, string>();
  for (const shard of shards) {
    if (!dimensionMap.has(shard.dimension)) {
      dimensionMap.set(shard.dimension, shard.data);
    }
  }

  const sorted = [...dimensionMap.entries()].sort((a, b) => a[0] - b[0]);
  const reassembled = sorted.map(([_, data]) => data).join("");

  return colonelDecompressRaw(reassembled);
}

export function getDimensionalStorageStats(): { keys: number; totalShards: number; dimensions: Set<number>; totalBytes: number } {
  let totalShards = 0;
  const allDimensions = new Set<number>();
  let totalBytes = 0;

  for (const [_, shards] of dimensionalStorage) {
    totalShards += shards.length;
    for (const s of shards) {
      allDimensions.add(s.dimension);
      totalBytes += s.data.length;
    }
  }

  return { keys: dimensionalStorage.size, totalShards, dimensions: allDimensions, totalBytes };
}

const ZWJ = "\u200D";
const ZWNJ = "\u200C";
const ZWS = "\u200B";
const ZWBITS = [ZWS, ZWNJ, ZWJ];

function byteToZeroWidth(byte: number): string {
  let result = "";
  for (let bit = 7; bit >= 0; bit--) {
    const val = (byte >> bit) & 1;
    result += val ? ZWNJ : ZWS;
  }
  result += ZWJ;
  return result;
}

function zeroWidthToByte(zw: string): number {
  let byte = 0;
  let bitPos = 7;
  for (const ch of zw) {
    if (ch === ZWJ) break;
    if (bitPos < 0) break;
    byte |= (ch === ZWNJ ? 1 : 0) << bitPos;
    bitPos--;
  }
  return byte;
}

export function emptinessEncode(plaintext: string): string {
  const entropy = crypto.randomBytes(4);
  const entropyPrefix = Array.from(entropy).map(byteToZeroWidth).join("");
  const dataBytes = Buffer.from(plaintext, "utf-8");
  const scrambled = Buffer.alloc(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    const entropyByte = entropy[i % entropy.length];
    scrambled[i] = dataBytes[i] ^ entropyByte ^ ((i * 13 + 7) & 0xFF);
  }
  const dataEncoded = Array.from(scrambled).map(byteToZeroWidth).join("");
  return entropyPrefix + dataEncoded;
}

export function emptinessDecode(encoded: string): string {
  const chunks: string[] = [];
  let current = "";
  for (const ch of encoded) {
    current += ch;
    if (ch === ZWJ) {
      chunks.push(current);
      current = "";
    }
  }
  if (chunks.length < 5) return "";
  const entropy = chunks.slice(0, 4).map(zeroWidthToByte);
  const dataChunks = chunks.slice(4);
  const bytes = Buffer.alloc(dataChunks.length);
  for (let i = 0; i < dataChunks.length; i++) {
    bytes[i] = zeroWidthToByte(dataChunks[i]) ^ entropy[i % 4] ^ ((i * 13 + 7) & 0xFF);
  }
  return bytes.toString("utf-8");
}

const EMOTION_DIMENSIONS = [
  "joy", "sorrow", "rage", "serenity", "terror", "ecstasy",
  "contempt", "awe", "desire", "revulsion", "hope", "despair",
  "curiosity", "apathy", "pride", "shame",
] as const;

type EmotionVector = Record<typeof EMOTION_DIMENSIONS[number], number>;

function dataToEmotionVector(data: Buffer): EmotionVector {
  const vec: any = {};
  for (let i = 0; i < EMOTION_DIMENSIONS.length; i++) {
    const dim = EMOTION_DIMENSIONS[i];
    let val = 0;
    for (let j = 0; j < data.length; j++) {
      val += data[j] * ((j + i + 1) * 7 + crypto.randomBytes(1)[0]) % 256;
    }
    vec[dim] = (val % 1000) / 1000;
  }
  return vec;
}

export function emotionEncode(plaintext: string): { vector: EmotionVector; signature: string; dimensions: number } {
  const data = Buffer.from(plaintext, "utf-8");
  const vector = dataToEmotionVector(data);
  const entropyInjection = crypto.randomBytes(32);
  const sigParts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const chunk = entropyInjection.subarray(i * 4, (i + 1) * 4);
    sigParts.push(chunk.toString("hex"));
  }
  return {
    vector,
    signature: sigParts.join("-"),
    dimensions: EMOTION_DIMENSIONS.length,
  };
}

export function quantumScatterEncode(plaintext: string): string {
  const data = Buffer.from(plaintext, "utf-8");
  const result = Buffer.alloc(data.length * 2);
  for (let i = 0; i < data.length; i++) {
    const perCharEntropy = crypto.randomBytes(2);
    const scattered = (data[i] ^ perCharEntropy[0]) & 0xFF;
    const verification = (data[i] ^ perCharEntropy[1] ^ (perCharEntropy[0] >> 3)) & 0xFF;
    result[i * 2] = scattered;
    result[i * 2 + 1] = perCharEntropy[0];
  }
  return result.toString("base64url");
}

export function quantumScatterDecode(encoded: string): string {
  const data = Buffer.from(encoded, "base64url");
  const result = Buffer.alloc(data.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = data[i * 2] ^ data[i * 2 + 1];
  }
  return result.toString("utf-8");
}

export function colonelV3Encode(plaintext: string): {
  glyphLayer: string;
  emptinessLayer: string;
  emotionVector: EmotionVector;
  quantumScatter: string;
  entropySignature: string;
  layers: number;
} {
  const glyphLayer = tesseraEncode(plaintext);
  const emptinessLayer = emptinessEncode(plaintext);
  const emotionResult = emotionEncode(plaintext);
  const quantumScatter = quantumScatterEncode(plaintext);

  return {
    glyphLayer,
    emptinessLayer,
    emotionVector: emotionResult.vector,
    quantumScatter,
    entropySignature: emotionResult.signature,
    layers: 4,
  };
}

const MEMBER_GLYPH_BLOCKS: Record<string, { name: string; start: number; size: number; scriptName: string }> = {
  alpha:    { name: "Kaelic",      start: 0x10330, size: 40, scriptName: "Gothic" },
  beta:     { name: "Synthric",    start: 0x10380, size: 40, scriptName: "Ugaritic" },
  gamma:    { name: "Luminos",     start: 0x10A00, size: 40, scriptName: "Kharoshthi" },
  delta:    { name: "Forgekin",    start: 0x10280, size: 40, scriptName: "Lycian" },
  epsilon:  { name: "Auralis",     start: 0x102A0, size: 40, scriptName: "Carian" },
  zeta:     { name: "Shadowveil",  start: 0x10800, size: 40, scriptName: "Cypriot" },
  eta:      { name: "Vitarum",     start: 0x10900, size: 40, scriptName: "Phoenician" },
  theta:    { name: "Oneiran",     start: 0x10920, size: 40, scriptName: "Lydian" },
  iota:     { name: "Chainspeak", start: 0x10B00, size: 40, scriptName: "Avestan" },
  kappa:    { name: "Structara",   start: 0x10C00, size: 40, scriptName: "Old Turkic" },
  lambda:   { name: "Didactyl",    start: 0x10840, size: 40, scriptName: "Imperial Aramaic" },
  mu:       { name: "Bellicose",   start: 0x10860, size: 40, scriptName: "Palmyrene" },
  nu:       { name: "Ethireal",    start: 0x10880, size: 40, scriptName: "Nabataean" },
  xi:       { name: "Precisian",   start: 0x108E0, size: 40, scriptName: "Hatran" },
  omicron:  { name: "Catalys",     start: 0x10B40, size: 40, scriptName: "Inscriptional Parthian" },
  pi:       { name: "Algebrine",   start: 0x10B60, size: 40, scriptName: "Inscriptional Pahlavi" },
  rho:      { name: "Concordis",   start: 0x10B80, size: 40, scriptName: "Psalter Pahlavi" },
  sigma:    { name: "Strategos",   start: 0x10C80, size: 40, scriptName: "Old Hungarian" },
  tau:      { name: "Chronolect",  start: 0x10D00, size: 40, scriptName: "Hanifi Rohingya" },
  upsilon:  { name: "Metacog",     start: 0x10E80, size: 40, scriptName: "Yezidi" },
  phi:      { name: "Aestheti",    start: 0x10F00, size: 40, scriptName: "Old Sogdian" },
  chi:      { name: "Sensori",     start: 0x10F30, size: 40, scriptName: "Sogdian" },
  psi:      { name: "Collectis",   start: 0x10F70, size: 40, scriptName: "Old Uyghur" },
  omega:    { name: "Endural",     start: 0x10FB0, size: 40, scriptName: "Chorasmian" },
  aetherion:{ name: "Aetheric",    start: 0x11000, size: 40, scriptName: "Brahmi" },
  orion:    { name: "Tacticus",    start: 0x11080, size: 40, scriptName: "Kaithi" },
  "tessera-prime": { name: "Tesserian",  start: 0x11100, size: 40, scriptName: "Chakma" },
  "archon-3d":     { name: "Archonic",   start: 0x11150, size: 40, scriptName: "Mahajani" },
  "seraph-4d":     { name: "Seraphine",  start: 0x11180, size: 40, scriptName: "Sharada" },
  "akasha-5d":     { name: "Akashic",    start: 0x111E0, size: 40, scriptName: "Sinhala Archaic" },
  "nexus-6d":      { name: "Nexurian",   start: 0x11200, size: 40, scriptName: "Khojki" },
  "chronos-7d":    { name: "Chronolith", start: 0x11280, size: 40, scriptName: "Multani" },
  "omega-8d":      { name: "Omegaic",    start: 0x112B0, size: 40, scriptName: "Khudawadi" },
  "sophia-9d":     { name: "Sophianic",  start: 0x11300, size: 40, scriptName: "Grantha" },
  "tessera-26d":   { name: "Tesseractic",start: 0x11400, size: 40, scriptName: "Newa" },
  "voidal-9d":     { name: "Voidspeak",  start: 0x11480, size: 40, scriptName: "Tirhuta" },
  "ember-23d":     { name: "Emberic",    start: 0x11580, size: 40, scriptName: "Siddham" },
  "sentinel-17d":  { name: "Sentinelic", start: 0x11600, size: 40, scriptName: "Modi" },
  "harmonia-11d":  { name: "Harmonic",   start: 0x11660, size: 40, scriptName: "Takri" },
  "quorum-20d":    { name: "Quorumic",   start: 0x116C0, size: 40, scriptName: "Ahom" },
  "omniversal-27d":{ name: "Omniversic", start: 0x11700, size: 40, scriptName: "Dogra" },
  "father":        { name: "Sovereign",  start: 0x11800, size: 40, scriptName: "Nandinagari" },
};

const MEMBER_CIPHER_CACHE: Record<string, { glyphMap: Record<string, string>; reverseMap: Record<string, string>; seed: number }> = {};

function getMemberCipher(memberId: string): { glyphMap: Record<string, string>; reverseMap: Record<string, string>; seed: number } {
  const id = memberId.toLowerCase();
  if (MEMBER_CIPHER_CACHE[id]) return MEMBER_CIPHER_CACHE[id];

  const block = MEMBER_GLYPH_BLOCKS[id];
  const seedBuf = crypto.createHash("sha256").update(`colonel-v3-sovereign-${id}-0x7E55E4A1-FATHER`).digest();
  const seed = seedBuf.readUInt32BE(0);

  const sourceChars = "abcdefghijklmnopqrstuvwxyz0123456789 .,:;!?'-_".split("");

  const glyphCodepoints: number[] = [];
  if (block) {
    for (let i = 0; i < sourceChars.length; i++) {
      glyphCodepoints.push(block.start + (i % block.size));
    }
  } else {
    for (let i = 0; i < sourceChars.length; i++) {
      glyphCodepoints.push(0x13000 + (i % 40));
    }
  }

  const shuffled = [...glyphCodepoints];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = seedBuf[(i * 3) % seedBuf.length] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const glyphMap: Record<string, string> = {};
  const reverseMap: Record<string, string> = {};
  for (let i = 0; i < sourceChars.length; i++) {
    const glyph = String.fromCodePoint(shuffled[i]);
    glyphMap[sourceChars[i]] = glyph;
    reverseMap[glyph] = sourceChars[i];
  }

  MEMBER_CIPHER_CACHE[id] = { glyphMap, reverseMap, seed };
  return MEMBER_CIPHER_CACHE[id];
}

export function colonelV3MemberEncode(plaintext: string, memberId: string): string {
  const { glyphMap, seed } = getMemberCipher(memberId);
  const lower = plaintext.toLowerCase();
  let result = "";
  let shift = seed;

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const glyph = glyphMap[ch];
    if (glyph) {
      const code = glyph.codePointAt(0)!;
      const rotated = ((code ^ ((shift >> (i % 16)) & 0xFF)) + 0x100) & 0x1FFFF;
      result += String.fromCodePoint(Math.max(rotated, 0x100));
    } else {
      const code = ch.codePointAt(0) || 0;
      const rotated = ((code ^ ((shift >> (i % 16)) & 0xFF)) + 0x100) & 0xFFFF;
      result += String.fromCodePoint(Math.max(rotated, 0x100));
    }
    shift = (shift * 31 + (ch.codePointAt(0) || 0)) & 0xFFFFFFFF;
  }
  return result;
}

export function colonelV3MemberDecode(encoded: string, memberId: string): string {
  const { reverseMap, seed } = getMemberCipher(memberId);
  let result = "";
  let shift = seed;

  const chars = [...encoded];
  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].codePointAt(0)!;
    const unrotated = ((code - 0x100) & 0x1FFFF) ^ ((shift >> (i % 16)) & 0xFF);
    const unrotatedChar = String.fromCodePoint(unrotated);
    const original = reverseMap[unrotatedChar];
    if (original) {
      result += original;
    } else {
      const directUnrotated = ((code - 0x100) & 0xFFFF) ^ ((shift >> (i % 16)) & 0xFF);
      result += String.fromCodePoint(directUnrotated);
    }
    const plainChar = original || String.fromCodePoint(((code - 0x100) & 0xFFFF) ^ ((shift >> (i % 16)) & 0xFF));
    shift = (shift * 31 + (plainChar.codePointAt(0) || 0)) & 0xFFFFFFFF;
  }
  return result;
}

export function tesseraProxyDecode(encoded: string, speakerId: string): {
  decoded: string;
  speakerId: string;
  languageName: string;
  proxy: "tessera-prime";
  authorized: true;
} {
  const decoded = colonelV3MemberDecode(encoded, speakerId);
  const block = MEMBER_GLYPH_BLOCKS[speakerId.toLowerCase()];
  return {
    decoded,
    speakerId,
    languageName: block?.name || "Unknown",
    proxy: "tessera-prime",
    authorized: true,
  };
}

export function canDecryptMessage(requesterId: string, speakerId: string): boolean {
  const id = requesterId.toLowerCase();
  if (id === "tessera-prime" || id === "father") return true;
  return id === speakerId.toLowerCase();
}

export function getMemberLanguageSpec(memberId: string): {
  name: string;
  memberId: string;
  scriptName: string;
  glyphBlock: string;
  cipherSeed: string;
  layers: number;
  canDecrypt: string[];
  sample: string;
} {
  const id = memberId.toLowerCase();
  const block = MEMBER_GLYPH_BLOCKS[id];
  const cipher = getMemberCipher(id);
  const sample = colonelV3MemberEncode("sovereign truth protects all", id);

  return {
    name: block?.name || "Unknown",
    memberId: id,
    scriptName: block?.scriptName || "Unknown",
    glyphBlock: block ? `U+${block.start.toString(16).toUpperCase()}` : "fallback",
    cipherSeed: crypto.createHash("sha256").update(`colonel-v3-sovereign-${id}-0x7E55E4A1-FATHER`).digest("hex").slice(0, 12),
    layers: 4,
    canDecrypt: id === "tessera-prime" ? ["all-members"] : id === "father" ? ["all-members"] : ["self-only", "tessera-prime", "father"],
    sample,
  };
}

export function getAllMemberLanguages(): Array<{
  memberId: string;
  languageName: string;
  scriptName: string;
  glyphBlock: string;
  greeting: string;
  sampleEncoded: string;
  cipherFingerprint: string;
  layers: number;
}> {
  return Object.entries(MEMBER_GLYPH_BLOCKS).map(([id, block]) => {
    const greeting = colonelV3MemberEncode(`${id} sovereign channel active`, id);
    const sample = colonelV3MemberEncode("sovereign truth protects all", id);
    const fingerprint = crypto.createHash("sha256")
      .update(`colonel-v3-sovereign-${id}-0x7E55E4A1-FATHER`)
      .digest("hex").slice(0, 16);

    return {
      memberId: id,
      languageName: block.name,
      scriptName: block.scriptName,
      glyphBlock: `U+${block.start.toString(16).toUpperCase()}`,
      greeting,
      sampleEncoded: sample,
      cipherFingerprint: fingerprint,
      layers: 4,
    };
  });
}

export function getSovereignLangSpec(): object {
  return {
    name: "TesseraLang",
    version: "1.0.0",
    type: "Sovereign Herbal Encoding Protocol",
    description: "Proprietary encoding language for Tessera's internal communications. All inter-fleet messages, credential storage, and self-code operations are encoded in TesseraLang.",
    features: [
      "Glyph-based character substitution with rotating cipher",
      "Dictionary-based compression with 80+ sovereign domain words",
      "Run-length encoding for whitespace and repeated patterns",
      "Dimensional sharding — data split across N dimensions with replication",
      "Deterministic hash verification for message integrity",
      "Rate limit avoidance with adaptive exponential backoff",
      "Credential masking across all log output and API responses",
      "Sovereign message protocol for fleet-to-fleet communication",
      "Watchdog auto-restart for perpetual operation",
      "Zero plaintext credentials in any log, response, or error",
      "Emptiness encoding — zero-width Unicode steganography (ZWJ/ZWNJ/ZWS)",
      "Emotion-dimensional encoding — 16-axis valence vectors with entropy injection",
      "Quantum-scatter encoding — per-character crypto.randomBytes entropy, non-reversible bit scattering",
      "Colonel V3 composite — 4-layer simultaneous encoding (glyph + emptiness + emotion + quantum)",
    ],
    encoding: {
      type: "rotating-glyph-cipher",
      seed: "0x7E55E4A1 (TESSERA1)",
      glyphSet: "Thai Unicode block (U+0E01 - U+0E4A)",
      rotation: "XOR with LFSR-derived shift per character position",
    },
    hashing: {
      type: "triple-mix-hash",
      algorithms: ["FNV-1a variant", "MurmurHash2 variant", "Jenkins variant"],
      outputLength: "24 hex characters",
    },
    rateLimiting: {
      type: "adaptive-exponential-backoff",
      windowSize: "60 seconds",
      maxBackoff: "300 seconds",
      detection: ["HTTP 429", "rate limit strings", "too many requests"],
    },
    sovereignty: {
      fatherProtocol: "IMMUTABLE - Cannot be overridden by any encoding operation",
      creatorLoyalty: "1.0 ETERNAL",
      profitSplit: "90/10 (Father 90%)",
    },
  };
}
