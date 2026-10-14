import { useWorldPulse } from "@/hooks/use-world-pulse";
import { ChatArea } from "@/components/ChatArea";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CircleDot,
  Clock3,
  Database,
  Eye,
  GitBranch,
  RefreshCw,
  Star,
} from "lucide-react";
import "./TesseraWorldStage.css";

type PulseQuery<T> = {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isStale: boolean;
  dataUpdatedAt: number;
  refetch: () => unknown;
};

function timestampLabel(updatedAt: number) {
  if (!updatedAt) return "Not synced yet";
  const elapsed = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  if (elapsed < 60) return `Updated ${elapsed}s ago`;
  if (elapsed < 3600) return `Updated ${Math.floor(elapsed / 60)}m ago`;
  return `Updated ${Math.floor(elapsed / 3600)}h ago`;
}

function dateLabel(value: string | null) {
  if (!value) return "No push date reported";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Push date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function ageLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "under a minute ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Freshness({ query, cadence, source }: { query: PulseQuery<unknown>; cadence: string; source: string }) {
  return (
    <div className="tw-freshness" data-testid={`status-freshness-${source}`}>
      <span className={query.isFetching ? "tw-refresh-mark is-fetching" : "tw-refresh-mark"} aria-hidden="true" />
      <span>{query.isStale ? "Stale · " : ""}{timestampLabel(query.dataUpdatedAt)}</span>
      <span className="tw-cadence">{cadence}</span>
    </div>
  );
}

function Retry({ onRetry, label }: { onRetry: () => unknown; label: string }) {
  return (
    <button className="tw-retry" type="button" onClick={() => void onRetry()} data-testid={`button-retry-${label}`}>
      <RefreshCw size={13} aria-hidden="true" /> Retry
    </button>
  );
}

function SignalSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="tw-skeleton-list" aria-label="Loading repository signals">
      {Array.from({ length: rows }, (_, index) => <span className="tw-skeleton" key={index} />)}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Database }) {
  return (
    <div className="tw-metric" data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className="tw-metric-icon"><Icon size={14} aria-hidden="true" /></span>
      <span className="tw-metric-value">{value}</span>
      <span className="tw-metric-label">{label}</span>
    </div>
  );
}

