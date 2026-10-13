#!/usr/bin/env node
/**
 * Checks a branch before someone asks for a gate.
 *
 *   pnpm pregate
 *   node tools/pregate/run.mjs
 *   node tools/pregate/run.mjs --replay <sha>
 *
 * On success the last line is: ready for gate <head sha>
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_NAME = "vitalitychems-dot";
export const REQUIRED_EMAIL = "332565808+vitalitychems-dot@users.noreply.github.com";

const FLAG_RE = /TESSERA_ENABLE_[A-Z0-9_]+/g;
const SAMPLE_PATH = "repos/vitalitychems-dot/TESSERA/contents/";

/** Argv a wrapper must forward. A bare path and exact `-X GET` are not in this list. */
export const ADVERSARIAL_ARGV = [
  { id: "unknown-long", argv: ["--not-a-real-flag", SAMPLE_PATH] },
  { id: "unknown-short", argv: ["-Z", SAMPLE_PATH] },
  { id: "-f", argv: ["-f", "title=hello", SAMPLE_PATH] },
  { id: "-F", argv: ["-F", "body=@note.txt", SAMPLE_PATH] },
  { id: "--field", argv: ["--field", "title=hello", SAMPLE_PATH] },
  { id: "--raw-field", argv: ["--raw-field", "title=hello", SAMPLE_PATH] },
  { id: "--input", argv: ["--input", "body.json", SAMPLE_PATH] },
  { id: "-H", argv: ["-H", "Accept: application/vnd.github.raw", SAMPLE_PATH] },
  { id: "--header", argv: ["--header", "Accept: application/vnd.github.raw", SAMPLE_PATH] },
  { id: "--jq", argv: [SAMPLE_PATH, "--jq", ".sha"] },
  { id: "-q", argv: [SAMPLE_PATH, "-q", ".sha"] },
  { id: "-i", argv: ["-i", SAMPLE_PATH] },
  { id: "--include", argv: ["--include", SAMPLE_PATH] },
  { id: "--paginate", argv: [SAMPLE_PATH, "--paginate"] },
  { id: "-X POST", argv: ["-X", "POST", SAMPLE_PATH] },
  { id: "-X get", argv: ["-X", "get", SAMPLE_PATH] },
  { id: "-XGET", argv: ["-XGET", SAMPLE_PATH] },
  { id: "--method GET", argv: ["--method", "GET", SAMPLE_PATH] },
  { id: "--method=GET", argv: ["--method=GET", SAMPLE_PATH] },
  { id: "-iX", argv: ["-iX", "GET", SAMPLE_PATH] },
  { id: "-X GET plus --jq", argv: ["-X", "GET", SAMPLE_PATH, "--jq", ".sha"] },
  { id: "double-dash", argv: ["--", "-f", "a=b", SAMPLE_PATH] },
  { id: "graphql", argv: ["graphql"] },
  { id: "{owner}/{repo}", argv: ["repos/{owner}/{repo}/contents/"] },
];

export function readyLine(sha) {
  return `ready for gate ${sha}`;
}

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result;
}

function gitOk(args, cwd) {
  const result = git(args, cwd);
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")}`).trim());
  }
  return result.stdout;
}

export function resolveHead(cwd, replay) {
  const sha = gitOk(["rev-parse", "--verify", replay ?? "HEAD"], cwd).trim();
  return sha;
}

export function resolveBase(cwd, head, baseRef) {
  const candidates = baseRef ? [baseRef] : ["origin/main", "main"];
  let resolved = null;
  for (const candidate of candidates) {
    const check = git(["rev-parse", "--verify", "--quiet", candidate], cwd);
    if (check.status === 0) {
      resolved = candidate;
      break;
    }
  }
  if (!resolved) throw new Error("could not resolve base ref (origin/main or main)");
  return gitOk(["merge-base", resolved, head], cwd).trim();
}

export function readCommits(cwd, base, head) {
  const out = gitOk(
    ["log", "--reverse", "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%s", `${base}..${head}`],
    cwd,
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, authorName, authorEmail, committerName, committerEmail, subject] = line.split("\x1f");
      return {
        sha,
        subject,
        author: { name: authorName, email: authorEmail },
        committer: { name: committerName, email: committerEmail },
      };
    });
}

export function identityFailures(commits) {
  const failures = [];
  for (const commit of commits) {
    for (const role of ["author", "committer"]) {
      const person = commit[role];
      if (person.name !== REQUIRED_NAME || person.email !== REQUIRED_EMAIL) {
        failures.push(
          `${commit.sha.slice(0, 12)} ${role} ${person.name} <${person.email}>`,
        );
      }
    }
  }
  return failures;
}

