import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./record-scores.sh", import.meta.url));
const scriptText = readFileSync(script, "utf8");
const gitPath = spawnSync("bash", ["-lc", "command -v git"], { encoding: "utf8" }).stdout.trim();

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "record-scores-"));
  const bare = join(dir, "remote.git");
  const work = join(dir, "work");
  git(dir, ["init", "--bare", "-b", "main", bare]);
  git(dir, ["init", "-b", "main", work]);
  git(work, ["config", "user.email", "t@example.com"]);
  git(work, ["config", "user.name", "t"]);
  mkdirSync(join(work, "scripts/loop"), { recursive: true });
  writeFileSync(join(work, "scripts/loop/a.txt"), "loop\n");
  git(work, ["add", "scripts"]);
  git(work, ["commit", "-qm", "init"]);
  git(work, ["remote", "add", "origin", bare]);
  git(work, ["push", "-q", "origin", "HEAD:main"]);
  git(work, ["sparse-checkout", "set", "--cone", "scripts/loop"]);
  writeFileSync(join(work, "scores.json"), "{\"pass\":1}\n");
  writeFileSync(join(work, "findings.json"), "[]\n");
  return { dir, bare, work };
}

function withRepo(fn) {
  const repo = setup();
  try {
    fn(repo);
  } finally {
    rmSync(repo.dir, { recursive: true, force: true });
  }
}

function publish(work, sha, env = {}) {
  return spawnSync("bash", [script], {
    cwd: work,
    encoding: "utf8",
    env: { ...process.env, GITHUB_SHA: sha, SCORE_KEEP: "90", ...env },
  });
}

function scorePaths(work) {
  return git(work, ["ls-tree", "-r", "--name-only", "origin/gate-scores"])
    .stdout.split("\n").filter((line) => line.startsWith("scores/"));
}

function datedPaths(paths) {
  return paths.filter((line) => /scores\/2[^/]*\.json$/.test(line));
}

function installGit(bin, body) {
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "git"), `#!/bin/bash\n${body}\n`);
  chmodSync(join(bin, "git"), 0o755);
}

function seedDated(work, count, prefix) {
  git(work, ["sparse-checkout", "disable"]);
  git(work, ["switch", "--orphan", "seed-scores"]);
  mkdirSync(join(work, "scores"), { recursive: true });
  for (let i = 1; i <= count; i += 1) {
    const name = `${prefix}-${String(i).padStart(4, "0")}.json`;
    writeFileSync(join(work, "scores", name), `${i}\n`);
  }
  writeFileSync(join(work, "scores/latest.json"), "{\"pass\":0}\n");
  git(work, ["add", "scores"]);
  git(work, ["commit", "-qm", "seed"]);
  git(work, ["push", "-q", "origin", "HEAD:gate-scores"]);
  git(work, ["switch", "-q", "main"]);
  git(work, ["sparse-checkout", "set", "--cone", "scripts/loop"]);
  writeFileSync(join(work, "scores.json"), "{\"pass\":1}\n");
  writeFileSync(join(work, "findings.json"), "[]\n");
}

test("the recorder never force-pushes and does not swallow a push error", () => {
  assert.equal(scriptText.includes("--force"), false);
  assert.equal(scriptText.includes("--cached"), false);
  assert.equal(scriptText.includes("|| true"), false);
  assert.equal(scriptText.includes("|| :"), false);
  assert.match(scriptText, /git rm -q --ignore-unmatch --/);
  assert.match(scriptText, /printf 'gate-scores push failed\\n%s\\n' "\$push_out"/);
});

test("a second publish fast-forwards onto gate-scores", () => {
  withRepo(({ work }) => {
    const first = publish(work, "a".repeat(40));
    assert.equal(first.status, 0, first.stderr);
    const second = publish(work, "b".repeat(40));
    assert.equal(second.status, 0, second.stderr);
    const parents = git(work, ["rev-list", "--parents", "origin/gate-scores"]).stdout.trim().split("\n");
    assert.equal(parents.length, 2);
    const [tip, tipParent] = parents[0].split(" ");
    const [root] = parents[1].split(" ");
    assert.equal(tipParent, root);
    assert.equal(parents[1].includes(" "), false);
    const tree = git(work, ["ls-tree", "-r", "--name-only", tip]).stdout;
    assert.equal(tree.includes("scripts/"), false);
  });
});

test("prune deletes old snapshots and leaves 90 dated files plus latest and heartbeat", () => {
  withRepo(({ work }) => {
    seedDated(work, 96, "20200101T0000");
    const result = publish(work, "c".repeat(40));
    assert.equal(result.status, 0, result.stderr);
    const paths = scorePaths(work);
    const dated = datedPaths(paths);
    assert.equal(dated.length, 90);
    assert.equal(paths.length, 92);
    assert.equal(paths.includes("scores/20200101T0000-0001.json"), false);
    assert.equal(paths.includes("scores/20200101T0000-0096.json"), true);
    assert.equal(paths.includes("scores/latest.json"), true);
    assert.equal(paths.includes("scores/heartbeat.json"), true);
    const tipParents = git(work, ["rev-parse", "origin/gate-scores^"]).stdout.trim();
    assert.equal(tipParents.length, 40);
  });
});

