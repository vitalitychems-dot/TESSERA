#!/usr/bin/env node
// Scorecard: run the three scores on base and head checkouts and compare.
// FAIL if any head score < base score - noise_band (noise_band = max of base/head bands).
// A score that is null on both sides is reported as n/a and does not fail; null on head only fails.
// recall_at_5 (hybrid-search, #18) is a 4th score from recall_at_k.mjs on a fixed synthetic fixture.
// Usage: node scorecard.mjs --base DIR --head DIR [--now ISO] [--runs 5] [--json]
// Env: HELDOUT_DATA, TRUSTED_REF (runner ref, default origin/main), TRUSTED_VERDICT_AUTHORS, CONSCIOUSNESS_*.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const sh = (cmd, a) => JSON.parse(execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 << 20 }).trim().split("\n").pop());

export function compare(base, head) {
  const rows = Object.keys(base).map((k) => {
    const b = base[k], h = head[k];
    const band = Math.max(b.noise_band ?? 0, h.noise_band ?? 0);
    let verdict = "PASS";
    if (b.value == null && h.value == null) verdict = "n/a";
    else if (h.value == null) verdict = "FAIL";
    else if (b.value != null && h.value < b.value - band) verdict = "FAIL";
    return { name: k, base: b.value, head: h.value, delta: b.value != null && h.value != null ? +(h.value - b.value).toFixed(4) : null, noise_band: band, verdict };
  });
  return { rows, verdict: rows.some((r) => r.verdict === "FAIL") ? "FAIL" : "PASS" };
}
export function scoreAll(repo, { now, runs, cache }) {
  return {
    agi_proxy: sh(process.execPath, [join(HERE, "agi_proxy.mjs"), "--repo", repo, "--runs", runs]),
    consciousness_proxy: sh("python3", [join(HERE, "consciousness_proxy.py"), "--runs", runs]),
    recursion_rate: sh(process.execPath, [join(HERE, "recursion_rate.mjs"), "--cache", cache, "--now", now, "--runs", runs]),
    recall_at_5: sh(process.execPath, [join(HERE, "recall_at_k.mjs"), "--repo", repo, "--k", "5", "--runs", runs]),
  };
}
if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const base = resolve(arg("--base")), head = resolve(arg("--head"));
  const now = arg("--now", new Date().toISOString()), runs = arg("--runs", "5");
  const tmp = mkdtempSync(join(tmpdir(), "scorecard-")), cache = join(tmp, "prs.json");
  try {
    // One PR snapshot for both sides so recursion_rate is identical given the same inputs.
    execFileSync(process.execPath, [join(HERE, "recursion_rate.mjs"), "--save", cache, "--runs", "1"], { stdio: "ignore" });
    const res = compare(scoreAll(base, { now, runs, cache }), scoreAll(head, { now, runs, cache }));
    if (process.argv.includes("--json")) console.log(JSON.stringify(res));
    else {
      for (const r of res.rows) console.log(`${r.name.padEnd(20)} base=${r.base} head=${r.head} delta=${r.delta} noise=±${r.noise_band} ${r.verdict}`);
      console.log(`SCORECARD ${res.verdict}`);
    }
    process.exitCode = res.verdict === "FAIL" ? 1 : 0;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
