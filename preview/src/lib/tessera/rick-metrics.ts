/** Twenty-five measured swaps. The percent is (slower - faster) / slower on this run. */

export type MetricRow = { name: string; before: number; after: number; pct: number; same: boolean };

const N = 400;
const ROWS = Array.from({ length: 2000 }, (_, i) => ({ id: `k${i}`, n: i }));
const WORDS = ROWS.map((row) => row.id);
const NEEDLE = "k1500";
const BLANKS = Array.from({ length: 6000 }, (_, i) => (i % 3 === 0 ? "  " : ` ${i} `));

function pct(before: number, after: number) {
  if (before <= 0) return 0;
  return ((before - after) / before) * 100;
}

function time(fn: () => unknown, times: number) {
  fn();
  const start = performance.now();
  let last: unknown;
  for (let i = 0; i < times; i += 1) last = fn();
  return { ms: performance.now() - start, last };
}

function row(name: string, slow: () => unknown, fast: () => unknown, times = N): MetricRow {
  const before = time(slow, times);
  const after = time(fast, times);
  return {
    name,
    before: before.ms,
    after: after.ms,
    pct: pct(before.ms, after.ms),
    same: JSON.stringify(before.last) === JSON.stringify(after.last),
  };
}

function sumLoop(n: number) {
  let total = 0;
  for (let i = 1; i <= n; i += 1) total += i;
  return total;
}

