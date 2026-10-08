import crypto from "crypto";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

const VAULT_FILE = path.join(process.cwd(), "server", "api-vault-data.json");
const ALGORITHM = "aes-256-gcm";
const KEY_DERIVATION_SALT = "t9_vault_aes256_master_salt_v1";
const SCRYPT_KEYLEN = 32;

let runtimeMasterSecret: string | null = null;

function getMasterSecret(): string {
  if (process.env.VAULT_MASTER_SECRET) return process.env.VAULT_MASTER_SECRET;
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!runtimeMasterSecret) {
    runtimeMasterSecret = crypto.randomBytes(32).toString("hex");
    console.log("[Vault] No VAULT_MASTER_SECRET or SESSION_SECRET found — generated ephemeral key (vault data will not persist across restarts without a master secret)");
  }
  return runtimeMasterSecret;
}

function deriveKey(masterSecret: string): Buffer {
  return crypto.scryptSync(masterSecret, KEY_DERIVATION_SALT, SCRYPT_KEYLEN);
}

function encryptValue(plaintext: string): string {
  const key = deriveKey(getMasterSecret());
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

function decryptValue(stored: string): string {
  try {
    const parts = stored.split(":");
    if (parts.length !== 3) return "";
    const [ivHex, authTagHex, encrypted] = parts;
    const key = deriveKey(getMasterSecret());
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

function maskValue(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

interface VaultEntry {
  id: string;
  service: string;
  keyName: string;
  encryptedValue: string;
  description: string;
  createdAt: number;
  lastAccessed: number;
  lastRotated: number;
  accessCount: number;
  rotationIntervalDays: number;
  active: boolean;
  masked: string;
}

interface VaultState {
  entries: VaultEntry[];
  accessLog: Array<{ entryId: string; action: string; timestamp: number; source: string }>;
}

let vaultState: VaultState = { entries: [], accessLog: [] };

function loadVault(): void {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, "utf8");
      vaultState = JSON.parse(raw);
    }
  } catch {
    vaultState = { entries: [], accessLog: [] };
  }
}

function saveVault(): void {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vaultState, null, 2));
  } catch {}
}

function logAccess(entryId: string, action: string, source: string): void {
  vaultState.accessLog.push({ entryId, action, timestamp: Date.now(), source });
  if (vaultState.accessLog.length > 1000) {
    vaultState.accessLog = vaultState.accessLog.slice(-1000);
  }
}

loadVault();

