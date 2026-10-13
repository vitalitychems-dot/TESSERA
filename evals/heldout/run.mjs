#!/usr/bin/env node
// Held-out eval runner. The scoring data is NOT in this public repo; it lives in the
// private Gitbook repo (evals/heldout/data + MANIFEST.sha256). Point HELDOUT_DIR (or --data)
// at that directory. The runner verifies every data file against the manifest and fails
// closed on drift, then scores. Predicted code runs only inside ./sandbox.mjs.
//   HELDOUT_DIR=/path/to/Gitbook/evals/heldout node evals/heldout/run.mjs --baseline
//   ... --gold                 harness self-check with reference answers (expect 1.0)
//   ... --predictions p.json   {"<id>": "<answer | python code | pass|fail>"}
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runPySandboxed } from "./sandbox.mjs";

export function resolveDir(argv = process.argv.slice(2), env = process.env) {
  const i = argv.indexOf("--data");
  const d = i >= 0 ? argv[i + 1] : env.HELDOUT_DIR;
  if (!d) throw new Error("set HELDOUT_DIR or --data to the private held-out directory (Gitbook evals/heldout)");
  return resolve(d);
}
export function manifestLines(root) {
  const dir = join(root, "data");
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()
    .map((f) => `${createHash("sha256").update(readFileSync(join(dir, f))).digest("hex")}  data/${f}`);
}
export function verifyManifest(root) {
  const mp = join(root, "MANIFEST.sha256");
  if (!existsSync(mp)) return { ok: false, bad: ["missing MANIFEST.sha256"] };
  const want = readFileSync(mp, "utf8").trim().split("\n");
  const got = manifestLines(root);
  const bad = want.filter((l) => !got.includes(l)).concat(got.filter((l) => !want.includes(l)));
  return { ok: bad.length === 0, bad };
}
const load = (root, f) => {
  const p = join(root, "data", f);
  return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};
export function normNum(s) {
  const m = String(s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/g);
  return m ? Number(m[m.length - 1]) : NaN;
}
export function score(root, pred, { run = (c) => runPySandboxed(c).ok } = {}) {
  const suites = {};
  const add = (s, ok) => { (suites[s] ??= { n: 0, pass: 0 }).n++; if (ok) suites[s].pass++; };
  for (const it of load(root, "gsm8k.jsonl")) add("gsm8k", it.id in pred && normNum(pred[it.id]) === Number(it.answer));
  for (const it of load(root, "humaneval.jsonl")) {
    const c = pred[it.id];
    add("humaneval", typeof c === "string" && c.length > 0 && run(`${it.prompt}${c}\n\n${it.test}\ncheck(${it.entry_point})\n`));
  }
  for (const it of load(root, "mbpp.jsonl")) {
    const c = pred[it.id];
    add("mbpp", typeof c === "string" && c.length > 0 && run(`${it.test_setup_code}\n${c}\n${it.test_list.join("\n")}\n`));
  }
  for (const it of load(root, "pr-outcomes.jsonl")) add("pr_outcome", pred[it.id] === it.outcome);
  for (const s of Object.values(suites)) s.score = +(s.pass / s.n).toFixed(4);
  const keys = Object.keys(suites);
  return { suites, macro: keys.length ? +(keys.reduce((a, k) => a + suites[k].score, 0) / keys.length).toFixed(4) : 0 };
}
export function baselinePreds(root) {
  const p = {}; // no model: empty answers for benchmarks, majority class for PR outcomes
  for (const it of load(root, "pr-outcomes.jsonl")) p[it.id] = "pass";
  return p;
}
export function goldPreds(root) {
  const p = {};
  for (const it of load(root, "gsm8k.jsonl")) p[it.id] = it.answer;
  for (const it of load(root, "humaneval.jsonl")) p[it.id] = it.canonical_solution;
  for (const it of load(root, "mbpp.jsonl")) p[it.id] = it.code;
  for (const it of load(root, "pr-outcomes.jsonl")) p[it.id] = it.outcome;
  return p;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const root = resolveDir(a);
  const v = verifyManifest(root);
  if (!v.ok) { console.error("MANIFEST MISMATCH (held-out set changed):\n" + v.bad.join("\n")); process.exit(2); }
  const i = a.indexOf("--predictions");
  const preds = i >= 0 ? JSON.parse(readFileSync(a[i + 1], "utf8")) : a.includes("--gold") ? goldPreds(root) : baselinePreds(root);
  console.log(JSON.stringify(score(root, preds), null, 2));
}
