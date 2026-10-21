import { bestAction, learnAction } from "./local-learn.ts";
import { clampUnit, qStep, stateKey } from "./step-math.ts";

/** Ten changes. Each one is a result the looser version did not return. */

export function learnState(
  tables: Record<string, Record<string, number>>,
  hunger: number,
  fatigue: number,
  action: string,
  reward: number,
  nextHunger: number,
  nextFatigue: number,
) {
  const prev = stateKey(clampUnit(hunger), clampUnit(fatigue));
  const next = stateKey(clampUnit(nextHunger), clampUnit(nextFatigue));
  const futureValues = Object.values(tables[next] ?? {});
  const future = futureValues.length ? Math.max(...futureValues) : 0;
  return { ...tables, [prev]: learnAction(tables[prev] ?? {}, action, reward, 0.1, 0.9, future) };
}

export function emotionGet(table: Record<string, number>, name: string) {
  return table[name] ?? 0;
}

export function emotionSet(table: Record<string, number>, name: string, value: number) {
  return { ...table, [name]: clampUnit(value) };
}

export function findPeaks(counts: readonly number[], minFraction = 0.05) {
  if (!counts.length) return [];
  const total = counts.reduce((sum, count) => sum + count, 0);
  const minCount = total * minFraction;
  const peaks: number[] = [];
  const last = counts.length - 1;
  if (counts.length >= 2 && counts[0] > counts[1]) peaks.push(0);
  for (let index = 1; index < last; index += 1) {
    if (counts[index] > counts[index - 1] && counts[index] > counts[index + 1]) peaks.push(index);
  }
  if (counts.length >= 2 && counts[last] > counts[last - 1]) peaks.push(last);
  return peaks.filter((index) => counts[index] >= minCount);
}

export function peakCenter(peaks: readonly number[], edges: readonly number[]) {
  return peaks.map((peak) => (edges[peak] + edges[peak + 1]) / 2);
}

export function dominantPair(peaks: readonly number[], counts: readonly number[], edges: readonly number[]) {
  if (peaks.length < 2) return null;
  const top = [...peaks].sort((a, b) => counts[b] - counts[a]).slice(0, 2).sort((a, b) => a - b);
  return [(edges[top[0]] + edges[top[0] + 1]) / 2, (edges[top[1]] + edges[top[1] + 1]) / 2] as const;
}

export function keepLine(memory: readonly string[], line: string) {
  if (memory.includes(line)) return { memory: [...memory], added: false };
  return { memory: [...memory, line], added: true };
}

export function tenBig() {
  const learned = learnState({}, 0.5, 0.5, "eat", 1, 0.9, 0.9);
  const flat = learnAction({}, "eat", 1).eat;
  const withFuture = learnAction({ eat: 0 }, "eat", 1, 0.1, 0.9, 1).eat;
  const withoutFuture = learnAction({ eat: 0 }, "eat", 1, 0.1, 0.9, 0).eat;
  let value = 0;
  const gains: number[] = [];
  for (let step = 0; step < 3; step += 1) {
    const next = qStep(value, 1, 0);
    gains.push(next - value);
    value = next;
  }
  const kept = keepLine(keepLine([], "scale low = 0").memory, "scale low = 0");
  const checks = [
    learned["h5_f5"]?.eat !== undefined && learned["h9_f9"] === undefined,
    bestAction({ eat: 1, rest: 1 }) === "",
    withFuture > withoutFuture,
    stateKey(clampUnit(1.4), clampUnit(-0.2)) === "h10_f0" && stateKey(1.4, -0.2) === "h14_f-2",
    gains[0] > gains[1] && gains[1] > gains[2],
    emotionGet({}, "joy") === 0 && emotionSet({}, "joy", 2).joy === 1,
    findPeaks([1, 5, 1]).join(",") === "1" && findPeaks([]).length === 0,
    peakCenter([0], [0, 10])[0] === 5,
    dominantPair([0], [5], [0, 1]) === null && dominantPair([0, 2], [1, 0, 4], [0, 10, 20, 30])?.[0] === 5,
    kept.added === false && kept.memory.length === 1,
  ];
  const passed = checks.filter(Boolean).length;
  return {
    proved: passed === 10 && flat === 0.1,
    passed,
    said:
      passed === 10
        ? "Ten of ten moved. A reward in one state does not write the other. A tie is not a choice. A future value raises the step. Hunger past 1 is clamped before the key. The third reward adds less than the second. A missing emotion is 0. The middle peak is kept. Its center is 5. One peak is not a pair. A repeated line is not stored twice."
        : `${passed} of 10 moved.`,
  };
}
