#!/usr/bin/env node
// recursion_rate = (gated-and-merged improvement PRs per day over the last 7 days) x (mean reported % gain).
// Gated (unforgeable sources only, Moderator FAIL on #314 @32d52d83):
//   (a) a PR comment/review whose AUTHOR is in TRUSTED_VERDICT_AUTHORS (env "login1,login2", as in #303)
//       containing "<Security|Build|Moderator> ... PASS" that names a SHA prefix of the merged head; or
//   (b) a GitHub check run on the head commit named for a gate (security|build|moderator) with conclusion SUCCESS.
//   Comment text from any other author never counts. No trusted authors configured and no check runs = 0 (fail closed).
// Gain: first "Gain: +N%" line in the PR body (author-reported; only counted for PRs gated as above); missing = 0.
// Deterministic given inputs: --cache FILE (JSON from a previous --save) and --now ISO.
// Usage: TRUSTED_VERDICT_AUTHORS=a,b node recursion_rate.mjs [--repo owner/name] [--now ISO] [--cache F | --save F] [--runs 5]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, repeat, round4 } from "./lib.mjs";

export const parseTrusted = (s) => new Set(String(s ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
const VERDICT = /\b(security|build|moderator)\b[^\n]{0,80}?\bPASS\b(?:[^\n]*?\b([0-9a-f]{7,40})\b)?/gi;
const GATE_CHECK = /\b(security|build|moderator)\b/i;
export const parseGain = (body = "") => { const m = /^\s*\**Gain:?\**:?\s*([+-]?\d+(?:\.\d+)?)\s*%/im.exec(body || ""); return m ? Number(m[1]) : 0; };
const shaOk = (sha, head) => !!sha && !!head && head.toLowerCase().startsWith(sha.toLowerCase());
export function gatedBy(p, trusted) {
  if ((p.checks || []).some((c) => GATE_CHECK.test(c.name || "") && c.conclusion === "SUCCESS")) return "check_run";
  for (const t of p.texts || []) {
    if (!t || !trusted.has(String(t.author || "").toLowerCase())) continue;
    VERDICT.lastIndex = 0; let m;
    while ((m = VERDICT.exec(t.body || ""))) if (shaOk(m[2], p.headSha)) return "trusted_verdict";
  }
  return null;
}
export function compute(prs, nowIso, trusted = parseTrusted(process.env.TRUSTED_VERDICT_AUTHORS), days = 7) {
  const now = Date.parse(nowIso), from = now - days * 864e5;
  const sel = prs.filter((p) => p.mergedAt && Date.parse(p.mergedAt) > from && Date.parse(p.mergedAt) <= now && gatedBy(p, trusted));
  const gains = sel.map((p) => parseGain(p.body));
  const mean = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  return { value: round4((sel.length / days) * mean), gated_merged: sel.length, per_day: round4(sel.length / days), mean_gain_pct: round4(mean), trusted_authors: trusted.size };
}
function fetchPrs(repo) {
  const [owner, name] = repo.split("/");
  const q = `query($o:String!,$n:String!){repository(owner:$o,name:$n){pullRequests(states:MERGED,first:100,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number mergedAt body headRefOid comments(last:100){nodes{author{login} body}} reviews(last:50){nodes{author{login} body}} commits(last:1){nodes{commit{checkSuites(first:20){nodes{checkRuns(first:50){nodes{name conclusion}}}}}}}}}}}`;
  const j = JSON.parse(execFileSync("gh", ["api", "graphql", "-f", `query=${q}`, "-F", `o=${owner}`, "-F", `n=${name}`], { encoding: "utf8", maxBuffer: 64 << 20 }));
  return j.data.repository.pullRequests.nodes.map((p) => ({
    number: p.number, mergedAt: p.mergedAt, body: p.body, headSha: p.headRefOid,
    texts: [...p.comments.nodes, ...p.reviews.nodes].map((c) => ({ author: c.author?.login ?? null, body: c.body })),
    checks: (p.commits.nodes[0]?.commit.checkSuites.nodes || []).flatMap((s) => s.checkRuns.nodes),
  })).sort((a, b) => a.number - b.number);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cache = arg("--cache"), save = arg("--save");
  const prs = cache ? JSON.parse(readFileSync(cache, "utf8")) : fetchPrs(arg("--repo", "vitalitychems-dot/TESSERA"));
  if (save) writeFileSync(save, JSON.stringify(prs));
  const now = arg("--now", new Date().toISOString());
  let last;
  const r = await repeat(() => (last = compute(prs, now)).value, +arg("--runs", 5));
  console.log(JSON.stringify({ name: "recursion_rate", value: r.value, noise_band: r.noise_band, runs: r.runs, now, gated_merged: last.gated_merged, per_day: last.per_day, mean_gain_pct: last.mean_gain_pct, trusted_authors: last.trusted_authors }));
}
