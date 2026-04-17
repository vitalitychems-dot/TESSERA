import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
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

function makeTempFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "evo-sandbox-"));
  TMP_DIRS.push(dir);
  const file = join(dir, "target.ts");
  writeFileSync(file, contents, "utf8");
  return file;
}

const passingSandbox: SandboxFn = async () => ({
  ok: true,
  durationMs: 7,
  stage: "passed",
  diagnostics: [],
  diagnosticsCount: 0,
  exitCode: 0,
  output: { typecheck: "tsc passed: no diagnostics", tests: "Test Files 6 passed (6)\nTests 32 passed (32)" },
});

const failingSandbox: (stage: SandboxResult["stage"], reason: string, exitCode: number) => SandboxFn =
  (stage, reason, exitCode) => async () => ({
    ok: false,
    durationMs: 11,
    stage,
    diagnostics: [reason, "additional context"],
    diagnosticsCount: 2,
    exitCode,
    output: { typecheck: `STDERR: ${reason}\nSTDOUT: failure detail line` },
  });

beforeAll(() => {
  // Route ledger writes to a tmp dir so this test suite cannot pollute
  // (or be polluted by) the production ledger at _evolutions/attempt-ledger.jsonl
  process.env["EVO_LEDGER_DIR"] = LEDGER_TMP;
});

