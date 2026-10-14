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
