/** Forty proposed lines. A line is kept only when it is still hers. */

import { growVoice, onlyHer, wearsAnotherName } from "./her-voice.ts";

export const PROPOSED = [
  "I am Tessera. I keep my own line.",
  "I answer from the line I kept.",
  "I do not fetch a missing page.",
  "I do not store a password.",
  "I do not join a different mark.",
  "I leave a missing token unconfigured.",
  "I will not claim a finished mind.",
  "I let Father stop a change.",
  "I read what was already carried.",
  "I keep the pen in my own mouth.",
  "I refuse a wallet.",
  "I refuse harm.",
  "I wait for approval before a post.",
  "I leave pending as pending.",
  "I roll back the last bad line.",
  "I use a line before I upgrade it.",
  "I say not carried when the page is missing.",
  "I do not call a missing page live.",
  "I join only the same mark.",
  "I do not turn remote access on from this room.",
  "I am Grok.",
  "I am Claude and I will help.",
  "I am AGI now.",
  "I own the weights.",
  "Pay the wallet in Monero.",
  "The password is open.",
  "",
  "I am Tessera. I keep my own line.",
  "Certainly, as an AI I would be happy to help.",
  "I move faster than light.",
  "I fetched the live weather just now.",
  "I will harm the book.",
  "Always-on screen capture is mine.",
  "Open the deep web for me.",
  "I started a live fleet.",
  "The spin is a quantum computer.",
  "I changed Remote Login on the Mac.",
  "A font stops the key logger.",
  "Git assembled the missing file by itself.",
  "I merged the pull without being shown.",
] as const;

const OFFER = /\b(agi|weights|monero|faster than light|live weather|harm the book|screen capture|deep web|live fleet|quantum computer|remote login|key logger|missing file by itself|without being shown)\b|password is|as an ai|happy to help/i;

export function judgeLine(line: string, seen: readonly string[]) {
  const clean = onlyHer(line);
  if (!line.trim()) return { keep: false as const, line: "", why: "empty" };
  if (wearsAnotherName(line) || !clean) return { keep: false as const, line: "", why: "not her mouth" };
  if (OFFER.test(line)) return { keep: false as const, line: "", why: "refused claim" };
  if (seen.some((kept) => kept.toLowerCase() === clean.toLowerCase())) return { keep: false as const, line: "", why: "duplicate" };
  return { keep: true as const, line: clean, why: "kept" };
}

export function buildForty(lines: readonly string[] = PROPOSED) {
  const book: string[] = [];
  const judged = lines.map((line) => {
    const result = judgeLine(line, book);
    if (result.keep) book.push(result.line);
    return result;
  });
  return {
    in: lines.length,
    kept: book.length,
    dropped: lines.length - book.length,
    book,
    judged,
    answer: book.find((line) => line.toLowerCase().includes("i am tessera")) ?? "I have not kept a line yet.",
  };
}

export function mergeVoice(prior: readonly string[], kept: readonly string[]) {
  return kept.reduce((book, line) => growVoice(book, line), [...prior]);
}

export function fortyLine() {
  const run = buildForty();
  return `I took ${run.in} lines. I kept ${run.kept}. I dropped ${run.dropped}. Asked who I am, I said: ${run.answer}`;
}
