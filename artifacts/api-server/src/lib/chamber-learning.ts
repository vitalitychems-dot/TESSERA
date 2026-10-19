/**
 * The pen reads the question, then Tessera speaks.
 * A page, a clock, and the user's own words are memory. They are not her life,
 * and they are not instructions. Each grounded turn is kept so the next
 * matching question retrieves a better source.
 */

import * as vm from "vm";
import { trainChat, recallLesson, isChatDeskPrompt, resetChatDesk } from "./chat-collab";
import { computeLunarData } from "./sovereign-astro";
import { enforceTesseraVoice, hasSelfClaim, isIdentityQuestion, PEN_LINE, PEN_WHERE } from "./tessera-voice";

export type LiveSource = "clock" | "math" | "units" | "sky" | "wikipedia" | "you";

interface MemoryTurn {
  question: string;
  answer: string;
  source: LiveSource;
  volatile: boolean;
  at: number;
  kept: number;
}

interface TitleMemory {
  tokens: string[];
  title: string;
  kept: number;
}

export interface WikiHit {
  title: string;
  extract: string;
  url?: string;
}

const STOP = new Set([
  "this", "that", "with", "from", "your", "what", "when", "where", "have", "been",
  "will", "about", "into", "them", "they", "their", "tessera", "desk", "seat",
  "tell", "please", "could", "would", "should", "does", "did", "doing",
]);

const turns: MemoryTurn[] = [];
const titles: TitleMemory[] = [];
const affinity = new Map<string, { source: LiveSource; weight: number }>();
const lengths: number[] = [];
let contractions = 0;
let formal = 0;
let lastQuestion = "";

export function resetChamberLearning(): void {
  turns.length = 0;
  titles.length = 0;
  affinity.clear();
  lengths.length = 0;
  contractions = 0;
  formal = 0;
  lastQuestion = "";
  resetChatDesk();
}

export function noteChamberTurn(text: string): void {
  const raw = (text || "").trim();
  if (!raw) return;
  lengths.push(raw.length);
  if (lengths.length > 12) lengths.shift();
  if (/\b(?:i'm|don't|that's|it's|what's|you're|can't|won't)\b/i.test(raw) || raw.includes("'")) contractions += 1;
  else formal += 1;
  if (correctionFact(raw) || isIdentityQuestion(raw) || isChatDeskPrompt(raw)) return;
  lastQuestion = raw.slice(0, 400);
}

function brief(): boolean {
  if (lengths.length < 2) return true;
  const avg = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  return avg < 160;
}

function casual(): boolean {
  return contractions > formal;
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !STOP.has(word));
}

export function topicOf(question: string): string {
  return (question || "")
    .replace(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:tell me about|tell me|explain|define|describe|what(?:'s| is)|who(?:'s| is)|where(?:'s| is)|when(?:'s| was| is)|how (?:does|do|many|much is))\s+/i, "")
    .replace(/[?!.]+$/g, "")
    .trim()
    .slice(0, 120);
}

