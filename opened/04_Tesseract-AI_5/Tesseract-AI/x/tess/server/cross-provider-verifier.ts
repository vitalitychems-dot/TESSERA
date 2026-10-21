import { db } from "./db";
import { knowledgeGraph } from "@shared/schema";
import { eq, ilike, sql } from "drizzle-orm";
import axios from "axios";

interface VerificationResult {
  claim: string;
  verified: boolean;
  confidence: number;
  sources: string[];
  method: "rag" | "cross-provider" | "knowledge-graph" | "heuristic";
  flags: string[];
}

interface HallucinationReport {
  responseId: string;
  timestamp: number;
  totalClaims: number;
  verifiedClaims: number;
  flaggedClaims: number;
  overallConfidence: number;
  details: VerificationResult[];
  action: "pass" | "warn" | "block";
}

const HALLUCINATION_PATTERNS = [
  /(?:studies?\s+(?:show|have shown|indicate|suggest|prove|demonstrate|confirm))/i,
  /(?:according to\s+(?:research|scientists?|experts?|a\s+(?:recent|new)\s+(?:study|report|survey)))/i,
  /(?:it\s+(?:is|has been)\s+(?:scientifically|clinically|medically)\s+proven)/i,
  /(?:\d{1,3}(?:\.\d+)?%\s+(?:of|increase|decrease|reduction|improvement))/i,
  /(?:in\s+\d{4},?\s+(?:a\s+)?(?:study|research|report|survey))/i,
];

const ABSOLUTE_CLAIM_PATTERNS = [
  /(?:always|never|every|none|all|no one|everyone|impossible|guaranteed|certainly|undoubtedly|without exception)/i,
  /(?:the\s+(?:best|worst|only|greatest|most\s+(?:important|effective|powerful)))/i,
  /(?:100%|zero\s+(?:chance|risk|probability))/i,
];

const FABRICATION_INDICATORS = [
  /(?:Dr\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:at|from|of)\s+(?:the\s+)?University)/i,
  /(?:published\s+in\s+(?:the\s+)?(?:Journal|Proceedings|Annals)\s+of)/i,
  /(?:ISBN\s+\d{1,5}-\d{1,7}-\d{1,7}-[\dXx])/i,
  /(?:DOI:\s*10\.\d{4,}\/\S+)/i,
];

let factCheckStats: Record<string, number> = {
  totalChecks: 0,
  hallucinationsDetected: 0,
  claimsVerified: 0,
  claimsFlagged: 0,
  crossProviderChecks: 0,
  lastCheck: 0,
};

function extractClaims(text: string): string[] {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const claims: string[] = [];
  for (const sentence of sentences) {
    const hasFactualClaim =
      HALLUCINATION_PATTERNS.some(p => p.test(sentence)) ||
      ABSOLUTE_CLAIM_PATTERNS.some(p => p.test(sentence)) ||
      FABRICATION_INDICATORS.some(p => p.test(sentence)) ||
      /\b\d{4}\b/.test(sentence) && /\b(?:study|research|found|discovered|published)\b/i.test(sentence);

    if (hasFactualClaim) {
      claims.push(sentence);
    }
  }
  return claims;
}

