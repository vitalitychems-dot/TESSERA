const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "over", "how", "are", "was",
  "were", "been", "being", "before", "after", "anyone", "them", "they", "you", "your", "our",
  "not", "but", "can", "could", "should", "would", "about", "what", "when", "where", "which",
  "who", "why", "has", "have", "had", "does", "did", "get", "got", "its", "via", "per", "than",
  "then", "also", "only", "just", "all", "any", "each", "use", "used", "using", "within",
  "without", "across", "example", "pattern",
]);

export function tokenize(text: string): string[] {
  const matched = text.toLowerCase().match(/[a-z0-9]+/g);
  if (!matched) return [];
  return matched.filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}
