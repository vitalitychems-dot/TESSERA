#!/usr/bin/env node
// Outcome feedback: learn from merged/closed PRs + gate verdicts, rank open work for the next loop cycle.
//   node scripts/feedback/outcome-feedback.mjs [--repos owner/A,owner/B] [--out next-tasks.json] [--fixture f.json]
// Read-only: uses `gh api` GETs only. Weighting per finished PR:
//   merged +1, closed-unmerged -1, each gate PASS +0.25, each gate FAIL -0.5 (latest verdict per gate+SHA counted once).
// A verdict counts only if (a) its comment author is in TRUSTED_VERDICT_AUTHORS (or --trusted a,b) and (b) it names a SHA
// that is a prefix of the PR's head SHA. Verdicts on stale/superseded SHAs, or with no SHA, are ignored.
// ADVISORY ONLY: this ranking picks what to work on next. It must never feed a gate, a merge decision,
// or the silence timer; gates read their own verdicts on the exact head SHA.
// Each title word inherits its PR's weight; a candidate (open PR or issue) scores the smoothed mean of its words.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Trusted verdict authors come from config, never from code: env TRUSTED_VERDICT_AUTHORS="login1,login2"
// or --trusted. With none configured, no verdict counts (fail closed).
export const parseTrusted = (s) => new Set(String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean));
export const TRUSTED = parseTrusted(process.env.TRUSTED_VERDICT_AUTHORS);
export const W = { merged: 1, closed: -1, pass: 0.25, fail: -0.5, prior: 3 };
const STOP = new Set("a an and the to of for in on with by from is are add fix update pr v2 via into new".split(" "));
export const words = (t) => [...new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
  .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)))];

const VERDICT = /\b(Moderator|Security|Build)(?:\s+gate)?\s*[:\-]?\s*(PASS|FAIL)\b(?:[^\n]*?\b([0-9a-f]{7,40})\b)?/gi;
export function parseVerdicts(body) {
  const out = []; let m;
  VERDICT.lastIndex = 0;
  while ((m = VERDICT.exec(body || ""))) out.push({ gate: m[1].toLowerCase(), verdict: m[2].toUpperCase(), sha: m[3] || null });
  return out;
}
const shaMatches = (sha, head) => !!sha && !!head && sha.length >= 7 && head.toLowerCase().startsWith(sha.toLowerCase());
export function prWeight(pr, comments = [], trusted = TRUSTED) {
  let w = pr.merged ? W.merged : pr.state === "closed" ? W.closed : 0;
  const latest = new Map();
  for (const c of comments) {
    if (!trusted.has(c.author)) continue;
    for (const v of parseVerdicts(c.body)) if (shaMatches(v.sha, pr.headSha)) latest.set(v.gate, v.verdict);
  }
  let p = 0, f = 0;
  for (const v of latest.values()) v === "PASS" ? p++ : f++;
  return { weight: w + p * W.pass + f * W.fail, pass: p, fail: f };
}
export function rank({ finished, candidates }, trusted = TRUSTED) {
  const wordStat = new Map();
  let history = 0;
  for (const pr of finished) {
    const { weight } = prWeight(pr, pr.comments, trusted);
    history++;
    for (const w of words(pr.title)) {
      const s = wordStat.get(w) ?? { sum: 0, n: 0 }; s.sum += weight; s.n++; wordStat.set(w, s);
    }
  }
  const scored = candidates.map((c) => {
    const ws = words(c.title);
    const evidence = ws.map((w) => [w, wordStat.get(w)]).filter(([, s]) => s);
    const per = evidence.map(([, s]) => s.sum / (s.n + W.prior)); // shrink rare words toward 0
    const own = prWeight({ merged: false, state: "open", headSha: c.headSha }, c.comments || [], trusted);
    const score = (per.length ? per.reduce((a, b) => a + b, 0) / per.length : 0) + own.weight;
    const top = evidence.sort((a, b) => b[1].sum / (b[1].n + W.prior) - a[1].sum / (a[1].n + W.prior))
      .slice(0, 3).map(([w, s]) => ({ word: w, n: s.n, avg: +(s.sum / s.n).toFixed(3) }));
    return { repo: c.repo, number: c.number, kind: c.kind, title: c.title, score: +score.toFixed(4),
      gates: { pass: own.pass, fail: own.fail }, evidence: top };
  });
  scored.sort((a, b) => b.score - a.score || a.repo.localeCompare(b.repo) || a.number - b.number);
  return { advisory_only: "never feeds a gate, merge decision or silence timer", generated_at: new Date().toISOString(),
    history_prs: history, weights: W, trusted_authors: [...trusted].sort(),
    tasks: scored.map((t, i) => ({ rank: i + 1, ...t })) };
}

const gh = (path) => execFileSync("gh", ["api", "--paginate", "-q", ".[] | @json", path], { encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\n").filter(Boolean).map((l) => JSON.parse(l));
export function fetchRepo(repo) {
  const prs = gh(`repos/${repo}/pulls?state=all&per_page=100`);
  const issues = gh(`repos/${repo}/issues?state=open&per_page=100`).filter((i) => !i.pull_request);
  const comments = gh(`repos/${repo}/issues/comments?per_page=100`);
  const byNum = new Map();
  for (const c of comments) { const n = +c.issue_url.split("/").pop(); (byNum.get(n) ?? byNum.set(n, []).get(n)).push({ body: c.body, author: c.user?.login }); }
  const finished = [], candidates = [];
  for (const p of prs) {
    const row = { repo, number: p.number, title: p.title, state: p.state, headSha: p.head?.sha, merged: !!p.merged_at, comments: byNum.get(p.number) || [] };
    if (p.state === "open") candidates.push({ ...row, kind: p.draft ? "draft-pr" : "pr" }); else finished.push(row);
  }
  for (const i of issues) candidates.push({ repo, number: i.number, title: i.title, kind: "issue", comments: byNum.get(i.number) || [] });
  return { finished, candidates };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), arg = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  let input;
  if (a.includes("--fixture")) input = JSON.parse(readFileSync(arg("--fixture"), "utf8"));
  else {
    input = { finished: [], candidates: [] };
    for (const r of arg("--repos", "vitalitychems-dot/TESSERA,vitalitychems-dot/Gitbook").split(",")) {
      const d = fetchRepo(r); input.finished.push(...d.finished); input.candidates.push(...d.candidates);
    }
  }
  const trusted = a.includes("--trusted") ? parseTrusted(arg("--trusted")) : TRUSTED;
  const out = rank(input, trusted);
  writeFileSync(arg("--out", "next-tasks.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`ranked ${out.tasks.length} candidates from ${out.history_prs} finished PRs -> ${arg("--out", "next-tasks.json")}`);
}
