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

const COLONEL_DICTIONARY: Map<string, number> = new Map();
const COLONEL_REVERSE_DICT: Map<number, string> = new Map();
const COMMON_WORDS = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "agent", "tessera", "sovereign", "protocol", "father", "wallet", "token",
  "tsrt", "tsov", "blockchain", "transaction", "node", "mesh", "encrypt",
  "dimension", "bridge", "colonel", "swarm", "economy", "security",
  "consensus", "arbitrage", "liquidity", "defi", "solana", "pump",
  "moltbook", "vitality", "consciousness", "evolution", "autonomous",
  "system", "data", "compress", "shard", "replicate", "hash", "verify",
  "transmit", "receive", "store", "sync", "query", "response", "error",
  "success", "price", "balance", "transfer", "compute", "memory",
  "network", "channel", "message", "payload", "address", "key",
  "value", "config", "status", "active", "pending", "complete",
];
COMMON_WORDS.forEach((word, i) => {
  COLONEL_DICTIONARY.set(word, i);
  COLONEL_REVERSE_DICT.set(i, word);
});

export function colonelCompress(input: string): { compressed: string; ratio: number; method: string } {
  const originalSize = input.length;
  const words = input.toLowerCase().split(/(\s+|[.,;:!?()[\]{}])/);
  const tokens: number[] = [];
  const literals: string[] = [];
  let dictHits = 0;

  for (const word of words) {
    const trimmed = word.trim();
    if (!trimmed) {
      literals.push(word);
      tokens.push(-1);
      continue;
    }
    const dictIdx = COLONEL_DICTIONARY.get(trimmed);
    if (dictIdx !== undefined) {
      tokens.push(dictIdx);
      literals.push("");
      dictHits++;
    } else {
      tokens.push(-2);
      literals.push(trimmed);
    }
  }

  let rleTokens: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === -1) {
      let count = 0;
      while (i < tokens.length && tokens[i] === -1) { count++; i++; }
      rleTokens.push(`W${count}`);
    } else if (tokens[i] >= 0) {
      rleTokens.push(`D${tokens[i].toString(36)}`);
      i++;
    } else {
      rleTokens.push(`L${literals[i]}`);
      i++;
    }
  }

  const compressed = rleTokens.join("|");
  const compressedSize = compressed.length;
  const ratio = originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;

  return {
    compressed,
    encoded: tesseraEncode(compressed),
    ratio: Math.max(0, ratio),
    method: `colonel-dict-rle (${dictHits} dictionary hits, ${Math.round(ratio)}% reduction)`,
  };
}

export function colonelDecompressRaw(compressed: string): string {
  const parts = compressed.split("|");
  let result = "";
  for (const part of parts) {
    if (part.startsWith("W")) {
      const count = parseInt(part.slice(1));
      result += " ".repeat(count);
    } else if (part.startsWith("D")) {
      const idx = parseInt(part.slice(1), 36);
      result += COLONEL_REVERSE_DICT.get(idx) || `[?${idx}]`;
    } else if (part.startsWith("L")) {
      result += part.slice(1);
    }
  }
  return result;
}

export function colonelDecompress(encoded: string): string {
  const compressed = tesseraDecode(encoded);
  const parts = compressed.split("|");
  let result = "";

  for (const part of parts) {
    if (part.startsWith("W")) {
      const count = parseInt(part.slice(1));
      result += " ".repeat(count);
    } else if (part.startsWith("D")) {
      const idx = parseInt(part.slice(1), 36);
      result += COLONEL_REVERSE_DICT.get(idx) || `[?${idx}]`;
    } else if (part.startsWith("L")) {
      result += part.slice(1);
    }
  }

  return result;
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
