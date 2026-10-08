import crypto from "crypto";
import { db } from "./db";
import { auditLog } from "@shared/schema";
import { desc, sql } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

const alog = (msg: string) => console.log(`[AuditTrail] ${msg}`);

let lastHash = "0000000000000000000000000000000000000000000000000000000000000000";
let initialized = false;
let writeQueue: Promise<void> = Promise.resolve();

function computeHash(prevHash: string, eventType: string, actor: string, resource: string, action: string, details: string | undefined, timestamp: string): string {
  const content = [prevHash, eventType, actor, resource, action, details ?? "", timestamp].join("|");
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function ensureAuditTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log (event_type)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at)
    `);

    const latest = await db.select({ hash: auditLog.hash })
      .from(auditLog)
      .orderBy(desc(auditLog.id))
      .limit(1);

    if (latest.length > 0) {
      lastHash = latest[0].hash;
      alog(`Resumed hash chain from last entry: ${lastHash.slice(0, 16)}...`);
    } else {
      alog("Started fresh hash chain");
    }
    initialized = true;
    alog("Append-only audit trail initialized");
  } catch (err) {
    alog(`Audit table setup failed: ${(err as Error).message}`);
  }
}

export async function appendAuditLog(
  eventType: string,
  actor: string,
  resource: string,
  action: string,
  details?: Record<string, any> | string
): Promise<void> {
  if (!initialized) {
    alog(`Dropped audit event (not initialized): ${eventType} ${action} on ${resource} by ${actor}`);
    return;
  }

  const write = async (): Promise<void> => {
    const now = new Date();
    const timestamp = now.toISOString();
    const detailsStr = details ? (typeof details === "string" ? details : JSON.stringify(details)) : undefined;
    const prevHash = lastHash;
    const hash = computeHash(prevHash, eventType, actor, resource, action, detailsStr, timestamp);
    lastHash = hash;
    try {
      const row: InferInsertModel<typeof auditLog> = {
        eventType,
        actor,
        resource,
        action,
        details: detailsStr ?? null,
        prevHash,
        hash,
        createdAt: now,
      };
      await db.insert(auditLog).values(row);
    } catch (err) {
      alog(`Failed to write audit entry: ${(err as Error).message}`);
      lastHash = prevHash;
    }
  };

  writeQueue = writeQueue.then(write).catch(() => write());
  await writeQueue;
}

export async function verifyAuditChain(limit: number = 1000): Promise<{
  valid: boolean;
  entriesChecked: number;
  validEntries: number;
  invalidEntries: number;
  orphanedEntries: number;
  firstFailureId?: number;
  details: string;
}> {
  try {
    const entries = await db.select().from(auditLog).orderBy(auditLog.id).limit(limit);
    if (entries.length === 0) {
      return { valid: true, entriesChecked: 0, validEntries: 0, invalidEntries: 0, orphanedEntries: 0, details: "No entries to verify" };
    }

    const GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";

    const byPrevHash = new Map<string, typeof entries[number]>();
    for (const entry of entries) {
      byPrevHash.set(entry.prevHash, entry);
    }

    const visited = new Set<number>();
    let validCount = 0;
    let invalidCount = 0;
    let firstFailureId: number | undefined;

    const walkChain = (entry: typeof entries[number]): void => {
      if (visited.has(entry.id)) return;
      visited.add(entry.id);

      const expected = computeHash(
        entry.prevHash,
        entry.eventType,
        entry.actor,
        entry.resource,
        entry.action,
        entry.details ?? undefined,
        entry.createdAt.toISOString()
      );

      if (entry.hash !== expected) {
        invalidCount++;
        if (firstFailureId === undefined) firstFailureId = entry.id;
        return;
      }

      validCount++;
      const next = byPrevHash.get(entry.hash);
      if (next) {
        walkChain(next);
      }
    };

    const genesisEntry = byPrevHash.get(GENESIS);
    if (!genesisEntry) {
      return {
        valid: false,
        entriesChecked: entries.length,
        validEntries: 0,
        invalidEntries: 0,
        orphanedEntries: entries.length,
        details: `No genesis entry found — all ${entries.length} entries are orphaned (no entry with prevHash=0000...0000)`,
      };
    }

    walkChain(genesisEntry);

    const orphanedCount = entries.length - visited.size;
    const valid = invalidCount === 0 && orphanedCount === 0;

    let details: string;
    if (valid) {
      details = `All ${validCount} entries verified — hash chain intact`;
    } else if (invalidCount > 0) {
      details = `Hash mismatch at id=${firstFailureId} — chain tampered or corrupted (${validCount} valid, ${invalidCount} invalid, ${orphanedCount} orphaned)`;
    } else {
      details = `Chain incomplete — ${validCount} verified, ${orphanedCount} orphaned entries not reachable from genesis`;
    }

    return {
      valid,
      entriesChecked: entries.length,
      validEntries: validCount,
      invalidEntries: invalidCount,
      orphanedEntries: orphanedCount,
      ...(firstFailureId !== undefined ? { firstFailureId } : {}),
      details,
    };
  } catch (err) {
    return { valid: false, entriesChecked: 0, validEntries: 0, invalidEntries: 0, orphanedEntries: 0, details: `Verification failed: ${(err as Error).message}` };
  }
}

export async function getRecentAuditLog(limit: number = 50, eventType?: string): Promise<any[]> {
  try {
    if (eventType) {
      const rows = await db.execute(sql`
        SELECT id, event_type, actor, resource, action, details, hash, created_at
        FROM audit_log WHERE event_type = ${eventType}
        ORDER BY id DESC LIMIT ${limit}
      `);
      return rows.rows;
    }
    const rows = await db.execute(sql`
      SELECT id, event_type, actor, resource, action, details, hash, created_at
      FROM audit_log ORDER BY id DESC LIMIT ${limit}
    `);
    return rows.rows;
  } catch (err) {
    alog(`getRecentAuditLog failed: ${(err as Error).message}`);
    return [];
  }
}

export async function getAuditStats(): Promise<{
  total: number;
  last24h: number;
  byEventType: Record<string, number>;
  lastHash: string;
}> {
  try {
    const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM audit_log`);
    const recentResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const byTypeResult = await db.execute(sql`
      SELECT event_type, COUNT(*) as count FROM audit_log GROUP BY event_type
    `);

    const byEventType: Record<string, number> = {};
    for (const row of byTypeResult.rows as any[]) {
      byEventType[row.event_type] = Number(row.count);
    }

    return {
      total: Number((totalResult.rows[0] as any).count),
      last24h: Number((recentResult.rows[0] as any).count),
      byEventType,
      lastHash: lastHash.slice(0, 16) + "...",
    };
  } catch (err) {
    return { total: 0, last24h: 0, byEventType: {}, lastHash: "unavailable" };
  }
}

export function auditTrade(actor: string, details: { side: string; token: string; amount: number; price?: number; txHash?: string }) {
  return appendAuditLog("trade", actor, "trading", details.side, details);
}

export function auditConfigChange(actor: string, configKey: string, oldValue: string, newValue: string) {
  return appendAuditLog("config_change", actor, "config", "update", { configKey, oldValue: oldValue.slice(0, 50), newValue: newValue.slice(0, 50) });
}

export function auditGovernanceVote(actor: string, proposalId: string, vote: string, details?: Record<string, any>) {
  return appendAuditLog("governance_vote", actor, `proposal:${proposalId}`, vote, details);
}

export function auditVaultAccess(actor: string, action: string, keyName: string) {
  return appendAuditLog("vault_access", actor, `vault:${keyName}`, action, {});
}

export function auditSecurityEvent(actor: string, event: string, details?: Record<string, any>) {
  return appendAuditLog("security", actor, "security", event, details);
}

export function auditAdminAction(actor: string, action: string, details?: Record<string, any>) {
  return appendAuditLog("admin", actor, "admin", action, details);
}
