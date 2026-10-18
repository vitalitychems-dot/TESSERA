const SQLSTATE = /^[0-9A-Z]{5}$/;

function readCode(err: unknown): string {
  const seen = new Set<unknown>();
  let current = err;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object" || seen.has(current)) break;
    seen.add(current);
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string" && SQLSTATE.test(record.code)) return record.code;
    current = record.cause;
  }
  return "none";
}

/** Name and SQLSTATE only. Never message, stack, query text, or parameters. */
export function safeDbErrorLog(err: unknown): { name: string; code: string } {
  const name = err instanceof Error && err.name.length > 0 ? err.name : "Error";
  return { name, code: readCode(err) };
}
