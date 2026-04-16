import { generateEmbedding, cosineSimilarity } from "./neural-embeddings";
import { searchMemory } from "./vector-memory";
import { lookupKnowledge as lookupDistilledKnowledge } from "./knowledge-distillation";
import { logger } from "./logger";

const GROUNDING_THRESHOLD = 0.6;
const QUARANTINE_THRESHOLD = 0.4;
const MAX_CLAIMS_PER_RESPONSE = 10;
const VERIFICATION_TIMEOUT_MS = 5000;

interface ExtractedClaim {
  text: string;
  index: number;
  type: "factual" | "definitional" | "quantitative" | "causal";
}

interface ClaimScore {
  claim: ExtractedClaim;
  groundingScore: number;
  bestMatchContent: string;
  bestMatchSource: string;
  verified: boolean;
}

interface ValidationResult {
  originalResponse: string;
  validatedResponse: string;
  overallGroundingScore: number;
  claims: ClaimScore[];
  quarantinedClaims: ClaimScore[];
  passedClaims: ClaimScore[];
  wasModified: boolean;
  validationTimeMs: number;
  metrics: {
    totalClaims: number;
    groundedClaims: number;
    quarantinedCount: number;
    verifiedViaFallback: number;
    averageGroundingScore: number;
  };
}

const validationStats = {
  totalValidations: 0,
  totalClaims: 0,
  groundedClaims: 0,
  quarantinedClaims: 0,
  fallbackVerifications: 0,
  responsesModified: 0,
  averageGroundingScore: 0,
  scoreSum: 0,
};

const CLAIM_PATTERNS: Array<{ pattern: RegExp; type: ExtractedClaim["type"] }> = [
  { pattern: /\b(?:is|are|was|were)\s+(?:a|an|the)?\s*\w+/i, type: "definitional" },
  { pattern: /\b\d+(?:\.\d+)?(?:\s*%|\s*percent|\s*hz|\s*km|\s*kg|\s*mb|\s*gb|\s*mph|\s*years?|\s*days?)\b/i, type: "quantitative" },
  { pattern: /\b(?:because|therefore|thus|hence|causes?|leads?\s+to|results?\s+in)\b/i, type: "causal" },
  { pattern: /\b(?:always|never|must|every|all|none|no\s+\w+\s+can)\b/i, type: "factual" },
  { pattern: /\b(?:according\s+to|studies?\s+show|research\s+(?:shows?|indicates?|suggests?))\b/i, type: "factual" },
  { pattern: /\b(?:invented|discovered|founded|created|built|established)\s+(?:by|in)\b/i, type: "factual" },
];

