import { describe, expect, it } from "vitest";
import { packProgressiveContext } from "../lib/capability-planning/context-packer";
import { planDependencyWaves } from "../lib/capability-planning/dependency-planner";
import { greedyBatch, quboInspiredBatch, type BatchCandidate } from "../lib/capability-planning/qubo-batch";
import { validateTaskContract } from "../lib/capability-planning/task-contract";

const validContract = {
  id: "fixture-task",
  goal: "Produce a deterministic summary",
  constraints: ["Use local fixtures only"],
  evidenceNeeds: ["Cite the fixture source"],
  acceptanceChecks: ["Output contains a source reference"],
  allowedCapabilities: ["read-fixture"],
  forbiddenCapabilities: ["network"],
  budgets: { maxTokens: 500, maxDurationMs: 1_000 },
};

describe("Task contract validation", () => {
  it("accepts a complete, non-contradictory contract", () => {
    const result = validateTaskContract(validContract);
    expect(result.valid).toBe(true);
    expect(result.value?.id).toBe("fixture-task");
  });

  it("reports missing acceptance checks and contradictory capabilities", () => {
    const result = validateTaskContract({
      ...validContract,
      acceptanceChecks: [],
      forbiddenCapabilities: ["network", "read-fixture"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("acceptanceChecks must contain at least one check.");
    expect(result.errors.some(error => error.includes("both allowed and forbidden"))).toBe(true);
  });
});

describe("Dependency-aware planning", () => {
  it("keeps dependencies in earlier waves and serializes conflicts", () => {
    const result = planDependencyWaves([
      { id: "base", priority: 2 },
      { id: "dependent", dependsOn: ["base"], priority: 10 },
      { id: "write-a", conflictsWith: ["write-b"] },
      { id: "write-b" },
    ], { maxParallel: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.waves[0]).toContain("base");
    expect(result.waves[0]).not.toContain("dependent");
    expect(result.waves.some(wave => wave.includes("write-a") && wave.includes("write-b"))).toBe(false);
    expect(result.waves.flat()).toHaveLength(4);
  });

  it("rejects unknown dependencies, cycles, and tasks above the risk limit", () => {
    expect(planDependencyWaves([{ id: "a", dependsOn: ["missing"] }], { maxParallel: 1 }).ok).toBe(false);
    expect(planDependencyWaves([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
    ]).ok).toBe(false);
    expect(planDependencyWaves([{ id: "risky", risk: "high" }], { maxRisk: "low" }).ok).toBe(false);
  });
});

describe("Progressive context packing", () => {
  const candidates = [
    {
      id: "high",
      source: "src/high.ts",
      relevance: 1,
      indexText: "High-level index",
      excerptText: "Relevant high-priority excerpt",
      fullText: "Relevant high-priority source text. ".repeat(10),
    },
    {
      id: "low",
      source: "src/low.ts",
      relevance: 0.2,
      indexText: "Low-level index",
      excerptText: "Relevant low-priority excerpt",
      fullText: "Relevant low-priority source text. ".repeat(10),
    },
  ];

  it("keeps source references and upgrades relevant entries only within budget", () => {
    const result = packProgressiveContext(candidates, 16);
    expect(result.estimatedTokens).toBeLessThanOrEqual(result.budgetTokens);
    expect(result.included[0].id).toBe("high");
    expect(result.included.every(item => item.source.startsWith("src/"))).toBe(true);
    expect(result.included.find(item => item.id === "high")?.level).toBe("excerpt");
  });

  it("returns stable inclusion decisions and rejects duplicate ids", () => {
    expect(packProgressiveContext(candidates, 12)).toEqual(packProgressiveContext(candidates, 12));
    expect(() => packProgressiveContext([candidates[0], candidates[0]], 20)).toThrow(/Duplicate context id/);
  });
});

describe("QUBO-inspired offline batch experiment", () => {
  const fixture: BatchCandidate[] = [
    { id: "high-single", utility: 10, cost: 1 },
    { id: "pair-left", utility: 9, cost: 1 },
    { id: "pair-right", utility: 9, cost: 1 },
    { id: "over-budget", utility: 100, cost: 4, risk: "high" },
  ];
  const options = {
    maxTasks: 2,
    maxCost: 2,
    maxRisk: "medium" as const,
    synergies: [{ leftId: "pair-left", rightId: "pair-right", bonus: 12 }],
    iterations: 5_000,
    seed: 17,
  };

  it("returns a deterministic feasible batch and compares with the greedy baseline", () => {
    const greedy = greedyBatch(fixture, options);
    const first = quboInspiredBatch(fixture, options);
    const second = quboInspiredBatch(fixture, options);
    expect(first.selectedIds).toEqual(second.selectedIds);
    expect(first.score).toBe(second.score);
    expect(first.selectedIds).toEqual(["pair-left", "pair-right"]);
    expect(first.score).toBeGreaterThan(greedy.score);
    expect(first.selectedIds).not.toContain("over-budget");
    expect(first.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("enforces dependencies, conflicts, cost, and risk constraints", () => {
    const constrained: BatchCandidate[] = [
      { id: "foundation", utility: 2, cost: 1 },
      { id: "dependent", utility: 20, cost: 1, dependsOn: ["foundation"] },
      { id: "conflict", utility: 30, cost: 1, conflictsWith: ["dependent"] },
      { id: "unsafe", utility: 100, cost: 1, risk: "high" },
    ];
    const result = quboInspiredBatch(constrained, {
      maxTasks: 3,
      maxCost: 2,
      maxRisk: "medium",
      iterations: 3_000,
      seed: 9,
    });
    expect(result.selectedIds).not.toContain("unsafe");
    expect(result.selectedIds.includes("dependent") && result.selectedIds.includes("conflict")).toBe(false);
    if (result.selectedIds.includes("dependent")) {
      expect(result.selectedIds).toContain("foundation");
    }
  });

  it("rejects unknown dependencies and never selects a cyclic dependency chain", () => {
    expect(() => quboInspiredBatch([
      { id: "orphan", utility: 10, cost: 1, dependsOn: ["missing"] },
    ], { maxTasks: 1, maxCost: 1 })).toThrow(/Unknown dependency/);

    const cyclic = quboInspiredBatch([
      { id: "cycle-a", utility: 10, cost: 1, dependsOn: ["cycle-b"] },
      { id: "cycle-b", utility: 10, cost: 1, dependsOn: ["cycle-a"] },
      { id: "independent", utility: 1, cost: 1 },
    ], { maxTasks: 2, maxCost: 2, iterations: 300, seed: 3 });
    expect(cyclic.selectedIds).toEqual(["independent"]);
  });
});

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)].toFixed(3));
}

function measureMs<T>(operation: () => T): { value: T; elapsedMs: number } {
  const start = performance.now();
  const value = operation();
  return { value, elapsedMs: performance.now() - start };
}

describe("Offline capability baseline benchmark", () => {
  it("reports repeatable quality and latency comparison metrics", () => {
    const benchmarkCandidates: BatchCandidate[] = Array.from({ length: 12 }, (_, index) => ({
      id: `task-${index}`,
      utility: 20 - index,
      cost: index % 3 + 1,
      risk: index === 11 ? "high" as const : "low" as const,
    }));
    const benchmarkOptions = {
      maxTasks: 4,
      maxCost: 8,
      maxRisk: "medium" as const,
      synergies: [
        { leftId: "task-5", rightId: "task-6", bonus: 7 },
        { leftId: "task-8", rightId: "task-9", bonus: 4 },
      ],
      iterations: 1_000,
      seed: 71,
    };
    const contractTimes: number[] = [];
    const planTimes: number[] = [];
    const contextTimes: number[] = [];
    const greedyTimes: number[] = [];
    const quboTimes: number[] = [];
    const objectiveGains: number[] = [];
    let contextEstimatedTokens = 0;

    for (let trial = 0; trial < 20; trial++) {
      contractTimes.push(measureMs(() => validateTaskContract(validContract)).elapsedMs);
      planTimes.push(measureMs(() => planDependencyWaves([
        { id: "read", priority: 2 },
        { id: "analyze", dependsOn: ["read"] },
        { id: "write-a", conflictsWith: ["write-b"] },
        { id: "write-b" },
      ], { maxParallel: 3 })).elapsedMs);
      const context = measureMs(() => packProgressiveContext([
        { id: "a", source: "fixture:a", relevance: 1, indexText: "Index A", excerptText: "Excerpt A", fullText: "Full source A ".repeat(8) },
        { id: "b", source: "fixture:b", relevance: 0.5, indexText: "Index B", excerptText: "Excerpt B", fullText: "Full source B ".repeat(8) },
      ], 32));
      contextTimes.push(context.elapsedMs);
      contextEstimatedTokens = context.value.estimatedTokens;

      const greedy = measureMs(() => greedyBatch(benchmarkCandidates, benchmarkOptions));
      const qubo = measureMs(() => quboInspiredBatch(benchmarkCandidates, benchmarkOptions));
      greedyTimes.push(greedy.elapsedMs);
      quboTimes.push(qubo.elapsedMs);
      expect(qubo.value.score).toBeGreaterThanOrEqual(greedy.value.score);
      objectiveGains.push(qubo.value.score - greedy.value.score);
    }

    const metrics = {
      trials: greedyTimes.length,
      contractP50Ms: percentile(contractTimes, 0.5),
      contractP95Ms: percentile(contractTimes, 0.95),
      dependencyPlanP50Ms: percentile(planTimes, 0.5),
      dependencyPlanP95Ms: percentile(planTimes, 0.95),
      contextPackP50Ms: percentile(contextTimes, 0.5),
      contextPackP95Ms: percentile(contextTimes, 0.95),
      greedyP50Ms: percentile(greedyTimes, 0.5),
      greedyP95Ms: percentile(greedyTimes, 0.95),
      quboP50Ms: percentile(quboTimes, 0.5),
      quboP95Ms: percentile(quboTimes, 0.95),
      quboP50OverheadPercent: Number((((percentile(quboTimes, 0.5) / Math.max(percentile(greedyTimes, 0.5), 0.001)) - 1) * 100).toFixed(1)),
      quboObjectiveWinRatePercent: Number((objectiveGains.filter(gain => gain > 0).length / objectiveGains.length * 100).toFixed(1)),
      quboObjectiveGainP50: percentile(objectiveGains, 0.5),
      contextEstimatedTokens,
      tokenEstimateBasis: "ceil(text characters / 4), not actual model usage",
    };
    if (process.env.CAPABILITY_BENCHMARK === "1") {
      console.log(`CAPABILITY_BENCHMARK ${JSON.stringify(metrics)}`);
    }
    expect(metrics.trials).toBe(20);
    expect(metrics.greedyP95Ms).toBeGreaterThanOrEqual(0);
    expect(metrics.quboP95Ms).toBeGreaterThanOrEqual(0);
    expect(metrics.contextEstimatedTokens).toBeLessThanOrEqual(32);
  });
});
