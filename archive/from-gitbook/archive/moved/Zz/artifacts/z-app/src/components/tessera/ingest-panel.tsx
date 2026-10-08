import { useEffect, useState } from "react";
import { readIngest, searchIngest, type HeldFile } from "@/lib/tessera/ingest";

export function IngestPanel() {
  const [recent, setRecent] = useState<HeldFile[]>([]);
  const [total, setTotal] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [byRepo, setByRepo] = useState<{ repo: string; count: number; bytes: number }[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [note, setNote] = useState("Looking for saved files.");
  const [updated, setUpdated] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ repo: string; path: string; snippet: string }[]>([]);
  const [searching, setSearching] = useState(false);

  async function reload() {
    try {
      const result = await readIngest();
      setRecent(result.recent ?? []);
      setTotal(result.total ?? 0);
      setBytes(result.bytes ?? 0);
      setByRepo(result.byRepo ?? []);
      setSkipped(result.skipped ?? 0);
      setNote(result.note ?? "");
      setUpdated(result.updated);
    } catch {
      setNote("The file list could not be read. The rest of the page stays up.");
    }
  }

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 30000);
    return () => window.clearInterval(id);
  }, []);

  async function look() {
    if (query.trim().length < 3 || searching) return;
    setSearching(true);
    try {
      const result = await searchIngest({ data: { query } });
      setHits(result.hits);
    } finally {
      setSearching(false);
    }
  }

  const bytesShown = bytes;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-[0.18em] text-subtle uppercase">Files on disk</p>
        <button type="button" onClick={() => void reload()} className="text-sm text-accent">
          Reload
        </button>
      </div>
      <p className="mt-2 text-sm text-fg">
        {total} text files saved · {bytesShown.toLocaleString()} bytes · {skipped} skipped
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
        {byRepo.map((row) => (
          <li key={row.repo} className="flex items-baseline justify-between gap-3">
            <span className="text-fg">{row.repo}</span>
            <span>
              {row.count} files · {row.bytes.toLocaleString()} bytes
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-sm text-muted">
        {note}
        {updated ? ` Updated ${updated}.` : ""} Search reads the saved text. It does not invent a match.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the saved files"
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
        />
        <button
          type="button"
          onClick={() => void look()}
          disabled={searching || query.trim().length < 3}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      {hits.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {hits.map((hit) => (
            <li key={`${hit.repo}-${hit.path}`} className="rounded-lg border border-border px-3 py-2">
              <p className="font-mono text-xs text-fg">
                {hit.repo}/{hit.path}
              </p>
              <p className="mt-1 text-muted">{hit.snippet}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto font-mono text-xs text-muted">
        {recent.map((file) => (
            <li key={file.sha256}>
              {file.repo}/{file.path} · {file.bytes} bytes · {file.sha256.slice(0, 12)}
            </li>
          ))}
      </ul>
    </section>
  );
}
