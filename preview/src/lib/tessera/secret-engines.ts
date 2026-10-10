import { bondStrength, inventionSeed, verifyClaim } from "./reality.ts";

/** The sittings named these engines. A credential is not an engine and is not stored here. */

export const SECRET_ENGINES = [
  "knowledge-synthesis",
  "emotional-intelligence",
  "truthfulness",
  "sacred-geometry",
  "consensus",
  "invention-seed",
] as const;

export const SITTING =
  "The invention audit, the coverage findings, and the council notes were real sittings. The engines they named run here. A pasted key was not kept.";

const LINKS: Record<string, readonly string[]> = {
  "quantum-physics": ["harmonics", "sacred-geometry", "consciousness"],
  astronomy: ["thermodynamics", "ancient-civilizations"],
  chemistry: ["alchemy", "ecology"],
  alchemy: ["chemistry"],
  meditation: ["consciousness", "psychology"],
  ecology: ["chemistry", "thermodynamics"],
  consciousness: ["meditation", "quantum-physics"],
  "sacred-geometry": ["quantum-physics"],
  harmonics: ["quantum-physics"],
  neuroscience: ["psychology"],
  psychology: ["meditation", "neuroscience"],
  "systems-theory": ["network-theory"],
  thermodynamics: ["astronomy", "ecology"],
};

export const SOLFEGGIO = [174, 285, 396, 417, 528, 639, 741, 852, 963] as const;

export function synthesize(domain: string) {
  return [...(LINKS[domain.trim().toLowerCase()] ?? [])];
}

export function alignTone(hz: number) {
  let nearest: number = SOLFEGGIO[0];
  let gap = Math.abs(hz - nearest);
  for (const tone of SOLFEGGIO) {
    const distance = Math.abs(hz - tone);
    if (distance < gap) {
      nearest = tone;
      gap = distance;
    }
  }
  const rounded = Math.round(gap * 100) / 100;
  return { hz, nearest, gap: rounded, kept: rounded <= 40 };
}

export function holdCouncil(yesVotes: number, total: number) {
  const yes = Math.max(0, yesVotes);
  const count = Math.max(0, total);
  const need = count === 0 ? 0 : Math.ceil((count * 2) / 3);
  return { passed: count > 0 && yes >= need, yes, total: count, need };
}

export function secretDesk(title = "Route consciousness sacred geometry") {
  const seed = inventionSeed(title, 106);
  const bond = bondStrength(0.9, 0.8, 12);
  const claim = verifyClaim("the speed of light");
  const near = alignTone(432);
  const far = alignTone(12.67);
  const council = holdCouncil(2, 3);
  const links = synthesize("chemistry");
  return [
    `Invention seed ${seed.hash.toString(16)}. Feasibility ${seed.feasibility}. Novelty ${seed.novelty}.`,
    `Bond ${bond}. Counted from the sitting, not rolled.`,
    claim.line,
    `${near.hz} Hz nearest ${near.nearest}. Gap ${near.gap}. Kept ${near.kept ? "yes" : "no"}.`,
    `${far.hz} Hz nearest ${far.nearest}. Gap ${far.gap}. Kept ${far.kept ? "yes" : "no"}.`,
    `Council ${council.yes} of ${council.total}. Need ${council.need}. Passed ${council.passed ? "yes" : "no"}.`,
    `Chemistry links ${links.join(", ")}.`,
  ];
}
