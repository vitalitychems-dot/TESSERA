/**
 * File/tool router. Ranks workspace modules for a natural-language request
 * with Okapi BM25 over three fields: names, docs, and call sites.
 *
 * Catalog: data/rea/registry.json when it is present and non-empty, otherwise
 * the workspace package/module list (source files under artifacts, lib, scripts).
 *
 * There is no file router elsewhere in artifacts/v2. The comparison baseline
 * is filename-keyword overlap on repo-relative path tokens.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// filenameMix was chosen on the frozen dev split only: normalized BM25 plus
// this multiple of normalized filename-keyword overlap. On the current module
// list, 1.0, 1.1, and 1.2 tied the best dev top-1 and top-3; 1.1 is the median.
export const BM25_PARAMS = {
  k1: 1.2,
  b: 0.75,
  weights: { name: 3, docs: 1, calls: 1 },
  filenameMix: 1.1,
};

const SOURCE_EXT = new Set([".mjs", ".js", ".cjs", ".ts", ".tsx", ".jsx", ".mts", ".cts"]);
const SKIP_DIR = new Set(["node_modules", "dist", "coverage", ".git"]);
const PACKAGE_ROOTS = ["artifacts", "lib", "scripts"];
const RESOLVE_EXTS = ["", ".mjs", ".js", ".cjs", ".ts", ".tsx", ".jsx", ".mts", ".cts", "/index.mjs", "/index.js", "/index.ts", "/index.tsx"];

const STOP = new Set(
  "a an the and or of to for in on at by with from is are was were be been being this that it its as if not no do does did but so than then into over under about after before between can could should would will just than too very also only own same such our your their you we they he she them his her".split(/\s+/),
);

export function repoRoot() {
  return fileURLToPath(new URL("../../../../", import.meta.url));
}

export function tokenize(text) {
  const split = String(text).replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  const out = [];
  for (const raw of split.split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

export function extractComments(src) {
  const parts = [];
  for (const m of String(src).matchAll(/\/\*[\s\S]*?\*\//g)) parts.push(m[0]);
  for (const m of String(src).matchAll(/(^|\n)\s*\/\/[^\n]*/g)) parts.push(m[0]);
  return parts.join("\n");
}

