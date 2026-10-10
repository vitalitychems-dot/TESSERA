/** Local steps from the ten desk cards. The advertised percentages were not measured. */

export function rankTasks(tasks: { name: string; impact: number }[]) {
  return [...tasks].sort((a, b) => b.impact - a.impact || a.name.localeCompare(b.name));
}

export function storeOnce(items: { key: string; body: string }[]) {
  const bodies = new Map<string, string>();
  const refs: { key: string; id: string }[] = [];
  for (const item of items) {
    let id = [...bodies.entries()].find(([, body]) => body === item.body)?.[0];
    if (!id) {
      id = `s${bodies.size}`;
      bodies.set(id, item.body);
    }
    refs.push({ key: item.key, id });
  }
  return { stored: bodies.size, refs };
}

export function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function transferGain(delta: number, link: number) {
  return delta * sigmoid(link);
}

export function cosine(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    left += a[i] * a[i];
    right += b[i] * b[i];
  }
  if (left === 0 || right === 0) return 0;
  return dot / Math.sqrt(left * right);
}

export function grounded(claim: number[], facts: number[][], floor = 0.6) {
  const best = facts.reduce((max, fact) => Math.max(max, cosine(claim, fact)), 0);
  return { best, kept: best >= floor };
}

export const PHI = (1 + Math.sqrt(5)) / 2;

export function councilTally(votes: { yes: boolean; specialist: boolean }[]) {
  let yes = 0;
  let no = 0;
  for (const vote of votes) {
    const share = vote.specialist ? PHI : 1;
    if (vote.yes) yes += share;
    else no += share;
  }
  return { yes, no, passed: yes > no };
}

export function finishOnce(task: string) {
  return { task, done: true, alive: false };
}

export function consolidate(memories: string[]) {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    for (const word of memory.toLowerCase().split(/\W+/)) {
      if (word.length < 5) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([word]) => word).sort();
}

export function reflectDiff(before: string[], after: string[]) {
  const prior = new Set(before);
  return after.filter((line) => !prior.has(line));
}

/** Near-duplicates merge. The longer text is kept. The floor is 0.92. */
export function crystallize(rows: { text: string; vector: number[] }[], floor = 0.92) {
  const kept: { text: string; vector: number[] }[] = [];
  for (const row of rows) {
    const prior = kept.find((item) => cosine(item.vector, row.vector) > floor);
    if (!prior) kept.push({ ...row });
    else if (row.text.length > prior.text.length) prior.text = row.text;
  }
  return kept;
}

export function recallCache(limit: number) {
  const order: string[] = [];
  const values = new Map<string, string>();
  return {
    put(key: string, value: string) {
      const at = order.indexOf(key);
      if (at >= 0) order.splice(at, 1);
      order.push(key);
      values.set(key, value);
      while (order.length > limit) {
        const old = order.shift();
        if (old) values.delete(old);
      }
    },
    get(key: string) {
      if (!values.has(key)) return null;
      order.splice(order.indexOf(key), 1);
      order.push(key);
      return values.get(key) ?? null;
    },
    has(key: string) {
      return values.has(key);
    },
  };
}
