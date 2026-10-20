const SECRET_PATTERNS: RegExp[] = [
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{10,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{10,}\b/g,
  /\bsk-[A-Za-z0-9]{10,}\b/g,
  /\bxox[bp]-[A-Za-z0-9-]{8,}/gi,
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s/]+:[^@\s/]+@\S+/gi,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\b(?:aws_secret_access_key|aws_access_key_id)\s*[:=]\s*\S+/gi,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  // Stripe secret / restricted keys and webhook signing secrets.
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}(?![A-Za-z0-9_])/g,
  /\bwhsec_[A-Za-z0-9]{32,}(?![A-Za-z0-9_])/g,
  // Sourcegraph access tokens: sgp_<40 hex> or sgp_<16 hex>_<40 hex>.
  /\bsgp_(?:[a-f0-9]{16}_)?[a-f0-9]{40}(?![A-Za-z0-9_])/g,
  // age secret keys: bech32 (uppercase) payload of 58 chars.
  /\bAGE-SECRET-KEY-1[QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L]{58}(?![A-Za-z0-9])/g,
  // Google API keys: AIza + exactly 35 chars.
  /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g,
  // Slack app-level and legacy workspace tokens.
  /\bxapp-\d+-[A-Z0-9]{8,}-\d+-[A-Za-z0-9]{16,}(?![A-Za-z0-9])/g,
  /\bxoxa-\d+-[A-Za-z0-9-]{10,}/g,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|passwd|authorization)\s*[:=]\s*\S+/gi,
];

/** Replace secret-shaped text before it is written. The store keeps the redacted form only. */
export function redactSecrets(value: string): string {
  let next = value;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "[REDACTED]");
  }
  return next;
}
