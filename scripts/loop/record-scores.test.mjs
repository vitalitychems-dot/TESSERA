import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./record-scores.sh", import.meta.url));
const scriptText = readFileSync(script, "utf8");

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

test("the recorder never force-pushes and does not unstage snapshots", () => {
  assert.equal(scriptText.includes("--force"), false);
  assert.equal(scriptText.includes("--cached"), false);
  assert.equal(scriptText.includes("|| true"), false);
  assert.match(scriptText, /git rm -q --ignore-unmatch --/);
});

test("a second publish fast-forwards onto gate-scores", () => {
  const { work } = setup();
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

test("prune deletes old snapshots and leaves 90 dated files plus latest and heartbeat", () => {
  const { work } = setup();
  git(work, ["sparse-checkout", "disable"]);
  git(work, ["switch", "--orphan", "seed-scores"]);
  mkdirSync(join(work, "scores"), { recursive: true });
  for (let i = 1; i <= 96; i += 1) {
    const name = `20200101T0000-${String(i).padStart(4, "0")}.json`;
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

  const result = publish(work, "c".repeat(40));
  assert.equal(result.status, 0, result.stderr);
  const paths = scorePaths(work);
  const dated = paths.filter((line) => /scores\/2[^/]*\.json$/.test(line));
  assert.equal(dated.length, 90);
  assert.equal(paths.length, 92);
  assert.equal(paths.includes("scores/20200101T0000-0001.json"), false);
  assert.equal(paths.includes("scores/20200101T0000-0096.json"), true);
  assert.equal(paths.includes("scores/latest.json"), true);
  assert.equal(paths.includes("scores/heartbeat.json"), true);
  const tipParents = git(work, ["rev-parse", "origin/gate-scores^"]).stdout.trim();
  assert.equal(tipParents.length, 40);
});

test("a rejected push is retried once on the new tip", () => {
  const { dir, bare, work } = setup();
  const seed = publish(work, "d".repeat(40));
  assert.equal(seed.status, 0, seed.stderr);
  const marker = join(dir, "reject-once");
  const hook = `#!/bin/bash
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

test("a real git rm failure stops the publish", () => {
  const { dir, work } = setup();
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const gitPath = spawnSync("bash", ["-lc", "command -v git"], { encoding: "utf8" }).stdout.trim();
  writeFileSync(join(bin, "git"), `#!/bin/bash
if [[ "$1" == "rm" ]]; then
  echo "fatal: simulated rm failure" >&2
  exit 1
fi
exec ${gitPath} "$@"
`);
  chmodSync(join(bin, "git"), 0o755);
  const result = publish(work, "f".repeat(40), { PATH: `${bin}:${process.env.PATH}`, SCORE_KEEP: "0" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /simulated rm failure/);
  const remote = spawnSync("git", ["ls-remote", "--exit-code", "origin", "refs/heads/gate-scores"], {
    cwd: work,
    encoding: "utf8",
  });
  assert.equal(remote.status, 2);
});
