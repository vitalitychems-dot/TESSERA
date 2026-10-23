import { useQuery } from "@tanstack/react-query";

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

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

function parseStatus(value: unknown): SourceMemoryStatus {
  const body = record(value);
  if (
    !body || body.ok !== true || typeof body.available !== "boolean" ||
    typeof body.records !== "number" || !Number.isSafeInteger(body.records) || body.records < 0 ||
    body.modelTrained !== false || body.executionAllowed !== false || body.externalStorageSynced !== false
  ) throw new Error("Source-memory status did not match the storage contract.");
  return {
    available: body.available,
    path: typeof body.path === "string" ? body.path : null,
    records: body.records,
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
    }];
  });
}

export function useSourceMemoryStatus() {
  return useQuery({
    queryKey: ["source-memory-status"],
    queryFn: async ({ signal }) => parseStatus(await readJson("/api/source-memory/status", signal)),
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
    queryFn: async ({ signal }) => parseResults(await readJson(`/api/source-memory/search?q=${encodeURIComponent(normalized)}&limit=20`, signal)),
    staleTime: 30_000,
    retry: 1,
  });
}
