import { createHash, timingSafeEqual } from "crypto";
import { isAdminTokenConfigured } from "./sovereign-session";

const MIN_TOKEN_LENGTH = 8;
const CONFIGURED_KEY_MIN_LENGTH = 16;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Trimmed TESSERACT_ADMIN_KEY, or null when owner auth is not configured. */
function readConfiguredKey(): string | null {
  if (!isAdminTokenConfigured()) return null;
  const configured = (process.env["TESSERACT_ADMIN_KEY"] ?? "").trim();
  if (configured.length < CONFIGURED_KEY_MIN_LENGTH) return null;
  return configured;
}

/**
 * Accepts only the configured admin key.
 * Compares sha256(token) to sha256(key) with timingSafeEqual (equal-length digests).
 * Returns the hex digest on match. Unset, short, wrong, or thrown checks return null.
 * Never logs the token or the key.
 */
export function validateMeshToken(token: string | undefined | null): string | null {
  try {
    const key = readConfiguredKey();
    if (!key) return null;
    if (typeof token !== "string") return null;
    const presented = token.trim();
    if (presented.length < MIN_TOKEN_LENGTH) return null;
    const presentedHash = sha256(presented);
    const keyHash = sha256(key);
    if (presentedHash.length !== keyHash.length) return null;
    if (!timingSafeEqual(presentedHash, keyHash)) return null;
    return presentedHash.toString("hex");
  } catch {
    return null;
  }
}

/** Hex sha256 of the configured admin key, or null when auth is not configured. */
export function configuredMeshKeyHash(): string | null {
  try {
    const key = readConfiguredKey();
    if (!key) return null;
    return sha256(key).toString("hex");
  } catch {
    return null;
  }
}

/**
 * Strict admin-token validator for privileged operations.
 * Requires process.env.TESSERACT_ADMIN_KEY to be set and to match the provided
 * token via constant-time comparison. Returns false if the env var is unset —
 * privileged endpoints MUST refuse to operate without an explicit configured secret.
 */
export function validateSovereignAdminToken(token: string | undefined | null): boolean {
  const configured = process.env["TESSERACT_ADMIN_KEY"];
  if (!configured || configured.length < MIN_TOKEN_LENGTH) return false;
  if (!token || typeof token !== "string") return false;
  const a = Buffer.from(token.trim());
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