test("future-dated snapshots cannot prune the file just written", () => {
  withRepo(({ dir, work }) => {
    seedDated(work, 90, "20990101T0000");
    const bin = join(dir, "bin");
    // Checkout replaces mtimes. Reapply a future mtime once the files are on disk,
    // which is before the new snapshot is written and pruned.
    installGit(bin, `
"${gitPath}" "$@"
status=$?
if [[ "$1" == "sparse-checkout" || "$1" == "switch" ]]; then
  shopt -s nullglob
  files=(scores/2*.json)
  if (( \${#files[@]} )); then
    touch -d "2099-01-01T00:00:00Z" "\${files[@]}"
  fi
fi
exit "$status"
`);
    const result = publish(work, "9".repeat(40), { PATH: `${bin}:${process.env.PATH}` });
    assert.equal(result.status, 0, result.stderr);
    const dated = datedPaths(scorePaths(work));
    assert.equal(dated.length, 90);
    assert.equal(dated.some((line) => line.endsWith("-99999999.json")), true);
    assert.equal(dated.includes("scores/20990101T0000-0001.json"), false);
    assert.equal(dated.includes("scores/20990101T0000-0090.json"), true);
  });
});

test("a rejected push is retried once on the new tip", () => {
  withRepo(({ dir, bare, work }) => {
    const seed = publish(work, "d".repeat(40));
    assert.equal(seed.status, 0, seed.stderr);
    const marker = join(dir, "reject-once");
    const hook = `#!/bin/bash
cat >/dev/null
unset GIT_QUARANTINE_PATH GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com
export GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com
if [[ ! -f ${marker} ]]; then
  touch ${marker}
  new=$(git commit-tree refs/heads/gate-scores^{tree} -p refs/heads/gate-scores -m concurrent)
  git update-ref refs/heads/gate-scores "$new"
  echo "rejected non-fast-forward" >&2
  exit 1
fi
exit 0
`;
    writeFileSync(join(bare, "hooks/pre-receive"), hook);
    chmodSync(join(bare, "hooks/pre-receive"), 0o755);
    const result = publish(work, "e".repeat(40));
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /retrying once/);
    const lines = git(bare, ["rev-list", "--parents", "gate-scores"]).stdout.trim().split("\n");
    assert.equal(lines.length, 3);
    const [tip, tipParent] = lines[0].split(" ");
    const [injected, injectedParent] = lines[1].split(" ");
    assert.equal(tipParent, injected);
    assert.equal(injectedParent.length, 40);
    assert.equal(git(bare, ["log", "-1", "--format=%s", tip]).stdout.trim(), "scores: eeeeeeee");
    assert.equal(git(bare, ["log", "-1", "--format=%s", injected]).stdout.trim(), "concurrent");
  });
});

test("two rejections leave gate-scores unchanged", () => {
  withRepo(({ dir, bare, work }) => {
    const seed = publish(work, "1".repeat(40));
    assert.equal(seed.status, 0, seed.stderr);
    const before = git(bare, ["rev-parse", "gate-scores"]).stdout.trim();
    const count = join(dir, "reject-count");
    writeFileSync(count, "0\n");
    const hook = `#!/bin/bash
cat >/dev/null
n=$(cat ${count})
n=$((n + 1))
printf '%s\\n' "$n" > ${count}
if (( n <= 2 )); then
  echo "rejected non-fast-forward" >&2
  exit 1
fi
exit 0
`;
    writeFileSync(join(bare, "hooks/pre-receive"), hook);
    chmodSync(join(bare, "hooks/pre-receive"), 0o755);
    const result = publish(work, "2".repeat(40));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /gate-scores push failed/);
    assert.match(result.stderr, /rejected non-fast-forward/);
    assert.equal(readFileSync(count, "utf8").trim(), "2");
    assert.equal(git(bare, ["rev-parse", "gate-scores"]).stdout.trim(), before);
  });
});

test("a non-rejection push error is not retried", () => {
  withRepo(({ dir, bare, work }) => {
    const seed = publish(work, "3".repeat(40));
    assert.equal(seed.status, 0, seed.stderr);
    const before = git(bare, ["rev-parse", "gate-scores"]).stdout.trim();
    git(work, ["remote", "set-url", "--push", "origin", join(dir, "not-a-repo")]);
    const fetches = join(dir, "fetches");
    writeFileSync(fetches, "");
    installGit(join(dir, "bin"), `
if [[ "$1" == "fetch" ]]; then
  printf x >> ${fetches}
fi
exec ${gitPath} "$@"
`);
    const result = publish(work, "4".repeat(40), { PATH: `${join(dir, "bin")}:${process.env.PATH}` });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /gate-scores push failed/);
    assert.match(result.stderr, /does not appear to be a git repository/);
    assert.equal(result.stderr.includes("retrying once"), false);
    assert.equal(readFileSync(fetches, "utf8"), "x");
    assert.equal(git(bare, ["rev-parse", "gate-scores"]).stdout.trim(), before);
  });
});

test("a missing remote fails without a retry", () => {
  withRepo(({ work }) => {
    const result = publish(work, "5".repeat(40), { SCORE_REMOTE: "/no/such/gate-scores-remote" });
    assert.notEqual(result.status, 0);
    assert.equal(result.stderr.includes("retrying once"), false);
    assert.equal(result.stderr.includes("gate-scores push failed"), false);
  });
});

test("a real git rm failure stops the publish", () => {
  withRepo(({ dir, bare, work }) => {
    seedDated(work, 1, "20200101T0000");
    const before = git(bare, ["rev-parse", "gate-scores"]).stdout.trim();
    installGit(join(dir, "bin"), `
if [[ "$1" == "rm" ]]; then
  echo "fatal: simulated rm failure" >&2
  exit 1
fi
exec ${gitPath} "$@"
`);
    const result = publish(work, "f".repeat(40), {
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      SCORE_KEEP: "1",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /simulated rm failure/);
    assert.equal(git(bare, ["rev-parse", "gate-scores"]).stdout.trim(), before);
  });
});