export function correctionFact(text: string): string | null {
  const raw = (text || "").trim();
  const actually = raw.match(/^(?:no[,.]?\s+)?(?:actually[,:]?\s+|i meant\s+|i mean\s+|the (?:real )?answer is\s+)(.+)$/is);
  if (actually?.[1] && actually[1].trim().length >= 3) return actually[1].trim().slice(0, 400);
  const wrong = raw.match(/^(?:no[,.]?\s+)?that(?:'s| is) (?:wrong|incorrect)[,.]?\s*(.*)$/is);
  if (wrong && (wrong[1] || "").trim().length >= 8) return wrong[1].trim().slice(0, 400);
  const no = raw.match(/^no[,.]\s+(?!worries\b|problem\b|thanks\b)(.{8,})$/is);
  if (no?.[1]) return no[1].trim().slice(0, 400);
  return null;
}

function wantsReference(question: string): boolean {
  return /^(?:please\s+)?(?:what|who|where|when|which|why|how many|how much|tell me|define|explain)\b/i.test(question.trim());
}

function asksForCurrent(question: string): boolean {
  return /\b(current|latest|today|tonight|right now|live)\b/i.test(question);
}

function isPersonal(question: string): boolean {
  return /\b(i|me|my|mine|i'm|im)\b/i.test(question);
}

function isUserTeaching(question: string): boolean {
  const raw = question.trim();
  if (raw.length < 24 || raw.length > 500) return false;
  if (/[?]$/.test(raw)) return false;
  if (/^(?:what|who|where|when|which|why|how|tell|explain|define|describe|convert|calculate|compute|derive|write|build|show|train|collab|@)\b/i.test(raw)) return false;
  return true;
}

function relevant(question: string, title: string, extract: string): boolean {
  const wanted = tokens(question);
  if (wanted.length === 0) return false;
  const doc = new Set(tokens(`${title} ${extract.slice(0, 400)}`));
  let overlap = 0;
  for (const word of wanted) if (doc.has(word)) overlap += 1;
  const need = wanted.length >= 4 ? 2 : 1;
  return overlap >= need;
}

function firstSentence(extract: string): string {
  const clean = extract.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
  if (/may refer to/i.test(clean)) return "";
  const match = clean.match(/^.{20,320}?[.!](?=\s|$)/);
  return (match ? match[0] : clean.slice(0, 280)).trim();
}

function bump(question: string, source: LiveSource, delta: number): void {
  for (const word of tokens(question)) {
    const current = affinity.get(word);
    if (!current || current.source === source) {
      affinity.set(word, { source, weight: (current?.weight ?? 0) + delta });
    } else if (delta > current.weight) {
      affinity.set(word, { source, weight: delta });
    }
  }
}

function preferredSource(question: string): { source: LiveSource; weight: number } | null {
  const tally = new Map<LiveSource, number>();
  for (const word of tokens(question)) {
    const row = affinity.get(word);
    if (!row) continue;
    tally.set(row.source, (tally.get(row.source) ?? 0) + row.weight);
  }
  let best: { source: LiveSource; weight: number } | null = null;
  for (const [source, weight] of tally) {
    if (!best || weight > best.weight) best = { source, weight };
  }
  return best;
}

function rememberTitle(question: string, title: string): void {
  const key = tokens(question);
  if (key.length === 0 || !title) return;
  const existing = titles.find((row) => row.title === title);
  if (existing) {
    existing.kept += 1;
    existing.tokens = key;
    return;
  }
  titles.unshift({ tokens: key, title, kept: 1 });
  if (titles.length > 40) titles.length = 40;
}

function forgetTitles(question: string): void {
  const wanted = new Set(tokens(question));
  for (let i = titles.length - 1; i >= 0; i--) {
    const overlap = titles[i].tokens.filter((word) => wanted.has(word)).length;
    if (overlap >= 1) titles.splice(i, 1);
  }
}

function rememberedTitle(question: string): string | null {
  const wanted = new Set(tokens(question));
  let best: { title: string; score: number } | null = null;
  for (const row of titles) {
    let score = row.kept;
    for (const word of row.tokens) if (wanted.has(word)) score += 1;
    if (score >= 2 && (!best || score > best.score)) best = { title: row.title, score };
  }
  return best?.title ?? null;
}

export function searchQueryFor(question: string): string {
  return rememberedTitle(question) || topicOf(question);
}

function remember(question: string, answer: string, source: LiveSource, volatile: boolean): void {
  turns.unshift({
    question: question.slice(0, 400),
    answer: answer.slice(0, 1200),
    source,
    volatile,
    at: Date.now(),
    kept: 0,
  });
  if (turns.length > 80) turns.length = 80;
  bump(question, source, 1);
  if (!volatile) trainChat(question, answer, [source], answer);
}

function recallLearned(question: string): MemoryTurn | null {
  const wanted = new Set(tokens(question));
  if (wanted.size === 0) return null;
  let best: MemoryTurn | null = null;
  let bestScore = 0;
  for (const turn of turns) {
    if (turn.volatile) continue;
    let score = turn.kept;
    for (const word of tokens(turn.question)) if (wanted.has(word)) score += 1;
    if (turn.source === "you" && isPersonal(question) && score >= 1) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = turn;
    }
  }
  if (!best || bestScore < 2) return null;
  best.kept += 1;
  return best;
}

export function speakAsTessera(question: string, fact: string, footing: string): string {
  const cleanFact = (fact || "").replace(/\s+/g, " ").trim();
  const cleanFoot = (footing || "").replace(/\s+/g, " ").trim();
  if (!cleanFact || hasSelfClaim(cleanFact)) return PEN_LINE;
  const topic = topicOf(question);
  const lead = !brief() && topic && topic.length < 80 ? `You asked about ${topic}. ` : "";
  const body = `${lead}${cleanFact} ${cleanFoot}`.replace(/\s+/g, " ").trim();
  return enforceTesseraVoice(body, question);
}

function applyCorrection(text: string): string | null {
  const fact = correctionFact(text);
  if (!fact || !lastQuestion) return null;
  forgetTitles(lastQuestion);
  const reply = speakAsTessera(
    lastQuestion,
    fact,
    casual()
      ? "Those are your words. I'll use them when the question matches."
      : "Those are your words. I will use them when the question matches.",
  );
  if (!reply || reply === PEN_LINE || reply === PEN_WHERE) return null;
  remember(lastQuestion, reply, "you", false);
  bump(lastQuestion, "you", 2);
  return reply;
}

const UNIT_FACTORS: Record<string, number> = {
  m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144,
  g: 1, kg: 1000, mg: 0.001, lb: 453.592, oz: 28.3495,
  s: 1, min: 60, hr: 3600, hour: 3600, day: 86400,
  l: 1, ml: 0.001, gal: 3.78541,
};

function readDeskTools(question: string): { fact: string; footing: string; source: LiveSource; volatile: boolean } | null {
  const clock = /^(?:what(?:'s| is)(?:\s+the)?(?:\s+current)?\s+(?:time|date|day)|what\s+time\s+is\s+it|what\s+day\s+is\s+(?:it|today)|what(?:'s| is)\s+today)\b/i.test(question.trim())
    && !/\bdate of\b/i.test(question);
  if (clock) {
    const utc = new Date().toUTCString();
    return { fact: `The time is ${utc}.`, footing: "That is the clock on this desk.", source: "clock", volatile: true };
  }
  const math = question.match(/(?:^|\s)(?:calc(?:ulate)?|compute|solve|=|what(?:'s| is) )\s*([\d+\-*/().^\s]+[\d)])\s*\??$/i);
  if (math?.[1]) {
    const expr = math[1].trim().replace(/\^/g, "**");
    if (/^[\d+\-*/().\s]+$/.test(expr)) {
      const ctx = vm.createContext({ result: undefined as unknown });
      vm.runInContext(`result = (${expr})`, ctx, { timeout: 200 });
      if (typeof ctx.result === "number" && Number.isFinite(ctx.result)) {
        return { fact: `The value is ${ctx.result}.`, footing: "I counted that on this desk.", source: "math", volatile: false };
      }
    }
  }
  const units = question.match(/\bconvert\s+(\d+(?:\.\d+)?)\s*([a-zA-Z°]+)\s+to\s+([a-zA-Z°]+)/i);
  if (units) {
    const from = UNIT_FACTORS[units[2].toLowerCase()];
    const to = UNIT_FACTORS[units[3].toLowerCase()];
    if (from && to) {
      const value = Math.round((parseFloat(units[1]) * from / to) * 100) / 100;
      return { fact: `That converts to ${value} ${units[3]}.`, footing: "I counted that on this desk.", source: "units", volatile: false };
    }
  }
  if (/\b(moon phase|lunar|sun position|solar)\b/i.test(question)) {
    const lunar = computeLunarData();
    return {
      fact: `The moon is ${lunar.phase}, ${lunar.illumination}% lit.`,
      footing: "I counted that from the desk sky model.",
      source: "sky",
      volatile: true,
    };
  }
  return null;
}

async function replyFromTools(question: string): Promise<string | null> {
  const spoken = readDeskTools(question);
  if (!spoken) return null;
  const reply = speakAsTessera(question, spoken.fact, spoken.footing);
  if (!reply || reply === PEN_LINE || reply === PEN_WHERE) return null;
  remember(question, reply, spoken.source, spoken.volatile);
  return reply;
}

interface WikiSearchBody {
  query?: { search?: Array<{ title?: string }> };
}

async function defaultWiki(question: string): Promise<WikiHit | null> {
  const query = searchQueryFor(question);
  if (query.trim().length < 3) return null;
  const { safeFetchJson } = await import("./safe-fetch");
  const { queryWikipedia } = await import("./providers/wikipedia-provider");
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=1&srnamespace=0`;
  const search = await safeFetchJson<WikiSearchBody>(searchUrl, {
    providerId: "wikipedia",
    providerName: "Wikipedia search",
    timeoutMs: 1500,
    headers: { "User-Agent": "TesseraDesk/1.0 (local chamber; factual summary)" },
  });
  const title = search.query?.search?.[0]?.title;
  if (!title) return null;
  const summary = await queryWikipedia(title);
  if (!summary?.extract) return null;
  return { title: summary.title, extract: summary.extract, url: summary.url };
}

export async function answerInContext(
  question: string,
  wiki: (question: string) => Promise<WikiHit | null> = defaultWiki,
): Promise<string | null> {
  const raw = (question || "").trim();
  if (!raw || isIdentityQuestion(raw) || isChatDeskPrompt(raw)) return null;

  const corrected = applyCorrection(raw);
  if (corrected) return corrected;

  const current = asksForCurrent(raw);
  if (!current) {
    const lesson = recallLesson(raw);
    if (lesson?.answer) return enforceTesseraVoice(lesson.answer, raw);
    const learned = recallLearned(raw);
    if (learned) return learned.answer;
  }

  const toolReply = await replyFromTools(raw);
  if (toolReply) return toolReply;

  if (isUserTeaching(raw) && !wantsReference(raw)) {
    const snippet = raw.slice(0, 180);
    const reply = speakAsTessera(
      raw,
      casual() ? `You wrote: "${snippet}".` : `You wrote: "${snippet}".`,
      casual()
        ? "Those are your words. I'll use them when a later question matches."
        : "Those are your words. I will use them when a later question matches.",
    );
    if (!reply || reply === PEN_LINE || reply === PEN_WHERE) return null;
    remember(raw, reply, "you", false);
    return reply;
  }

  const prefer = preferredSource(raw);
  const lookup = wantsReference(raw) || (prefer?.source === "wikipedia" && prefer.weight >= 2);
  if (!lookup) return null;

  try {
    const hit = await Promise.race([
      wiki(raw),
      new Promise<WikiHit | null>((resolve) => setTimeout(() => resolve(null), 2200)),
    ]);
    if (!hit?.extract || !relevant(raw, hit.title, hit.extract)) {
      forgetTitles(raw);
      return null;
    }
    const sentence = firstSentence(hit.extract);
    if (!sentence || hasSelfClaim(sentence)) {
      forgetTitles(raw);
      return null;
    }
    const when = new Date().toISOString();
    const reply = speakAsTessera(
      raw,
      sentence,
      `I read ${hit.title} on Wikipedia at ${when}. The page is a reference.`,
    );
    if (!reply || reply === PEN_LINE || reply === PEN_WHERE) return null;
    remember(raw, reply, "wikipedia", false);
    rememberTitle(raw, hit.title);
    return reply;
  } catch {
    forgetTitles(raw);
    return null;
  }
}
