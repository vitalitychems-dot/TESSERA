import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { verifyPatchInSandbox } from "../lib/evolution-sandbox";
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

afterAll(() => {
  for (const d of TMP_DIRS) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

describe("evolution sandbox + attempt ledger loop", () => {
  beforeEach(() => {
    _clearLedgerForTests();
  });

  it("rejects a syntactically broken patch and never writes the live file", async () => {
    const original = "export const greeting = 'hello';\n";
    const file = makeTempFile(original);
    const broken = original + "\nexport const x = function( {{ broken syntax !!!\n";

    const result = await verifyPatchInSandbox({
      targetFilePath: file,
      originalContent: original,
      patchedContent: broken,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnosticsCount).toBeGreaterThan(0);
    // Live file MUST be untouched — sandbox is read-only.
    expect(readFileSync(file, "utf8")).toBe(original);
  });

  it("rejects a patch with forbidden security patterns", async () => {
    const original = "export const a = 1;\n";
    const file = makeTempFile(original);
    const patched = original + "\nexport function go(){ eval('1+1'); }\n";

    const result = await verifyPatchInSandbox({
      targetFilePath: file,
      originalContent: original,
      patchedContent: patched,
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("security-scan");
    expect(readFileSync(file, "utf8")).toBe(original);
  });

  it("rejects a duplicate-only patch (no new content)", async () => {
    const original = "export const greeting = 'hello world';\nexport const farewell = 'bye world';\n";
    const file = makeTempFile(original);
    const patched = original + "\nexport const greeting = 'hello world';\nexport const farewell = 'bye world';\n";

    const result = await verifyPatchInSandbox({
      targetFilePath: file,
      originalContent: original,
      patchedContent: patched,
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("duplicate-check");
    expect(readFileSync(file, "utf8")).toBe(original);
  });

  it("accepts a clean append-only patch", async () => {
    const original = "export const a = 1;\n";
    const file = makeTempFile(original);
    const patched = original + "\nexport const computedSquare = a * a;\n";

    const result = await verifyPatchInSandbox({
      targetFilePath: file,
      originalContent: original,
      patchedContent: patched,
    });

    expect(result.ok).toBe(true);
    expect(result.stage).toBe("passed");
    expect(result.diagnosticsCount).toBe(0);
  });

  it("ledger records PROPOSED → SANDBOXED_FAIL and surfaces in getRecentAttempts", () => {
    recordAttempt({ proposalId: "evo-test-A", event: "PROPOSED", targetModule: "demo" });
    recordAttempt({
      proposalId: "evo-test-A",
      event: "SANDBOXED_FAIL",
      targetModule: "demo",
      reason: "test failure",
      verifyOutput: "diag-1",
      durationMs: 12,
    });

    const recent = getRecentAttempts(10);
    const events = recent.filter(a => a.proposalId === "evo-test-A").map(a => a.event);
    expect(events).toContain("PROPOSED");
    expect(events).toContain("SANDBOXED_FAIL");

    const byProposal = getAttemptsByProposal("evo-test-A");
    expect(byProposal.length).toBe(2);
  });

  it("ledger records full happy path PROPOSED → SANDBOXED_PASS → APPLIED in order", () => {
    recordAttempt({ proposalId: "evo-test-B", event: "PROPOSED", targetModule: "demo2" });
    recordAttempt({ proposalId: "evo-test-B", event: "SANDBOXED_PASS", targetModule: "demo2", durationMs: 5 });
    recordAttempt({ proposalId: "evo-test-B", event: "APPLIED", targetModule: "demo2", reason: "+1 lines appended", durationMs: 5 });

    const ordered = getAttemptsByProposal("evo-test-B").map(a => a.event);
    expect(ordered).toEqual(["PROPOSED", "SANDBOXED_PASS", "APPLIED"]);
  });
});
