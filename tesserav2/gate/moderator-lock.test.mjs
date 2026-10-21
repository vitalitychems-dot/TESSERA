import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, globToRegExp, lockedHits, parseLockList } from "./moderator-lock.mjs";
import { readFileSync } from "node:fs";

const locked = parseLockList(readFileSync(new URL("./locked-paths.txt", import.meta.url), "utf8"));
const HEAD = "a".repeat(40);
const base = (o = {}) => ({ headSha: HEAD, lockedPatterns: locked, prAuthor: "vitalitychems-dot",
  agentLogins: ["vitalitychems-dot"], files: [{ filename: "docs/notes.md", status: "modified", additions: 3, deletions: 1, patch: "+hello" }], ...o });
const apps = { moderator: 101, security: 102, build: 103 };
const run = (id, slug, sha = HEAD, conclusion = "success") => ({ app: { id, slug }, head_sha: sha, conclusion });
const allRuns = [run(101, "tessera-moderator"), run(102, "tessera-security"), run(103, "tessera-build")];

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

test("review from the shared agent account cannot unlock", () => {
  const r = evaluate(base({ fatherLogin: "vitalitychems-dot", files: [{ filename: "CODEOWNERS", additions: 1 }],
    reviews: [{ user: { login: "vitalitychems-dot" }, state: "APPROVED", commit_id: HEAD }] }));
  assert.equal(r.lock.pass, false);
  assert.match(r.lock.reasons[0], /forged/);
});

test("review from a separate Father account on head unlocks; stale review does not", () => {
  const f = { fatherLogin: "father-only", files: [{ filename: "CODEOWNERS", additions: 1 }] };
  assert.equal(evaluate(base({ ...f, reviews: [{ user: { login: "father-only" }, state: "APPROVED", commit_id: HEAD }] })).lock.pass, true);
  assert.equal(evaluate(base({ ...f, reviews: [{ user: { login: "father-only" }, state: "APPROVED", commit_id: "b".repeat(40) }] })).lock.pass, false);
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

import { mergeBotEnabled } from "./moderator-lock.mjs";
test("kill switch: only exact '1' enables; missing/unknown is off", () => {
  assert.equal(mergeBotEnabled(readFileSync(new URL("./MERGE_BOT_ENABLED", import.meta.url), "utf8")), false);
  for (const v of [undefined, "", "true", "yes", "01", "1 # on"]) assert.equal(mergeBotEnabled(v), false, String(v));
  assert.equal(mergeBotEnabled("1\n"), true);
});
