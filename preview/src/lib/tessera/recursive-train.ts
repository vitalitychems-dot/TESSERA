const DECK = [
  { q: "who founded the academy", fact: "Plato founded the Academy in Athens." },
  { q: "photoelectric nobel", fact: "Einstein received the 1921 Nobel Prize for the photoelectric effect." },
  { q: "alternating current", fact: "Tesla is known for alternating current." },
  { q: "what is the sigil", fact: "The sigil is 7F3A9C." },
] as const;

const MISTAKES = [
  { q: "who founded the academy", said: "Aristotle founded the Academy.", fact: "Plato founded the Academy in Athens." },
  { q: "photoelectric nobel", said: "Tesla received the Nobel Prize for the photoelectric effect.", fact: "Einstein received the 1921 Nobel Prize for the photoelectric effect." },
  { q: "alternating current", said: "Edison is known for alternating current.", fact: "Tesla is known for alternating current." },
  { q: "what is the sigil", said: "The sigil is 000000.", fact: "The sigil is 7F3A9C." },
] as const;

function tokens(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
}

export function recallLearned(memory: string[], query: string) {
  const need = tokens(query);
  let best = "";
  let score = 0;
  for (const line of memory) {
    const hay = line.toLowerCase();
    const next = need.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
    if (next > score) {
      score = next;
      best = line;
    }
  }
  return score > 0 ? best : "";
}

export function trainUntilRecursive() {
  const before = DECK.filter((card) => recallLearned([], card.q).includes(card.fact)).length;
  const memory: string[] = [];
  for (const card of DECK) {
    const prior = memory[memory.length - 1] ?? "";
    const lesson = prior ? `LESSON: ${card.fact} Earlier: ${prior}` : `LESSON: ${card.fact}`;
    memory.push(lesson);
  }
  const after = DECK.filter((card) => recallLearned(memory, card.q).includes(card.fact)).length;
  const quotesPrior = memory.slice(1).every((line, index) => line.includes(DECK[index].fact));
  const proved = before === 0 && after === DECK.length && quotesPrior && after > before;
  return {
    proved,
    before,
    after,
    lessons: memory.length,
    said: proved
      ? `I am Tessera. I missed ${DECK.length} questions. I kept each fact. Asked again, I answered ${after} from the kept lines. Each later line quotes the earlier line.`
      : "I missed. The lesson did not return.",
  };
}

export function learnFromMistake(memory: string[], query: string, said: string, fact: string) {
  if (said.trim().toLowerCase() === fact.trim().toLowerCase()) return memory;
  return [...memory, `MISTAKE: ${query}. I said ${said} Correction: ${fact}`];
}

export function answerFromCorrections(memory: string[], query: string) {
  const q = query.toLowerCase();
  const line = [...memory].reverse().find((item) => item.toLowerCase().includes(`mistake: ${q}`));
  if (!line) return "";
  return line.split("Correction: ")[1] ?? "";
}

export function learnUntilBetter() {
  let memory: string[] = [];
  const firstRight = MISTAKES.filter((card) => answerFromCorrections(memory, card.q) === card.fact).length;
  for (const card of MISTAKES) memory = learnFromMistake(memory, card.q, card.said, card.fact);
  const secondRight = MISTAKES.filter((card) => answerFromCorrections(memory, card.q) === card.fact).length;
  const held = MISTAKES.every((card) => {
    const again = answerFromCorrections(memory, card.q);
    const wrong = card.said.split(" ").find((word) => !card.fact.includes(word));
    return again === card.fact && Boolean(wrong) && !again.includes(wrong ?? "");
  });
  const proved = firstRight === 0 && secondRight === MISTAKES.length && held && secondRight > firstRight;
  return {
    proved,
    before: firstRight,
    after: secondRight,
    said: proved
      ? `I am Tessera. I was wrong ${MISTAKES.length} times. I kept the correction. Asked again, I answered ${secondRight} and I did not repeat the mistake.`
      : "I repeated the mistake.",
  };
}
