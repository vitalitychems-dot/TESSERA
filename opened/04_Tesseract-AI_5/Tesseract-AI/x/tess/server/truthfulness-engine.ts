const log = (m: string) => console.log(`[TruthfulnessEngine] ${m}`);

interface VerificationResult {
  claim: string;
  verified: boolean;
  confidence: number;
  sources: string[];
  providerAgreement: number;
  flags: string[];
}

interface HallucinationCheck {
  text: string;
  score: number;
  indicators: string[];
  severity: "none" | "low" | "medium" | "high";
}

interface CrossProviderVerification {
  query: string;
  responses: Array<{ providerId: string; response: string; timestamp: number }>;
  agreementScore: number;
  disagreements: string[];
  consensusAnswer: string | null;
  confidence: number;
}

const HALLUCINATION_PATTERNS = [
  { pattern: /(?:studies show|research indicates|scientists have proven|according to a \d{4} study)/i, weight: 0.3, name: "unverifiable_citation" },
  { pattern: /(?:100%|absolutely|definitely|certainly|undoubtedly|without question|it is a fact)/i, weight: 0.2, name: "absolute_claim" },
  { pattern: /(?:everyone knows|it is well known|common knowledge|obviously)/i, weight: 0.15, name: "appeal_to_common_knowledge" },
  { pattern: /(?:invented in \d{4}|discovered in \d{4}|founded in \d{4}|born in \d{4})/i, weight: 0.1, name: "specific_date_claim" },
  { pattern: /(?:\d{1,3}(?:\.\d+)?%\s+of\s+(?:people|studies|experts|scientists))/i, weight: 0.25, name: "fabricated_statistic" },
  { pattern: /(?:Dr\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+|Professor\s+[A-Z][a-z]+)/i, weight: 0.2, name: "specific_person_claim" },
  { pattern: /(?:a recent study|a new study|recent research|latest research)/i, weight: 0.15, name: "vague_recent_study" },
  { pattern: /(?:has been shown to|has been demonstrated|proven to)/i, weight: 0.1, name: "passive_authority" },
];

const SAFE_PATTERNS = [
  { pattern: /(?:I'm not sure|I don't know|I cannot verify|I'm uncertain|this may|possibly|perhaps|it's possible)/i, weight: -0.3, name: "epistemic_humility" },
  { pattern: /(?:according to Wikipedia|per the|as stated in|the .+ documentation says)/i, weight: -0.2, name: "explicit_source" },
  { pattern: /(?:however|on the other hand|some argue|there is debate|it depends)/i, weight: -0.15, name: "nuance" },
  { pattern: /(?:as of \d{4}|at the time of writing|based on available data)/i, weight: -0.1, name: "temporal_caveat" },
];

export function detectHallucination(text: string): HallucinationCheck {
  if (!text || text.length < 20) {
    return { text: text?.slice(0, 100) || "", score: 0, indicators: [], severity: "none" };
  }

  let score = 0;
  const indicators: string[] = [];

  for (const { pattern, weight, name } of HALLUCINATION_PATTERNS) {
    const matches = text.match(new RegExp(pattern, "gi"));
    if (matches) {
      const contribution = weight * Math.min(matches.length, 3);
      score += contribution;
      indicators.push(`${name} (×${matches.length})`);
    }
  }

  for (const { pattern, weight, name } of SAFE_PATTERNS) {
    const matches = text.match(new RegExp(pattern, "gi"));
    if (matches) {
      score += weight * Math.min(matches.length, 3);
      indicators.push(`${name} (×${matches.length})`);
    }
  }

  score = Math.max(0, Math.min(1, score));

  let severity: HallucinationCheck["severity"] = "none";
  if (score >= 0.6) severity = "high";
  else if (score >= 0.35) severity = "medium";
  else if (score >= 0.15) severity = "low";

  return {
    text: text.slice(0, 200),
    score: Math.round(score * 1000) / 1000,
    indicators: indicators.filter(i => !i.startsWith("epistemic")),
    severity,
  };
}

function computeTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function crossProviderVerify(
  query: string,
  responses: Array<{ providerId: string; response: string }>,
): CrossProviderVerification {
  if (responses.length < 2) {
    return {
      query,
      responses: responses.map(r => ({ ...r, timestamp: Date.now() })),
      agreementScore: 0,
      disagreements: ["Insufficient providers for cross-verification (need ≥2)"],
      consensusAnswer: responses[0]?.response || null,
      confidence: 0.3,
    };
  }

  let totalSimilarity = 0;
  let pairCount = 0;
  const disagreements: string[] = [];

  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const similarity = computeTextSimilarity(responses[i].response, responses[j].response);
      totalSimilarity += similarity;
      pairCount++;

      if (similarity < 0.3) {
        disagreements.push(
          `${responses[i].providerId} vs ${responses[j].providerId}: low agreement (${(similarity * 100).toFixed(0)}%)`
        );
      }
    }
  }

  const agreementScore = pairCount > 0 ? totalSimilarity / pairCount : 0;

  let consensusAnswer: string | null = null;
  let bestConsensusScore = 0;

  for (const response of responses) {
    let totalSim = 0;
    for (const other of responses) {
      if (other.providerId !== response.providerId) {
        totalSim += computeTextSimilarity(response.response, other.response);
      }
    }
    const avgSim = totalSim / (responses.length - 1);
    if (avgSim > bestConsensusScore) {
      bestConsensusScore = avgSim;
      consensusAnswer = response.response;
    }
  }

  let confidence = agreementScore;
  if (responses.length >= 3) confidence = Math.min(1, confidence + 0.1);
  if (responses.length >= 5) confidence = Math.min(1, confidence + 0.1);

  return {
    query,
    responses: responses.map(r => ({ ...r, timestamp: Date.now() })),
    agreementScore: Math.round(agreementScore * 1000) / 1000,
    disagreements,
    consensusAnswer,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}

export function verifyClaimAgainstSources(
  claim: string,
  sourceTexts: Array<{ source: string; text: string }>,
): VerificationResult {
  if (sourceTexts.length === 0) {
    return {
      claim,
      verified: false,
      confidence: 0,
      sources: [],
      providerAgreement: 0,
      flags: ["no_supporting_sources"],
    };
  }

  const claimWords = new Set(
    claim.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  );

  let maxSimilarity = 0;
  const matchingSources: string[] = [];
  const flags: string[] = [];

  for (const source of sourceTexts) {
    const sourceWords = new Set(
      source.text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    );

    let overlap = 0;
    for (const word of claimWords) {
      if (sourceWords.has(word)) overlap++;
    }

    const similarity = claimWords.size > 0 ? overlap / claimWords.size : 0;
    if (similarity > 0.3) {
      matchingSources.push(source.source);
    }
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  if (matchingSources.length === 0) flags.push("no_source_overlap");
  if (maxSimilarity < 0.2) flags.push("very_low_source_agreement");

  const hallCheck = detectHallucination(claim);
  if (hallCheck.severity === "high") flags.push("high_hallucination_risk");
  if (hallCheck.severity === "medium") flags.push("medium_hallucination_risk");

  const verified = maxSimilarity >= 0.4 && matchingSources.length >= 1 && hallCheck.severity !== "high";
  const confidence = Math.min(1, maxSimilarity * 0.6 + (matchingSources.length / sourceTexts.length) * 0.4);

  return {
    claim: claim.slice(0, 200),
    verified,
    confidence: Math.round(confidence * 1000) / 1000,
    sources: matchingSources,
    providerAgreement: Math.round(maxSimilarity * 1000) / 1000,
    flags,
  };
}

const verificationHistory: Array<CrossProviderVerification & { timestamp: number }> = [];
const MAX_VERIFICATION_HISTORY = 1000;

export function recordVerification(verification: CrossProviderVerification): void {
  verificationHistory.push({ ...verification, timestamp: Date.now() });
  while (verificationHistory.length > MAX_VERIFICATION_HISTORY) verificationHistory.shift();
}

export function getVerificationStats(): {
  totalVerifications: number;
  avgAgreement: number;
  avgConfidence: number;
  highDisagreementCount: number;
  recentVerifications: number;
} {
  const now = Date.now();
  const recent = verificationHistory.filter(v => now - v.timestamp < 3600000);

  const avgAgreement = verificationHistory.length > 0
    ? verificationHistory.reduce((s, v) => s + v.agreementScore, 0) / verificationHistory.length
    : 0;

  const avgConfidence = verificationHistory.length > 0
    ? verificationHistory.reduce((s, v) => s + v.confidence, 0) / verificationHistory.length
    : 0;

  const highDisagreementCount = verificationHistory.filter(v => v.agreementScore < 0.3).length;

  return {
    totalVerifications: verificationHistory.length,
    avgAgreement: Math.round(avgAgreement * 1000) / 1000,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    highDisagreementCount,
    recentVerifications: recent.length,
  };
}

export function getRecentVerifications(limit = 20): Array<CrossProviderVerification & { timestamp: number }> {
  return verificationHistory.slice(-limit);
}

log(`Truthfulness engine initialized — ${HALLUCINATION_PATTERNS.length} hallucination patterns, ${SAFE_PATTERNS.length} safe patterns`);

export type { VerificationResult, HallucinationCheck, CrossProviderVerification };
