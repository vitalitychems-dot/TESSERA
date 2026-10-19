import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

vi.mock("../lib/llm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/llm-client")>();
  return { ...actual, isLLMAvailable: () => false };
});

vi.mock("../lib/consensus-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/consensus-engine")>();
  return { ...actual, createProposal: async () => ({ status: "approved", approvalRate: 1 }) };
});

vi.mock("../lib/evolution-throttle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/evolution-throttle")>();
  return { ...actual, shouldSkipEvolutionForLoad: () => false };
});

const ROOT = mkdtempSync(join(tmpdir(), "evo-offline-apply-"));
const LIB_DIR = join(ROOT, "lib");
const QUEUE_DIR = join(ROOT, "queue");
const LEDGER_DIR = join(ROOT, "ledger");
process.env.EVO_LEDGER_DIR = LEDGER_DIR;

import {
  proposeEvolution,
  applyEvolution,
  rollbackEvolution,
  getEvolutionMetrics,
  TRACKED_EVOLUTION_MODULES,
  _setSourceLibDirForTests,
  _setEvolutionQueueDirForTests,
  _setSandboxFnForTests,
} from "../lib/self-code-evolution";
import { OFFLINE_PATCHER_ENV } from "../lib/evolution-offline-patcher";
import { getThrottleMetrics, _resetThrottleForTests } from "../lib/evolution-throttle";
import { getAttemptsByProposal, _clearLedgerForTests } from "../lib/evolution-attempt-ledger";
import { summarizeEvolutionHealth } from "../lib/evolution-health-summary";
import type { SandboxFn } from "../lib/evolution-sandbox";

const ORIGINAL = "export const answer = 42;\n";
const MODULE_FILE = join(LIB_DIR, "dual-brain.ts");

const passingSandbox: SandboxFn = async ({ patchedContent }) => {
  const ts = require("typescript") as typeof import("typescript");
  const out = ts.transpileModule(patchedContent, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020 } });
  const bad = out.diagnostics ?? [];
  return {
    ok: bad.length === 0,
    durationMs: 1,
    stage: bad.length === 0 ? "passed" : "typecheck",
    diagnostics: bad.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    diagnosticsCount: bad.length,
    exitCode: bad.length === 0 ? 0 : 1,
  };
};

const failingSandbox: SandboxFn = async () => ({
  ok: false,
  durationMs: 1,
  stage: "tests",
  diagnostics: ["tests exit 1"],
  diagnosticsCount: 1,
  exitCode: 1,
});

// Identical approved proposals are de-duplicated module-wide, so each test needs its own text.
let seq = 0;
function uniq(text: string): string {
  return `${text} [case ${++seq}]`;
}

function metrics(id: string) {
  const m = getThrottleMetrics().modules.find(x => x.moduleId === id);
  if (!m) throw new Error(`no metrics for ${id}`);
  return m;
}

function events(proposalId: string): string[] {
  return getAttemptsByProposal(proposalId).map(e => e.event);
}

