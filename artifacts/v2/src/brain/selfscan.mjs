/**
 * IDEAS-B2-03 self-scan: turn a real `node --test` spec-reporter log into suggest-only patch
 * proposals, then run each through selfpatch.gate(). Nothing is written or applied; output is
 * a list of proposals with gate verdicts for a human-reviewed PR.
 */
import { gate } from "./selfpatch.mjs";
export function scanTestLog(log, { slowMs = 1000 } = {}) {
  const lines = String(log).split("\n"); const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*✖ (.+?) \(([\d.]+)ms\)$/);
    if (m && !/^failing tests:/.test(m[1])) {
      const err = lines.slice(i + 1, i + 8).find((l) => /Error|ENOENT|expected|actual/.test(l))?.trim() ?? "unknown";
      if (!findings.some((f) => f.kind === "fail" && f.name === m[1])) findings.push({ kind: "fail", name: m[1], error: err.slice(0, 160) });
    }
    const s = lines[i].match(/^\s*✔ (.+?) \(([\d.]+)ms\)$/);
    if (s && Number(s[2]) >= slowMs && !s[1].startsWith("test/")) findings.push({ kind: "slow", name: s[1], ms: Number(s[2]) });
    const w = lines[i].match(/\[MODULE_TYPELESS_PACKAGE_JSON\] Warning: Module type of file:\/\/(\S+) is not specified/);
    if (w) findings.push({ kind: "warn", name: "MODULE_TYPELESS_PACKAGE_JSON", file: w[1] });
  }
  const warnFiles = [...new Set(findings.filter((f) => f.kind === "warn").map((f) => f.file))];
  return { findings: findings.filter((f) => f.kind !== "warn"), warnFiles };
}
/** Build proposals. Only mechanical fixes get a diff; the rest are honest "needs a human" stubs. */
export function propose(scan, { author = "tessera", approver = null } = {}) {
  const P = [];
  for (const f of scan.findings) {
    if (f.kind === "fail" && /ENOENT/.test(f.error)) P.push({ title: `missing fixture for "${f.name}"`, reason: f.error, diff: "", files: [], mode: "suggest", author, approver });
    else if (f.kind === "fail") P.push({ title: `failing: ${f.name}`, reason: f.error, diff: "", files: [], mode: "suggest", author, approver });
    else if (f.kind === "slow") P.push({ title: `slow (${Math.round(f.ms)} ms): ${f.name}`, reason: "slow test", diff: "", files: [], mode: "suggest", author, approver });
  }
  if (scan.warnFiles.length) P.push({ title: `declare ESM for ${scan.warnFiles.length} .ts modules (MODULE_TYPELESS_PACKAGE_JSON reparse)`, reason: "Node reparses each file as ESM", files: ["preview/package.json"], diff: '+  "type": "module",', mode: "suggest", author, approver });
  return P.map((p) => ({ ...p, verdict: gate(p) }));
}
export function summarize(props) {
  const why = {}; for (const p of props) for (const f of p.verdict.failed) why[f] = (why[f] ?? 0) + 1;
  return { proposals: props.length, passed: props.filter((p) => p.verdict.ok).length, failedBy: why };
}
