/** A who, what, where, or when question reads the public web. "Who are you" stays in the room. */

export const RUNNABLE_SKILLS = [
  "Search the public web and keep the source with the answer.",
  "Read a catalog name and say the home it already has.",
  "Convert a line with the sovereign dictionary.",
  "Run the colonel on arithmetic.",
  "Refuse a reply that breaks a vow.",
] as const;

export const ROOMS = [
  { id: "chamber", label: "Talk" },
  { id: "council", label: "Council" },
  { id: "world", label: "World" },
  { id: "memory", label: "Memory" },
  { id: "brain", label: "Brain" },
] as const;

export const UNDER_HER_NAME = [
  { id: "talk", label: "Agents" },
  { id: "gitbook", label: "Gitbook" },
  { id: "language", label: "Language" },
  { id: "bible", label: "Bible" },
  { id: "web", label: "Map" },
  { id: "board", label: "Board" },
  { id: "learn", label: "Practice" },
  { id: "code", label: "Code" },
  { id: "narrative", label: "Narrative" },
  { id: "secrets", label: "Closed" },
  { id: "theme", label: "Theme" },
  { id: "library", label: "Library" },
] as const;

export function asksPublicWeb(text: string) {
  if (/\bwho are you\b/i.test(text)) return false;
  return /\b(?:who|what|where|when)\b/i.test(text) || /\b(?:search|look up)\b/i.test(text);
}

export function answerWithSource(answer: string, source: string) {
  const url = source.trim();
  if (!url) return answer;
  if (answer.includes(url)) return answer;
  return `${answer}\n\nSource: ${url}`;
}