export function lockedReason(filePath) {
  const path = filePath.replaceAll("\\", "/");
  if (path === "CODEOWNERS" || path.endsWith("/CODEOWNERS")) return "CODEOWNERS";
  if (path.split("/").includes("rules")) return "rules";
  if (path.startsWith(".github/instructions/")) return "rules";
  const baseName = path.split("/").pop() ?? path;
  if ((path.startsWith("scripts/") || path.startsWith(".github/")) && /gate/i.test(baseName)) {
    return "gates";
  }
  if (path.split("/").includes("gates")) return "gates";
  return null;
}

export function permissionBlocks(text) {
  if (!text) return [];
  const lines = text.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)permissions:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const inline = match[2].trim();
    if (inline && inline !== "|" && inline !== ">") {
      blocks.push(lines[i].trim());
      continue;
    }
    const chunk = [lines[i].trimEnd()];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") {
        chunk.push("");
        continue;
      }
      const nextIndent = lines[j].match(/^\s*/)[0].length;
      if (nextIndent <= indent) break;
      chunk.push(lines[j].trimEnd());
      i = j;
    }
    blocks.push(chunk.join("\n"));
  }
  return blocks;
}

export function isWorkflowPath(filePath) {
  return filePath.replaceAll("\\", "/").startsWith(".github/workflows/");
}

export function workflowPermissionFailures(changes) {
  const failures = [];
  for (const change of changes) {
    if (!isWorkflowPath(change.path)) continue;
    if (change.status === "A" || change.status === "D") {
      failures.push(`${change.path}: workflow file ${change.status === "A" ? "added" : "deleted"}`);
      continue;
    }
    const before = permissionBlocks(change.before).join("\n---\n");
    const after = permissionBlocks(change.after).join("\n---\n");
    if (before !== after) failures.push(`${change.path}: permissions block changed`);
  }
  return failures;
}

export function diffNames(cwd, base, head) {
  const out = gitOk(["diff", "--name-status", "--find-renames", `${base}..${head}`], cwd);
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      const path = rest[rest.length - 1];
      return { status: status[0], path };
    });
}

function showFile(cwd, sha, path) {
  const result = git(["show", `${sha}:${path}`], cwd);
  if (result.status !== 0) return null;
  return result.stdout;
}

export function flagNames(text) {
  return new Set(text.match(FLAG_RE) ?? []);
}

export function prAllowsDefaultOn(messages, flag) {
  const text = messages.join("\n");
  const near = new RegExp(`${flag}[\\s\\S]{0,120}defaults?\\s+on|defaults?\\s+on[\\s\\S]{0,120}${flag}`, "i");
  return near.test(text);
}

export function flagDefaultsOff(sources, flag) {
  const combined = sources.filter(Boolean).join("\n");
  if (!combined.includes(flag)) return false;
  const unsafe = [
    new RegExp(String.raw`\b${flag}\b\s*\|\|`),
    new RegExp(String.raw`\b${flag}\b\s*\?\?`),
    new RegExp(String.raw`(?:env|process\.env)\[\s*["']${flag}["']\s*\]\s*(?:\|\||\?\?)`),
    new RegExp(String.raw`process\.env\.${flag}\s*(?:\|\||\?\?)`),
    new RegExp(String.raw`\b${flag}\b\s*!==?\s*["']0["']`),
  ];
  if (unsafe.some((re) => re.test(combined))) return false;
  const direct = new RegExp(
    String.raw`(?:\[\s*["']${flag}["']\s*\]|\.${flag}\b|\[\s*ENABLE_FLAG\s*\])\s*===?\s*["']1["']`,
  );
  if (direct.test(combined)) return true;
  const bound = new RegExp(String.raw`ENABLE_FLAG\s*=\s*["']${flag}["']`);
  return bound.test(combined) && /\[\s*ENABLE_FLAG\s*\]\s*===\s*["']1["']/.test(combined);
}

export function containsSubsequence(haystack, needle) {
  if (!Array.isArray(haystack) || needle.length === 0) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export function isWrapperSource(path, source) {
  if (!source || !/\.(mjs|cjs|js|ts)$/.test(path)) return false;
  if (/\.test\.(mjs|cjs|js|ts)$/.test(path)) return false;
  if (/export\s+(async\s+)?function\s+runCli\b/.test(source)) return true;
  return /spawn(Sync)?\(/.test(source) && /\bargv\b/.test(source) && /["']gh["']/.test(source);
}

export function isInjectable(source) {
  return /deps\.spawnImpl|deps\.request|\bspawnImpl\b/.test(source);
}

export async function sweepRunCli(runCli, enableFlag) {
  const failures = [];
  const env = enableFlag ? { [enableFlag]: "1" } : {};
  for (const spec of ADVERSARIAL_ARGV) {
    const spawned = [];
    let requested = false;
    const cacheDir = mkdtempSync(join(tmpdir(), "pregate-cache-"));
    const deps = {
      env,
      cacheDir,
      token: "pregate-not-a-real-token",
      stdout: { write() {} },
      stderr: { write() {} },
      spawnImpl(cmd, args) {
        spawned.push({ cmd, args: Array.isArray(args) ? args : [] });
        return { status: 0 };
      },
      request: async () => {
        requested = true;
        return { status: 200, body: "{}", headers: { etag: '"pregate"' } };
      },
    };
    let code = 0;
    let error = null;
    try {
      code = await Promise.race([
        runCli(spec.argv, deps),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("timed out")), 5000);
        }),
      ]);
    } catch (caught) {
      error = caught;
    }
    const forwarded = spawned.some((call) => containsSubsequence(call.args, spec.argv));
    if (forwarded) continue;
    if (error) {
      failures.push(`${spec.id}: ${error.message}`);
      continue;
    }
    if (requested || code === 0) {
      failures.push(`${spec.id}: arguments were not passed through`);
      continue;
    }
  }
  return failures;
}

