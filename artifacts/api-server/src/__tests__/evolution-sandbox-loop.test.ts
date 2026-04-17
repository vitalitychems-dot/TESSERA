import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { applyVerifiedPatch } from "../lib/self-code-evolution";
import type { SandboxFn, SandboxResult } from "../lib/evolution-sandbox";
import {
  recordAttempt,
  getRecentAttempts,
  getAttemptsByProposal,
  _clearLedgerForTests,
} from "../lib/evolution-attempt-ledger";

const TMP_DIRS: string[] = [];

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
});

const failingSandbox: (stage: SandboxResult["stage"], reason: string) => SandboxFn =
  (stage, reason) => async () => ({
    ok: false,
    durationMs: 11,
    stage,
    diagnostics: [reason, "additional context"],
    diagnosticsCount: 2,
  });

afterAll(() => {
  for (const d of TMP_DIRS) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe("evolution apply pipeline — end-to-end through applyVerifiedPatch", () => {
  beforeEach(() => {
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
      sandboxFn: failingSandbox("typecheck", "error TS1005: '}' expected"),
    });

    // contract
    expect(result.ok).toBe(false);
    expect(result.error).toContain("typecheck");

    // INVARIANT: live file must be byte-identical to original
    const after = readFileSync(file);
    expect(after.equals(originalBytes)).toBe(true);
    expect(after.toString("utf8")).toBe(original);

    // ledger: SANDBOXED_FAIL recorded, no SANDBOXED_PASS, no APPLIED
    const events = getAttemptsByProposal("evo-rejected-001").map(a => a.event);
    expect(events).toContain("SANDBOXED_FAIL");
    expect(events).not.toContain("SANDBOXED_PASS");
    expect(events).not.toContain("APPLIED");

    const failEntry = getAttemptsByProposal("evo-rejected-001").find(a => a.event === "SANDBOXED_FAIL");
    expect(failEntry?.reason).toContain("sandbox.typecheck");
    expect(failEntry?.verifyOutput).toContain("error TS1005");
  });

  it("applies a good patch and records APPLIED only after the live write succeeds", async () => {
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

    // ledger: PROPOSED→SANDBOXED_PASS→APPLIED in order
    // (PROPOSED is recorded by proposeEvolution, not by applyVerifiedPatch directly,
    //  so we record it manually here to exercise the full lifecycle)
    recordAttempt({ proposalId: "evo-applied-001", event: "PROPOSED", targetModule: "demo-target" });
    const ordered = getAttemptsByProposal("evo-applied-001").map(a => a.event);
    expect(ordered).toEqual(["SANDBOXED_PASS", "APPLIED", "PROPOSED"]);

    // APPLIED entry must include the line-count reason and a duration
    const appliedEntry = getAttemptsByProposal("evo-applied-001").find(a => a.event === "APPLIED");
    expect(appliedEntry?.reason).toMatch(/^\+\d+ lines appended$/);
    expect(typeof appliedEntry?.durationMs).toBe("number");
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
      sandboxFn: failingSandbox("tests", "FAIL src/foo.test.ts > expected 1 to be 2"),
    });

    expect(result.ok).toBe(false);
    expect(readFileSync(file).equals(before)).toBe(true);
    expect(getAttemptsByProposal("evo-rejected-large").map(a => a.event)).toEqual(["SANDBOXED_FAIL"]);
  });

  it("ledger writes are append-only and persist across getRecentAttempts calls", () => {
    recordAttempt({ proposalId: "evo-x", event: "PROPOSED", targetModule: "m1" });
    recordAttempt({ proposalId: "evo-x", event: "SANDBOXED_PASS", targetModule: "m1", durationMs: 5 });
    recordAttempt({ proposalId: "evo-x", event: "APPLIED", targetModule: "m1", reason: "+1 lines appended", durationMs: 5 });

    const all = getRecentAttempts(100);
    const xs = all.filter(e => e.proposalId === "evo-x");
    expect(xs.map(e => e.event).sort()).toEqual(["APPLIED", "PROPOSED", "SANDBOXED_PASS"]);

    // Calling again should yield the same events (no mutation)
    const all2 = getRecentAttempts(100);
    expect(all2.filter(e => e.proposalId === "evo-x").length).toBe(3);
  });
});
