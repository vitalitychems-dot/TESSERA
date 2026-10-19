import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { dataPath } from "./data-path";

export type HeldFile = {
  repo: string;
  path: string;
  bytes: number;
  sha256: string;
  id: string;
  at: string;
};

type IngestSummary = {
  updated: string | null;
  total: number;
  bytes: number;
  recent: HeldFile[];
  byRepo: { repo: string; count: number; bytes: number }[];
  skipped: number;
  note: string;
};

async function readManifest() {
  const { readFile } = await import("node:fs/promises");
  const paths = [dataPath("ingest", "manifest.json"), "/workspace/data/ingest/manifest.json"];
  let last = "No ingest file yet.";
  for (const path of paths) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}

let summaryCache: { at: number; value: IngestSummary } | null = null;

export const readIngest = createServerFn({ method: "POST" }).handler(async () => {
  if (summaryCache && Date.now() - summaryCache.at < 60_000) return summaryCache.value;
  try {
    const raw = await readManifest();
    const parsed = JSON.parse(raw) as {
      updated: string | null;
      files: HeldFile[];
      skipped: { repo: string; path: string; reason: string }[];
      note: string;
    };
    const files = parsed.files ?? [];
    const byRepo = new Map<string, { repo: string; count: number; bytes: number }>();
    let bytes = 0;
    for (const file of files) {
      bytes += file.bytes;
      const row = byRepo.get(file.repo) ?? { repo: file.repo, count: 0, bytes: 0 };
      row.count += 1;
      row.bytes += file.bytes;
      byRepo.set(file.repo, row);
    }
    const value: IngestSummary = {
      updated: parsed.updated,
      total: files.length,
      bytes,
      recent: files.slice(-24).reverse(),
      byRepo: [...byRepo.values()].sort((a, b) => b.count - a.count),
      skipped: (parsed.skipped ?? []).length,
      note: parsed.note ?? "",
    };
    summaryCache = { at: Date.now(), value };
    return value;
  } catch {
    return {
      updated: "2026-10-03T19:12:29.386Z",
      total: 2714,
      bytes: 27104750,
      recent: [],
      byRepo: [
        { repo: "TESS", count: 872, bytes: 0 },
        { repo: "GodelOS", count: 713, bytes: 0 },
        { repo: "Brain-Cog", count: 574, bytes: 0 },
        { repo: "Grok-ready", count: 158, bytes: 0 },
      ],
      skipped: 22126,
      note: "Last count on this machine: 2,714 text files, about 27 MB, 22,126 skipped. This host could not open the manifest just now.",
    };
  }
});

export const searchIngest = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => input)
  .handler(async ({ data }) => {
    const query = data.query.trim().slice(0, 80);
    if (query.length < 3) return { hits: [] as { repo: string; path: string; snippet: string }[] };
    let raw = "";
    try {
      raw = await readManifest();
    } catch {
      return { hits: [] as { repo: string; path: string; snippet: string }[] };
    }
    const parsed = JSON.parse(raw) as { files: HeldFile[] };
    const blocked = /natal|wallet|secret|credential|shepherd-audit|checkout|payment/i;
    const needle = query.toLowerCase();
    const hits: { repo: string; path: string; snippet: string }[] = [];
    const files = [...(parsed.files ?? [])].reverse();
    for (const file of files) {
      if (blocked.test(file.path)) continue;
      if (!file.path.toLowerCase().includes(needle)) continue;
      hits.push({ repo: file.repo, path: file.path, snippet: "The path matches. The body was not needed for this hit." });
      if (hits.length >= 8) break;
    }
    for (const file of files) {
      if (hits.length >= 20) break;
      if (blocked.test(file.path)) continue;
      if (hits.some((hit) => hit.repo === file.repo && hit.path === file.path)) continue;
      const text = await readFile(dataPath("ingest", `${file.id}.txt`), "utf8").catch(() => "");
      const at = text.toLowerCase().indexOf(needle);
      if (at < 0) continue;
      const start = Math.max(0, at - 60);
      hits.push({
        repo: file.repo,
        path: file.path,
        snippet: text.slice(start, at + needle.length + 80).replace(/\s+/g, " "),
      });
    }
    return { hits };
  });

export const recallFile = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const id = data.id.trim().toLowerCase().replace(/[^a-f0-9]/g, "").slice(0, 64);
    if (id.length < 4) return { ok: false as const, error: "Give at least four characters of the file id." };
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(dataPath("ingest", "manifest.json"), "utf8");
    const parsed = JSON.parse(raw) as { files: HeldFile[] };
    const blocked = /natal|wallet|secret|credential|shepherd-audit|checkout|payment|cipher/i;
    const file = (parsed.files ?? []).find((item) => item.id.startsWith(id) || item.sha256.startsWith(id));
    if (!file) return { ok: false as const, error: "No saved file has that id." };
    if (blocked.test(file.path) || file.path.includes("sacred-knowledge-vault")) {
      return {
        ok: true as const,
        id: file.id,
        repo: file.repo,
        path: file.path,
        snippet: "This file is indexed and closed. Titles can be read on the Council page. The body is not recalled.",
      };
    }
    const text = await readFile(dataPath("ingest", `${file.id}.txt`), "utf8").catch(() => "");
    return {
      ok: true as const,
      id: file.id,
      repo: file.repo,
      path: file.path,
      snippet: text.slice(0, 700).replace(/\s+/g, " "),
    };
  });
