import { useQuery } from "@tanstack/react-query";
import {
  getSourceMemoryCatalog,
  getSourceMemoryStatus,
  searchSourceMemory,
} from "@workspace/api-client-react";

export type SourceMemoryCatalogPage = Awaited<ReturnType<typeof getSourceMemoryCatalog>>;
export type SourceMemoryStatus = Awaited<ReturnType<typeof getSourceMemoryStatus>>;
export type SourceMemoryResult = Awaited<ReturnType<typeof searchSourceMemory>>["results"][number];

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseStatus(value: unknown): SourceMemoryStatus {
  const body = record(value);
  if (
    !body || body.ok !== true || typeof body.available !== "boolean" ||
    typeof body.records !== "number" || !Number.isSafeInteger(body.records) || body.records < 0 ||
    typeof body.repositories !== "number" || !Number.isSafeInteger(body.repositories) || body.repositories < 0 ||
    typeof body.catalogRecords !== "number" || !Number.isSafeInteger(body.catalogRecords) || body.catalogRecords < 0 ||
    typeof body.reaSnapshots !== "number" || !Number.isSafeInteger(body.reaSnapshots) || body.reaSnapshots < 0 ||
    !Array.isArray(body.categories) || !body.categories.every((category) => typeof category === "string") ||
    body.modelTrained !== false || body.executionAllowed !== false || body.externalStorageSynced !== false
  ) throw new Error("Source-memory status did not match the storage contract.");
  return {
    ok: true,
    available: body.available,
    path: typeof body.path === "string" ? body.path : null,
    records: body.records,
    repositories: body.repositories,
    catalogRecords: body.catalogRecords,
    reaSnapshots: body.reaSnapshots,
    categories: body.categories.slice(0, 32) as string[],
    checkedAt: typeof body.checkedAt === "string" ? body.checkedAt : null,
    modelTrained: false,
    executionAllowed: false,
    externalStorageSynced: false,
    reason: body.reason === "not-generated" || body.reason === "unreadable" ? body.reason : undefined,
  };
}

function parseResults(value: unknown): SourceMemoryResult[] {
  const body = record(value);
  if (!body || body.ok !== true || !Array.isArray(body.results)) {
    throw new Error("Source-memory search did not match the evidence-pointer contract.");
  }
  return body.results.flatMap((candidate): SourceMemoryResult[] => {
    const item = record(candidate);
    if (!item || typeof item.repository !== "string" || typeof item.path !== "string" ||
        typeof item.context !== "string" || typeof item.url !== "string") return [];
    return [{
      repository: item.repository.slice(0, 120),
      path: item.path.slice(0, 240),
      context: item.context.slice(0, 1_500),
      commit: typeof item.commit === "string" ? item.commit : "",
      evidence: typeof item.evidence === "string" ? item.evidence : "untrusted",
      url: /^https?:\/\//.test(item.url) ? item.url : "",
      checkedAt: typeof item.checkedAt === "string" ? item.checkedAt : "",
      categories: Array.isArray(item.categories) && item.categories.every((category) => typeof category === "string")
        ? item.categories.slice(0, 12) as string[]
        : undefined,
    }];
  });
}

function parseCatalog(value: unknown): SourceMemoryCatalogPage {
  const body = record(value);
  if (!body || body.ok !== true || !Array.isArray(body.records) ||
      typeof body.total !== "number" || !Number.isSafeInteger(body.total) || body.total < 0 ||
      !Array.isArray(body.categories) || !body.categories.every((category) => typeof category === "string") ||
      typeof body.limit !== "number" || typeof body.offset !== "number") {
    throw new Error("Source-memory catalog did not match the metadata contract.");
  }
  const records = body.records.flatMap((value): SourceMemoryCatalogPage["records"] => {
    const item = record(value);
    if (!item || typeof item.repository !== "string" || typeof item.description !== "string" ||
        !Array.isArray(item.categories) || !item.categories.every((category) => typeof category === "string") ||
        typeof item.url !== "string" || typeof item.licenseLabel !== "string" ||
        typeof item.licenseApprovedForIntegration !== "boolean" || typeof item.commit !== "string" ||
        (item.trackedFiles !== null && typeof item.trackedFiles !== "number") ||
        typeof item.textFilesInspected !== "number" || typeof item.reaStatus !== "string" ||
        typeof item.reaSnapshotFiles !== "number" || typeof item.checkedAt !== "string" ||
        item.installed !== false || item.executed !== false) return [];
    return [{
      repository: item.repository.slice(0, 120),
      description: item.description.slice(0, 2_000),
      categories: item.categories.slice(0, 12) as string[],
      url: /^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(item.url) ? item.url : "",
      licenseLabel: item.licenseLabel.slice(0, 80),
      licenseApprovedForIntegration: item.licenseApprovedForIntegration,
      commit: /^[0-9a-f]{40}$/.test(item.commit) ? item.commit : "",
      trackedFiles: item.trackedFiles,
      textFilesInspected: item.textFilesInspected,
      reaStatus: item.reaStatus.slice(0, 80),
      reaSnapshotFiles: item.reaSnapshotFiles,
      checkedAt: item.checkedAt.slice(0, 40),
      installed: false,
      executed: false,
    }];
  });
  return {
    records,
    total: body.total,
    categories: body.categories.slice(0, 32) as string[],
    limit: body.limit,
    offset: body.offset,
    ok: true,
  };
}

export function useSourceMemoryStatus() {
  return useQuery({
    queryKey: ["source-memory-status"],
    queryFn: async ({ signal }) => parseStatus(await getSourceMemoryStatus({ signal, credentials: "include", cache: "no-store" })),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useSourceMemoryCatalog(category: string | null = null) {
  const normalized = category?.trim() || "";
  return useQuery({
    queryKey: ["source-memory-catalog", normalized],
    queryFn: async ({ signal }) => parseCatalog(await getSourceMemoryCatalog({
      limit: 200,
      offset: 0,
      ...(normalized ? { category: normalized } : {}),
    }, { signal, credentials: "include", cache: "no-store" })),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useSourceMemorySearch(query: string) {
  const normalized = query.trim().slice(0, 200);
  return useQuery({
    queryKey: ["source-memory-search", normalized],
    enabled: normalized.length >= 2,
    queryFn: async ({ signal }) => parseResults(await searchSourceMemory(
      { q: normalized, limit: 20 },
      { signal, credentials: "include", cache: "no-store" },
    )),
    staleTime: 30_000,
    retry: 1,
  });
}
