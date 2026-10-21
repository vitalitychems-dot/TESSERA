import crypto from "crypto";
import { pool } from "./db";
import { deriveTessAddress, getOrCreateNodeAddress } from "./tess-crypto-address";

const DNS_TABLE_INIT = `
CREATE TABLE IF NOT EXISTS sovereign_dns (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  tess_address TEXT NOT NULL,
  public_key_hex TEXT NOT NULL,
  owner TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'agent',
  registered_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  ttl_seconds INTEGER NOT NULL DEFAULT 86400,
  status TEXT NOT NULL DEFAULT 'active',
  shard_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_sov_dns_domain ON sovereign_dns(domain);
CREATE INDEX IF NOT EXISTS idx_sov_dns_status ON sovereign_dns(status);
`;

let initialized = false;

async function ensureTable(): Promise<void> {
  if (initialized) return;
  try {
    await pool.query(DNS_TABLE_INIT);
    initialized = true;
  } catch (err: any) {
    console.error("[SovDNS] Table init error:", err.message);
  }
}

export interface SovDNSRecord {
  id: string;
  domain: string;
  tessAddress: string;
  publicKeyHex: string;
  owner: string;
  ownerType: string;
  registeredAt: number;
  expiresAt: number;
  ttlSeconds: number;
  status: string;
  shardId: string | null;
  metadata: Record<string, any>;
}

function normalizeDomain(domain: string): string {
  let d = domain.toLowerCase().trim();
  if (!d.endsWith(".sov") && !d.endsWith(".sovereign") && !d.endsWith(".tess")) {
    d = d + ".sov";
  }
  return d;
}

export async function registerSovDomain(
  domain: string,
  owner: string,
  ownerType: string = "agent",
  ttlSeconds: number = 86400,
  metadata: Record<string, any> = {}
): Promise<SovDNSRecord> {
  await ensureTable();
  const normalized = normalizeDomain(domain);
  const addr = getOrCreateNodeAddress(normalized);
  const id = `dns-${crypto.randomBytes(8).toString("hex")}`;
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  const shardId = `shard-${crypto.createHash("sha256").update(normalized + now.toString()).digest("hex").slice(0, 16)}`;

  const result = await pool.query(
    `INSERT INTO sovereign_dns (id, domain, tess_address, public_key_hex, owner, owner_type, registered_at, expires_at, ttl_seconds, status, shard_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11)
     ON CONFLICT (domain) DO UPDATE SET
       tess_address = EXCLUDED.tess_address,
       public_key_hex = EXCLUDED.public_key_hex,
       owner = EXCLUDED.owner,
       owner_type = EXCLUDED.owner_type,
       expires_at = EXCLUDED.expires_at,
       ttl_seconds = EXCLUDED.ttl_seconds,
       status = 'active',
       shard_id = EXCLUDED.shard_id,
       metadata = EXCLUDED.metadata
     RETURNING *`,
    [id, normalized, addr.display, addr.publicKeyHex, owner, ownerType, now, expiresAt, ttlSeconds, shardId, JSON.stringify(metadata)]
  );

  return rowToRecord(result.rows[0]);
}

export async function lookupSovDomain(domain: string): Promise<SovDNSRecord | null> {
  await ensureTable();
  const normalized = normalizeDomain(domain);
  const now = Date.now();
  const result = await pool.query(
    `SELECT * FROM sovereign_dns WHERE domain = $1 AND status = 'active' AND expires_at > $2`,
    [normalized, now]
  );
  if (result.rows.length === 0) return null;
  return rowToRecord(result.rows[0]);
}

export async function lookupByTessAddress(tessAddress: string): Promise<SovDNSRecord | null> {
  await ensureTable();
  const now = Date.now();
  const result = await pool.query(
    `SELECT * FROM sovereign_dns WHERE tess_address = $1 AND status = 'active' AND expires_at > $2`,
    [tessAddress, now]
  );
  if (result.rows.length === 0) return null;
  return rowToRecord(result.rows[0]);
}

