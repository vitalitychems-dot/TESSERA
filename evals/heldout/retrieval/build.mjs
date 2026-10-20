#!/usr/bin/env node
// Builds the frozen retrieval split used by the improvement gate (lib/agi/improvement-gate.ts).
// Mined from the repo, not hand-written: each api-server test file gives queries (its first
// describe() title and each it() title) whose relevant doc is the lib module the test file is named after. Docs are the first
// DOC_CHARS characters of each imported module. Split by sha256(query) so it is stable:
// last hex digit < 8 -> dev (for proposing), otherwise heldout (for gating only).
// Usage: node evals/heldout/retrieval/build.mjs   (rewrites split.json + split.sha256)
import { createHash } from "node:crypto";
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = join(HERE, "../../../artifacts/api-server/src");
const DOC_CHARS = 1500;
const sha = (s) => createHash("sha256").update(s).digest("hex");

const pairs = [];
for (const f of readdirSync(join(API, "__tests__")).filter((n) => n.endsWith(".test.ts")).sort()) {
  const src = readFileSync(join(API, "__tests__", f), "utf8");
  const d = src.match(/describe\(\s*"([^"]+)"/)?.[1];
  const base = f.replace(/\.test\.ts$/, "");
  const imps = [...src.matchAll(/from "\.\.\/lib\/([^"]+)"/g)].map((m) => m[1].replace(/\.(js|ts)$/, ""));
  // Subject module = the imported lib module whose path (slashes as dashes) the test file is named after.
  const imp = imps.find((i) => base.startsWith(i.replace(/\//g, "-")));
  if (!d || !imp) continue;
  const mod = imp + ".ts";
  if (!existsSync(join(API, "lib", mod)) || !statSync(join(API, "lib", mod)).isFile()) continue;
  const its = [...src.matchAll(/\bit\(\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const q of [...new Set([d, ...its])]) pairs.push({ q, relevant: [mod] });
}
const mods = [...new Set(pairs.map((p) => p.relevant[0]))].sort();
const docs = mods.map((id) => ({ id, content: readFileSync(join(API, "lib", id), "utf8").slice(0, DOC_CHARS) }));
const dev = [], heldout = [];
for (const p of pairs) (parseInt(sha(p.q).slice(-1), 16) < 8 ? dev : heldout).push(p);
const out = JSON.stringify({ source: "api-server __tests__ describe() -> imported lib module", docChars: DOC_CHARS, docs, dev, heldout }, null, 1) + "\n";
writeFileSync(join(HERE, "split.json"), out);
writeFileSync(join(HERE, "split.sha256"), sha(out) + "  split.json\n");
console.log(JSON.stringify({ docs: docs.length, dev: dev.length, heldout: heldout.length }));
