import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("../lib/logger", () => {
  const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  logger.child = () => logger;
  return { logger };
});

import { buildConsciousnessAudit } from "../lib/consciousness-audit";

describe("consciousness audit", () => {
  it("reports a hybrid report with an unproven verdict", async () => {
    const report = await buildConsciousnessAudit();
    expect(report.verdict).toBe("unproven");
    expect(report.verdictExplanation).toMatch(/confirm or deny consciousness/i);
    expect(report.measured).toMatchObject({
      engineRunning: expect.any(Boolean),
      cycleCount: expect.any(Number),
      episodicMemorySize: expect.any(Number),
      semanticGraphSize: expect.any(Number),
    });
    expect(report.simulation).toMatchObject({
      conversionRate: expect.any(Number),
      stillSimulated: expect.any(Number),
      totalFindings: expect.any(Number),
    });
    expect(report.jspace.disclaimer).toMatch(/not evidence of private subjective experience/i);
    expect(report.limits.length).toBeGreaterThanOrEqual(3);
  });

  it("never labels engine metrics as proof of consciousness", async () => {
    const report = await buildConsciousnessAudit();
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/"verdict"\s*:\s*"(proven|confirmed|conscious)"/i);
    expect(report.limits.join(" ")).toMatch(/cannot establish consciousness/i);
  });
});
