const SQLSTATE = /^[0-9A-Z]{5}$/;
const SAFE_DB_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function readErrorName(err: Error): string {
  const own = err.name;
  if (own.length > 0 && own !== "Error" && SAFE_DB_NAME.test(own)) return own;
  const ctor = err.constructor?.name;
  if (typeof ctor === "string" && ctor !== "Error" && SAFE_DB_NAME.test(ctor)) return ctor;
  if (own.length > 0 && SAFE_DB_NAME.test(own)) return own;
  return "Error";
}

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
  const name = err instanceof Error ? readErrorName(err) : "Error";
  return { name, code: readCode(err) };
}
