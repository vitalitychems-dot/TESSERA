#!/usr/bin/env node
// Eval regression gate (#5): run run-eval (or read captured output) and fail if the
// grade or percentile drops below eval-baseline.json. run-eval's own exit code
// (1 when below p50) is ignored; only the parsed Grade/percentile decide.
// Usage: node scripts/eval-gate.mjs [--baseline FILE] [--input FILE]
// Exit: 0 = at or above baseline, 1 = regression, 2 = could not run or parse.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GRADES = ["F", "D", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
const strip = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, "");

export function parseEval(text) {
  const t = strip(text);
  const g = /Grade:\s+([A-F][+-]?)/.exec(t), p = /\((\d+)(?:st|nd|rd|th) percentile\)/.exec(t);
  if (!g || !p || !GRADES.includes(g[1])) return null;
  return { grade: g[1], percentile: Number(p[1]) };
}
export function gate(current, baseline) {
  const reasons = [];
  if (GRADES.indexOf(current.grade) < GRADES.indexOf(baseline.grade)) reasons.push(`grade ${current.grade} < baseline ${baseline.grade}`);
  if (current.percentile < baseline.percentile) reasons.push(`percentile p${current.percentile} < baseline p${baseline.percentile}`);
  return { pass: reasons.length === 0, reasons };
}
if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const baseline = JSON.parse(readFileSync(opt("--baseline") ?? join(ROOT, "eval-baseline.json"), "utf8"));
  let text;
  if (opt("--input")) text = readFileSync(opt("--input"), "utf8");
  else {
    const r = spawnSync(process.execPath, ["--enable-source-maps", join(ROOT, "dist/cli/run-eval.mjs")], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
    if (r.error) { console.error(`eval-gate: could not run run-eval: ${r.error.message}`); process.exit(2); }
    text = (r.stdout || "") + (r.stderr || "");
  }
  const cur = parseEval(text);
  if (!cur) { console.error("eval-gate: could not parse Grade/percentile from run-eval output (did you run `pnpm build`?)"); process.exit(2); }
  const res = gate(cur, baseline);
  console.log(`EVAL-GATE ${res.pass ? "PASS" : "FAIL"} grade=${cur.grade} p${cur.percentile} (baseline ${baseline.grade} p${baseline.percentile})${res.pass ? "" : ": " + res.reasons.join("; ")}`);
  process.exit(res.pass ? 0 : 1);
}
