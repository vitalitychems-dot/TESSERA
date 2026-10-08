import crypto from "crypto";

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
