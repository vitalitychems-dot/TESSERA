import { deskPassed } from "./craft.ts";
import { cyclesImproved } from "./cycles.ts";
import { vowCheck } from "./learning.ts";
import { graphContext } from "./token-graph.ts";

export function selfCheck() {
  const desk = deskPassed();
  const cycles = cyclesImproved();
  const graph = graphContext("who is the pen");
  const graphOk = graph.tokens < 200 && graph.saved > 1000;
  const note =
    "REAL: The desk, the twenty cycles, and the pen-question graph passed. The next change stays inside the vows. No weight was trained. Lesson sealed.";
  const vow = vowCheck(note);
  const pass = desk && cycles && graphOk && vow.ok;
  return {
    pass,
    desk,
    cycles,
    graphTokens: graph.tokens,
    note: pass ? note : "GOAL: A check failed. A success was not sealed.",
  };
}

/** A task copy is kept only when it marks its status and seals the line. */
export function acceptCopy(text: string) {
  const note = text.trim();
  if (!/^(REAL|GOAL):/.test(note)) return { ok: false as const, reason: "The copy did not mark REAL or GOAL." };
  if (!/Lesson sealed\.?$/.test(note)) return { ok: false as const, reason: "The copy did not seal the lesson." };
  const vow = vowCheck(note);
  if (!vow.ok) return { ok: false as const, reason: vow.reason };
  return { ok: true as const, reason: "Sealed." };
}

export const LAST_COPY = {
  at: "2026-10-08",
  text: "REAL: Improve through reviewed changes, not autonomous mutation.",
  reason: "She was asked to improve herself. The vow allowed the line. She did not end with Lesson sealed, so it was not sealed.",
};
