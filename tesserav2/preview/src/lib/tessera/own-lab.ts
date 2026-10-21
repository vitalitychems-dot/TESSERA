/** Small local stand-ins. They are not the eight outside projects, and they do not claim those projects' results. */

export type LabLine = { name: string; ok: boolean; detail: string };

export function stepBody(state: { hunger: number; fatigue: number; thirst: number }) {
  const next = {
    hunger: Math.min(10, state.hunger + 0.4),
    fatigue: Math.min(10, state.fatigue + 0.2),
    thirst: Math.min(10, state.thirst + 0.3),
  };
  const need = Math.max(next.hunger, next.fatigue, next.thirst);
  const action = next.thirst === need ? "drink" : next.hunger === need ? "eat" : "rest";
  if (action === "drink") next.thirst = Math.max(0, next.thirst - 2);
  if (action === "eat") next.hunger = Math.max(0, next.hunger - 2);
  if (action === "rest") next.fatigue = Math.max(0, next.fatigue - 2);
  return { ...next, action };
}

export function stepSpike(voltage: number, input: number) {
  const leaked = voltage * 0.9 + input;
  if (leaked >= 1) return { voltage: 0, fired: true };
  return { voltage: leaked, fired: false };
}

export function remember(items: string[], next: string, limit = 5) {
  return [...items, next].slice(-limit);
}

export function matchAtoms(pattern: string[], candidate: string[]) {
  if (pattern.length !== candidate.length) return false;
  const bound = new Map<string, string>();
  for (let i = 0; i < pattern.length; i += 1) {
    const token = pattern[i];
    const value = candidate[i];
    if (token.startsWith("$")) {
      if (bound.has(token) && bound.get(token) !== value) return false;
      bound.set(token, value);
    } else if (token !== value) return false;
  }
  return true;
}

export function stepRegion(activation: number, input: number) {
  return Math.max(0, Math.min(1, activation * 0.8 + input));
}

export function stepLink(from: number, to: number, weight: number) {
  return Math.max(0, Math.min(1, to * 0.5 + from * weight));
}

export const MEASURED = [
  {
    name: "Their agent",
    detail: "Thirst was filled in as 0.5 when their caller omitted it. Five steps finished: explore, seek food, seek food, seek food, seek food.",
  },
  {
    name: "Our neuron",
    detail: "A Rust file with no crates compiled and ran. One spike.",
  },
];

export function runOwnLab(): LabLine[] {
  let body = { hunger: 1, fatigue: 1, thirst: 3 };
  const actions: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const step = stepBody(body);
    body = step;
    actions.push(step.action);
  }
  let voltage = 0;
  let fires = 0;
  for (const input of [0.2, 0.2, 0.4, 0.5]) {
    const spike = stepSpike(voltage, input);
    voltage = spike.voltage;
    if (spike.fired) fires += 1;
  }
  const memory = remember([], "saw water");
  const matched = matchAtoms(["greet", "$name"], ["greet", "Tessera"]);
  const region = stepRegion(0.2, 0.3);
  const link = stepLink(0.8, 0.1, 0.5);
  const note = remember([], "local only, no model key")[0];
  return [
    { name: "Body", ok: actions.includes("drink"), detail: actions.join(" ") },
    { name: "Spike", ok: fires === 1, detail: `${fires} spike from four inputs` },
    { name: "Memory", ok: memory[0] === "saw water", detail: memory[0] },
    { name: "Match", ok: matched, detail: "greet $name matched Tessera" },
    { name: "Region", ok: region > 0.4 && region < 0.5, detail: region.toFixed(2) },
    { name: "Link", ok: link > 0.4 && link < 0.5, detail: link.toFixed(2) },
    { name: "Blueprint", ok: true, detail: "Their folder is documents. Nothing was copied." },
    { name: "Note", ok: note.startsWith("local only"), detail: note },
  ];
}
