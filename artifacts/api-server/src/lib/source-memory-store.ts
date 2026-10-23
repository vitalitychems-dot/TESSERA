import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const RELATIVE_DATABASE = "generated-artifacts/source-memory/contexts.sqlite";
const MAX_QUERY_LENGTH = 1_000;
const MAX_TERMS = 12;
const QUERY_STOPWORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "but", "by", "can", "could",
  "did", "do", "does", "for", "from", "have", "how", "i", "in", "into", "is", "it",
  "me", "my", "of", "on", "or", "our", "please", "show", "tell", "the", "their",
  "them", "there", "this", "to", "us", "use", "using", "what", "which", "with",
  "would", "you", "your",
]);
const SAFE_CATEGORIES = new Set([
  "analysis toolkit",
  "free text to video",
  "video generator",
  "agi",
  "consciousness",
  "memory",
  "data transfer",
  "web access",
  "scraping",
  "security",
]);
const EXCLUDED_CATEGORIES = new Set([
  "anti surveillance",
  "anti l/ spy",
  "dox / osint",
  "wifi mapping",
  "wifi defense",
  "model-weight research",
]);

export const SOURCE_MEMORY_CATEGORIES = [
  "analysis toolkit",
  "Free text to video",
  "Video generator",
  "Agi",
  "Consciousness",
  "Memory",
  "Data transfer",
  "Web access",
  "Scraping",
  "Security",
] as const;

export interface SourceMemoryCatalogRecord {
  repository: string;
  description: string;
  categories: string[];
  url: string;
  licenseLabel: string;
  licenseApprovedForIntegration: boolean;
  commit: string;
  trackedFiles: number | null;
  textFilesInspected: number;
  reaStatus: string;
  reaSnapshotFiles: number;
  checkedAt: string;
  installed: false;
  executed: false;
}

export interface SourceMemoryCatalogPage {
  records: SourceMemoryCatalogRecord[];
  total: number;
  categories: string[];
  limit: number;
  offset: number;
}

export interface SourceMemoryStatus {
  available: boolean;
  path: string | null;
  records: number;
  repositories: number;
  catalogRecords: number;
  reaSnapshots: number;
  categories: string[];
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
  categories?: string[];
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

function hasCatalogTable(db: DatabaseSync): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get("repository_catalog"));
}

function safeRecord(record: SourceMemoryCatalogRecord): boolean {
  const normalized = record.categories.map((category) => category.toLowerCase());
  return normalized.some((category) => SAFE_CATEGORIES.has(category)) &&
    !normalized.some((category) => EXCLUDED_CATEGORIES.has(category));
}

function readCatalogRecords(db: DatabaseSync): SourceMemoryCatalogRecord[] {
  if (!hasCatalogTable(db)) return [];
  const rows = db.prepare(
    `SELECT repository, description, categories, url, license_label, license_approved,
            commit_id, tracked_files, text_files_inspected, rea_status,
            rea_snapshot_files, checked_at
     FROM repository_catalog ORDER BY repository`,
  ).all() as Array<Record<string, unknown>>;
  return rows.flatMap((row): SourceMemoryCatalogRecord[] => {
    let categories: unknown;
    try {
      categories = JSON.parse(String(row.categories ?? "[]"));
    } catch {
      return [];
    }
    if (!Array.isArray(categories) || !categories.every((value) => typeof value === "string")) return [];
    const repository = String(row.repository ?? "");
    if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return [];
    const commit = String(row.commit_id ?? "");
    return [{
      repository,
      description: String(row.description ?? "").slice(0, 2_000),
      categories: categories.slice(0, 12),
      url: `https://github.com/${repository}`,
      licenseLabel: String(row.license_label ?? "UNKNOWN").slice(0, 80),
      licenseApprovedForIntegration: row.license_approved === 1,
      commit: /^[0-9a-f]{40}$/.test(commit) ? commit : "",
      trackedFiles: typeof row.tracked_files === "number" && Number.isSafeInteger(row.tracked_files) && row.tracked_files >= 0
        ? row.tracked_files
        : null,
      textFilesInspected: typeof row.text_files_inspected === "number" ? Math.max(0, row.text_files_inspected) : 0,
      reaStatus: String(row.rea_status ?? "not-reviewed").slice(0, 80),
      reaSnapshotFiles: typeof row.rea_snapshot_files === "number" ? Math.max(0, row.rea_snapshot_files) : 0,
      checkedAt: String(row.checked_at ?? "").slice(0, 40),
      installed: false,
      executed: false,
    }];
  }).filter(safeRecord);
}

