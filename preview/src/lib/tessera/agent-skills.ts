import { recognizeEmpathy } from "./empath.ts";

export function planNext(done: string[], titles: string[]) {
  const seen = new Set(done.map((item) => item.toLowerCase()));
  return titles.find((title) => title.trim() && !seen.has(title.toLowerCase())) ?? "none left";
}

export function sortNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function firstSentence(text: string) {
  const sentence = text.replace(/\s+/g, " ").trim().match(/^.*?[.!?](?:\s|$)/);
  return (sentence?.[0] ?? text).trim();
}

export function noticeSkill(text: string) {
  const hits = recognizeEmpathy(text);
  if (!hits.length) return "No pattern.";
  return hits.map((hit) => `${hit.label}: ${hit.next}`).join(" ");
}
