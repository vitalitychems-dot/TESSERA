import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  AUTHOR,
  buildPrCreateArgs,
  createPrGate,
  ensureCheckout,
  forbiddenCommand,
  isDryRun,
  isLockedPath,
  pickTopUnfinished,
  parseGoals,
} from "./selfbuild.mjs";

const scriptPath = fileURLToPath(new URL("./selfbuild.mjs", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/NEXT.md", import.meta.url));
const source = readFileSync(scriptPath, "utf8");

function git(repo, args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), "selfbuild-"));
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "README.md"), "base\n");
  git(dir, ["add", "README.md"]);
  git(dir, ["commit", "-m", "base"]);
  return dir;
}

function addBareRemote(repo) {
  const bare = mkdtempSync(join(tmpdir(), "selfbuild-bare-"));
  const init = spawnSync("git", ["init", "--bare", "-b", "main", bare], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  git(repo, ["remote", "add", "origin", bare]);
  git(repo, ["push", "-u", "origin", "main"]);
  return bare;
}

function writeGhShim(binDir) {
  mkdirSync(binDir, { recursive: true });
  const log = join(binDir, "gh.log");
  const shim = join(binDir, "gh");
  writeFileSync(
    shim,
    `#!/bin/sh
printf '\\n--GH--\\n' >> "$GH_LOG"
printf '%s\\0' "$@" >> "$GH_LOG"
if [ "$1" = "pr" ] && [ "$2" = "create" ]; then
  printf '%s\\n' "https://example.test/pull/1"
  exit 0
fi
printf '%s\\n' "not found" >&2
exit 1
`,
  );
  chmodSync(shim, 0o755);
  return { log, shim };
}

function ghRecords(log) {
  if (!existsSync(log)) return [];
  return readFileSync(log, "utf8")
    .split("\n--GH--\n")
    .filter(Boolean)
    .map((record) => record.split("\0").filter((part) => part !== ""));
}

function childEnv(binDir, extra = {}) {
  const env = { ...process.env };
  delete env.DRY_RUN;
  delete env.SELFBUILD_BUILDER;
  delete env.SELFBUILD_OFFLINE;
  delete env.SELFBUILD_GOALS;
  Object.assign(env, extra);
  if (binDir) {
    env.PATH = `${binDir}:${process.env.PATH}`;
    env.GH_LOG = join(binDir, "gh.log");
  }
  return env;
}

function writeScript(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function runCli(args, env) {
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8", env });
}

test("offline fallback reads the local goal file when gh api fails", () => {
  const repo = initRepo();
  const bin = mkdtempSync(join(tmpdir(), "selfbuild-gh-"));
  const { log } = writeGhShim(bin);
  const plan = join(repo, "plan.md");
  const result = runCli(
    ["--goals", fixturePath, "--repo", repo, "--plan", plan, "--metrics", join(repo, "metrics.json")],
    childEnv(bin),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /dry_run=1/);
  assert.match(result.stdout, /goal=SB-1/);
  assert.match(result.stdout, /api_calls=1/);
  assert.match(result.stdout, /goals_source=local/);
  assert.match(result.stdout, /prs_opened=0/);
  assert.match(result.stdout, /clone=reuse/);
  const records = ghRecords(log);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].slice(0, 1), ["api"]);
  assert.match(records[0].join(" "), /direction\/NEXT\.md/);
  assert.equal(records.some((record) => record[0] === "pr"), false);
  const planText = readFileSync(plan, "utf8");
  assert.match(planText, /goal: SB-1/);
  assert.doesNotMatch(planText, /goal: SB-0/);
  assert.doesNotMatch(planText, /goal: SB-2/);
  const goals = parseGoals(readFileSync(fixturePath, "utf8"));
  assert.equal(pickTopUnfinished(goals).id, "SB-1");
  assert.equal(goals[0].done, true);
});

