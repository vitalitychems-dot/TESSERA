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
