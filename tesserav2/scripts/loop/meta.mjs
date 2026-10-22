#!/usr/bin/env node
// meta.mjs <issues.json> [days=7]: measures the loop itself and proposes its own tuning.
// issues.json = gh issue list --label needs-agent --state all --json number,createdAt,closedAt,body,comments
import { readFileSync } from "node:fs";
export function metrics(issues, days = 7, now = Date.now()) {
  const since = now - days * 864e5;
  const opened = issues.filter((i) => Date.parse(i.createdAt) >= since);
  const fixed = issues.filter((i) => i.closedAt && Date.parse(i.closedAt) >= since);
  const ttf = fixed.map((i) => (Date.parse(i.closedAt) - Date.parse(i.createdAt)) / 36e5).sort((a, b) => a - b);
  const tok = issues.flatMap((i) => [i.body ?? "", ...(i.comments ?? []).map((c) => c.body ?? "")].join("\n").match(/tokens-used:\s*(\d+)/g) ?? []).map((s) => +s.split(":")[1]);
  const m = { days, opened: opened.length, fixed: fixed.length, open: issues.filter((i) => !i.closedAt).length,
    medianHoursToFix: ttf.length ? +ttf[ttf.length >> 1].toFixed(1) : null,
    tokensPerFix: tok.length && fixed.length ? Math.round(tok.reduce((a, b) => a + b, 0) / fixed.length) : null };
  const p = [];
  if (m.open > 10) p.push("Backlog over 10: raise BENCH_TOLERANCE by 0.05, or turn on the worker (TESSERA_WORKER=1).");
  if (m.opened === 0 && m.fixed === 0) p.push("Quiet week: lower BENCH_TOLERANCE by 0.02 or add a bench path, so the loop keeps finding work.");
  if (m.opened > 0 && m.fixed / m.opened < 0.5) p.push("Fix rate under 50%: the issue repros aren't enough; add file:/test: lines so the worker can act.");
  if (m.medianHoursToFix && m.medianHoursToFix > 48) p.push("Median time to fix over 48h: run the worker every 6h instead of daily.");
  if (m.tokensPerFix === null) p.push("No `tokens-used:` lines were logged, so tokens per fix can't be measured. Agents should add them when closing issues.");
  return { metrics: m, proposals: p };
}
if (process.argv[1]?.endsWith("meta.mjs")) console.log(JSON.stringify(metrics(JSON.parse(readFileSync(process.argv[2], "utf8")), Number(process.argv[3] ?? 7)), null, 2));
