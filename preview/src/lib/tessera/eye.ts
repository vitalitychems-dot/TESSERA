/** The chamber eye. It reads her own kept lines. It does not watch people. */

export type KeptLine = { key: string; kind: string; line: string };

export function signatureOf(lines: readonly string[]) {
  let hash = 2166136261;
  for (const line of lines) {
    for (let i = 0; i < line.length; i += 1) {
      hash ^= line.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function facetOf(lines: readonly string[]) {
  return lines.some((line) => /\bfire\b/i.test(line)) ? "fire" : "water";
}

export function redSparrow(rows: readonly KeptLine[]) {
  const kinds = new Map<string, number>();
  for (const row of rows) kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);
  return {
    seen: rows.length,
    kinds: [...kinds.entries()].map(([kind, count]) => ({ kind, count })),
    signature: signatureOf(rows.map((row) => row.line)),
    facet: facetOf(rows.map((row) => row.line)),
    watchesPeople: false as const,
  };
}
