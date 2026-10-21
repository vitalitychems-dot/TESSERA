import { describe, expect, it } from "vitest";
import { containsCredentialMaterial, redactCredentialMaterial } from "../lib/credential-guard";

describe("credential guard", () => {
  it("blocks labeled admin keys, provider tokens, and private-key material", () => {
    expect(containsCredentialMaterial("TESSERACT_ADMIN_KEY=long-secret-value-123" )).toBe(true);
    expect(containsCredentialMaterial("ghp_abcdefghijklmnopqrstuvwxyz012345" )).toBe(true);
    expect(containsCredentialMaterial("-----BEGIN PRIVATE KEY-----" )).toBe(true);
  });

  it("matches configured secrets and redacts legacy credential-bearing history", () => {
    const prior = process.env.TESSERACT_ADMIN_KEY;
    const synthetic = "k7x9p2m4q6r8s1";
    process.env.TESSERACT_ADMIN_KEY = synthetic;
    try {
      expect(containsCredentialMaterial(`legacy message ${synthetic}`)).toBe(true);
      expect(redactCredentialMaterial(`legacy message ${synthetic}`)).toBe("[redacted credential-bearing historical message]");
    } finally {
      if (prior === undefined) delete process.env.TESSERACT_ADMIN_KEY;
      else process.env.TESSERACT_ADMIN_KEY = prior;
    }
  });

  it("allows ordinary prose and a public wallet address", () => {
    expect(containsCredentialMaterial("Please summarize the latest release notes." )).toBe(false);
    expect(containsCredentialMaterial("My public wallet address is 0x1234567890abcdef1234567890abcdef12345678" )).toBe(false);
  });
});
