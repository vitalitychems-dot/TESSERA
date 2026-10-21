import { chem, formatTime, surrogate } from "./checkout-steps.ts";
import { bestAction, learnAction } from "./local-learn.ts";
import { MESH } from "./mesh-net.ts";
import { strengthen, taught, useLink } from "./recursive-proof.ts";

/** Twenty results. The helpers below are in this file so main does not need a side branch. */

function secondGain() {
  const first = 0 + 0.1 * (1 - 0);
  const second = first + 0.1 * (1 - first);
  return second - first;
}

function emotionSet(value: number) {
  return Math.min(1, Math.max(0, value));
}

function onePeak(peaks: readonly number[]) {
  return peaks.length < 2;
}

function emptyPeaks(counts: readonly number[]) {
  return counts.length === 0 ? 0 : counts.length;
}

function missingJoy(table: Record<string, number>) {
  return table.joy ?? 0;
}

function room(id: string) {
  const table: Record<string, string> = { talk: "council" };
  return table[id] ?? "";
}

function keepAgain(memory: readonly string[], line: string) {
  return !memory.includes(line);
}

export function wave6() {
  const missed = useLink([{ from: "Plato", to: "Academy", weight: 0.19 }], "Plato", "Academy", false);
  return [
    MESH.needsWeb,
    MESH.net,
    MESH.projects.length,
    onePeak([0]),
    emptyPeaks([]),
    missingJoy({}),
    emotionSet(2),
    secondGain() < 0.1,
    room("talk"),
    room("no-such-room"),
    keepAgain(["a = 1"], "a = 1"),
    missed[0]?.weight,
    strengthen(0.19),
    learnAction({}, "eat", 1).eat,
    bestAction({ eat: 0.1 }),
    chem(1).serotonin,
    formatTime(1500),
    surrogate(0, 10).k,
    taught([{ kind: "studied", who: "Aristotle", where: "Academy" }, { kind: "founded", who: "Plato", where: "Academy" }], "Aristotle"),
    taught([{ kind: "studied", who: "Aristotle", where: "Academy" }], "Aristotle"),
  ];
}

export function wave6ok() {
  const rows = wave6();
  const expect = [false, "gitbookai", 7, true, 0, 0, 1, true, "council", "", false, 0.19, 0.27, 0.1, "eat", 0.05, "1.50s", 1, "Plato", ""];
  return rows.length === 20 && rows.every((row, index) => row === expect[index]);
}