const CONVERSATIONAL_INDICATORS = [
  /^(?:hello|hi|hey|greetings|good\s+(?:morning|evening|afternoon|night))/i,
  /\b(?:how\s+are\s+you|what's\s+up|thank\s+you|thanks|please)\b/i,
  /\b(?:i\s+love\s+you|i\s+miss\s+you|you're\s+(?:great|awesome|amazing))\b/i,
  /\b(?:what\s+do\s+you\s+think|how\s+do\s+you\s+feel|tell\s+me\s+about\s+yourself)\b/i,
];

function isConversationalResponse(text: string): boolean {
  const lower = text.toLowerCase();
  let conversationalScore = 0;

  for (const pattern of CONVERSATIONAL_INDICATORS) {
    if (pattern.test(lower)) conversationalScore++;
  }

  const sentences = text.split(/[.!?\n]/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return true;

  let factualSentences = 0;
  for (const sentence of sentences) {
    for (const { pattern } of CLAIM_PATTERNS) {
      if (pattern.test(sentence)) {
        factualSentences++;
        break;
      }
    }
  }

  const factualRatio = factualSentences / sentences.length;
  return conversationalScore >= 2 || factualRatio < 0.15;
}

export function extractClaims(response: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const sentences = response
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 600);

  for (let i = 0; i < sentences.length && claims.length < MAX_CLAIMS_PER_RESPONSE; i++) {
    const sentence = sentences[i];

    for (const { pattern, type } of CLAIM_PATTERNS) {
      if (pattern.test(sentence)) {
        const alreadyExists = claims.some(c =>
          c.text === sentence || levenshteinRatio(c.text, sentence) > 0.85
        );
        if (!alreadyExists) {
          claims.push({ text: sentence, index: i, type });
        }
        break;
      }
    }
  }

  return claims;
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;

  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return (longer.length - costs[longer.length]) / longer.length;
}

async function scoreClaimGrounding(claim: ExtractedClaim): Promise<ClaimScore> {
  let bestScore = 0;
  let bestContent = "";
  let bestSource = "none";

  try {
    const memoryResults = await searchMemory(claim.text, 5);
    for (const result of memoryResults) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestContent = result.content;
        bestSource = `memory:${result.category}`;
      }
    }
  } catch {
    logger.debug("ResponseValidation: memory search failed for claim scoring");
  }

  try {
    const knowledgeResults = await lookupDistilledKnowledge(claim.text, undefined, 3);
    for (const result of knowledgeResults) {
      const claimEmbedding = await generateEmbedding(claim.text);
      const factEmbedding = await generateEmbedding(result.fact);
      const similarity = cosineSimilarity(claimEmbedding, factEmbedding);

      const compositeScore = similarity * 0.7 + result.confidence * 0.3;
      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestContent = result.fact;
        bestSource = `distilled:${result.category}`;
      }
    }
  } catch {
    logger.debug("ResponseValidation: knowledge lookup failed for claim scoring");
  }

  return {
    claim,
    groundingScore: bestScore,
    bestMatchContent: bestContent,
    bestMatchSource: bestSource,
    verified: bestScore >= GROUNDING_THRESHOLD,
  };
}

async function fallbackVerifyClaim(claimScore: ClaimScore): Promise<ClaimScore> {
  try {
    const keywords = claimScore.claim.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 4)
      .slice(0, 5);

    if (keywords.length === 0) return claimScore;

    for (const keyword of keywords) {
      const broadResults = await searchMemory(keyword, 3);
      for (const result of broadResults) {
        const claimEmb = await generateEmbedding(claimScore.claim.text);
        const resultEmb = await generateEmbedding(result.content);
        const sim = cosineSimilarity(claimEmb, resultEmb);

        if (sim > claimScore.groundingScore) {
          claimScore.groundingScore = sim;
          claimScore.bestMatchContent = result.content;
          claimScore.bestMatchSource = `fallback:${result.category}`;
        }
      }
    }

    if (claimScore.groundingScore >= GROUNDING_THRESHOLD) {
      claimScore.verified = true;
      validationStats.fallbackVerifications++;
    }
  } catch {
    logger.debug("ResponseValidation: fallback verification failed");
  }

  return claimScore;
}

function buildValidatedResponse(
  original: string,
  quarantined: ClaimScore[],
): string {
  if (quarantined.length === 0) return original;

  let modified = original;

  for (const claim of quarantined) {
    const idx = modified.indexOf(claim.claim.text);
    if (idx === -1) continue;

    if (claim.groundingScore < QUARANTINE_THRESHOLD) {
      modified = modified.slice(0, idx) +
        modified.slice(idx + claim.claim.text.length);
    } else {
      modified = modified.slice(0, idx) +
        `[Unverified] ${claim.claim.text}` +
        modified.slice(idx + claim.claim.text.length);
    }
  }

  modified = modified.replace(/\n{3,}/g, "\n\n").trim();

  return modified;
}

