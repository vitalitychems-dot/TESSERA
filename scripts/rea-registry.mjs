#!/usr/bin/env node
/**
 * Catalog TESSERA tools, modules, file loaders, models, datasets, and
 * direct package.json dependencies under artifacts/v2, artifacts/gitai,
 * artifacts/api-server, and lib/.
 *
 * Licenses come only from package manifests and LICENSE files (including
 * the npm registry manifest and a package's own LICENSE file). Anything
 * else is "unknown".
 *
 * Coverage = (package.json dependency declarations + src/brain modules
 * that appear here with a non-unknown license) / (those declarations + modules).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SCOPES = ["artifacts/v2", "artifacts/gitai", "artifacts/api-server", "lib"];
const SOURCE_EXT = new Set([".mjs", ".js", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  ".data",
  ".local-data",
  ".sovereign-data",
]);

const rootOfScript = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function posixRel(root, file) {
  return relative(root, file).split(sep).join("/");
}

function readText(file) {
  return readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

export function acceptSpdx(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || /^unknown$/i.test(text) || /^see license in /i.test(text)) return "";
  if (/^mit(?:\s+licen[cs]e)?$/i.test(text)) return "MIT";
  if (/^isc(?:\s+licen[cs]e)?$/i.test(text)) return "ISC";
  if (/^apache(?:\s+license)?(?:\s+version)?\s*2(?:\.0)?$/i.test(text)) return "Apache-2.0";
  if (/^bsd-2-clause$/i.test(text)) return "BSD-2-Clause";
  if (/^bsd-3-clause$/i.test(text)) return "BSD-3-Clause";
  if (/^\(?[A-Za-z0-9.+-]+(?:\s+(?:OR|AND|WITH)\s+[A-Za-z0-9.+-]+)*\)?$/.test(text)) return text;
  return "";
}

export function licenseFromManifest(pkg) {
  if (!pkg || typeof pkg !== "object") return "";
  const raw = pkg.license ?? pkg.licenses;
  if (typeof raw === "string") return acceptSpdx(raw);
  if (Array.isArray(raw)) {
    const parts = raw
      .map((entry) => (typeof entry === "string" ? acceptSpdx(entry) : acceptSpdx(entry?.type)))
      .filter(Boolean);
    if (parts.length === 1) return parts[0];
    if (parts.length > 1) return parts.join(" OR ");
    return "";
  }
  if (raw && typeof raw === "object") return acceptSpdx(raw.type);
  return "";
}

export function licenseFromText(text) {
  const head = String(text ?? "").slice(0, 2000);
  const spdx = head.match(/SPDX-License-Identifier:\s*([^\n*]+)/i);
  if (spdx) {
    const id = acceptSpdx(spdx[1]);
    if (id) return id;
  }
  if (/^\s*MIT License\b/i.test(head)) return "MIT";
  if (/Permission is hereby granted, free of charge, to any person obtaining a copy/.test(head)) return "MIT";
  if (/Apache License/i.test(head) && /Version 2\.0/.test(head)) return "Apache-2.0";
  if (/^\s*ISC License\b/i.test(head)) return "ISC";
  if (/BSD 2-Clause/i.test(head) || /The 2-Clause BSD License/i.test(head)) return "BSD-2-Clause";
  if (/BSD 3-Clause/i.test(head) || /The 3-Clause BSD License/i.test(head)) return "BSD-3-Clause";
  return "";
}

function unquote(value) {
  const text = String(value ?? "").trim();
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1);
  }
  return text;
}

export function exactVersion(version) {
  if (!version || version.startsWith("link:") || version.startsWith("workspace:")) return "";
  const bare = String(version).split("(")[0].trim();
  return /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(bare) ? bare : "";
}

export function parseLockfile(lockText) {
  const lines = String(lockText).split("\n");
  const importers = new Map();
  const versions = new Map();
  const importerStart = lines.findIndex((line) => line === "importers:");
  const packageStart = lines.findIndex((line) => line === "packages:");
  if (importerStart >= 0) {
    const end = packageStart > importerStart ? packageStart : lines.length;
    let current = null;
    let field = null;
    let dep = null;
    for (const line of lines.slice(importerStart + 1, end)) {
      if (line.startsWith("  ") && !line.startsWith("   ")) {
        const empty = line.match(/^ {2}(.+?):\s*\{\}\s*$/);
        if (empty) {
          importers.set(unquote(empty[1]), {});
          current = null;
          field = null;
          dep = null;
          continue;
        }
        const named = line.match(/^ {2}(.+):\s*$/);
        if (named) {
          current = {};
          importers.set(unquote(named[1]), current);
          field = null;
          dep = null;
        }
        continue;
      }
      if (!current) continue;
      if (line.startsWith("    ") && !line.startsWith("     ") && line.endsWith(":")) {
        field = line.slice(4, -1);
        current[field] = current[field] || {};
        dep = null;
        continue;
      }
      if (field && line.startsWith("      ") && !line.startsWith("       ") && line.endsWith(":")) {
        dep = unquote(line.slice(6, -1));
        current[field][dep] = current[field][dep] || {};
        continue;
      }
      if (field && dep) {
        const version = line.match(/^ {8}version:\s*(.+)$/);
        if (version) current[field][dep].version = unquote(version[1]);
      }
    }
  }
  const packageLines = packageStart >= 0 ? lines.slice(packageStart + 1) : [];
  for (const line of packageLines) {
    const match = line.match(/^ {2}'?((?:@[^/'@\s]+\/)?[^@'\s]+)@(\d+\.\d+\.\d+[^':]*)'?:/);
    if (!match) continue;
    const name = match[1];
    const version = exactVersion(match[2]);
    if (!version) continue;
    if (!versions.has(name)) versions.set(name, new Set());
    versions.get(name).add(version);
  }
  return { importers, versions };
}

function walkFiles(dir, acc, { dataDir }) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name === "data" && !dataDir) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc, { dataDir: false });
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

function scopeRoot(root, scope) {
  return join(root, scope);
}

export function listScopeFiles(root) {
  const files = [];
  for (const scope of SCOPES) walkFiles(scopeRoot(root, scope), files, { dataDir: false });
  return files;
}

function isSource(file) {
  const dot = file.lastIndexOf(".");
  if (file.endsWith(".d.ts")) return true;
  return SOURCE_EXT.has(file.slice(dot));
}

export function listPackageDeps(root) {
  const deps = [];
  for (const file of listScopeFiles(root)) {
    if (!file.endsWith(`${sep}package.json`) && !file.endsWith("/package.json")) continue;
    if (file.includes(`${sep}node_modules${sep}`)) continue;
    const pkg = readJson(file);
    const importerDir = posixRel(root, dirname(file));
    for (const field of DEP_FIELDS) {
      const block = pkg[field];
      if (!block || typeof block !== "object") continue;
      for (const [name, specifier] of Object.entries(block)) {
        deps.push({
          name,
          field,
          specifier: String(specifier),
          package_json: posixRel(root, file),
          importerDir,
        });
      }
    }
  }
  return deps;
}

export function listBrainModules(root) {
  const dir = join(root, "artifacts/v2/src/brain");
  if (!existsSync(dir)) return [];
  const files = [];
  walkFiles(dir, files, { dataDir: true });
  return files.filter(isSource).map((file) => posixRel(root, file)).sort();
}

export function packageNameOf(spec) {
  if (!spec || spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:") || spec.startsWith("file:")) {
    return "";
  }
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return name ? `${scope}/${name}` : "";
  }
  const name = spec.split("/")[0];
  return name || "";
}

export function extractSpecifiers(source) {
  const specs = [];
  const fromRe = /(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s*["']([^"']+)["']/g;
  const sideRe = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;
  const dynamicRe = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [fromRe, sideRe, requireRe, dynamicRe]) {
    for (const match of source.matchAll(re)) specs.push(match[1]);
  }
  return specs;
}

function resolveRelative(fromFile, spec) {
  if (!spec.startsWith(".")) return "";
  const base = resolve(dirname(fromFile), spec.split("?")[0]);
  const exts = [".mjs", ".js", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".json"];
  const candidates = [base];
  for (const ext of exts) candidates.push(base + ext);
  for (const ext of exts) candidates.push(join(base, `index${ext}`));
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return "";
}

export function isFileLoader(source) {
  const importsFs = /from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs(?:\/promises)?["']\s*\)/.test(source);
  const reads = /\breadFile(?:Sync)?\b|\bcreateReadStream\b/.test(source);
  return importsFs && reads;
}

function findLicenseAt(dir) {
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const id = licenseFromManifest(readJson(pkgPath));
      if (id) return { license: id, license_source: pkgPath };
    } catch {
      // unreadable manifest is not a license
    }
  }
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.md"]) {
    const file = join(dir, name);
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const id = licenseFromText(readText(file).slice(0, 2000));
    if (id) return { license: id, license_source: file };
  }
  return null;
}

function formatLicenseSource(root, file) {
  const prefix = file.endsWith("package.json") ? "package.json:" : "file:";
  const suffix = file.endsWith("package.json") ? "#license" : "";
  return `${prefix}${posixRel(root, file)}${suffix}`;
}

export function findOwnLicense(startDir, root, { inherit }) {
  let version = "";
  let dir = startDir;
  let depth = 0;
  while (dir === root || dir.startsWith(`${root}${sep}`)) {
    const pkgPath = join(dir, "package.json");
    if (!version && existsSync(pkgPath)) {
      try {
        const pkg = readJson(pkgPath);
        if (typeof pkg.version === "string") version = pkg.version;
      } catch {
        // ignore an unreadable manifest
      }
    }
    if (inherit || depth === 0) {
      const found = findLicenseAt(dir);
      if (found) {
        return {
          license: found.license,
          license_source: formatLicenseSource(root, found.license_source),
          version,
        };
      }
    }
    if (!inherit && version) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    depth += 1;
  }
  return { license: "unknown", license_source: "", version };
}

function quotedNames(source, names) {
  const hits = new Set();
  for (const name of names) {
    if (source.includes(`"${name}"`) || source.includes(`'${name}'`)) hits.add(name);
  }
  return hits;
}

function resolveDepVersion(dep, lock, root) {
  const importer = lock.importers.get(dep.importerDir);
  const hit = importer?.[dep.field]?.[dep.name];
  if (hit?.version?.startsWith("link:")) {
    const linked = normalize(join(dep.importerDir, hit.version.slice("link:".length)));
    const pkgPath = join(root, linked, "package.json");
    let version = "";
    if (existsSync(pkgPath)) {
      try {
        version = readJson(pkgPath).version || "";
      } catch {
        version = "";
      }
    }
    return { version: String(version), workspaceDir: join(root, linked) };
  }
  const fromLock = exactVersion(hit?.version || "");
  if (fromLock) return { version: fromLock, workspaceDir: "" };
  const fromSpec = exactVersion(dep.specifier);
  if (fromSpec) return { version: fromSpec, workspaceDir: "" };
  const unique = lock.versions.get(dep.name);
  if (unique && unique.size === 1) return { version: [...unique][0], workspaceDir: "" };
  return { version: dep.specifier, workspaceDir: "" };
}

function installedLicense(root, name) {
  const dir = join(root, "node_modules", ...name.split("/"));
  if (!existsSync(join(dir, "package.json"))) return null;
  const found = findLicenseAt(dir);
  if (!found) return null;
  let version = "";
  try {
    version = readJson(join(dir, "package.json")).version || "";
  } catch {
    version = "";
  }
  const sourceFile = found.license_source;
  return {
    license: found.license,
    license_source: `${sourceFile.endsWith("package.json") ? "package.json:" : "file:"}${posixRel(root, sourceFile)}${sourceFile.endsWith("package.json") ? "#license" : ""}`,
    version,
  };
}

async function registryLicense(name, version, fetchImpl) {
  const exact = exactVersion(version);
  if (!exact) return null;
  const url = `https://registry.npmjs.org/${name.replace("/", "%2F")}/${exact}`;
  let body;
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    body = await response.json();
  } catch {
    return null;
  }
  const id = licenseFromManifest(body);
  if (id) return { license: id, license_source: `npm:${url}#license` };
  const fileNames = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "license"];
  for (const fileName of fileNames) {
    const fileUrl = `https://cdn.jsdelivr.net/npm/${name}@${exact}/${fileName}`;
    try {
      const response = await fetchImpl(fileUrl, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) continue;
      const text = await response.text();
      const fromFile = licenseFromText(text);
      if (fromFile) return { license: fromFile, license_source: `file:${fileUrl}` };
    } catch {
      // try the next filename
    }
  }
  return null;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

function pushSite(map, key, site) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(site);
}

function record(partial) {
  return {
    name: partial.name,
    kind: partial.kind,
    version: partial.version || "",
    license: partial.license || "unknown",
    license_source: partial.license === "unknown" || !partial.license ? "" : partial.license_source || "",
    call_sites: [...(partial.call_sites || [])].sort(),
    path: partial.path || "",
    declared_in: partial.declared_in || [],
  };
}

export function coverageOf(records, targets) {
  const deps = targets.dependencies;
  const brains = targets.brain;
  const depRecords = records.filter((item) => item.kind === "dependency");
  let numerator = 0;
  const unknown = [];
  for (const dep of deps) {
    const hit = depRecords.find((item) => item.name === dep.name && item.version === dep.version);
    if (hit && hit.license && hit.license !== "unknown") numerator += 1;
    else unknown.push({ kind: "dependency", name: dep.name, version: dep.version, package_json: dep.package_json });
  }
  for (const path of brains) {
    const hit = records.find((item) => item.path === path);
    if (hit && hit.license && hit.license !== "unknown") numerator += 1;
    else unknown.push({ kind: "module", path });
  }
  const denominator = deps.length + brains.length;
  const fraction = denominator === 0 ? 0 : Math.round((numerator / denominator) * 1e6) / 1e6;
  return {
    numerator,
    denominator,
    fraction,
    package_dependencies: deps.length,
    brain_modules: brains.length,
    unknown,
  };
}

export function fractionImproved(before, after) {
  return after.numerator * Math.max(before.denominator, 1) > before.numerator * Math.max(after.denominator, 1)
    || (before.denominator === 0 && after.numerator > 0);
}

function extractTools(source) {
  const names = [];
  for (const match of source.matchAll(/registerTool\(\s*\{[^}]*name:\s*["']([^"']+)["']/g)) names.push(match[1]);
  return names;
}

function extractAdapters(source) {
  if (!source.includes("/local-models/adapters")) return [];
  const names = [];
  for (const match of source.matchAll(/id:\s*["']([^"']+)["'][\s\S]{0,240}?defaultEndpoint:\s*["'][^"']+["']/g)) {
    names.push(match[1]);
  }
  return names;
}

function extractWeightModels(source) {
  const models = [];
  for (const match of source.matchAll(/(\w+):\s*\{[^}]*file:\s*["']([^"']+)["'][^}]*kind:\s*["']weights["']/g)) {
    models.push({ name: match[1], file: match[2] });
  }
  return models;
}

function extractSourceIds(source) {
  const ids = [];
  for (const match of source.matchAll(/id:\s*["']([^"']+)["']\s*,\s*license:\s*["'][^"']*["']/g)) ids.push(match[1]);
  return ids;
}

function extractDatasetSources(source) {
  if (!source.includes("open-dataset")) return [];
  const names = [];
  for (const match of source.matchAll(/source:\s*["']([^"']+)["']/g)) names.push(match[1]);
  return names;
}

export async function buildRegistry(root, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const offline = options.offline === true;
  const files = listScopeFiles(root).filter(isSource);
  const texts = new Map();
  for (const file of files) texts.set(file, readText(file));

  const lockPath = join(root, "pnpm-lock.yaml");
  const lock = parseLockfile(existsSync(lockPath) ? readText(lockPath) : "");
  const declared = listPackageDeps(root).map((dep) => ({ ...dep, ...resolveDepVersion(dep, lock, root) }));

  const importSites = new Map();
  const moduleSites = new Map();
  for (const [file, source] of texts) {
    const site = posixRel(root, file);
    for (const spec of extractSpecifiers(source)) {
      const pkg = packageNameOf(spec);
      if (pkg) pushSite(importSites, pkg, site);
      const resolved = resolveRelative(file, spec);
      if (resolved) pushSite(moduleSites, posixRel(root, resolved), site);
    }
  }

  const depGroups = new Map();
  for (const dep of declared) {
    const key = `${dep.name}@${dep.version}`;
    if (!depGroups.has(key)) depGroups.set(key, []);
    depGroups.get(key).push(dep);
  }

  const remoteNeeded = [];
  const localLicense = new Map();
  for (const [key, group] of depGroups) {
    const sample = group[0];
    if (sample.workspaceDir) {
      localLicense.set(key, findOwnLicense(sample.workspaceDir, root, { inherit: true }));
      continue;
    }
    const installed = installedLicense(root, sample.name);
    if (installed && installed.license !== "unknown") {
      localLicense.set(key, { license: installed.license, license_source: installed.license_source, version: sample.version });
      continue;
    }
    if (!offline && exactVersion(sample.version)) remoteNeeded.push(sample);
  }

  const remoteLicense = new Map();
  if (!offline) {
    await mapPool(remoteNeeded, 8, async (sample) => {
      const found = await registryLicense(sample.name, sample.version, fetchImpl);
      if (found) remoteLicense.set(`${sample.name}@${sample.version}`, found);
    });
  }

  const records = [];
  for (const [key, group] of depGroups) {
    const sample = group[0];
    const licensed = localLicense.get(key) || remoteLicense.get(key) || { license: "unknown", license_source: "" };
    records.push(record({
      name: sample.name,
      kind: "dependency",
      version: sample.version,
      license: licensed.license,
      license_source: licensed.license_source,
      call_sites: importSites.get(sample.name) || [],
      path: group.map((item) => item.package_json).sort()[0] || "",
      declared_in: [...new Set(group.map((item) => `${item.package_json}#${item.field}`))].sort(),
    }));
  }

  for (const [file, source] of texts) {
    const path = posixRel(root, file);
    const loader = isFileLoader(source);
    const meta = findOwnLicense(dirname(file), root, { inherit: true });
    records.push(record({
      name: path,
      kind: loader ? "file-loader" : "module",
      version: meta.version,
      license: meta.license,
      license_source: meta.license_source,
      call_sites: moduleSites.get(path) || [],
      path,
    }));
  }

  const toolNames = [];
  const adapterNames = [];
  const weightModels = [];
  const datasetNames = [];
  for (const [file, source] of texts) {
    const path = posixRel(root, file);
    for (const name of extractTools(source)) toolNames.push({ name, path });
    for (const name of extractAdapters(source)) adapterNames.push({ name, path });
    for (const model of extractWeightModels(source)) {
      const modelPath = posixRel(root, join(dirname(file), "connectomes", model.file));
      weightModels.push({ name: model.name, path: existsSync(join(root, modelPath)) ? modelPath : path, defined: path });
    }
    if (file.endsWith(`${sep}sources.mjs`) || file.endsWith("/sources.mjs")) {
      for (const name of extractSourceIds(source)) datasetNames.push({ name, path });
    }
    for (const name of extractDatasetSources(source)) datasetNames.push({ name, path });
  }

  const connectomeDir = join(root, "artifacts/v2/src/brain/connectomes");
  const weightFiles = new Set(weightModels.map((model) => model.path));
  if (existsSync(connectomeDir)) {
    for (const name of readdirSync(connectomeDir)) {
      if (!name.endsWith(".json")) continue;
      const path = posixRel(root, join(connectomeDir, name));
      if (weightFiles.has(path)) continue;
      datasetNames.push({ name: name.replace(/\.json$/, ""), path });
    }
  }

  function sitesFor(names, extraPaths) {
    const sites = new Set(extraPaths);
    for (const [file, source] of texts) {
      if (quotedNames(source, names).size > 0) sites.add(posixRel(root, file));
    }
    return sites;
  }

  for (const tool of toolNames) {
    const meta = findOwnLicense(dirname(join(root, tool.path)), root, { inherit: true });
    records.push(record({
      name: tool.name,
      kind: "tool",
      version: meta.version,
      license: meta.license,
      license_source: meta.license_source,
      call_sites: sitesFor([tool.name], [tool.path]),
      path: tool.path,
    }));
  }

  for (const model of weightModels) {
    const meta = findOwnLicense(dirname(join(root, model.path)), root, { inherit: false });
    records.push(record({
      name: model.name,
      kind: "model",
      version: meta.version,
      license: meta.license,
      license_source: meta.license_source,
      call_sites: sitesFor([model.name, model.path.split("/").pop()], [model.defined]),
      path: model.path,
    }));
  }
  for (const adapter of adapterNames) {
    records.push(record({
      name: adapter.name,
      kind: "model",
      version: "",
      license: "unknown",
      license_source: "",
      call_sites: sitesFor([adapter.name], [adapter.path]),
      path: adapter.path,
    }));
  }

  const datasets = new Map();
  for (const item of datasetNames) {
    const key = item.name;
    if (!datasets.has(key)) datasets.set(key, item);
    else if (!datasets.get(key).path.endsWith(".json") && item.path.endsWith(".json")) datasets.set(key, item);
  }
  for (const item of datasets.values()) {
    const meta = findOwnLicense(dirname(join(root, item.path)), root, { inherit: false });
    records.push(record({
      name: item.name,
      kind: "dataset",
      version: meta.version,
      license: meta.license,
      license_source: meta.license_source,
      call_sites: sitesFor([item.name, item.path.split("/").pop()], [item.path]),
      path: item.path,
    }));
  }

  records.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.path.localeCompare(b.path) || a.version.localeCompare(b.version));
  const targets = {
    dependencies: declared.map((dep) => ({
      name: dep.name,
      version: dep.version,
      package_json: dep.package_json,
      field: dep.field,
    })),
    brain: listBrainModules(root),
  };
  const measured = coverageOf(records, targets);
  return {
    schema: "tessera-rea-registry/v1",
    coverage: {
      before: 0,
      after: measured.fraction,
      numerator: measured.numerator,
      denominator: measured.denominator,
      package_dependencies: measured.package_dependencies,
      brain_modules: measured.brain_modules,
      unknown: measured.unknown,
    },
    records,
  };
}

export function loadPreviousCoverage(file, targets) {
  if (!existsSync(file)) {
    return { numerator: 0, denominator: targets.dependencies.length + targets.brain.length ? 0 : 0, fraction: 0 };
  }
  try {
    const previous = JSON.parse(readText(file));
    return coverageOf(previous.records || [], targets);
  } catch {
    return { numerator: 0, denominator: 0, fraction: 0 };
  }
}

export async function writeRegistry(root, outFile, options = {}) {
  const targets = {
    dependencies: listPackageDeps(root).map((dep) => {
      const lock = parseLockfile(existsSync(join(root, "pnpm-lock.yaml")) ? readText(join(root, "pnpm-lock.yaml")) : "");
      return { ...dep, ...resolveDepVersion(dep, lock, root) };
    }).map((dep) => ({ name: dep.name, version: dep.version, package_json: dep.package_json })),
    brain: listBrainModules(root),
  };
  const before = existsSync(outFile) ? loadPreviousCoverage(outFile, targets) : { numerator: 0, denominator: 0, fraction: 0 };
  const registry = await buildRegistry(root, options);
  registry.coverage.before = before.fraction;
  const after = {
    numerator: registry.coverage.numerator,
    denominator: registry.coverage.denominator,
    fraction: registry.coverage.after,
  };
  if (!fractionImproved(before, after)) {
    return { wrote: false, registry, before: before.fraction, after: after.fraction };
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(registry, null, 2)}\n`);
  return { wrote: true, registry, before: before.fraction, after: after.fraction };
}

async function main() {
  const args = process.argv.slice(2);
  const outFlag = args.indexOf("--out");
  const outFile = resolve(outFlag >= 0 ? args[outFlag + 1] : join(rootOfScript, "data/rea/registry.json"));
  const offline = args.includes("--offline");
  const result = await writeRegistry(rootOfScript, outFile, { offline });
  const unknown = result.registry.coverage.unknown.length;
  console.log(`coverage before=${result.before} after=${result.after} (${result.registry.coverage.numerator}/${result.registry.coverage.denominator}) unknown=${unknown} wrote=${result.wrote}`);
  if (!result.wrote) process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
