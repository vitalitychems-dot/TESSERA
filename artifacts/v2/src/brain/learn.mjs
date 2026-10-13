/**
 * IDEAS-B1-03 recursive learning loop. Outcomes (test pass/fail per topic) update topic
 * weights (multiplicative weights); the curriculum picks the weakest unmastered topic next.
 * Optionally feeds outcomes into the synapse graph (Hebbian on topic+result co-activation).
 */
import { hebbian } from "./synapse.mjs";
export function createLearner(topics, { eta = 0.5, mastery = 0.85, graph = null } = {}) {
  const s = new Map(topics.map((t) => [t, { pass: 0, n: 0, w: 1 }]));
  const rate = (t) => { const x = s.get(t); return (x.pass + 1) / (x.n + 2); };
  return {
    rate, state: s,
    record(topic, passed) {
      const x = s.get(topic); x.n++; if (passed) x.pass++;
      x.w *= passed ? 1 - eta * 0.5 : 1 + eta; // failures pull attention, passes release it
      if (graph) hebbian(graph, [`topic:${topic}`, passed ? "outcome:pass" : "outcome:fail"]);
    },
    mastered: (t) => rate(t) >= mastery && s.get(t).n >= 3,
    next() {
      const open = [...s.keys()].filter((t) => !this.mastered(t));
      if (!open.length) return null;
      return open.sort((a, b) => s.get(b).w - s.get(a).w || rate(a) - rate(b) || (a < b ? -1 : 1))[0];
    },
  };
}
/** Deterministic simulator: topic difficulty d, practice raises skill. Returns steps to master all. */
export function simulate(pick, { topics, difficulty, maxSteps = 2000, seed = 7 } = {}) {
  let x = seed >>> 0; const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const skill = new Map(topics.map((t) => [t, 0])); const L = createLearner(topics);
  for (let step = 1; step <= maxSteps; step++) {
    const t = pick(L, step); if (t == null) return step - 1;
    const p = Math.min(0.98, skill.get(t) + 1 - difficulty[t]);
    const ok = rnd() < p; L.record(t, ok); skill.set(t, skill.get(t) + (ok ? 0.02 : 0.08));
  }
  return maxSteps;
}
