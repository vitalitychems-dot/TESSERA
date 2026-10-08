import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
    const preview = "synthetic-surface-preview";
    const original = JSON.stringify({
      note: "public",
      sigilFingerprint: SECRET,
      SurfacePreview: preview,
    });
    writeFileSync(verdict, original);
    const result = runScript(["--data-dir", dir]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dry-run");
    expect(result.stdout).toContain("counts only; no values");
    expect(result.stdout).toContain("verdictCredentialFields: 2");
    expect(result.stdout).not.toContain(preview);
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

  it("refuses an unignored in-repo data directory", () => {
    const dir = mkdtempSync(join(repoRoot, "privacy-e-unignored-"));
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

  it("rolls the council pass back when a write fails", () => {
    const dir = ignoredDir();
    const probe = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", councilProbeSource()],
      {
        cwd: repoRoot,
        env: { ...envWithoutDatabase(), CLEANUP_PROBE_DIR: dir, CLEANUP_PROBE_MODE: "rollback" },
        encoding: "utf8",
      },
    );
    expect(probe.status).toBe(0);
    const report = JSON.parse(probe.stdout) as { message: string; queries: string[]; leaked: boolean };
    expect(report.message).toBe("database pass failed");
    expect(report.leaked).toBe(false);
    expect(report.queries).toContain("BEGIN");
    expect(report.queries).toContain("ROLLBACK");
    expect(report.queries).not.toContain("COMMIT");
    expect(probe.stdout).not.toContain("synthetic-inner");
  });

  it("never overwrites an existing backup", () => {
    const dir = ignoredDir();
    const probe = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", councilProbeSource()],
      {
        cwd: repoRoot,
        env: { ...envWithoutDatabase(), CLEANUP_PROBE_DIR: dir, CLEANUP_PROBE_MODE: "backup" },
        encoding: "utf8",
      },
    );
    expect(probe.status).toBe(0);
    const report = JSON.parse(probe.stdout) as { distinct: boolean; kept: boolean };
    expect(report.distinct).toBe(true);
    expect(report.kept).toBe(true);
  });
});

function councilProbeSource(): string {
  const href = JSON.stringify(fileURLToPathHref(script));
  return `
    const mod = await import(${href});
    const dir = process.env.CLEANUP_PROBE_DIR;
    if (process.env.CLEANUP_PROBE_MODE === "backup") {
      const { writeFileSync, readFileSync } = await import("node:fs");
      const first = mod.nextBackupPath(dir, "council-sessions.privacy-e");
      writeFileSync(first, "synthetic-marker");
      const second = mod.nextBackupPath(dir, "council-sessions.privacy-e");
      process.stdout.write(JSON.stringify({
        distinct: first !== second,
        kept: readFileSync(first, "utf8") === "synthetic-marker",
      }));
    } else {
      const queries = [];
      const client = {
        query: async (sql) => {
          const verb = String(sql).split(/\\s+/)[0];
          queries.push(verb);
          if (verb === "SELECT") {
            return { rows: [{ id: "synthetic-row", session: { sigilFingerprint: "synthetic-field" } }] };
          }
          if (verb === "UPDATE") throw new Error("synthetic-inner");
          return { rows: [] };
        },
      };
      try {
        await mod.applyCouncilPass(client, dir);
        process.stdout.write(JSON.stringify({ message: "committed", queries, leaked: false }));
        process.exit(1);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        process.stdout.write(JSON.stringify({
          message,
          queries,
          leaked: message.includes("synthetic-inner"),
        }));
        process.exit(message === "database pass failed" ? 0 : 1);
      }
    }
  `;
}

function fileURLToPathHref(filePath: string): string {
  return pathToFileURL(filePath).href;
}