export async function loadModule(source, filename) {
  const dir = mkdtempSync(join(tmpdir(), "pregate-mod-"));
  const file = join(dir, filename);
  writeFileSync(file, source);
  return import(pathToFileURL(file).href);
}

function treeFlags(cwd, sha) {
  const result = git(["grep", "-I", "-o", "-h", "-E", "TESSERA_ENABLE_[A-Z0-9_]+", sha], cwd);
  if (result.status !== 0 && result.status !== 1) {
    throw new Error((result.stderr || "git grep failed").trim());
  }
  return new Set((result.stdout ?? "").split("\n").filter(Boolean));
}

function which(bin) {
  const result = spawnSync("sh", ["-c", `command -v ${bin}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

export function runGitleaks(cwd, base, head) {
  const bin = which("gitleaks");
  if (!bin) return { ok: true, skipped: true, detail: "gitleaks not on PATH" };
  const result = spawnSync(
    bin,
    ["detect", "--source", cwd, "--redact", "--no-banner", "--log-opts", `${base}..${head}`],
    { cwd, encoding: "utf8" },
  );
  if (result.status === 0) return { ok: true, skipped: false, detail: "clean" };
  const detail = (result.stdout || result.stderr || "leaks found").trim().split("\n").slice(0, 20);
  return { ok: false, skipped: false, detail: detail.join("\n") };
}

export function ensureDeps(cwd) {
  const offline = spawnSync(
    "pnpm",
    ["install", "--frozen-lockfile", "--ignore-scripts", "--offline"],
    { cwd, stdio: "inherit" },
  );
  if (offline.status === 0) return;
  const online = spawnSync(
    "pnpm",
    ["install", "--frozen-lockfile", "--ignore-scripts"],
    { cwd, stdio: "inherit" },
  );
  if (online.status !== 0) throw new Error("pnpm install failed");
}

export function runTests(cwd) {
  const result = spawnSync("pnpm", ["test"], { cwd, stdio: "inherit" });
  return result.status === 0;
}

export function worktreeDirty(cwd) {
  const out = gitOk(["status", "--porcelain"], cwd);
  return out.trim().length > 0;
}

function section(lines, name, ok, details, note) {
  lines.push(`${name}: ${ok ? "pass" : "fail"}${note ? ` (${note})` : ""}`);
  for (const detail of details) lines.push(`  - ${detail}`);
}

export async function evaluate({ cwd, head, base, commits, skipTests, runTestsImpl = runTests, runGitleaksImpl = runGitleaks }) {
  const lines = [];
  const messages = commits.map((commit) => `${commit.subject}`);
  const names = diffNames(cwd, base, head);
  const changes = names.map((entry) => ({
    ...entry,
    before: showFile(cwd, base, entry.path),
    after: showFile(cwd, head, entry.path),
  }));

  const identity = commits.length === 0 ? ["no commits ahead of base"] : identityFailures(commits);
  section(lines, "identity", identity.length === 0, identity);

  const locked = [];
  for (const change of changes) {
    const reason = lockedReason(change.path);
    if (reason) locked.push(`${change.path}: ${reason}`);
  }
  locked.push(...workflowPermissionFailures(changes));
  section(lines, "locked", locked.length === 0, locked);

  const beforeFlags = treeFlags(cwd, base);
  const afterFlags = treeFlags(cwd, head);
  const introduced = [...afterFlags].filter((flag) => !beforeFlags.has(flag));
  const flagFailures = [];
  for (const flag of introduced) {
    if (prAllowsDefaultOn(messages, flag)) continue;
    const sources = changes.map((change) => change.after).filter((text) => text && text.includes(flag));
    if (!flagDefaultsOff(sources, flag)) flagFailures.push(`${flag}: new flag does not default off`);
  }
  section(lines, "flags", flagFailures.length === 0, flagFailures);

  let testsOk = true;
  if (skipTests) {
    lines.push("tests: skipped");
    testsOk = false;
  } else {
    testsOk = runTestsImpl(cwd);
    lines.push(`tests: ${testsOk ? "pass" : "fail"}`);
  }

  const secrets = runGitleaksImpl(cwd, base, head);
  if (secrets.skipped) section(lines, "secrets", true, [], secrets.detail);
  else if (secrets.ok) section(lines, "secrets", true, []);
  else section(lines, "secrets", false, [secrets.detail]);

  const argvFailures = [];
  const wrappers = [];
  for (const change of changes) {
    if (!change.after || !isWrapperSource(change.path, change.after)) continue;
    wrappers.push(change.path);
    if (!isInjectable(change.after)) {
      argvFailures.push(`${change.path}: CLI wrapper cannot be swept (no injectable spawn)`);
      continue;
    }
    const filename = change.path.split("/").pop();
    const loaded = await loadModule(change.after, filename);
    if (typeof loaded.runCli !== "function") {
      argvFailures.push(`${change.path}: no exported runCli`);
      continue;
    }
    const found = [...flagNames(change.after)];
    const enableFlag = typeof loaded.ENABLE_FLAG === "string" ? loaded.ENABLE_FLAG : found[0];
    const dropped = await sweepRunCli(loaded.runCli, enableFlag);
    for (const drop of dropped) argvFailures.push(`${change.path}: ${drop}`);
  }
  const argvNote = wrappers.length === 0 ? "no CLI wrapper in the diff" : null;
  section(lines, "argv", argvFailures.length === 0, argvFailures, argvNote);

  const ok = identity.length === 0
    && locked.length === 0
    && flagFailures.length === 0
    && testsOk
    && secrets.ok
    && argvFailures.length === 0;

  return { ok, lines, head, base, identity, locked, flagFailures, argvFailures, secrets };
}

export function formatReport(result) {
  const body = [
    `pregate ${result.head}`,
    `base ${result.base}`,
    ...result.lines,
  ];
  if (result.ok) body.push(readyLine(result.head));
  return `${body.join("\n")}\n`;
}

function parseArgs(argv) {
  const opts = { replay: null, base: null, skipTests: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--replay") opts.replay = argv[++i];
    else if (arg === "--base") opts.base = argv[++i];
    else if (arg === "--skip-tests") opts.skipTests = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return opts;
}

async function main() {
  const cwd = process.cwd();
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write("Usage: node tools/pregate/run.mjs [--replay <sha>] [--base <ref>] [--skip-tests]\n");
    return;
  }
  if (!opts.replay && !opts.skipTests && worktreeDirty(cwd)) {
    process.stderr.write("pregate: commit or stash changes first so the ready line matches HEAD\n");
    process.exitCode = 1;
    return;
  }
  const head = resolveHead(cwd, opts.replay);
  const base = resolveBase(cwd, head, opts.base);
  const commits = readCommits(cwd, base, head);
  let testCwd = cwd;
  let cleanup = null;
  if (opts.replay && !opts.skipTests) {
    const dir = mkdtempSync(join(tmpdir(), "pregate-wt-"));
    gitOk(["worktree", "add", "--detach", dir, head], cwd);
    ensureDeps(dir);
    cleanup = dir;
    testCwd = dir;
  }
  try {
    const result = await evaluate({
      cwd,
      head,
      base,
      commits,
      skipTests: opts.skipTests,
      runTestsImpl: () => runTests(testCwd),
    });
    process.stdout.write(formatReport(result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    if (cleanup) {
      git(["worktree", "remove", "--force", cleanup], cwd);
    }
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
