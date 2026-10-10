/** A second fact completes a hop. A name that was never paired still uses that hop. A miss does not grow a synapse. */

export type Fact = { kind: "founded" | "studied"; who: string; where: string };
export type Synapse = { from: string; to: string; weight: number };

export function taught(facts: readonly Fact[], student: string) {
  const study = facts.find((fact) => fact.kind === "studied" && fact.who === student);
  if (!study) return "";
  const founder = facts.find((fact) => fact.kind === "founded" && fact.where === study.where);
  return founder?.who ?? "";
}

export function strengthen(weight: number) {
  return Math.round((weight + 0.1 * (1 - weight)) * 100) / 100;
}

export function useLink(synapses: readonly Synapse[], from: string, to: string, hit: boolean): Synapse[] {
  if (!hit) return [...synapses];
  const index = synapses.findIndex((link) => link.from === from && link.to === to);
  if (index < 0) return [...synapses, { from, to, weight: 0.1 }];
  return synapses.map((link, place) => (place === index ? { from, to, weight: strengthen(link.weight) } : link));
}

export function proveRecursive() {
  const studyOnly: Fact[] = [{ kind: "studied", who: "Aristotle", where: "Academy" }];
  const both: Fact[] = [...studyOnly, { kind: "founded", who: "Plato", where: "Academy" }];
  const held: Fact[] = [...both, { kind: "studied", who: "Theaetetus", where: "Academy" }];
  const before = taught([], "Aristotle");
  const half = taught(studyOnly, "Aristotle");
  const after = taught(both, "Aristotle");
  const unseen = taught(held, "Theaetetus");
  const unknown = taught(held, "Socrates");
  let synapses = useLink([], "Plato", "Academy", after === "Plato");
  const once = synapses[0]?.weight ?? 0;
  synapses = useLink(synapses, "Plato", "Academy", unseen === "Plato");
  const twice = synapses[0]?.weight ?? 0;
  const missed = useLink(synapses, "Plato", "Academy", unknown !== "");
  const proved = before === "" && half === "" && after === "Plato" && unseen === "Plato" && unknown === "" && once === 0.1 && twice === 0.19 && missed[0]?.weight === 0.19 && missed.length === 1;
  return {
    proved,
    once,
    twice,
    said: proved
      ? "One fact is not enough. Plato and the Academy together answer Aristotle. The same hop answers Theaetetus, who was not in the first pair. A miss leaves the synapse at 0.19."
      : "The hop did not hold.",
  };
}