function stripComments(src) {
  return String(src).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

export function extractDeclaredNames(code) {
  const names = [];
  const re = /\b(?:async\s+function|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of String(code).matchAll(re)) names.push(m[1] || m[2]);
  return names;
}

export function extractImports(code) {
  const imports = [];
  const fromRe = /\b(?:import|export)\s+(?:type\s+)?([^;]*?)\sfrom\s+['"]([^'"]+)['"]/g;
  for (const m of String(code).matchAll(fromRe)) {
    imports.push({ clause: m[1].replace(/\s+/g, " ").trim().slice(0, 400), spec: m[2] });
  }
  for (const m of String(code).matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) imports.push({ clause: "", spec: m[1] });
  for (const m of String(code).matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) imports.push({ clause: "require", spec: m[1] });
  for (const m of String(code).matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) imports.push({ clause: "import", spec: m[1] });
  return imports;
}

export function moduleSignals(path, src) {
  const docsText = extractComments(src);
  const code = stripComments(src);
  const names = extractDeclaredNames(code);
  return {
    path,
    nameText: `${path} ${names.join(" ")}`,
    docsText,
    callsText: "",
    imports: extractImports(code),
  };
}

function resolveSpec(fromFile, spec, paths) {
  if (!spec.startsWith(".")) return null;
  const clean = spec.split("?")[0];
  const parts = fromFile.split("/");
  parts.pop();
  for (const piece of clean.split("/")) {
    if (piece === "." || piece === "") continue;
    if (piece === "..") parts.pop();
    else parts.push(piece);
  }
  const base = parts.join("/");
  for (const ext of RESOLVE_EXTS) {
    const candidate = base + ext;
    if (paths.has(candidate)) return candidate;
  }
  return null;
}

export function linkCallSites(signals) {
  const paths = new Set(signals.map((s) => s.path));
  const byPath = new Map(signals.map((s) => [s.path, { ...s, callsText: s.callsText || "" }]));
  for (const s of signals) {
    for (const imp of s.imports || []) {
      const target = resolveSpec(s.path, imp.spec, paths);
      if (!target || target === s.path) continue;
      const doc = byPath.get(target);
      doc.callsText += `\n${s.path} ${imp.clause} ${imp.spec}`;
    }
  }
  return [...byPath.values()];
}

function termStats(texts) {
  const dfs = texts.map((text) => {
    const counts = new Map();
    for (const term of tokenize(text)) counts.set(term, (counts.get(term) ?? 0) + 1);
    let dl = 0;
    for (const n of counts.values()) dl += n;
    return { counts, dl };
  });
  const df = new Map();
  const postings = new Map();
  for (let i = 0; i < dfs.length; i++) {
    for (const [term, tf] of dfs[i].counts) {
      df.set(term, (df.get(term) ?? 0) + 1);
      let list = postings.get(term);
      if (!list) postings.set(term, (list = []));
      list.push([i, tf]);
    }
  }
  const n = Math.max(dfs.length, 1);
  const avg = dfs.reduce((sum, d) => sum + d.dl, 0) / n || 1;
  const dl = dfs.map((d) => d.dl);
  return { df, postings, avg, dl, n: dfs.length };
}

export function buildIndex(entries) {
  const docs = entries.map((e) => ({
    path: e.path,
    tool: e.tool ?? null,
  }));
  return {
    docs,
    fields: {
      name: termStats(entries.map((e) => e.nameText || e.path || "")),
      docs: termStats(entries.map((e) => e.docsText || e.hint || "")),
      calls: termStats(entries.map((e) => e.callsText || "")),
    },
  };
}

function compareRank(a, b) {
  return b.score - a.score || a.path.length - b.path.length || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

function bm25Scores(index, query, params) {
  const terms = [...new Set(tokenize(query))];
  const scores = new Float64Array(index.docs.length);
  const { k1, b, weights } = params;
  for (const field of ["name", "docs", "calls"]) {
    const weight = weights[field] ?? 0;
    if (weight === 0) continue;
    const stats = index.fields[field];
    for (const term of terms) {
      const docsWith = stats.df.get(term) ?? 0;
      if (docsWith === 0) continue;
      const idf = Math.log(1 + (stats.n - docsWith + 0.5) / (docsWith + 0.5));
      const posting = stats.postings.get(term);
      for (let p = 0; p < posting.length; p++) {
        const i = posting[p][0];
        const tf = posting[p][1];
        const denom = tf + k1 * (1 - b + (b * stats.dl[i]) / stats.avg);
        scores[i] += weight * idf * ((tf * (k1 + 1)) / denom);
      }
    }
  }
  const ranked = [];
  for (let i = 0; i < index.docs.length; i++) {
    ranked.push({ path: index.docs[i].path, tool: index.docs[i].tool, score: scores[i] });
  }
  return ranked;
}

export function rankIndex(index, query, k = 10, params = BM25_PARAMS) {
  const ranked = bm25Scores(index, query, params);
  ranked.sort(compareRank);
  return k > 0 ? ranked.slice(0, k) : ranked;
}

/** Path token sets, built once per path list and reused across queries. */
export function pathTermSets(paths) {
  return paths.map((path) => new Set(tokenize(path)));
}

function keywordScores(paths, termSets, query) {
  const terms = [...new Set(tokenize(query))];
  return paths.map((path, i) => {
    const nameTerms = termSets[i];
    let score = 0;
    for (const term of terms) if (nameTerms.has(term)) score += 1;
    return { path, tool: null, score };
  });
}

export function filenameKeywordRank(paths, query, k = 10, termSets = pathTermSets(paths)) {
  const ranked = keywordScores(paths, termSets, query);
  ranked.sort(compareRank);
  return k > 0 ? ranked.slice(0, k) : ranked;
}

export function hitCounts(items, rankFn) {
  let top1 = 0;
  let top3 = 0;
  for (const item of items) {
    const ranked = rankFn(item.query);
    const gold = new Set(item.gold);
    if (ranked[0] && gold.has(ranked[0].path)) top1 += 1;
    if (ranked.slice(0, 3).some((row) => gold.has(row.path))) top3 += 1;
  }
  const n = items.length;
  return { n, top1, top3, top1Rate: n ? top1 / n : 0, top3Rate: n ? top3 / n : 0 };
}

export function listModules(root) {
  const out = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIR.has(name)) continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (SOURCE_EXT.has(extname(name))) out.push(relative(root, abs).split(sep).join("/"));
    }
  }
  for (const dir of PACKAGE_ROOTS) {
    const abs = join(root, dir);
    if (existsSync(abs)) walk(abs);
  }
  out.sort();
  return out;
}

