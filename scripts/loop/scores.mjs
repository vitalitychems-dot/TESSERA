#!/usr/bin/env node
// scores.mjs collect <test-log> <test-exit> <bench1.json> [bench2.json ...] > scores.json
// scores.mjs compare <prev.json|-> <cur.json> > findings.json
// Scores come from the real test log and bench output produced in the runner, never from agent-written files.
import { readFileSync, existsSync } from "node:fs";
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function parseTestLog(log) {
  const sum = (re) => [...log.matchAll(re)].reduce((n, m) => n + Number(m[1]), 0);
  const pass = sum(/^(?:#|ℹ) pass (\d+)/gm) + sum(/Tests\s+(?:\d+ failed \| )?(\d+) passed/g);
  const fail = sum(/^(?:#|ℹ) fail (\d+)/gm) + sum(/Tests\s+(\d+) failed/g);
  const spec = (log.split(/^✖ failing tests:$/m)[1] ?? "");
  const failing = [...new Set([...log.matchAll(/^not ok \d+ - (.+)$/gm), ...spec.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => m[1].trim()))];
  return { pass, fail, failing };
}

export function collect(log, exit, benches, sha = process.env.GITHUB_SHA ?? null) {
  const paths = {};
  for (const b of benches) for (const [k, v] of Object.entries(b.paths ?? {})) (paths[k] ??= []).push(v.p50);
  const bench = Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, { p50_median_ms: +med(v).toFixed(4), runs: v.length }]));
  return { at: new Date().toISOString(), sha, testExit: Number(exit), tests: parseTestLog(log), bench };
}

export function compare(prev, cur, { tol = Number(process.env.BENCH_TOLERANCE ?? 0.10), minMs = 0.02 } = {}) {
  const f = [];
  if (!cur || !cur.tests || !cur.bench) return [{ key: "scorer-broken", title: "Scorer produced no scores (fail closed)", detail: {} }];
  if (cur.testExit !== 0 || cur.tests.fail > 0)
    f.push({ key: "tests-failing", title: `Tests failing on main (${cur.tests.fail} failed, exit ${cur.testExit})`, detail: { failing: cur.tests.failing } });
  if (!Object.keys(cur.bench).length) f.push({ key: "bench-broken", title: "Bench produced no results", detail: {} });
  if (prev) {
    if (cur.tests.pass < prev.tests.pass)
      f.push({ key: "pass-count-drop", title: `Passing test count dropped ${prev.tests.pass} -> ${cur.tests.pass}`, detail: { before: prev.tests.pass, after: cur.tests.pass } });
    for (const [k, v] of Object.entries(cur.bench)) {
      const b = prev.bench?.[k]; if (!b) continue;
      const d = v.p50_median_ms - b.p50_median_ms;
      if (d > minMs && d / b.p50_median_ms > tol)
        f.push({ key: `bench-${k}`, title: `Bench regression: ${k} p50 ${b.p50_median_ms} -> ${v.p50_median_ms} ms (+${(100 * d / b.p50_median_ms).toFixed(1)}%)`, detail: { before: b, after: v, tolerance: tol } });
    }
    for (const k of Object.keys(prev.bench ?? {})) if (!cur.bench[k]) f.push({ key: `bench-missing-${k}`, title: `Bench path disappeared: ${k}`, detail: {} });
  }
  return f;
}

if (process.argv[1]?.endsWith("scores.mjs")) {
  const [mode, ...a] = process.argv.slice(2);
  if (mode === "collect") {
    const [log, exit, ...b] = a;
    console.log(JSON.stringify(collect(readFileSync(log, "utf8"), exit, b.filter(existsSync).map((p) => JSON.parse(readFileSync(p, "utf8")))), null, 2));
  } else if (mode === "compare") {
    const prev = a[0] !== "-" && existsSync(a[0]) ? JSON.parse(readFileSync(a[0], "utf8")) : null;
    console.log(JSON.stringify(compare(prev, JSON.parse(readFileSync(a[1], "utf8"))), null, 2));
  } else { console.error("usage: scores.mjs collect|compare ..."); process.exit(2); }
}
