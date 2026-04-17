import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join, resolve, relative } from "path";
import { applyVerifiedPatch } from "../lib/self-code-evolution";
import { verifyPatchInSandbox } from "../lib/evolution-sandbox";
import type { SandboxFn, SandboxResult } from "../lib/evolution-sandbox";
import {
  recordAttempt,
  getRecentAttempts,
  getAttemptsByProposal,
  _clearLedgerForTests,
} from "../lib/evolution-attempt-ledger";

const TMP_DIRS: string[] = [];
const LEDGER_TMP = mkdtempSync(join(tmpdir(), "evo-ledger-"));
TMP_DIRS.push(LEDGER_TMP);

const MONOREPO_ROOT = (() => {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("monorepo root not found");
})();

const FIXTURE_REL = "artifacts/api-server/src/__fixtures__/sandbox-target.js";
const FIXTURE_ABS = join(MONOREPO_ROOT, FIXTURE_REL);
const FIXTURE_ORIGINAL = "// Fixture target for evolution-sandbox-loop integration tests.\n// Patches against this file are syntax-checked via `node --check` inside the\n// disposable git worktree (instead of the heavy api-server pnpm typecheck).\nmodule.exports.a = 1;\n";

function makeTempFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "evo-sandbox-"));
  TMP_DIRS.push(dir);
  const file = join(dir, "target.ts");
  writeFileSync(file, contents, "utf8");
  return file;
}

const passingStubSandbox: SandboxFn = async () => ({
  ok: true,
  durationMs: 7,
  stage: "passed",
  diagnostics: [],
  diagnosticsCount: 0,
  exitCode: 0,
  output: { typecheck: "stub: passed", tests: "stub: 1 passed" },
});

const failingStubSandbox: (stage: SandboxResult["stage"], reason: string, exitCode: number) => SandboxFn =
  (stage, reason, exitCode) => async () => ({
    ok: false,
    durationMs: 11,
    stage,
    diagnostics: [reason, "additional context"],
    diagnosticsCount: 2,
    exitCode,
    output: { typecheck: `STDERR: ${reason}\nSTDOUT: failure detail` },
  });

/**
 * Real-runner sandbox factory: invokes verifyPatchInSandbox with the actual
 * git-worktree + subprocess pipeline, but uses `node --check` on the patched
 * fixture file as the verification command (lightweight equivalent of
 * typecheck — passes for valid JS, fails with non-zero exit on syntax errors).
 */
function realRunnerSandbox(relTargetInsideMonorepo: string): SandboxFn {
  return async (params) =>
    verifyPatchInSandbox({
      targetFilePath: params.targetFilePath,
      patchedContent: params.patchedContent,
      packageFilter: "@workspace/api-server",
      runTests: false,
      verifyCommand: [
        { cmd: "node", args: ["--check", relTargetInsideMonorepo], stageLabel: "typecheck" },
      ],
    });
}

beforeAll(() => {
  process.env["EVO_LEDGER_DIR"] = LEDGER_TMP;
  // Ensure the fixture exists in HEAD so `git worktree add HEAD` includes it.
  // If it's untracked (first run), commit it locally so the worktree sees it.
  try {
    execSync(`git ls-files --error-unmatch ${FIXTURE_REL}`, { cwd: MONOREPO_ROOT, stdio: "pipe" });
  } catch {
    try {
      execSync(`git add ${FIXTURE_REL}`, { cwd: MONOREPO_ROOT, stdio: "pipe" });
      execSync(`git -c user.email=evo@test -c user.name=evo commit -m "test: add sandbox fixture" --no-verify`, {
        cwd: MONOREPO_ROOT, stdio: "pipe",
      });
    } catch { /* ignore — worktree test will report structured init failure if needed */ }
  }
});

