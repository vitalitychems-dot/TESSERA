/** Sequence opts out on failure. Selector opts out on success. No file is read. */

export function sequence(results: boolean[]) {
  for (const ok of results) if (!ok) return false;
  return true;
}

export function selector(results: boolean[]) {
  for (const ok of results) if (ok) return true;
  return false;
}
