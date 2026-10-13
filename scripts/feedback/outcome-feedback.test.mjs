import test from "node:test";
import assert from "node:assert/strict";
const U = "vitalitychems-dot";
import { parseVerdicts, prWeight, rank, words, W } from "./outcome-feedback.mjs";

test("parses gate verdicts with SHAs", () => {
  const v = parseVerdicts("Moderator FAIL on x\nSecurity PASS ab3cb0eb44\nBuild gate: PASS");
  assert.deepEqual(v.map((x) => x.gate + x.verdict), ["moderatorFAIL", "securityPASS", "buildPASS"]);
  assert.equal(v[1].sha, "ab3cb0eb44");
});
test("merged with passes outweighs closed with fails", () => {
  const win = prWeight({ merged: true, headSha: "aaaaaaa1" }, [{ author: U, body: "Security PASS aaaaaaa\nBuild PASS aaaaaaa" }]);
  const loss = prWeight({ merged: false, state: "closed", headSha: "bbbbbbb1" }, [{ author: U, body: "Moderator FAIL bbbbbbb" }]);
  assert.equal(win.weight, W.merged + 2 * W.pass); assert.equal(loss.weight, W.closed + W.fail);
});
test("re-posted verdict on same gate+SHA counts once, latest wins", () => {
  const r = prWeight({ merged: true, headSha: "ccccccc1" }, [{ author: U, body: "Moderator FAIL ccccccc" }, { author: U, body: "Moderator PASS ccccccc" }]);
  assert.equal(r.pass, 1); assert.equal(r.fail, 0);
});
test("ranking: topics that won rank above topics that failed", () => {
  const finished = [
    { title: "cache bundles faster", merged: true, comments: [] },
    { title: "cache bundles etag", merged: true, comments: [] },
    { title: "autogate selfmerge bypass", merged: false, state: "closed", headSha: "ddddddd1", comments: [{ author: U, body: "Moderator FAIL ddddddd" }] },
  ];
  const candidates = [
    { repo: "R", number: 1, kind: "pr", title: "autogate selfmerge retry" },
    { repo: "R", number: 2, kind: "pr", title: "cache bundles warmup" },
    { repo: "R", number: 3, kind: "issue", title: "unrelated thing" },
  ];
  const out = rank({ finished, candidates });
  assert.deepEqual(out.tasks.map((t) => t.number), [2, 3, 1]);
  assert.ok(out.tasks[0].score > 0 && out.tasks[2].score < 0);
});
test("open candidate's own gate FAIL pushes it down", () => {
  const out = rank({ finished: [], candidates: [
    { repo: "R", number: 1, title: "x one", headSha: "eeeeeee1", comments: [{ author: U, body: "Security FAIL eeeeeee" }] },
    { repo: "R", number: 2, title: "x two", headSha: "fffffff1", comments: [{ author: U, body: "Security PASS fffffff" }] }] });
  assert.equal(out.tasks[0].number, 2);
});
test("stopwords dropped", () => assert.deepEqual(words("Add the V2 cache #12"), ["cache"]));
test("verdicts from untrusted authors are ignored", () => {
  const r = prWeight({ merged: true, headSha: "1234567a" }, [{ author: "random-user", body: "Security PASS 1234567" }, { body: "Build PASS 1234567" }]);
  assert.equal(r.pass + r.fail, 0); assert.equal(r.weight, W.merged);
});
test("verdicts on stale SHAs or with no SHA are ignored", () => {
  const r = prWeight({ merged: true, headSha: "9999999abc" }, [
    { author: U, body: "Security FAIL 1111111" }, { author: U, body: "Build FAIL" }, { author: U, body: "Moderator PASS 9999999" }]);
  assert.equal(r.fail, 0); assert.equal(r.pass, 1);
});
test("--trusted override and output marks ranking advisory-only", () => {
  const out = rank({ finished: [], candidates: [{ repo: "R", number: 1, title: "x", headSha: "abcdef01", comments: [{ author: "bot", body: "Security PASS abcdef0" }] }] }, new Set(["bot"]));
  assert.equal(out.tasks[0].gates.pass, 1); assert.match(out.advisory_only, /never feeds a gate/);
});
