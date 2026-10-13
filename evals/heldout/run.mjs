#!/usr/bin/env node
// Held-out eval runner. Verifies data/ against MANIFEST.sha256 (fails closed on drift), then scores.
//   node evals/heldout/run.mjs --baseline          majority/empty baseline (no model)
//   node evals/heldout/run.mjs --gold              harness self-check using reference answers (expect 100%)
//   node evals/heldout/run.mjs --predictions p.json   {"<id>": "<answer | python code | pass|fail>"}
//   node evals/heldout/run.mjs --write-manifest    regenerate the manifest (reviewable diff)
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
const MANIFEST = join(HERE, "MANIFEST.sha256");

export function manifestLines(dir = DATA) {
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()
    .map((f) => `${createHash("sha256").update(readFileSync(join(dir, f))).digest("hex")}  data/${f}`);
}
export function verifyManifest(dir = DATA, manifestPath = MANIFEST) {
  const want = readFileSync(manifestPath, "utf8").trim().split("\n");
  const got = manifestLines(dir);
  const bad = want.filter((l) => !got.includes(l)).concat(got.filter((l) => !want.includes(l)));
  return { ok: bad.length === 0, bad };
}
export const load = (f, dir = DATA) =>
  readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

export function normNum(s) {
  const m = String(s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/g);
  return m ? Number(m[m.length - 1]) : NaN;
}
function runPy(code) {
  const d = mkdtempSync(join(tmpdir(), "heldout-"));
  try {
    writeFileSync(join(d, "t.py"), code);
    const r = spawnSync("python3", ["t.py"], { cwd: d, timeout: 10000, encoding: "utf8" });
    return r.status === 0;
  } finally { rmSync(d, { recursive: true, force: true }); }
}
export function score(pred, dir = DATA) {
  const suites = {};
  const add = (s, ok) => { (suites[s] ??= { n: 0, pass: 0 }).n++; if (ok) suites[s].pass++; };
  for (const it of load("gsm8k.jsonl", dir)) add("gsm8k", it.id in pred && normNum(pred[it.id]) === Number(it.answer));
  for (const it of load("humaneval.jsonl", dir)) {
    const c = pred[it.id];
    add("humaneval", !!c && runPy(`${it.prompt}${c}\n\n${it.test}\ncheck(${it.entry_point})\n`));
  }
  for (const it of load("mbpp.jsonl", dir)) {
    const c = pred[it.id];
    add("mbpp", !!c && runPy(`${it.test_setup_code}\n${c}\n${it.test_list.join("\n")}\n`));
  }
  for (const it of load("pr-outcomes.jsonl", dir)) add("pr_outcome", pred[it.id] === it.outcome);
  for (const s of Object.values(suites)) s.score = +(s.pass / s.n).toFixed(4);
  const keys = Object.keys(suites);
  return { suites, macro: +(keys.reduce((a, k) => a + suites[k].score, 0) / keys.length).toFixed(4) };
}
export function baselinePreds(dir = DATA) {
  const p = {}; // no model: empty answers for benchmarks, majority class for PR outcomes
  for (const it of load("pr-outcomes.jsonl", dir)) p[it.id] = "pass";
  return p;
}
export function goldPreds(dir = DATA) {
  const p = {};
  for (const it of load("gsm8k.jsonl", dir)) p[it.id] = it.answer;
  for (const it of load("humaneval.jsonl", dir)) p[it.id] = it.canonical_solution;
  for (const it of load("mbpp.jsonl", dir)) p[it.id] = it.code;
  for (const it of load("pr-outcomes.jsonl", dir)) p[it.id] = it.outcome;
  return p;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  if (a.includes("--write-manifest")) { writeFileSync(MANIFEST, manifestLines().join("\n") + "\n"); console.log("manifest written"); process.exit(0); }
  const v = verifyManifest();
  if (!v.ok) { console.error("MANIFEST MISMATCH (held-out set changed):\n" + v.bad.join("\n")); process.exit(2); }
  const i = a.indexOf("--predictions");
  const preds = i >= 0 ? JSON.parse(readFileSync(a[i + 1], "utf8")) : a.includes("--gold") ? goldPreds() : baselinePreds();
  console.log(JSON.stringify(score(preds), null, 2));
}
