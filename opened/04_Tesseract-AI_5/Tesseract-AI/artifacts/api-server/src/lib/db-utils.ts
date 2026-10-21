interface DbCountRow {
  cnt?: string | number;
  count?: string | number;
}

interface DbResult {
  rows?: DbCountRow[];
  [index: number]: DbCountRow | undefined;
}

export function extractCount(result: unknown): number {
  const r = result as DbResult;
  const row = r?.rows?.[0] ?? (r as Record<number, DbCountRow | undefined>)?.[0];
  if (!row) return 0;
  const val = row.cnt ?? row.count ?? 0;
  return Number(val) || 0;
}
