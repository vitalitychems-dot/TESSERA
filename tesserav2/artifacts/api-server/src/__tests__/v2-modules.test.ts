import { afterEach, describe, expect, it } from "vitest";
import { conclude, renderConclusion } from "../lib/v2/evidence-lens";
import { SourceGraph } from "../lib/v2/source-graph";
import { getUsageReport, recordModelCall, resetUsageLedger } from "../lib/v2/usage-ledger";
import { rehearse } from "../lib/v2/scenario-sandbox";

afterEach(() => resetUsageLedger());

describe("Evidence Lens", () => {
  it("never grades an evidence-free claim as a finding", () => {
    expect(conclude({ claim: "X is safe", evidence: [], limitations: ["none"] }).verdict).toBe("unsupported");
    const hypothesis = conclude({
      claim: "Y works", limitations: [],
      evidence: [{ source: "TESSERA", locator: "src/a.ts:1-5", kind: "code" }],
    });
    expect(hypothesis.verdict).toBe("hypothesis");
    const finding = conclude({
      claim: "Z holds", limitations: ["sampled subset only"],
      evidence: [
        { source: "TESSERA", locator: "src/b.ts", kind: "code" },
        { source: "suite", locator: "b.test.ts", kind: "test" },
      ],
    });
    expect(finding.verdict).toBe("finding");
    expect(renderConclusion(finding)).toContain("VERDICT: finding");
  });
});

describe("Source Graph", () => {
  it("traces provenance and rejects cycles", () => {
    const g = new SourceGraph();
    g.addNode({ id: "repo:TESSERA", kind: "repo", label: "TESSERA" });
    g.addNode({ id: "module:memory", kind: "module", label: "Local memory" });
    g.addNode({ id: "capability:chat-context", kind: "capability", label: "Chat context" });
    g.addEdge({ from: "repo:TESSERA", to: "module:memory", kind: "contains" });
    g.addEdge({ from: "module:memory", to: "capability:chat-context", kind: "feeds" });
    expect(g.provenanceOf("capability:chat-context").map(n => n.id).sort())
      .toEqual(["module:memory", "repo:TESSERA"]);
    expect(() => g.addEdge({ from: "capability:chat-context", to: "repo:TESSERA", kind: "feeds" }))
      .toThrow(/cycle/);
    expect(g.dependentsOf("module:memory")[0].id).toBe("capability:chat-context");
  });
});

describe("Usage Ledger", () => {
  it("accounts per model with honest limits and no failover", () => {
    recordModelCall({ model: "glm", ok: true, promptChars: 400, completionChars: 200 });
    recordModelCall({ model: "glm", ok: false, limited: true, promptChars: 40 });
    const [report] = getUsageReport("glm");
    expect(report).toMatchObject({ requests: 2, failures: 1, limitEvents: 1, estimatedTotalTokens: 160 });
    expect(report.note).toContain("No fallback provider");
  });
});

describe("Scenario Sandbox", () => {
  it("rehearses against lessons and stays honest about limits", () => {
    const lessons = [
      { id: "l1", text: "Deploying without running tests broke the API build", tag: "risk" as const },
      { id: "l2", text: "Caching retrieved lessons cut repeated context tokens", tag: "benefit" as const },
    ];
    const risky = rehearse("deploy new build without tests", lessons);
    expect(risky.recommendation).toBe("hold");
    expect(risky.matchedRisks[0].id).toBe("l1");
    expect(risky.limitation).toContain("not prediction");
    const safe = rehearse("cache retrieved lessons for chat", lessons);
    expect(safe.recommendation).toBe("proceed");
    expect(safe.matchedBenefits[0].id).toBe("l2");
  });
});
