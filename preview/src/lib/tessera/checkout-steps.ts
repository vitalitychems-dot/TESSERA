/** Read from the checkouts. Their files are not imported. */

export function queryOk(query: string) {
  const text = query.trim();
  if (text.length < 3 || text.length > 1000) return false;
  const lower = text.toLowerCase();
  return !["<script", "javascript:", "eval(", "exec("].some((pattern) => lower.includes(pattern));
}

export function riseState(hunger: number, fatigue: number, delta = 1) {
  return {
    hunger: Math.min(1, hunger + 0.1 * delta),
    fatigue: Math.min(1, fatigue + 0.05 * delta),
  };
}

export function readCheckouts() {
  const next = riseState(0.5, 0.5);
  const allowed = queryOk("hello");
  const proved = allowed && !queryOk("no") && !queryOk("<script>") && next.hunger === 0.6 && next.fatigue === 0.55;
  return {
    proved,
    hunger: next.hunger,
    said: proved
      ? "Two functions were read. A query of hello is allowed. Hunger 0.5 becomes 0.6. Fatigue 0.5 becomes 0.55."
      : "The checkout read missed.",
  };
}

/** More functions from the same folders. Their libraries are not imported. */

export function meanSquare(left: number[], right: number[]) {
  const n = Math.min(left.length, right.length);
  let sum = 0;
  for (let index = 0; index < n; index += 1) {
    const gap = left[index] - right[index];
    sum += gap * gap;
  }
  return sum;
}

export function top1(rows: number[][], target: number[]) {
  let hit = 0;
  rows.forEach((row, index) => {
    let best = 0;
    row.forEach((value, at) => {
      if (value > row[best]) best = at;
    });
    if (best === target[index]) hit += 1;
  });
  return rows.length ? (100 * hit) / rows.length : 0;
}

export function surrogate(epoch: number, total: number) {
  return { t: 10 ** (-3 + (4 / total) * epoch), k: 1 };
}

export function sanitize(content: string) {
  const clean = content.trim().replace(/<[^>]*>/g, "");
  if (clean.length > 10000) return `${clean.slice(0, 10000)}...`;
  return clean;
}

export function readBatch() {
  const square = meanSquare([1, 2], [1, 0]);
  const score = top1(
    [
      [0, 1],
      [1, 0],
    ],
    [1, 0],
  );
  const scale = surrogate(0, 10);
  const clean = sanitize(" <b>hi</b> ");
  const proved = square === 4 && score === 100 && Math.abs(scale.t - 0.001) < 1e-12 && scale.k === 1 && clean === "hi";
  return {
    proved,
    said: proved
      ? "Four more functions were read. The square gap is 4. The top score is 100. The scale starts at 0.001. A tag is removed."
      : "The batch missed.",
  };
}

export function formatTime(ms: number) {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function confidence(achieved: boolean, complexity = 1, coverage = 1) {
  const base = achieved ? 1 : 0;
  const complexityFactor = Math.max(0.5, 1 - (complexity - 1) * 0.1);
  const coverageFactor = Math.max(0.3, coverage);
  return Math.min(1, Math.max(0, base * complexityFactor * coverageFactor));
}

export function chem(index: number) {
  return { dopamine: 0.1 * (index % 5), serotonin: 0.05 * (index % 3) };
}

type Hole = { kind: "value"; value: string } | { kind: "hole"; next: number };

export function holePush(vec: readonly Hole[], firstHole: number, value: string) {
  if (firstHole >= vec.length) {
    return { index: vec.length, firstHole: vec.length + 1, vec: [...vec, { kind: "value" as const, value }] };
  }
  const cell = vec[firstHole];
  if (!cell || cell.kind !== "hole") return { index: -1, firstHole, vec };
  const next = [...vec];
  next[firstHole] = { kind: "value", value };
  return { index: firstHole, firstHole: cell.next, vec: next };
}

export function readMore() {
  const timed = formatTime(0.5) === "0.50ms" && formatTime(12) === "12ms" && formatTime(1500) === "1.50s";
  const score = confidence(true, 1, 1) === 1 && confidence(false, 1, 1) === 0 && confidence(true, 11, 1) === 0.5;
  const mix = chem(5);
  const pushed = holePush([], 0, "a");
  const proved = timed && score && mix.dopamine === 0 && mix.serotonin === 0.1 && pushed.index === 0 && pushed.firstHole === 1;
  return {
    proved,
    said: proved
      ? "Four more were read. Half a millisecond stays half. A missed goal scores 0. Index 5 has serotonin 0.1. A hole takes the first empty seat."
      : "The next batch missed.",
  };
}

export function averageUpdate(sum: number, count: number, value: number, n = 1) {
  const nextSum = sum + value * n;
  const nextCount = count + n;
  return { val: value, sum: nextSum, count: nextCount, avg: nextCount ? nextSum / nextCount : 0 };
}

export function hiddenReward(plot: Record<string, number>, reward: number) {
  return { ...plot, hidden: (plot.hidden ?? 0) + reward };
}

export function stepKind(kind: "mid" | "last", reward: number) {
  return { kind, reward, discount: kind === "last" ? 0 : 1 };
}

export function readImported() {
  const once = averageUpdate(0, 0, 2);
  const twice = averageUpdate(once.sum, once.count, 4);
  const reward = hiddenReward(hiddenReward({}, 3), 2);
  const last = stepKind("last", 1);
  const proved = twice.avg === 3 && reward.hidden === 5 && last.discount === 0 && stepKind("mid", 1).discount === 1;
  return {
    proved,
    said: proved
      ? "Three functions were taken from cloned source. An average of 2 then 4 is 3. A hidden reward of 3 then 2 is 5. A last step discounts to 0."
      : "The import missed.",
  };
}
