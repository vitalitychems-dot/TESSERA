/**
 * HYB-014 historical merge gate.
 *
 * Reports duplicate workspace roots, stale app references, secret-shaped
 * tracked paths, and the status of typecheck, tests, build, and audit.
 * Static checks run by default. Pass --run-suite to execute the four
 * workspace commands and record their exit status. Does not edit CI workflows.
 *
 * Usage: node scripts/historical-merge-gate.mjs [--run-suite]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const STALE_APP_PATTERNS = [
  /artifacts\/vitality-supply\b/,
  /artifacts\/vitality-storefront\b/,
  /artifacts\/storefront\b/,
  /projects\/vitality-chems-storefront\b/,
  /@workspace\/vitality-supply\b/,
  /@workspace\/vitality-storefront\b/,
];

const ACTIVE_TEXT_FILES = [
  "pnpm-workspace.yaml",
  "package.json",
  "scripts/dev-unified.mjs",
  "scripts/build-unified.mjs",
  "scripts/test-unified.mjs",
  "scripts/suite-policy.mjs",
];

const SECRET_PATH = [
  /(^|\/)\.env($|\.)/,
  /(^|\/).+\.pem$/,
  /(^|\/).+\.key$/,
  /(^|\/)credentials[^/]*\.json$/,
  /(^|\/)secrets[^/]*\.json$/,
  /(^|\/)service-account[^/]*\.json$/,
  /(^|\/)id_rsa$/,
];

function workspacePatterns() {
  const text = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const patterns = [];
  let inPackages = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("packages:")) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (/^\S/.test(line)) break;
    const match = line.match(/^\s+-\s+(\S+)\s*$/);
    if (match) patterns.push(match[1]);
  }
  return patterns;
}

function expandPattern(pattern) {
  if (!pattern.includes("*")) {
    return existsSync(join(root, pattern, "package.json")) ? [pattern] : [];
  }
  const dir = pattern.replace(/\/\*$/, "");
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(absolute, entry.name, "package.json")))
    .map((entry) => `${dir}/${entry.name}`);
}

export function duplicateWorkspaceRoots() {
  const seen = new Map();
  for (const pattern of workspacePatterns()) {
    for (const path of expandPattern(pattern)) {
      const prior = seen.get(path);
      if (prior) prior.push(pattern);
      else seen.set(path, [pattern]);
    }
  }
  return [...seen.entries()]
    .filter(([, patterns]) => patterns.length > 1)
    .map(([path, patterns]) => `${path} (${patterns.join(", ")})`);
}

function activeManifests() {
  const files = [...ACTIVE_TEXT_FILES];
  for (const dir of ["artifacts", "lib", "scripts"]) {
    const absolute = join(root, dir);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = join(dir, entry.name, "package.json");
      if (existsSync(join(root, manifest))) files.push(manifest);
    }
  }
  return files;
}

export function staleAppReferences() {
  const hits = [];
  for (const relative of activeManifests()) {
    const text = readFileSync(join(root, relative), "utf8");
    for (const pattern of STALE_APP_PATTERNS) {
      if (pattern.test(text)) hits.push(`${relative}: ${pattern.source}`);
    }
  }
  return hits;
}

export function secretShapedPaths() {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(listed.stderr || "git ls-files failed");
  }
  const paths = listed.stdout.split("\0").filter(Boolean);
  return paths.filter((path) => {
    if (path === ".env.example" || path.endsWith("/.env.example")) return false;
    return SECRET_PATH.some((pattern) => pattern.test(path));
  });
}

function runCommand(title, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit" });
  const ok = result.status === 0;
  return { line: `${title}: ${ok ? "pass" : "fail"}`, ok };
}

export function renderReport({ runSuite, commandRunner = runCommand }) {
  const duplicates = duplicateWorkspaceRoots();
  const stale = staleAppReferences();
  const secrets = secretShapedPaths();
  const lines = [
    "historical-merge-gate",
    `duplicate_workspace_roots: ${duplicates.length}`,
    ...duplicates.map((item) => `  - ${item}`),
    `stale_app_references: ${stale.length}`,
    ...stale.map((item) => `  - ${item}`),
    `secret_shaped_paths: ${secrets.length}`,
    ...secrets.map((item) => `  - ${item}`),
  ];
  let suiteOk = true;
  if (runSuite) {
    const results = [
      commandRunner("typecheck", "pnpm", ["run", "typecheck"]),
      commandRunner("test", "pnpm", ["test"]),
      commandRunner("build", "pnpm", ["run", "build"]),
      commandRunner("audit", "pnpm", ["audit"]),
    ];
    lines.push(...results.map(({ line }) => line));
    suiteOk = results.every(({ ok }) => ok);
  } else {
    lines.push("typecheck: not-run");
    lines.push("test: not-run");
    lines.push("build: not-run");
    lines.push("audit: not-run");
    lines.push("suite: pass --run-suite to execute typecheck, test, build, and audit");
  }
  return {
    text: `${lines.join("\n")}\n`,
    ok: duplicates.length === 0 && stale.length === 0 && secrets.length === 0 && suiteOk,
  };
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  const report = renderReport({ runSuite: process.argv.includes("--run-suite") });
  process.stdout.write(report.text);
  if (!report.ok) process.exit(1);
}
