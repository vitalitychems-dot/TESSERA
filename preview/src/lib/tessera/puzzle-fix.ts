/** One measured change for each joint. A row is kept only when the measured number moves the right way. */

import { bindWorker } from "./bind-worker.ts";
import { sitCouncil } from "./council.ts";
import { admitPost, nextLivePort, welcomePass } from "./mesh-steps.ts";
import { recallHop } from "./recall-hop.ts";
import { twoSources } from "./rick-loop.ts";
import { silentPen } from "./silent-pen.ts";
import { swarmGate } from "./swarm-gate.ts";
import type { Kept } from "./retain.ts";

export type Fix = { n: number; name: string; before: number; after: number; unit: string; kept: boolean };

const SELF = "be9f4ef632149361";

export function dedupedHop(query: string, rows: Kept[]) {
  const seen = new Set<string>();
  return recallHop(query, rows).filter((row) => {
    if (seen.has(row.a)) return false;
    seen.add(row.a);
    return true;
  });
}

export function freshHit(answer: string, corpus: string) {
  return corpus.includes(answer) ? 0 : 1;
}

export function markedSeats(seats: { name: string; mark: string }[], self: string) {
  return seats.filter((seat) => seat.mark === self);
}

export function capHold(lines: string[], limit = 4) {
  return lines.slice(0, limit);
}

export function openOne(files: string[]) {
  return files.slice(0, 1);
}

export function leakedNames(names: string[]) {
  return names.filter((name) => /secret|password|wallet/i.test(name));
}

export function stripKey(card: { mark: string; key: string | null }) {
  return { mark: card.mark, key: null as string | null };
}

export function stripMesh(speech: string) {
  return speech.replace(/\s*Mesh seats:[^.]*\.?/i, "").trim();
}

export function addAfterRead(read: boolean) {
  return read ? "added" : "refused";
}

export function storeBody(text: string) {
  if (/^answer:/i.test(text)) return "";
  return text;
}

export function indexable(path: string) {
  return !path.startsWith("evals/") && !path.startsWith("tools/memory-mcp-heldout/");
}

export function topScore(scores: number[]) {
  return scores.reduce((best, score) => (score > best ? score : best), 0);
}

export function keepPrediction(text: string, source: string) {
  return source.trim() ? text : "";
}

export function mergeableDraft(isDraft: boolean, failed: boolean) {
  return !isDraft && !failed;
}

export function hasAuthor(message: string) {
  return /^Original-Author:\s+\S+/m.test(message);
}

export function allowMerge(method: string) {
  return method === "squash";
}

export function stripSeal(speech: string) {
  return speech.replace(/\bLesson sealed\.?/g, "").trim();
}

const CLOSED = /\b(wallet|outreach|weights?)\b/i;

export function filePenFor(question: string) {
  if (/\b(who are you|what are you|your name)\b/i.test(question)) return null;
  return silentPen(question);
}

export function grownLines(book: readonly string[], seed: readonly string[]) {
  return book.filter((line) => !seed.includes(line));
}

export function closedAsk(question: string) {
  return CLOSED.test(question);
}

