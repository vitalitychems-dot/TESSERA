import { useEffect, useMemo, useState } from "react";
import { Archive, Download } from "lucide-react";
import { useSourceMemoryCatalog, useSourceMemorySearch, useSourceMemoryStatus } from "@/hooks/use-source-memory";
import { PageHead, Panel, Skeleton, queryState, observed, type DataState } from "@/components/workspace/Surface";

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
  const catalog = useSourceMemoryCatalog(cat);
  const search = useSourceMemorySearch(q);
  const searching = q.trim().length >= 2;
  const records = useMemo(() => catalog.data?.records ?? [], [catalog.data?.records]);

  function exportCatalog() {
    if (!catalog.data) {
      setNotice("The live catalog is unavailable; no file was created.");
      return;
    }
    try {
      const snapshot = {
        capturedAt: new Date(catalog.dataUpdatedAt).toISOString(),
        source: "/api/source-memory/catalog",
        scope: "Metadata-only references. This export does not contain repository source code, model weights, or installed tools.",
        ...catalog.data,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "tessera-source-memory-catalog.json";
      document.body.append(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice("Export started. This is the currently loaded metadata-only catalog page.");
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
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="ws-stat"><dt>Evidence pointers</dt><dd data-testid="text-memory-count">{status.data.records.toLocaleString()}</dd></div>
                <div className="ws-stat"><dt>Repositories</dt><dd>{status.data.repositories.toLocaleString()}</dd></div>
                <div className="ws-stat"><dt>Capability references</dt><dd>{status.data.catalogRecords.toLocaleString()}</dd></div>
                <div className="ws-stat"><dt>REA snapshots</dt><dd>{status.data.reaSnapshots.toLocaleString()}</dd></div>
                <div className="ws-stat"><dt>Model trained</dt><dd>No</dd></div>
              </dl>
              <p className="ws-note mt-3">Index last recorded: {observed(status.data.checkedAt)}. Search uses pinned evidence pointers only; it does not train a model or execute repositories.</p>
            </>
          ) : (
            <div role="status">
              <p className="ws-err">The source-memory index is unavailable{status.data?.reason ? `: ${status.data.reason.replace("-", " ")}` : "."} No substitute storage is shown.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void status.refetch()} data-testid="button-retry-memory-status">Retry</button>
            </div>
          )}
        </Panel>

        <Panel title="Context faucet and capability catalog" labelId="memory-faucets"
          state={searching ? queryState(search) : queryState(catalog)} testId="panel-memory-faucets"
          source={searching ? "Source: /api/source-memory/search · bounded owner-only FTS query; supported categories only." : "Source: /api/source-memory/catalog · owner-only SQLite metadata, refreshed every 60s."}>
          <label htmlFor="memory-search" className="block text-sm mb-1.5">Search stored context</label>
          <input id="memory-search" type="search" className="ws-input" value={q} placeholder="memory, video, security…"
            onChange={e => { setQ(e.target.value); setLimit(12); }} data-testid="input-memory-search" />

          {!searching && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter saved snapshot by category">
              <button type="button" className="ws-chip ws-chip-btn" aria-pressed={cat === null} onClick={() => setCat(null)} data-testid="button-cat-all">All</button>
              {(catalog.data?.categories ?? []).map(c => <button type="button" key={c} className="ws-chip ws-chip-btn" aria-pressed={cat === c} onClick={() => { setCat(cat === c ? null : c); setLimit(12); }} data-testid={`button-cat-${c}`}>{c}</button>)}
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
              <p className="ws-meta mt-3" aria-live="polite" data-testid="text-memory-matches">{catalog.isLoading ? "Loading catalog…" : `${catalog.data?.total ?? 0} metadata references`}</p>
              {catalog.isLoading ? <Skeleton /> : catalog.isError ? (
                <div role="status"><p className="ws-err mt-3">The live capability catalog is unavailable. No bundled substitute is shown.</p>
                  <button type="button" className="ws-btn mt-3" onClick={() => void catalog.refetch()} data-testid="button-retry-memory-catalog">Retry</button>
                </div>
              ) : records.length ? (
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {records.slice(0, limit).map(r => (
                    <li key={r.repository} className="ws-stat" data-testid={`card-pointer-${r.repository}`}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="ws-link font-medium">{r.repository}</a>
                      <p className="ws-note mt-1">{r.description || "No description in snapshot."}</p>
                      <div className="mt-2 flex flex-wrap gap-1">{r.categories.map(c => <span key={c} className="ws-chip">{c}</span>)}</div>
                      <p className="ws-meta mt-2">{r.trackedFiles == null ? "No file inventory" : `${r.textFilesInspected.toLocaleString()} / ${r.trackedFiles.toLocaleString()} files recorded as inspected`} · {r.licenseLabel} · REA: {r.reaStatus} ({r.reaSnapshotFiles.toLocaleString()} snapshot files)<br />commit {r.commit ? r.commit.slice(0, 12) : "not pinned"} · installed: no · executed: no · license approval: {r.licenseApprovedForIntegration ? "yes" : "no"}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="ws-note mt-3">No metadata references match this category.</p>}
              {records.length > limit && <button type="button" className="ws-btn mt-4" onClick={() => setLimit(records.length)} data-testid="button-memory-showall">Show all {records.length}</button>}
            </>
          )}
        </Panel>

        <Panel title="Metadata export" labelId="memory-snapshot" state={catalog.data ? "live" : "unavailable"} testId="panel-memory-snapshot"
          source="Source: currently loaded page from /api/source-memory/catalog">
          <p className="ws-note">Export contains metadata references only, not repository code, model weights, or a full source review.</p>
          <button type="button" className="ws-btn mt-4" onClick={exportCatalog} disabled={!catalog.data} data-testid="button-export-memory"><Download size={16} aria-hidden="true" />Export loaded catalog page (JSON)</button>
          <p role="status" aria-live="polite" className="ws-note mt-2" data-testid="status-export">{notice}</p>
        </Panel>
      </div>
    </div>
  );
}
