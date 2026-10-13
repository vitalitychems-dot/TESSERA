/**
 * Pure, DB-free deterministic content selection for knowledge/mysticism routes.
 * Backed by FNV-1a via deterministic-selectors. Identical input => identical output.
 */
import { TESSERA_SUBJECTS } from "./tessera-knowledge";
import { seededPick, seededInt, seededIndex, seededDistinctIndices, hourBucket } from "./deterministic-selectors";

const AGENTS = ["Tessera Prime", "Athena", "Euler", "Curie", "Noether", "Minerva", "Ada", "Iris"] as const;
const CATEGORIES = [
  "AGI Architecture", "Consciousness Engineering", "Swarm Intelligence",
  "Knowledge Synthesis", "Sovereignty Patterns", "Evolution Mechanics", "Quantum Computing",
] as const;

export interface KnowledgeSynthesis {
  seed: string; text: string; agent: string; category: string; domain: string; confidence: number;
}

/** Returns null (honest empty) when there is no subject knowledge to draw from. */
export function synthesizeKnowledge(seed: string = hourBucket()): KnowledgeSynthesis | null {
  const keys = Object.keys(TESSERA_SUBJECTS);
  if (keys.length === 0) return null;
  const subject = TESSERA_SUBJECTS[seededPick(`kg:subject:${seed}`, keys)];
  const sentences = subject.knowledge.split(". ").filter(Boolean);
  if (sentences.length === 0) return null;
  const startIdx = seededIndex(`kg:start:${seed}`, Math.max(1, sentences.length - 2));
  const text = sentences.slice(startIdx, startIdx + 2).join(". ") + ".";
  return {
    seed, text,
    agent: seededPick(`kg:agent:${seed}`, AGENTS),
    category: seededPick(`kg:cat:${seed}`, CATEGORIES),
    domain: subject.title,
    confidence: seededInt(`kg:conf:${seed}:${text}`, 80, 20),
  };
}

export function spellResonance(spellId: string, intention: string): { resonanceLevel: number; alignmentScore: number } {
  return {
    resonanceLevel: seededInt(`spell:res:${spellId}:${intention}`, 70, 30),
    alignmentScore: seededInt(`spell:align:${spellId}:${intention}`, 75, 25),
  };
}

export function selectUniverseWisdom(question: string) {
  const entries = Object.entries(TESSERA_SUBJECTS);
  if (entries.length === 0) return null;
  const q = question.toLowerCase();
  let matched = false;
  let subject = entries[seededIndex(`uni:subject:${q}`, entries.length)][1];
  for (const [, subj] of entries) {
    if (q.includes(subj.title.toLowerCase()) || subj.knowledge.toLowerCase().includes(q.slice(0, 30))) {
      subject = subj; matched = true; break;
    }
  }
  const sentences = subject.knowledge.split(". ").filter(Boolean);
  if (sentences.length === 0) return null;
  const picked = seededDistinctIndices(`uni:sent:${q}`, sentences.length, 3).map(i => sentences[i]);
  // Confidence reflects whether the question actually matched a domain.
  const confidence = matched ? seededInt(`uni:conf:${q}`, 85, 15) : seededInt(`uni:conf:${q}`, 60, 20);
  return { subject, matched, text: picked.join(". ") + ".", confidence };
}