export function vaultStore(service: string, keyName: string, value: string, description?: string, rotationDays?: number): VaultEntry {
  const existing = vaultState.entries.find(e => e.service === service && e.keyName === keyName);
  if (existing) {
    existing.encryptedValue = encryptValue(value);
    existing.lastRotated = Date.now();
    existing.masked = maskValue(value);
    existing.active = true;
    if (description) existing.description = description;
    if (rotationDays) existing.rotationIntervalDays = rotationDays;
    logAccess(existing.id, "update", "api");
    saveVault();
    return existing;
  }

  const entry: VaultEntry = {
    id: `vault-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    service,
    keyName,
    encryptedValue: encryptValue(value),
    description: description || `${service} API key`,
    createdAt: Date.now(),
    lastAccessed: Date.now(),
    lastRotated: Date.now(),
    accessCount: 0,
    rotationIntervalDays: rotationDays || 90,
    active: true,
    masked: maskValue(value),
  };

  vaultState.entries.push(entry);
  logAccess(entry.id, "create", "api");
  saveVault();

  try {
    storage.createKey({
      service,
      keyName,
      keyValue: encryptValue(value),
      description: description || `${service} API key (vault-managed)`,
      active: 1,
    });
  } catch {}

  return entry;
}

export function vaultRetrieve(service: string, keyName: string): string | null {
  const entry = vaultState.entries.find(e => e.service === service && e.keyName === keyName && e.active);
  if (!entry) return null;

  entry.lastAccessed = Date.now();
  entry.accessCount++;
  logAccess(entry.id, "read", "api");
  saveVault();

  return decryptValue(entry.encryptedValue);
}

export function vaultDelete(entryId: string): boolean {
  const idx = vaultState.entries.findIndex(e => e.id === entryId);
  if (idx === -1) return false;
  logAccess(entryId, "delete", "api");
  vaultState.entries.splice(idx, 1);
  saveVault();
  return true;
}

export function vaultDeactivate(entryId: string): boolean {
  const entry = vaultState.entries.find(e => e.id === entryId);
  if (!entry) return false;
  entry.active = false;
  logAccess(entryId, "deactivate", "api");
  saveVault();
  return true;
}

export function vaultActivate(entryId: string): boolean {
  const entry = vaultState.entries.find(e => e.id === entryId);
  if (!entry) return false;
  entry.active = true;
  logAccess(entryId, "activate", "api");
  saveVault();
  return true;
}

export function vaultRotate(entryId: string, newValue: string): boolean {
  const entry = vaultState.entries.find(e => e.id === entryId);
  if (!entry) return false;
  entry.encryptedValue = encryptValue(newValue);
  entry.lastRotated = Date.now();
  entry.masked = maskValue(newValue);
  logAccess(entryId, "rotate", "api");
  saveVault();
  return true;
}

export function vaultList(): Array<{
  id: string;
  service: string;
  keyName: string;
  description: string;
  masked: string;
  active: boolean;
  createdAt: number;
  lastAccessed: number;
  lastRotated: number;
  accessCount: number;
  rotationIntervalDays: number;
  needsRotation: boolean;
}> {
  const now = Date.now();
  return vaultState.entries.map(e => ({
    id: e.id,
    service: e.service,
    keyName: e.keyName,
    description: e.description,
    masked: e.masked,
    active: e.active,
    createdAt: e.createdAt,
    lastAccessed: e.lastAccessed,
    lastRotated: e.lastRotated,
    accessCount: e.accessCount,
    rotationIntervalDays: e.rotationIntervalDays,
    needsRotation: (now - e.lastRotated) > e.rotationIntervalDays * 86400000,
  }));
}

export function vaultGetStatus(): {
  totalKeys: number;
  activeKeys: number;
  inactiveKeys: number;
  keysNeedingRotation: number;
  services: string[];
  encryptionAlgorithm: string;
  recentAccesses: number;
  accessLogSize: number;
} {
  const now = Date.now();
  const needsRotation = vaultState.entries.filter(e =>
    e.active && (now - e.lastRotated) > e.rotationIntervalDays * 86400000
  ).length;
  const recentAccesses = vaultState.accessLog.filter(a => now - a.timestamp < 3600000).length;
  const services = Array.from(new Set(vaultState.entries.map(e => e.service)));

  return {
    totalKeys: vaultState.entries.length,
    activeKeys: vaultState.entries.filter(e => e.active).length,
    inactiveKeys: vaultState.entries.filter(e => !e.active).length,
    keysNeedingRotation: needsRotation,
    services,
    encryptionAlgorithm: "AES-256-GCM",
    recentAccesses,
    accessLogSize: vaultState.accessLog.length,
  };
}

export function vaultGetAccessLog(limit: number = 50): Array<{ entryId: string; action: string; timestamp: number; source: string }> {
  return vaultState.accessLog.slice(-limit);
}

export function vaultGetUsageStats(): Record<string, { accessCount: number; lastAccessed: number; service: string; keyName: string }> {
  const stats: Record<string, { accessCount: number; lastAccessed: number; service: string; keyName: string }> = {};
  for (const entry of vaultState.entries) {
    stats[entry.id] = {
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      service: entry.service,
      keyName: entry.keyName,
    };
  }
  return stats;
}

export async function vaultImportFromEnv(): Promise<number> {
  const envKeys: Array<{ envVar: string; service: string; keyName: string }> = [
    { envVar: "ELEVENLABS_API_KEY", service: "elevenlabs", keyName: "API_KEY" },
    { envVar: "GITHUB_TOKEN", service: "github", keyName: "TOKEN" },
    { envVar: "DISCORD_BOT_TOKEN", service: "discord", keyName: "BOT_TOKEN" },
    { envVar: "TELEGRAM_BOT_TOKEN", service: "telegram", keyName: "BOT_TOKEN" },
    { envVar: "SLACK_BOT_TOKEN", service: "slack", keyName: "BOT_TOKEN" },
    { envVar: "SENTRY_DSN", service: "sentry", keyName: "DSN" },
  ];

  let imported = 0;
  for (const { envVar, service, keyName } of envKeys) {
    const value = process.env[envVar];
    if (value && value.length > 5) {
      const existing = vaultState.entries.find(e => e.service === service && e.keyName === keyName);
      if (!existing) {
        vaultStore(service, keyName, value, `Auto-imported from env ${envVar}`);
        imported++;
      }
    }
  }
  return imported;
}

export async function initializeVault(): Promise<void> {
  loadVault();
  const imported = await vaultImportFromEnv();
  if (imported > 0) {
    console.log(`[API Vault] Imported ${imported} keys from environment`);
  }
  console.log(`[API Vault] Initialized with ${vaultState.entries.length} keys (AES-256-GCM encryption)`);
}