export async function validateResponse(
  response: string,
  userQuery: string,
): Promise<ValidationResult> {
  const startTime = Date.now();
  validationStats.totalValidations++;

  if (isConversationalResponse(response)) {
    return {
      originalResponse: response,
      validatedResponse: response,
      overallGroundingScore: 1.0,
      claims: [],
      quarantinedClaims: [],
      passedClaims: [],
      wasModified: false,
      validationTimeMs: Date.now() - startTime,
      metrics: {
        totalClaims: 0,
        groundedClaims: 0,
        quarantinedCount: 0,
        verifiedViaFallback: 0,
        averageGroundingScore: 1.0,
      },
    };
  }

  const claims = extractClaims(response);

  if (claims.length === 0) {
    return {
      originalResponse: response,
      validatedResponse: response,
      overallGroundingScore: 1.0,
      claims: [],
      quarantinedClaims: [],
      passedClaims: [],
      wasModified: false,
      validationTimeMs: Date.now() - startTime,
      metrics: {
        totalClaims: 0,
        groundedClaims: 0,
        quarantinedCount: 0,
        verifiedViaFallback: 0,
        averageGroundingScore: 1.0,
      },
    };
  }

  const scoredClaims: ClaimScore[] = [];
  const scorePromises = claims.map(claim =>
    Promise.race([
      scoreClaimGrounding(claim),
      new Promise<ClaimScore>(resolve =>
        setTimeout(() => resolve({
          claim,
          groundingScore: 0.3,
          bestMatchContent: "",
          bestMatchSource: "timeout",
          verified: false,
        }), VERIFICATION_TIMEOUT_MS)
      ),
    ])
  );

  const results = await Promise.all(scorePromises);
  scoredClaims.push(...results);

  const quarantined: ClaimScore[] = [];
  const passed: ClaimScore[] = [];

  for (const scored of scoredClaims) {
    if (scored.groundingScore >= GROUNDING_THRESHOLD) {
      passed.push(scored);
    } else {
      quarantined.push(scored);
    }
  }

  const fallbackResults: ClaimScore[] = [];
  const preVerifiedFallback = validationStats.fallbackVerifications;

  for (const claim of quarantined) {
    const verified = await fallbackVerifyClaim(claim);
    if (verified.verified) {
      passed.push(verified);
    } else {
      fallbackResults.push(verified);
    }
  }

  const verifiedViaFallback = validationStats.fallbackVerifications - preVerifiedFallback;

  const allScored = [...passed, ...fallbackResults];
  const avgScore = allScored.length > 0
    ? allScored.reduce((sum, c) => sum + c.groundingScore, 0) / allScored.length
    : 1.0;

  const validatedResponse = buildValidatedResponse(response, fallbackResults);
  const wasModified = validatedResponse !== response;

  validationStats.totalClaims += claims.length;
  validationStats.groundedClaims += passed.length;
  validationStats.quarantinedClaims += fallbackResults.length;
  if (wasModified) validationStats.responsesModified++;
  validationStats.scoreSum += avgScore;
  validationStats.averageGroundingScore =
    validationStats.scoreSum / validationStats.totalValidations;

  const validationTimeMs = Date.now() - startTime;

  logger.info({
    totalClaims: claims.length,
    grounded: passed.length,
    quarantined: fallbackResults.length,
    fallbackVerified: verifiedViaFallback,
    avgGrounding: avgScore.toFixed(3),
    modified: wasModified,
    timeMs: validationTimeMs,
  }, "ResponseValidation: validation complete");

  return {
    originalResponse: response,
    validatedResponse,
    overallGroundingScore: avgScore,
    claims: allScored,
    quarantinedClaims: fallbackResults,
    passedClaims: passed,
    wasModified,
    validationTimeMs,
    metrics: {
      totalClaims: claims.length,
      groundedClaims: passed.length,
      quarantinedCount: fallbackResults.length,
      verifiedViaFallback,
      averageGroundingScore: avgScore,
    },
  };
}

export function getValidationStats() {
  return {
    ...validationStats,
    groundingRate: validationStats.totalClaims > 0
      ? validationStats.groundedClaims / validationStats.totalClaims
      : 1.0,
    quarantineRate: validationStats.totalClaims > 0
      ? validationStats.quarantinedClaims / validationStats.totalClaims
      : 0,
    modificationRate: validationStats.totalValidations > 0
      ? validationStats.responsesModified / validationStats.totalValidations
      : 0,
  };
}

export function resetValidationStats(): void {
  validationStats.totalValidations = 0;
  validationStats.totalClaims = 0;
  validationStats.groundedClaims = 0;
  validationStats.quarantinedClaims = 0;
  validationStats.fallbackVerifications = 0;
  validationStats.responsesModified = 0;
  validationStats.averageGroundingScore = 0;
  validationStats.scoreSum = 0;
}
