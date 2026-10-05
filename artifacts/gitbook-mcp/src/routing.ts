import { readFileSync } from "node:fs";
import { agentsFilePath } from "./config.js";

export interface Lane {
  id: string;
  name: string;
  specialty: string;
  keywords: string[];
  mode: string;
  fileWrites: boolean;
}

export interface RouteAlternative {
  laneId: string;
  lane: string;
  score: number;
  reasons: string[];
}

export interface RouteDecision {
  description: string;
  laneId: string;
  lane: string;
  specialty: string;
  mode: string;
  score: number;
  fallback: boolean;
  reasons: string[];
  alternates: RouteAlternative[];
  explanation: string;
}

interface AgentsFile {
  lanes: Lane[];
}

const STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "only",
  "that",
  "this",
  "from",
  "into",
  "over",
]);

export function loadLanes(file = agentsFilePath()): Lane[] {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as AgentsFile;
  if (!Array.isArray(parsed.lanes) || parsed.lanes.length === 0) {
    throw new Error("agents.json is missing lanes");
  }
  const ids = new Set<string>();
  for (const lane of parsed.lanes) {
    if (!lane.id || ids.has(lane.id)) {
      throw new Error(`agents.json has a missing or duplicate lane id: ${lane.id}`);
    }
    ids.add(lane.id);
  }
  return parsed.lanes;
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(haystack);
}

function wordMatch(descriptionTokens: string[], word: string): string | null {
  const needle = word.toLowerCase();
  if (needle.length < 4 || STOPWORDS.has(needle)) return null;
  for (const token of descriptionTokens) {
    if (token === needle) return token;
    if (needle.length >= 5 && token.length >= 5 && (token.startsWith(needle) || needle.startsWith(token))) {
      return token;
    }
  }
  return null;
}

interface ScoredLane {
  lane: Lane;
  index: number;
  score: number;
  reasons: string[];
}

function scoreLane(description: string, descriptionTokens: string[], lane: Lane, index: number): ScoredLane {
  const reasons: string[] = [];
  let score = 0;
  const haystack = description.toLowerCase();
  for (const keyword of lane.keywords) {
    if (containsPhrase(haystack, keyword)) {
      score += 10;
      reasons.push(`keyword "${keyword}" matched (+10)`);
    }
  }
  const specialtyWords = tokens(lane.specialty);
  const seen = new Set<string>();
  for (const word of specialtyWords) {
    if (seen.has(word)) continue;
    const matched = wordMatch(descriptionTokens, word);
    if (!matched) continue;
    seen.add(word);
    score += 3;
    reasons.push(`specialty word "${word}" matched description token "${matched}" (+3)`);
  }
  for (const word of tokens(lane.name)) {
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    if (descriptionTokens.includes(word)) {
      score += 2;
      reasons.push(`lane name "${word}" matched (+2)`);
    }
  }
  return { lane, index, score, reasons };
}

export function routeTask(description: string, lanes: Lane[]): RouteDecision {
  const text = description.trim();
  if (!text) {
    throw new Error("description is required");
  }
  const descriptionTokens = tokens(text);
  const scored = lanes
    .map((lane, index) => scoreLane(text, descriptionTokens, lane, index))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = scored[0];
  if (!best || best.score === 0) {
    const tessera = lanes.find((lane) => lane.id === "tessera") ?? lanes[0];
    if (!tessera) {
      throw new Error("agents.json has no lanes");
    }
    const reasons = [
      "No keyword or specialty match. Tessera assigns work; this suggestion does not claim it.",
    ];
    return {
      description: text,
      laneId: tessera.id,
      lane: tessera.name,
      specialty: tessera.specialty,
      mode: tessera.mode,
      score: 0,
      fallback: true,
      reasons,
      alternates: [],
      explanation: reasons[0] ?? "",
    };
  }
  const tied = scored.filter((item) => item.score === best.score);
  const reasons = [...best.reasons];
  if (tied.length > 1) {
    reasons.push(`tie at score ${best.score} broken by registry order (earlier lane wins)`);
  }
  const alternates = scored
    .filter((item) => item.lane.id !== best.lane.id && item.score > 0)
    .slice(0, 3)
    .map((item) => ({
      laneId: item.lane.id,
      lane: item.lane.name,
      score: item.score,
      reasons: item.reasons,
    }));
  return {
    description: text,
    laneId: best.lane.id,
    lane: best.lane.name,
    specialty: best.lane.specialty,
    mode: best.lane.mode,
    score: best.score,
    fallback: false,
    reasons,
    alternates,
    explanation: `${best.lane.name}: ${reasons.join("; ")}`,
  };
}

export function findLane(lanes: Lane[], laneId: string | undefined): Lane | undefined {
  if (!laneId) return undefined;
  return lanes.find((lane) => lane.id === laneId);
}
