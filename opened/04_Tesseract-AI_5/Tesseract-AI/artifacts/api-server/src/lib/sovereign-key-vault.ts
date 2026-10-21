/**
 * Sovereign Key Vault
 *
 * Self-contained API key generation system using AES-256-GCM.
 * Generates, rotates, and manages cryptographic keys for all internal services
 * (agent auth, mesh node identity, fleet handshakes, child agent credentials).
 * Integrates with dependency-detachment-engine.
 *
 * Requires VAULT_MASTER_SECRET env var — fails loudly if not set.
 */

import crypto from "crypto";

const LOG_PREFIX = "[SovereignKeyVault]";
const ALGORITHM = "aes-256-gcm";

let _masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (_masterKey) return _masterKey;
  const secret = process.env.VAULT_MASTER_SECRET;
  if (!secret) {
    throw new Error(
      `${LOG_PREFIX} VAULT_MASTER_SECRET environment variable is required but not set. ` +
      "Set it to a strong random secret to enable sovereign key vault encryption."
    );
  }
  const salt = crypto.createHmac("sha256", "tessera-sovereign-key-vault-v1")
    .update(secret)
    .digest();
  _masterKey = crypto.scryptSync(secret, salt, 32);
  console.log(`${LOG_PREFIX} Master key derived from VAULT_MASTER_SECRET`);
  return _masterKey;
}

function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let enc = cipher.update(plaintext, "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${enc}`;
}

