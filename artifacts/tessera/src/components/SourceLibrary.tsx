import { useMemo, useState } from "react";
import library from "../data/source-library.json";

export default function SourceLibrary() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const records = useMemo(() => library.records.filter(record =>
    `${record.repository} ${record.description} ${record.categories.join(" ")}`
      .toLowerCase().includes(query.toLowerCase().trim())), [query]);

  function download() {
    try {
      const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tessera-source-library.json";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice("Export requested. This file contains reference metadata and coverage—not repository code, model weights, or installed tools.");
    } catch {
      setNotice("Export failed. Please retry in a browser that supports file downloads.");
    }
  }

  return (
    <section aria-labelledby="source-library-title" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="source-library-title" className="text-lg font-semibold">Repository source library</h2>
          <p className="text-sm text-muted-foreground">
            {library.records.length} references saved in Tessera · Snapshot {new Date(library.capturedAt).toLocaleString()}
          </p>
        </div>
        <button onClick={download} className="min-h-11 shrink-0 rounded-lg border border-border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Export reference catalog
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Read-only public-source references. REA is development-only. No listed tool is operationally installed.
        Text-structure inspection is not full reverse engineering or security approval.
        This snapshot is not live job progress; the export contains metadata, not executable tools.
      </p>
      <p role="status" className="text-sm">{notice}</p>
      <label className="block space-y-1 text-sm" htmlFor="source-library-search">
        <span>Search repositories and capabilities</span>
        <input id="source-library-search" type="search" value={query}
          onChange={event => { setQuery(event.target.value); setExpanded(false); }}
          placeholder="Search memory, video, defense…"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
      </label>
      <p aria-live="polite" className="text-sm text-muted-foreground">{records.length} matching repositories</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {records.slice(0, expanded ? records.length : 6).map(record => (
          <li key={record.repository} className="min-w-0 space-y-2 rounded-lg border border-border p-3">
            <a href={record.url} target="_blank" rel="noopener noreferrer"
              className="block break-words font-medium text-primary underline underline-offset-4">
              {record.repository}
            </a>
            <p className="break-words text-sm text-muted-foreground">{record.description || "No repository description available."}</p>
            <dl className="space-y-1 text-xs text-muted-foreground">
              <div><dt className="inline font-medium">Coverage: </dt><dd className="inline">{record.trackedFiles == null ? "No file inventory in this snapshot" : `${record.textFilesInspected.toLocaleString()} text files inspected / ${record.trackedFiles.toLocaleString()} tracked paths`}</dd></div>
              <div><dt className="inline font-medium">REA: </dt><dd className="inline">{record.reaStatus}</dd></div>
              <div><dt className="inline font-medium">License label: </dt><dd className="inline">{record.licenseLabel} — integration not approved</dd></div>
              <div><dt className="inline font-medium">Commit: </dt><dd className="inline break-all">{record.commit || "Not pinned in this snapshot"}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      {records.length === 0 && <p className="text-sm">No matching references. Try a repository name.</p>}
      {records.length > 6 && <button type="button" aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className="min-h-11 rounded-lg border border-border px-4 text-sm">
        {expanded ? "Show fewer" : `Show all ${records.length}`}
      </button>}
    </section>
  );
}