export function getSourceMemoryStatus(): SourceMemoryStatus {
  const path = resolveSourceMemoryPath();
  const base = {
    path,
    repositories: 0,
    catalogRecords: 0,
    reaSnapshots: 0,
    categories: [] as string[],
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
    const catalog = readCatalogRecords(db);
    const allCatalog = hasCatalogTable(db)
      ? db.prepare("SELECT repository, rea_status FROM repository_catalog").all() as Array<Record<string, unknown>>
      : [];
    const categories = [...new Set(catalog.flatMap((item) => item.categories))].sort();
    return {
      ...base,
      available: true,
      records: typeof row.records === "number" ? row.records : 0,
      repositories: allCatalog.length,
      catalogRecords: catalog.length,
      reaSnapshots: allCatalog.filter((item) => String(item.rea_status ?? "").startsWith("rea-")).length,
      categories,
      checkedAt: typeof row.checkedAt === "string" ? row.checkedAt : null,
    };
  } catch {
    return { ...base, available: false, records: 0, checkedAt: null, reason: "unreadable" };
  } finally {
    db?.close();
  }
}

export function getSourceMemoryCatalog(options: {
  category?: string;
  limit?: number;
  offset?: number;
} = {}): SourceMemoryCatalogPage {
  const category = options.category?.trim();
  if (category && !SOURCE_MEMORY_CATEGORIES.some((item) => item.toLowerCase() === category.toLowerCase())) {
    throw new Error("source-memory-category-invalid");
  }
  const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 100) || 100, 200));
  const offset = Math.max(0, Math.min(Math.trunc(options.offset ?? 0) || 0, 100_000));
  const path = resolveSourceMemoryPath();
  if (!path || !existsSync(path)) throw new Error("source-memory-not-generated");
  let db: DatabaseSync | null = null;
  try {
    db = readOnlyDatabase(path);
    const all = readCatalogRecords(db);
    const filtered = category
      ? all.filter((item) => item.categories.some((value) => value.toLowerCase() === category.toLowerCase()))
      : all;
    const categories = [...new Set(all.flatMap((item) => item.categories))].sort();
    return { records: filtered.slice(offset, offset + limit), total: filtered.length, categories, limit, offset };
  } finally {
    db?.close();
  }
}

export function sourceMemoryTerms(query: string): string[] {
  return [...new Set(
    (query.slice(0, MAX_QUERY_LENGTH).match(/[A-Za-z0-9_-]{2,}/g) ?? [])
      .filter((term) => !QUERY_STOPWORDS.has(String(term).toLowerCase())),
  )].slice(0, MAX_TERMS);
}

export function searchSourceMemory(
  query: string,
  requestedLimit = 10,
  options: { benignOnly?: boolean; category?: string } = {},
): SourceMemoryResult[] {
  const terms = sourceMemoryTerms(query);
  if (!terms.length) return [];
  const path = resolveSourceMemoryPath();
  if (!path || !existsSync(path)) throw new Error("source-memory-not-generated");
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit) || 10, 20));
  const match = terms.map((term) => `"${term}"`).join(" AND ");
  let db: DatabaseSync | null = null;
  try {
    db = readOnlyDatabase(path);
    let rows: Array<Record<string, unknown>>;
    if (options.benignOnly) {
      const catalog = readCatalogRecords(db).filter((item) =>
        !options.category || item.categories.some((value) => value.toLowerCase() === options.category?.toLowerCase()),
      );
      if (options.category && !SOURCE_MEMORY_CATEGORIES.some((item) => item.toLowerCase() === options.category?.toLowerCase())) {
        throw new Error("source-memory-category-invalid");
      }
      if (!catalog.length) return [];
      const placeholders = catalog.map(() => "?").join(",");
      rows = db.prepare(
        `SELECT contexts.repository, contexts.path, contexts.context, contexts.commit_id,
                contexts.evidence, contexts.url, contexts.checked_at AS checkedAt,
                repository_catalog.categories
         FROM contexts JOIN repository_catalog USING(repository)
         WHERE contexts MATCH ? AND contexts.repository IN (${placeholders})
         ORDER BY bm25(contexts, 2.0, 5.0, 1.0)
         LIMIT ?`,
      ).all(match, ...catalog.map((item) => item.repository), limit) as Array<Record<string, unknown>>;
    } else {
      rows = db.prepare(
        `SELECT repository, path, context, commit_id, evidence, url, checked_at AS checkedAt
         FROM contexts
         WHERE contexts MATCH ?
         ORDER BY bm25(contexts, 2.0, 5.0, 1.0)
         LIMIT ?`,
      ).all(match, limit) as Array<Record<string, unknown>>;
    }
    return rows.map((row) => ({
      repository: String(row.repository ?? ""),
      path: String(row.path ?? ""),
      context: String(row.context ?? "").slice(0, 1_500),
      commit: String(row.commit_id ?? ""),
      evidence: String(row.evidence ?? "untrusted"),
      url: String(row.url ?? ""),
      checkedAt: String(row.checkedAt ?? ""),
      categories: typeof row.categories === "string" ? JSON.parse(row.categories) as string[] : undefined,
    }));
  } finally {
    db?.close();
  }
}
