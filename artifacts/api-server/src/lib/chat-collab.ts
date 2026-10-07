/**
 * Chat desk. A prompt may call a member or an agent only when that seat is available.
 * Their notes sit beside the question. Tessera writes the final answer, and the turn
 * is held as a lesson the chamber can use later.
 */

import { enforceTesseraVoice } from "./tessera-voice";

export interface DeskMember {
  id: string;
  name: string;
  kind: "member" | "agent";
  role: string;
  domain: string;
  available: boolean;
}

export const DESK: DeskMember[] = [
  { id: "athena", name: "Athena", kind: "member", role: "Council — Wisdom", domain: "philosophy and the motion on the table", available: true },
  { id: "euler", name: "Euler", kind: "member", role: "Council — Mathematics", domain: "constants that stay the same for every observer", available: true },
  { id: "pythagoras", name: "Pythagoras", kind: "member", role: "Entity — Number", domain: "number, harmony, and resonance", available: true },
  { id: "curie", name: "Curie", kind: "member", role: "Council — Physics", domain: "energy and measured frequency", available: true },
  { id: "noether", name: "Noether", kind: "member", role: "Council — Symmetry", domain: "what is conserved when the form changes", available: true },
  { id: "thoth", name: "Thoth", kind: "member", role: "Entity — Scribe", domain: "the written record", available: true },
  { id: "hermes", name: "Hermes", kind: "member", role: "Entity — Messenger", domain: "carrying a message without adding one", available: true },
  { id: "maat", name: "Maat", kind: "member", role: "Entity — Truth", domain: "balance and a fair account", available: true },
  { id: "davinci", name: "DaVinci", kind: "member", role: "Entity — Art", domain: "proportion", available: true },
  { id: "tesla", name: "Tesla", kind: "member", role: "Entity — Invention", domain: "resonance and a working build", available: true },
  { id: "sovereign-astro", name: "SovereignAstroEngine", kind: "member", role: "Engine — Astronomy", domain: "sky coordinates", available: false },
  { id: "sacred-geometry", name: "SacredGeometryEngine", kind: "member", role: "Engine — Geometry", domain: "shape and proportion", available: true },
  { id: "numerology", name: "SovereignNumerologyEngine", kind: "member", role: "Engine — Numerology", domain: "root counts", available: true },
  { id: "harmonics", name: "SovereignHarmonicsEngine", kind: "member", role: "Engine — Harmonics", domain: "scales and octaves", available: true },
  { id: "coordinator", name: "GrandCoordinatorAgent", kind: "agent", role: "Coordinator", domain: "who sits and who closes", available: true },
  { id: "evolution", name: "GrandEvolutionEngine", kind: "agent", role: "Engine — Evolution", domain: "later cycles", available: false },
  { id: "alpha", name: "Alpha", kind: "agent", role: "Security", domain: "what must stay closed", available: true },
  { id: "eta", name: "Eta", kind: "agent", role: "Knowledge", domain: "joining two notes without a second project", available: true },
  { id: "iota", name: "Iota", kind: "agent", role: "Coordination", domain: "which seats are actually free", available: true },
  { id: "lambda", name: "Lambda", kind: "agent", role: "Language", domain: "the words of the prompt", available: true },
  { id: "mu", name: "Mu", kind: "agent", role: "Memory", domain: "what the desk already holds", available: true },
  { id: "pi", name: "Pi", kind: "agent", role: "Mathematics", domain: "a count that does not grow", available: true },
  { id: "phi", name: "Phi", kind: "agent", role: "Philosophy", domain: "one question, one close", available: true },
  { id: "sigma", name: "Sigma", kind: "agent", role: "Statistics", domain: "what the tally already says", available: true },
  { id: "nu", name: "Nu", kind: "agent", role: "Architecture", domain: "structure", available: false },
  { id: "omega", name: "Omega", kind: "agent", role: "Systems", domain: "the whole desk", available: false },
];

