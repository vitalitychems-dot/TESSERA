// Tessera Evidence Lens — tailored from REA's reporting discipline.
// Every conclusion carries its evidence and its limitations. A claim with no
// evidence is a hypothesis, never a finding. No network access, no external
// analysis runtime.

export interface EvidenceItem {
  source: string;      // repo, file, document, or dataset name
  locator: string;     // path, line range, commit, or URL
  kind: "code" | "document" | "observation" | "test" | "external-report";
}

export interface Conclusion {
  claim: string;
  verdict: "finding" | "hypothesis" | "unsupported";
  evidence: EvidenceItem[];
  limitations: string[];
  confidence: number; // 0..1, heuristic — not a probability of truth
}

export interface ConcludeOptions {
  claim: string;
  evidence: EvidenceItem[];
  limitations: string[];
}

/**
 * Produce an evidence-attached conclusion. The verdict follows simple,
 * auditable rules — deliberately conservative:
 *  - no evidence                -> unsupported
 *  - evidence but no limitations -> hypothesis (every real analysis has limits)
 *  - evidence + limitations      -> finding
 */
export function conclude({ claim, evidence, limitations }: ConcludeOptions): Conclusion {
  const cleanClaim = claim.trim();
  if (!cleanClaim) throw new Error("A conclusion requires a non-empty claim");

  const usable = evidence.filter(
    (e) => e.source.trim() && e.locator.trim(),
  );
  const limits = limitations.map((l) => l.trim()).filter(Boolean);

  let verdict: Conclusion["verdict"];
  if (usable.length === 0) verdict = "unsupported";
  else if (limits.length === 0) verdict = "hypothesis";
  else verdict = "finding";

  // Confidence rewards independent evidence kinds and penalizes thin limits.
  const kinds = new Set(usable.map((e) => e.kind)).size;
  const confidence = verdict === "unsupported"
    ? 0
    : Math.min(0.95, 0.3 + 0.15 * usable.length + 0.1 * (kinds - 1) + 0.05 * Math.min(limits.length, 3));

  return {
    claim: cleanClaim,
    verdict,
    evidence: usable,
    limitations: limits,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/** Render a conclusion as the plain report block used in deliverables. */
export function renderConclusion(c: Conclusion): string {
  const lines = [
    `CLAIM: ${c.claim}`,
    `VERDICT: ${c.verdict} (confidence ${c.confidence})`,
    "EVIDENCE:",
    ...c.evidence.map((e) => `  - [${e.kind}] ${e.source} :: ${e.locator}`),
    "LIMITATIONS:",
    ...(c.limitations.length ? c.limitations.map((l) => `  - ${l}`) : ["  - none recorded (verdict capped at hypothesis)"]),
  ];
  return lines.join("\n");
}
