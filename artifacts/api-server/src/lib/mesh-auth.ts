import { createHash, timingSafeEqual } from "crypto";
import { canonicalAdminCode } from "./lingua-universalis";
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
 * Plain sha256 hex of a token being minted or bound.
 * Does not authenticate and does not compare against the admin key.
 * Returns null for missing, short, or unhashable values. Never logs the token.
 */
export function hashTokenSha256(token: string | undefined | null): string | null {
  try {
    if (typeof token !== "string") return null;
    const presented = token.trim();
    if (presented.length < MIN_TOKEN_LENGTH) return null;
    return sha256(presented).toString("hex");
  } catch {
    return null;
  }
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
  const a = Buffer.from(canonicalAdminCode(token));
  const b = Buffer.from(canonicalAdminCode(configured));
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
