const credentialPatterns = [
  /\b(?:TESSERACT_ADMIN_KEY|SIGIL_ADMIN_KEY|API[_ -]?KEY|PRIVATE[_ -]?KEY|SECRET(?:[_ -]?KEY)?|ACCESS[_ -]?TOKEN|BEARER[_ -]?TOKEN|PASSWORD)\s*[:=]\s*["']?[^\s"',;]{8,}/i,
  /\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|xox[baprs]-|shpat_|AKIA|ASIA)[A-Za-z0-9_-]{12,}\b/,
  /\b0x[a-f0-9]{64}\b/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const bareSecretPattern = /\b[A-Za-z0-9_-]{24,}\b/;
const configuredSecretNames = [
  "TESSERACT_ADMIN_KEY",
  "SIGIL_ADMIN_KEY",
  "SOVEREIGN_SESSION_SECRET",
  "TESSERA_LLM_API_KEY",
];

/** High-confidence detector used before messages are stored, logged, or forwarded. */
export function containsCredentialMaterial(text: string): boolean {
  if (credentialPatterns.some((pattern) => pattern.test(text))) return true;
  if (configuredSecretNames.some((name) => {
    const secret = process.env[name];
    return typeof secret === "string" && secret.length >= 8 && text.includes(secret);
  })) return true;
  const withoutPublicAddresses = text.replace(/\b0x[a-f0-9]{40}\b/gi, "");
  return bareSecretPattern.test(withoutPublicAddresses);
}

/** Removes credential-bearing legacy text without returning or logging its contents. */
export function redactCredentialMaterial(text: string): string {
  return containsCredentialMaterial(text)
    ? "[redacted credential-bearing historical message]"
    : text;
}
