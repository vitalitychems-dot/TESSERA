import { recallLearned } from "./recursive-train.ts";

/** A topic is learnable only when a local fact exists. An empty fact is skipped. */

type Topic = { category: string; q: string; fact: string; local: boolean };

const SHELF: readonly Topic[] = [
  { category: "people", q: "who founded the academy", fact: "Plato founded the Academy in Athens.", local: true },
  { category: "routes", q: "which module answers", fact: "The first mounted module answers.", local: true },
  { category: "boundary", q: "where is the storefront", fact: "The storefront stays out of Tessera.", local: true },
  { category: "files", q: "how many root files", fact: "81 of 272 names have a small file at the root.", local: true },
  { category: "mark", q: "what is the sigil", fact: "The sigil is 7F3A9C.", local: true },
  { category: "screen", q: "which screen flow", fact: "", local: false },
  { category: "media", q: "which media was reviewed", fact: "", local: false },
];

export function pickNext(memory: readonly string[]) {
  return SHELF.find((topic) => topic.local && topic.fact.length > 0 && !recallLearned([...memory], topic.q).includes(topic.fact)) ?? null;
}

export function curiosityPath() {
  const memory: string[] = [];
  const path: { category: string; fact: string }[] = [];
  for (;;) {
    const next = pickNext(memory);
    if (!next) break;
    path.push({ category: next.category, fact: next.fact });
    memory.push(`LESSON: ${next.fact}`);
  }
  const known = SHELF.filter((topic) => topic.local && recallLearned(memory, topic.q).includes(topic.fact)).length;
  const skipped = SHELF.filter((topic) => !topic.local).map((topic) => topic.category);
  return { path, known, skipped };
}
