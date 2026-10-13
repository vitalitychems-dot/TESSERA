#!/usr/bin/env node
/**
 * Local benchmark: full bundle vs delta bundle for N=1, 5, and 20 commits.
 * No network. The base commit is unique text taken from this repository's
 * own markdown, so pack compression cannot collapse repeated stub sentences.
 * Prints one JSON object.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createBundle, fetchBundle } from "./deltabundle.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

const enabled = { ...process.env, TESSERA_ENABLE_DELTA_BUNDLE: "1" };
const NS = [1, 5, 20];
const RUNS = 5;
const CORPUS_CAP = 12 * 1024 * 1024;
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const SKIP = new Set([".git", "node_modules", "dist", "tools"]);

function git(cwd, args) {
  const result = spawnSync(
    "git",
    ["-c", "commit.gpgsign=false", "-c", "user.name=Delta Bench", "-c", "user.email=bench@tessera.local", ...args],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Delta Bench",
        GIT_AUTHOR_EMAIL: "bench@tessera.local",
        GIT_COMMITTER_NAME: "Delta Bench",
        GIT_COMMITTER_EMAIL: "bench@tessera.local",
      },
    },
  );
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "git failed").trim());
  return (result.stdout || "").trim();
}

function loadCorpus() {
  const pages = [];
  const seen = new Set();
  let bytes = 0;
  const take = (full) => {
    if (bytes >= CORPUS_CAP) return;
    let body;
    try {
      const size = statSync(full).size;
      if (size < 1500 || size > 1_500_000) return;
      body = readFileSync(full);
    } catch {
      return;
    }
    const digest = createHash("sha256").update(body).digest("hex");
    if (seen.has(digest)) return;
    seen.add(digest);
    const rel = relative(repoRoot, full).split(sep).join("/");
    pages.push({ rel, body });
    bytes += body.length;
  };
  const walk = (dir, extension) => {
    if (bytes >= CORPUS_CAP) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (bytes >= CORPUS_CAP) return;
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP.has(entry.name)) continue;
        walk(full, extension);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(extension)) take(full);
    }
  };
  walk(repoRoot, ".md");
  walk(repoRoot, ".txt");
  if (pages.length < 8) throw new Error("Need at least 8 distinct text pages in the repo to bench.");
  return { pages, bytes };
}

function commit(repo, files, message) {
  for (const [path, body] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
    git(repo, ["add", "--", path]);
  }
  git(repo, ["commit", "-qm", message]);
  return git(repo, ["rev-parse", "HEAD"]);
}

function buildBase(corpus) {
  const repo = mkdtempSync(join(tmpdir(), "deltabundle-bench-base-"));
  git(repo, ["init", "-q", "-b", "main"]);
  const files = {};
  corpus.pages.forEach((page, index) => {
    const name = `pages/${String(index).padStart(3, "0")}-${page.rel.replaceAll("/", "__")}`;
    files[name] = page.body;
  });
  commit(repo, files, "base corpus");
  return repo;
}

function updateNote(step, file) {
  return `# Offline update ${step}.${file}\n\nThis section was written on the node after the last sync. It names the pages touched on this walk and leaves the rest of the corpus unsent.\n\nVisit ${step} corrected file ${file}: the receiver must already have the base commit, then fast-forward across this note and the three edited pages.\n`;
}

function senderWithUpdates(baseRepo, corpus, n) {
  const repo = mkdtempSync(join(tmpdir(), "deltabundle-bench-sender-"));
  git(baseRepo, ["clone", "-q", "--branch", "main", baseRepo, repo]);
  const basis = git(repo, ["rev-parse", "HEAD"]);
  for (let step = 1; step <= n; step += 1) {
    const files = {};
    for (let f = 0; f < 3; f += 1) {
      const index = (step * 3 + f) % corpus.pages.length;
      const name = `pages/${String(index).padStart(3, "0")}-${corpus.pages[index].rel.replaceAll("/", "__")}`;
      files[name] = Buffer.concat([
        corpus.pages[index].body,
        Buffer.from(`\n\n${updateNote(step, f)}\n`),
      ]);
    }
    files[`notes/update-${String(step).padStart(2, "0")}.md`] = updateNote(step, "note");
    commit(repo, files, `update ${step}`);
  }
  return { repo, basis };
}

function cloneBase(baseRepo) {
  const dir = mkdtempSync(join(tmpdir(), "deltabundle-bench-recv-"));
  git(baseRepo, ["clone", "-q", "--branch", "main", baseRepo, dir]);
  return dir;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return sorted[mid];
}

function timeFetch(repo, bundle, full) {
  const start = process.hrtime.bigint();
  fetchBundle({ repo, bundle, full, env: enabled });
  return Number(process.hrtime.bigint() - start) / 1e6;
}

const corpus = loadCorpus();
const baseRepo = buildBase(corpus);
const rows = [];
for (const n of NS) {
  const sender = senderWithUpdates(baseRepo, corpus, n);
  const fullBytes = [];
  const deltaBytes = [];
  const fullMs = [];
  const deltaMs = [];
  for (let run = 0; run < RUNS; run += 1) {
    const work = mkdtempSync(join(tmpdir(), "deltabundle-bench-out-"));
    const fullOut = join(work, "full.bundle");
    const deltaOut = join(work, "delta.bundle");
    const full = createBundle({ repo: sender.repo, out: fullOut, full: true, env: enabled });
    const delta = createBundle({ repo: sender.repo, out: deltaOut, peerRef: sender.basis, env: enabled });
    fullBytes.push(full.bytes);
    deltaBytes.push(delta.bytes);
    fullMs.push(Math.round(timeFetch(cloneBase(baseRepo), fullOut, true)));
    deltaMs.push(Math.round(timeFetch(cloneBase(baseRepo), deltaOut, false)));
  }
  const fullB = median(fullBytes);
  const deltaB = median(deltaBytes);
  rows.push({
    n,
    fullBytes: fullB,
    deltaBytes: deltaB,
    byteRatio: Number((fullB / deltaB).toFixed(2)),
    fullFetchMs: median(fullMs),
    deltaFetchMs: median(deltaMs),
  });
}

process.stdout.write(
  `${JSON.stringify({ runs: RUNS, pages: corpus.pages.length, corpusBytes: corpus.bytes, rows }, null, 2)}\n`,
);
