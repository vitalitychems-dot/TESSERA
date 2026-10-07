const CURIOUS_SKIP = /^(the|while|one|his|her|this|that|when|after|from|with|into|over|under)$/i;

export function nextCuriousQuery(notes: { query: string; text: string }[]): string | null {
  const asked = notes.map((note) => note.query.toLowerCase());
  const newestFirst = [...notes].reverse();
  for (const note of newestFirst) {
    const phrases = note.text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? [];
    for (const phrase of phrases) {
      const key = phrase.toLowerCase();
      if (CURIOUS_SKIP.test(phrase.split(" ")[0] ?? "")) continue;
      if (asked.some((item) => item === key || item.includes(key) || key.includes(item))) continue;
      if (phrase.length < 8) continue;
      return phrase;
    }
  }
  return null;
}