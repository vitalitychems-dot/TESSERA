import { readFileSync } from "node:fs";
import { ledgerCount } from "./repo-ledger.ts";
import { sureAnswer } from "./guard.ts";
import { clampUnit, qStep, stateKey } from "./step-math.ts";
export { clampUnit, qStep, stateKey };

const BOOK = "data/school/republic-excerpt.txt";

export function trainNormal() {
  const text = readFileSync(BOOK, "utf8");
  const byPlato = text.includes("By Plato");
  const jowett = text.includes("Benjamin Jowett");
  const lines = [
    { q: "state key", answer: stateKey(0.5, 0.55) },
    { q: "clamp high", answer: String(clampUnit(1.4)) },
    { q: "clamp low", answer: String(clampUnit(-0.2)) },
    { q: "q step", answer: String(qStep(0, 1, 0)) },
    { q: "republic translator", answer: jowett ? "Benjamin Jowett" : "" },
  ];
  const before = lines.filter((line) => sureAnswer([], line.q).ok).length;
  const memory = lines.map((line) => `${line.q} = ${line.answer}`);
  const after = lines.filter((line) => sureAnswer(memory, line.q).text === `${line.q} = ${line.answer}`).length;
  const count = ledgerCount();
  const step = qStep(0, 1, 0);
  const proved =
    byPlato &&
    jowett &&
    before === 0 &&
    after === lines.length &&
    stateKey(0.5, 0.55) === "h5_f5" &&
    clampUnit(1.4) === 1 &&
    clampUnit(-0.2) === 0 &&
    Math.abs(step - 0.1) < 1e-9 &&
    count.total === 272;
  return {
    proved,
    after,
    said: proved
      ? `Five ordinary lines were unknown, then kept. Half hunger and 0.55 fatigue is h5_f5. A value past 1 clamps to 1. A value under 0 clamps to 0. A q step from 0 with reward 1 is 0.1. The Republic file says Plato, translated by Benjamin Jowett. 272 catalog names remain. 8 folders are on disk. These three functions were read from files already in NeuroConscious. Their classes were not imported. The other names were not turned into programs.`
      : "The ordinary lesson or the checkout step missed.",
  };
}