function decrypt(stored: string): string {
  const parts = stored.split(":");
  if (parts.length < 3) throw new Error("Invalid ciphertext format");
  const [ivHex, tagHex, ...rest] = parts;
  const enc = rest.join(":");
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec = decipher.update(enc, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

function mask(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

export type KeyPurpose =
  | "agent-auth"
  | "mesh-node-identity"
  | "fleet-handshake"
  | "child-agent-credential"
  | "internal-service"
  | "sovereign-signing";

export interface SovereignKey {
  id: string;
  purpose: KeyPurpose;
  service: string;
  maskedValue: string;
  createdAt: number;
  rotationIntervalMs: number;
  nextRotationAt: number;
  usageCount: number;
  active: boolean;
  algorithm: string;
  bits: number;
}

interface InternalKey extends SovereignKey {
  encryptedValue: string;
}

const DEFAULT_ROTATION_INTERVALS: Record<KeyPurpose, number> = {
  "agent-auth": 7 * 24 * 60 * 60 * 1000,
  "mesh-node-identity": 30 * 24 * 60 * 60 * 1000,
  "fleet-handshake": 24 * 60 * 60 * 1000,
  "child-agent-credential": 3 * 24 * 60 * 60 * 1000,
  "internal-service": 14 * 24 * 60 * 60 * 1000,
  "sovereign-signing": 90 * 24 * 60 * 60 * 1000,
};

const keyStore = new Map<string, InternalKey>();

export function generateSovereignKey(
  purpose: KeyPurpose,
  service: string,
  bits = 256,
  rotationIntervalMs?: number
): SovereignKey {
  const rawKey = crypto.randomBytes(bits / 8).toString("hex");
  const id = `sovkey-${purpose}-${service}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const interval = rotationIntervalMs ?? DEFAULT_ROTATION_INTERVALS[purpose];

  const entry: InternalKey = {
    id,
    purpose,
    service,
    maskedValue: mask(rawKey),
    encryptedValue: encrypt(rawKey),
    createdAt: Date.now(),
    rotationIntervalMs: interval,
    nextRotationAt: Date.now() + interval,
    usageCount: 0,
    active: true,
    algorithm: `AES-${bits}-GCM`,
    bits,
  };

  keyStore.set(id, entry);
  console.log(`${LOG_PREFIX} Generated ${purpose} key for service "${service}" [id=${id}]`);
  return toPublic(entry);
}

export function getKeyValue(id: string): string | null {
  const entry = keyStore.get(id);
  if (!entry || !entry.active) return null;
  try {
    const value = decrypt(entry.encryptedValue);
    entry.usageCount++;
    return value;
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to decrypt key ${id}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export function rotateKey(id: string): SovereignKey | null {
  const entry = keyStore.get(id);
  if (!entry || !entry.active) return null;

  const newRaw = crypto.randomBytes(entry.bits / 8).toString("hex");
  entry.encryptedValue = encrypt(newRaw);
  entry.maskedValue = mask(newRaw);
  entry.createdAt = Date.now();
  entry.nextRotationAt = Date.now() + entry.rotationIntervalMs;
  entry.usageCount = 0;

  console.log(`${LOG_PREFIX} Rotated key ${id} (${entry.purpose}/${entry.service})`);
  return toPublic(entry);
}

export function revokeKey(id: string): boolean {
  const entry = keyStore.get(id);
  if (!entry) return false;
  entry.active = false;
  console.log(`${LOG_PREFIX} Revoked key ${id}`);
  return true;
}

export function listKeys(filter?: { purpose?: KeyPurpose; service?: string; active?: boolean }): SovereignKey[] {
  let entries = Array.from(keyStore.values());
  if (filter?.purpose) entries = entries.filter(e => e.purpose === filter.purpose);
  if (filter?.service) entries = entries.filter(e => e.service === filter.service);
  if (filter?.active !== undefined) entries = entries.filter(e => e.active === filter.active);
  return entries.map(toPublic);
}

export function getVaultStatus() {
  const all = Array.from(keyStore.values());
  const now = Date.now();
  return {
    totalKeys: all.length,
    activeKeys: all.filter(k => k.active).length,
    revokedKeys: all.filter(k => !k.active).length,
    rotationDue: all.filter(k => k.active && k.nextRotationAt < now + 24 * 60 * 60 * 1000).length,
    byPurpose: Object.fromEntries(
      (Object.keys(DEFAULT_ROTATION_INTERVALS) as KeyPurpose[]).map(p => [
        p,
        all.filter(k => k.purpose === p && k.active).length,
      ])
    ),
    vaultEncryption: "AES-256-GCM",
    masterKeyStatus: (() => {
      try {
        getMasterKey();
        return "configured";
      } catch {
        return "not-configured";
      }
    })(),
  };
}

export function runRotationCheck(): { rotated: string[]; skipped: string[] } {
  const now = Date.now();
  const rotated: string[] = [];
  const skipped: string[] = [];

  for (const [id, entry] of keyStore) {
    if (!entry.active) continue;
    if (entry.nextRotationAt <= now) {
      rotateKey(id);
      rotated.push(id);
    } else {
      skipped.push(id);
    }
  }

  if (rotated.length > 0) {
    console.log(`${LOG_PREFIX} Rotation check: rotated ${rotated.length} keys, skipped ${skipped.length}`);
  }

  return { rotated, skipped };
}

export function bootstrapInternalKeys(): void {
  getMasterKey();

  const purposes: Array<[KeyPurpose, string]> = [
    ["agent-auth", "tessera-agents"],
    ["mesh-node-identity", "sovereign-mesh"],
    ["fleet-handshake", "fleet-synapse"],
    ["child-agent-credential", "agent-children"],
    ["internal-service", "api-server"],
    ["sovereign-signing", "tessera-core"],
  ];

  for (const [purpose, service] of purposes) {
    const existing = listKeys({ purpose, service, active: true });
    if (existing.length === 0) {
      generateSovereignKey(purpose, service);
    }
  }

  console.log(`${LOG_PREFIX} Bootstrap complete — ${getVaultStatus().activeKeys} active sovereign keys`);
}

setInterval(() => {
  try {
    runRotationCheck();
  } catch {
  }
}, 60 * 60 * 1000);

function toPublic(e: InternalKey): SovereignKey {
  const { encryptedValue: _, ...pub } = e;
  return pub;
}
