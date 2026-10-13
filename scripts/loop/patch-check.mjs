#!/usr/bin/env node
// Publish-job guard: `git apply --numstat -z` output must name exactly one path (the allowed file),
// with no renames/binary, and total changed lines <= 2*cap.
import { readFileSync } from "node:fs";
export function checkNumstat(raw, file, cap) {
  const recs = raw.split("\0").filter(Boolean);
  if (recs.length !== 1) return { ok: false, why: `patch touches ${recs.length} paths` };
  const m = recs[0].match(/^(\d+|-)\t(\d+|-)\t(.*)$/s);
  if (!m) return { ok: false, why: "unparseable numstat (rename?)" };
  if (m[1] === "-" || m[2] === "-") return { ok: false, why: "binary patch" };
  if (m[3] !== file) return { ok: false, why: `patch touches ${JSON.stringify(m[3])}, allowed ${JSON.stringify(file)}` };
  const n = Number(m[1]) + Number(m[2]);
  if (n === 0 || n > 2 * cap) return { ok: false, why: `changed lines ${n} outside 1..${2 * cap}` };
  return { ok: true, lines: n };
}
if (process.argv[1]?.endsWith("patch-check.mjs")) {
  const [f, file, cap = "60"] = process.argv.slice(2);
  const r = checkNumstat(readFileSync(f, "utf8"), file, Number(cap));
  if (!r.ok) { console.error(r.why); process.exit(1); }
  console.log(JSON.stringify(r));
}
