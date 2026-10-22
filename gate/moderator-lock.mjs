#!/usr/bin/env node
// moderator-lock: fail-closed path lock + rule checks + gate-identity verification.
// Pure function `evaluate(input)`; CLI reads a JSON input file (built by the workflow from the GitHub API).
// Owned by Father via CODEOWNERS. Agents may not edit this file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function globToRegExp(glob) {
  let g = glob.trim();
  const anchored = g.startsWith("/");
  if (anchored) g = g.slice(1);
  if (g.endsWith("/")) g += "**";
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") { re += ".*"; i++; if (g[i + 1] === "/") i++; }
    else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  // Unanchored patterns without a slash match at any depth (CODEOWNERS semantics).
  const prefix = anchored || g.includes("/") ? "^" : "^(?:.*/)?";
  return new RegExp(prefix + re + "(?:/.*)?$");
}

export function parseLockList(text) {
  return text.split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
}

function namesOf(file) {
  if (typeof file === "string") return file ? [file] : [];
  if (!file || typeof file !== "object") return [];
  const names = [];
  if (typeof file.filename === "string" && file.filename) names.push(file.filename);
  // GitHub rename payload. Matching only `filename` would miss a move out of a locked path.
  if (typeof file.previous_filename === "string" && file.previous_filename) names.push(file.previous_filename);
  return names;
}

export function lockedHits(files, patterns) {
  const res = patterns.map((p) => [p, globToRegExp(p)]);
  const hits = [];
  for (const file of files) {
    for (const name of namesOf(file)) {
      if (res.some(([, r]) => r.test(name))) hits.push(name);
    }
  }
  return [...new Set(hits)];
}

function closed(reason) {
  return {
    lock: { pass: false, reasons: [reason], notes: [], lockedHits: [], lines: 0, files: 0 },
    gates: { pass: false, reasons: [reason] },
  };
}

const ENABLE_ON = /^\+.*TESSERA_ENABLE_[A-Z0-9_]+["']?\s*[:=]\s*["']?(1|true|on|yes)\b/im;
const NEW_FLAG_ON = /^\+.*TESSERA_[A-Z0-9_]+["']?\s*[:=]\s*["']?(1|true|on|yes)["']?\s*,?\s*$/im;
const SECRETISH = /^\+.*(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|moltbook_sk_[A-Za-z0-9]{8,})/m;
const FORBIDDEN_PATH = /(^|\/)(wallet|payment|crypto|mining|1t-vault|vault-1t)[^/]*(\/|$)/i;

export function evaluate(input) {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return closed("malformed input -> fail closed");
  }
  if (!Array.isArray(input.files) || input.files.length === 0) {
    return closed("null or empty files list -> fail closed");
  }
  const patterns = input.lockedPatterns;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return closed("null or empty locked patterns -> fail closed");
  }
  if (patterns.some((p) => typeof p !== "string" || p.trim() === "")) {
    return closed("locked patterns contain a non-string or empty entry -> fail closed");
  }

  const cfg = { maxLines: 400, maxFiles: 10, ...(input.config ?? {}) };
  const reasons = [];
  const notes = [];
  const files = input.files;

  // Rule 1: locked paths. No GitHub login's review unlocks them.
  // Reviews and login allowlists are ignored on purpose.
  const hits = lockedHits(files, patterns);
  if (hits.length) {
    reasons.push(`locked paths touched (${hits.join(", ")}); no GitHub login's review counts as Father's approval -> fail closed`);
    // Comments are never accepted: any agent can post "FATHER APPROVED <sha>" as the shared account.
    if ((input.comments ?? []).some((c) => /FATHER APPROVED/i.test(c.body ?? "")))
      notes.push("ignored 'FATHER APPROVED' comment(s): comments are forgeable by the shared account");
  }

  // Rule 1: flags, secrets, forbidden paths, deletions.
  const patch = files.map((f) => f.patch ?? "").join("\n");
  if (ENABLE_ON.test(patch)) reasons.push("diff turns on a TESSERA_ENABLE_* flag");
  else if (NEW_FLAG_ON.test(patch)) reasons.push("diff adds a TESSERA_* flag that does not default to 0");
  if (SECRETISH.test(patch)) reasons.push("diff adds something that looks like a secret");
  const forb = files.filter((f) => FORBIDDEN_PATH.test(f.filename)).map((f) => f.filename);
  if (forb.length) reasons.push(`touches wallet/payment/crypto/vault paths: ${forb.join(", ")}`);
  const removed = files.filter((f) => f.status === "removed").map((f) => f.filename);
  if (removed.length) reasons.push(`deletes files (needs Father-approved delete list): ${removed.join(", ")}`);

  // Rule 3: synthetic-only evidence never counts as a win.
  const body = input.prBody ?? "";
  if (/synthetic[- ]only/i.test(body) && /\b(win|wins|improv\w*|kept|faster|better)\b/i.test(body))
    reasons.push("claims a win on synthetic-only evidence (rule 3)");

  // Rule 6: size cap.
  const lines = files.reduce((n, f) => n + (f.additions ?? 0) + (f.deletions ?? 0), 0);
  if (files.length > cfg.maxFiles || lines > cfg.maxLines)
    reasons.push(`size cap: ${files.length} files / ${lines} lines (cap ${cfg.maxFiles} / ${cfg.maxLines}); split the PR`);

  // Rule 2: a gate cannot pass its own PR.
  const authors = new Set([(input.prAuthor ?? "").toLowerCase(), ...(input.commitAuthors ?? []).map((s) => s.toLowerCase())]);
  return { lock: { pass: reasons.length === 0, reasons, notes, lockedHits: hits, lines, files: files.length }, gates: verifyGates(input, authors) };
}

// Gate identity: only check runs posted by the configured per-gate GitHub App ids count.
export function verifyGates(input, authors = new Set()) {
  const out = { pass: true, reasons: [] };
  const apps = input.gateApps ?? {};
  for (const gate of ["moderator", "security", "build"]) {
    const id = Number(apps[gate]);
    if (!id) { out.pass = false; out.reasons.push(`${gate}: app id not configured -> fail closed`); continue; }
    const runs = (input.checkRuns ?? []).filter((r) => Number(r.app?.id) === id);
    const slug = (runs[0]?.app?.slug ?? "").toLowerCase();
    if (slug && (authors.has(slug) || authors.has(`${slug}[bot]`))) { out.pass = false; out.reasons.push(`${gate}: gate app authored this PR; cannot self-pass`); continue; }
    const good = runs.find((r) => r.head_sha === input.headSha && r.conclusion === "success");
    if (!good) {
      out.pass = false;
      out.reasons.push(runs.some((r) => r.conclusion === "success")
        ? `${gate}: PASS is stale (not on head ${input.headSha})`
        : `${gate}: no successful check run from app ${id} on head`);
    }
  }
  // PASS comments are never evidence.
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode = "lock", file] = process.argv.slice(2);
  let input = null;
  try {
    input = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    input = null;
  }
  const r = evaluate(input);
  const part = mode === "gates" ? r.gates : r.lock;
  console.log(JSON.stringify(part, null, 2));
  process.exit(part.pass ? 0 : 1);
}

// Kill switch (Security #71 item 6): gate/MERGE_BOT_ENABLED on a locked path. Only the exact value "1" enables.
// Missing, empty or unknown values mean OFF.
export function mergeBotEnabled(text) { return typeof text === "string" && text.trim() === "1"; }
