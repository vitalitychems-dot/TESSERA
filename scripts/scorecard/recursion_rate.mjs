#!/usr/bin/env node
// recursion_rate = (gated-and-merged improvement PRs per day over the last 7 days) x (mean reported % gain).
// Gated: merged, and at least one PR comment/review says "<Security|Build|Moderator> ... PASS".
// Gain: first line in the PR body matching "Gain: +N%" (or -N%); missing = 0.
// Deterministic given inputs: --cache FILE (JSON from a previous --save) and --now ISO.
// Usage: node recursion_rate.mjs [--repo owner/name] [--now ISO] [--cache F | --save F] [--runs 5]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { arg, repeat, round4 } from "./lib.mjs";

const GATE = /\b(security|build|moderator)\b[^\n]{0,80}\bPASS\b/i;
export const parseGain = (body = "") => { const m = /^\s*\**Gain:?\**:?\s*([+-]?\d+(?:\.\d+)?)\s*%/im.exec(body || ""); return m ? Number(m[1]) : 0; };
export function compute(prs, nowIso, days = 7) {
  const now = Date.parse(nowIso), from = now - days * 864e5;
  const sel = prs.filter((p) => p.mergedAt && Date.parse(p.mergedAt) > from && Date.parse(p.mergedAt) <= now && (p.texts || []).some((t) => GATE.test(t)));
  const gains = sel.map((p) => parseGain(p.body));
  const mean = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  return { value: round4((sel.length / days) * mean), gated_merged: sel.length, per_day: round4(sel.length / days), mean_gain_pct: round4(mean) };
}
function fetchPrs(repo) {
  const [owner, name] = repo.split("/");
  const q = `query($o:String!,$n:String!){repository(owner:$o,name:$n){pullRequests(states:MERGED,first:100,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number mergedAt body comments(last:100){nodes{body}} reviews(last:50){nodes{body}}}}}}`;
  const j = JSON.parse(execFileSync("gh", ["api", "graphql", "-f", `query=${q}`, "-F", `o=${owner}`, "-F", `n=${name}`], { encoding: "utf8", maxBuffer: 64 << 20 }));
  return j.data.repository.pullRequests.nodes.map((p) => ({ number: p.number, mergedAt: p.mergedAt, body: p.body, texts: [...p.comments.nodes, ...p.reviews.nodes].map((c) => c.body) }))
    .sort((a, b) => a.number - b.number);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const cache = arg("--cache"), save = arg("--save");
  const prs = cache ? JSON.parse(readFileSync(cache, "utf8")) : fetchPrs(arg("--repo", "vitalitychems-dot/TESSERA"));
  if (save) writeFileSync(save, JSON.stringify(prs));
  const now = arg("--now", new Date().toISOString());
  let last;
  const r = await repeat(() => (last = compute(prs, now)).value, +arg("--runs", 5));
  console.log(JSON.stringify({ name: "recursion_rate", value: r.value, noise_band: r.noise_band, runs: r.runs, now, gated_merged: last.gated_merged, per_day: last.per_day, mean_gain_pct: last.mean_gain_pct }));
}
