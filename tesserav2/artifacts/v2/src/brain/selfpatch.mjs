/**
 * IDEAS-B1-04 gated recursive self-improvement. SUGGEST-ONLY: Tessera may propose patches to
 * herself, each must carry a test ref and pass every gate, and the output is a PR proposal
 * (title/body/diff) for a human-reviewed PR. This module never writes files, never applies a
 * diff, and never runs git. Flag TESSERA_BRAIN_SELFPATCH defaults to 0 (proposals disabled).
 */
export const FLAG = "TESSERA_BRAIN_SELFPATCH";
export const enabled = (env = process.env) => env[FLAG] === "1";
const GATES = [
  ["has-test-ref", (p) => typeof p.testRef === "string" && /\.test\.(m?js|ts)$/.test(p.testRef)],
  ["tests-passed", (p) => p.testResult?.failed === 0 && p.testResult?.passed > 0],
  ["no-flag-flip", (p) => !/^[+-].*TESSERA_ENABLE_\w+/m.test(p.diff ?? "")],
  ["no-workflows", (p) => !(p.files ?? []).some((f) => f.startsWith(".github/workflows"))],
  ["no-deletions", (p) => !/^deleted file mode/m.test(p.diff ?? "") && !(p.deletes?.length)],
  ["no-self-approve", (p) => p.approver && p.approver !== p.author],
  ["no-secrets", (p) => !/(gh[opsu]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(p.diff ?? "")],
  ["no-live-apply", (p) => p.mode === "suggest"],
];
export function gate(p) {
  const failed = GATES.filter(([, f]) => !f(p)).map(([n]) => n);
  return { ok: failed.length === 0, failed };
}
/** Turn an accepted proposal into a PR proposal object. Never applies anything. */
export function propose(p, env = process.env) {
  if (!enabled(env)) return { status: "disabled", flag: FLAG };
  const g = gate(p);
  if (!g.ok) return { status: "rejected", failed: g.failed };
  return { status: "proposed", pr: { title: `self-patch: ${p.title}`, body: `Test: ${p.testRef}\nGates: ${GATES.length}/${GATES.length} pass\nSuggest-only; human merge.`, diff: p.diff } };
}
