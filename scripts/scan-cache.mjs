#!/usr/bin/env node
/**
 * Shared scan cache for TESSERA agents, keyed by head SHA and stored on GitHub
 * (branch `scan-cache`, file `scan-cache.json`), not on any box.
 *
 *   node scripts/scan-cache.mjs            # refresh + print compact JSON
 *   node scripts/scan-cache.mjs --dry-run  # refresh but do not write the cache branch
 *   node scripts/scan-cache.mjs --legacy   # baseline: per-PR REST calls (for measuring)
 *
 * Warm read = 1 GraphQL call: it returns the cached file AND the open PRs' head SHAs.
 * SHAs already cached with a settled CI state cost zero further calls. Only new or
 * pending SHAs are fetched (one batched GraphQL call). The cache is written back with
 * one contents-API call, and only when something changed. Auth goes through `gh`, so
 * this script never handles a token.
 */
import { execFileSync } from "node:child_process";

export const REPO = process.env.SCAN_CACHE_REPO || "vitalitychems-dot/TESSERA";
export const BRANCH = "scan-cache", FILE = "scan-cache.json";
const SETTLED = new Set(["SUCCESS", "FAILURE", "ERROR"]);
const GATE_RE = /\b(Security|Moderator|Build)\s+(PASS|FAIL)\b[^\n]*?\b([0-9a-f]{7,40})\b/gi;
const SCAN_RE = /\b((?:REA|Aikido|CodeQL|scan)[\w-]*)\s*:?\s+(PASS|FAIL|CLEAN|FINDINGS)\b[^\n]*?\b([0-9a-f]{7,40})\b/gi;

/** gh transport with call/byte counters. */
export function ghTransport(stats = { calls: 0, bytes: 0 }) {
  const run = (args, input) => {
    const out = execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 64 << 20 });
    stats.calls++; stats.bytes += Buffer.byteLength(out);
    return out ? JSON.parse(out) : null;
  };
  return {
    stats,
    graphql: (query, vars = {}) => run(["api", "graphql", "--input", "-"], JSON.stringify({ query, variables: vars })).data,
    rest: (path, method = "GET", body) => run(["api", "-X", method, path, ...(body ? ["--input", "-"] : [])], body && JSON.stringify(body)),
  };
}

/** Pure: gate verdicts / scan results that name this head SHA (prefix match, latest wins). */
export function verdictsFor(sha, comments) {
  const gates = {}, scans = {};
  for (const c of comments) for (const [re, out] of [[GATE_RE, gates], [SCAN_RE, scans]]) {
    for (const m of c.body.matchAll(re)) {
      if (!sha.startsWith(m[3].toLowerCase())) continue;
      const k = re === GATE_RE ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : m[1];
      out[k] = { verdict: m[2].toUpperCase(), by: c.author?.login ?? null, at: c.createdAt };
    }
  }
  return { gates, scans };
}

/** Pure: build a cache entry from a GraphQL PR node. */
export function entryFrom(pr) {
  const sha = pr.headRefOid;
  return {
    pr: pr.number, title: pr.title, branch: pr.headRefName,
    ci: pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? "NONE",
    ...verdictsFor(sha, pr.comments?.nodes ?? []),
  };
}

/** Pure: which SHAs need a fetch (new, or cached with unsettled CI). */
export function staleShas(heads, cache) {
  return heads.filter((h) => !cache.entries?.[h.sha] || !SETTLED.has(cache.entries[h.sha].ci)).map((h) => h);
}

const HEADS_Q = `query($o:String!,$n:String!,$x:String!){repository(owner:$o,name:$n){
  cache:object(expression:$x){... on Blob{oid text}}
  pullRequests(states:OPEN,first:100){nodes{number headRefOid}}}}`;
const DETAIL_Q = (nums) => `query($o:String!,$n:String!){repository(owner:$o,name:$n){${nums.map((n) =>
  `p${n}:pullRequest(number:${n}){number title headRefName headRefOid
   commits(last:1){nodes{commit{statusCheckRollup{state}}}}
   comments(last:50){nodes{author{login} body createdAt}}}`).join("\n")}}}`;

export async function refresh(t, { write = true, repo = REPO } = {}) {
  const [o, n] = repo.split("/");
  const r = t.graphql(HEADS_Q, { o, n, x: `${BRANCH}:${FILE}` }).repository;
  const cache = r.cache?.text ? JSON.parse(r.cache.text) : { entries: {} };
  const heads = r.pullRequests.nodes.map((p) => ({ pr: p.number, sha: p.headRefOid }));
  const stale = staleShas(heads, cache);
  let changed = false;
  if (stale.length) {
    const d = t.graphql(DETAIL_Q(stale.map((h) => h.pr)), { o, n }).repository;
    for (const pr of Object.values(d)) {
      const e = entryFrom(pr);
      if (JSON.stringify(cache.entries[pr.headRefOid]) !== JSON.stringify(e)) { cache.entries[pr.headRefOid] = e; changed = true; }
    }
  }
  const open = Object.fromEntries(heads.map((h) => [h.pr, h.sha]));
  if (JSON.stringify(cache.open) !== JSON.stringify(open)) { cache.open = open; changed = true; }
  if (changed && write) {
    cache.updated_at = new Date().toISOString();
    const content = Buffer.from(JSON.stringify(cache)).toString("base64");
    const msg = `scan-cache: ${stale.length} SHA(s) refreshed`;
    if (!r.cache) {
      try { t.rest(`repos/${repo}/git/refs/heads/${BRANCH}`); }
      catch { const main = t.rest(`repos/${repo}/git/ref/heads/main`); t.rest(`repos/${repo}/git/refs`, "POST", { ref: `refs/heads/${BRANCH}`, sha: main.object.sha }); }
    }
    t.rest(`repos/${repo}/contents/${FILE}`, "PUT", { message: msg, content, branch: BRANCH, ...(r.cache ? { sha: r.cache.oid } : {}) });
  }
  return { cache, fetched: stale.length, changed };
}

/** Baseline: what agents do today, per PR (list, then check-runs + comments per PR). */
export function legacy(t, repo = REPO) {
  const prs = t.rest(`repos/${repo}/pulls?state=open&per_page=100`);
  const out = {};
  for (const p of prs) {
    const runs = t.rest(`repos/${repo}/commits/${p.head.sha}/check-runs`);
    const comments = t.rest(`repos/${repo}/issues/${p.number}/comments?per_page=100`);
    out[p.head.sha] = { pr: p.number, ci: runs.check_runs.map((c) => c.conclusion), comments: comments.length };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t = ghTransport();
  if (process.argv.includes("--legacy")) { legacy(t); console.log(JSON.stringify({ mode: "legacy", ...t.stats })); }
  else {
    const { cache, fetched, changed } = await refresh(t, { write: !process.argv.includes("--dry-run") });
    console.error(JSON.stringify({ mode: "cache", fetched, changed, ...t.stats }));
    console.log(JSON.stringify(cache));
  }
}
