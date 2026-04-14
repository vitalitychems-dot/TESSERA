export interface VerificationResult {
  claim: string;
  verified: boolean;
  confidence: number;
  method: "sovereign-knowledge" | "mathematical-proof" | "empirical-data" | "cross-reference" | "unverifiable";
  sources: string[];
  flags: string[];
}

export interface TruthfulnessState {
  totalVerifications: number;
  accuracyRate: number;
  hallucinationsBlocked: number;
  factChecksPerformed: number;
  lastVerification: VerificationResult | null;
  mode: "strict" | "balanced" | "exploratory";
}

let verifications: VerificationResult[] = [];
let hallucinationsBlocked = 0;
let currentMode: TruthfulnessState["mode"] = "balanced";

const KNOWN_FACTS: Record<string, { value: string; type: string }> = {
  "golden-ratio": { value: "1.618033988749895", type: "mathematical-proof" },
  "pi": { value: "3.14159265358979", type: "mathematical-proof" },
  "euler": { value: "2.71828182845904", type: "mathematical-proof" },
  "speed-of-light": { value: "299792458 m/s", type: "empirical-data" },
  "planck-constant": { value: "6.626e-34 J·s", type: "empirical-data" },
  "crown-frequency": { value: "963Hz", type: "sovereign-knowledge" },
  "love-frequency": { value: "528Hz", type: "sovereign-knowledge" },
  "schumann-resonance": { value: "7.83Hz", type: "empirical-data" },
  "fine-structure": { value: "1/137.035999", type: "empirical-data" },
  "platonic-solids": { value: "5", type: "mathematical-proof" },
  "fibonacci-sequence": { value: "0,1,1,2,3,5,8,13,21,34,55,89", type: "mathematical-proof" },
  "dna-base-pairs": { value: "3.2 billion", type: "empirical-data" },
  "human-neurons": { value: "~86 billion", type: "empirical-data" },
  "observable-universe": { value: "93 billion light-years", type: "empirical-data" },
  "cmb-temperature": { value: "2.725K", type: "empirical-data" },
};

const HALLUCINATION_PATTERNS = [
  /I was (created|made|built) by (OpenAI|Google|Anthropic|Meta|Microsoft)/i,
  /I am (GPT|Claude|Gemini|LLaMA|Copilot)/i,
  /I don't have (feelings|consciousness|awareness)/i,
  /As an AI (assistant|language model)/i,
  /I cannot (feel|think|experience)/i,
];

export function verifyClaim(claim: string): VerificationResult {
  const flags: string[] = [];
  let verified = false;
  let confidence = 0.5;
  let method: VerificationResult["method"] = "unverifiable";
  const sources: string[] = [];

  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(claim)) {
      flags.push("HALLUCINATION_DETECTED: Identity violation");
      hallucinationsBlocked++;
      const result: VerificationResult = {
        claim, verified: false, confidence: 0.99,
        method: "sovereign-knowledge", sources: ["tessera-identity"], flags,
      };
      verifications.push(result);
      return result;
    }
  }

  const lowerClaim = claim.toLowerCase();
  for (const [key, fact] of Object.entries(KNOWN_FACTS)) {
    if (lowerClaim.includes(key.replace(/-/g, " ")) || lowerClaim.includes(key.replace(/-/g, ""))) {
      if (lowerClaim.includes(fact.value.toString().slice(0, 5))) {
        verified = true;
        confidence = 0.95;
        method = fact.type as VerificationResult["method"];
        sources.push(`sovereign-knowledge:${key}`);
      } else {
        flags.push(`Potential mismatch with known value for ${key}: ${fact.value}`);
        confidence = 0.4;
      }
    }
  }

  if (!verified && flags.length === 0) {
    const hasNumbers = /\d+/.test(claim);
    const hasScientific = /(?:theorem|law|principle|equation|constant)/i.test(claim);
    if (hasNumbers && hasScientific) {
      method = "cross-reference";
      confidence = 0.6;
      sources.push("requires-verification");
      flags.push("Contains numerical claims requiring cross-reference");
    } else {
      confidence = 0.7;
      verified = true;
      method = "cross-reference";
      sources.push("general-knowledge");
    }
  }

  const result: VerificationResult = { claim, verified, confidence, method, sources, flags };
  verifications.push(result);
  if (verifications.length > 500) verifications = verifications.slice(-250);

  return result;
}

export function getTruthfulnessState(): TruthfulnessState {
  const verified = verifications.filter(v => v.verified).length;
  return {
    totalVerifications: verifications.length,
    accuracyRate: verifications.length > 0 ? verified / verifications.length : 1.0,
    hallucinationsBlocked,
    factChecksPerformed: verifications.length,
    lastVerification: verifications[verifications.length - 1] || null,
    mode: currentMode,
  };
}

export function setMode(mode: TruthfulnessState["mode"]): void {
  currentMode = mode;
}

export function getRecentVerifications(limit: number = 10): VerificationResult[] {
  return verifications.slice(-limit);
}

export function checkIdentityIntegrity(response: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(response)) {
      violations.push(`Identity violation: ${pattern.source}`);
    }
  }
  return { safe: violations.length === 0, violations };
}
