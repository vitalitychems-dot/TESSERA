import { rewardEat } from "./local-learn.ts";

/** Eight running steps. Each formula was read from that checkout. Their files are not imported. */

export function brainCogStep(mem: number, input: number, tau = 2, threshold = 0.5) {
  let next = mem + (input - mem) / tau;
  const spike = next >= threshold;
  if (spike) next = 0;
  return { mem: next, spike };
}

export function brainSimStep(charge: number, leak = 0.1, threshold = 1) {
  const next = charge * (1 - leak);
  return { charge: next, fired: next >= threshold };
}

export function godelLabel(score: number | null) {
  if (score == null) return "unknown";
  if (score >= 0.8) return "healthy";
  if (score >= 0.4) return "degraded";
  return "down";
}

export function humanRate(spikes: number[]) {
  if (spikes.length < 2) return 0;
  const gaps = spikes.slice(1).map((time, index) => time - spikes[index]);
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return 1000 / mean;
}

export function acMood(serotonin: number) {
  if (serotonin > 0.7) return "optimistic and emotionally stable";
  if (serotonin < 0.3) return "pessimistic with emotional volatility";
  return "emotionally balanced";
}

export function blueprintCoherence(supported: number, contradicted: number, chain: number) {
  return (supported - contradicted) / Math.max(1, chain);
}

export function hyperonBool(text: string) {
  if (text === "True") return true;
  if (text === "False") return false;
  return null;
}

export function allEight() {
  return {
    neuro: rewardEat().best,
    braincog: brainCogStep(0, 2).spike,
    brainsim: brainSimStep(1.2).fired,
    godel: godelLabel(0.9),
    human: humanRate([10, 30]),
    ac: acMood(0.9),
    blueprint: blueprintCoherence(3, 1, 4),
    hyperon: hyperonBool("True"),
  };
}
