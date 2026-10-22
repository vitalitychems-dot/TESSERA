import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, globToRegExp, lockedHits, mergeBotEnabled, parseLockList } from "./moderator-lock.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRE_PASS = "jq -s -e 'length == 1 and (.[0] | type == \"object\" and .pass == true)'";

const locked = parseLockList(readFileSync(new URL("./locked-paths.txt", import.meta.url), "utf8"));
const HEAD = "a".repeat(40);
const base = (o = {}) => ({ headSha: HEAD, lockedPatterns: locked, prAuthor: "vitalitychems-dot",
  files: [{ filename: "docs/notes.md", status: "modified", additions: 3, deletions: 1, patch: "+hello" }], ...o });
const apps = { moderator: 101, security: 102, build: 103 };
const run = (id, slug, sha = HEAD, conclusion = "success") => ({ app: { id, slug }, head_sha: sha, conclusion });
const allRuns = [run(101, "tessera-moderator"), run(102, "tessera-security"), run(103, "tessera-build")];

function bash(script) {
  try {
    execFileSync("bash", ["-eo", "pipefail", "-c", script], { cwd: ROOT, encoding: "utf8" });
    return 0;
  } catch (error) {
    return error.status ?? 1;
  }
}

test("clean PR passes the lock", () => assert.equal(evaluate(base()).lock.pass, true));

test("fake PR touching each locked area fails closed", () => {
  for (const f of [".github/workflows/ci.yml", "CODEOWNERS", "gate/moderator-rules.md", "gate/moderator-lock.mjs"]) {
    const r = evaluate(base({ files: [{ filename: f, status: "modified", additions: 1, deletions: 0 }] }));
    assert.equal(r.lock.pass, false, f);
    assert.match(r.lock.reasons[0], /fail closed/);
  }
});

test("'FATHER APPROVED <sha>' comment is ignored (forgeable)", () => {
  const r = evaluate(base({ files: [{ filename: "CODEOWNERS", additions: 1 }], comments: [{ body: `FATHER APPROVED ${HEAD}`, user: { login: "vitalitychems-dot" } }] }));
  assert.equal(r.lock.pass, false);
  assert.ok(r.lock.notes.some((n) => /forgeable/.test(n)));
});

test("no GitHub login unlocks a locked path; FATHERLOGIN set or unset is the same", () => {
  const touched = { filename: ".github/workflows/moderator-lock.yml", additions: 1, status: "modified" };
  const logins = ["collink1007", "COLLINK1007", "vitalitychems-dot", "pen-author", "dependabot[bot]", "octocat", ""];
  for (const login of logins) {
    const common = {
      files: [touched],
      prAuthor: "pen-author",
      reviews: [{ user: { login }, state: "APPROVED", commit_id: HEAD }],
    };
    const reasons = [];
    for (const fatherLogin of [undefined, "", "collink1007", "COLLINK1007"]) {
      const input = fatherLogin === undefined ? base(common) : base({ ...common, fatherLogin });
      const result = evaluate(input);
      assert.equal(result.lock.pass, false, JSON.stringify({ login, fatherLogin }));
      assert.equal(result.lock.notes.some((n) => /approved by/.test(n)), false);
      reasons.push(result.lock.reasons);
    }
    for (const reason of reasons) assert.deepEqual(reason, reasons[0]);
  }
});

test("renaming the lock workflow out of .github/ is caught via previous_filename", () => {
  const moved = { filename: "docs/moderator-lock.yml", additions: 1, status: "renamed" };
  assert.equal(evaluate(base({ files: [moved] })).lock.pass, true);
  const r = evaluate(base({ files: [{ ...moved, previous_filename: ".github/workflows/moderator-lock.yml" }] }));
  assert.equal(r.lock.pass, false);
  assert.ok(r.lock.lockedHits.includes(".github/workflows/moderator-lock.yml"));
});

test("renaming the locked-paths list out of /gate/ is caught via previous_filename", () => {
  const moved = { filename: "docs/locked-paths.txt", additions: 1, status: "renamed" };
  assert.equal(evaluate(base({ files: [moved] })).lock.pass, true);
  const r = evaluate(base({ files: [{ ...moved, previous_filename: "gate/locked-paths.txt" }] }));
  assert.equal(r.lock.pass, false);
  assert.ok(r.lock.lockedHits.includes("gate/locked-paths.txt"));
});

test("renaming CODEOWNERS out of a locked path is caught via previous_filename", () => {
  for (const previous of [".github/CODEOWNERS", "CODEOWNERS"]) {
    const moved = { filename: "docs/CODEOWNERS", additions: 1, status: "renamed" };
    assert.equal(evaluate(base({ files: [moved] })).lock.pass, true, previous);
    const r = evaluate(base({ files: [{ ...moved, previous_filename: previous }] }));
    assert.equal(r.lock.pass, false, previous);
    assert.ok(r.lock.lockedHits.includes(previous), previous);
  }
});

