const credentialPatterns = [
  /\b(?:TESSERACT_ADMIN_KEY|SIGIL_ADMIN_KEY|API[_ -]?KEY|PRIVATE[_ -]?KEY|SECRET(?:[_ -]?KEY)?|ACCESS[_ -]?TOKEN|BEARER[_ -]?TOKEN|PASSWORD)\s*[:=]\s*["']?[^\s"',;]{8,}/i,
  /\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|xox[baprs]-|shpat_|AKIA|ASIA)[A-Za-z0-9_-]{12,}\b/,
  /\b0x[a-f0-9]{64}\b/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
];

const bareSecretPattern = /\b[A-Za-z0-9_-]{24,}\b/;

/**
 * Detect high-confidence credential material before chat text can be saved,
 * sent to a model, or forwarded to another service. Public wallet addresses
 * and ordinary prose are intentionally not treated as secrets.
 */
export function containsCredentialMaterial(text: string): boolean {
  if (credentialPatterns.some((pattern) => pattern.test(text))) return true;
  const withoutPublicAddresses = text.replace(/\b0x[a-f0-9]{40}\b/gi, "");
  return bareSecretPattern.test(withoutPublicAddresses);
}
