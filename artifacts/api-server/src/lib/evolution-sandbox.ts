import { spawn } from "child_process";
import { mkdtempSync, writeFileSync, existsSync, rmSync, mkdirSync, symlinkSync } from "fs";
import { join, resolve, relative, dirname } from "path";
import { logger } from "./logger";

const TIMEOUT_TYPECHECK_MS = 90_000;
const TIMEOUT_TESTS_MS = 120_000;
const TIMEOUT_WORKTREE_MS = 30_000;
const TIMEOUT_CLEANUP_MS = 15_000;

const MAX_OUTPUT_BYTES = 200_000;
const MAX_DIAGNOSTIC_LINES = 12;

export interface SandboxResult {
  ok: boolean;
  durationMs: number;
  stage: "init" | "worktree" | "patch-write" | "typecheck" | "tests" | "passed";
  diagnostics: string[];
  diagnosticsCount: number;
  exitCode?: number;
  output?: { typecheck?: string; tests?: string };
}

interface CmdResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

function runCmd(cwd: string, cmd: string, args: string[], timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<CmdResult> {
  return new Promise(resolveP => {
    const start = Date.now();
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill("SIGKILL"); } catch { /* ignore */ }
    }, timeoutMs);
    proc.stdout?.on("data", d => {
      stdout += d.toString();
      if (stdout.length > MAX_OUTPUT_BYTES) stdout = stdout.slice(-MAX_OUTPUT_BYTES);
    });
    proc.stderr?.on("data", d => {
      stderr += d.toString();
      if (stderr.length > MAX_OUTPUT_BYTES) stderr = stderr.slice(-MAX_OUTPUT_BYTES);
    });
    proc.on("close", code => {
      clearTimeout(timer);
      resolveP({ exitCode: code ?? -1, stdout, stderr, timedOut, durationMs: Date.now() - start });
    });
    proc.on("error", err => {
      clearTimeout(timer);
      resolveP({
        exitCode: -1,
        stdout,
        stderr: stderr + "\n" + (err instanceof Error ? err.message : String(err)),
        timedOut: false,
        durationMs: Date.now() - start,
      });
    });
  });
}

