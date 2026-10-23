import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const RELATIVE_DATABASE = "generated-artifacts/source-memory/contexts.sqlite";
const MAX_QUERY_LENGTH = 1_000;
const MAX_TERMS = 12;

export interface SourceMemoryStatus {
  available: boolean;
  path: string | null;
  records: number;
  checkedAt: string | null;
  modelTrained: false;
  executionAllowed: false;
  externalStorageSynced: false;
  reason?: "not-generated" | "unreadable";
}

export interface SourceMemoryResult {
  repository: string;
  path: string;
  context: string;
  commit: string;
  evidence: string;
  url: string;
  checkedAt: string;
}

function ancestors(start: string): string[] {
  const paths: string[] = [];
  let current = resolve(start);
  for (let depth = 0; depth < 7; depth += 1) {
    paths.push(resolve(current, RELATIVE_DATABASE));
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return paths;
}

export function resolveSourceMemoryPath(cwd = process.cwd()): string | null {
  const override = process.env.TESSERA_SOURCE_MEMORY_DB?.trim();
  if (override) return override;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [...ancestors(cwd), ...ancestors(moduleDir)]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readOnlyDatabase(path: string): DatabaseSync {
  return new DatabaseSync(path, { readOnly: true });
}

export function getSourceMemoryStatus(): SourceMemoryStatus {
  const path = resolveSourceMemoryPath();
  const base = {
    path,
    modelTrained: false as const,
    executionAllowed: false as const,
    externalStorageSynced: false as const,
  };
  if (!path || !existsSync(path)) {
    return { ...base, available: false, records: 0, checkedAt: null, reason: "not-generated" };
  }
  let db: DatabaseSync | null = null;
  try {
    db = readOnlyDatabase(path);
    const row = db.prepare("SELECT COUNT(*) AS records, MAX(checked_at) AS checkedAt FROM contexts").get() as {
      records?: number;
      checkedAt?: string | null;
    };
    return {
      ...base,
      available: true,
      records: typeof row.records === "number" ? row.records : 0,
      checkedAt: typeof row.checkedAt === "string" ? row.checkedAt : null,
    };
  } catch {
    return { ...base, available: false, records: 0, checkedAt: null, reason: "unreadable" };
  } finally {
    db?.close();
  }
}

export function sourceMemoryTerms(query: string): string[] {
  return (query.slice(0, MAX_QUERY_LENGTH).match(/[A-Za-z0-9_-]{2,}/g) ?? []).slice(0, MAX_TERMS);
}

export function searchSourceMemory(query: string, requestedLimit = 10): SourceMemoryResult[] {
  const terms = sourceMemoryTerms(query);
  if (!terms.length) return [];
  const path = resolveSourceMemoryPath();
  if (!path || !existsSync(path)) throw new Error("source-memory-not-generated");
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit) || 10, 20));
  const match = terms.map((term) => `"${term}"`).join(" AND ");
  let db: DatabaseSync | null = null;
  try {
    db = readOnlyDatabase(path);
    const rows = db.prepare(
      `SELECT repository, path, context, commit_id, evidence, url, checked_at AS checkedAt
       FROM contexts
       WHERE contexts MATCH ?
       ORDER BY bm25(contexts, 2.0, 5.0, 1.0)
       LIMIT ?`,
    ).all(match, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      repository: String(row.repository ?? ""),
      path: String(row.path ?? ""),
      context: String(row.context ?? "").slice(0, 1_500),
      commit: String(row.commit_id ?? ""),
      evidence: String(row.evidence ?? "untrusted"),
      url: String(row.url ?? ""),
      checkedAt: String(row.checkedAt ?? ""),
    }));
  } finally {
    db?.close();
  }
}