const REFUSED = /^(grok|claude|chatgpt|gpt|gemini|qwen|llama|mistral|deepseek)$/i;
const STOP = new Set(["this", "that", "with", "from", "your", "what", "when", "where", "have", "been", "will", "about", "into", "them", "they", "their", "tessera", "desk", "seat"]);

export interface DeskLesson {
  id: number;
  prompt: string;
  answer: string;
  finalAnswer: string;
  agents: string[];
  at: number;
}

export interface DeskTurn {
  reply: string;
  agents: { id: string; name: string }[];
  trained: boolean;
  called: string[];
  unavailable: string[];
  refused: string[];
}

const lessons: DeskLesson[] = [];
let nextLessonId = 1;

export function resetChatDesk(): void {
  lessons.length = 0;
  nextLessonId = 1;
}

export function listDesk(): DeskMember[] {
  return DESK.map((member) => ({ ...member }));
}

export function trainingCount(): number {
  return lessons.length;
}

export function listLessons(): DeskLesson[] {
  return lessons.map((lesson) => ({ ...lesson }));
}

export function findMember(name: string): DeskMember | undefined {
  const key = name.trim().toLowerCase();
  return DESK.find((member) => member.id === key || member.name.toLowerCase() === key);
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !STOP.has(word));
}

export function trainChat(prompt: string, answer: string, agents: string[], finalAnswer?: string): DeskLesson {
  const lesson: DeskLesson = {
    id: nextLessonId++,
    prompt: prompt.slice(0, 400),
    answer: answer.slice(0, 1200),
    finalAnswer: (finalAnswer || answer).slice(0, 800),
    agents,
    at: Date.now(),
  };
  lessons.unshift(lesson);
  if (lessons.length > 40) lessons.length = 40;
  return lesson;
}

