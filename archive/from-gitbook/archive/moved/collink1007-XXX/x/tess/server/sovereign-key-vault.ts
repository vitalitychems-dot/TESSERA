import crypto from "crypto";
import { logger } from "./logger";
import { broadcast } from "./ws-broadcast";
import type { Express, Request, Response, NextFunction } from "express";
import { vaultGet, vaultSet, vaultList, ensureVaultTable } from "./pg-key-vault";

const kvlog = (msg: string) => logger.info("SovKeyVault", msg);
const kvwarn = (msg: string) => logger.warn("SovKeyVault", msg);

export interface VaultEntry {
  id: string;
  service: string;
  keyName: string;
  maskedValue: string;
  description?: string;
  addedAt: number;
  lastUsedAt: number | null;
  usageCount: number;
  rotationDays: number;
  rotationDueAt: number;
  active: boolean;
  healthStatus: "healthy" | "rate-limited" | "invalid" | "unknown";
  lastHealthCheck: number | null;
  tags: string[];
}

interface InternalEntry extends VaultEntry {
  encryptedValue: string;
}

interface VaultHealth {
  totalKeys: number;
  activeKeys: number;
  rotationDue: number;
  rateLimited: number;
  invalid: number;
  healthy: number;
}

const ALGORITHM = "aes-256-gcm";

let vaultMap: Map<string, InternalEntry> = new Map();
let vaultInitialized = false;

let _cachedMasterKey: Buffer | null = null;

function deriveDynamicSalt(): Buffer {
  const secret = process.env.VAULT_MASTER_SECRET || process.env.SESSION_SECRET || "";
  return crypto.createHmac("sha256", "sovereign-vault-salt-derivation-v2")
    .update(secret)
    .update(Buffer.from(process.env.REPL_ID || process.env.HOSTNAME || "sovereign-node"))
    .digest();
}

function getMasterKey(): Buffer {
  if (_cachedMasterKey) return _cachedMasterKey;
  const secret = process.env.VAULT_MASTER_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SovereignKeyVault: No stable master secret configured. " +
      "Set VAULT_MASTER_SECRET or SESSION_SECRET environment variable."
    );
  }
  const dynamicSalt = deriveDynamicSalt();
  _cachedMasterKey = crypto.scryptSync(secret, dynamicSalt, 32);
  return _cachedMasterKey;
}