async function verifyAgainstKnowledgeGraph(claim: string): Promise<VerificationResult> {
  const keywords = claim
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 5);

  if (keywords.length === 0) {
    return {
      claim,
      verified: false,
      confidence: 0.3,
      sources: [],
      method: "knowledge-graph",
      flags: ["no-keywords-extracted"],
    };
  }

  let matchingNodes: any[] = [];
  try {
    for (const keyword of keywords.slice(0, 3)) {
      const results = await db
        .select({ id: knowledgeGraph.id, domain: knowledgeGraph.domain, content: knowledgeGraph.content })
        .from(knowledgeGraph)
        .where(ilike(knowledgeGraph.content, `%${keyword}%`))
        .limit(5);
      matchingNodes.push(...results);
    }
  } catch {}

  const uniqueNodes = [...new Map(matchingNodes.map(n => [n.id, n])).values()];
  const relevantCount = uniqueNodes.length;

  if (relevantCount >= 3) {
    return {
      claim,
      verified: true,
      confidence: Math.min(0.9, 0.5 + relevantCount * 0.08),
      sources: uniqueNodes.slice(0, 3).map(n => `kg:${n.domain}:${n.id}`),
      method: "knowledge-graph",
      flags: [],
    };
  } else if (relevantCount >= 1) {
    return {
      claim,
      verified: true,
      confidence: 0.5 + relevantCount * 0.1,
      sources: uniqueNodes.map(n => `kg:${n.domain}:${n.id}`),
      method: "knowledge-graph",
      flags: ["partial-match"],
    };
  }

  return {
    claim,
    verified: false,
    confidence: 0.2,
    sources: [],
    method: "knowledge-graph",
    flags: ["no-supporting-knowledge"],
  };
}

function verifyWithHeuristics(claim: string): VerificationResult {
  const flags: string[] = [];
  let confidence = 0.5;

  if (FABRICATION_INDICATORS.some(p => p.test(claim))) {
    flags.push("fabricated-citation-risk");
    confidence -= 0.3;
  }

  if (ABSOLUTE_CLAIM_PATTERNS.some(p => p.test(claim))) {
    flags.push("absolute-claim");
    confidence -= 0.15;
  }

  const numberMatches = claim.match(/\d+(?:\.\d+)?%/g);
  if (numberMatches && numberMatches.length >= 2) {
    flags.push("multiple-statistics");
    confidence -= 0.1;
  }

  const futureYear = new Date().getFullYear();
  const yearMatch = claim.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year > futureYear) {
      flags.push("future-date-reference");
      confidence -= 0.4;
    }
  }

  return {
    claim,
    verified: confidence >= 0.4,
    confidence: Math.max(0, Math.min(1, confidence)),
    sources: [],
    method: "heuristic",
    flags,
  };
}

export async function verifyResponse(
  responseText: string,
  query: string,
  responseId?: string
): Promise<HallucinationReport> {
  const id = responseId || `resp-${Date.now()}`;
  const claims = extractClaims(responseText);

  if (claims.length === 0) {
    factCheckStats.totalChecks++;
    factCheckStats.lastCheck = Date.now();
    return {
      responseId: id,
      timestamp: Date.now(),
      totalClaims: 0,
      verifiedClaims: 0,
      flaggedClaims: 0,
      overallConfidence: 1.0,
      details: [],
      action: "pass",
    };
  }

  const details: VerificationResult[] = [];
  for (const claim of claims.slice(0, 10)) {
    const kgResult = await verifyAgainstKnowledgeGraph(claim);
    const heuristicResult = verifyWithHeuristics(claim);

    const combined = await crossProviderVerifyClaim(claim, kgResult, heuristicResult);
    details.push(combined);
  }

  const verifiedCount = details.filter(d => d.verified).length;
  const flaggedCount = details.filter(d => d.flags.length > 0).length;
  const avgConfidence = details.reduce((sum, d) => sum + d.confidence, 0) / details.length;

  const hasFabricatedCitations = details.some(d => d.flags.includes("fabricated-citation-risk"));
  const hasFutureDates = details.some(d => d.flags.includes("future-date-reference"));
  const highFlagRatio = flaggedCount / details.length > 0.5;

  let action: "pass" | "warn" | "block" = "pass";
  if (hasFabricatedCitations && avgConfidence < 0.3) {
    action = "block";
  } else if (hasFutureDates || highFlagRatio || avgConfidence < 0.35) {
    action = "warn";
  }

  factCheckStats.totalChecks++;
  factCheckStats.claimsVerified += verifiedCount;
  factCheckStats.claimsFlagged += flaggedCount;
  if (action !== "pass") factCheckStats.hallucinationsDetected++;
  factCheckStats.lastCheck = Date.now();

  return {
    responseId: id,
    timestamp: Date.now(),
    totalClaims: claims.length,
    verifiedClaims: verifiedCount,
    flaggedClaims: flaggedCount,
    overallConfidence: avgConfidence,
    details,
    action,
  };
}