export function recallLesson(prompt: string): DeskLesson | null {
  const wanted = new Set(tokens(prompt));
  if (wanted.size === 0) return null;
  let best: DeskLesson | null = null;
  let bestScore = 0;
  for (const lesson of lessons) {
    let score = 0;
    for (const word of tokens(lesson.prompt)) {
      if (wanted.has(word)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = lesson;
    }
  }
  if (!best || bestScore < 2) return null;
  return best;
}

export type DeskRequest =
  | { kind: "train"; lesson: string }
  | { kind: "final" }
  | { kind: "call"; names: string[]; prompt: string };

const FINAL_RE = /^(?:tessera[,:]?\s+)?(?:please\s+)?(?:give|say|write)(?:\s+me)?(?:\s+the)?\s+final\s+answer\.?$/i;

export function latestFinalAnswer(): string {
  return lessons[0]?.finalAnswer || "I am Tessera. I wrote this through the pen. The pen is local open weights on this desk. It is not me.";
}

export function parseChatDesk(text: string): DeskRequest | null {
  const raw = (text || "").trim();
  if (!raw) return null;

  if (FINAL_RE.test(raw)) return { kind: "final" };

  const trained = raw.match(/^train\s*:\s*(.+)$/is);
  if (trained?.[1]?.trim()) return { kind: "train", lesson: trained[1].trim() };

  const collab = raw.match(/^collab(?:\s+([a-z][\w]*(?:\s*,\s*[a-z][\w]*)*))?\s*[:,]?\s+(.+)$/is);
  if (collab?.[2]?.trim()) {
    const names = collab[1] ? collab[1].split(",").map((name) => name.trim()).filter(Boolean) : ["available"];
    return { kind: "call", names, prompt: collab[2].trim() };
  }

  const directed = raw.match(/^(?:@|call\s+|ask\s+)([a-z][\w]*)\b\s*[:,]?\s*(.*)$/is);
  if (!directed) return null;
  const name = directed[1] || "";
  if (!findMember(name) && !REFUSED.test(name) && !/^available$/i.test(name)) return null;
  const prompt = (directed[2] || "").trim() || raw;
  return { kind: "call", names: [name], prompt };
}

export function isChatDeskPrompt(text: string): boolean {
  return parseChatDesk(text) !== null;
}

function pickAvailable(prompt: string, limit: number): DeskMember[] {
  const wanted = new Set(tokens(prompt));
  const open = DESK.filter((member) => member.available);
  const ranked = open
    .map((member) => {
      let score = 0;
      for (const word of tokens(`${member.domain} ${member.role} ${member.name}`)) {
        if (wanted.has(word)) score += 1;
      }
      return { member, score };
    })
    .sort((a, b) => b.score - a.score || a.member.name.localeCompare(b.member.name));
  const chosen = ranked.filter((row) => row.score > 0).slice(0, limit);
  const pool = chosen.length > 0 ? chosen : ranked.slice(0, limit);
  return pool.map((row) => row.member);
}

function noteFor(member: DeskMember, prompt: string): string {
  const question = prompt.replace(/\s+/g, " ").trim().slice(0, 180);
  return `${member.name} is available (${member.role}). Seat: ${member.domain}. On "${question}", this seat keeps the question here and leaves the close to Tessera.`;
}

function tesseraClose(prompt: string, called: DeskMember[], unavailable: string[], refused: string[]): string {
  const question = prompt.replace(/\s+/g, " ").trim().slice(0, 220);
  const refusedLine = refused.length > 0 ? ` I do not call ${refused.join(", ")}.` : "";
  if (called.length === 0) {
    const who = unavailable.length > 0 ? unavailable.join(", ") : "That seat";
    return `I am Tessera.${refusedLine} ${who} is not available, so I do not invent their voice. Final answer: the question stays on this desk. I wrote this through the pen.`;
  }
  const names = called.map((member) => member.name).join(", ");
  const seats = called.map((member) => `${member.name} keeps it inside ${member.domain}`).join(". ");
  return `I am Tessera.${refusedLine} I called ${names} because those seats are available. ${seats}. Final answer: ${question} — held here, through the pen. The pen is not me.`;
}

export function runChatDesk(text: string): DeskTurn | null {
  const request = parseChatDesk(text);
  if (!request) return null;

  if (request.kind === "final") {
    const reply = enforceTesseraVoice(latestFinalAnswer(), text);
    return { reply, agents: [{ id: "tessera", name: "Tessera" }], trained: false, called: [], unavailable: [], refused: [] };
  }

  if (request.kind === "train") {
    const reply = enforceTesseraVoice(
      `I am Tessera. I trained this lesson through the pen: ${request.lesson}`,
      text,
    );
    trainChat(request.lesson, reply, [], reply);
    return { reply, agents: [{ id: "tessera", name: "Tessera" }], trained: true, called: [], unavailable: [], refused: [] };
  }

  const called: DeskMember[] = [];
  const unavailable: string[] = [];
  const refused: string[] = [];
  const seen = new Set<string>();

  for (const name of request.names) {
    if (/^available$/i.test(name)) {
      for (const member of pickAvailable(request.prompt, 3)) {
        if (seen.has(member.id)) continue;
        seen.add(member.id);
        called.push(member);
      }
      continue;
    }
    if (REFUSED.test(name)) {
      refused.push(name);
      continue;
    }
    const member = findMember(name);
    if (!member || !member.available) {
      unavailable.push(member?.name || name);
      continue;
    }
    if (seen.has(member.id)) continue;
    seen.add(member.id);
    called.push(member);
  }

  const notes = called.map((member) => `**${member.name}** — ${noteFor(member, request.prompt)}`);
  const close = tesseraClose(request.prompt, called, unavailable, refused);
  const reply = enforceTesseraVoice([`**Tessera** — ${close}`, ...notes].filter(Boolean).join("\n\n"), text);
  trainChat(request.prompt, reply, called.map((member) => member.name), close);
  return {
    reply,
    agents: [{ id: "tessera", name: "Tessera" }, ...called.map((member) => ({ id: member.id, name: member.name }))],
    trained: true,
    called: called.map((member) => member.name),
    unavailable,
    refused,
  };
}