function encryptValue(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptValue(stored: string): string {
  try {
    const parts = stored.split(":");
    if (parts.length < 3) return "";
    const [ivHex, authTagHex, ...rest] = parts;
    const encrypted = rest.join(":");
    const key = getMasterKey();
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

function generateId(): string {
  return `kvault-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
}

const AI_PROVIDER_KEY_SPECS = [
  { service: "github", keyName: "GITHUB_TOKEN", description: "GitHub API token", rotationDays: 365, tags: ["dev"] },
  { service: "solana", keyName: "SOL_PRIVATE_KEY", description: "Solana wallet private key", rotationDays: 9999, tags: ["crypto", "wallet"] },
  { service: "discord", keyName: "DISCORD_BOT_TOKEN", description: "Discord bot token (optional output channel)", rotationDays: 365, tags: ["notification", "social"] },
  { service: "sendgrid", keyName: "SENDGRID_API_KEY", description: "SendGrid email API key", rotationDays: 365, tags: ["notification", "email"] },
  { service: "system", keyName: "SESSION_SECRET", description: "Session encryption secret", rotationDays: 365, tags: ["security"] },
];

export function initVault(): void {
  if (vaultInitialized) return;
  vaultInitialized = true;

  try {
    getMasterKey();
  } catch (err: any) {
    kvwarn(err?.message);
    kvwarn("Key vault encryption disabled — set SESSION_SECRET or VAULT_MASTER_SECRET to enable");
    return;
  }

  for (const spec of AI_PROVIDER_KEY_SPECS) {
    const envValue = process.env[spec.keyName]?.trim();
    if (envValue) {
      try {
        registerKey(spec.service, spec.keyName, envValue, spec.description, spec.rotationDays, spec.tags);
      } catch (err: any) {
        kvwarn(`Failed to register key ${spec.keyName}: ${err?.message}`);
      }
    }
  }

  kvlog(`Vault pre-loaded — ${vaultMap.size} keys from environment (master key stable)`);

  ensureVaultTable().then(() => loadFromPostgres()).catch(() => {});
}

async function loadFromPostgres(): Promise<void> {
  try {
    const rows = await vaultList();
    let loaded = 0;
    let overridden = 0;
    for (const row of rows) {
      if (!row.active) continue;
      const mapKey = `${row.service}:${row.keyName}`;
      const spec = AI_PROVIDER_KEY_SPECS.find(s => s.service === row.service && s.keyName === row.keyName);
      const plaintext = await vaultGet(row.service, row.keyName, "vault-load");
      if (!plaintext) continue;
      const existing = vaultMap.get(mapKey);
      const entry: InternalEntry = {
        id: existing?.id || generateId(),
        service: row.service,
        keyName: row.keyName,
        encryptedValue: encryptValue(plaintext),
        maskedValue: maskValue(plaintext),
        description: row.description || existing?.description,
        addedAt: row.createdAt ? new Date(row.createdAt).getTime() : (existing?.addedAt || Date.now()),
        lastUsedAt: row.lastAccessedAt ? new Date(row.lastAccessedAt).getTime() : (existing?.lastUsedAt || null),
        usageCount: Math.max(row.accessCount || 0, existing?.usageCount || 0),
        rotationDays: spec?.rotationDays || existing?.rotationDays || 90,
        rotationDueAt: Date.now() + (spec?.rotationDays || existing?.rotationDays || 90) * 86400000,
        active: true,
        healthStatus: existing?.healthStatus || "unknown",
        lastHealthCheck: existing?.lastHealthCheck || null,
        tags: spec?.tags || existing?.tags || [],
      };
      if (existing) overridden++;
      else loaded++;
      vaultMap.set(mapKey, entry);
    }
    if (loaded > 0 || overridden > 0) {
      kvlog(`PostgreSQL vault loaded — ${loaded} new, ${overridden} overriding env (DB is authoritative)`);
    }
    await syncNewKeysToPostgres();
  } catch (err: any) {
    kvwarn(`Could not load from PostgreSQL vault: ${err?.message}`);
  }
}

async function syncNewKeysToPostgres(): Promise<void> {
  let synced = 0;
  for (const [, entry] of vaultMap) {
    try {
      const decrypted = decryptValue(entry.encryptedValue);
      if (!decrypted) continue;
      const existing = await vaultGet(entry.service, entry.keyName, "vault-sync");
      if (!existing) {
        await vaultSet(entry.service, entry.keyName, decrypted, entry.description, "vault-sync");
        synced++;
      }
    } catch {}
  }
  if (synced > 0) kvlog(`Persisted ${synced} new keys to PostgreSQL vault`);
}

export function registerKey(
  service: string,
  keyName: string,
  value: string,
  description?: string,
  rotationDays = 90,
  tags: string[] = []
): VaultEntry {
  const existingKey = `${service}:${keyName}`;
  const existing = vaultMap.get(existingKey);

  const entry: InternalEntry = {
    id: existing?.id || generateId(),
    service,
    keyName,
    encryptedValue: encryptValue(value),
    maskedValue: maskValue(value),
    description,
    addedAt: existing?.addedAt || Date.now(),
    lastUsedAt: existing?.lastUsedAt || null,
    usageCount: existing?.usageCount || 0,
    rotationDays,
    rotationDueAt: Date.now() + rotationDays * 86400000,
    active: true,
    healthStatus: "unknown",
    lastHealthCheck: null,
    tags,
  };

  vaultMap.set(existingKey, entry);
  if (!existing) {
    kvlog(`Registered key: ${service}/${keyName} (rotation: ${rotationDays}d)`);
  }

  vaultSet(service, keyName, value, description, "sovereign-key-vault").catch(() => {});

  return toPublicEntry(entry);
}

export function getKey(service: string, keyName: string, source = "unknown"): string | null {
  const entry = vaultMap.get(`${service}:${keyName}`);
  if (!entry || !entry.active) {
    const envVal = process.env[keyName]?.trim();
    return envVal || null;
  }

  entry.lastUsedAt = Date.now();
  entry.usageCount++;

  try {
    return decryptValue(entry.encryptedValue) || null;
  } catch {
    return process.env[keyName]?.trim() || null;
  }
}

export function getKeyByEnvName(envName: string): string | null {
  for (const [, entry] of vaultMap) {
    if (entry.keyName === envName && entry.active) {
      try {
        return decryptValue(entry.encryptedValue) || null;
      } catch {}
    }
  }
  return process.env[envName]?.trim() || null;
}

export function revokeKey(service: string, keyName: string): boolean {
  const entry = vaultMap.get(`${service}:${keyName}`);
  if (!entry) return false;
  entry.active = false;
  kvlog(`Key revoked: ${service}/${keyName}`);
  return true;
}

export function markKeyStatus(service: string, keyName: string, status: VaultEntry["healthStatus"]): void {
  const entry = vaultMap.get(`${service}:${keyName}`);
  if (entry) {
    entry.healthStatus = status;
    entry.lastHealthCheck = Date.now();
    if (status === "rate-limited" || status === "invalid") {
      kvwarn(`Key health degraded: ${service}/${keyName} — ${status}`);
    }
  }
}

function toPublicEntry(e: InternalEntry): VaultEntry {
  const { encryptedValue: _, ...pub } = e;
  return pub;
}

export function listKeys(filter?: { service?: string; active?: boolean; tags?: string[] }): VaultEntry[] {
  let entries = Array.from(vaultMap.values());
  if (filter?.service) entries = entries.filter(e => e.service === filter.service);
  if (filter?.active !== undefined) entries = entries.filter(e => e.active === filter.active);
  if (filter?.tags?.length) entries = entries.filter(e => filter.tags!.some(t => e.tags.includes(t)));
  return entries.map(toPublicEntry);
}

export function getVaultHealth(): VaultHealth {
  const entries = Array.from(vaultMap.values());
  const now = Date.now();
  return {
    totalKeys: entries.length,
    activeKeys: entries.filter(e => e.active).length,
    rotationDue: entries.filter(e => e.active && e.rotationDueAt < now + 7 * 86400000).length,
    rateLimited: entries.filter(e => e.healthStatus === "rate-limited").length,
    invalid: entries.filter(e => e.healthStatus === "invalid").length,
    healthy: entries.filter(e => e.healthStatus === "healthy").length,
  };
}

async function pingProvider(service: string, baseUrl: string, key: string): Promise<"healthy" | "invalid" | "rate-limited"> {
  try {
    const resp = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.status === 200) return "healthy";
    if (resp.status === 429) return "rate-limited";
    if (resp.status === 401 || resp.status === 403) return "invalid";
    return "healthy";
  } catch {
    return "healthy";
  }
}

const PROVIDER_HEALTH_ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  sambanova: "https://api.sambanova.ai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
  openai: "https://TESSERA_LLM_BASE_URL/v1",
  cohere: "https://api.cohere.com/compatibility/v1",
};

export async function runVaultHealthCheck(): Promise<VaultHealth> {
  const entries = Array.from(vaultMap.values()).filter(e => e.active);

  for (const entry of entries) {
    const baseUrl = PROVIDER_HEALTH_ENDPOINTS[entry.service];
    if (!baseUrl) continue;

    const value = getKey(entry.service, entry.keyName, "health-check");
    if (!value) continue;

    const status = await pingProvider(entry.service, baseUrl, value);
    entry.healthStatus = status;
    entry.lastHealthCheck = Date.now();
  }

  const health = getVaultHealth();
  broadcast("sovereignty", "vault_health", health);
  return health;
}

function requireAdminOrForbid(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }
  next();
}

export function registerVaultRoutes(app: Express): void {
  app.get("/api/sovereign/vault/keys", requireAdminOrForbid, (_req: Request, res: Response) => {
    res.json({
      keys: listKeys(),
      health: getVaultHealth(),
    });
  });

  app.post("/api/sovereign/vault/register", requireAdminOrForbid, (req: Request, res: Response) => {
    const { service, keyName, value, description, rotationDays, tags } = req.body;
    if (!service || !keyName || !value) {
      return res.status(400).json({ error: "service, keyName, value required" });
    }
    const entry = registerKey(service, keyName, value, description, rotationDays, tags);
    res.json({ success: true, entry });
  });

  app.post("/api/sovereign/vault/revoke", requireAdminOrForbid, (req: Request, res: Response) => {
    const { service, keyName } = req.body;
    if (!service || !keyName) return res.status(400).json({ error: "service and keyName required" });
    const ok = revokeKey(service, keyName);
    res.json({ success: ok });
  });

  app.get("/api/sovereign/vault/health", requireAdminOrForbid, async (_req: Request, res: Response) => {
    const health = await runVaultHealthCheck();
    res.json(health);
  });

  app.post("/api/sovereign/vault/health-check", requireAdminOrForbid, async (_req: Request, res: Response) => {
    const health = await runVaultHealthCheck();
    res.json(health);
  });

  kvlog("Vault HTTP routes registered at /api/sovereign/vault/* (admin-guarded)");
}

setInterval(() => runVaultHealthCheck().catch(() => {}), 10 * 60 * 1000);

kvlog("Sovereign Key Vault module loaded");
