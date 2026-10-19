import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logSessionSecretPresence } from "../app";
import { logger } from "../lib/logger";

const ADMIN_KEY = "synthetic-session-attest-key";
const SESSION_SECRET = "synthetic-session-secret-value-32ch";
const ATTESTATION = "sovereign-session: session secret presence";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertNoSecretMaterial(haystack: string, secret: string): void {
  expect(haystack.includes(secret)).toBe(false);
  const digest = sha256Hex(secret);
  for (let length = 4; length <= digest.length; length += 1) {
    expect(haystack.includes(digest.slice(0, length))).toBe(false);
  }
}

const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;
const previousSessionSecret = process.env.SOVEREIGN_SESSION_SECRET;
const previousNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (previousAdminKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousAdminKey;
  if (previousSessionSecret === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
  else process.env.SOVEREIGN_SESSION_SECRET = previousSessionSecret;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

describe("session secret startup log", () => {
  it("logs presence when the session secret falls back to the admin key", () => {
    process.env.NODE_ENV = "test";
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    delete process.env.SOVEREIGN_SESSION_SECRET;
    const spy = vi.spyOn(logger, "info");
    try {
      logSessionSecretPresence();
      const output = JSON.stringify(spy.mock.calls);
      expect(output.includes(ATTESTATION)).toBe(true);
      expect(output.includes("\"configured\":true")).toBe(true);
      expect(output.includes("secretFingerprint")).toBe(false);
      assertNoSecretMaterial(output, ADMIN_KEY);
    } finally {
      spy.mockRestore();
    }
  });

  it("logs presence for a dedicated session secret without a digest", () => {
    process.env.NODE_ENV = "test";
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.SOVEREIGN_SESSION_SECRET = SESSION_SECRET;
    const spy = vi.spyOn(logger, "info");
    try {
      logSessionSecretPresence();
      const output = JSON.stringify(spy.mock.calls);
      expect(output.includes(ATTESTATION)).toBe(true);
      expect(output.includes("\"configured\":true")).toBe(true);
      expect(output.includes("secretFingerprint")).toBe(false);
      assertNoSecretMaterial(output, ADMIN_KEY);
      assertNoSecretMaterial(output, SESSION_SECRET);
    } finally {
      spy.mockRestore();
    }
  });
});