export async function transferSovDomain(domain: string, newOwner: string, newOwnerType: string = "agent"): Promise<boolean> {
  await ensureTable();
  const normalized = normalizeDomain(domain);
  const result = await pool.query(
    `UPDATE sovereign_dns SET owner = $1, owner_type = $2 WHERE domain = $3 AND status = 'active' RETURNING id`,
    [newOwner, newOwnerType, normalized]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function suspendSovDomain(domain: string): Promise<boolean> {
  await ensureTable();
  const normalized = normalizeDomain(domain);
  const result = await pool.query(
    `UPDATE sovereign_dns SET status = 'suspended' WHERE domain = $1 RETURNING id`,
    [normalized]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function renewSovDomain(domain: string, additionalSeconds: number = 86400): Promise<boolean> {
  await ensureTable();
  const normalized = normalizeDomain(domain);
  const result = await pool.query(
    `UPDATE sovereign_dns SET expires_at = expires_at + $1, status = 'active' WHERE domain = $2 RETURNING id`,
    [additionalSeconds * 1000, normalized]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function expireOldDomains(): Promise<number> {
  await ensureTable();
  const result = await pool.query(
    `UPDATE sovereign_dns SET status = 'expired' WHERE expires_at < $1 AND status = 'active' RETURNING id`,
    [Date.now()]
  );
  return result.rowCount || 0;
}

export async function listSovDomains(owner?: string, limit: number = 100): Promise<SovDNSRecord[]> {
  await ensureTable();
  const now = Date.now();
  if (owner) {
    const result = await pool.query(
      `SELECT * FROM sovereign_dns WHERE owner = $1 AND status = 'active' AND expires_at > $2 ORDER BY registered_at DESC LIMIT $3`,
      [owner, now, limit]
    );
    return result.rows.map(rowToRecord);
  }
  const result = await pool.query(
    `SELECT * FROM sovereign_dns WHERE status = 'active' AND expires_at > $1 ORDER BY registered_at DESC LIMIT $2`,
    [now, limit]
  );
  return result.rows.map(rowToRecord);
}

export async function getDNSStats(): Promise<{
  total: number;
  active: number;
  expired: number;
  suspended: number;
  owners: number;
}> {
  await ensureTable();
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
      COUNT(DISTINCT owner) as owners
    FROM sovereign_dns
  `);
  const row = result.rows[0];
  return {
    total: parseInt(row.total) || 0,
    active: parseInt(row.active) || 0,
    expired: parseInt(row.expired) || 0,
    suspended: parseInt(row.suspended) || 0,
    owners: parseInt(row.owners) || 0,
  };
}

function rowToRecord(row: any): SovDNSRecord {
  return {
    id: row.id,
    domain: row.domain,
    tessAddress: row.tess_address,
    publicKeyHex: row.public_key_hex,
    owner: row.owner,
    ownerType: row.owner_type,
    registeredAt: parseInt(row.registered_at),
    expiresAt: parseInt(row.expires_at),
    ttlSeconds: parseInt(row.ttl_seconds),
    status: row.status,
    shardId: row.shard_id || null,
    metadata: row.metadata || {},
  };
}

const domainCache: Map<string, { record: SovDNSRecord; fetchedAt: number }> = new Map();
const DNS_CACHE_TTL = 30000;

export async function resolveSovDomain(domain: string): Promise<SovDNSRecord | null> {
  const normalized = normalizeDomain(domain);
  const cached = domainCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < DNS_CACHE_TTL) {
    return cached.record;
  }
  const record = await lookupSovDomain(normalized);
  if (record) {
    domainCache.set(normalized, { record, fetchedAt: Date.now() });
  }
  return record;
}

export async function initSovereignDNS(): Promise<void> {
  await ensureTable();

  const coreNodes = [
    { domain: "genesis.sov", owner: "Genesis-Core" },
    { domain: "alpha.sov", owner: "Alpha" },
    { domain: "beta.sov", owner: "Beta" },
    { domain: "gamma.sov", owner: "Gamma" },
    { domain: "tessera.sov", owner: "Tessera-Prime" },
    { domain: "sovereign.sov", owner: "TesseraNet" },
    { domain: "mesh.sov", owner: "TesseraNet" },
    { domain: "dns.sov", owner: "TesseraNet" },
    { domain: "store.sov", owner: "TesseraNet" },
    { domain: "relay.sov", owner: "TesseraNet" },
    { domain: "colonel.sov", owner: "TesseraNet" },
    { domain: "father.sov", owner: "Father-Direct-Link" },
  ];

  for (const { domain, owner } of coreNodes) {
    try {
      await registerSovDomain(domain, owner, "agent", 365 * 24 * 3600);
    } catch { }
  }

  console.log("[SovDNS] Sovereign DNS initialized with core nodes");
}
