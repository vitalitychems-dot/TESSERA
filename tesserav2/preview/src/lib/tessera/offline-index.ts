/** Offline search index built from Gitbook/GitMesh pages already on disk. No network. */
export type Page = { path: string; text: string };
export type Index = { version: 1; pages: Page[] };

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

export function buildIndex(pages: Page[], maxChars = 2048): Index {
  return { version: 1, pages: pages.map((p) => ({ path: p.path, text: p.text.slice(0, maxChars) })) };
}

export function searchIndex(index: Index, query: string, limit = 5) {
  const q = words(query);
  if (!q.length) return { live: false as const, hits: [] as string[] };
  const scored = index.pages
    .map((p) => {
      const t = p.text.toLowerCase() + " " + p.path.toLowerCase();
      const matched = q.filter((w) => t.includes(w)).length;
      return { path: p.path, matched };
    })
    .filter((s) => s.matched === q.length)
    .sort((a, b) => a.path.localeCompare(b.path));
  return { live: false as const, hits: scored.slice(0, limit).map((s) => s.path) };
}