describe("offline patcher end to end (temp source tree, injected sandbox)", () => {
  beforeEach(() => {
    _resetThrottleForTests();
    _clearLedgerForTests();
    rmSync(LIB_DIR, { recursive: true, force: true });
    rmSync(QUEUE_DIR, { recursive: true, force: true });
    mkdirSync(LIB_DIR, { recursive: true });
    writeFileSync(MODULE_FILE, ORIGINAL, "utf8");
    _setSourceLibDirForTests(LIB_DIR);
    _setEvolutionQueueDirForTests(QUEUE_DIR);
    _setSandboxFnForTests(passingSandbox);
    process.env[OFFLINE_PATCHER_ENV] = "1";
  });

  afterAll(() => {
    _setSourceLibDirForTests(undefined);
    _setEvolutionQueueDirForTests(undefined);
    _setSandboxFnForTests(undefined);
    delete process.env[OFFLINE_PATCHER_ENV];
    rmSync(ROOT, { recursive: true, force: true });
  });

  it("applies a patch, verifies it, and counts it as applied rather than deferred", async () => {
    const p = await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "offline apply");
    expect(p.status).toBe("applied");
    const content = readFileSync(MODULE_FILE, "utf8");
    expect(content.startsWith(ORIGINAL)).toBe(true);
    expect(content).toContain("EVOLUTION_OFFLINE_PATCH_ERROR_RECOVERY");
    expect(events(p.id)).toEqual(["PROPOSED", "SANDBOXED_PASS", "APPLIED"]);

    const m = metrics("dual-brain.ts");
    expect(m.verifiedApplied).toBe(1);
    expect(m.totalOfflineApplied).toBe(1);
    expect(m.totalDeferred).toBe(0);
    expect(m.totalFailures).toBe(0);
    expect(m.successRate).toBe(100);
  });

  it("defers with llm-unavailable and reports no success rate when the flag is off", async () => {
    delete process.env[OFFLINE_PATCHER_ENV];
    const p = await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "flag off");
    expect(p.status).toBe("approved");
    expect(readFileSync(MODULE_FILE, "utf8")).toBe(ORIGINAL);
    const m = metrics("dual-brain.ts");
    expect(m.totalDeferred).toBe(1);
    expect(m.lastDeferredReason).toBe("llm-unavailable");
    expect(m.verifiedApplied).toBe(0);
    expect(m.successRate).toBeNull();
    expect(getEvolutionMetrics().pendingImplementationCount).toBe(1);
  });

  it("defers with offline-no-recipe and leaves the file alone", async () => {
    const p = await proposeEvolution("dual-brain", uniq("Increase episodic memory retention to 500 entries"), "no recipe");
    expect(p.status).toBe("approved");
    expect(readFileSync(MODULE_FILE, "utf8")).toBe(ORIGINAL);
    const m = metrics("dual-brain.ts");
    expect(m.totalDeferred).toBe(1);
    expect(m.lastDeferredReason).toBe("offline-no-recipe");
    expect(m.verifiedApplied).toBe(0);
    expect(m.totalFailures).toBe(0);
  });

  it("does not grow the file when the same recipe is proposed twice", async () => {
    const first = await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "first");
    expect(first.status).toBe("applied");
    const afterFirst = readFileSync(MODULE_FILE, "utf8");

    const second = await proposeEvolution("dual-brain", "Add error recovery paths", "second");
    expect(second.status).toBe("approved");
    expect(readFileSync(MODULE_FILE, "utf8")).toBe(afterFirst);
    const m = metrics("dual-brain.ts");
    expect(m.verifiedApplied).toBe(1);
    expect(m.totalDeferred).toBe(1);
    expect(m.lastDeferredReason).toBe("offline-already-applied");
  });

  it("leaves the file byte-identical and counts one failure when the sandbox fails", async () => {
    _setSandboxFnForTests(failingSandbox);
    const p = await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "sandbox fail");
    expect(p.status).toBe("rejected");
    expect(readFileSync(MODULE_FILE, "utf8")).toBe(ORIGINAL);
    expect(events(p.id)).toEqual(["PROPOSED", "SANDBOXED_FAIL"]);
    const m = metrics("dual-brain.ts");
    expect(m.totalFailures).toBe(1);
    expect(m.verifiedApplied).toBe(0);
    expect(m.totalOfflineApplied).toBe(0);
    expect(m.totalDeferred).toBe(0);
  });

  it("rolls back to the exact original and counts the rollback", async () => {
    const p = await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "rollback");
    expect(p.status).toBe("applied");
    expect(rollbackEvolution(p.id)).toBe(true);
    expect(readFileSync(MODULE_FILE, "utf8")).toBe(ORIGINAL);
    expect(metrics("dual-brain.ts").totalRolledBack).toBe(1);
    expect(existsSync(join(QUEUE_DIR, `${p.id}-backup.ts.bak`))).toBe(false);
  });

  it("applies a previously deferred proposal once the flag is turned on", async () => {
    delete process.env[OFFLINE_PATCHER_ENV];
    const p = await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "deferred first");
    expect(p.status).toBe("approved");
    expect(metrics("dual-brain.ts").totalDeferred).toBe(1);

    process.env[OFFLINE_PATCHER_ENV] = "1";
    const res = await applyEvolution(p.id);
    expect(res.ok).toBe(true);
    expect(res.applied).toBe(true);
    expect(readFileSync(MODULE_FILE, "utf8")).toContain("EVOLUTION_OFFLINE_PATCH_ERROR_RECOVERY");
    const m = metrics("dual-brain.ts");
    expect(m.verifiedApplied).toBe(1);
    expect(m.totalOfflineApplied).toBe(1);
  });

  it("counts a manual apply that fails in the sandbox as a failure", async () => {
    delete process.env[OFFLINE_PATCHER_ENV];
    const p = await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "manual fail");
    process.env[OFFLINE_PATCHER_ENV] = "1";
    _setSandboxFnForTests(failingSandbox);
    const res = await applyEvolution(p.id);
    expect(res.ok).toBe(false);
    expect(readFileSync(MODULE_FILE, "utf8")).toBe(ORIGINAL);
    expect(metrics("dual-brain.ts").totalFailures).toBe(1);
  });

  it("feeds the health summary with real applied and deferred counts", async () => {
    await proposeEvolution("dual-brain", uniq("Add try-catch with graceful degradation"), "one");
    await proposeEvolution("dual-brain", uniq("Increase episodic memory retention to 500 entries"), "two");
    const summary = summarizeEvolutionHealth(getThrottleMetrics().modules, TRACKED_EVOLUTION_MODULES);
    expect(summary.totals.verifiedApplied).toBe(1);
    expect(summary.totals.offlineApplied).toBe(1);
    expect(summary.totals.deferred).toBe(1);
    expect(summary.deferredSharePct).toBe(50);
    expect(summary.modulesWithOfflinePatch).toContain("dual-brain.ts");
    expect(summary.gate.m3cDeferredShare.pass).toBe(false);
    expect(summary.gate.meetsM3Snapshot).toBe(false);
  });
});
