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
// Reject any patch header that changes more than content: mode flips (e.g. +x), new/deleted
// files, renames/copies, symlinks (mode 120000), submodules (160000), binary.
const BAD_HEADER = /^(old mode|new mode|new file mode|deleted file mode|rename from|rename to|copy from|copy to|similarity index|dissimilarity index|GIT binary patch|Binary files )/m;
export function checkHeaders(patch) {
  const m = patch.match(BAD_HEADER);
  if (m) return { ok: false, why: `patch header not allowed: ${JSON.stringify(m[0])}` };
  const idx = [...patch.matchAll(/^index [0-9a-f]+\.\.[0-9a-f]+(?: (\d{6}))?$/gm)];
  for (const i of idx) if (i[1] && i[1] !== "100644") return { ok: false, why: `file mode ${i[1]} not allowed` };
  return { ok: true };
}
if (process.argv[1]?.endsWith("patch-check.mjs") && process.argv[2] === "--headers") {
  const r = checkHeaders(readFileSync(process.argv[3], "utf8"));
  if (!r.ok) { console.error(r.why); process.exit(1); }
  console.log("headers ok"); process.exit(0);
}
if (process.argv[1]?.endsWith("patch-check.mjs")) {
  const [f, file, cap = "60"] = process.argv.slice(2);
  const r = checkNumstat(readFileSync(f, "utf8"), file, Number(cap));
  if (!r.ok) { console.error(r.why); process.exit(1); }
  console.log(JSON.stringify(r));
}
