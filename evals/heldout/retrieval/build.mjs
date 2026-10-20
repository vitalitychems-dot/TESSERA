#!/usr/bin/env node
// Builds the frozen retrieval split used by the improvement gate (lib/agi/improvement-gate.ts).
// PROXY data mined from the repo, not hand-written: each api-server test file gives queries (its
// first describe() title and each it() title) whose relevant doc is the lib module the test file
// is named after. Docs are the first DOC_CHARS characters of each such module.
// Module-disjoint split: sha256(module path) last hex digit < 8 -> dev, else heldout, so no target
// module appears in both. Deterministic: sorted inputs, and the gate's own test file is excluded
// so adding gate tests cannot move the split. A test rebuilds it and checks split.sha256.
// Usage: node evals/heldout/retrieval/build.mjs [--check]   (--check: rebuild and compare only)
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = join(HERE, "../../../artifacts/api-server/src");
const DOC_CHARS = 1500;
export const EXCLUDE = new Set(["agi-improvement-gate.test.ts"]);
const sha = (s) => createHash("sha256").update(s).digest("hex");

export function build(api = API) {
  const pairs = [];
  for (const f of readdirSync(join(api, "__tests__")).filter((n) => n.endsWith(".test.ts") && !EXCLUDE.has(n)).sort()) {
    const src = readFileSync(join(api, "__tests__", f), "utf8");
    const d = src.match(/describe\(\s*"([^"]+)"/)?.[1];
    const base = f.replace(/\.test\.ts$/, "");
    const imps = [...src.matchAll(/from "\.\.\/lib\/([^"]+)"/g)].map((m) => m[1].replace(/\.(js|ts)$/, ""));
    const imp = imps.find((i) => base.startsWith(i.replace(/\//g, "-")));
    if (!d || !imp) continue;
    const mod = imp + ".ts";
    if (!existsSync(join(api, "lib", mod)) || !statSync(join(api, "lib", mod)).isFile()) continue;
    const its = [...src.matchAll(/\bit\(\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const q of [...new Set([d, ...its])]) pairs.push({ q, relevant: [mod] });
  }
  const mods = [...new Set(pairs.map((p) => p.relevant[0]))].sort();
  const docs = mods.map((id) => ({ id, content: readFileSync(join(api, "lib", id), "utf8").slice(0, DOC_CHARS) }));
  const dev = [], heldout = [];
  for (const p of pairs) (parseInt(sha(p.relevant[0]).slice(-1), 16) < 8 ? dev : heldout).push(p);
  const json = JSON.stringify({ source: "PROXY: api-server __tests__ titles -> named lib module; module-disjoint split", docChars: DOC_CHARS, docs, dev, heldout }, null, 1) + "\n";
  return { json, hash: sha(json), counts: { docs: docs.length, dev: dev.length, heldout: heldout.length } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = build();
  if (process.argv.includes("--check")) {
    const want = readFileSync(join(HERE, "split.sha256"), "utf8").split(/\s+/)[0];
    console.log(JSON.stringify({ ...r.counts, hash: r.hash, matches: r.hash === want }));
    process.exit(r.hash === want ? 0 : 1);
  }
  writeFileSync(join(HERE, "split.json"), r.json);
  writeFileSync(join(HERE, "split.sha256"), r.hash + "  split.json\n");
  console.log(JSON.stringify({ ...r.counts, hash: r.hash }));
}
