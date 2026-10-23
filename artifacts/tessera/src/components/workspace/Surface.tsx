import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import "@/styles/workspace.css";

export type DataState = "live" | "stale" | "unavailable" | "snapshot" | "loading";
const LABEL: Record<DataState, string> = { live: "Live", stale: "Stale", unavailable: "Unavailable", snapshot: "Saved snapshot", loading: "Reading" };

export function StatePill({ state, testId }: { state: DataState; testId?: string }) {
  return <span className="ws-pill" data-state={state} data-testid={testId}>{LABEL[state]}</span>;
}

/** Derive an honest state from a react-query result. */
export function queryState(q: { isLoading: boolean; isError: boolean; isStale?: boolean; data: unknown }): DataState {
  if (q.isLoading && !q.data) return "loading";
  if (!q.data) return "unavailable";
  if (q.isError) return "stale";
  return "live";
}

export function observed(ts: number | string | null | undefined) {
  if (!ts) return "Not yet observed";
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "Time unavailable";
}

export function PageHead({ eyebrow, title, icon, children, onRefresh, refreshing, testId }: {
  eyebrow: string; title: string; icon: ReactNode; children: ReactNode; onRefresh?: () => void; refreshing?: boolean; testId: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <p className="ws-eyebrow">{eyebrow}</p>
        <h1 className="ws-h1" data-testid={`heading-${testId}`}><span aria-hidden="true" className="text-[var(--next-glass)]">{icon}</span>{title}</h1>
        <p className="ws-lede">{children}</p>
      </div>
      {onRefresh && (
        <button type="button" className="ws-btn shrink-0 w-11 px-0" onClick={onRefresh} disabled={refreshing} aria-label={`Refresh ${title}`} data-testid={`button-refresh-${testId}`}>
          <RefreshCw size={17} className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
        </button>
      )}
    </header>
  );
}

export function Panel({ title, state, source, children, labelId, testId }: {
  title: string; state: DataState; source: ReactNode; children: ReactNode; labelId: string; testId?: string;
}) {
  return (
    <section className="ws-panel" aria-labelledby={labelId} data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={labelId} className="ws-h2">{title}</h2>
        <StatePill state={state} testId={testId ? `status-${testId}` : undefined} />
      </div>
      <div className="mt-4" aria-live="polite">{children}</div>
      <p className="ws-meta mt-4">{source}</p>
    </section>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-2" role="status" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div key={i} className="tx-skel h-10 w-full" />)}</div>;
}
