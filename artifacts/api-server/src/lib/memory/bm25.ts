import { tokenize } from "./text";

const K1 = 1.2;
const B = 0.75;

export interface Bm25Document {
  id: string;
  text: string;
}

/**
 * Okapi BM25 over the supplied documents. Local term statistics only.
 * No embedding model and no network call.
 */
export function scoreBm25(documents: Bm25Document[], query: string): Map<string, number> {
  const tokenized = documents.map((document) => ({ id: document.id, terms: tokenize(document.text) }));
  const averageLength = tokenized.reduce((sum, document) => sum + document.terms.length, 0) / Math.max(tokenized.length, 1);
  const documentFrequency = new Map<string, number>();
  for (const document of tokenized) {
    for (const term of new Set(document.terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const total = tokenized.length;
  const queryTerms = tokenize(query);
  const scores = new Map<string, number>();
  for (const document of tokenized) {
    const frequency = new Map<string, number>();
    for (const term of document.terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const seen = frequency.get(term) ?? 0;
      if (seen === 0) continue;
      const docsWithTerm = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
      const denominator = seen + K1 * (1 - B + B * (document.terms.length / Math.max(averageLength, 1)));
      score += idf * ((seen * (K1 + 1)) / denominator);
    }
    scores.set(document.id, score);
  }
  return scores;
}
