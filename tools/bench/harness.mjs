// Shared cached bench harness: median + bootstrap 95% CI, before/after compare,
// output-equality check, cache keyed by main SHA + bench file hash in .cache/bench/.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
export function bootstrapCI(xs, B = 2000, seed = 1) {
  const r = rng(seed), n = xs.length, meds = [];
  for (let b = 0; b < B; b++) { const s = []; for (let i = 0; i < n; i++) s.push(xs[(r() * n) | 0]); meds.push(median(s)); }
  meds.sort((x, y) => x - y);
  return [meds[Math.floor(0.025 * B)], meds[Math.ceil(0.975 * B) - 1]];
}
export function ratioCI(before, after, B = 2000, seed = 2) {
  const r = rng(seed), out = [];
  const pick = (a) => { const s = []; for (let i = 0; i < a.length; i++) s.push(a[(r() * a.length) | 0]); return median(s); };
  for (let b = 0; b < B; b++) out.push(pick(before) / pick(after));
  out.sort((x, y) => x - y);
  return [out[Math.floor(0.025 * B)], out[Math.ceil(0.975 * B) - 1]];
}
export function measure(fn, { runs = 7, warmup = 1 } = {}) {
  if (runs < 5) throw new Error("runs must be >= 5");
  let out; for (let i = 0; i < warmup; i++) out = fn();
  const t = []; for (let i = 0; i < runs; i++) { const s = performance.now(); out = fn(); t.push(performance.now() - s); }
  return { samples: t, median: median(t), ci95: bootstrapCI(t), out };
}
function mainSha() { try { return execSync("git rev-parse origin/main 2>/dev/null || git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { return process.env.MAIN_SHA || "nosha"; } }
export function cacheKey(benchFile, sha = mainSha()) {
  const h = createHash("sha256").update(readFileSync(benchFile)).digest("hex").slice(0, 16);
  return `${sha.slice(0, 12)}-${h}`;
}
// compare({ before, after, benchFile }) -> result; cached unless BENCH_NOCACHE=1
export function compare({ before, after, benchFile, runs = 7, cacheDir = ".cache/bench", sha } = {}) {
  const key = cacheKey(benchFile, sha) + "-r" + runs, f = join(cacheDir, key + ".json");
  if (!process.env.BENCH_NOCACHE && existsSync(f)) return { ...JSON.parse(readFileSync(f, "utf8")), cached: true };
  const b = measure(before, { runs }), a = measure(after, { runs });
  const res = {
    key, runs, equal: JSON.stringify(b.out) === JSON.stringify(a.out),
    beforeMs: +b.median.toFixed(3), beforeCI: b.ci95.map((x) => +x.toFixed(3)),
    afterMs: +a.median.toFixed(3), afterCI: a.ci95.map((x) => +x.toFixed(3)),
    speedup: +(b.median / a.median).toFixed(3), speedupCI: ratioCI(b.samples, a.samples).map((x) => +x.toFixed(3)),
  };
  res.win = res.equal && res.speedupCI[0] > 1;
  mkdirSync(cacheDir, { recursive: true }); writeFileSync(f, JSON.stringify(res, null, 2));
  return { ...res, cached: false };
}
