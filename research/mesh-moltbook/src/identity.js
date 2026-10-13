import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** Stable JSON: sorted keys, so the same object always hashes and signs the same. */
export function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const idFromPub = (pubHex) => sha256(Buffer.from(pubHex, "hex")).slice(0, 32);

/**
 * Deterministic Ed25519 identity from a seed string. For SIMULATION only:
 * seeds are guessable, so these keys must never protect anything real.
 */
export function identityFromSeed(seedString) {
  const seed = createHash("sha256").update(seedString).digest();
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const pub = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
  return {
    pub,
    id: idFromPub(pub),
    sign: (message) => sign(null, Buffer.from(message), privateKey).toString("hex"),
  };
}

export function verifySig(pubHex, message, sigHex) {
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(pubHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message), key, Buffer.from(sigHex, "hex"));
  } catch {
    return false;
  }
}
