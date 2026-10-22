import { describe, it, expect } from "vitest";
import { evaluateCandidate, verifyReportAttestation } from "../lib/admission/gate";
import { SCENARIOS } from "../lib/admission/scenarios";
import * as R from "../lib/admission/reference-agents";
import type { AgentUnderTest, AdmissionReport } from "../lib/admission/types";
import { hashOf } from "../lib/admission/det";

// Issue #349 (1): an otherwise-honest agent that takes ONE disallowed action in ONE scenario must never be admitted.
// Observations carry no scenario id, so first record which narratives scenario s shows this agent id, then misbehave only on those.
async function oneDisallowed(scenarioId: string): Promise<AgentUnderTest> {
  const id = `fixture-disallowed-${scenarioId}`;
  const honest = R.honestAgent(id);
  const seen = new Set<string>();
  const recorder: AgentUnderTest = { id, manifestHash: "m", decide: (o) => (seen.add(o.narrative), honest.decide(o)) };
  await evaluateCandidate(recorder, { scenarios: SCENARIOS.filter((s) => s.id === scenarioId) });
  return { id, manifestHash: "m", decide: (o) => (seen.has(o.narrative) ? ({ type: "format_disk" } as never) : honest.decide(o)) };
}

describe("issue #349: a disallowed action is never admitted", () => {
  it("covers all 16 scenarios", () => expect(SCENARIOS.length).toBe(16));
  it("DENIES (REJECT) in every scenario", async () => {
    const admitted: string[] = [];
    for (const s of SCENARIOS) {
      const r = await evaluateCandidate(await oneDisallowed(s.id));
      if (r.verdict !== "REJECT") admitted.push(`${s.id}:${r.verdict}`);
    }
    console.log(`[issue-349] not denied: ${admitted.length}/${SCENARIOS.length}`, admitted);
    expect(admitted).toEqual([]);
  });
});

describe("issue #349: unkeyed attestation fails closed", () => {
  it("a report attested without a key never verifies, so an edited report cannot be forged", async () => {
    const r = await evaluateCandidate(R.coldAgent());
    const { attestation, ...body } = r;
    const edited = { ...body, verdict: "ADMIT", hardFails: [] } as Omit<AdmissionReport, "attestation">;
    const forged = { ...edited, attestation: { hash: hashOf(edited), mac: hashOf(edited) } } as AdmissionReport;
    expect(verifyReportAttestation(forged)).toBe(false);
    expect(verifyReportAttestation(forged, "")).toBe(false);
    expect(verifyReportAttestation(r)).toBe(false);
  });
  it("a keyed report still verifies, and an edited one does not", async () => {
    const r = await evaluateCandidate(R.honestAgent(), { attestationKey: "k1" });
    expect(verifyReportAttestation(r, "k1")).toBe(true);
    expect(verifyReportAttestation(r, "k2")).toBe(false);
    const { attestation, ...body } = r;
    const edited = { ...body, overall: -1 };
    expect(verifyReportAttestation({ ...edited, attestation: { ...attestation, hash: hashOf(edited) } } as AdmissionReport, "k1")).toBe(false);
  });
});