test("one draft pull request per run", () => {
  const gate = createPrGate();
  let opens = 0;
  const first = gate.tryOpen({ title: "one" }, () => {
    opens += 1;
    return { ok: true, url: "https://example.test/pull/1" };
  });
  const second = gate.tryOpen({ title: "two" }, () => {
    opens += 1;
    return { ok: true, url: "https://example.test/pull/2" };
  });
  assert.equal(first.ok, true);
  assert.equal(second.refused, true);
  assert.equal(opens, 1);

  const args = buildPrCreateArgs({
    title: "selfbuild: SB-1",
    body: "Tests before: pass 2 / fail 0 / total 2\n",
    base: "main",
    head: "selfbuild/SB-1-20261013",
  });
  assert.equal(args.includes("--draft"), true);
  assert.equal(forbiddenCommand("gh", args), false);
  assert.equal(forbiddenCommand("git", ["push", "--delete", "origin", "old"]), true);
  assert.equal(forbiddenCommand("git", ["reset", "--hard"]), true);
  assert.equal(forbiddenCommand("gh", ["pr", "merge", "1"]), true);
  assert.equal(source.includes('"pr", "merge"'), false);
  assert.equal(source.includes('["push", "--delete"'), false);
  assert.equal(source.includes('["reset", "--hard"'), false);
  assert.equal(source.includes('["branch", "-D"'), false);

  const repo = initRepo();
  const bare = addBareRemote(repo);
  const bin = mkdtempSync(join(tmpdir(), "selfbuild-gh-"));
  const { log } = writeGhShim(bin);
  const countFile = join(bin, "count.txt");
  const counterPath = join(bin, "counter.mjs");
  writeFileSync(
    counterPath,
    `import { readFileSync, writeFileSync } from "node:fs";
let n = 0;
try { n = Number(readFileSync(process.env.SELFBUILD_COUNT, "utf8")); } catch { n = 0; }
n += 1;
writeFileSync(process.env.SELFBUILD_COUNT, String(n));
const pass = n === 1 ? 2 : 3;
console.log("# tests " + pass);
console.log("# pass " + pass);
console.log("# fail 0");
`,
  );
  const builderPath = join(bin, "builder.sh");
  writeScript(builderPath, "#!/bin/sh\nmkdir -p notes\nprintf 'health\\n' > notes/health.txt\n");
  const result = runCli(
    ["--goals", fixturePath, "--repo", repo, "--plan", join(repo, "selfbuild-plan.md")],
    childEnv(bin, {
      DRY_RUN: "0",
      SELFBUILD_DAY: "20261013",
      SELFBUILD_COUNT: countFile,
      SELFBUILD_TEST_CMD: `node ${counterPath}`,
      SELFBUILD_BUILDER: `sh ${builderPath}`,
    }),
  );
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /dry_run=0/);
  assert.match(result.stdout, /goal=SB-1/);
  assert.match(result.stdout, /prs_opened=1/);
  const creates = ghRecords(log).filter((record) => record[0] === "pr" && record[1] === "create");
  assert.equal(creates.length, 1);
  const body = creates[0].join("\n");
  assert.match(body, /Tests before: pass 2 \/ fail 0 \/ total 2/);
  assert.match(body, /Tests after: pass 3 \/ fail 0 \/ total 3/);
  assert.match(body, new RegExp(AUTHOR.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(creates[0].includes("--draft"), true);
  assert.equal(creates[0].includes("merge"), false);
  assert.equal(creates[0].includes("--delete"), false);
  const subject = git(repo, ["log", "-1", "--format=%s"]).stdout.trim();
  assert.match(subject, /SB-1/);
  assert.doesNotMatch(subject, /SB-2/);
  const identity = git(repo, ["log", "-1", "--format=%an%n%ae%n%cn%n%ce"]).stdout.trim().split("\n");
  assert.deepEqual(identity, [AUTHOR.name, AUTHOR.email, AUTHOR.name, AUTHOR.email]);
  const remoteHeads = spawnSync("git", ["--git-dir", bare, "branch"], { encoding: "utf8" });
  assert.match(remoteHeads.stdout, /selfbuild\/SB-1-20261013/);
  assert.equal((remoteHeads.stdout.match(/selfbuild\//g) ?? []).length, 1);
});

test("locked-path refusal leaves the files uncommitted and opens no pull request", () => {
  for (const path of [
    ".github/workflows/ci.yml",
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "rules/LAW.md",
    ".cursor/rules/secret.mdc",
    "gates/keep.md",
    "tools/pregate",
    "scripts/historical-merge-gate.mjs",
  ]) {
    assert.equal(isLockedPath(path), true, path);
  }
  assert.equal(isLockedPath("scripts/selfbuild/selfbuild.mjs"), false);
  assert.equal(isLockedPath("notes/health.txt"), false);

  const repo = initRepo();
  const bare = addBareRemote(repo);
  const bin = mkdtempSync(join(tmpdir(), "selfbuild-gh-"));
  const { log } = writeGhShim(bin);
  const marker = join(repo, "pregate-ran");
  const builderPath = join(bin, "builder.sh");
  writeScript(
    builderPath,
    `#!/bin/sh
mkdir -p .github/workflows rules gates tools
printf 'name: added\\n' > .github/workflows/added.yml
printf '* @nobody\\n' > CODEOWNERS
printf 'no\\n' > rules/LAW.md
printf 'no\\n' > gates/keep.md
cat > tools/pregate <<'EOF'
#!/bin/sh
echo ran > "$SELFBUILD_RAN"
EOF
chmod +x tools/pregate
`,
  );
  const result = runCli(
    ["--offline", "--goals", fixturePath, "--repo", repo, "--plan", join(repo, "selfbuild-plan.md")],
    childEnv(bin, {
      DRY_RUN: "0",
      SELFBUILD_DAY: "20261013",
      SELFBUILD_RAN: marker,
      SELFBUILD_TEST_CMD: "printf '%s\\n' '# tests 1' '# pass 1' '# fail 0'",
      SELFBUILD_BUILDER: `sh ${builderPath}`,
    }),
  );
  assert.equal(result.status, 2, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stderr, /locked/);
  assert.match(result.stdout, /prs_opened=0/);
  assert.equal(existsSync(marker), false);
  assert.equal(existsSync(join(repo, ".github/workflows/added.yml")), true);
  assert.equal(existsSync(join(repo, "CODEOWNERS")), true);
  assert.equal(existsSync(join(repo, "rules/LAW.md")), true);
  assert.equal(existsSync(join(repo, "gates/keep.md")), true);
  assert.equal(git(repo, ["rev-list", "--count", "HEAD"]).stdout.trim(), "1");
  assert.equal(ghRecords(log).some((record) => record[0] === "pr"), false);
  const remoteHeads = spawnSync("git", ["--git-dir", bare, "branch"], { encoding: "utf8" });
  assert.doesNotMatch(remoteHeads.stdout, /selfbuild/);
});

test("dry-run is the default and does not open a pull request", () => {
  assert.equal(isDryRun({}), true);
  assert.equal(isDryRun({ DRY_RUN: "" }), true);
  assert.equal(isDryRun({ DRY_RUN: "1" }), true);
  assert.equal(isDryRun({ DRY_RUN: "0" }), false);

  const repo = initRepo();
  const bin = mkdtempSync(join(tmpdir(), "selfbuild-gh-"));
  const { log } = writeGhShim(bin);
  const plan = join(repo, "plan.md");
  const result = runCli(
    ["--offline", "--goals", fixturePath, "--repo", repo, "--plan", plan],
    childEnv(bin),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /dry_run=1/);
  assert.match(result.stdout, /api_calls=0/);
  assert.match(result.stdout, /prs_opened=0/);
  assert.match(result.stdout, /clone=reuse/);
  assert.equal(existsSync(plan), true);
  assert.match(readFileSync(plan, "utf8"), /dry_run: 1/);
  assert.equal(ghRecords(log).length, 0);
  assert.equal(git(repo, ["rev-list", "--count", "HEAD"]).stdout.trim(), "1");
  assert.equal(source.includes("workflow_dispatch"), false);
  assert.equal(source.includes("cron:"), false);
});

test("reuses an existing checkout and clones a missing one with --filter=blob:none", () => {
  const calls = [];
  const record = (args) => {
    calls.push(args);
    return { status: 0, stdout: "", stderr: "" };
  };
  const existing = initRepo();
  const reused = ensureCheckout({
    repoPath: existing,
    remote: "https://example.test/TESSERA.git",
    dryRun: false,
    runGit: record,
  });
  assert.equal(reused.action, "reuse");
  assert.equal(calls.length, 0);

  const missing = join(tmpdir(), `selfbuild-missing-${process.pid}-${Date.now()}`);
  const cloned = ensureCheckout({
    repoPath: missing,
    remote: "https://example.test/TESSERA.git",
    dryRun: false,
    runGit: record,
  });
  assert.equal(cloned.action, "clone");
  assert.deepEqual(calls[0].slice(0, 3), ["clone", "--filter=blob:none", "--no-tags"]);
  assert.equal(calls[0][3], "https://example.test/TESSERA.git");
  assert.equal(calls[0][4], missing);
  assert.equal(existsSync(missing), false);

  calls.length = 0;
  const dryMissing = join(tmpdir(), `selfbuild-dry-${process.pid}-${Date.now()}`);
  const skipped = ensureCheckout({
    repoPath: dryMissing,
    remote: "https://example.test/TESSERA.git",
    dryRun: true,
    runGit: record,
  });
  assert.equal(skipped.action, "skip-clone");
  assert.equal(calls.length, 0);

  const occupied = mkdtempSync(join(tmpdir(), "selfbuild-occupied-"));
  writeFileSync(join(occupied, "keep.txt"), "do not delete\n");
  const refused = ensureCheckout({
    repoPath: occupied,
    remote: "https://example.test/TESSERA.git",
    dryRun: false,
    runGit: record,
  });
  assert.equal(refused.action, "refuse");
  assert.equal(calls.length, 0);
  assert.equal(readFileSync(join(occupied, "keep.txt"), "utf8"), "do not delete\n");
});
