#!/usr/bin/env node
// findings.mjs <findings.json> <scores.json> [--dry-run]
// One issue per finding key (hidden marker). Opens new ones, refreshes open ones, closes ones that no longer reproduce.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const [ff, sf, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry-run");
const findings = JSON.parse(readFileSync(ff, "utf8")), scores = JSON.parse(readFileSync(sf, "utf8"));
const repo = process.env.GITHUB_REPOSITORY ?? "vitalitychems-dot/TESSERA";
const gh = (...a) => dry ? (console.log("[dry-run] gh " + a.slice(0, 4).join(" ")), "[]") : execFileSync("gh", a, { encoding: "utf8" });
const open = dry ? JSON.parse(process.env.DRY_OPEN ?? "[]")
  : JSON.parse(gh("issue", "list", "-R", repo, "--label", "needs-agent", "--state", "open", "--limit", "200", "--json", "number,body"));
const byKey = new Map(open.map((i) => [i.body.match(/<!-- self-improve:(\S+) -->/)?.[1], i.number]).filter(([k]) => k));
const out = { opened: 0, refreshed: 0, closed: 0 };
for (const f of findings) {
  const body = [`<!-- self-improve:${f.key} -->`, `**${f.title}**`, `main @ \`${scores.sha}\` (${scores.at})`, "",
    "### Score diff", "```json", JSON.stringify(f.detail, null, 2), "```", "",
    "### Repro", "```sh", "pnpm install --frozen-lockfile --ignore-scripts", "pnpm test", "node scripts/bench-latency.mjs", "```",
    "", "_Opened by self-improve.yml at 0 tokens. Agents spend tokens only on open `needs-agent` issues. When you close one, add `tokens-used: N`._"].join("\n");
  const n = byKey.get(f.key);
  if (n) { gh("issue", "comment", String(n), "-R", repo, "--body", body); out.refreshed++; byKey.delete(f.key); }
  else { gh("issue", "create", "-R", repo, "--title", `[self-improve] ${f.title}`, "--label", "needs-agent", "--body", body); out.opened++; }
}
for (const [k, n] of byKey) { gh("issue", "close", String(n), "-R", repo, "--comment", `No longer reproduces on main @ ${scores.sha} (${k}). Closed by self-improve.yml.`); out.closed++; }
console.log(JSON.stringify(out));
