import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compare } from "./scorecard.mjs";
import { compute, parseGain, parseTrusted, parseApps, gatedBy } from "./recursion_rate.mjs";
import { embed, recallAtK, measure } from "./recall_at_k.mjs";
import { sandboxArgs, runOnce, exportTrustedRunner, bwrapOk } from "./agi_proxy.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));

test("parseGain reads 'Gain: +N%' and defaults to 0", () => {
  assert.equal(parseGain("x\nGain: +12.5%\n"), 12.5);
  assert.equal(parseGain("**Gain:** -3%"), -3);
  assert.equal(parseGain("no gain line"), 0);
  assert.equal(parseGain(null), 0);
});
test("recursion_rate counts only trusted-author verdicts on the head SHA or gate check runs", () => {
  const now = "2026-10-13T12:00:00Z", T = parseTrusted("gatebot, Other");
  const prs = [
    { mergedAt: "2026-10-12T00:00:00Z", headSha: "abc1234ff", body: "Gain: +14%", texts: [{ author: "gatebot", body: "Security PASS abc1234" }] },
    { mergedAt: "2026-10-11T00:00:00Z", headSha: "def5678", body: "", checks: [{ name: "anything", conclusion: "SUCCESS", app: { slug: "gate-app", id: 42 } }] },
    { mergedAt: "2026-10-11T00:00:00Z", headSha: "aaa1111", body: "Gain: +99%", texts: [{ author: "randomuser", body: "Moderator PASS aaa1111" }] },
    { mergedAt: "2026-10-11T00:00:00Z", headSha: "bbb2222", body: "Gain: +99%", texts: [{ author: "gatebot", body: "Moderator PASS" }] },
    { mergedAt: "2026-10-11T00:00:00Z", headSha: "ccc3333", body: "Gain: +99%", texts: [{ author: "gatebot", body: "Build PASS 9999999" }] },
    { mergedAt: "2026-10-11T00:00:00Z", headSha: "ddd4444", body: "Gain: +99%", checks: [{ name: "build-gate", conclusion: "FAILURE" }, { name: "lint", conclusion: "SUCCESS" }] },
    { mergedAt: "2026-10-01T00:00:00Z", headSha: "eee5555", body: "Gain: +50%", texts: [{ author: "gatebot", body: "Moderator PASS eee5555" }] },
  ];
  const A = parseApps("gate-app");
  const r = compute(prs, now, T, A);
  assert.equal(r.gated_merged, 2);
  assert.equal(r.mean_gain_pct, 7);
  assert.equal(r.value, 2);
  assert.deepEqual(compute(prs, now, T, A), r);
  assert.equal(gatedBy(prs[0], T, A), "trusted_verdict");
  assert.equal(gatedBy(prs[1], T, A), "check_run");
  assert.equal(gatedBy(prs[1], T, parseApps("42")), "check_run");
});
test("recursion_rate fails closed with no trusted authors", () => {
  const prs = [{ mergedAt: "2026-10-12T00:00:00Z", headSha: "abc1234", body: "Gain: +14%", texts: [{ author: "x", body: "Security PASS abc1234" }] }];
  assert.equal(compute(prs, "2026-10-13T00:00:00Z", parseTrusted("")).gated_merged, 0);
});
test("compare fails only on a drop beyond the noise band", () => {
  const s = (a, b, c) => ({ agi_proxy: { value: a, noise_band: 0.01 }, consciousness_proxy: { value: b, noise_band: 0 }, recursion_rate: { value: c, noise_band: 0 } });
  assert.equal(compare(s(0.5, 0.9, 1), s(0.495, 0.9, 1)).verdict, "PASS");
  assert.equal(compare(s(0.5, 0.9, 1), s(0.48, 0.9, 1)).verdict, "FAIL");
  assert.equal(compare(s(null, 0.9, 1), s(null, 0.9, 1)).rows[0].verdict, "n/a");
  assert.equal(compare(s(0.5, 0.9, 1), s(null, 0.9, 1)).verdict, "FAIL");
});
test("agi_proxy sandbox args: no network, clean env, no box HOME/gh/workspace, read-only mounts", () => {
  const a = sandboxArgs("/r", "/d", "/p.json"), j = a.join(" ");
  for (const f of ["--unshare-all", "--clearenv", "--die-with-parent"]) assert.ok(a.includes(f), f);
  assert.match(j, /--setenv HOME \/tmp/);
  assert.match(j, /--ro-bind \/r \/sbx\/runner/); assert.match(j, /--ro-bind \/d \/sbx\/data/); assert.match(j, /--ro-bind \/p.json \/sbx\/preds.json/);
  assert.ok(!/\/home|\/workspace|\.config\/gh|GH_TOKEN/.test(j), j);
  assert.ok(!a.includes("--share-net"));
  assert.ok(a.includes("/sbx/runner/run.mjs"));
});
test("agi_proxy runner comes from the trusted ref, never the PR head", () => {
  const g = mkdtempSync(join(tmpdir(), "sc-git-")), git = (...x) => execFileSync("git", ["-C", g, ...x], { encoding: "utf8" });
  git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
  mkdirSync(join(g, "evals/heldout"), { recursive: true });
  writeFileSync(join(g, "evals/heldout/run.mjs"), "TRUSTED"); git("add", "."); git("commit", "-qm", "trusted"); git("branch", "trusted");
  writeFileSync(join(g, "evals/heldout/run.mjs"), "EVIL PR HEAD"); git("commit", "-qam", "pr");
  const t = exportTrustedRunner(g, ["trusted"]);
  assert.equal(readFileSync(join(t.dir, "run.mjs"), "utf8"), "TRUSTED");
  assert.ok(exportTrustedRunner(g, ["nope"]).why);
});
test("agi_proxy runs the runner sandboxed: no HOME, no env, no network", { skip: !bwrapOk() && "bwrap unavailable" }, () => {
  const r = mkdtempSync(join(tmpdir(), "sc-run-")), d = mkdtempSync(join(tmpdir(), "sc-data-"));
  writeFileSync(join(r, "run.mjs"), `import {existsSync} from "node:fs"; import {networkInterfaces} from "node:os";
const ifs = Object.keys(networkInterfaces()).filter((n) => n !== "lo");
const clean = process.env.HOME === "/tmp" && !process.env.GH_TOKEN && !existsSync("/home") && !existsSync("/workspace") && ifs.length === 0 && existsSync("/sbx/data/x");
console.log(JSON.stringify({ macro: clean ? 0.75 : 0 }));`);
  writeFileSync(join(d, "x"), "1");
  process.env.GH_TOKEN_TEST_CANARY = "secret";
  assert.deepEqual(runOnce(r, d), { macro: 0.75 });
});
test("box-run.sh is dry-run by default and only posts with --post", () => {
  const s = readFileSync(join(HERE, "box-run.sh"), "utf8");
  assert.match(s, /POST=0/); assert.match(s, /--post\) POST=1/);
  assert.match(s, /if \[\[ \$POST == 1 \]\]; then gh pr comment/);
  assert.equal((s.match(/gh pr comment/g) || []).length, 1);
  assert.equal(spawnSync("bash", [join(HERE, "box-run.sh"), "1", "abcdef1", "--bogus"]).status, 2);
});
const HEART = process.env.CONSCIOUSNESS_DIR || "/workspace/moderator-tools/consciousness-test";
const heartOk = ["score.py", "questions.json", "example_response.json", "example_truth.json"].every((f) => existsSync(join(HEART, f)));
test("consciousness_proxy uses score.py and is labeled a proxy", { skip: !heartOk && `Weighing-of-the-Heart files not found in ${HEART}` }, () => {
  const c = mkdtempSync(join(tmpdir(), "sc-c-"));
  const src = HEART;
  const resp = join(c, "resp"); mkdirSync(resp);
  writeFileSync(join(resp, "a.json"), readFileSync(join(src, "example_response.json")));
  const env = { ...process.env, CONSCIOUSNESS_DIR: src, CONSCIOUSNESS_TRUTH: join(src, "example_truth.json"), CONSCIOUSNESS_RESPONSES: resp };
  const o = JSON.parse(execFileSync("python3", [join(HERE, "consciousness_proxy.py"), "--runs", "3"], { env, encoding: "utf8" }));
  assert.match(o.label, /proxy, not a measure of consciousness/);
  assert.ok(o.value >= 0 && o.value <= 1); assert.equal(o.noise_band, 0); assert.equal(o.agents, 1);
  const none = JSON.parse(execFileSync("python3", [join(HERE, "consciousness_proxy.py"), "--runs", "1"], { env: { ...env, CONSCIOUSNESS_RESPONSES: join(c, "missing") }, encoding: "utf8" }));
  assert.equal(none.value, null);
});
test("check runs count only from allowlisted gate Apps; names are never trusted; empty by default", () => {
  const T = parseTrusted("");
  const mk = (c) => ({ mergedAt: "2026-10-12T00:00:00Z", headSha: "abc1234", body: "Gain: +10%", checks: [c] });
  const forged = [
    mk({ name: "Security gate", conclusion: "SUCCESS", app: { slug: "cursor", id: 1 } }),
    mk({ name: "build", conclusion: "SUCCESS", app: { slug: "github-actions", id: 15368 } }),
    mk({ name: "Moderator PASS", conclusion: "SUCCESS", app: null }),
    mk({ name: "x", conclusion: "FAILURE", app: { slug: "gate-app", id: 42 } }),
  ];
  assert.equal(compute(forged, "2026-10-13T00:00:00Z", T, parseApps("gate-app")).gated_merged, 0);
  const real = [mk({ name: "x", conclusion: "SUCCESS", app: { slug: "gate-app", id: 42 } })];
  assert.equal(compute(real, "2026-10-13T00:00:00Z", T, parseApps("")).gated_merged, 0);
  delete process.env.TRUSTED_GATE_APPS;
  assert.equal(compute(real, "2026-10-13T00:00:00Z", T).gated_merged, 0);
  assert.equal(compute(real, "2026-10-13T00:00:00Z", T, parseApps("gate-app")).gated_merged, 1);
});
test("vitalitychems-dot is never a trusted verdict author, even if listed", () => {
  assert.equal(parseTrusted("vitalitychems-dot").size, 0);
  assert.deepEqual([...parseTrusted("Vitalitychems-Dot, gatebot")], ["gatebot"]);
  const prs = [{ mergedAt: "2026-10-12T00:00:00Z", headSha: "abc1234", body: "Gain: +10%", texts: [{ author: "vitalitychems-dot", body: "Security PASS abc1234" }] }];
  assert.equal(compute(prs, "2026-10-13T00:00:00Z", parseTrusted("vitalitychems-dot"), parseApps("")).gated_merged, 0);
  delete process.env.TRUSTED_VERDICT_AUTHORS;
  assert.equal(compute(prs, "2026-10-13T00:00:00Z").gated_merged, 0);
});
test("recall@k math: perfect, partial and zero rankings", () => {
  const fx = { docs: [{ id: "a", content: "x" }, { id: "b", content: "y" }, { id: "c", content: "z" }], queries: [{ q: "q1", relevant: ["a", "b"] }, { q: "q2", relevant: ["c"] }] };
  assert.equal(recallAtK(() => ["a", "b", "c"], fx, 5), 1);
  assert.equal(recallAtK(() => ["a"], fx, 1), 0.25);
  assert.equal(recallAtK(() => [], fx, 5), 0);
  assert.deepEqual(embed("hello"), embed("hello"));
});
test("recall_at_5 prints a deterministic score for hybrid-search, or null on a missing module", async () => {
  const repo = join(HERE, "../..");
  const r = await measure(repo, 5);
  if (r.why) { assert.match(r.why, /Node >= 22.18|missing/); return; }
  assert.ok(r.hybrid >= 0 && r.hybrid <= 1, String(r.hybrid));
  assert.deepEqual(await measure(repo, 5), r);
  assert.ok((await measure(mkdtempSync(join(tmpdir(), "sc-rk-")), 5)).why);
  const o = JSON.parse(execFileSync(process.execPath, [join(HERE, "recall_at_k.mjs"), "--runs", "3"], { encoding: "utf8" }));
  assert.equal(o.name, "recall_at_5"); assert.equal(o.value, r.hybrid); assert.equal(o.noise_band, 0);
});