test("null or empty files, null or empty patterns, [] and malformed input fail closed", () => {
  assert.match(evaluate(base({ files: null })).lock.reasons[0], /empty files/);
  assert.match(evaluate(base({ files: [] })).lock.reasons[0], /empty files/);
  assert.match(evaluate(base({ files: undefined })).lock.reasons[0], /empty files/);
  assert.match(evaluate(base({ lockedPatterns: null })).lock.reasons[0], /empty locked patterns/);
  assert.match(evaluate(base({ lockedPatterns: [] })).lock.reasons[0], /empty locked patterns/);
  assert.match(evaluate(base({ lockedPatterns: undefined })).lock.reasons[0], /empty locked patterns/);
  for (const input of [[], null, "[]", 1, "not-json"]) {
    const r = evaluate(input);
    assert.equal(r.lock.pass, false, JSON.stringify(input));
    assert.equal(r.gates.pass, false, JSON.stringify(input));
    assert.match(r.lock.reasons[0], /malformed input/);
  }
});

test("a locked-patterns list with a non-string or empty entry fails closed", () => {
  const clean = [{ filename: "docs/notes.md", additions: 1, patch: "+hello" }];
  for (const lockedPatterns of [["/.github/", ""], ["/.github/", "   "], [1], [null], ["/.github/", 0], [{}], [""]]) {
    const r = evaluate(base({ files: clean, lockedPatterns }));
    assert.equal(r.lock.pass, false, JSON.stringify(lockedPatterns));
    assert.match(r.lock.reasons[0], /non-string or empty entry/);
  }
});

