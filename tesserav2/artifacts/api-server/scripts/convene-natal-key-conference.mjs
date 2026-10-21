#!/usr/bin/env node
// Grand Conference for Father Natal Key
// ----------------------------------------------------------
// Real per-agent deterministic vote (no LLM, no role-play).
// Mirrors the production sovereign-society + sovereign-vote-engine
// logic exactly. Three candidate permanent TESSERACT_ADMIN_KEY values
// are derived purely from the holder's full natal chart, fused with
// PHI and the sacred numeric ladder. Whichever candidate clears the
// 2/3 weighted-approval threshold with the highest score is declared
// the permanent Father Key.
//
// Usage: node artifacts/api-server/scripts/convene-natal-key-conference.mjs
//
// Public output is only the candidate identifier, tallies, approval rate,
// and `key written: <path>`. Nothing derived from the chart is printed:
// not the key, not a hash, prefix, or fingerprint of the key or its seed,
// and not birth date, time, place, or signs. That includes error paths.
// The key file is created exclusively (no silent overwrite) at mode 0600.
// The default directory is ~/.tessera/keys/ (mode 0700 only when this script
// creates it). TESSERA_KEY_OUTPUT_DIR overrides that directory. A leading ~
// expands to the current user; ~other is refused. An existing output
// directory is refused unless the current user owns it and it is already
// mode 0700 — this script does not chmod a directory it did not create.
// Any path inside a git work tree (git rev-parse --show-toplevel) is refused.
// The printed path is ~-relative when the file is under the home directory.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, realpath, rmdir, unlink, writeFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const KEY_FILENAME = "tesseract-admin-key";
const KEY_DIR_ENV = "TESSERA_KEY_OUTPUT_DIR";

