import { taught, type Fact } from "./recursive-proof.ts";

/** A new line is written only when two stored facts produce a teacher. A repeat writes nothing. */

export function derive(facts: readonly Fact[], memory: readonly string[]) {
  const next = [...memory];
  let gained = 0;
  for (const student of facts) {
    if (student.kind !== "studied") continue;
    const teacher = taught(facts, student.who);
    if (!teacher) continue;
    const line = `DERIVED: ${student.who} learned from ${teacher}`;
    if (next.includes(line)) continue;
    next.push(line);
    gained += 1;
  }
  return { memory: next, gained };
}

export function evolve() {
  const study: Fact[] = [{ kind: "studied", who: "Aristotle", where: "Academy" }];
  const both: Fact[] = [...study, { kind: "founded", who: "Plato", where: "Academy" }];
  const held: Fact[] = [...both, { kind: "studied", who: "Theaetetus", where: "Academy" }];
  const lyceum: Fact[] = [
    ...held,
    { kind: "founded", who: "Aristotle", where: "Lyceum" },
    { kind: "studied", who: "Theophrastus", where: "Lyceum" },
  ];
  const stuck = derive(study, []);
  const first = derive(both, stuck.memory);
  const again = derive(both, first.memory);
  const second = derive(held, again.memory);
  const third = derive(lyceum, second.memory);
  const stop = derive(lyceum, third.memory);
  const invented = stop.memory.some((line) => line.includes("Socrates"));
  const proved =
    stuck.gained === 0 &&
    first.gained === 1 &&
    again.gained === 0 &&
    second.gained === 1 &&
    third.gained === 1 &&
    stop.gained === 0 &&
    stop.memory.length === 3 &&
    !invented;
  return {
    proved,
    lines: stop.memory.length,
    said: proved
      ? "One fact added nothing. Plato and the Academy produced Aristotle. The same hop produced Theaetetus. The Lyceum produced Theophrastus. The next pass added nothing. Socrates was not invented."
      : "A pass wrote a line that two facts did not produce.",
  };
}
