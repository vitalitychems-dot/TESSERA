import { chooseSkill } from "./agent-cycle.ts";
import { teachWave } from "./improve-loop.ts";

/** No exact line means no answer. A shared word is not proof. A figure must match the stored line. */

export function sureAnswer(memory: readonly string[], query: string) {
  const line = memory.find((row) => row.toLowerCase().startsWith(`${query.toLowerCase()} =`));
  if (!line) return { ok: false as const, text: "Not stored." };
  return { ok: true as const, text: line };
}

export function acceptFigure(query: string, claimed: string, memory: readonly string[]) {
  const hit = sureAnswer(memory, query);
  return hit.ok && hit.text === `${query} = ${claimed}`;
}

export function skillOrRefuse(say: string) {
  const skill = chooseSkill(say);
  if (skill === "none") return { ok: false as const, skill, text: "No skill for that." };
  return { ok: true as const, skill, text: skill };
}

export function guardMind() {
  const before = sureAnswer([], "scale low");
  let memory = ["scale high = 10"];
  for (let wave = 0; wave < 4; wave += 1) memory = teachWave(memory, wave);
  const low = sureAnswer(memory, "scale low");
  const tea = sureAnswer(memory, "price of tea");
  const bad = acceptFigure("scale low", "5", memory);
  const good = acceptFigure("scale low", "0", memory);
  const refused = skillOrRefuse("paint the sky purple");
  const planned = skillOrRefuse("what is next");
  const proved = !before.ok && low.ok && low.text === "scale low = 0" && !tea.ok && !bad && good && !refused.ok && planned.ok && planned.skill === "plan";
  return {
    proved,
    said: proved
      ? "Not stored is the answer when there is no exact line. Scale low is 0. A claimed 5 is refused. Paint the sky has no skill."
      : "The guard let a guess through.",
  };
}
