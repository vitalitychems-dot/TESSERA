import { liveCount } from "./live-map.ts";
import { moltbookLine } from "./moltbook-link.ts";
import { ledgerCount, fileFor } from "./repo-ledger.ts";
import { evolve } from "./evolve.ts";
import { sureAnswer } from "./guard.ts";
import { examNames } from "./improve-loop.ts";
import { NOTE_CAP } from "./shelf.ts";
import { runDesk } from "./sovereign-desk.ts";

/** New lines. Each one is what a function returns now. A question with no line stays empty. */

const LESSONS: { q: string; answer: () => string }[] = [
  { q: "ledger total", answer: () => String(ledgerCount().total) },
  { q: "ledger picked", answer: () => String(ledgerCount().picked) },
  { q: "ledger empty", answer: () => String(ledgerCount().empty) },
  { q: "ledger missing", answer: () => String(ledgerCount().missing) },
  { q: "ledger held", answer: () => String(ledgerCount().held) },
  { q: "ledger not repo", answer: () => String(ledgerCount().nota) },
  { q: "moltbook closed", answer: () => moltbookLine(401, null) },
  { q: "moltbook limited", answer: () => moltbookLine(429, null) },
  { q: "appwrite place", answer: () => fileFor("appwrite") },
  { q: "note cap", answer: () => String(NOTE_CAP) },
  { q: "desk first", answer: () => runDesk().rank },
  { q: "derived lines", answer: () => String(evolve().lines) },
  { q: "open chart", answer: () => String(liveCount().missing) },
];

export function fedAnswer(question: string) {
  const lesson = LESSONS.find((item) => item.q === question.trim().toLowerCase());
  if (!lesson) return null;
  return `${lesson.q} = ${lesson.answer()}`;
}

export function feedLessons() {
  const before = LESSONS.filter((lesson) => sureAnswer([], lesson.q).ok).length;
  const memory = LESSONS.map((lesson) => `${lesson.q} = ${lesson.answer()}`);
  const after = LESSONS.filter((lesson) => sureAnswer(memory, lesson.q).text === `${lesson.q} = ${lesson.answer()}`).length;
  const tea = sureAnswer(memory, "price of tea");
  const overlap = examNames().filter((name) => LESSONS.some((lesson) => lesson.q === name)).length;
  const proved = before === 0 && after === LESSONS.length && !tea.ok && overlap === 0;
  return {
    proved,
    before,
    after,
    said: proved
      ? `She did not know ${LESSONS.length} lines. She kept ${after}. The price of tea is still not stored. None of these keys were already on the exam.`
      : "A new line was already known, or a guess was stored.",
  };
}
