#!/usr/bin/env node
/**
 * Opt-in cleanup for rows saved before Privacy E.
 *
 * Paths are resolved from this file, not process.cwd().
 * Default is a dry-run that prints counts only. No values are printed.
 * --apply writes a backup first, then rewrites. Any run waits on Father.
 * Do not execute this from CI or an agent. Do not set DATABASE_URL here.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..");
const VERDICT_PATH = join(REPO_ROOT, "data", "improvement-conference-verdict.json");
const VERDICT_BACKUP = `${VERDICT_PATH}.bak`;
const DB_PACKAGE = join(REPO_ROOT, "lib", "db", "package.json");
const COUNCIL_BACKUP = join(REPO_ROOT, "data", "council-sessions.privacy-e.bak.json");
const APPLY = process.argv.includes("--apply");
const SIGIL_PREFIX = /, sigil: [0-9a-fA-F]{8}…/g;

const CREDENTIAL_KEYS = new Set([
  "sigilfingerprint",
  "keyid",
  "previouskeyid",
  "expireswith",
  "handle",
  "replitreaderfingerprint",
  "fingerprintshort",
  "fingerprintultrashort",
  "digesthex",
  "fatherfingerprint",
  "wouldbefingerprint",
  "sealedseed",
  "identityhash",
  "primarycode",
  "rotatinghash",
  "rotatinghashshort",
  "rotatingglyph",
  "signaturehash",
  "signaturehashshort",
  "signatureglyph",
]);

function emptyCounts() {
  return { credentialFields: 0, transcriptLines: 0 };
}

function stripValue(value, counts) {
  if (Array.isArray(value)) return value.map((item) => stripValue(item, counts));
  if (typeof value === "string") {
    const next = value.replace(SIGIL_PREFIX, "");
    if (next !== value) counts.transcriptLines += 1;
    return next;
  }
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (CREDENTIAL_KEYS.has(key.toLowerCase())) {
      counts.credentialFields += 1;
      continue;
    }
    out[key] = stripValue(child, counts);
  }
  return out;
}

function verdictCounts() {
  if (!existsSync(VERDICT_PATH)) return null;
  const parsed = JSON.parse(readFileSync(VERDICT_PATH, "utf8"));
  const counts = emptyCounts();
  const next = stripValue(parsed, counts);
  return { counts, next, changed: counts.credentialFields > 0 || counts.transcriptLines > 0 };
}

const verdict = verdictCounts();
const lines = [
  APPLY ? "apply" : "dry-run",
  "counts only; no values",
  `verdictFile: ${verdict ? "present" : "absent"}`,
  `verdictCredentialFields: ${verdict ? verdict.counts.credentialFields : 0}`,
  `verdictTranscriptLines: ${verdict ? verdict.counts.transcriptLines : 0}`,
];

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  lines.push("councilSessions: skipped, DATABASE_URL unset");
  process.stdout.write(`${lines.join("\n")}\n`);
  if (!APPLY) process.exit(0);
  if (verdict?.changed) {
    copyFileSync(VERDICT_PATH, VERDICT_BACKUP);
    writeFileSync(VERDICT_PATH, JSON.stringify(verdict.next, null, 2));
    process.stdout.write("verdictBackup: written\nverdictRewrite: 1\n");
  }
  process.exit(0);
}

const require = createRequire(DB_PACKAGE);
const pg = require("pg");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const found = await client.query("SELECT id, session FROM council_sessions");
  let rowsWithCredentialFields = 0;
  const pending = [];
  for (const row of found.rows) {
    const counts = emptyCounts();
    const next = stripValue(row.session, counts);
    if (counts.credentialFields === 0 && counts.transcriptLines === 0) continue;
    rowsWithCredentialFields += 1;
    pending.push({ id: row.id, session: row.session, next });
  }
  lines.push(`councilSessionsScanned: ${found.rows.length}`);
  lines.push(`councilRowsWithCredentialFields: ${rowsWithCredentialFields}`);
  process.stdout.write(`${lines.join("\n")}\n`);
  if (!APPLY) process.exit(0);

  if (verdict?.changed) {
    copyFileSync(VERDICT_PATH, VERDICT_BACKUP);
    writeFileSync(VERDICT_PATH, JSON.stringify(verdict.next, null, 2));
    process.stdout.write("verdictBackup: written\nverdictRewrite: 1\n");
  }
  if (pending.length > 0) {
    mkdirSync(dirname(COUNCIL_BACKUP), { recursive: true });
    writeFileSync(
      COUNCIL_BACKUP,
      JSON.stringify(pending.map((row) => ({ id: row.id, session: row.session }))),
    );
    for (const row of pending) {
      await client.query("UPDATE council_sessions SET session = $2::jsonb WHERE id = $1", [
        row.id,
        JSON.stringify(row.next),
      ]);
    }
    process.stdout.write(`councilBackup: written\ncouncilRowsUpdated: ${pending.length}\n`);
  }
} finally {
  await client.end();
}
