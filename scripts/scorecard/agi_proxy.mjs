#!/usr/bin/env node
// agi_proxy: macro score of the held-out eval runner (evals/heldout/run.mjs, TESSERA #306)
// on private data (HELDOUT_DATA = checkout of private Gitbook evals/heldout, Gitbook #85).
// Only the aggregate macro is printed; runner output (items, suites) is never echoed.
// Usage: HELDOUT_DATA=/path node agi_proxy.mjs [--repo DIR] [--predictions FILE] [--runs 5]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, repeat } from "./lib.mjs";

export function runOnce(repo, data, preds) {
  const runner = process.env.HELDOUT_RUNNER || join(repo, "evals/heldout/run.mjs");
  if (!data || !existsSync(runner)) return { macro: null, why: !data ? "HELDOUT_DATA not set" : "runner missing at ref" };
  const a = [runner, "--data", data];
  if (preds) a.push("--predictions", preds);
  const r = spawnSync(process.execPath, a, { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME }, maxBuffer: 64 << 20 });
  if (r.status !== 0) return { macro: null, why: r.status === 2 ? "manifest mismatch" : `runner exit ${r.status}` };
  try { return { macro: JSON.parse(r.stdout).macro }; } catch { return { macro: null, why: "unparseable runner output" }; }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const repo = resolve(arg("--repo", process.cwd()));
  const preds = arg("--predictions", process.env.SCORECARD_PREDICTIONS);
  let why;
  const r = await repeat(() => { const o = runOnce(repo, process.env.HELDOUT_DATA, preds); why ??= o.why; return o.macro; }, +arg("--runs", 5));
  console.log(JSON.stringify({ name: "agi_proxy", value: r.value, noise_band: r.noise_band, runs: r.runs, label: "held-out eval macro (proxy, not a measure of AGI)", ...(why ? { note: why } : {}) }));
}
