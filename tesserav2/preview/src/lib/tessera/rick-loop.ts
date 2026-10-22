/** A second pass of desk steps. Each one runs. None of them is a measured percentage. */

export function rankByNeed(tasks: { name: string; impact: number; due: number }[]) {
  return [...tasks].sort((a, b) => b.impact - a.impact || a.due - b.due || a.name.localeCompare(b.name));
}

export function twoThirds(yes: number, total: number) {
  return total > 0 && yes * 3 >= total * 2;
}

export function oncePer(key: string, seen: Set<string>) {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

export function splitWork(name: string, size: number, cap: number) {
  if (size <= cap) return [name];
  return [`${name} a`, `${name} b`];
}

export function writeKey(book: Map<string, string>, key: string, value: string) {
  const prior = book.get(key);
  if (prior !== undefined && prior !== value) return { ok: false as const, conflict: true };
  book.set(key, value);
  return { ok: true as const, conflict: false };
}

export function spend(used: number, cost: number, cap: number) {
  if (used + cost > cap) return { ok: false as const, used };
  return { ok: true as const, used: used + cost };
}

export function twoSources(hits: string[]) {
  return new Set(hits.filter(Boolean)).size >= 2;
}

export function sweep<T extends { tick: number }>(rows: T[], now: number, maxAge: number) {
  return rows.filter((row) => now - row.tick <= maxAge);
}

export function noteMistake(log: string[], mistake: string, limit: number) {
  if (log.includes(mistake)) return log.slice(-limit);
  return [...log, mistake].slice(-limit);
}

export function handoff(ask: string, owner: string) {
  return { ask: ask.trim(), owner, done: false as const };
}
