#!/usr/bin/env node
// Held-out eval per improvement, run on the box (#21).
// 1) runs `node --test run.test.mjs` (harness self-test); if anything fails, nothing is scored (fail closed);
// 2) scores the private held-out set with run.mjs (manifest-verified; predicted code only in sandbox.mjs);
// 3) appends ONE aggregate line to a local log: improvement id, git SHA, test counts, per-suite scores, macro.
// Items, answers and predictions are never logged. The log lives outside git (out/ is ignored).
//   HELDOUT_DIR=/path/Gitbook/evals/heldout node evals/heldout/per-improvement.mjs --improvement 18 [--predictions p.json] [--log FILE]
import { spawnSync, execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDir, verifyManifest, score, baselinePreds } from "./run.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOG = join(HERE, "out/per-improvement.jsonl");

export function parseTapCounts(out) {
  const n = (k) => { const m = out.match(new RegExp(`^# ${k} (\\d+)`, "m")); return m ? +m[1] : null; };
  return { tests: n("tests"), pass: n("pass"), fail: n("fail"), skipped: n("skipped") };
}
export function runSelfTest(testFile = join(HERE, "run.test.mjs")) {
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", testFile], { encoding: "utf8", timeout: 300_000 });
  const c = parseTapCounts(r.stdout || "");
  return { ...c, ok: r.status === 0 && c.fail === 0 && c.pass > 0 };
}
const gitSha = () => { try { return execFileSync("git", ["-C", HERE, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return null; } };

export function evalImprovement({ improvement, dataDir, preds, log = DEFAULT_LOG, now = new Date().toISOString(), selfTest = runSelfTest, scoreFn = score }) {
  if (!improvement) throw new Error("--improvement is required");
  const t = selfTest();
  const row = { at: now, improvement: String(improvement), sha: gitSha(), tests: { pass: t.pass, fail: t.fail, skipped: t.skipped }, macro: null, suites: null };
  if (!t.ok) row.note = "run.test.mjs failed: not scored";
  else {
    const v = verifyManifest(dataDir);
    if (!v.ok) row.note = "manifest mismatch: not scored";
    else {
      const s = scoreFn(dataDir, preds ?? baselinePreds(dataDir));
      row.macro = s.macro;
      row.suites = Object.fromEntries(Object.entries(s.suites).map(([k, x]) => [k, { n: x.n, score: x.score }]));
      row.preds = preds ? "supplied" : "baseline";
    }
  }
  mkdirSync(dirname(log), { recursive: true });
  appendFileSync(log, JSON.stringify(row) + "\n");
  return row;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const p = opt("--predictions");
  const row = evalImprovement({ improvement: opt("--improvement"), dataDir: resolveDir(a), preds: p && JSON.parse(readFileSync(p, "utf8")), log: opt("--log") ?? DEFAULT_LOG });
  console.log(JSON.stringify(row));
  process.exitCode = row.macro == null ? 1 : 0;
}
