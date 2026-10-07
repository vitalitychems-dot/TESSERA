// Tessera Scenario Sandbox — inspired by MiroFish's "rehearse the future"
// idea, implemented from scratch (MiroFish is AGPL-3.0; no code or assets are
// reused). This is a heuristic lesson-rehearsal, NOT a prediction engine and
// NOT agent social simulation.

import { scoreBm25 } from "../memory/bm25";

export interface SandboxLesson {
  id: string;
  text: string;
  tag: "risk" | "benefit" | "neutral";
}

export interface ScenarioReport {
  action: string;
  matchedRisks: { id: string; score: number; text: string }[];
  matchedBenefits: { id: string; score: number; text: string }[];
  netScore: number;        // benefits minus risks, heuristic scale
  recommendation: "proceed" | "proceed-with-mitigations" | "hold";
  limitation: string;
}

const LIMITATION =
  "Heuristic matching against recorded lessons only. This is not prediction, " +
  "not a simulated world, and not evidence the outcome will occur.";

/**
 * Rehearse a proposed action against recorded lessons. Strong risk matches
 * push toward "hold"; benefits without matching risks push toward "proceed".
 */
export function rehearse(action: string, lessons: SandboxLesson[], top = 3): ScenarioReport {
  const clean = action.trim();
  if (!clean) throw new Error("An action description is required");

  const scores = scoreBm25(lessons.map((l) => ({ id: l.id, text: l.text })), clean);
  const ranked = lessons
    .map((l) => ({ ...l, score: scores.get(l.id) ?? 0 }))
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score);

  const risks = ranked.filter((l) => l.tag === "risk").slice(0, top);
  const benefits = ranked.filter((l) => l.tag === "benefit").slice(0, top);

  const riskSum = risks.reduce((s, r) => s + r.score, 0);
  const benefitSum = benefits.reduce((s, b) => s + b.score, 0);
  const netScore = Math.round((benefitSum - riskSum) * 100) / 100;

  let recommendation: ScenarioReport["recommendation"];
  if (riskSum > 0 && riskSum >= benefitSum) recommendation = "hold";
  else if (riskSum > 0) recommendation = "proceed-with-mitigations";
  else recommendation = "proceed";

  return {
    action: clean,
    matchedRisks: risks.map(({ id, score, text }) => ({ id, score: Math.round(score * 100) / 100, text })),
    matchedBenefits: benefits.map(({ id, score, text }) => ({ id, score: Math.round(score * 100) / 100, text })),
    netScore,
    recommendation,
    limitation: LIMITATION,
  };
}
