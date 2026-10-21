#!/usr/bin/env node
// Usage: node gen-offline-index.mjs <gitbook-clone-dir> <out.json>
// Reads .md files on disk (skips archive/, 1T, vault). No network.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const [root, out] = process.argv.slice(2);
if (!root || !out) { console.error("usage: gen-offline-index.mjs <dir> <out.json>"); process.exit(2); }
const skip = /(^|\/)(archive|\.git|node_modules|1T)(\/|$)|vault/i;
const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n); const r = relative(root, p);
    if (skip.test(r)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p); else if (n.endsWith(".md")) pages.push({ path: r, text: readFileSync(p, "utf8").slice(0, 2048) });
  }
})(root);
writeFileSync(out, JSON.stringify({ version: 1, pages }));
console.log(`indexed ${pages.length} pages`);