function findMonorepoRoot(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function ensureSymlink(srcAbs: string, dstAbs: string): void {
  if (!existsSync(srcAbs)) return;
  if (existsSync(dstAbs)) return;
  mkdirSync(dirname(dstAbs), { recursive: true });
  try {
    symlinkSync(srcAbs, dstAbs, "dir");
  } catch (err) {
    logger.warn({ srcAbs, dstAbs, err }, "EvolutionSandbox: symlink failed (continuing)");
  }
}

/**
 * Verify a proposed patch by:
 *   1. creating a real `git worktree` of HEAD in a temp directory,
 *   2. symlinking node_modules so installed deps resolve,
 *   3. writing the patched file at the same relative path,
 *   4. running `pnpm --filter <pkg> typecheck` and `pnpm --filter <pkg> test`
 *      with hard timeouts, capturing stdout / stderr / exit code,
 *   5. always cleaning up the worktree.
 *
 * The live source file is NEVER touched by this function.
 *
 * Recursion guard: when the spawned child process runs the test suite, it
 * inherits EVO_SANDBOX_NESTED=1 in its env, so any nested call to this
 * function inside the sandbox returns a fast no-op pass — preventing fork
 * bombs and infinite recursion.
 */
export async function verifyPatchInSandbox(params: {
  targetFilePath: string;
  patchedContent: string;
  packageFilter?: string;
  runTests?: boolean;
  /**
   * Optional custom verification commands to run inside the worktree
   * INSTEAD OF the default `pnpm --filter <pkg> typecheck` + `... test`.
   * Used by integration tests (and by callers that need a lighter-weight
   * verifier than the full pnpm pipeline) to exercise the real
   * worktree+subprocess pipeline without depending on the api-server's
   * heavy typecheck script. Each command runs sequentially; the first
   * non-zero exit short-circuits and is reported as a failure.
   */
  verifyCommand?: Array<{ cmd: string; args: string[]; timeoutMs?: number; stageLabel?: SandboxResult["stage"] }>;
}): Promise<SandboxResult> {
  const start = Date.now();

  if (process.env["EVO_SANDBOX_NESTED"] === "1") {
    return {
      ok: true,
      durationMs: 0,
      stage: "passed",
      diagnostics: ["nested sandbox call — fast-passed to prevent recursion"],
      diagnosticsCount: 0,
    };
  }

  const pkgFilter = params.packageFilter ?? "@workspace/api-server";
  const runTests = params.runTests !== false;

  const monorepoRoot = findMonorepoRoot(process.cwd());
  if (!monorepoRoot) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      stage: "init",
      diagnostics: ["sandbox: cannot locate monorepo root (no pnpm-workspace.yaml found above cwd)"],
      diagnosticsCount: 1,
    };
  }

  const sandboxParent = join(monorepoRoot, "_evolutions", "sandboxes");
  if (!existsSync(sandboxParent)) mkdirSync(sandboxParent, { recursive: true });
  const sandboxDir = mkdtempSync(join(sandboxParent, "sb-"));

  let stage: SandboxResult["stage"] = "worktree";

  try {
    // 1. git worktree add
    const wt = await runCmd(monorepoRoot, "git", ["worktree", "add", "--detach", sandboxDir, "HEAD"], TIMEOUT_WORKTREE_MS);
    if (wt.exitCode !== 0 || wt.timedOut) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        stage: "worktree",
        diagnostics: [
          wt.timedOut ? "git worktree add timed out" : `git worktree add failed (exit ${wt.exitCode})`,
          (wt.stderr || wt.stdout).slice(-500),
        ],
        diagnosticsCount: 1,
        exitCode: wt.exitCode,
        output: { typecheck: (wt.stderr + "\n" + wt.stdout).slice(-2000) },
      };
    }

    // 2. Symlink node_modules so resolution works without re-installing
    const symlinks = [
      "node_modules",
      "artifacts/api-server/node_modules",
      "lib/db/node_modules",
      "lib/api-zod/node_modules",
    ];
    for (const rel of symlinks) {
      ensureSymlink(join(monorepoRoot, rel), join(sandboxDir, rel));
    }

    // 3. Write patched file at same relative path
    stage = "patch-write";
    const absTarget = resolve(params.targetFilePath);
    const relTarget = relative(monorepoRoot, absTarget);
    if (relTarget.startsWith("..") || relTarget.includes("..")) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        stage: "patch-write",
        diagnostics: [`patch-write: target outside monorepo (${absTarget})`],
        diagnosticsCount: 1,
      };
    }
    const sandboxTarget = join(sandboxDir, relTarget);
    mkdirSync(dirname(sandboxTarget), { recursive: true });
    writeFileSync(sandboxTarget, params.patchedContent, "utf8");

    // 4a. Custom verify commands (used by integration tests and lightweight verifiers)
    if (params.verifyCommand && params.verifyCommand.length > 0) {
      const collectedOutput: string[] = [];
      for (const step of params.verifyCommand) {
        stage = step.stageLabel ?? "typecheck";
        const r = await runCmd(
          sandboxDir,
          step.cmd,
          step.args,
          step.timeoutMs ?? TIMEOUT_TYPECHECK_MS,
          { EVO_SANDBOX_NESTED: "1" },
        );
        const out = (r.stderr + "\n" + r.stdout).slice(-2000);
        collectedOutput.push(`$ ${step.cmd} ${step.args.join(" ")}\nexit=${r.exitCode}\n${out}`);
        if (r.timedOut || r.exitCode !== 0) {
          return {
            ok: false,
            durationMs: Date.now() - start,
            stage,
            diagnostics: [
              r.timedOut ? `${step.cmd} timed out` : `${step.cmd} exit ${r.exitCode}`,
              ...out.split("\n").slice(0, MAX_DIAGNOSTIC_LINES),
            ],
            diagnosticsCount: 1,
            exitCode: r.exitCode,
            output: { typecheck: collectedOutput.join("\n---\n") },
          };
        }
      }
      return {
        ok: true,
        durationMs: Date.now() - start,
        stage: "passed",
        diagnostics: [],
        diagnosticsCount: 0,
        exitCode: 0,
        output: { typecheck: collectedOutput.join("\n---\n") },
      };
    }

    // 4. Typecheck
    stage = "typecheck";
    const tc = await runCmd(
      sandboxDir,
      "pnpm",
      ["--filter", pkgFilter, "typecheck"],
      TIMEOUT_TYPECHECK_MS,
      { EVO_SANDBOX_NESTED: "1" },
    );
    const tcOutput = (tc.stderr + "\n" + tc.stdout).slice(-4000);
    if (tc.timedOut || tc.exitCode !== 0) {
      const errorLines = tcOutput
        .split("\n")
        .filter(l => /error TS\d+/.test(l) || /ELIFECYCLE/.test(l))
        .slice(0, MAX_DIAGNOSTIC_LINES);
      return {
        ok: false,
        durationMs: Date.now() - start,
        stage: "typecheck",
        diagnostics: [
          tc.timedOut ? `typecheck timed out after ${TIMEOUT_TYPECHECK_MS}ms` : `typecheck exit ${tc.exitCode}`,
          ...errorLines,
        ],
        diagnosticsCount: errorLines.length || 1,
        exitCode: tc.exitCode,
        output: { typecheck: tcOutput },
      };
    }

    // 5. Tests
    let ttOutput = "";
    if (runTests) {
      stage = "tests";
      const tt = await runCmd(
        sandboxDir,
        "pnpm",
        ["--filter", pkgFilter, "test"],
        TIMEOUT_TESTS_MS,
        { EVO_SANDBOX_NESTED: "1" },
      );
      ttOutput = (tt.stderr + "\n" + tt.stdout).slice(-4000);
      if (tt.timedOut || tt.exitCode !== 0) {
        const failLines = ttOutput
          .split("\n")
          .filter(l => /FAIL|×|✗|Error:|AssertionError|Expected|Tests\s+\d+\s+failed/.test(l))
          .slice(0, MAX_DIAGNOSTIC_LINES);
        return {
          ok: false,
          durationMs: Date.now() - start,
          stage: "tests",
          diagnostics: [
            tt.timedOut ? `tests timed out after ${TIMEOUT_TESTS_MS}ms` : `tests exit ${tt.exitCode}`,
            ...failLines,
          ],
          diagnosticsCount: failLines.length || 1,
          exitCode: tt.exitCode,
          output: { typecheck: tcOutput, tests: ttOutput },
        };
      }
    }

    return {
      ok: true,
      durationMs: Date.now() - start,
      stage: "passed",
      diagnostics: [],
      diagnosticsCount: 0,
      exitCode: 0,
      output: { typecheck: tcOutput, tests: ttOutput || undefined },
    };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      stage,
      diagnostics: [`sandbox unexpected error at stage=${stage}: ${err instanceof Error ? err.message : String(err)}`],
      diagnosticsCount: 1,
    };
  } finally {
    // Always cleanup, even on throw
    try {
      await runCmd(monorepoRoot, "git", ["worktree", "remove", "--force", sandboxDir], TIMEOUT_CLEANUP_MS);
    } catch { /* ignore */ }
    try {
      if (existsSync(sandboxDir)) rmSync(sandboxDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

export type SandboxFn = (params: {
  targetFilePath: string;
  patchedContent: string;
}) => Promise<SandboxResult>;