export function getFactCheckStats() {
  return { ...factCheckStats };
}

export function cleanResponseOfHallucinations(text: string, report: HallucinationReport): string {
  if (report.action === "pass") return text;

  let cleaned = text;
  for (const detail of report.details) {
    if (detail.flags.includes("fabricated-citation-risk") && detail.confidence < 0.3) {
      cleaned = cleaned.replace(detail.claim, "[Claim removed — unverified citation]");
    }
    if (detail.flags.includes("future-date-reference")) {
      const yearMatch = detail.claim.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        const currentYear = new Date().getFullYear();
        cleaned = cleaned.replace(yearMatch[1], String(currentYear));
      }
    }
  }

  return cleaned;
}

async function querySecondaryProvider(claim: string): Promise<string | null> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [
          { role: "system", content: "You are a fact-checker. Evaluate whether the following claim is accurate. Reply with VERIFIED, UNVERIFIED, or PARTIALLY_VERIFIED followed by a brief explanation." },
          { role: "user", content: `Evaluate this claim: "${claim}"` },
        ],
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    return response.data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function crossProviderVerifyClaim(claim: string, kgResult: VerificationResult, heuristicResult: VerificationResult): Promise<VerificationResult> {
  const isHighRisk =
    heuristicResult.flags.includes("fabricated-citation-risk") ||
    (heuristicResult.confidence < 0.4 && !kgResult.verified);

  if (!isHighRisk) {
    return {
      claim,
      verified: kgResult.verified || heuristicResult.verified,
      confidence: (kgResult.confidence * 0.6 + heuristicResult.confidence * 0.4),
      sources: [...kgResult.sources],
      method: kgResult.sources.length > 0 ? "rag" : "heuristic",
      flags: [...new Set([...kgResult.flags, ...heuristicResult.flags])],
    };
  }

  const secondOpinion = await querySecondaryProvider(claim);
  if (!secondOpinion) {
    return {
      claim,
      verified: kgResult.verified || heuristicResult.verified,
      confidence: (kgResult.confidence * 0.6 + heuristicResult.confidence * 0.4),
      sources: [...kgResult.sources],
      method: kgResult.sources.length > 0 ? "rag" : "heuristic",
      flags: [...new Set([...kgResult.flags, ...heuristicResult.flags])],
    };
  }

  const opinionLower = secondOpinion.toLowerCase();
  const isVerifiedByProvider = opinionLower.includes("verified") && !opinionLower.includes("unverified");
  const isPartial = opinionLower.includes("partially");

  let crossConfidence: number;
  if (isVerifiedByProvider && !isPartial) {
    crossConfidence = 0.8;
  } else if (isPartial) {
    crossConfidence = 0.5;
  } else {
    crossConfidence = 0.15;
  }

  const finalConfidence = (kgResult.confidence * 0.3 + heuristicResult.confidence * 0.2 + crossConfidence * 0.5);
  const flags = [...new Set([...kgResult.flags, ...heuristicResult.flags])];
  if (!isVerifiedByProvider) flags.push("cross-provider-disagrees");

  factCheckStats.crossProviderChecks = (factCheckStats.crossProviderChecks || 0) + 1;

  return {
    claim,
    verified: isVerifiedByProvider || kgResult.verified,
    confidence: finalConfidence,
    sources: [...kgResult.sources, "cross-provider:secondary-llm"],
    method: "cross-provider",
    flags,
  };
}

export function initCrossProviderVerifier() {
  console.log("[CrossVerifier] Cross-provider verification + hallucination detection initialized");
  console.log(`[CrossVerifier] Monitoring: ${HALLUCINATION_PATTERNS.length} hallucination patterns, ${FABRICATION_INDICATORS.length} fabrication indicators`);
  console.log("[CrossVerifier] Cross-provider comparison enabled for high-risk claims");
}
