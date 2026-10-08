import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/privacy-e-cleanup.mjs", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const ignoredRoot = fileURLToPath(new URL("../../data", import.meta.url));
const SECRET = "aabbccddeeff0011";
const dirs: string[] = [];

function envWithoutDatabase(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  return env;
}

function runScript(args: string[]) {
  const preload = join(tmpdir(), `privacy-e-pg-guard-${process.pid}.cjs`);
  writeFileSync(
    preload,
    [
      "const Module = require('module');",
      "const load = Module._load;",
      "Module._load = function(request, parent, isMain) {",
      "  if (request === 'pg') throw new Error('pg-constructed');",
      "  return load.apply(this, arguments);",
      "};",
    ].join("\n"),
  );
  return spawnSync(process.execPath, ["--require", preload, script, ...args], {
    cwd: repoRoot,
    env: envWithoutDatabase(),
    encoding: "utf8",
  });
}

function ignoredDir(): string {
  mkdirSync(ignoredRoot, { recursive: true });
  const dir = mkdtempSync(join(ignoredRoot, "privacy-e-test-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("privacy-e cleanup script", () => {
  it("dry-run counts the verdict and does not load pg", () => {
    const dir = ignoredDir();
    const verdict = join(dir, "improvement-conference-verdict.json");
    const original = JSON.stringify({ note: "public", sigilFingerprint: SECRET });
    writeFileSync(verdict, original);
    const result = runScript(["--data-dir", dir]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dry-run");
    expect(result.stdout).toContain("counts only; no values");
    expect(result.stdout).toContain("verdictCredentialFields: 1");
    expect(result.stdout).toContain("councilSessions: skipped in dry-run");
    expect(result.stdout).not.toContain(SECRET);
    expect(`${result.stdout}${result.stderr}`).not.toContain("pg-constructed");
    expect(readFileSync(verdict, "utf8")).toBe(original);
    expect(readdirSync(dir).some((name) => name.endsWith(".bak"))).toBe(false);
  });

  it("prints a fixed message when the verdict JSON cannot be parsed", () => {
    const dir = ignoredDir();
    const verdict = join(dir, "improvement-conference-verdict.json");
    writeFileSync(verdict, "{");
    const result = runScript(["--data-dir", dir]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("verdict read failed");
    expect(result.stdout).not.toContain("SyntaxError");
    expect(result.stdout).not.toContain("Unexpected");
    expect(result.stderr).not.toContain("SyntaxError");
    expect(readFileSync(verdict, "utf8")).toBe("{");
  });

  it("refuses to write a backup on a path git does not ignore", () => {
    const dir = mkdtempSync(join(tmpdir(), "privacy-e-tracked-"));
    dirs.push(dir);
    const verdict = join(dir, "improvement-conference-verdict.json");
    const original = JSON.stringify({ sigilFingerprint: SECRET });
    writeFileSync(verdict, original);
    const result = runScript(["--apply", "--data-dir", dir]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("backup path is not gitignored");
    expect(result.stdout).not.toContain(SECRET);
    expect(readFileSync(verdict, "utf8")).toBe(original);
    expect(readdirSync(dir).some((name) => name.endsWith(".bak"))).toBe(false);
  });
});
