/** Search and pin are local. They do not open a file body. */

export function findLines<T extends { content: string }>(lines: T[], query: string) {
  const want = query.trim().toLowerCase();
  if (!want) return [];
  return lines
    .filter((line) => line.content.toLowerCase().includes(want))
    .sort((a, b) => Number(!a.content.toLowerCase().startsWith(want)) - Number(!b.content.toLowerCase().startsWith(want)))
    .slice(0, 8);
}

export function nameQuery(text: string) {
  const want = text.trim();
  return want.length >= 3 ? want : "";
}

export function pinWrite(touched: boolean, id: string | null) {
  if (!touched) return "keep" as const;
  return id ? ("set" as const) : ("clear" as const);
}

export function clearSearch() {
  return "";
}

export function pinLine(current: string | null, next: string) {
  return current === next ? null : next;
}
