import { pool } from "@workspace/db";
import { createHash } from "crypto";

const LOG_PREFIX = "[TransparencyLedger]";

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sovereign_ledger (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      agent_id TEXT,
      data JSONB NOT NULL DEFAULT '{}',
      data_canonical TEXT NOT NULL DEFAULT '{}',
      previous_hash TEXT NOT NULL DEFAULT '',
      entry_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE sovereign_ledger ADD COLUMN IF NOT EXISTS data_canonical TEXT NOT NULL DEFAULT '{}'
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sovereign_ledger_agent ON sovereign_ledger(agent_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sovereign_ledger_event_type ON sovereign_ledger(event_type)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sovereign_ledger_created ON sovereign_ledger(created_at)
  `);
}

function computeEntryHash(previousHash: string, eventType: string, agentId: string | null, dataCanonical: string, timestamp: string): string {
  const content = `${previousHash}|${eventType}|${agentId ?? ""}|${dataCanonical}|${timestamp}`;
  return createHash("sha256").update(content).digest("hex");
}

const LEDGER_LOCK_KEY = 7777777;

export async function recordEvent(
  eventType: string,
  agentId: string | null,
  data: object
): Promise<{ id: number; entryHash: string }> {
  await ensureTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LEDGER_LOCK_KEY]);

    const lastResult = await client.query(
      `SELECT entry_hash FROM sovereign_ledger ORDER BY id DESC LIMIT 1`
    );
    const previousHash = lastResult.rows.length > 0 ? lastResult.rows[0].entry_hash : "GENESIS";

    const timestamp = new Date().toISOString();
    const dataCanonical = JSON.stringify(data);
    const entryHash = computeEntryHash(previousHash, eventType, agentId, dataCanonical, timestamp);

    const result = await client.query(
      `INSERT INTO sovereign_ledger (event_type, agent_id, data, data_canonical, previous_hash, entry_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, entry_hash`,
      [eventType, agentId, dataCanonical, dataCanonical, previousHash, entryHash, timestamp]
    );

    await client.query("COMMIT");
    console.log(`${LOG_PREFIX} Recorded ${eventType} by ${agentId ?? "system"} → ${entryHash.slice(0, 12)}...`);
    return { id: result.rows[0].id, entryHash: result.rows[0].entry_hash };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getRecentEntries(limit: number = 50): Promise<object[]> {
  await ensureTable();
  const result = await pool.query(
    `SELECT id, event_type, agent_id, data, previous_hash, entry_hash, created_at
     FROM sovereign_ledger
     ORDER BY id DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getLedgerStats(): Promise<object> {
  await ensureTable();
  const countResult = await pool.query(`SELECT COUNT(*) AS total FROM sovereign_ledger`);
  const typeResult = await pool.query(
    `SELECT event_type, COUNT(*) AS count FROM sovereign_ledger GROUP BY event_type ORDER BY count DESC`
  );
  return {
    totalEntries: parseInt(countResult.rows[0].total, 10),
    eventTypes: typeResult.rows,
  };
}

export async function verifyChainIntegrity(): Promise<{
  totalEntries: number;
  intactLinks: number;
  brokenLinks: number;
  hashVerified: number;
  hashMismatched: number;
  integrityScore: number;
}> {
  await ensureTable();
  const result = await pool.query(
    `SELECT id, event_type, agent_id, data_canonical, previous_hash, entry_hash, created_at
     FROM sovereign_ledger
     ORDER BY id ASC`
  );

  const entries = result.rows;
  let intactLinks = 0;
  let brokenLinks = 0;
  let hashVerified = 0;
  let hashMismatched = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? "GENESIS" : entries[i - 1].entry_hash;

    const chainLinkOk = entry.previous_hash === expectedPrevHash;
    if (!chainLinkOk) {
      brokenLinks++;
      continue;
    }
    intactLinks++;

    const dataCanonical: string = entry.data_canonical ?? "{}";
    const recomputed = computeEntryHash(
      entry.previous_hash,
      entry.event_type,
      entry.agent_id,
      dataCanonical,
      new Date(entry.created_at).toISOString()
    );
    if (recomputed === entry.entry_hash) {
      hashVerified++;
    } else {
      hashMismatched++;
    }
  }

  const totalEntries = entries.length;
  const integrityScore = totalEntries === 0 ? 1.0 : intactLinks / totalEntries;

  return { totalEntries, intactLinks, brokenLinks, hashVerified, hashMismatched, integrityScore };
}