function catalogFromRegistry(json) {
  const tools = Array.isArray(json) ? json : json.tools || json.modules || json.files || [];
  if (!Array.isArray(tools)) return [];
  const items = [];
  for (const tool of tools) {
    if (typeof tool === "string") items.push({ path: tool, tool: null, hint: "" });
    else if (tool && typeof tool === "object") {
      const path = tool.path || tool.file || tool.module || tool.source;
      if (!path) continue;
      items.push({
        path: String(path),
        tool: tool.name || tool.id || null,
        hint: `${tool.name || ""} ${tool.description || tool.doc || ""}`.trim(),
      });
    }
  }
  return items;
}

export function loadCatalog(root) {
  const registryPath = join(root, "data", "rea", "registry.json");
  if (existsSync(registryPath)) {
    try {
      const parsed = catalogFromRegistry(JSON.parse(readFileSync(registryPath, "utf8")));
      if (parsed.length) return { source: "data/rea/registry.json", entries: parsed };
    } catch {
      // Unreadable registry falls through to the module list.
    }
  }
  return { source: "package/module list", entries: listModules(root).map((path) => ({ path, tool: null, hint: "" })) };
}

export function signalsForCatalog(root, catalog) {
  const signals = [];
  for (const entry of catalog) {
    const abs = join(root, entry.path);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      signals.push({
        path: entry.path,
        tool: entry.tool ?? null,
        nameText: `${entry.path} ${entry.tool || ""}`,
        docsText: entry.hint || "",
        callsText: "",
        imports: [],
      });
      continue;
    }
    const src = readFileSync(abs, "utf8");
    const extracted = moduleSignals(entry.path, src);
    extracted.tool = entry.tool ?? null;
    if (entry.hint) extracted.docsText = `${entry.hint}\n${extracted.docsText}`;
    if (entry.tool) extracted.nameText = `${entry.tool} ${extracted.nameText}`;
    signals.push(extracted);
  }
  return linkCallSites(signals);
}

export function buildRouter(root = repoRoot()) {
  const catalog = loadCatalog(root);
  const entries = signalsForCatalog(root, catalog.entries);
  const index = buildIndex(entries);
  const paths = entries.map((e) => e.path);
  // Path tokens do not change between queries; tokenize them once, not per query.
  const termSets = pathTermSets(paths);
  return {
    source: catalog.source,
    paths,
    index,
    rank(query, k = 10, params = BM25_PARAMS) {
      const mix = params.filenameMix ?? 0;
      if (!mix) return rankIndex(index, query, k, params);
      // Both lists are re-sorted after mixing, so they are scored unsorted here.
      const bm = bm25Scores(index, query, params);
      const kw = keywordScores(paths, termSets, query);
      let bmMax = 0;
      let kwMax = 0;
      for (const row of bm) if (row.score > bmMax) bmMax = row.score;
      for (const row of kw) if (row.score > kwMax) kwMax = row.score;
      bmMax = bmMax || 1;
      kwMax = kwMax || 1;
      const kwMap = new Map(kw.map((row) => [row.path, row.score / kwMax]));
      const rows = bm.map((row) => ({
        path: row.path,
        tool: row.tool,
        score: row.score / bmMax + mix * (kwMap.get(row.path) ?? 0),
      }));
      rows.sort(compareRank);
      return k > 0 ? rows.slice(0, k) : rows;
    },
    baseline(query, k = 10) {
      return filenameKeywordRank(paths, query, k, termSets);
    },
  };
}