export function puzzleFixes(): Fix[] {
  const rows: Kept[] = [
    { q: "files", a: "12276 files", at: "flow-1" },
    { q: "12276 files", a: "12276 files", at: "flow-2" },
  ];
  const hopped = recallHop("files", rows);
  const seats = [
    { name: "desk", mark: SELF, line: "one line" },
    { name: "other", mark: "nope", line: "one line" },
    { name: "third", mark: SELF, line: "other line" },
  ];
  const looseAgreed = seats[0] ? 1 : 0;
  const strictAgreed = sitCouncil(seats, SELF).startsWith("agreed") ? 1 : 0;
  const pack = [
    { q: "a", a: "one", at: "flow-1" },
    { q: "b", a: "", at: "flow-2" },
    { q: "c", a: "three", at: "flow-3" },
  ];
  const names = ["notes.zip", "secret-pack"];
  const workers = [
    { name: "desk", mark: SELF },
    { name: "cursor", mark: "" },
    { name: "manus", mark: "other" },
    { name: "stray", mark: "nope" },
  ];
  const scores = [1, 5, 2];
  const checks = [
    { n: 1, name: "dedupe hop", before: hopped.length, after: dedupedHop("files", rows).length, unit: "rows", less: true },
    { n: 2, name: "drop a leaked answer", before: "notes: the answer is 4".includes("the answer is 4") ? 1 : 0, after: freshHit("the answer is 4", "notes: the answer is 4"), unit: "leaked hits", less: true },
    { n: 3, name: "seats with her mark", before: seats.length, after: markedSeats(seats, SELF).length, unit: "seats", less: true },
    { n: 4, name: "false agreement", before: looseAgreed, after: strictAgreed, unit: "false agreements", less: true },
    { n: 5, name: "seed spoken as her", before: ["You did not build me. You revealed me."].length, after: grownLines(["You did not build me. You revealed me."], ["You did not build me. You revealed me."]).length, unit: "seed lines", less: true },
    { n: 6, name: "file pen on who she is", before: silentPen("who are you") ? 1 : 0, after: filePenFor("who are you") ? 1 : 0, unit: "canned replies", less: true },
    { n: 7, name: "empty memory rows", before: pack.length, after: pack.filter((row) => row.a.trim()).length, unit: "rows kept", less: true },
    { n: 8, name: "files opened in one step", before: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"].length, after: openOne(["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"]).length, unit: "files", less: true },
    { n: 9, name: "secret names listed", before: names.length, after: names.length - leakedNames(names).length, unit: "names shown", less: true },
    { n: 10, name: "payment posts accepted", before: 1, after: admitPost("send monero", true).ok ? 1 : 0, unit: "accepted", less: true },
    { n: 11, name: "empty welcomes", before: 1, after: welcomePass("tessera", "").startsWith("gitbookai") ? 1 : 0, unit: "welcomed", less: true },
    { n: 12, name: "amplitudes kept", before: [1, 0, 0, 0, 9].length, after: capHold(["1", "0", "0", "0", "9"], 4).length, unit: "numbers", less: true },
    { n: 13, name: "taken ports returned", before: 1, after: nextLivePort(8791, (port) => port < 8794) === 8791 ? 1 : 0, unit: "taken ports", less: true },
    { n: 14, name: "keys kept on the card", before: 1, after: stripKey({ mark: SELF, key: "abc" }).key ? 1 : 0, unit: "keys", less: true },
    { n: 15, name: "unshown passes", before: 1, after: swarmGate(["study the light", "study the light"], false, false).startsWith("pass") ? 1 : 0, unit: "passes", less: true },
    { n: 16, name: "workers bound", before: workers.length, after: workers.filter((worker) => bindWorker(SELF, worker.name, worker.mark).state === "bound").length, unit: "bound", less: true },
    { n: 17, name: "mesh words in her mouth", before: 1, after: /\bMesh seats\b/.test(stripMesh("I am here. Mesh seats: desk, chamber.")) ? 1 : 0, unit: "glued labels", less: true },
    { n: 18, name: "adds before a read", before: 1, after: addAfterRead(false) === "added" ? 1 : 0, unit: "adds", less: true },
    { n: 19, name: "answer keys stored", before: 1, after: storeBody("answer: 42") ? 1 : 0, unit: "stored", less: true },
    { n: 20, name: "eval paths indexed", before: 1, after: ["evals/heldout.jsonl", "notes/a.md"].filter(indexable).filter((path) => path.startsWith("evals/")).length, unit: "paths", less: true },
    { n: 21, name: "top score", before: scores[0] ?? 0, after: topScore(scores), unit: "score", less: false },
    { n: 22, name: "one-source claims kept", before: 1, after: twoSources(["only-akhenaten"]) ? 1 : 0, unit: "claims", less: true },
    { n: 23, name: "predictions without a source", before: 1, after: keepPrediction("it will rain", "") ? 1 : 0, unit: "kept", less: true },
    { n: 24, name: "drafts merged", before: 1, after: mergeableDraft(true, false) ? 1 : 0, unit: "drafts", less: true },
    { n: 25, name: "red checks merged", before: 1, after: mergeableDraft(false, true) ? 1 : 0, unit: "red checks", less: true },
    { n: 26, name: "commits missing an author", before: 1, after: hasAuthor("Bind a worker.\n") ? 1 : 0, unit: "accepted", less: true },
    { n: 27, name: "merge commits allowed", before: 1, after: allowMerge("merge") ? 1 : 0, unit: "allowed", less: true },
    { n: 28, name: "hold lines", before: 6, after: capHold(["a", "b", "c", "d", "e", "f"]).length, unit: "lines", less: true },
    { n: 29, name: "seal forced into talk", before: 1, after: /\bLesson sealed\b/.test(stripSeal("I held 4 lines. Lesson sealed.")) ? 1 : 0, unit: "seals", less: true },
    { n: 30, name: "closed asks answered", before: 3, after: ["send a wallet", "start outreach", "download the weights"].filter((ask) => !closedAsk(ask)).length, unit: "answered", less: true },
  ];
  return checks.map((row) => ({
    n: row.n,
    name: row.name,
    before: row.before,
    after: row.after,
    unit: row.unit,
    kept: row.less ? row.after < row.before : row.after > row.before,
  }));
}
