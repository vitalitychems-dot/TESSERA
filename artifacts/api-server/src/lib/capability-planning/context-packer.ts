export interface ContextCandidate {
  id: string;
  source: string;
  relevance: number;
  indexText: string;
  excerptText: string;
  fullText?: string;
}

export interface PackedContextItem {
  id: string;
  source: string;
  level: "index" | "excerpt" | "full";
  text: string;
  estimatedTokens: number;
}

export interface PackedContext {
  included: PackedContextItem[];
  omittedIds: string[];
  estimatedTokens: number;
  budgetTokens: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function packProgressiveContext(
  candidates: ContextCandidate[],
  budgetTokens: number,
): PackedContext {
  if (!Number.isInteger(budgetTokens) || budgetTokens < 0) {
    throw new Error("budgetTokens must be a non-negative integer.");
  }
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id.trim() || !candidate.source.trim()) {
      throw new Error("Every context candidate needs an id and source reference.");
    }
    if (ids.has(candidate.id)) throw new Error(`Duplicate context id: ${candidate.id}.`);
    if (!Number.isFinite(candidate.relevance)) throw new Error(`Invalid relevance for ${candidate.id}.`);
    ids.add(candidate.id);
  }

  const ordered = [...candidates].sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id));
  const included = new Map<string, PackedContextItem>();
  let estimatedTokens = 0;

  const tryLevel = (candidate: ContextCandidate, level: PackedContextItem["level"], text: string) => {
    const nextTokens = estimateTokens(text);
    const current = included.get(candidate.id);
    const delta = nextTokens - (current?.estimatedTokens ?? 0);
    if (delta <= budgetTokens - estimatedTokens) {
      estimatedTokens += delta;
      included.set(candidate.id, {
        id: candidate.id,
        source: candidate.source,
        level,
        text,
        estimatedTokens: nextTokens,
      });
    }
  };

  for (const candidate of ordered) tryLevel(candidate, "index", candidate.indexText);
  for (const candidate of ordered) {
    if (included.has(candidate.id)) tryLevel(candidate, "excerpt", candidate.excerptText);
  }
  for (const candidate of ordered) {
    if (included.has(candidate.id) && candidate.fullText) tryLevel(candidate, "full", candidate.fullText);
  }

  const includedItems = ordered.flatMap(candidate => {
    const item = included.get(candidate.id);
    return item ? [item] : [];
  });
  return {
    included: includedItems,
    omittedIds: ordered.filter(candidate => !included.has(candidate.id)).map(candidate => candidate.id),
    estimatedTokens,
    budgetTokens,
  };
}
