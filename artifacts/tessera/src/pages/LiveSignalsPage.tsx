import { Link } from "wouter";
import { Activity, BrainCircuit, Eye, RefreshCw } from "lucide-react";
import { useWorldPulse } from "@/hooks/use-world-pulse";

/** Observations from actual APIs, not inferred consciousness or animated telemetry. */
export default function LiveSignalsPage({ kind }: { kind: "eye" | "brain" }) {
  const { service, brain, repositories } = useWorldPulse();
  const query = kind === "brain" ? brain : service;
  const Icon = kind === "brain" ? BrainCircuit : Eye;
  return (
    <main className="flex-1 min-w-0 overflow-y-auto bg-background p-4 sm:p-6" data-testid={`live-${kind}-page`}>
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div><p className="font-mono text-xs text-primary uppercase tracking-widest">Next / Observed state</p>
            <h1 className="mt-2 flex gap-3 items-center text-3xl font-bold"><Icon aria-hidden="true" />The {kind === "brain" ? "Brain" : "Eye"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{kind === "brain" ? "Knowledge indexed by the running service. These are corpus statistics, not a consciousness measurement." : "Live service health and sourced repository snapshots. No simulated sensors or surveillance feeds."}</p>
          </div>
          <button type="button" className="rounded-xl border border-primary/30 p-3 text-primary disabled:opacity-50" disabled={query.isFetching}
            aria-label={`Refresh ${kind} data`} onClick={() => { void query.refetch(); void repositories.refetch(); }}>
            <RefreshCw size={18} className={query.isFetching ? "animate-spin" : ""} />
          </button>
        </header>
        <section className="rounded-2xl border border-border bg-card p-5" aria-live="polite">
          <h2 className="flex items-center gap-2 font-bold"><Activity size={16} />Measured values</h2>
          {query.isLoading ? <p className="mt-3 text-muted-foreground">Reading the service…</p> : query.data ? (
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(query.data).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border p-3 min-w-0">
                  <dt className="text-xs text-muted-foreground">{label.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="mt-1 font-mono text-lg text-primary break-words">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="mt-3 text-destructive">The source is unavailable. No substitute readings are generated.</p>}
          {query.isError && query.data && <p className="mt-3 text-destructive">Refresh failed; displayed values are the last successful reading.</p>}
          <p className="mt-4 break-all font-mono text-xs text-muted-foreground">
            Source: {kind === "brain" ? "/api/knowledge-corpus/stats · 60 second polling" : "/api/healthz · 30 second polling"}<br />
            Observed: {query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString() : "Not yet available"}
          </p>
        </section>
        {kind === "eye" && <section className="space-y-3">
          <h2 className="font-bold">Repository observations</h2>
          {repositories.data?.map(repo => <article className="rounded-xl border border-border bg-card p-4" key={repo.slug}>
            <a href={repo.url} target="_blank" rel="noreferrer" className="text-primary underline break-all">{repo.name}</a>
            <p className="mt-2 text-sm">{repo.unavailable ? "Source unavailable — no substitute readings." : `${repo.openItems} open issues and pull requests · ${repo.stars} stars`}</p>
            <p className="mt-2 text-xs text-muted-foreground">Observed: {repo.fetchedAt ? new Date(repo.fetchedAt).toLocaleString() : "Unknown"} · {repo.stale ? "Stale snapshot: refresh failed" : "GitHub snapshot, up to five minutes old"}</p>
          </article>)}
          {repositories.isError && <p role="status" className="text-destructive">Repository source unavailable. Retry to reconnect.</p>}
        </section>}
        <nav className="flex flex-wrap gap-3 text-sm" aria-label="Workspace">
          <Link href="/" className="rounded-xl border border-border px-4 py-3">World & Chat</Link>
          <Link href={kind === "eye" ? "/brain" : "/eye"} className="rounded-xl border border-border px-4 py-3">{kind === "eye" ? "Brain" : "Eye"}</Link>
          <Link href="/forum" className="rounded-xl border border-border px-4 py-3">Forum</Link>
          {kind === "brain" && <Link href="/intelligence" className="rounded-xl border border-border px-4 py-3">Knowledge tools</Link>}
        </nav>
      </div>
    </main>
  );
}
