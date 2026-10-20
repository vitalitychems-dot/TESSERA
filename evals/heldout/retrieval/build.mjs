#!/usr/bin/env node
// Frozen, versioned retrieval split used by the improvement gate (lib/agi/improvement-gate.ts).
// PROXY data mined from the repo, not hand-written: each api-server test file gives queries (its
// first describe() title and each it() title) whose relevant doc is the lib module the test file
// is named after. Docs are the first DOC_CHARS characters of each such module.
// Module-disjoint split: sha256(module path) last hex digit < 8 -> dev, else heldout.
//
// split.json is FROZEN. The gate and its test load the committed file and only check
// sha256(split.json) == split.sha256; nothing rebuilds it implicitly. Adding or renaming api-server
// tests does NOT change the split. See CHANGELOG.md for versions.
//
// Usage:
//   node build.mjs --drift [--api <src dir>]
//       Rebuild in memory from the current tree, write nothing, always exit 0, and print
//       added/removed queries and changed/added/removed docs versus the frozen split.json.
//   node build.mjs --write --version vN --note "<why>" [--api <src dir>] [--out <dir>]
//       The ONLY way to regenerate. N must be greater than the frozen version. Rewrites
//       split.json and split.sha256 and appends an entry to CHANGELOG.md. Needs review (Einstein).
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = join(HERE, "../../../artifacts/api-server/src");
const DOC_CHARS = 1500;
const SOURCE = "PROXY: api-server __tests__ titles -> named lib module; module-disjoint split";
export const EXCLUDE = new Set(["agi-improvement-gate.test.ts"]);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const vnum = (v) => (typeof v === "string" && /^v[1-9]\d*$/.test(v) ? Number(v.slice(1)) : NaN);

export function build(api = API, version = "v1") {
  if (!Number.isFinite(vnum(version))) throw new Error(`bad version ${version}`);
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
  const obj = { version, source: SOURCE, docChars: DOC_CHARS, docs, dev, heldout };
  const json = JSON.stringify(obj, null, 1) + "\n";
  return { obj, json, hash: sha(json), counts: { docs: docs.length, dev: dev.length, heldout: heldout.length } };
}

export function loadFrozen(dir = HERE) {
  const raw = readFileSync(join(dir, "split.json"), "utf8");
  const want = readFileSync(join(dir, "split.sha256"), "utf8").split(/\s+/)[0];
  return { raw, obj: JSON.parse(raw), hash: sha(raw), want };
}

export function drift(api = API, dir = HERE) {
  const frozen = loadFrozen(dir).obj;
  const now = build(api, frozen.version).obj;
  const key = (side) => (p) => `${side}\t${p.relevant.join(",")}\t${p.q}`;
  const qs = (o) => new Set([...o.dev.map(key("dev")), ...o.heldout.map(key("heldout"))]);
  const a = qs(frozen), b = qs(now);
  const show = (k) => { const [split, relevant, q] = k.split("\t"); return { split, relevant, q }; };
  const fd = new Map(frozen.docs.map((d) => [d.id, d.content])), nd = new Map(now.docs.map((d) => [d.id, d.content]));
  return {
    frozenVersion: frozen.version,
    addedQueries: [...b].filter((k) => !a.has(k)).map(show),
    removedQueries: [...a].filter((k) => !b.has(k)).map(show),
    changedDocs: [...nd.keys()].filter((id) => fd.has(id) && fd.get(id) !== nd.get(id)),
    addedDocs: [...nd.keys()].filter((id) => !fd.has(id)),
    removedDocs: [...fd.keys()].filter((id) => !nd.has(id)),
  };
}

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const api = arg("--api") ? resolve(arg("--api")) : API;
  if (process.argv.includes("--drift")) {
    try {
      const d = drift(api);
      console.log(JSON.stringify({ ...d, summary: { addedQueries: d.addedQueries.length, removedQueries: d.removedQueries.length, changedDocs: d.changedDocs.length, addedDocs: d.addedDocs.length, removedDocs: d.removedDocs.length } }, null, 1));
    } catch (e) { console.log(JSON.stringify({ error: String(e?.message ?? e) })); }
    process.exit(0);
  } else if (process.argv.includes("--write")) {
    const out = arg("--out") ? resolve(arg("--out")) : HERE;
    const cur = loadFrozen(out).obj.version;
    const next = arg("--version"), note = arg("--note");
    if (!(vnum(next) > vnum(cur))) { console.error(`refusing: --write needs --version greater than frozen ${cur} (got ${next ?? "none"})`); process.exit(1); }
    if (!note) { console.error("refusing: --write needs --note \"<why>\" for CHANGELOG.md"); process.exit(1); }
    const r = build(api, next);
    writeFileSync(join(out, "split.json"), r.json);
    writeFileSync(join(out, "split.sha256"), r.hash + "  split.json\n");
    appendFileSync(join(out, "CHANGELOG.md"), `\n## ${next} (${new Date().toISOString().slice(0, 10)})\n- sha256 ${r.hash}\n- docs ${r.counts.docs}, dev ${r.counts.dev}, heldout ${r.counts.heldout}\n- ${note}\n`);
    console.log(JSON.stringify({ version: next, ...r.counts, hash: r.hash }));
  } else {
    console.error("usage: build.mjs --drift [--api dir] | --write --version vN --note \"why\" [--api dir] [--out dir]");
    process.exit(2);
  }
}
