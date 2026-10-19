import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const llmState = { available: false };

vi.mock("../lib/llm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/llm-client")>();
  return { ...actual, isLLMAvailable: () => llmState.available };
});

vi.mock("../lib/consensus-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/consensus-engine")>();
  return {
    ...actual,
    createProposal: async () => ({ status: "approved", approvalRate: 1 }),
  };
});

vi.mock("../lib/evolution-throttle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/evolution-throttle")>();
  return { ...actual, shouldSkipEvolutionForLoad: () => false };
});

const LEDGER_DIR = mkdtempSync(join(tmpdir(), "evo-health-ledger-"));
process.env.EVO_LEDGER_DIR = LEDGER_DIR;

import {
  proposeEvolution,
  TRACKED_EVOLUTION_MODULES,
  _setSourceLibDirForTests,
} from "../lib/self-code-evolution";
import { ANALYZABLE_MODULES } from "../lib/recursive-self-improvement";
import { normalizeEvolutionModule } from "../lib/evolution-modules";
import {
  getThrottleMetrics,
  isModuleCoolingDown,
  _resetThrottleForTests,
} from "../lib/evolution-throttle";

const LIB_DIR = resolve(__dirname, "..", "lib");

function metricsFor(moduleId: string) {
  return getThrottleMetrics().modules.find((m) => m.moduleId === moduleId);
}

describe("evolution module identity", () => {
  it("every analyzable module resolves to a real source file", () => {
    const missing = ANALYZABLE_MODULES
      .filter((m) => !existsSync(join(LIB_DIR, normalizeEvolutionModule(m.file))))
      .map((m) => m.file);
    expect(missing).toEqual([]);
  });

  it("every analyzable module id normalizes to its own file", () => {
    for (const m of ANALYZABLE_MODULES) {
      expect(normalizeEvolutionModule(m.id)).toBe(normalizeEvolutionModule(m.file));
    }
  });

  it("every tracked evolution module resolves to a real source file", () => {
    const missing = TRACKED_EVOLUTION_MODULES.filter(
      (m) => !existsSync(join(LIB_DIR, normalizeEvolutionModule(m))),
    );
    expect(missing).toEqual([]);
  });

  it("covers all engines reported as failing", () => {
    const ids = new Set(ANALYZABLE_MODULES.map((m) => normalizeEvolutionModule(m.id)));
    for (const name of [
      "consciousness-engine", "dual-brain", "auto-improvement-daemon", "agi-training-engine",
      "collective-intelligence", "personality-evolution", "vector-memory", "agent-spawner",
      "consensus-engine", "truthfulness-engine", "sovereign-ephemeris", "sovereign-sacred-geometry",
    ]) {
      expect(ids.has(`${name}.ts`)).toBe(true);
    }
  });

  it("normalizes names, aliases and leaves paths alone", () => {
    expect(normalizeEvolutionModule("dual-brain")).toBe("dual-brain.ts");
    expect(normalizeEvolutionModule("dual-brain.ts")).toBe("dual-brain.ts");
    expect(normalizeEvolutionModule("sacred-geometry")).toBe("sovereign-sacred-geometry.ts");
    expect(normalizeEvolutionModule("../etc/passwd")).toBe("../etc/passwd");
  });
});

describe("evolution health when the environment cannot apply patches", () => {
  beforeEach(() => {
    _resetThrottleForTests();
    _setSourceLibDirForTests(LIB_DIR);
    llmState.available = false;
  });

  afterAll(() => {
    _setSourceLibDirForTests(undefined);
    rmSync(LEDGER_DIR, { recursive: true, force: true });
  });

  it("keeps a module healthy across many approved proposals with no LLM", async () => {
    for (let i = 0; i < 8; i++) {
      const proposal = await proposeEvolution(
        "consensus-engine",
        `Add try-catch with graceful degradation (variant ${i})`,
        "health regression",
      );
      expect(proposal.status).toBe("approved");
      expect(proposal.impact).toMatch(/awaiting implementation/);
    }
    const m = metricsFor("consensus-engine.ts");
    expect(m).toBeDefined();
    expect(m!.consecutiveFailures).toBe(0);
    expect(m!.totalFailures).toBe(0);
    expect(m!.totalDeferred).toBe(8);
    expect(m!.lastDeferredReason).toBe("llm-unavailable");
    expect(m!.verifiedApplied).toBe(0);
    expect(m!.successRate).toBeNull();
    expect(isModuleCoolingDown("consensus-engine")).toBe(false);
  });

  it("defers instead of failing when the source tree is not present", async () => {
    _setSourceLibDirForTests(null);
    const proposal = await proposeEvolution("dual-brain", "Add array size limits and periodic pruning", "no source tree");
    expect(proposal.status).toBe("approved");
    const m = metricsFor("dual-brain.ts");
    expect(m!.totalFailures).toBe(0);
    expect(m!.lastDeferredReason).toBe("source-unavailable");
  });

  it("reuses an identical approved proposal instead of re-voting", async () => {
    const change = "Extract deeply nested logic into named functions";
    const first = await proposeEvolution("truthfulness-engine", change, "dedupe");
    const second = await proposeEvolution("truthfulness-engine.ts", change, "dedupe again");
    expect(second.id).toBe(first.id);
    expect(metricsFor("truthfulness-engine.ts")!.totalDeferred).toBe(1);
  });

  it("routes the sacred-geometry alias to the real module", async () => {
    const proposal = await proposeEvolution("sacred-geometry", "Add try-catch with graceful degradation", "alias");
    expect(proposal.targetModule).toBe("sovereign-sacred-geometry.ts");
    expect(proposal.status).toBe("approved");
    expect(metricsFor("sovereign-sacred-geometry.ts")!.totalFailures).toBe(0);
  });

  it("still counts a genuinely missing source file as a failure", async () => {
    llmState.available = true;
    const proposal = await proposeEvolution("no-such-module", "Add try-catch with graceful degradation", "missing");
    expect(proposal.status).toBe("rejected");
    expect(proposal.impact).toMatch(/Source file not found for module: no-such-module\.ts/);
    expect(metricsFor("no-such-module.ts")!.consecutiveFailures).toBe(1);
  });
});
