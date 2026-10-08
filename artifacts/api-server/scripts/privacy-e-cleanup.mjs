#!/usr/bin/env node
/**
 * Opt-in cleanup for rows saved before Privacy E.
 *
 * Does not run unless --apply is passed. Does not set DATABASE_URL.
 * Father runs this later; agents and CI must not.
 *
 * With --apply:
 *   - Rewrites data/improvement-conference-verdict.json transcript lines that
 *     still contain the pre-change "sigil: " plus an 8-hex prefix.
 *   - If the operator environment already has DATABASE_URL, walks council
 *     session JSON and deletes sigilFingerprint fields. If DATABASE_URL is
 *     unset, the database pass is skipped.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const VERDICT_PATH = join(process.cwd(), "data", "improvement-conference-verdict.json");
const SIGIL_PREFIX = /, sigil: [0-9a-fA-F]{8}…/g;

function stripTranscriptLine(line) {
  return line.replace(SIGIL_PREFIX, "");
}

function stripSigilFingerprint(value) {
  if (Array.isArray(value)) return value.map(stripSigilFingerprint);
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? stripTranscriptLine(value) : value;
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "sigilFingerprint") continue;
    out[key] = stripSigilFingerprint(child);
  }
  return out;
}

if (!APPLY) {
  process.stdout.write(
    "Opt-in only. Pass --apply to rewrite stored conference rows. " +
      "No files or database were touched. Waiting on Father.\n",
  );
  process.exit(0);
}

let filesChanged = 0;
if (existsSync(VERDICT_PATH)) {
  const parsed = JSON.parse(readFileSync(VERDICT_PATH, "utf8"));
  writeFileSync(VERDICT_PATH, JSON.stringify(stripSigilFingerprint(parsed), null, 2));
  filesChanged += 1;
  process.stdout.write(`rewrote ${VERDICT_PATH}\n`);
} else {
  process.stdout.write(`no verdict file at ${VERDICT_PATH}\n`);
}

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  process.stdout.write("DATABASE_URL is unset. Council session rows were not read.\n");
  process.exit(0);
}

const { createRequire } = await import("node:module");
const require = createRequire(join(process.cwd(), "lib/db/package.json"));
const pg = require("pg");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const found = await client.query("SELECT id, session FROM council_sessions");
  let rowsChanged = 0;
  for (const row of found.rows) {
    const next = stripSigilFingerprint(row.session);
    if (JSON.stringify(next) === JSON.stringify(row.session)) continue;
    await client.query("UPDATE council_sessions SET session = $2::jsonb WHERE id = $1", [
      row.id,
      JSON.stringify(next),
    ]);
    rowsChanged += 1;
  }
  process.stdout.write(`council session rows updated: ${rowsChanged} of ${found.rows.length}; verdict files: ${filesChanged}\n`);
} finally {
  await client.end();
}
