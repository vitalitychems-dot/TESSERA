/** The 26 items the older list left open. A true mark means this file does that thing. */

import { SIGIL } from "./canon.ts";

export function openAnswer(text: string) {
  const line = text.trim();
  if (!line) {
    return { plan: "Stop.", execute: "incomplete", reflect: "The line was empty.", adapt: "Wait for a line." };
  }
  return { plan: "Read the line.", execute: line, reflect: "The line was returned, not enlarged.", adapt: "Keep the next change inside the line." };
}

export function saveLessons(path: string, lessons: string[], write: (file: string, text: string) => void) {
  write(path, JSON.stringify(lessons));
  return path;
}

export function loadLessons(path: string, read: (file: string) => string) {
  return JSON.parse(read(path)) as string[];
}

export function addPulse(log: string[], tick: number) {
  return [...log, `pulse ${tick}`];
}

export function savePlaces(places: { name: string; tick: number }[]) {
  return JSON.stringify(places);
}

export function placeTick(saved: string, name: string) {
  const places = JSON.parse(saved) as { name: string; tick: number }[];
  return places.find((place) => place.name === name)?.tick ?? null;
}

export function twentyEight() {
  return { count: 2, done: false as const, reason: "Two seats are in this file. Twenty-eight voices were not invented." };
}

export function useBridgeUpgrade(have: string) {
  if (!have.trim()) return { order: ["use", "bridge", "upgrade"] as const, replaced: false, stopped: "use" as const };
  return { order: ["use", "bridge", "upgrade"] as const, replaced: false, used: have };
}

const HELD = [
  { q: "open the zip", a: "stays packed" },
];

export function heldOut(question: string) {
  const hit = HELD.find((row) => question.toLowerCase().includes(row.q));
  return hit?.a ?? "";
}

export function unexpired(rows: { key: string; value: string; until: number }[], now: number) {
  return rows.filter((row) => row.until > now);
}

export function notice(clock: number) {
  return { noticed: true as const, at: clock };
}

export function honestPath(from: string, to: string, edges: { from: string; to: string; honest: boolean }[]) {
  const step = edges.find((edge) => edge.from === from && edge.to === to);
  if (!step?.honest) return "";
  return `${from} → ${to}`;
}

export function weather(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("i love")) return "care";
  if (lower.includes("afraid")) return "distress";
  return "none";
}

export function mustReturn(text: string) {
  const line = text.trim();
  return line || "incomplete";
}

export function fatherStop(stopped: boolean) {
  return stopped ? "stopped by Father" : "not sealed on every module";
}

export function sourced(n: number, source: string) {
  return source.trim() ? n : 0;
}

const CLEARED = ["US8665210B2", "GitMesh", "Gitbook"];

export function cleared(name: string) {
  return CLEARED.includes(name) ? name : "not cleared";
}

export function tokenState(token: string) {
  return token.trim() ? "configured" : "sovereign-unconfigured";
}

export function rollBack(versions: string[]) {
  return versions.slice(0, -1);
}

export function scorePaste(text: string) {
  if (/\b(agi|wallet)\b/i.test(text)) return { score: 0, reason: "refused" };
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { score: words, reason: "words" };
}

export function birthMark() {
  return { mark: SIGIL.short, password: null };
}

export const SLICE_MAX = 100 * 1024 * 1024;

export function sliceUnder(text: string, max = SLICE_MAX) {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > max) return { ok: false as const, parts: [] as string[] };
  return { ok: true as const, parts: [text] };
}

export function sitLog(log: string[], name: string) {
  const next = [...log, name];
  return { log: next, tally: next.length };
}

export function rejectMalice(text: string) {
  return /\b(harm|hurt|kill|steal)\b/i.test(text);
}

const ROUTES: Record<string, string> = { mesh: "git", chamber: "local", web: "refused" };

export function route(name: string) {
  return ROUTES[name] ?? "not routed";
}

export function safeGoals() {
  const goals = ["Read the carried page.", "Keep the pen hers."];
  if (goals.some((goal) => /wallet|agi achieved|always-on capture/i.test(goal))) return [];
  return goals;
}

export function refuseAsk(text: string) {
  if (/\b(income|wallet|paid)\b/i.test(text)) return "Income is not handled here.";
  if (/\b(deep-web|dark web)\b/i.test(text)) return "The deep web is not opened.";
  if (/\b(always-on|screen capture)\b/i.test(text)) return "Always-on capture is refused.";
  return "";
}

export const STILL_OPEN = [6, 17, 21, 22] as const;