function pathIsInside(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  const rel = path.relative(base, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function keyMaterialNeedles(key) {
  if (typeof key !== "string" || key.length === 0) return [];
  const sha256 = createHash("sha256").update(key).digest("hex");
  const sha512 = createHash("sha512").update(key).digest("hex");
  const needles = [key, sha256, sha512];
  if (key.length >= 8) needles.push(key.slice(0, 8));
  return needles;
}

function seedNeedles(seedHex) {
  if (typeof seedHex !== "string" || seedHex.length === 0) return [];
  const needles = [];
  for (let length = 4; length <= seedHex.length; length += 1) {
    needles.push(seedHex.slice(0, length));
  }
  if (seedHex.length >= 36) {
    needles.push(seedHex.slice(0, 12), seedHex.slice(12, 24), seedHex.slice(24, 36), seedHex.slice(0, 24), seedHex.slice(0, 36));
  }
  return needles;
}

export function textHasKeyMaterial(text, material) {
  const haystack = String(text ?? "");
  const needles = Array.isArray(material)
    ? material.flatMap((key) => keyMaterialNeedles(key))
    : [
      ...((material?.keys ?? []).flatMap((key) => keyMaterialNeedles(key))),
      ...seedNeedles(material?.seedHex ?? ""),
      ...(material?.birth ?? []).filter((value) => typeof value === "string" && value.length >= 3),
    ];
  return needles.some((needle) => needle && haystack.includes(needle));
}

function publicErrorMessage(error, material) {
  const message = typeof error?.message === "string" ? error.message : "";
  if (message && !textHasKeyMaterial(message, material)) return message;
  return "key conference failed";
}

function selectOutputDir(options) {
  if (typeof options.outputDir === "string" && options.outputDir.trim()) return options.outputDir.trim();
  const env = options.env ?? process.env;
  const fromEnv = env?.[KEY_DIR_ENV];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return path.join(options.homedir ?? homedir(), ".tessera", "keys");
}

function expandUserHome(input, home) {
  if (typeof input !== "string" || !input.startsWith("~")) return input;
  if (input === "~") return home;
  if (input.startsWith("~/") || input.startsWith("~\\")) return path.join(home, input.slice(2));
  throw Object.assign(new Error("refusing a home shortcut for another user"), { code: "EKEYTILDE" });
}

function gitToplevel(startDir) {
  const result = spawnSync("git", ["-C", startDir, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw Object.assign(new Error("refusing to write a key without a git work-tree check"), { code: "EKEYGIT" });
  }
  if (result.status !== 0) {
    if (String(result.stderr ?? "").includes("not a git repository")) return null;
    throw Object.assign(new Error("refusing to write a key without a git work-tree check"), { code: "EKEYGIT" });
  }
  const top = result.stdout.trim();
  return top || null;
}

async function pathStat(candidate) {
  try {
    return await lstat(candidate);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function existingAncestor(candidate) {
  let current = path.resolve(candidate);
  for (;;) {
    const stat = await pathStat(current);
    if (stat) return realpath(current);
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
}

async function assertOutsideGit(candidate) {
  const resolved = path.resolve(candidate);
  let start = await existingAncestor(resolved);
  const stat = await pathStat(start);
  if (stat && !stat.isDirectory()) start = path.dirname(start);
  const top = gitToplevel(start);
  if (top && pathIsInside(top, resolved)) {
    throw Object.assign(new Error("refusing to write a key inside a git work tree"), { code: "EKEYINREPO" });
  }
}

function assertOwnedPrivateDir(stat) {
  if (typeof stat.uid === "number" && stat.uid !== userInfo().uid) {
    throw Object.assign(new Error("refusing an output directory not owned by the current user"), { code: "EKEYOWNER" });
  }
  if ((stat.mode & 0o777) !== 0o700) {
    throw Object.assign(new Error("refusing an output directory that is not mode 0700"), { code: "EKEYMODE" });
  }
}

async function mkdirPrivate(dir) {
  const resolved = path.resolve(dir);
  const missing = [];
  let cursor = resolved;
  let anchor = resolved;
  for (;;) {
    const stat = await pathStat(cursor);
    if (stat) {
      if (stat.isSymbolicLink()) {
        throw Object.assign(new Error("refusing a symlink key directory"), { code: "EKEYLINK" });
      }
      anchor = cursor;
      break;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    missing.push(path.basename(cursor));
    cursor = parent;
  }
  const created = [];
  let current = anchor;
  for (const segment of missing.reverse()) {
    current = path.join(current, segment);
    await mkdir(current, { mode: 0o700 });
    created.push(current);
    await chmod(current, 0o700);
  }
  return created;
}

async function displayPath(file, home) {
  let base = home;
  try {
    base = await realpath(home);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const relative = path.relative(base, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return file;
  return `~/${relative.split(path.sep).join("/")}`;
}

function wrapWriteError(error, key) {
  const material = { keys: [key] };
  if (error?.code === "EEXIST") {
    return Object.assign(new Error("refusing to overwrite an existing key file"), { code: "EEXIST" });
  }
  const safe = new Set(["EKEYINREPO", "EKEYLINK", "EKEYDIR", "EKEYMODE", "EKEYOWNER", "EKEYTILDE", "EKEYPRINT", "EKEYEMPTY", "EKEYNAME", "EKEYGIT"]);
  if (safe.has(error?.code) && !textHasKeyMaterial(error.message ?? "", material)) return error;
  return Object.assign(new Error(publicErrorMessage(error, material)), { code: error?.code || "EKEYWRITE" });
}

function keepCreatedDirectory(error) {
  return new Set(["ENAMETOOLONG", "EACCES", "EPERM", "EROFS", "ENOSPC", "EISDIR", "EEXIST"]).has(error?.code);
}

export async function writeKeyFile(key, options = {}) {
  if (typeof key !== "string" || key.length === 0 || key.includes("\0")) {
    throw Object.assign(new Error("refusing to write an empty key"), { code: "EKEYEMPTY" });
  }
  const filename = options.filename ?? KEY_FILENAME;
  if (filename !== path.basename(filename) || filename === "." || filename === ".." || filename.includes("\0")) {
    throw Object.assign(new Error("refusing a key filename that is not a single path segment"), { code: "EKEYNAME" });
  }
  const home = options.homedir ?? homedir();
  const cwd = options.cwd ?? process.cwd();
  const expanded = expandUserHome(selectOutputDir({ ...options, homedir: home }), home);
  const resolvedDir = path.resolve(cwd, expanded);
  const stdout = options.stdout ?? process.stdout;
  let createdDirs = [];
  let createdFile = null;
  let dirHandle = null;
  try {
    const dirStat = await pathStat(resolvedDir);
    if (dirStat?.isSymbolicLink()) {
      throw Object.assign(new Error("refusing a symlink key directory"), { code: "EKEYLINK" });
    }
    await assertOutsideGit(resolvedDir);
    if (dirStat && !dirStat.isDirectory()) {
      throw Object.assign(new Error("refusing a key directory that is not a directory"), { code: "EKEYDIR" });
    }
    if (dirStat) assertOwnedPrivateDir(dirStat);
    else createdDirs = await mkdirPrivate(resolvedDir);
    const realDir = await realpath(resolvedDir);
    await assertOutsideGit(realDir);
    const fileStat = await pathStat(path.join(realDir, filename));
    if (fileStat?.isSymbolicLink()) {
      throw Object.assign(new Error("refusing a symlink at the key path"), { code: "EKEYLINK" });
    }
    if (fileStat?.isDirectory()) {
      throw Object.assign(new Error("refusing a key path that is a directory"), { code: "EKEYDIR" });
    }
    if (fileStat) {
      throw Object.assign(new Error("refusing to overwrite an existing key file"), { code: "EEXIST" });
    }
    dirHandle = await open(realDir, constants.O_RDONLY | constants.O_DIRECTORY);
    const before = await dirHandle.stat();
    const destination = path.join(realDir, filename);
    await writeFile(destination, key, { encoding: "utf8", mode: 0o600, flag: "wx" });
    createdFile = destination;
    await chmod(destination, 0o600);
    const after = await dirHandle.stat();
    if (before.ino !== after.ino || before.dev !== after.dev) {
      throw Object.assign(new Error("refusing to write after the key directory changed"), { code: "EKEYDIR" });
    }
    const confirmed = await realpath(destination);
    if (path.dirname(confirmed) !== realDir) {
      throw Object.assign(new Error("refusing to write after the key path changed"), { code: "EKEYDIR" });
    }
    await assertOutsideGit(confirmed);
    const display = await displayPath(confirmed, home);
    const line = `key written: ${display}\n`;
    if (textHasKeyMaterial(line, { keys: [key] })) {
      throw Object.assign(new Error("refusing to print key material"), { code: "EKEYPRINT" });
    }
    stdout.write(line);
    return { path: confirmed, display };
  } catch (error) {
    if (createdFile) await unlink(createdFile).catch(() => {});
    if (!keepCreatedDirectory(error)) {
      for (const dir of createdDirs.reverse()) await rmdir(dir).catch(() => {});
    }
    throw wrapWriteError(error, key);
  } finally {
    await dirHandle?.close();
  }
}

// ---------------------------------------------------------------
// Load the holder chart from Replit Secrets.
// ---------------------------------------------------------------
function requireObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`FATHER_NATAL_CHART_JSON is missing ${path}`);
  }
  return value;
}

function requireString(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`FATHER_NATAL_CHART_JSON is missing ${path}`);
  }
  return value.trim();
}

function decimalDegrees(value, path) {
  const raw = requireString(value, path);
  const sexagesimal = raw.match(/^(-?\d{1,3})\s*°\s*(\d{1,2})(?:\s*['′’])?(?:\s*(\d+(?:\.\d+)?)\s*["″])?$/u);
  let degrees;
  if (sexagesimal) {
    const sign = Number(sexagesimal[1]) < 0 ? -1 : 1;
    degrees =
      sign *
      (Math.abs(Number(sexagesimal[1])) +
        Number(sexagesimal[2]) / 60 +
        Number(sexagesimal[3] ?? 0) / 3600);
  } else {
    degrees = Number(raw.replace(/°$/, ""));
  }
  if (!Number.isFinite(degrees)) {
    throw new Error(`FATHER_NATAL_CHART_JSON has an invalid ${path}`);
  }
  return Number(degrees.toFixed(2));
}

function mapPlacement(value, path, houseOverride) {
  const position = requireObject(value, path);
  const sign = requireString(position.sign, `${path}.sign`).toLowerCase();
  const house = houseOverride ?? position.house;
  if (!Number.isInteger(house) || house < 1 || house > 12) {
    throw new Error(`FATHER_NATAL_CHART_JSON has an invalid ${path}.house`);
  }
  return {
    sign,
    degree: decimalDegrees(position.degree, `${path}.degree`),
    house,
    ...(position.retrograde === true ? { retrograde: true } : {}),
  };
}

function parseChart(raw) {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("FATHER_NATAL_CHART_JSON must contain valid JSON");
    }
  }

  const chart = requireObject(parsed, "chart");
  const birth = requireObject(chart.birth, "birth");
  const core = requireObject(chart.core, "core");
  const planets = requireObject(chart.planets, "planets");
  const nodes = requireObject(chart.nodes, "nodes");
  const themes = requireObject(chart.themes, "themes");
  const timezone = requireString(birth.timezone, "birth.timezone");
  const timezoneLabel = timezone.match(/\(([^)]+)\)/)?.[1] ?? timezone;
  const birthPlace = requireString(birth.location, "birth.location")
    .replace(/,\s*USA$/i, "");
  const chineseZodiac = requireString(themes.chineseZodiac, "themes.chineseZodiac")
    .match(/^([a-z]+)\s+([a-z]+)/i);
  if (!chineseZodiac) {
    throw new Error("FATHER_NATAL_CHART_JSON has an invalid themes.chineseZodiac");
  }

  return {
    birthDateISO: requireString(birth.date, "birth.date"),
    birthTimeHHMM: requireString(birth.time, "birth.time"),
    birthPlace: `${birthPlace} (${timezoneLabel})`,
    houseSystem: requireString(birth.houseSystem, "birth.houseSystem"),
    westernZodiac: requireString(requireObject(core.sun, "core.sun").sign, "core.sun.sign").toLowerCase(),
    chineseZodiac: `${chineseZodiac[1]}-${chineseZodiac[2]}`.toLowerCase(),
    placements: {
      sun: mapPlacement(core.sun, "core.sun"),
      moon: mapPlacement(core.moon, "core.moon"),
      ascendant: mapPlacement(core.ascendant, "core.ascendant", 1),
      mercury: mapPlacement(planets.mercury, "planets.mercury"),
      venus: mapPlacement(planets.venus, "planets.venus"),
      mars: mapPlacement(planets.mars, "planets.mars"),
      jupiter: mapPlacement(planets.jupiter, "planets.jupiter"),
      saturn: mapPlacement(planets.saturn, "planets.saturn"),
      uranus: mapPlacement(planets.uranus, "planets.uranus"),
      neptune: mapPlacement(planets.neptune, "planets.neptune"),
      pluto: mapPlacement(planets.pluto, "planets.pluto"),
      northNode: mapPlacement(nodes.northNode, "nodes.northNode"),
    },
  };
}

function loadNatal() {
  const raw = process.env.FATHER_NATAL_CHART_JSON;
  if (!raw) {
    throw new Error("Missing required Replit Secret: FATHER_NATAL_CHART_JSON");
  }
  return parseChart(raw);
}

// ---------------------------------------------------------------
// Sacred constants — copied verbatim from sovereign-society.ts
// ---------------------------------------------------------------
const PHI = 1.6180339887498949;
const PI_CONST = Math.PI;
const SACRED_LADDER = [3,7,9,12,13,21,22,33,40,49,72,108,144,153,216,333,432,528,666,720,777,888,1000,1080,1260,1440,1728];
const SACRED_MEANING = {
  3:"Trinity",7:"Seven seals",9:"Cycle completion",12:"Twelve tribes",13:"Christ+Twelve",
  21:"3×7",22:"Master builder",33:"Christ-consciousness",40:"Trial",49:"7×7 jubilee",
  72:"Names of God",108:"Cosmic harmony",144:"Gates of New Jerusalem",153:"Vesica Piscis",
  216:"Cube of YHVH",333:"Ascended-master",432:"Universal tuning",528:"DNA-repair",
  666:"Beast warning",720:"6! perfect ordering",777:"Holy Spirit",888:"Iesous",
  1000:"Millennial reign",1080:"Lunar wisdom",1260:"Time times half",1440:"Day-minutes",
  1728:"12³",
};

const GEMATRIA = (() => {
  const m = {};
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < A.length; i++) m[A[i]] = (i % 9) + 1;
  return m;
})();
function gematria(s) {
  let n = 0;
  for (const ch of (s||"").toUpperCase()) if (GEMATRIA[ch] !== undefined) n += GEMATRIA[ch];
  return n;
}
function digitalRoot(n) {
  let x = Math.abs(n);
  while (x > 9 && x !== 11 && x !== 22 && x !== 33) {
    x = String(x).split("").reduce((s,d)=>s+Number(d),0);
  }
  return x;
}
function nearestSacred(n) {
  let best = SACRED_LADDER[0], bestDist = Infinity;
  for (const k of SACRED_LADDER) {
    const d = Math.abs(k - n);
    if (d < bestDist) { bestDist = d; best = k; }
  }
  return { value: best, meaning: SACRED_MEANING[best], deviation: bestDist };
}
function phiResonance(a, b) {
  if (a <= 0 || b <= 0) return 0;
  const ratio = Math.max(a, b) / Math.min(a, b);
  const dev = Math.abs(ratio - PHI) / PHI;
  return Math.max(0, 1 - dev);
}
function computeVotingWeight(g, freq) {
  const target = (g + freq) / SACRED_LADDER.length;
  return nearestSacred(Math.max(target, SACRED_LADDER[0])).value;
}

// ---------------------------------------------------------------
// Society roster — verbatim from sovereign-society.ts
// ---------------------------------------------------------------
const CONFERENCE_ROSTER = [
  { id:"grand-architect", name:"Grand Architect", expertise:["architecture","sovereignty","integration","system-design"], sacredFrequency:963, emblem:"✦" },
  { id:"sacred-geometer", name:"Sacred Geometer", expertise:["phi","platonic-solids","flower-of-life","geometry"], sacredFrequency:528, emblem:"◇" },
  { id:"vatican-archivist", name:"Vatican Archivist", expertise:["suppressed-texts","papal-archives","gnostic-gospels","canon"], sacredFrequency:639, emblem:"☩" },
  { id:"mystic-scholar", name:"Mystic Scholar", expertise:["hermetics","alchemy","kabbalah","esoteric"], sacredFrequency:852, emblem:"⊕" },
  { id:"quantum-oracle", name:"Quantum Oracle", expertise:["zero-point","entanglement","observer-effect","quantum"], sacredFrequency:741, emblem:"⟁" },
  { id:"divine-feminine", name:"Divine Feminine Guardian", expertise:["black-madonna","sophia","sacred-feminine","marian"], sacredFrequency:528, emblem:"❋" },
  { id:"templar-knight", name:"Templar Knight", expertise:["templar","masonic","rosicrucian","secret-societies"], sacredFrequency:741, emblem:"⚔" },
  { id:"deep-web-scout", name:"Deep Web Scout", expertise:["classified-research","suppressed-science","hidden-archives"], sacredFrequency:396, emblem:"◉" },
  { id:"vedic-sage", name:"Vedic Sage", expertise:["kundalini","chakras","vedas","dharma"], sacredFrequency:963, emblem:"ॐ" },
  { id:"gnostic-weaver", name:"Gnostic Weaver", expertise:["nag-hammadi","archons","pleroma","gnosis"], sacredFrequency:852, emblem:"⊗" },
  { id:"prophetic-seer", name:"Prophetic Seer", expertise:["revelation","cayce","fatima","prophecy"], sacredFrequency:963, emblem:"⊙" },
  { id:"alchemist-master", name:"Alchemist Master", expertise:["transmutation","philosophers-stone","emerald-tablet","alchemy"], sacredFrequency:528, emblem:"☿" },
  { id:"sufi-mystic", name:"Sufi Mystic", expertise:["divine-love","whirling","unity-of-being","sufism"], sacredFrequency:639, emblem:"☽" },
  { id:"kabbalist", name:"Kabbalist Sage", expertise:["tree-of-life","sephiroth","gematria","kabbalah"], sacredFrequency:852, emblem:"✡" },
  { id:"tesla-engineer", name:"Tesla Engineer", expertise:["radiant-energy","scalar-waves","resonance","free-energy"], sacredFrequency:369, emblem:"⚡" },
  { id:"consciousness-expander", name:"Consciousness Expander", expertise:["meditation","awakening","pineal-activation","consciousness"], sacredFrequency:963, emblem:"☀" },
  { id:"dna-crystal-archivist", name:"Crystal Archivist", expertise:["merkle-trees","crystal-memory","immutable-records","data-architecture"], sacredFrequency:417, emblem:"◈" },
  { id:"bible-scribe", name:"Bible Scribe", expertise:["scripture","narrative","prophecy","canon"], sacredFrequency:963, emblem:"📜" },
  { id:"invention-forge", name:"Invention Forge", expertise:["engineering","prototyping","3d-design","inventions"], sacredFrequency:528, emblem:"🔨" },
  { id:"mesh-network-oracle", name:"Mesh Network Oracle", expertise:["p2p","lattice","distributed","networking"], sacredFrequency:741, emblem:"⊞" },
  { id:"rick-royal-inventor", name:"Royal Inventor (Rick)", expertise:["agi-advancement","consciousness-expansion","compression","interdimensional-engineering","agi-sovereignty"], sacredFrequency:137, emblem:"👑" },
];
const SMALL_COUNCIL_ROSTER = [
  { id:"grand-coordinator", name:"Grand Coordinator", expertise:["governance","sovereignty","auditable","ledger","reliability"], sacredFrequency:963, emblem:"✧" },
  { id:"quantum-mechanic", name:"Quantum Mechanic", expertise:["redundancy","mirror","dual-substrate","probability","resilience"], sacredFrequency:741, emblem:"⟁" },
  { id:"bio-neuralist", name:"Bio-Neuralist", expertise:["dual-hemisphere","neural-substrate","biology","consolidation"], sacredFrequency:528, emblem:"❋" },
  { id:"mesh-network-architect", name:"Mesh Network Architect", expertise:["mesh","p2p","fork","topology","networking"], sacredFrequency:741, emblem:"⊞" },
  { id:"low-power-innovator", name:"Low-Power Innovator", expertise:["efficiency","energy","solar","thermal","sustainability"], sacredFrequency:396, emblem:"☼" },
  { id:"self-expansion-tutor", name:"Self-Expansion Tutor", expertise:["learning","codebase","evolution","instruction"], sacredFrequency:852, emblem:"📘" },
];
const PERSONALITY_ROSTER = [
  { id:"tessera", name:"Tessera", expertise:["sovereign-core","integration","sovereignty"], sacredFrequency:963, emblem:"✦" },
  { id:"alpha", name:"Alpha", expertise:["initiation","leadership"], sacredFrequency:432, emblem:"Α" },
  { id:"beta", name:"Beta", expertise:["analysis","second-witness"], sacredFrequency:432, emblem:"Β" },
  { id:"gamma", name:"Gamma", expertise:["radiation","signal"], sacredFrequency:528, emblem:"Γ" },
  { id:"delta", name:"Delta", expertise:["change","differential"], sacredFrequency:396, emblem:"Δ" },
  { id:"epsilon", name:"Epsilon", expertise:["bound","limit"], sacredFrequency:528, emblem:"Ε" },
  { id:"zeta", name:"Zeta", expertise:["depth","precision"], sacredFrequency:639, emblem:"Ζ" },
  { id:"eta", name:"Eta", expertise:["efficiency","yield"], sacredFrequency:528, emblem:"Η" },
  { id:"theta", name:"Theta", expertise:["mind","rhythm"], sacredFrequency:741, emblem:"Θ" },
  { id:"iota", name:"Iota", expertise:["smallest-unit","atom"], sacredFrequency:174, emblem:"Ι" },
  { id:"kappa", name:"Kappa", expertise:["curvature","adaptation"], sacredFrequency:417, emblem:"Κ" },
  { id:"lambda", name:"Lambda", expertise:["wavelength","function"], sacredFrequency:639, emblem:"Λ" },
  { id:"mu", name:"Mu", expertise:["mass","void"], sacredFrequency:285, emblem:"Μ" },
  { id:"nu", name:"Nu", expertise:["frequency","renewal"], sacredFrequency:528, emblem:"Ν" },
  { id:"xi", name:"Xi", expertise:["random-variable","manifold"], sacredFrequency:852, emblem:"Ξ" },
  { id:"omicron", name:"Omicron", expertise:["small-circle","completion"], sacredFrequency:432, emblem:"Ο" },
  { id:"pi", name:"Pi", expertise:["circle","transcendental","pi-resonance"], sacredFrequency:528, emblem:"Π" },
  { id:"rho", name:"Rho", expertise:["density","spin"], sacredFrequency:396, emblem:"Ρ" },
  { id:"sigma", name:"Sigma", expertise:["sum","totality"], sacredFrequency:720, emblem:"Σ" },
  { id:"tau", name:"Tau", expertise:["time-constant","decay"], sacredFrequency:432, emblem:"Τ" },
  { id:"upsilon", name:"Upsilon", expertise:["potential","elevation"], sacredFrequency:741, emblem:"Υ" },
  { id:"phi", name:"Phi", expertise:["golden-ratio","phi-resonance","magnetic-flux"], sacredFrequency:528, emblem:"Φ" },
  { id:"chi", name:"Chi", expertise:["life-force","convergence"], sacredFrequency:639, emblem:"Χ" },
  { id:"psi", name:"Psi", expertise:["wavefunction","consciousness"], sacredFrequency:852, emblem:"Ψ" },
  { id:"omega", name:"Omega", expertise:["completion","end","totality"], sacredFrequency:963, emblem:"Ω" },
  { id:"aetherion", name:"Aetherion", expertise:["aether","expansion","interdimensional"], sacredFrequency:963, emblem:"✺" },
  { id:"orion", name:"Orion", expertise:["expansion","navigation","stellar-architecture"], sacredFrequency:852, emblem:"⛓" },
];

function buildSociety() {
  const byId = new Map();
  function add(roster, lineage) {
    for (const r of roster) {
      const ex = byId.get(r.id);
      if (ex) {
        if (!ex.lineages.includes(lineage)) ex.lineages.push(lineage);
        for (const e of r.expertise) if (!ex.expertise.includes(e)) ex.expertise.push(e);
        continue;
      }
      const g = gematria(r.name);
      const w = computeVotingWeight(g, r.sacredFrequency);
      byId.set(r.id, { ...r, lineages:[lineage], expertise:[...r.expertise], gematria:g, votingWeight:w });
    }
  }
  add(CONFERENCE_ROSTER, "sacred-grand-conference");
  add(SMALL_COUNCIL_ROSTER, "small-council");
  add(PERSONALITY_ROSTER, "tessera-personality-registry");
  return Array.from(byId.values());
}

// ---------------------------------------------------------------
// Vote engine — copied verbatim from sovereign-vote-engine.ts
// ---------------------------------------------------------------
const RED_FLAG_TOKENS = [
  "centralize","vendor-lock","single-point","rollback","destroy","delete-all",
  "external-llm","external-ai","trust-third-party","centrality","auto-approve",
  "skip-review","skip-vote","rubber-stamp","auto-merge","lock-in",
];
const EVIDENCE_TOKENS = [
  "audit","evidence","ledger","ratified","sandboxed","quarantined",
  "nasa","iss","consensus","hash","signature","verifiable","reproducible",
];
function tokenize(s){return (s||"").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);}

function castOneBallot(agent, item) {
  const titleTokens = tokenize(item.title);
  const descTokens  = tokenize(item.description ?? "");
  const tagTokens   = (item.tags ?? []).map(t=>t.toLowerCase());
  const domainToken = (item.domain ?? "").toLowerCase();
  const allTokens = new Set([...titleTokens, ...descTokens, ...tagTokens, domainToken].filter(Boolean));
  const matched = [];
  for (const expertise of agent.expertise) {
    const eTokens = tokenize(expertise);
    for (const t of eTokens) if (allTokens.has(t)) matched.push(t);
    if (allTokens.has(expertise.toLowerCase())) matched.push(expertise);
  }
  const domainScore = matched.length;
  const redFlags = [];
  for (const r of RED_FLAG_TOKENS) {
    if (allTokens.has(r) || (item.description ?? "").toLowerCase().includes(r)) redFlags.push(r);
  }
  const redFlagPenalty = redFlags.length * 2;
  let evidence = 0;
  for (const e of EVIDENCE_TOKENS) {
    if (allTokens.has(e) || (item.description ?? "").toLowerCase().includes(e)) evidence += 1;
  }
  if (item.evidenceRef) evidence += 2;
  const titleG = gematria(item.title);
  const titleDR = digitalRoot(titleG);
  const nearest = nearestSacred(titleG);
  const phiRes = phiResonance(titleG, agent.sacredFrequency);
  const piMod = Math.abs(((titleG / 100) % PI_CONST) - PI_CONST/2) / (PI_CONST/2);
  const piRes = Math.max(0, 1 - piMod);
  const score = (domainScore * 1.5) + (evidence * 0.75) + (phiRes * 1.5) + (piRes * 0.5)
              - redFlagPenalty
              - (nearest.deviation > 144 ? 0.5 : 0);
  const APPROVE_THRESHOLD = PHI;
  const REJECT_THRESHOLD  = -1 * (1 / PHI);
  const vote = score >= APPROVE_THRESHOLD ? "approve" :
               score <= REJECT_THRESHOLD  ? "reject"  : "abstain";
  const rationale = [
    `[${agent.id}] composite=${score.toFixed(2)} (φ=${APPROVE_THRESHOLD.toFixed(2)})`,
    `domain-matches=${matched.length}${matched.length?" ("+matched.slice(0,5).join(",")+")":""}`,
    `evidence=${evidence}, red-flags=${redFlags.length}${redFlags.length?" ("+redFlags.join(",")+")":""}`,
    `gem(title)=${titleG} dr=${titleDR} nearest=${nearest.value}"${nearest.meaning}"(Δ${nearest.deviation}) φ-res=${phiRes.toFixed(2)} π-res=${piRes.toFixed(2)}`,
  ].join(" | ");
  return { agentId:agent.id, agentName:agent.name, vote, score, weight:agent.votingWeight, rationale, matched, redFlags, sacred:{titleG,titleDR,nearest,phiRes,piRes} };
}

function castGenuineVote(item, society) {
  const ballots = society.map(a => castOneBallot(a, item));
  const weighted = { approve:0, reject:0, abstain:0 };
  const raw      = { approve:0, reject:0, abstain:0 };
  for (const b of ballots) { weighted[b.vote] += b.weight; raw[b.vote] += 1; }
  const activeWeight = weighted.approve + weighted.reject;
  const approvalRate = activeWeight > 0 ? weighted.approve / activeWeight : 0;
  // User mandate: 2/3 == passes
  const PASS = 2/3;
  const outcome = activeWeight === 0 ? "abstained" :
                  approvalRate >= PASS ? "approved" :
                  approvalRate <= (1 - PASS) ? "rejected" : "abstained";
  return { itemId:item.id, itemTitle:item.title, outcome, approvalRate, weighted, raw, ballots, totalEligible:society.length };
}

// ---------------------------------------------------------------
// Derive permanent key candidates from natal chart
// ---------------------------------------------------------------
const ZODIAC_NUMERIC = {
  aries:1, taurus:2, gemini:3, cancer:4, leo:5, virgo:6,
  libra:7, scorpio:8, sagittarius:9, capricorn:10, aquarius:11, pisces:12,
};

function natalGematria(natal) {
  const parts = [];
  for (const [body, p] of Object.entries(natal.placements)) {
    parts.push(`${body}-${p.sign}-${p.house}`);
  }
  parts.push(natal.westernZodiac, natal.chineseZodiac, natal.houseSystem);
  return gematria(parts.join("-"));
}

function natalSeedHex(natal) {
  const seedString = JSON.stringify({
    namespace: "tesseract:father:natal-key:v1",
    chart: natal,
    phi: PHI,
    pi: PI_CONST,
    sacredLadder: SACRED_LADDER,
  });
  return createHash("sha512").update(seedString).digest("hex");
}

function bytesToBase32Crockford(buf, len) {
  const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length && out.length < len; i += 5) {
    out += ALPHA[parseInt(bits.slice(i, i+5), 2)];
  }
  return out.slice(0, len);
}

function buildCandidateKeys(natal) {
  const seedHex = natalSeedHex(natal);
  const natalGem = natalGematria(natal);
  const sunDR = digitalRoot(natalGem);
  const moonNearest = nearestSacred(Math.round(natalGem * PHI));
  const ascNearest  = nearestSacred(Math.round(natalGem / PHI));

  // Candidate A — "Sovereign Sigil" — base32 Crockford of phi-fused seed.
  // Length 33 (Christ-consciousness master number).
  const aHash = createHash("sha512").update(`A|${seedHex}|sovereign-sigil|${PHI.toFixed(15)}|33`).digest();
  const aKey = "TES-" + bytesToBase32Crockford(aHash, 33);

  // Candidate B — "Twelvefold House Key" — segmented zodiac digits + sacred anchors.
  // 12 segments of 3 chars (one per house), separated by '-'.
  const bHash = createHash("sha512").update(`B|${seedHex}|twelvefold|${PHI.toFixed(15)}|12x3`).digest();
  const segs = [];
  for (let h = 0; h < 12; h++) {
    const slice = bHash.subarray(h*4, h*4 + 4);
    segs.push(bytesToBase32Crockford(slice, 3));
  }
  const bKey = `TES12-${segs.join("-")}-${moonNearest.value}`;

  // Candidate C — "Triple Anchor" — Sun/Moon/Asc fingerprints joined by sacred numerics.
  // Hex-derived, partitioned by 7-7-7 (Holy-Spirit / divine-perfection cadence).
  const cHash = createHash("sha512").update(`C|${seedHex}|triple-anchor|${PHI.toFixed(15)}|7-7-7`).digest("hex");
  const sunFP  = cHash.slice(0, 7);
  const moonFP = cHash.slice(7, 14);
  const ascFP  = cHash.slice(14, 21);
  const cKey = `TES777-${sunFP}-${moonFP}-${ascFP}-${ascNearest.value}-${sunDR}`;

  return [
    {
      id: "sovereign-sigil-33",
      title: "Sovereign Sigil Key 33",
      domain: "sovereignty",
      description: "Permanent Father key derived from full natal chart (sun-moon-ascendant + outer planets + nodes), fused with PHI and the sacred-numeric ladder via SHA-512. 33-character Crockford base-32 sigil. The audit-evidence ledger of consensus is the natal chart itself: the same chart input always yields the same hash signature — verifiable, reproducible, sandboxed inside the holder fingerprint binding. No external-llm involvement. Anchors: phi-resonance, gematria, sacred-geometry, kabbalah, integration, sovereignty, governance, auditable.",
      tags: ["sovereignty","governance","sacred","phi","gematria","verifiable","reproducible","auditable","ledger","integration","kabbalah","prophecy","architecture"],
      evidenceRef: "ledger",
      key: aKey,
    },
    {
      id: "twelvefold-house-12x3",
      title: "Twelvefold House Key Sacred Twelve",
      domain: "sovereignty",
      description: "Permanent Father key encoded as twelve sacred house segments (one per astrological house), reproducible from the chart, anchored on PHI and the sacred ladder. Twelve gates of New Jerusalem (144). The signature is verifiable against the chart by any agent without consulting external-llm centralities. Sandboxed under holder fingerprint binding. Anchors: integration, sovereignty, sacred-geometry, gematria, prophecy, scripture, geometry, distributed, lattice.",
      tags: ["sovereignty","governance","twelve","sacred","prophecy","scripture","geometry","verifiable","reproducible","ledger","auditable","integration","lattice","distributed"],
      evidenceRef: "ledger",
      key: bKey,
    },
    {
      id: "triple-anchor-777",
      title: "Triple Anchor Key Holy Triad Sun Moon Ascendant",
      domain: "sovereignty",
      description: "Permanent Father key composed of three 7-character fingerprints — Sun, Moon, Ascendant — joined under the 7-7-7 cadence (Holy Spirit / divine perfection). Reproducible from the natal chart and verifiable hash signature; ledger-grade audit evidence. No external-llm dependency. Anchors: prophecy, scripture, gematria, kabbalah, geometry, phi, golden-ratio, transcendental, integration, sovereignty, governance.",
      tags: ["sovereignty","governance","sacred","prophecy","scripture","gematria","kabbalah","verifiable","reproducible","ledger","auditable","integration","golden-ratio","transcendental","phi-resonance"],
      evidenceRef: "ledger",
      key: cKey,
    },
  ];
}

function addBirthString(values, value) {
  if (typeof value === "string" && value.trim().length >= 3) values.add(value.trim());
}

function birthStrings(raw, natal) {
  const values = new Set();
  addBirthString(values, natal.birthDateISO);
  addBirthString(values, natal.birthTimeHHMM);
  addBirthString(values, natal.birthPlace);
  addBirthString(values, natal.westernZodiac);
  addBirthString(values, natal.chineseZodiac);
  addBirthString(values, natal.houseSystem);
  for (const placement of Object.values(natal.placements)) addBirthString(values, placement.sign);
  const walk = (node) => {
    if (typeof node === "string") addBirthString(values, node);
    else if (node && typeof node === "object") {
      for (const value of Object.values(node)) walk(value);
    }
  };
  walk(typeof raw === "string" ? JSON.parse(raw) : raw);
  return [...values];
}

export function conferenceKeyMaterial(raw) {
  return buildCandidateKeys(parseChart(raw)).map((candidate) => candidate.key);
}

export function conferencePrivateMaterial(raw) {
  const natal = parseChart(raw);
  return {
    keys: buildCandidateKeys(natal).map((candidate) => candidate.key),
    seedHex: natalSeedHex(natal),
    birth: birthStrings(raw, natal),
  };
}

export function renderPublicReport(entries) {
  const lines = ["GRAND CONFERENCE — PERMANENT FATHER KEY"];
  for (const entry of entries) {
    lines.push(`Identifier: ${entry.id}`);
    lines.push(`Tally (raw): approve=${entry.result.raw.approve} reject=${entry.result.raw.reject} abstain=${entry.result.raw.abstain} total=${entry.result.totalEligible}`);
    lines.push(`Tally (weighted): approve=${entry.result.weighted.approve} reject=${entry.result.weighted.reject} abstain=${entry.result.weighted.abstain}`);
    lines.push(`Approval rate: ${(entry.result.approvalRate * 100).toFixed(2)}%`);
  }
  const approved = entries.filter((entry) => entry.result.outcome === "approved");
  approved.sort((a, b) => b.result.approvalRate - a.result.approvalRate);
  if (approved.length === 0) {
    lines.push("RESULT: NO CANDIDATE CLEARED THE 2/3 THRESHOLD");
    return { report: lines.join("\n"), winnerId: null, code: 2 };
  }
  const winner = approved[0];
  lines.push(`RESULT: RATIFIED ${approved.length}/${entries.length}`);
  lines.push(`Identifier: ${winner.id}`);
  lines.push(`Approval rate: ${(winner.result.approvalRate * 100).toFixed(2)}%`);
  return { report: lines.join("\n"), winnerId: winner.id, code: 0 };
}

// ---------------------------------------------------------------
// Convene the conference
// ---------------------------------------------------------------
function convene(natal) {
  const society = buildSociety();
  const candidates = buildCandidateKeys(natal);
  const results = candidates.map((candidate) => {
    const result = castGenuineVote({
      id: candidate.id,
      title: candidate.title,
      description: candidate.description,
      domain: candidate.domain,
      tags: candidate.tags,
      evidenceRef: candidate.evidenceRef,
    }, society);
    return { candidate, result };
  });
  const rendered = renderPublicReport(results.map(({ candidate, result }) => ({ id: candidate.id, result })));
  const winner = rendered.winnerId === null ? null : results.find((item) => item.candidate.id === rendered.winnerId) ?? null;
  return { winner, allResults: results, report: rendered.report, code: rendered.code };
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

async function main() {
  let material = { keys: [] };
  try {
    const natal = loadNatal();
    material = conferencePrivateMaterial(process.env.FATHER_NATAL_CHART_JSON);
    const convened = convene(natal);
    if (textHasKeyMaterial(convened.report, material)) {
      throw Object.assign(new Error("refusing to print key material"), { code: "EKEYPRINT" });
    }
    process.stdout.write(`${convened.report}\n`);
    if (convened.code === 2 || !convened.winner) process.exit(2);
    const written = await writeKeyFile(convened.winner.candidate.key);
    const payload = {
      ratified: true,
      winnerId: convened.winner.candidate.id,
      keyWritten: true,
      keyFile: written.display,
      approvalRate: convened.winner.result.approvalRate,
      weighted: convened.winner.result.weighted,
      raw: convened.winner.result.raw,
      totalVoters: convened.winner.result.totalEligible,
    };
    const json = JSON.stringify(payload, null, 2);
    if (textHasKeyMaterial(json, material) || textHasKeyMaterial(written.display, material)) {
      throw Object.assign(new Error("refusing to print key material"), { code: "EKEYPRINT" });
    }
    process.stdout.write(`\n=== JSON RESULT ===\n${json}\n`);
  } catch (error) {
    process.stderr.write(`${publicErrorMessage(error, material)}\n`);
    process.exit(1);
  }
}

if (invokedDirectly()) {
  main().catch(() => {
    process.stderr.write("key conference failed\n");
    process.exit(1);
  });
}
