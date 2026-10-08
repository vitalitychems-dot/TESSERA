import crypto from "crypto";
import { db } from "./db";
import { pgVaultKeys, pgVaultAccessLog } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const vlog = (msg: string) => console.log(`[PgVault] ${msg}`);

const ALGORITHM = "aes-256-gcm";
const KEY_DERIVATION_SALT = "tess_pg_vault_v1_master_salt";
const SCRYPT_KEYLEN = 32;

function getMasterSecret(): string {
  const secret = process.env.VAULT_MASTER_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    vlog("WARNING: No VAULT_MASTER_SECRET or SESSION_SECRET set — vault data will be lost on restart");
    return crypto.createHash("sha256").update("ephemeral-" + process.pid).digest("hex");
  }
  return secret;
}

function deriveKey(): Buffer {
  return crypto.scryptSync(getMasterSecret(), KEY_DERIVATION_SALT, SCRYPT_KEYLEN);
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(stored: string): string {
  try {
    const parts = stored.split(":");
    if (parts.length !== 3) throw new Error("Invalid vault entry format");
    const [ivHex, authTagHex, encrypted] = parts;
    const key = deriveKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    vlog(`Decryption failed: ${(err as Error).message}`);
    return "";
  }
}

function mask(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

async function logAccess(vaultKeyId: number | null, action: string, source: string, success: boolean) {
  try {
    await db.insert(pgVaultAccessLog).values({
      vaultKeyId,
      action,
      source,
      success: success ? 1 : 0,
    });
  } catch (err) {
    vlog(`Access log write failed: ${(err as Error).message}`);
  }
}

export async function ensureVaultTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pg_vault_keys (
        id SERIAL PRIMARY KEY,
        service TEXT NOT NULL,
        key_name TEXT NOT NULL,
        encrypted_value TEXT NOT NULL,
        description TEXT,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed_at TIMESTAMP,
        rotation_interval_days INTEGER NOT NULL DEFAULT 90,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_service_key ON pg_vault_keys (service, key_name)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pg_vault_access_log (
        id SERIAL PRIMARY KEY,
        vault_key_id INTEGER REFERENCES pg_vault_keys(id),
        action TEXT NOT NULL,
        source TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    vlog("PostgreSQL key vault initialized");
    await migrateEnvVarsToVault();
  } catch (err) {
    vlog(`Vault table setup failed: ${(err as Error).message}`);
  }
}

async function migrateEnvVarsToVault(): Promise<void> {
  const sensitiveEnvVars: { service: string; keyName: string; envVar: string; description: string }[] = [
    { service: "solana", keyName: "SOL_PRIVATE_KEY", envVar: "SOL_PRIVATE_KEY", description: "Solana wallet private key" },
    { service: "solana", keyName: "SOLANA_PRIVATE_KEY", envVar: "SOLANA_PRIVATE_KEY", description: "Solana private key (alt)" },
    { service: "openai", keyName: "OPENAI_API_KEY", envVar: "OPENAI_API_KEY", description: "OpenAI API key" },
    { service: "anthropic", keyName: "ANTHROPIC_API_KEY", envVar: "ANTHROPIC_API_KEY", description: "Anthropic API key" },
    { service: "system", keyName: "SESSION_SECRET", envVar: "SESSION_SECRET", description: "Session secret" },
  ];

  for (const entry of sensitiveEnvVars) {
    const value = process.env[entry.envVar];
    if (!value) continue;

    try {
      const existing = await db.select().from(pgVaultKeys)
        .where(and(eq(pgVaultKeys.service, entry.service), eq(pgVaultKeys.keyName, entry.keyName)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(pgVaultKeys).values({
          service: entry.service,
          keyName: entry.keyName,
          encryptedValue: encrypt(value),
          description: `Migrated from env var ${entry.envVar}`,
          active: 1,
        });
        vlog(`Migrated ${entry.envVar} to vault (encrypted at rest)`);
        await logAccess(null, "migrate_from_env", "startup", true);
      }
    } catch (err) {
      vlog(`Migration skipped for ${entry.envVar}: ${(err as Error).message}`);
    }
  }
}

export async function vaultGet(service: string, keyName: string, source: string = "unknown"): Promise<string | null> {
  try {
    const rows = await db.select().from(pgVaultKeys)
      .where(and(eq(pgVaultKeys.service, service), eq(pgVaultKeys.keyName, keyName), eq(pgVaultKeys.active, 1)))
      .limit(1);

    if (rows.length === 0) {
      await logAccess(null, "get", source, false);
      return null;
    }

    const row = rows[0];
    const decrypted = decrypt(row.encryptedValue);

    await db.execute(sql`
      UPDATE pg_vault_keys SET access_count = access_count + 1, last_accessed_at = NOW() WHERE id = ${row.id}
    `);
    await logAccess(row.id, "get", source, true);

    return decrypted || null;
  } catch (err) {
    vlog(`vaultGet failed for ${service}/${keyName}: ${(err as Error).message}`);
    return null;
  }
}

export async function vaultSet(service: string, keyName: string, value: string, description?: string, source: string = "unknown"): Promise<boolean> {
  try {
    const encryptedValue = encrypt(value);
    const existing = await db.select().from(pgVaultKeys)
      .where(and(eq(pgVaultKeys.service, service), eq(pgVaultKeys.keyName, keyName)))
      .limit(1);

    if (existing.length > 0) {
      await db.execute(sql`
        UPDATE pg_vault_keys SET encrypted_value = ${encryptedValue}, description = ${description ?? existing[0].description}, active = 1 WHERE id = ${existing[0].id}
      `);
      await logAccess(existing[0].id, "update", source, true);
    } else {
      const inserted = await db.insert(pgVaultKeys).values({
        service,
        keyName,
        encryptedValue,
        description,
        active: 1,
      }).returning({ id: pgVaultKeys.id });
      await logAccess(inserted[0]?.id ?? null, "create", source, true);
    }
    vlog(`Vault entry set: ${service}/${keyName} (source: ${source})`);
    return true;
  } catch (err) {
    vlog(`vaultSet failed for ${service}/${keyName}: ${(err as Error).message}`);
    return false;
  }
}

export async function vaultDelete(service: string, keyName: string, source: string = "unknown"): Promise<boolean> {
  try {
    const existing = await db.select().from(pgVaultKeys)
      .where(and(eq(pgVaultKeys.service, service), eq(pgVaultKeys.keyName, keyName)))
      .limit(1);

    if (existing.length === 0) return false;

    await db.execute(sql`UPDATE pg_vault_keys SET active = 0 WHERE id = ${existing[0].id}`);
    await logAccess(existing[0].id, "delete", source, true);
    vlog(`Vault entry soft-deleted: ${service}/${keyName}`);
    return true;
  } catch (err) {
    vlog(`vaultDelete failed: ${(err as Error).message}`);
    return false;
  }
}

export async function vaultList(service?: string): Promise<Array<{ id: number; service: string; keyName: string; description: string | null; accessCount: number; lastAccessedAt: Date | null; active: number; createdAt: Date }>> {
  try {
    const query = service
      ? db.select({
          id: pgVaultKeys.id,
          service: pgVaultKeys.service,
          keyName: pgVaultKeys.keyName,
          description: pgVaultKeys.description,
          accessCount: pgVaultKeys.accessCount,
          lastAccessedAt: pgVaultKeys.lastAccessedAt,
          active: pgVaultKeys.active,
          createdAt: pgVaultKeys.createdAt,
        }).from(pgVaultKeys).where(eq(pgVaultKeys.service, service))
      : db.select({
          id: pgVaultKeys.id,
          service: pgVaultKeys.service,
          keyName: pgVaultKeys.keyName,
          description: pgVaultKeys.description,
          accessCount: pgVaultKeys.accessCount,
          lastAccessedAt: pgVaultKeys.lastAccessedAt,
          active: pgVaultKeys.active,
          createdAt: pgVaultKeys.createdAt,
        }).from(pgVaultKeys);

    return await query;
  } catch (err) {
    vlog(`vaultList failed: ${(err as Error).message}`);
    return [];
  }
}

export async function getVaultAccessLog(limit: number = 50): Promise<any[]> {
  try {
    const rows = await db.execute(sql`
      SELECT al.id, al.action, al.source, al.success, al.created_at, vk.service, vk.key_name
      FROM pg_vault_access_log al
      LEFT JOIN pg_vault_keys vk ON vk.id = al.vault_key_id
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `);
    return rows.rows;
  } catch (err) {
    vlog(`getVaultAccessLog failed: ${(err as Error).message}`);
    return [];
  }
}

export async function getVaultStatus(): Promise<{
  totalKeys: number;
  activeKeys: number;
  totalAccessEvents: number;
  recentAccesses: number;
}> {
  try {
    const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM pg_vault_keys`);
    const activeResult = await db.execute(sql`SELECT COUNT(*) as count FROM pg_vault_keys WHERE active = 1`);
    const accessResult = await db.execute(sql`SELECT COUNT(*) as count FROM pg_vault_access_log`);
    const recentResult = await db.execute(sql`SELECT COUNT(*) as count FROM pg_vault_access_log WHERE created_at > NOW() - INTERVAL '24 hours'`);

    return {
      totalKeys: Number((totalResult.rows[0] as any).count),
      activeKeys: Number((activeResult.rows[0] as any).count),
      totalAccessEvents: Number((accessResult.rows[0] as any).count),
      recentAccesses: Number((recentResult.rows[0] as any).count),
    };
  } catch (err) {
    return { totalKeys: 0, activeKeys: 0, totalAccessEvents: 0, recentAccesses: 0 };
  }
}