afterAll(() => {
  delete process.env["EVO_LEDGER_DIR"];
  for (const d of TMP_DIRS) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe("evolution apply pipeline — stub-sandbox unit coverage of applyVerifiedPatch", () => {
  beforeEach(() => { _clearLedgerForTests(); });

  it("rejects a bad patch without modifying the live file (byte-identical)", async () => {
    const original = "export const safe = 1;\n";
    const file = makeTempFile(original);
    const patched = original + "\nexport const newThing = function( {{ broken !!!\n";
    const originalBytes = readFileSync(file);

    const result = await applyVerifiedPatch({
      sourceFilePath: file,
      originalContent: original,
      patchedContent: patched,
      proposalId: "evo-stub-bad",
      targetModule: "demo-target",
      sandboxFn: failingStubSandbox("typecheck", "error TS1005: '}' expected", 2),
    });

    expect(result.ok).toBe(false);
    const after = readFileSync(file);
    expect(after.equals(originalBytes)).toBe(true);

    const entries = getAttemptsByProposal("evo-stub-bad");
    expect(entries.map(a => a.event)).toEqual(["SANDBOXED_FAIL"]);
    expect(entries[0]!.verifyExitCode).toBe(2);
    expect(entries[0]!.verifyOutput).toContain("error TS1005");
  });

  it("applies a good patch and records APPLIED only after live write", async () => {
    const original = "export const a = 1;\n";
    const file = makeTempFile(original);
    const patched = original + "\nexport const b = 2;\n";

    const result = await applyVerifiedPatch({
      sourceFilePath: file,
      originalContent: original,
      patchedContent: patched,
      proposalId: "evo-stub-good",
      targetModule: "demo-target",
      sandboxFn: passingStubSandbox,
    });

    expect(result.ok).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(patched);

    const entries = getAttemptsByProposal("evo-stub-good");
    expect(entries.map(a => a.event)).toEqual(["SANDBOXED_PASS", "APPLIED"]);
    expect(entries[0]!.verifyExitCode).toBe(0);
    expect(entries[1]!.reason).toMatch(/^\+\d+ lines appended$/);
  });

  it("ledger is append-only across getRecentAttempts calls", () => {
    recordAttempt({ proposalId: "evo-x", event: "PROPOSED", targetModule: "m1" });
    recordAttempt({ proposalId: "evo-x", event: "SANDBOXED_PASS", targetModule: "m1", durationMs: 5, verifyExitCode: 0 });
    recordAttempt({ proposalId: "evo-x", event: "APPLIED", targetModule: "m1", reason: "+1 lines appended" });
    expect(getRecentAttempts(100).filter(e => e.proposalId === "evo-x").length).toBe(3);
    expect(getRecentAttempts(100).filter(e => e.proposalId === "evo-x").length).toBe(3);
  });
});

describe("evolution sandbox runner — TRUE end-to-end through verifyPatchInSandbox + applyVerifiedPatch", () => {
  beforeEach(() => { _clearLedgerForTests(); });

  it("BAD patch: real worktree + real `node --check` rejects, live file byte-identical, ledger SANDBOXED_FAIL with non-zero exit", async () => {
    expect(existsSync(FIXTURE_ABS)).toBe(true);
    const liveBefore = readFileSync(FIXTURE_ABS);
    const original = liveBefore.toString("utf8");
    const broken = original + "\nmodule.exports.broken = (((;\n"; // syntax error → node --check exits non-zero

    const result = await applyVerifiedPatch({
      sourceFilePath: FIXTURE_ABS,
      originalContent: original,
      patchedContent: broken,
      proposalId: "evo-real-bad",
      targetModule: "sandbox-target.js",
      sandboxFn: realRunnerSandbox(FIXTURE_REL),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();

    // INVARIANT: live file is byte-identical
    const liveAfter = readFileSync(FIXTURE_ABS);
    expect(liveAfter.equals(liveBefore)).toBe(true);

    const entries = getAttemptsByProposal("evo-real-bad");
    expect(entries.map(a => a.event)).toEqual(["SANDBOXED_FAIL"]);
    const fail = entries[0]!;
    expect(fail.verifyExitCode).toBeDefined();
    expect(fail.verifyExitCode).not.toBe(0);
    expect(fail.verifyOutput).toBeDefined();
    expect(fail.verifyOutput!.length).toBeGreaterThan(0);
    expect(fail.reason).toContain("sandbox.typecheck");
  }, 90_000);

  it("GOOD patch: real worktree + real `node --check` passes, live file updated, ledger SANDBOXED_PASS → APPLIED in order with exit 0", async () => {
    expect(existsSync(FIXTURE_ABS)).toBe(true);
    const liveBefore = readFileSync(FIXTURE_ABS, "utf8");
    // Always patch back to a deterministic baseline + a benign valid addition
    const original = FIXTURE_ORIGINAL;
    const patched = original + "module.exports.b = 2;\n";

    // Restore baseline before running (in case a prior test left state)
    writeFileSync(FIXTURE_ABS, original, "utf8");

    try {
      const result = await applyVerifiedPatch({
        sourceFilePath: FIXTURE_ABS,
        originalContent: original,
        patchedContent: patched,
        proposalId: "evo-real-good",
        targetModule: "sandbox-target.js",
        sandboxFn: realRunnerSandbox(FIXTURE_REL),
      });

      expect(result.ok).toBe(true);
      expect(result.patchedLines).toBeGreaterThan(0);

      // INVARIANT: live file equals patched content exactly
      expect(readFileSync(FIXTURE_ABS, "utf8")).toBe(patched);

      const entries = getAttemptsByProposal("evo-real-good");
      expect(entries.map(a => a.event)).toEqual(["SANDBOXED_PASS", "APPLIED"]);

      const pass = entries[0]!;
      expect(pass.verifyExitCode).toBe(0);
      expect(pass.verifyOutput).toBeDefined();
      expect(pass.verifyOutput).toContain("node --check");
      expect(pass.verifyOutput).toContain("exit=0");

      const applied = entries[1]!;
      expect(applied.reason).toMatch(/^\+\d+ lines appended$/);
      expect(typeof applied.durationMs).toBe("number");
    } finally {
      // Always restore the fixture to its committed state so other tests/builds aren't affected
      writeFileSync(FIXTURE_ABS, liveBefore, "utf8");
    }
  }, 90_000);
});

// Suppress unused-import warning for `relative` (kept for future use)
void relative;
