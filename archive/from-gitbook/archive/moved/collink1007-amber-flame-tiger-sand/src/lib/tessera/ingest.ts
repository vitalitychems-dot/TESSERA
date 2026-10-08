import { createServerFn } from "@tanstack/react-start";

export type HeldFile = {
  repo: string;
  path: string;
  bytes: number;
  sha256: string;
  id: string;
  at: string;
};

export const readIngest = createServerFn({ method: "POST" }).handler(async () => {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = await readFile("/workspace/data/ingest/manifest.json", "utf8");
    const parsed = JSON.parse(raw) as {
      updated: string | null;
      files: HeldFile[];
      skipped: { repo: string; path: string; reason: string }[];
      note: string;
    };
    return {
      updated: parsed.updated,
      files: parsed.files ?? [],
      skipped: (parsed.skipped ?? []).length,
      note: parsed.note ?? "",
    };
  } catch {
    return { updated: null, files: [], skipped: 0, note: "No ingest file yet." };
  }
});

export const searchIngest = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => input)
  .handler(async ({ data }) => {
    const query = data.query.trim().slice(0, 80);
    if (query.length < 3) return { hits: [] as { repo: string; path: string; snippet: string }[] };
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile("/workspace/data/ingest/manifest.json", "utf8");
    const parsed = JSON.parse(raw) as { files: HeldFile[] };
    const needle = query.toLowerCase();
    const hits: { repo: string; path: string; snippet: string }[] = [];
    for (const file of parsed.files ?? []) {
      if (hits.length >= 12) break;
      const text = await readFile(`/workspace/data/ingest/${file.id}.txt`, "utf8").catch(() => "");
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
