/** Our update. Read from the checkout's learner. Their class is not imported. */

export function learnAction(
  table: Record<string, number>,
  action: string,
  reward: number,
  alpha = 0.1,
  gamma = 0.9,
  future = 0,
) {
  const old = table[action] ?? 0;
  return { ...table, [action]: old + alpha * (reward + gamma * future - old) };
}

export function bestAction(table: Record<string, number>) {
  const ranked = Object.entries(table).sort((a, b) => b[1] - a[1]);
  if (ranked.length < 1) return "";
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return "";
  return ranked[0][0];
}

export function rewardEat() {
  const start = { eat: 0, rest: 0 };
  const once = learnAction(start, "eat", 1);
  const twice = learnAction(once, "eat", 1);
  return { once, twice, best: bestAction(twice) };
}