export function measureMetrics(): MetricRow[] {
  const byId = new Map(ROWS.map((item) => [item.id, item.n]));
  const wordSet = new Set(WORDS);
  const numbers = ROWS.map((item) => item.n);
  const window = 40;
  const text = WORDS.join(" ");
  const pattern = /k1500/;
  const compiled = /k1500/;
  const cache = new Map<number, number>();
  const fib = (n: number): number => (n < 2 ? n : fib(n - 1) + fib(n - 2));
  const fibFast = (n: number): number => {
    const hit = cache.get(n);
    if (hit !== undefined) return hit;
    const value = n < 2 ? n : fibFast(n - 1) + fibFast(n - 2);
    cache.set(n, value);
    return value;
  };
  const lowered = WORDS.map((word) => word.toLowerCase());
  const counts = new Map<string, number>();
  for (const word of WORDS) counts.set(word, (counts.get(word) ?? 0) + 1);
  const head = numbers.slice(0, 400);
  const missing = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11];

  return [
    row("find", () => ROWS.find((item) => item.id === NEEDLE)?.n ?? -1, () => byId.get(NEEDLE) ?? -1),
    row("dedupe", () => {
      const out: string[] = [];
      for (const word of WORDS) if (!out.includes(word)) out.push(word);
      return out.length;
    }, () => new Set(WORDS).size, 20),
    row("top", () => [...numbers].sort((a, b) => b - a)[4], () => {
      let first = -1;
      let second = -1;
      let third = -1;
      let fourth = -1;
      let fifth = -1;
      for (const n of numbers) {
        if (n <= fifth) continue;
        if (n > first) {
          fifth = fourth;
          fourth = third;
          third = second;
          second = first;
          first = n;
        } else if (n > second) {
          fifth = fourth;
          fourth = third;
          third = second;
          second = n;
        } else if (n > third) {
          fifth = fourth;
          fourth = third;
          third = n;
        } else if (n > fourth) {
          fifth = fourth;
          fourth = n;
        } else fifth = n;
      }
      return fifth;
    }),
    row("count", () => numbers.filter((n) => n % 2 === 0).length, () => {
      let total = 0;
      for (const n of numbers) if (n % 2 === 0) total += 1;
      return total;
    }),
    row("seen", () => WORDS.includes(NEEDLE), () => wordSet.has(NEEDLE)),
    row("window", () => {
      let best = 0;
      for (let i = 0; i <= numbers.length - window; i += 1) {
        let total = 0;
        for (let j = 0; j < window; j += 1) total += numbers[i + j];
        if (total > best) best = total;
      }
      return best;
    }, () => {
      let total = 0;
      for (let i = 0; i < window; i += 1) total += numbers[i];
      let best = total;
      for (let i = window; i < numbers.length; i += 1) {
        total += numbers[i] - numbers[i - window];
        if (total > best) best = total;
      }
      return best;
    }, 40),
    row("join", () => {
      let line = "";
      for (const word of WORDS.slice(0, 400)) line += `${word},`;
      return line.length;
    }, () => WORDS.slice(0, 400).join(",").length + 1, 40),
    row("memo", () => fib(18), () => fibFast(18), 30),
    row("case", () => WORDS.filter((word) => word.toLowerCase() === NEEDLE).length, () => lowered.filter((word) => word === NEEDLE).length),
    row("regex", () => new RegExp("k1500").test(NEEDLE), () => compiled.test(NEEDLE), 5000),
    row("sum", () => sumLoop(5000), () => (5000 * 5001) / 2),
    row("max", () => {
      let best = head[0];
      for (let i = 0; i < head.length; i += 1) {
        for (let j = i + 1; j < head.length; j += 1) if (head[j] > best) best = head[j];
      }
      return best;
    }, () => {
      let best = head[0];
      for (const n of head) if (n > best) best = n;
      return best;
    }, 6),
    row("pair", () => {
      let hits = 0;
      const head = WORDS.slice(0, 300);
      for (const word of head) if (head.includes(word)) hits += 1;
      return hits;
    }, () => {
      const head = new Set(WORDS.slice(0, 300));
      let hits = 0;
      for (const word of WORDS.slice(0, 300)) if (head.has(word)) hits += 1;
      return hits;
    }, 30),
    row("passes", () => numbers.filter((n) => n > 100).filter((n) => n < 500).length, () => {
      let total = 0;
      for (const n of numbers) if (n > 100 && n < 500) total += 1;
      return total;
    }),
    row("tally", () => WORDS.filter((word) => word === NEEDLE).length, () => counts.get(NEEDLE) ?? 0),
    row("clamp", () => numbers.map((n) => Math.min(100, Math.max(0, n))).reduce((a, b) => a + b, 0), () => {
      let total = 0;
      for (const n of numbers) total += n < 0 ? 0 : n > 100 ? 100 : n;
      return total;
    }),
    row("prefix", () => WORDS.filter((word) => word.toLowerCase().startsWith("k1")).length, () => {
      let total = 0;
      for (const word of WORDS) if (word.charCodeAt(0) === 107 && word.charCodeAt(1) === 49) total += 1;
      return total;
    }),
    row("blank", () => BLANKS.map((item) => item.trim()).filter(Boolean).length, () => {
      let total = 0;
      for (const item of BLANKS) {
        let start = 0;
        let end = item.length;
        while (item.charCodeAt(start) === 32) start += 1;
        while (end > start && item.charCodeAt(end - 1) === 32) end -= 1;
        if (end > start) total += 1;
      }
      return total;
    }),
    row("range", () => numbers.slice(100, 1800).reduce((a, b) => a + b, 0), () => {
      let total = 0;
      for (let i = 100; i < 1800; i += 1) total += numbers[i];
      return total;
    }),
    row("first", () => {
      const copy = [...WORDS];
      const seen = new Set<string>();
      return copy.filter((word) => (seen.has(word) ? false : (seen.add(word), true))).length;
    }, () => new Set(WORDS).size),
    row("gap", () => {
      const have = new Set(missing);
      let cursor = 1;
      while (have.has(cursor)) cursor += 1;
      return cursor;
    }, () => {
      for (let cursor = 1; cursor < 12; cursor += 1) if (!missing.includes(cursor)) return cursor;
      return 12;
    }, 8000),
    row("both", () => numbers.filter((n) => n % 3 === 0).length + numbers.filter((n) => n % 5 === 0).length, () => {
      let threes = 0;
      let fives = 0;
      for (const n of numbers) {
        if (n % 3 === 0) threes += 1;
        if (n % 5 === 0) fives += 1;
      }
      return threes + fives;
    }),
    row("tail", () => {
      let total = 0;
      for (let i = 0; i < numbers.length; i += 1) if (i >= numbers.length - 50) total += numbers[i];
      return total;
    }, () => numbers.slice(-50).reduce((a, b) => a + b, 0)),
    row("keys", () => ROWS.some((item) => item.id === NEEDLE), () => byId.has(NEEDLE)),
    row("lines", () => text.split(" ").length, () => {
      let total = 1;
      for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 32) total += 1;
      return total;
    }),
  ];
}