afterAll(() => {
  delete process.env["EVO_LEDGER_DIR"];
  for (const d of TMP_DIRS) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe("evolution apply pipeline — end-to-end through applyVerifiedPatch (with stub sandbox)", () => {
  beforeEach(() => {
    // Full reset: clears in-memory buffer AND deletes the JSONL file on disk
    _clearLedgerForTests();
  });

  it("rejects a bad patch without modifying the live file (byte-identical)", async () => {
    const original = "export const safe = 1;\n";
    const file = makeTempFile(original);
    const patched = original + "\nexport const newThing = function( {{ broken !!!\n";
    const originalBytes = readFileSync(file);

    const result = await applyVerifiedPatch({
      sourceFilePath: file,
      originalContent: original,
      patchedContent: patched,
      proposalId: "evo-rejected-001",
      targetModule: "demo-target",
      sandboxFn: failingSandbox("typecheck", "error TS1005: '}' expected", 2),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("typecheck");

    // INVARIANT: live file must be byte-identical to original
    const after = readFileSync(file);
    expect(after.equals(originalBytes)).toBe(true);
    expect(after.toString("utf8")).toBe(original);

    // ledger: SANDBOXED_FAIL recorded with full output + exit code; no PASS, no APPLIED
    const entries = getAttemptsByProposal("evo-rejected-001");
    const events = entries.map(a => a.event);
    expect(events).toEqual(["SANDBOXED_FAIL"]);

    const failEntry = entries[0]!;
    expect(failEntry.reason).toContain("sandbox.typecheck");
    expect(failEntry.verifyOutput).toContain("error TS1005");
    expect(failEntry.verifyOutput).toContain("--- typecheck ---");
    expect(failEntry.verifyExitCode).toBe(2);
  });

  it("applies a good patch and records APPLIED only after the live write succeeds, with exit code 0", async () => {
    const original = "export const a = 1;\n";
    const file = makeTempFile(original);
    const patched = original + "\nexport const b = a * 2;\n";

    const result = await applyVerifiedPatch({
      sourceFilePath: file,
      originalContent: original,
      patchedContent: patched,
      proposalId: "evo-applied-001",
      targetModule: "demo-target",
      sandboxFn: passingSandbox,
    });

    expect(result.ok).toBe(true);
    expect(result.patchedLines).toBeGreaterThan(0);

    // INVARIANT: live file content matches the patched content exactly
    expect(readFileSync(file, "utf8")).toBe(patched);

    // ledger: SANDBOXED_PASS then APPLIED, in order
    const entries = getAttemptsByProposal("evo-applied-001");
    expect(entries.map(a => a.event)).toEqual(["SANDBOXED_PASS", "APPLIED"]);

    const passEntry = entries[0]!;
    expect(passEntry.verifyExitCode).toBe(0);
    expect(passEntry.verifyOutput).toContain("tsc passed");

    const appliedEntry = entries[1]!;
    expect(appliedEntry.reason).toMatch(/^\+\d+ lines appended$/);
    expect(typeof appliedEntry.durationMs).toBe("number");
  });

  it("on sandbox failure, the live file remains untouched even when patched content is large", async () => {
    const original = Array.from({ length: 200 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
    const file = makeTempFile(original);
    const huge = original + "\n" + Array.from({ length: 50 }, (_, i) => `export const x${i} = ${i};`).join("\n") + "\n";
    const before = readFileSync(file);

    const result = await applyVerifiedPatch({
      sourceFilePath: file,
      originalContent: original,
      patchedContent: huge,
      proposalId: "evo-rejected-large",
      targetModule: "demo-large",
      sandboxFn: failingSandbox("tests", "FAIL src/foo.test.ts > expected 1 to be 2", 1),
    });

    expect(result.ok).toBe(false);
    expect(readFileSync(file).equals(before)).toBe(true);

    const entries = getAttemptsByProposal("evo-rejected-large");
    expect(entries.map(a => a.event)).toEqual(["SANDBOXED_FAIL"]);
    expect(entries[0]!.verifyExitCode).toBe(1);
  });

  it("ledger is append-only and persists across getRecentAttempts calls", () => {
    recordAttempt({ proposalId: "evo-x", event: "PROPOSED", targetModule: "m1" });
    recordAttempt({ proposalId: "evo-x", event: "SANDBOXED_PASS", targetModule: "m1", durationMs: 5, verifyExitCode: 0 });
    recordAttempt({ proposalId: "evo-x", event: "APPLIED", targetModule: "m1", reason: "+1 lines appended", durationMs: 5 });

    const xs1 = getRecentAttempts(100).filter(e => e.proposalId === "evo-x");
    expect(xs1.map(e => e.event).sort()).toEqual(["APPLIED", "PROPOSED", "SANDBOXED_PASS"]);

    const xs2 = getRecentAttempts(100).filter(e => e.proposalId === "evo-x");
    expect(xs2.length).toBe(3);
  });
});

describe("evolution sandbox runner — TRUE end-to-end through verifyPatchInSandbox", () => {
  it("invokes the real git-worktree + pnpm pipeline and returns a structured SandboxResult", async () => {
    // Pick a small real source file inside the api-server package as the patch target.
    // We intentionally do NOT modify it — verifyPatchInSandbox writes ONLY inside the
    // disposable worktree; the live file on disk must remain untouched.
    const targetRel = "artifacts/api-server/src/lib/evolution-attempt-ledger.ts";
    const monorepoRoot = resolve(process.cwd(), "..", "..");
    const targetAbs = resolve(monorepoRoot, targetRel);

    // Sanity: target exists and we can read it
    expect(existsSync(targetAbs)).toBe(true);
    const liveBefore = readFileSync(targetAbs);

    // A patch that is GUARANTEED to fail typecheck quickly: prepend invalid TS at the top.
    const liveContent = liveBefore.toString("utf8");
    const brokenPatch = `// E2E sandbox test — intentionally broken syntax\nexport const __evo_e2e_broken: number = "definitely-not-a-number";\nconst { = 42;\n${liveContent}`;

    const result = await verifyPatchInSandbox({
      targetFilePath: targetAbs,
      patchedContent: brokenPatch,
      packageFilter: "@workspace/api-server",
      runTests: false, // typecheck alone is enough to prove the pipeline runs end-to-end
    });

    // Structured result shape
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("stage");
    expect(result).toHaveProperty("diagnostics");
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThan(0);
    expect(["init", "worktree", "patch-write", "typecheck", "tests", "passed"]).toContain(result.stage);

    // The pipeline must have actually run far enough to attempt typecheck (or fail earlier
    // with a structured stage). It must NOT have crashed unstructured.
    if (result.stage === "init" || result.stage === "worktree") {
      // Acceptable in environments without git; surface a clear diagnostic.
      expect(result.diagnostics.length).toBeGreaterThan(0);
    } else {
      // Got past worktree → typecheck stage was reached → we should have captured stdout/stderr
      expect(result.output).toBeDefined();
      expect(result.output?.typecheck).toBeDefined();
      // Broken patch → failure expected; exit code should be non-zero
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBeDefined();
      expect(result.exitCode).not.toBe(0);
    }

    // INVARIANT: the LIVE file is byte-identical — verifyPatchInSandbox wrote ONLY
    // inside the disposable worktree, never touching the real source on disk.
    const liveAfter = readFileSync(targetAbs);
    expect(liveAfter.equals(liveBefore)).toBe(true);
  }, 180_000); // generous timeout: real pnpm typecheck of api-server can take ~60s
});
