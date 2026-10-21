/** Five more rounds. Each function runs. No percentage is claimed. */

export function takeFirst<T>(rows: T[], count: number) {
  return rows.slice(0, Math.max(0, count));
}

export function renameKey(book: Map<string, string>, from: string, to: string) {
  if (!book.has(from) || book.has(to)) return false;
  book.set(to, book.get(from) ?? "");
  book.delete(from);
  return true;
}

export function tieFails(yes: number, no: number) {
  return yes > no;
}

export function fresh(age: number, window: number) {
  return age >= 0 && age <= window;
}

export function zipPair<A, B>(left: A[], right: B[]) {
  const count = Math.min(left.length, right.length);
  return Array.from({ length: count }, (_, index) => [left[index], right[index]] as const);
}

export function waiting(blocker: string | null, done: Set<string>) {
  return Boolean(blocker && !done.has(blocker));
}

export function shards<T>(rows: T[], count: number) {
  const piles: T[][] = Array.from({ length: Math.max(1, count) }, () => []);
  rows.forEach((row, index) => piles[index % piles.length].push(row));
  return piles;
}

export function redact(text: string) {
  return text.replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[held]");
}

export function allowRetry(tries: number) {
  return tries < 2;
}

export function newest(rows: { key: string; tick: number; value: string }[]) {
  const kept = new Map<string, { tick: number; value: string }>();
  for (const row of rows) {
    const prior = kept.get(row.key);
    if (!prior || row.tick >= prior.tick) kept.set(row.key, { tick: row.tick, value: row.value });
  }
  return kept;
}

export function needCount(yes: number, need: number) {
  return yes >= need;
}

export function firstOf(rows: string[]) {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const row of rows) {
    if (seen.has(row)) continue;
    seen.add(row);
    kept.push(row);
  }
  return kept;
}

export function left(used: number, cap: number) {
  return Math.max(0, cap - used);
}

export function markDone<T extends { done: boolean }>(note: T) {
  return { ...note, done: true };
}

export function requireOwner(owner: string) {
  return owner.trim().length > 0;
}

export function chunks<T>(rows: T[], size: number) {
  const step = Math.max(1, size);
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += step) out.push(rows.slice(index, index + step));
  return out;
}

export function preferLocal(local: string | null, remote: string) {
  return local && local.trim() ? local : remote;
}

export function tryLock(locks: Set<string>, key: string) {
  if (locks.has(key)) return false;
  locks.add(key);
  return true;
}

export function unlock(locks: Set<string>, key: string) {
  return locks.delete(key);
}

export function shortAsk(ask: string, cap: number) {
  const trimmed = ask.trim().replace(/\s+/g, " ");
  return trimmed.length <= cap ? trimmed : trimmed.slice(0, cap).trim();
}

export function laneOrder(names: string[]) {
  const order = ["Father", "Tessera", "Cursor", "Gitbook", "Rick"];
  const rank = (name: string) => {
    const at = order.indexOf(name);
    return at < 0 ? order.length : at;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function missing(fields: Record<string, string>, required: string[]) {
  return required.filter((key) => !fields[key]?.trim());
}

export function sameWord(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function nextGap(nums: number[]) {
  const have = new Set(nums);
  let cursor = 1;
  while (have.has(cursor)) cursor += 1;
  return cursor;
}
