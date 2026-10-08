#!/usr/bin/env node
/**
 * Opt-in cleanup for rows saved before Privacy E.
 *
 * Paths are resolved from this file, not process.cwd().
 * Verdict and backups live under artifacts/api-server/data (gitignored).
 * The db package stays at the repo root.
 * Default is a dry-run that prints counts only and does not connect.
 * --apply writes a timestamped backup first, then rewrites.
 * A backup is written only when `git check-ignore` accepts the path.
 * Any run waits on Father. Do not execute this from CI or an agent.
 * Do not set DATABASE_URL here.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..");
const DEFAULT_DATA_DIR = join(SCRIPT_DIR, "..", "data");
const DB_PACKAGE = join(REPO_ROOT, "lib", "db", "package.json");
const APPLY = process.argv.includes("--apply");
const BACKUP_REFUSED = "backup path is not gitignored";
const VERDICT_READ_FAILED = "verdict read failed";
const DATABASE_PASS_FAILED = "database pass failed";
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

function dataDir() {
  const flag = process.argv.indexOf("--data-dir");
  const raw = flag >= 0 ? process.argv[flag + 1] : "";
  if (!raw) return DEFAULT_DATA_DIR;
  return isAbsolute(raw) ? raw : resolve(REPO_ROOT, raw);
}

const DATA_DIR = dataDir();
const VERDICT_PATH = join(DATA_DIR, "improvement-conference-verdict.json");

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

class BackupRefusedError extends Error {
  constructor() {
    super(BACKUP_REFUSED);
    this.name = "BackupRefusedError";
  }
}

function fail(message) {
  process.stdout.write(`${message}\n`);
  process.exit(1);
}

function assertIgnored(path) {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", path], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
  } catch {
    throw new BackupRefusedError();
  }
}

function backupDestination(stem) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let n = 0;
  let candidate = join(DATA_DIR, `${stem}.${stamp}.bak`);
  while (existsSync(candidate)) {
    n += 1;
    if (n > 50) fail(BACKUP_REFUSED);
    candidate = join(DATA_DIR, `${stem}.${stamp}.${n}.bak`);
  }
  assertIgnored(candidate);
  return candidate;
}

function readVerdict() {
  if (!existsSync(VERDICT_PATH)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(VERDICT_PATH, "utf8"));
  } catch {
    fail(VERDICT_READ_FAILED);
  }
  const counts = emptyCounts();
  const next = stripValue(parsed, counts);
  return { counts, next, changed: counts.credentialFields > 0 || counts.transcriptLines > 0 };
}

function writeVerdict(verdict) {
  if (!verdict?.changed) return;
  let backup;
  try {
    backup = backupDestination("improvement-conference-verdict.json");
    mkdirSync(dirname(backup), { recursive: true });
    copyFileSync(VERDICT_PATH, backup);
    writeFileSync(VERDICT_PATH, JSON.stringify(verdict.next, null, 2));
  } catch {
    fail(BACKUP_REFUSED);
  }
  process.stdout.write("verdictBackup: written\nverdictRewrite: 1\n");
}

const verdict = readVerdict();
const lines = [
  APPLY ? "apply" : "dry-run",
  "counts only; no values",
  `verdictFile: ${verdict ? "present" : "absent"}`,
  `verdictCredentialFields: ${verdict ? verdict.counts.credentialFields : 0}`,
  `verdictTranscriptLines: ${verdict ? verdict.counts.transcriptLines : 0}`,
];

if (!APPLY) {
  lines.push("councilSessions: skipped in dry-run");
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(0);
}

writeVerdict(verdict);

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  lines.push("councilSessions: skipped, DATABASE_URL unset");
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(0);
}

const require = createRequire(DB_PACKAGE);
try {
  const pg = require("pg");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
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
      if (pending.length > 0) {
        const backup = backupDestination("council-sessions.privacy-e");
        mkdirSync(dirname(backup), { recursive: true });
        writeFileSync(
          backup,
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
      await client.query("COMMIT");
      lines.push(`councilSessionsScanned: ${found.rows.length}`);
      lines.push(`councilRowsWithCredentialFields: ${rowsWithCredentialFields}`);
      process.stdout.write(`${lines.join("\n")}\n`);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The fixed message below is the only failure text.
      }
      if (err instanceof BackupRefusedError) fail(BACKUP_REFUSED);
      fail(DATABASE_PASS_FAILED);
    }
  } finally {
    await client.end();
  }
} catch {
  fail(DATABASE_PASS_FAILED);
}
