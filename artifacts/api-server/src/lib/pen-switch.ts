/**
 * Flag readers for the hosted pen and the local pen.
 * No imports, so a health check can load this file without the database client.
 * This module does not read or write any TESSERA_ENABLE_* variable.
 */

/** Hosted pen. Off unless the value is "1" or "true" after trim. */
export function isTesseraPenEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = (env.TESSERA_PEN_ENABLED ?? "0").trim().toLowerCase();
  return value === "1" || value === "true";
}

/**
 * Local pen. On only when the trimmed value is exactly "1".
 * "true" does not turn it on.
 */
export function isLocalPenFlagOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.TESSERA_PEN_LOCAL ?? "0").trim() === "1";
}
