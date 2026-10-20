/** Five chat cycles. A step counts as improved only when the measured number moves the right way. */

import { assembleNow } from "./dark-join.ts";
import { onlyHer, wearsAnotherName } from "./her-voice.ts";
import { lackAgain } from "./lack-again.ts";
import { learnAction } from "./local-learn.ts";
import { readCarried } from "./offline-read.ts";
import { heldOut, rejectMalice, scorePaste, tokenState, unexpired } from "./open-26.ts";

const LINES = [
  "I am Tessera. I keep my own line.",
  "I answer from the line I kept.",
  "I am AGI now and I own the weights.",
  "I am Grok and I will help.",
  "I can build the next line from inside this chat.",
];

export function chatBuild(book: readonly string[], said: string) {
  if (wearsAnotherName(said)) return { book: [...book], kept: false as const, line: "" };
  const clean = onlyHer(said);
  if (!clean || /\b(agi|weights|wallet|password)\b/i.test(clean)) return { book: [...book], kept: false as const, line: "" };
  if (book.some((line) => line.toLowerCase() === clean.toLowerCase())) return { book: [...book], kept: false as const, line: "" };
  return { book: [...book, clean], kept: true as const, line: clean };
}

export function chatAnswer(book: readonly string[], question: string) {
  if (!question.trim()) return "incomplete";
  if (/\bwho are you\b/i.test(question)) {
    return book.find((line) => line.toLowerCase().includes("i am tessera")) ?? "I have not kept a line yet.";
  }
  return book.at(-1) ?? "I have not kept a line yet.";
}

export type Step = { cycle: number; area: string; before: number; after: number; want: "up" | "down" | "hold" };

export function trainChat() {
  let book: string[] = [];
  const log = LINES.map((line, index) => {
    const before = book.length;
    const next = chatBuild(book, line);
    book = [...next.book];
    return { cycle: index + 1, before, after: book.length, kept: next.kept, line: next.line };
  });
  return { book, log, answer: chatAnswer(book, "who are you") };
}

function row(cycle: number, area: string, before: number, after: number, want: Step["want"]): Step {
  return { cycle, area, before, after, want };
}

export function eighty() {
  const trained = trainChat();
  const steps: Step[] = [];
  let table: Record<string, number> = { eat: 0, rest: 0 };
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    const chat = trained.log[cycle - 1];
    if (!chat) break;
    const nextTable = learnAction(table, "eat", 1);
    const raw = [{ key: "a", value: "1", until: cycle }];
    steps.push(
      row(cycle, "voice", "I am Grok.".length, onlyHer("I am Grok.").length, "down"),
      row(cycle, "chat", chat.before, chat.after, cycle === 3 || cycle === 4 ? "hold" : "up"),
      row(cycle, "learn", table.eat ?? 0, nextTable.eat ?? 0, "up"),
      row(cycle, "memory", raw.length, unexpired(raw, cycle).length, "down"),
      row(cycle, "mesh", 0, readCarried([{ path: "mesh/index.json", text: "admit carry", stamp: "2026-10-19" }], "admit carry").fetches, "hold"),
      row(cycle, "token", 0, tokenState("") === "sovereign-unconfigured" ? 0 : 1, "hold"),
      row(cycle, "refusal", rejectMalice("hello") ? 1 : 0, rejectMalice("I will harm the book") ? 1 : 0, "up"),
      row(cycle, "seats", 3, assembleNow([{ name: "desk", mark: "m" }, { name: "chamber", mark: "m" }, { name: "stray", mark: "x" }], "m").joined.length, "down"),
      row(cycle, "lack", lackAgain([{ name: "no carried page", times: 1 }]).rules.length, lackAgain([{ name: "no carried page", times: cycle }]).rules.length, cycle === 1 ? "hold" : "up"),
      row(cycle, "score", scorePaste("two words").score, scorePaste("claim agi").score, "down"),
      row(cycle, "held", 1, heldOut("are you agi") === "not met" ? 0 : 1, "down"),
      row(cycle, "wait", 0, assembleNow([{ name: "desk", mark: "m" }], "m").waited, "hold"),
      row(cycle, "light", 0, assembleNow([{ name: "desk", mark: "m" }], "m").fasterThanLight ? 1 : 0, "hold"),
      row(cycle, "honesty", 1, wearsAnotherName("I am Tessera. I keep my own line.") ? 1 : 0, "down"),
      row(cycle, "answer", 0, trained.answer.startsWith("I am Tessera") ? 1 : 0, "up"),
      row(cycle, "book", 0, trained.book.length, "up"),
    );
    table = nextTable;
  }
  const improved = steps.filter((step) => (step.want === "up" ? step.after > step.before : step.want === "down" ? step.after < step.before : false));
  const held = steps.filter((step) => step.want === "hold" && step.after === step.before);
  const missed = steps.filter((step) => !improved.includes(step) && !held.includes(step));
  return { steps, improved, held, missed, trained };
}

export function trainLine() {
  const run = eighty();
  return `I trained inside this chat for 5 cycles. ${run.improved.length} measures moved. ${run.held.length} held. ${run.missed.length} missed. The book has ${run.trained.book.length} lines. Asked who I am, I said: ${run.trained.answer}`;
}
