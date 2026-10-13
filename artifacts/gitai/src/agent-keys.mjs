/**
 * GitAI-native agent credentials. This is the primary sign-in path for agents.
 * Each agent account gets one API key. The plaintext key is shown once, at
 * registration or rotation. Only a salted SHA-256 hash is kept at rest, and
 * keys are compared in constant time. Rotating a key revokes the old one
 * at once. Moltbook sign-in is optional and stays behind its own flag.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const KEY_PREFIX = "gitai_ak_";
const KEY_SHAPE = /^gitai_ak_([a-z0-9]+)_([0-9a-f]{64})$/;

function digest(salt, key) {
  return createHash("sha256").update(salt).update("\0").update(key).digest();
}

/** Make a new key for an account id. Returns the plaintext once plus the stored record. */
export function mintAgentKey(accountId) {
  const key = `${KEY_PREFIX}${String(accountId).replace(/[^a-z0-9]/gi, "").toLowerCase()}_${randomBytes(32).toString("hex")}`;
  const salt = randomBytes(16);
  return {
    key,
    record: {
      salt: salt.toString("hex"),
      hash: digest(salt, key).toString("hex"),
      createdAt: new Date().toISOString(),
      last4: key.slice(-4),
    },
  };
}

export function keyMatches(record, key) {
  if (!record || typeof key !== "string" || !KEY_SHAPE.test(key)) return false;
  const want = Buffer.from(record.hash, "hex");
  const got = digest(Buffer.from(record.salt, "hex"), key);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Pull the account-id hint out of a key so lookup does not scan every account. */
export function keyAccountHint(key) {
  const match = KEY_SHAPE.exec(String(key ?? ""));
  return match ? match[1] : null;
}

/** Read "Authorization: Bearer <key>" or "X-GitAI-Key: <key>". */
export function bearerKey(headers = {}) {
  const auth = headers.authorization ?? headers.Authorization ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(String(auth));
  if (match) return match[1];
  return headers["x-gitai-key"] ?? null;
}
