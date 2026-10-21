#!/usr/bin/env node
// Rewrite stored pre-#263 fallback embeddings (a 256-d vector that is 8 copies of a 32-d sketch).
// Reads JSON and JSONL files. A record is an object with a numeric `embedding`
// and a string `content`, `text`, or `body`. Default is --dry-run (counts only).
// Writes only with --apply AND TESSERA_REEMBED_APPLY=1. The flag defaults to 0.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isOldFallbackVector, localFallbackEmbedding } from "../../api-server/src/lib/fallback-embed.mjs";

const TEXT_KEYS = ["content", "text", "body"];
const LIST_KEYS = ["records", "memories", "items", "data", "embeddings"];

export function applyAllowed(env = process.env) {
  return env.TESSERA_REEMBED_APPLY === "1";
}

function emptyStats() {
  return {
    files: 0,
    records: 0,
    oldFallback: 0,
    eligible: 0,
    rewritten: 0,
    skippedNoText: 0,
    unchanged: 0,
    parseErrors: 0,
  };
}

function addStats(into, extra) {
  for (const key of Object.keys(into)) into[key] += extra[key] ?? 0;
}

function recordText(rec) {
  for (const key of TEXT_KEYS) {
    if (typeof rec[key] === "string" && rec[key].trim()) return rec[key];
  }
  return null;
}

function isNumericVector(value) {
  return Array.isArray(value) && value.length > 0 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function consider(rec, stats, apply) {
  stats.records += 1;
  if (!rec || typeof rec !== "object" || Array.isArray(rec) || !isNumericVector(rec.embedding)) {
    stats.unchanged += 1;
    return rec;
  }
  if (!isOldFallbackVector(rec.embedding)) {
    stats.unchanged += 1;
    return rec;
  }
  stats.oldFallback += 1;
  const text = recordText(rec);
  if (text == null) {
    stats.skippedNoText += 1;
    return rec;
  }
  stats.eligible += 1;
  if (!apply) return rec;
  stats.rewritten += 1;
  return { ...rec, embedding: localFallbackEmbedding(text) };
}

function transformValue(data, stats, apply) {
  if (Array.isArray(data)) {
    let changed = false;
    const next = data.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const updated = consider(item, stats, apply);
        if (updated !== item) changed = true;
        return updated;
      }
      return item;
    });
    return changed ? next : data;
  }
  if (data && typeof data === "object") {
    if (isNumericVector(data.embedding)) return consider(data, stats, apply);
    for (const key of LIST_KEYS) {
      if (Array.isArray(data[key])) {
        const child = transformValue(data[key], stats, apply);
        if (child !== data[key]) return { ...data, [key]: child };
        return data;
      }
    }
  }
  return data;
}

export function reembedJsonl(raw, { apply }) {
  const stats = emptyStats();
  const lines = raw.split("\n");
  const next = lines.map((line) => {
    if (!line.trim()) return line;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      stats.parseErrors += 1;
      return line;
    }
    const updated = transformValue(rec, stats, apply);
    return updated === rec ? line : JSON.stringify(updated);
  });
  const text = next.join("\n");
  return { text, stats, changed: text !== raw };
}

export function reembedJson(raw, { apply }) {
  const stats = emptyStats();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    stats.parseErrors += 1;
    return { text: raw, stats, changed: false };
  }
  const next = transformValue(data, stats, apply);
  if (next === data) return { text: raw, stats, changed: false };
  const text = `${JSON.stringify(next, null, 2)}${raw.endsWith("\n") ? "\n" : ""}`;
  return { text, stats, changed: true };
}

export function reembedContents(raw, filePath, { apply }) {
  if (filePath.toLowerCase().endsWith(".jsonl")) return reembedJsonl(raw, { apply });
  return reembedJson(raw, { apply });
}

function listInputs(path) {
  const info = statSync(path);
  if (!info.isDirectory()) return [path];
  const out = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) out.push(...listInputs(child));
    else if (entry.isFile() && /\.(json|jsonl)$/i.test(entry.name)) out.push(child);
  }
  return out;
}

export function parseArgs(argv) {
  let dryRun = false;
  let apply = false;
  let help = false;
  const paths = [];
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--apply") apply = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg.startsWith("-")) throw new Error(`unknown flag ${arg}`);
    else paths.push(arg);
  }
  if (dryRun && apply) throw new Error("pass only one of --dry-run or --apply");
  return { mode: apply ? "apply" : "dry-run", help, paths };
}

export function runReembed(paths, { apply, read = readFileSync, write = writeFileSync, list = listInputs } = {}) {
  const stats = emptyStats();
  const files = paths.flatMap((path) => list(path));
  stats.files = files.length;
  for (const file of files) {
    const raw = read(file, "utf8");
    const result = reembedContents(raw, file, { apply });
    const { files: _nestedFiles, ...rest } = result.stats;
    addStats(stats, rest);
    if (apply && result.changed) write(file, result.text);
  }
  stats.files = files.length;
  return { files, stats };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    return { code: 2, report: { mode: "error", wrote: false, reason: err.message } };
  }
  if (parsed.help) {
    return {
      code: 0,
      report: {
        mode: "help",
        wrote: false,
        usage: "node scripts/reembed-fallback.mjs [--dry-run|--apply] <file-or-dir>...",
      },
    };
  }
  if (parsed.paths.length === 0) {
    return { code: 2, report: { mode: parsed.mode, wrote: false, reason: "no input paths" } };
  }
  const flag = env.TESSERA_REEMBED_APPLY ?? "0";
  const allowed = flag === "1";
  if (parsed.mode === "apply" && !allowed) {
    let stats = emptyStats();
    try {
      stats = runReembed(parsed.paths, { apply: false }).stats;
    } catch (err) {
      return { code: 2, report: { mode: "apply-blocked", flag, wrote: false, reason: err.message } };
    }
    return {
      code: 2,
      report: {
        mode: "apply-blocked",
        flag,
        wrote: false,
        reason: "refusing to write: pass --apply and set TESSERA_REEMBED_APPLY=1",
        ...stats,
      },
    };
  }
  try {
    const { stats } = runReembed(parsed.paths, { apply: parsed.mode === "apply" && allowed });
    return {
      code: 0,
      report: {
        mode: parsed.mode,
        flag,
        wrote: parsed.mode === "apply" && allowed && stats.rewritten > 0,
        ...stats,
      },
    };
  } catch (err) {
    return { code: 2, report: { mode: "error", flag, wrote: false, reason: err.message } };
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

if (invokedDirectly()) {
  const { code, report } = main();
  console.log(JSON.stringify(report));
  process.exit(code);
}

export { isOldFallbackVector, localFallbackEmbedding };
