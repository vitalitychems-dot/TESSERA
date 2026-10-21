import { PATHS as GITBOOK_PATHS } from "./gitbook-paths.ts";
import { PATHS as TESSERA_PATHS } from "./tessera-paths.ts";

const STOP = new Set(["the", "and", "for", "with"]);

export type PathRow = { repo: "TESSERA" | "Gitbook"; path: string; tokens: string[] };

let rows: PathRow[] | null = null;
const tops = new Map<string, { name: string; count: number }[]>();

export function tokenize(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 0 && (token.length > 1 || /\d/.test(token)) && !STOP.has(token));
}

export function pathRows() {
  if (rows) return rows;
  const built: PathRow[] = [];
  const add = (block: string, repo: PathRow["repo"]) => {
    for (const path of block.split("\n")) {
      if (!path) continue;
      built.push({ repo, path, tokens: tokenize(path) });
    }
  };
  add(TESSERA_PATHS, "TESSERA");
  add(GITBOOK_PATHS, "Gitbook");
  rows = built;
  return rows;
}

export function tokenReport(query: string, limit = 8) {
  const want = tokenize(query);
  if (!want.length) return { hits: [] as string[], left: 0, tesseraLeft: 0, gitbookLeft: 0 };
  const matched = pathRows().filter((row) => want.every((token) => row.tokens.includes(token)));
  matched.sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path));
  const hits = matched.slice(0, limit);
  const shownT = hits.filter((row) => row.repo === "TESSERA").length;
  const shownG = hits.filter((row) => row.repo === "Gitbook").length;
  const tessera = matched.filter((row) => row.repo === "TESSERA").length;
  const gitbook = matched.filter((row) => row.repo === "Gitbook").length;
  return {
    hits: hits.map((row) => `${row.repo} ${row.path}`),
    left: Math.max(0, matched.length - hits.length),
    tesseraLeft: Math.max(0, tessera - shownT),
    gitbookLeft: Math.max(0, gitbook - shownG),
  };
}

export function tokenFind(query: string, limit = 8) {
  return tokenReport(query, limit).hits;
}

export function topFolders(repo: "tessera" | "gitbook") {
  const key = repo;
  const saved = tops.get(key);
  if (saved) return saved;
  const label = repo === "tessera" ? "TESSERA" : "Gitbook";
  const counts = new Map<string, number>();
  for (const row of pathRows()) {
    if (row.repo !== label || !row.path.includes("/")) continue;
    const name = row.path.split("/")[0] ?? "";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  tops.set(key, ranked);
  return ranked;
}
