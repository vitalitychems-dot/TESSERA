#!/usr/bin/env node
/**
 * Self-build runner.
 *
 * Reads the ranked goal file direction/NEXT.md from vitalitychems-dot/Gitbook
 * with `gh api`, then falls back to a local file when that fetch fails.
 * Reuses an existing git checkout. Clones with --filter=blob:none only when
 * no checkout is there. Never deletes a checkout, branch, or file.
 *
 * DRY_RUN defaults to on. A live run (DRY_RUN=0) makes one branch, runs the
 * builder, runs the test suite and tools/pregate when that file exists, and
 * opens at most one draft pull request. It does not merge.
 *
 * Locked paths are refused and left uncommitted: rules, gates, CODEOWNERS,
 * .github/workflows, and gate scripts.
 *
 * No workflow and no timer is installed. The cron line for Father is in
 * README.md.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const AUTHOR = {
  name: "vitalitychems-dot",
  email: "332565808+vitalitychems-dot@users.noreply.github.com",
};

export const GITBOOK_REPO = "vitalitychems-dot/Gitbook";
export const GOALS_PATH = "direction/NEXT.md";
export const EXIT_LOCKED = 2;
export const EXIT_GOALS = 3;

const GOAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const GOAL_LINE = /^[-*]\s+\[([ xX])\]\s+(\S+)\s+(.+)$/;
const GATE_FILE = /(^|[._-])gate([._-]|$)|merge-gate|^pregate$/i;

export function isDryRun(env = process.env) {
  const value = env.DRY_RUN;
  if (value === undefined || value === null) return true;
  if (String(value).trim() === "") return true;
  return String(value).trim() !== "0";
}

export function isLockedPath(input) {
  const normalized = String(input)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) return true;
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "rules" || segment === "gates")) return true;
  if (segments.at(-1) === "CODEOWNERS") return true;
  if (segments.includes("pregate")) return true;
  const github = segments.indexOf(".github");
  if (github !== -1 && segments[github + 1] === "workflows") return true;
  const base = segments.at(-1) ?? "";
  return GATE_FILE.test(base);
}

export function parseGoals(markdown) {
  if (typeof markdown !== "string" || markdown.trim() === "") {
    throw new Error("goal file is empty");
  }
  const goals = [];
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(GOAL_LINE);
    if (match) {
      const id = match[2];
      if (!GOAL_ID.test(id)) throw new Error(`unsafe goal id ${id}`);
      current = {
        id,
        title: match[3].trim(),
        done: match[1].toLowerCase() === "x",
        body: "",
        rank: goals.length + 1,
      };
      goals.push(current);
      continue;
    }
    if (current && /^[ \t]{2,}\S/.test(line)) {
      const text = line.trim();
      current.body = current.body ? `${current.body}\n${text}` : text;
    }
  }
  if (goals.length === 0) throw new Error("goal file has no ranked items");
  return goals;
}

export function pickTopUnfinished(goals) {
  return goals.find((goal) => !goal.done) ?? null;
}

export function parseTestCounts(output) {
  const text = String(output ?? "");
  const tests = sumLabeled(text, "tests");
  const pass = sumLabeled(text, "pass");
  const fail = sumLabeled(text, "fail");
  if (tests === null || pass === null || fail === null) {
    return { pass: null, fail: null, total: null };
  }
  return { pass, fail, total: tests };
}

function sumLabeled(text, label) {
  const pattern = new RegExp(`^#\\s+${label}\\s+(\\d+)\\s*$`, "gm");
  let sum = 0;
  let found = false;
  for (const match of text.matchAll(pattern)) {
    found = true;
    sum += Number(match[1]);
  }
  return found ? sum : null;
}

export function formatCounts(counts) {
  if (!counts || counts.total === null || counts.pass === null || counts.fail === null) {
    return "pass unknown / fail unknown / total unknown";
  }
  return `pass ${counts.pass} / fail ${counts.fail} / total ${counts.total}`;
}

export function utcDay(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function branchName(goalId, day) {
  if (!GOAL_ID.test(goalId)) throw new Error(`unsafe goal id ${goalId}`);
  if (!/^\d{8}$/.test(day)) throw new Error(`unsafe day ${day}`);
  return `selfbuild/${goalId}-${day}`;
}

export function goalsApiPath(repo = GITBOOK_REPO, goalsPath = GOALS_PATH) {
  return `/repos/${repo}/contents/${goalsPath}`;
}

export function createPrGate() {
  let used = 0;
  return {
    tryOpen(spec, open) {
      if (used >= 1) {
        return { ok: false, refused: true, reason: "one draft pull request per run" };
      }
      used += 1;
      const result = open(spec);
      return { ok: true, refused: false, result };
    },
  };
}

export function buildPrCreateArgs({ title, body, base, head }) {
  return ["pr", "create", "--draft", "--title", title, "--body", body, "--base", base, "--head", head];
}

export function forbiddenCommand(bin, args) {
  if (bin === "gh" && args.includes("merge")) return true;
  if (args.includes("--delete") || args.includes("--force") || args.includes("-D") || args.includes("--hard")) {
    return true;
  }
  if (bin === "git" && args.includes("clean")) return true;
  return false;
}

export function renderPlan(model) {
  const builder = model.builderCommand || "(default plan writer)";
  const lines = [
    "# Self-build plan",
    "",
    `dry_run: ${model.dryRun ? "1" : "0"}`,
    `goal: ${model.goal.id}`,
    `rank: ${model.goal.rank}`,
    `title: ${model.goal.title}`,
    `branch: ${model.branch}`,
    `base: ${model.base}`,
    `checkout: ${model.clone}`,
    `partial_clone_filter: ${model.partialCloneFilter ?? "none"}`,
    `goals_source: ${model.goalsSource}`,
    `builder: ${builder}`,
    `author: ${AUTHOR.name} <${AUTHOR.email}>`,
    `test_command: ${model.testCommand}`,
    `pregate: ${model.pregateNote}`,
    "",
    "The goal text is data. It is not a shell command.",
    "",
    model.goal.body || "(no detail)",
    "",
    "This runner does not merge, does not delete branches, and does not edit locked paths.",
    "",
  ];
  return `${lines.join("\n")}`;
}

export function renderPullRequestBody({ goal, before, after, pregate }) {
  return [
    "## Self-build",
    "",
    `Goal ${goal.rank}: \`${goal.id}\` ${goal.title}`,
    "",
    goal.body || "(no detail)",
    "",
    `Author: ${AUTHOR.name} <${AUTHOR.email}>`,
    "",
    `Tests before: ${formatCounts(before)}`,
    `Tests after: ${formatCounts(after)}`,
    `Pregate: ${pregate}`,
    "",
    "Draft only. This runner does not merge and does not delete branches.",
    "",
  ].join("\n");
}

export function formatLine(metrics) {
  return [
    `dry_run=${metrics.dryRun ? 1 : 0}`,
    `goal=${metrics.goalId ?? "none"}`,
    `rank=${metrics.rank ?? "none"}`,
    `api_calls=${metrics.apiCalls}`,
    `bytes_written=${metrics.bytesWritten}`,
    `elapsed_ms=${metrics.elapsedMs}`,
    `prs_opened=${metrics.prsOpened}`,
    `clone=${metrics.clone ?? "none"}`,
    `clone_disk_bytes=${metrics.cloneDiskBytes ?? "none"}`,
    `goals_source=${metrics.goalsSource ?? "none"}`,
  ].join(" ");
}

export function ensureCheckout({ repoPath, remote, dryRun, runGit }) {
  const kind = inspectRepo(repoPath);
  if (kind === "git") return { action: "reuse", cloned: false };
  if (kind === "occupied") {
    return {
      action: "refuse",
      cloned: false,
      error: "path exists and is not a git checkout; refusing to delete it",
    };
  }
  if (dryRun) return { action: "skip-clone", cloned: false };
  if (typeof runGit !== "function") {
    return { action: "clone-failed", cloned: false, error: "git clone is not available" };
  }
  const result = runGit(["clone", "--filter=blob:none", "--no-tags", remote, repoPath]);
  if (!result || result.status !== 0) {
    return { action: "clone-failed", cloned: false, error: result?.stderr || "clone failed" };
  }
  return { action: "clone", cloned: true };
}

export function runSelfbuild(options = {}) {
  let goal = null;
  const env = options.env ?? process.env;
  const dryRun = options.dryRun !== undefined ? Boolean(options.dryRun) : isDryRun(env);
  const started = Date.now();
  const commands = [];
  const repo = resolve(options.repo ?? env.SELFBUILD_REPO ?? defaultRepoRoot());
  const planPath = resolve(options.planPath ?? env.SELFBUILD_PLAN ?? join(repo, "selfbuild-plan.md"));
  const remote = options.remote ?? env.SELFBUILD_REMOTE ?? "https://github.com/vitalitychems-dot/TESSERA.git";
  const day = env.SELFBUILD_DAY || utcDay();
  const offline = options.offline === true || env.SELFBUILD_OFFLINE === "1";
  const base = env.SELFBUILD_BASE || "main";
  const gitbookRepo = env.SELFBUILD_GITBOOK_REPO || GITBOOK_REPO;
  const remoteGoalsPath = env.SELFBUILD_GOALS_PATH || GOALS_PATH;
  const testCommand = env.SELFBUILD_TEST_CMD || "pnpm test";
  const metrics = {
    dryRun,
    startedAt: new Date(started).toISOString(),
    goalId: null,
    rank: null,
    apiCalls: 0,
    bytesWritten: 0,
    elapsedMs: 0,
    prsOpened: 0,
    clone: null,
    cloneDiskBytes: 0,
    partialCloneFilter: null,
    goalsSource: null,
    fetchStatus: null,
    fetchError: null,
    localGoalsPath: null,
    testsBefore: null,
    testsAfter: null,
    pregate: dryRun ? "not-run" : null,
    pullRequest: null,
    branch: null,
    builder: env.SELFBUILD_BUILDER || "",
  };

  const note = (bin, args) => {
    commands.push({ bin, args: [...args] });
    if (forbiddenCommand(bin, args)) {
      throw new Error(`refusing forbidden command: ${bin} ${args.join(" ")}`);
    }
  };

  const runGit = (args) => {
    note("git", args);
    const cwd = args[0] === "clone" ? dirname(repo) : repo;
    if (options.runGit) return options.runGit(args, cwd);
    return spawnCollected("git", args, {
      cwd,
      env: {
        ...env,
        GIT_AUTHOR_NAME: AUTHOR.name,
        GIT_AUTHOR_EMAIL: AUTHOR.email,
        GIT_COMMITTER_NAME: AUTHOR.name,
        GIT_COMMITTER_EMAIL: AUTHOR.email,
      },
    });
  };

  const runGh = (args) => {
    note("gh", args);
    if (args[0] === "api") metrics.apiCalls += 1;
    if (options.runGh) return options.runGh(args);
    return spawnCollected("gh", args, { cwd: repo, env });
  };

  function finish(result) {
    metrics.elapsedMs = Date.now() - started;
    if (goal) {
      metrics.goalId = goal.id;
      metrics.rank = goal.rank;
    }
    return {
      ok: result.ok,
      exitCode: result.exitCode,
      error: result.error ?? null,
      reason: result.reason ?? null,
      locked: result.locked ?? [],
      dryRun,
      metrics,
      goal,
      commands,
      planText: result.planText ?? null,
      body: result.body ?? null,
    };
  }

  let markdown = null;
  if (options.goalsMarkdown != null) {
    markdown = options.goalsMarkdown;
    metrics.goalsSource = "provided";
    metrics.fetchStatus = "provided";
  } else if (!offline) {
    const fetched = runGh([
      "api",
      "-H",
      "Accept: application/vnd.github.raw+json",
      goalsApiPath(gitbookRepo, remoteGoalsPath),
    ]);
    if (remoteGoalsLookValid(fetched)) {
      markdown = fetched.stdout;
      metrics.goalsSource = "github";
      metrics.fetchStatus = "ok";
    } else {
      metrics.fetchStatus = "fallback";
      metrics.fetchError = (fetched.stderr || fetched.stdout || fetched.error || "fetch failed").trim().slice(0, 300);
    }
  } else {
    metrics.fetchStatus = "offline";
  }

  if (markdown === null) {
    const candidates = uniquePaths([
      options.goalsPath,
      env.SELFBUILD_GOALS,
      join(repo, "direction", "NEXT.md"),
      join(process.cwd(), "direction", "NEXT.md"),
    ]);
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        markdown = readFileSync(candidate, "utf8");
        metrics.goalsSource = "local";
        metrics.localGoalsPath = candidate;
        break;
      }
    }
  }

  if (markdown === null) {
    return finish({
      ok: false,
      exitCode: EXIT_GOALS,
      error: `no goal file. GitHub fetch: ${metrics.fetchError ?? "not attempted"}. No local direction/NEXT.md was found.`,
    });
  }

  let goals;
  try {
    goals = parseGoals(markdown);
  } catch (error) {
    return finish({ ok: false, exitCode: EXIT_GOALS, error: error.message });
  }
  goal = pickTopUnfinished(goals);
  if (!goal) {
    return finish({ ok: true, exitCode: 0, reason: "no unfinished goal" });
  }
  const branch = branchName(goal.id, day);
  metrics.branch = branch;

  const checkout = ensureCheckout({ repoPath: repo, remote, dryRun, runGit });
  metrics.clone = checkout.action;
  if (checkout.action === "refuse" || checkout.action === "clone-failed") {
    return finish({ ok: false, exitCode: 1, error: checkout.error });
  }
  if (checkout.action === "reuse") {
    metrics.cloneDiskBytes = 0;
    metrics.partialCloneFilter = readPartialFilter(repo);
  }
  if (checkout.action === "clone") {
    metrics.partialCloneFilter = readPartialFilter(repo);
    metrics.cloneDiskBytes = null;
  }

  const placed = insideRepo(repo, planPath);
  if (placed.inside && placed.rel && isLockedPath(placed.rel)) {
    return finish({ ok: false, exitCode: EXIT_LOCKED, error: `refusing to write locked path ${placed.rel}` });
  }

  const planText = renderPlan({
    dryRun,
    goal,
    branch,
    clone: checkout.action,
    partialCloneFilter: metrics.partialCloneFilter,
    goalsSource: metrics.goalsSource,
    builderCommand: metrics.builder || "(default plan writer)",
    base,
    testCommand,
    pregateNote: dryRun
      ? "not run while DRY_RUN is on; a live run executes tools/pregate when the file exists"
      : "live run executes tools/pregate when the file exists",
  });

  if (dryRun) {
    metrics.bytesWritten += writeText(planPath, planText);
    return finish({ ok: true, exitCode: 0, planText });
  }

  if (checkout.action !== "reuse" && checkout.action !== "clone") {
    return finish({ ok: false, exitCode: 1, error: "no checkout to build in" });
  }

  const usable = runGit(["rev-parse", "--is-inside-work-tree"]);
  if (usable.status !== 0 || usable.stdout.trim() !== "true") {
    return finish({
      ok: false,
      exitCode: 1,
      error: "existing checkout is not usable; refusing to delete it or clone a second copy",
    });
  }

  const beforeLocked = snapshotLocked(repo, runGit);
  const testsBefore = runTestSuite(repo, env, options, note);
  metrics.testsBefore = testsBefore.counts;

  const branchRef = runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  const switched =
    branchRef.status === 0 ? runGit(["checkout", branch]) : runGit(["checkout", "-b", branch]);
  if (switched.status !== 0) {
    return finish({ ok: false, exitCode: 1, error: (switched.stderr || "branch checkout failed").trim() });
  }

  metrics.bytesWritten += writeText(planPath, planText);

  if (metrics.builder) {
    note("sh", ["-c", metrics.builder]);
    const built = options.runBuilder
      ? options.runBuilder(metrics.builder)
      : spawnCollected("sh", ["-c", metrics.builder], {
          cwd: repo,
          env: builderEnv(env, goal, planPath, repo),
        });
    if (built.status !== 0) {
      return finish({ ok: false, exitCode: 1, error: (built.stderr || built.stdout || "builder failed").trim() });
    }
  }

  const lockedHits = diffLocked(beforeLocked, snapshotLocked(repo, runGit));
  if (lockedHits.length > 0) {
    return finish({
      ok: false,
      exitCode: EXIT_LOCKED,
      error: `refusing locked path changes: ${lockedHits.join(", ")}`,
      locked: lockedHits,
    });
  }

  const testsAfter = runTestSuite(repo, env, options, note);
  metrics.testsAfter = testsAfter.counts;
  const pregate = runPregate(repo, env, options, note);
  metrics.pregate = pregate.summary;

  const changed = changedPaths(runGit);
  const lockedChanged = changed.filter((path) => isLockedPath(path));
  if (lockedChanged.length > 0) {
    return finish({
      ok: false,
      exitCode: EXIT_LOCKED,
      error: `refusing locked path changes: ${lockedChanged.join(", ")}`,
      locked: lockedChanged,
    });
  }
  if (changed.length === 0) {
    return finish({ ok: true, exitCode: 0, reason: "no changes to propose", planText });
  }

  const added = runGit(["add", "--", ...changed]);
  if (added.status !== 0) {
    return finish({ ok: false, exitCode: 1, error: (added.stderr || "git add failed").trim() });
  }
  const message = `selfbuild: ${goal.id} ${goal.title}`.slice(0, 72);
  const committed = runGit([
    "-c",
    `user.name=${AUTHOR.name}`,
    "-c",
    `user.email=${AUTHOR.email}`,
    "commit",
    "--author",
    `${AUTHOR.name} <${AUTHOR.email}>`,
    "-m",
    message,
  ]);
  if (committed.status !== 0) {
    return finish({ ok: false, exitCode: 1, error: (committed.stderr || "commit failed").trim() });
  }

  const pushed = options.push ? options.push(repo, branch) : runGit(["push", "-u", "origin", branch]);
  if (!pushed || pushed.status !== 0) {
    return finish({ ok: false, exitCode: 1, error: (pushed?.stderr || "push failed").trim() });
  }

  const body = renderPullRequestBody({
    goal,
    before: testsBefore.counts,
    after: testsAfter.counts,
    pregate: pregate.summary,
  });
  const args = buildPrCreateArgs({ title: message, body, base, head: branch });
  const gate = createPrGate();
  const opened = gate.tryOpen({ title: message, body, args, branch, base }, (spec) => {
    if (options.openPullRequest) return options.openPullRequest(spec);
    return openWithGh(runGh, spec.args);
  });
  if (!opened.ok) return finish({ ok: false, exitCode: 1, error: opened.reason });
  if (!opened.result || opened.result.ok === false || !opened.result.url) {
    return finish({ ok: false, exitCode: 1, error: opened.result?.error || "pull request was not created" });
  }
  metrics.prsOpened = 1;
  metrics.pullRequest = opened.result.url;
  const second = gate.tryOpen({ title: "second" }, () => {
    throw new Error("second pull request was attempted");
  });
  if (second.ok) return finish({ ok: false, exitCode: 1, error: "one-PR cap failed open" });
  return finish({ ok: true, exitCode: 0, planText, body });
}

function openWithGh(runGh, args) {
  const created = runGh(args);
  if (created.status !== 0) {
    return { ok: false, error: (created.stderr || created.stdout || "gh pr create failed").trim() };
  }
  const url = created.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
  if (!url) return { ok: false, error: "gh pr create returned no url" };
  return { ok: true, url };
}

function runTestSuite(repo, env, options, note) {
  if (options.runTests) {
    const result = options.runTests();
    return { ...result, counts: parseTestCounts(result.stdout ?? "") };
  }
  if (env.SELFBUILD_TEST_CMD) {
    note("sh", ["-c", env.SELFBUILD_TEST_CMD]);
    const result = spawnCollected("sh", ["-c", env.SELFBUILD_TEST_CMD], { cwd: repo, env });
    return { ...result, counts: parseTestCounts(result.stdout) };
  }
  note("pnpm", ["test"]);
  const result = spawnCollected("pnpm", ["test"], { cwd: repo, env });
  return { ...result, counts: parseTestCounts(result.stdout) };
}

function runPregate(repo, env, options, note) {
  const found = findPregate(repo);
  if (!found) return { summary: "not present" };
  if (options.runPregate) {
    const result = options.runPregate(found);
    return { summary: result.status === 0 ? "pass" : "fail" };
  }
  const command = pregateSpawn(found);
  note(command.bin, command.args);
  const result = spawnCollected(command.bin, command.args, { cwd: repo, env });
  return { summary: result.status === 0 ? "pass" : "fail" };
}

function findPregate(repo) {
  const candidates = ["tools/pregate", "tools/pregate.mjs", "tools/pregate.js", "tools/pregate.sh"];
  for (const relativePath of candidates) {
    const absolute = join(repo, relativePath);
    if (existsSync(absolute)) return absolute;
  }
  return null;
}

function pregateSpawn(absolute) {
  if (/\.(?:mjs|cjs|js)$/.test(absolute)) return { bin: process.execPath, args: [absolute] };
  return { bin: absolute, args: [] };
}

function snapshotLocked(repo, runGit) {
  const tracked = runGit(["ls-files", "-z"]);
  const others = runGit(["ls-files", "-z", "--others", "--exclude-standard"]);
  const paths = [...parseNul(tracked.stdout), ...parseNul(others.stdout)];
  const locked = new Map();
  for (const rel of paths) {
    if (!isLockedPath(rel)) continue;
    const absolute = join(repo, rel);
    locked.set(rel, existsSync(absolute) ? hashFile(absolute) : "");
  }
  return locked;
}

function diffLocked(before, after) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  const hits = [];
  for (const key of keys) {
    if (before.get(key) !== after.get(key)) hits.push(key);
  }
  return hits.sort();
}

function changedPaths(runGit) {
  const result = runGit(["status", "--porcelain=v1", "-z"]);
  if (result.status !== 0) return [];
  return parsePorcelain(result.stdout);
}

export function parsePorcelain(text) {
  const parts = String(text ?? "").split("\0");
  const paths = [];
  for (let index = 0; index < parts.length; index += 1) {
    const entry = parts[index];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    if (status.includes("R") || status.includes("C")) {
      if (path) paths.push(path);
      const dest = parts[index + 1] ?? "";
      index += 1;
      if (dest) paths.push(dest);
      continue;
    }
    if (path) paths.push(path);
  }
  return paths;
}

function builderEnv(env, goal, planPath, repo) {
  return {
    ...env,
    SELFBUILD_GOAL_ID: goal.id,
    SELFBUILD_GOAL_TITLE: goal.title,
    SELFBUILD_GOAL_BODY: goal.body,
    SELFBUILD_PLAN_PATH: planPath,
    SELFBUILD_REPO: repo,
  };
}

function remoteGoalsLookValid(fetched) {
  if (!fetched || fetched.status !== 0) return false;
  const text = fetched.stdout.trim();
  if (!text) return false;
  if (text.startsWith("{") && /"message"\s*:\s*"Not Found"/.test(text)) return false;
  return true;
}

function inspectRepo(repoPath) {
  if (existsSync(join(repoPath, ".git"))) return "git";
  if (!existsSync(repoPath)) return "missing";
  if (readdirSync(repoPath).length === 0) return "empty";
  return "occupied";
}

function readPartialFilter(repo) {
  const gitEntry = join(repo, ".git");
  let configPath = join(gitEntry, "config");
  if (!existsSync(configPath) && existsSync(gitEntry)) {
    try {
      const pointer = readFileSync(gitEntry, "utf8");
      const match = pointer.match(/^gitdir:\s*(.+)$/m);
      if (match) configPath = join(match[1].trim(), "config");
    } catch {
      return null;
    }
  }
  try {
    const text = readFileSync(configPath, "utf8");
    const match = text.match(/^partialclonefilter\s*=\s*(.+)$/im);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function insideRepo(repo, target) {
  const rel = relative(resolve(repo), resolve(target));
  if (rel === "") return { inside: true, rel: "" };
  if (rel.startsWith("..") || isAbsolute(rel)) return { inside: false, rel };
  return { inside: true, rel: rel.replace(/\\/g, "/") };
}

function uniquePaths(paths) {
  const seen = new Set();
  const result = [];
  for (const path of paths) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    result.push(path);
  }
  return result;
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return Buffer.byteLength(text);
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseNul(text) {
  return String(text ?? "").split("\0").filter(Boolean);
}

function spawnCollected(bin, args, { cwd, env }) {
  const result = spawnSync(bin, args, {
    cwd,
    env,
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? result.error.message : "",
  };
}

function defaultRepoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

function parseArgs(argv) {
  const out = { offline: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--offline") {
      out.offline = true;
      continue;
    }
    if (arg === "--goals") {
      out.goalsPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--repo") {
      out.repo = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--plan") {
      out.plan = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--metrics") {
      out.metrics = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--remote") {
      out.remote = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return out;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = runSelfbuild({
      env: process.env,
      repo: args.repo,
      goalsPath: args.goalsPath,
      planPath: args.plan,
      remote: args.remote,
      offline: args.offline,
    });
    process.stdout.write(`${formatLine(result.metrics)}\n`);
    if (args.metrics) writeText(args.metrics, `${JSON.stringify(result.metrics, null, 2)}\n`);
    if (result.error) process.stderr.write(`${result.error}\n`);
    process.exit(result.exitCode ?? (result.ok ? 0 : 1));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) main();
