import { useEffect, useMemo, useState } from "react";
import { Archive, Download } from "lucide-react";
import library from "@/data/source-library.json";
import { useSourceMemorySearch, useSourceMemoryStatus } from "@/hooks/use-source-memory";
import { PageHead, Panel, Skeleton, queryState, observed, type DataState } from "@/components/workspace/Surface";

const CATEGORIES = Array.from(new Set(library.records.flatMap(r => r.categories))).sort();

function statusState(query: ReturnType<typeof useSourceMemoryStatus>): DataState {
  if (query.data && !query.data.available) return "unavailable";
  return queryState(query);
}

export default function MemoryPage() {
  useEffect(() => { document.title = "TESSERA | Memory"; }, []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [limit, setLimit] = useState(12);
  const [notice, setNotice] = useState("");
  const status = useSourceMemoryStatus();
  const search = useSourceMemorySearch(q);
  const searching = q.trim().length >= 2;

  const snapshotRecords = useMemo(() => {
    return library.records.filter(r => !cat || r.categories.includes(cat));
  }, [cat]);
  const inspected = library.records.reduce((s, r) => s + (r.textFilesInspected ?? 0), 0);

  function exportCatalog() {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "tessera-source-library.json";
      document.body.append(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice("Export started. The file holds reference metadata only: no repository code, model weights, or tools.");
    } catch {
      setNotice("Export failed. Try a browser that allows file downloads.");
    }
  }

  return (
    <div className="ws-page" data-testid="memory-page">
      <PageHead eyebrow="Storage / context faucets" title="Memory" icon={<Archive size={30} />} testId="memory"
        onRefresh={() => { void status.refetch(); if (searching) void search.refetch(); }} refreshing={status.isFetching || search.isFetching}>
        The SQLite source-memory index stores evidence pointers Tessera can retrieve as context. A pointer is not model training and does not install or run anything.
      </PageHead>
      <div className="space-y-4">
        <Panel title="Source-memory storage" labelId="memory-storage" state={statusState(status)} testId="panel-memory-storage"
          source={<>Source: /api/source-memory/status · owner-only · polled every 60s<br />Observed: {observed(status.dataUpdatedAt)}</>}>
          {status.isLoading ? <Skeleton rows={2} /> : status.data?.available ? (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="ws-stat"><dt>Evidence pointers</dt><dd data-testid="text-memory-count">{status.data.records.toLocaleString()}</dd></div>
                <div className="ws-stat"><dt>Model trained</dt><dd>No</dd></div>
                <div className="ws-stat"><dt>Execution allowed</dt><dd>No</dd></div>
                <div className="ws-stat"><dt>External sync</dt><dd>No</dd></div>
              </dl>
              <p className="ws-note mt-3">Index last recorded: {observed(status.data.checkedAt)}. The database is read-only for this API and stays outside the model runtime.</p>
            </>
          ) : (
            <div role="status">
              <p className="ws-err">The source-memory index is unavailable{status.data?.reason ? `: ${status.data.reason.replace("-", " ")}` : "."} No substitute storage is shown.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void status.refetch()} data-testid="button-retry-memory-status">Retry</button>
            </div>
          )}
        </Panel>

        <Panel title="Context faucet" labelId="memory-faucets" state={searching ? queryState(search) : "snapshot"} testId="panel-memory-faucets"
          source={searching ? "Source: /api/source-memory/search · bounded FTS query over the owner-only SQLite index." : "Browse mode uses the saved source-library snapshot. Type at least two characters to query the live index."}>
          <label htmlFor="memory-search" className="block text-sm mb-1.5">Search stored context</label>
          <input id="memory-search" type="search" className="ws-input" value={q} placeholder="memory, video, security…"
            onChange={e => { setQ(e.target.value); setLimit(12); }} data-testid="input-memory-search" />

          {!searching && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter saved snapshot by category">
              <button type="button" className="ws-chip ws-chip-btn" aria-pressed={cat === null} onClick={() => setCat(null)} data-testid="button-cat-all">All</button>
              {CATEGORIES.map(c => <button type="button" key={c} className="ws-chip ws-chip-btn" aria-pressed={cat === c} onClick={() => { setCat(cat === c ? null : c); setLimit(12); }} data-testid={`button-cat-${c}`}>{c}</button>)}
            </div>
          )}

          {searching ? (
            <>
              <p className="ws-meta mt-3" aria-live="polite" data-testid="text-memory-matches">{search.isLoading ? "Searching…" : `${search.data?.length ?? 0} evidence pointers returned`}</p>
              {search.isLoading ? <Skeleton /> : search.data ? (
                search.data.length ? (
                  <ul className="mt-3 space-y-3">
                    {search.data.map(r => (
                      <li key={`${r.repository}:${r.path}:${r.commit}`} className="ws-stat" data-testid={`card-memory-result-${r.repository.replace("/", "-")}`}>
                        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="ws-link font-medium">{r.repository}{r.path ? ` · ${r.path}` : ""}</a> : <p className="font-medium">{r.repository}{r.path ? ` · ${r.path}` : ""}</p>}
                        <p className="ws-note mt-1">{r.context || "No context text in this record."}</p>
                        <p className="ws-meta mt-2">evidence: {r.evidence} · commit {r.commit ? r.commit.slice(0, 12) : "not pinned"} · checked {observed(r.checkedAt)}<br />Pointer only — not installed, not trained on, not executed.</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="ws-note mt-3">No stored context matched that search.</p>
              ) : (
                <div role="status"><p className="ws-err mt-3">The source-memory search endpoint is unavailable. No substitute results are generated.</p>
                  <button type="button" className="ws-btn mt-3" onClick={() => void search.refetch()} data-testid="button-retry-memory-search">Retry</button></div>
              )}
            </>
          ) : (
            <>
              <p className="ws-meta mt-3" aria-live="polite" data-testid="text-memory-matches">{snapshotRecords.length} snapshot pointers</p>
              {snapshotRecords.length ? (
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {snapshotRecords.slice(0, limit).map(r => (
                    <li key={r.repository} className="ws-stat" data-testid={`card-pointer-${r.repository}`}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="ws-link font-medium">{r.repository}</a>
                      <p className="ws-note mt-1">{r.description || "No description in snapshot."}</p>
                      <div className="mt-2 flex flex-wrap gap-1">{r.categories.map(c => <span key={c} className="ws-chip">{c}</span>)}</div>
                      <p className="ws-meta mt-2">{r.trackedFiles == null ? "No file inventory" : `${r.textFilesInspected.toLocaleString()} / ${r.trackedFiles.toLocaleString()} files read`} · {r.licenseLabel} · inspect: {r.reaStatus}<br />commit {r.commit ? r.commit.slice(0, 12) : "not pinned"} · not installed</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="ws-note mt-3">No snapshot pointers match this category.</p>}
              {snapshotRecords.length > limit && <button type="button" className="ws-btn mt-4" onClick={() => setLimit(snapshotRecords.length)} data-testid="button-memory-showall">Show all {snapshotRecords.length}</button>}
            </>
          )}
        </Panel>

        <Panel title="Saved catalog snapshot" labelId="memory-snapshot" state="snapshot" testId="panel-memory-snapshot"
          source={<>Source: src/data/source-library.json · schema v{library.schemaVersion} · captured {observed(library.capturedAt)}</>}>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="ws-stat"><dt>Repositories</dt><dd>{library.records.length}</dd></div>
            <div className="ws-stat"><dt>Text files read</dt><dd>{inspected.toLocaleString()}</dd></div>
            <div className="ws-stat"><dt>Model trained</dt><dd>{library.modelTrained ? "Yes" : "No"}</dd></div>
            <div className="ws-stat"><dt>External sync</dt><dd>{library.externalStorageSynced ? "Yes" : "No"}</dd></div>
          </dl>
          <p className="ws-note mt-3">{library.scope} Every license is marked not approved for integration.</p>
          <button type="button" className="ws-btn mt-4" onClick={exportCatalog} data-testid="button-export-memory"><Download size={16} aria-hidden="true" />Export catalog (JSON)</button>
          <p role="status" aria-live="polite" className="ws-note mt-2" data-testid="status-export">{notice}</p>
        </Panel>
      </div>
    </div>
  );
}