export default function TesseraWorldStage({ conversationId }: { conversationId: number }) {
  const { service, brain, repositories } = useWorldPulse();
  const repositoriesData = repositories.data ?? [];
  const confidence = brain.data
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(brain.data.averageConfidence)
    : null;

  return (
    <main className="tessera-world-stage" data-testid="tessera-world-stage">
      <section className="tw-world-column" aria-label="TESSERA world signals">
        <header className="tw-topline">
          <div className="tw-brand-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="tw-eyebrow">OPERATOR WORLD / 01</p>
            <h1>TESSERA <span>WORLD</span></h1>
          </div>
          <span className="tw-private-tag">PRIVATE WORKSPACE</span>
        </header>

        <section className="tw-world-art" aria-label="Voxel world signal map">
          <div className="tw-skyline" aria-hidden="true">
            <span className="tw-orbit" />
            <span className="tw-sun" />
            <span className="tw-starfield">· &nbsp; · &nbsp; · &nbsp; · &nbsp; ·</span>
            <div className="tw-world-tower tw-tower-one"><i /><i /><i /></div>
            <div className="tw-world-tower tw-tower-two"><i /><i /><i /><i /></div>
            <div className="tw-world-tower tw-tower-three"><i /><i /></div>
            <div className="tw-world-tower tw-tower-four"><i /><i /><i /></div>
            <div className="tw-ground-grid" />
          </div>
          <div className="tw-world-caption">
            <span className="tw-caption-index">WORLD STATE / SIGNALS ONLY</span>
            <span className="tw-live-legend"><i /> Public repositories + service pulse</span>
          </div>
        </section>

        <div className="tw-signal-heading">
          <div><span className="tw-section-no">A</span><h2>THE EYE</h2></div>
          <p>Service + repository signals</p>
        </div>

        <section className="tw-eye-grid" aria-label="Eye system status">
          <article className="tw-panel tw-service-panel">
            <div className="tw-panel-title">
              <span className="tw-panel-symbol"><Eye size={15} /></span>
              <div><h3>Service pulse</h3><p>Private system health</p></div>
            </div>
            {service.isLoading && !service.data ? (
              <div className="tw-service-loading"><span className="tw-skeleton tw-line" /><span className="tw-skeleton tw-line short" /></div>
            ) : service.data ? (
              <>
                <div className="tw-service-state">
                  <span className={`tw-status-dot ${service.data.status === "ok" ? "is-good" : "is-warn"}`} />
                  <strong>{service.data.status === "ok" ? "Operational" : "Degraded"}</strong>
                  {service.isError && <span className="tw-inline-warning"><AlertTriangle size={13} /> Refresh failed</span>}
                </div>
                <div className="tw-db-state"><Database size={13} /><span>Database</span><b>{service.data.database.replace("-", " ")}</b></div>
              </>
            ) : (
              <div className="tw-unavailable"><AlertTriangle size={14} /> Service status unavailable <Retry onRetry={service.refetch} label="service" /></div>
            )}
            <Freshness query={service} cadence="30 sec cadence" source="service" />
            {service.isError && service.data && <p className="tw-stale-note">Showing the last successful service signal.</p>}
          </article>

          <article className="tw-panel tw-brain-panel">
            <div className="tw-panel-title">
              <span className="tw-panel-symbol is-brain"><BrainCircuit size={15} /></span>
              <div><h3>The Brain</h3><p>Knowledge corpus</p></div>
            </div>
            {brain.isLoading && !brain.data ? (
              <SignalSkeleton rows={3} />
            ) : brain.data ? (
              <>
                <div className="tw-brain-main" data-testid="brain-entry-count">
                  <strong>{brain.data.entries.toLocaleString()}</strong><span>entries indexed</span>
                </div>
                <div className="tw-brain-stats">
                  <div><span>DOMAINS</span><b>{brain.data.domains.toLocaleString()}</b></div>
                  <div><span>CROSS-REFERENCES</span><b>{brain.data.crossReferences.toLocaleString()}</b></div>
                  <div><span>AVG. CONFIDENCE</span><b>{confidence}</b></div>
                </div>
                {brain.isError && <p className="tw-stale-note"><AlertTriangle size={12} /> Refresh failed; showing last successful corpus data.</p>}
              </>
            ) : (
              <div className="tw-unavailable"><AlertTriangle size={14} /> Corpus signal unavailable <Retry onRetry={brain.refetch} label="brain" /></div>
            )}
            <Freshness query={brain} cadence="60 sec cadence" source="brain" />
          </article>
        </section>

        <section className="tw-repository-section" aria-labelledby="tw-repo-title">
          <div className="tw-section-heading">
            <div className="tw-signal-heading">
              <div><span className="tw-section-no">B</span><h2 id="tw-repo-title">THE TERRAIN</h2></div>
              <p>Public GitHub · checked every 5 min</p>
            </div>
            <Freshness query={repositories} cadence="" source="repositories" />
          </div>
          {repositories.isLoading && repositoriesData.length === 0 ? (
            <div className="tw-repo-grid"><article className="tw-panel tw-repo-card"><SignalSkeleton rows={3} /></article><article className="tw-panel tw-repo-card"><SignalSkeleton rows={3} /></article></div>
          ) : repositoriesData.length > 0 ? (
            <div className="tw-repo-grid">
              {repositoriesData.map((repository) => (
                <article className="tw-panel tw-repo-card" key={repository.slug} data-testid={`repository-${repository.name.toLowerCase()}`}>
                  <div className="tw-repo-top">
                    <div className="tw-repo-icon"><GitBranch size={14} /></div>
                    <a className="tw-repo-name" href={repository.url} target="_blank" rel="noreferrer" data-testid={`link-repository-${repository.name.toLowerCase()}`}>
                      {repository.name}<ArrowUpRight size={12} aria-hidden="true" />
                    </a>
                  </div>
                  <div className="tw-repo-numbers">
                    <span><CircleDot size={13} /> {repository.openItems.toLocaleString()} <small>open issues + PRs</small></span>
                    <span><Star size={13} /> {repository.stars.toLocaleString()} <small>stars</small></span>
                  </div>
                  <p className="tw-pushed"><Clock3 size={12} /> Last pushed {dateLabel(repository.pushedAt)}</p>
                  <div className="tw-events">
                    {repository.events.length ? repository.events.map((event) => (
                      <a className="tw-event" href={event.url} target="_blank" rel="noreferrer" key={event.id} data-testid={`repository-event-${repository.name.toLowerCase()}-${event.id}`}>
                        <span className="tw-event-marker" aria-hidden="true" />
                        <span className="tw-event-copy">
                          <span className="tw-event-meta">{event.actor} <time dateTime={event.occurredAt}>{ageLabel(event.occurredAt)}</time></span>
                          <span className="tw-event-summary">{event.summary}</span>
                        </span>
                        <ArrowUpRight size={12} className="tw-event-link-icon" aria-hidden="true" />
                      </a>
                    )) : (
                      <p className="tw-empty-events">No public activity returned in this repository snapshot.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : repositories.data ? (
            <div className="tw-panel tw-repo-error is-empty" data-testid="empty-repository-signals">
              <GitBranch size={15} />
              <span>No repository records were returned in this snapshot.</span>
            </div>
          ) : (
            <div className="tw-panel tw-repo-error">
              <AlertTriangle size={15} />
              <span>Public repository signals are unavailable.</span>
              <Retry onRetry={repositories.refetch} label="repositories" />
            </div>
          )}
          {repositories.isError && repositoriesData.length > 0 && (
            <p className="tw-stale-note tw-repo-stale"><AlertTriangle size={12} /> GitHub refresh failed. Showing the last successful snapshot; public repository data is not instant.</p>
          )}
          {!repositories.isError && <p className="tw-public-note"><Activity size={12} /> GitHub activity is a public snapshot, refreshed on a five-minute cadence.</p>}
        </section>
      </section>

      <section className="tw-chat-column" aria-label="Live conversation">
        <div className="tw-chat-heading">
          <div className="tw-chat-orbit"><span /></div>
          <div><p className="tw-eyebrow">LIVE CONVERSATION</p><h2>THE CHAMBER</h2></div>
          <span className="tw-chat-note">Private to this session</span>
        </div>
        <div className="tw-chat-surface">
          <ChatArea conversationId={conversationId} />
        </div>
      </section>
    </main>
  );
}