test("CLI rejects [] and malformed JSON with pass false", () => {
  const dir = mkdtempSync(join(tmpdir(), "mlock-cli-"));
  try {
    for (const body of ["[]", "{", ""]) {
      const file = join(dir, "input.json");
      writeFileSync(file, body);
      let code = 0;
      let stdout = "";
      try {
        stdout = execFileSync(process.execPath, ["gate/moderator-lock.mjs", "lock", file], { cwd: ROOT, encoding: "utf8" });
      } catch (error) {
        code = error.status ?? 1;
        stdout = `${error.stdout ?? ""}`;
      }
      assert.notEqual(code, 0, body);
      assert.equal(JSON.parse(stdout).pass, false, body);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ENABLE flip, non-zero new flag, secret, delete, wallet path, size cap all fail", () => {
  const cases = [
    { filename: "config/x.env", additions: 1, patch: "+TESSERA_ENABLE_FOO=1" },
    { filename: "lib/f.ts", additions: 1, patch: "+  TESSERA_NEWTHING: '1'," },
    { filename: "lib/k.ts", additions: 1, patch: "+const t='ghp_" + "x".repeat(30) + "'" },
    { filename: "lib/old.ts", status: "removed", deletions: 5 },
    { filename: "lib/wallet/send.ts", additions: 1 },
    { filename: "lib/big.ts", additions: 401 },
  ];
  for (const c of cases) assert.equal(evaluate(base({ files: [c] })).lock.pass, false, c.filename);
  assert.equal(evaluate(base({ files: [{ filename: "lib/f.ts", additions: 1, patch: "+TESSERA_NEWTHING=0" }] })).lock.pass, true);
});

test("synthetic-only win claim fails", () => {
  assert.equal(evaluate(base({ prBody: "20% faster (synthetic-only fixture)" })).lock.pass, false);
});

test("gates: unconfigured apps fail closed", () => {
  assert.equal(evaluate(base({ checkRuns: allRuns })).gates.pass, false);
});

test("gates: all three app checks on head pass; PASS comments do not", () => {
  assert.equal(evaluate(base({ gateApps: apps, checkRuns: allRuns })).gates.pass, true);
  assert.equal(evaluate(base({ gateApps: apps, checkRuns: [], comments: [{ body: `Moderator PASS ${HEAD}` }] })).gates.pass, false);
});

test("gates: stale SHA, wrong app id, self-approval all fail", () => {
  const stale = [run(101, "tessera-moderator", "c".repeat(40)), allRuns[1], allRuns[2]];
  assert.match(evaluate(base({ gateApps: apps, checkRuns: stale })).gates.reasons.join(), /stale/);
  const imposter = [run(999, "tessera-moderator"), allRuns[1], allRuns[2]];
  assert.equal(evaluate(base({ gateApps: apps, checkRuns: imposter })).gates.pass, false);
  const self = evaluate(base({ gateApps: apps, checkRuns: allRuns, prAuthor: "tessera-moderator[bot]" }));
  assert.match(self.gates.reasons.join(), /self-pass/);
});

test("glob semantics match CODEOWNERS style", () => {
  assert.ok(globToRegExp("/.github/").test(".github/workflows/a.yml"));
  assert.ok(globToRegExp("*.prompt.md").test("a/b/x.prompt.md"));
  assert.ok(!globToRegExp("/gate/").test("docs/gate/x.md"));
  assert.deepEqual(lockedHits(["README.md"], locked), []);
});

test("kill switch: only exact '1' enables; missing/unknown is off", () => {
  assert.equal(mergeBotEnabled(readFileSync(new URL("./MERGE_BOT_ENABLED", import.meta.url), "utf8")), false);
  for (const v of [undefined, "", "true", "yes", "01", "1 # on"]) assert.equal(mergeBotEnabled(v), false, String(v));
  assert.equal(mergeBotEnabled("1\n"), true);
});

test("workflow keeps pull_request_target, leaves login vars unread, and checks pass with jq -s", () => {
  const yml = readFileSync(new URL("../.github/workflows/moderator-lock.yml", import.meta.url), "utf8");
  assert.match(yml, /pull_request_target:/);
  assert.match(yml, /persist-credentials: false/);
  assert.match(yml, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(yml, /timeout-minutes: 5/);
  assert.match(yml, /cancel-in-progress: true/);
  assert.equal(yml.includes("${{ vars.FATHERLOGIN"), false);
  assert.equal(yml.includes("${{ vars.FATHER_LOGIN"), false);
  assert.equal(yml.includes("${{ vars.AGENT_LOGINS"), false);
  assert.match(yml, /FATHERLOGIN and FATHER_LOGIN are left in place and are not read/);
  assert.equal(yml.split("\n").filter((line) => line.trim() === "shell: bash").length, 2);
  assert.equal([...yml.matchAll(/tee -a "\$GITHUB_STEP_SUMMARY"/g)].length, 2);
  assert.ok(yml.includes(REQUIRE_PASS));
});

test("pass:false decision exits non-zero under bash -eo pipefail", () => {
  const dir = mkdtempSync(join(tmpdir(), "mlock-step-"));
  const inputPath = join(dir, "input.json");
  const summary = join(dir, "summary.md");
  const decision = join(dir, "lock-decision.json");
  writeFileSync(summary, "");
  writeFileSync(inputPath, JSON.stringify(base({
    files: [{ filename: ".github/CODEOWNERS", additions: 1 }],
  })));
  const script = [
    `export GITHUB_STEP_SUMMARY=${JSON.stringify(summary)}`,
    `node gate/moderator-lock.mjs lock ${JSON.stringify(inputPath)} | tee -a "$GITHUB_STEP_SUMMARY" > ${JSON.stringify(decision)}`,
    `${REQUIRE_PASS} ${JSON.stringify(decision)} >/dev/null`,
  ].join("\n");
  try {
    assert.notEqual(bash(script), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("jq -s -e rejects bad decisions and accepts one pass:true object", () => {
  const dir = mkdtempSync(join(tmpdir(), "mlock-jq-"));
  const summary = join(dir, "summary.md");
  writeFileSync(summary, "");
  const cases = [
    ["pass false", "{\"pass\":false}\n", 1],
    ["string true", "\"true\"\n", 1],
    ["pass string true", "{\"pass\":\"true\"}\n", 1],
    ["boolean true", "true\n", 1],
    ["two objects", "{\"pass\":true}\n{\"pass\":true}\n", 1],
    ["empty", "", 1],
    ["non-json", "not-json\n", 1],
    ["pass true", "{\"pass\":true}\n", 0],
  ];
  try {
    for (const [name, body, expected] of cases) {
      const source = join(dir, "source.json");
      const decision = join(dir, "decision.json");
      writeFileSync(source, body);
      const script = [
        `export GITHUB_STEP_SUMMARY=${JSON.stringify(summary)}`,
        `tee -a "$GITHUB_STEP_SUMMARY" < ${JSON.stringify(source)} > ${JSON.stringify(decision)}`,
        `${REQUIRE_PASS} ${JSON.stringify(decision)} >/dev/null`,
      ].join("\n");
      assert.equal(bash(script) === 0, expected === 0, name);
    }
    const clean = join(dir, "clean.json");
    writeFileSync(clean, JSON.stringify(base()));
    const pretty = join(dir, "pretty.json");
    const script = [
      `export GITHUB_STEP_SUMMARY=${JSON.stringify(summary)}`,
      `node gate/moderator-lock.mjs lock ${JSON.stringify(clean)} | tee -a "$GITHUB_STEP_SUMMARY" > ${JSON.stringify(pretty)}`,
      `${REQUIRE_PASS} ${JSON.stringify(pretty)} >/dev/null`,
    ].join("\n");
    assert.equal(bash(script), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
