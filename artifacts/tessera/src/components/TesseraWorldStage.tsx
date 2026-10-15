import { useWorldPulse } from "@/hooks/use-world-pulse";
import { Link } from "wouter";
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
  MessageSquare,
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
    <div className="tw-skeleton-list" role="status" aria-label="Loading live source data">
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
  const { service, brain, forum, moltbook, repositories } = useWorldPulse();
  const repositoriesData = repositories.data ?? [];
  const confidence = brain.data
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(brain.data.averageConfidence)
    : null;

  return (
    <main className="tessera-world-stage" data-testid="tessera-world-stage">
      <section className="tw-world-column" aria-label="TESSERA world signals">
        <header className="tw-topline">
          <div className="next-mosaic" aria-hidden="true"><span /><span /><span /><span /></div>
          <div>
            <p className="tw-eyebrow">OPERATOR WORLD / 01</p>
            <h1>Next <span>WORLD</span></h1>
          </div>
          <span className="tw-private-tag">PRIVATE WORKSPACE</span>
        </header>

        <nav className="tw-destinations" aria-label="Live workspace destinations">
          <Link href="/eye">Eye / observed signals</Link>
          <Link href="/brain">Brain / knowledge</Link>
          <Link href="/forum">Forum / discussions</Link>
          <a href="#live-chat">Chat / conversation</a>
        </nav>
        <section
          className="tw-world-unavailable"
          aria-labelledby="tw-world-source-title"
          data-testid="world-map-unavailable"
          role="status"
        >
          <span className="tw-world-source-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div className="tw-world-source-copy">
            <p className="tw-caption-index">MINECRAFT WORLD / UNAVAILABLE</p>
            <h2 id="tw-world-source-title">No live Minecraft map is connected</h2>
            <p>
              No authorized Minecraft server or map feed is available. The current
              <code>/api/world</code> endpoint returns deterministic modeled data, not live world telemetry.
            </p>
          </div>
          <span className="tw-world-source-state">SOURCE NOT CONNECTED</span>
        </section>

        <div className="tw-signal-heading">
          <div><span className="tw-section-no">A</span><h2>THE EYE</h2></div>
          <p>Service + repository signals</p>
        </div>

        <section className="tw-eye-grid" aria-label="Eye system status">
          <article className="tw-panel tw-service-panel">
            <div className="tw-panel-title">
              <span className="tw-panel-symbol"><Eye size={15} /></span>
              <div><h3><Link href="/eye">Service pulse ↗</Link></h3><p>Source: /api/healthz</p></div>
            </div>
            {service.isLoading && !service.data ? (
              <div className="tw-service-loading"><span className="tw-skeleton tw-line" /><span className="tw-skeleton tw-line short" /></div>
            ) : service.data ? (
              <>
                <div className="tw-service-state">
                  <span className={`tw-status-dot ${service.data.status === "ok" ? "is-good" : "is-warn"}`} />
                  <strong>{service.data.status === "ok" ? "API responding" : "Degraded"}</strong>
                  {service.isError && <span className="tw-inline-warning"><AlertTriangle size={13} /> Refresh failed</span>}
                </div>
                <div className="tw-db-state"><Database size={13} /><span>Database URL</span><b>{service.data.database === "configured" ? "configured" : service.data.database === "not-configured" ? "not configured" : "unknown"}</b></div>
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
              <div><h3><Link href="/brain">The Brain ↗</Link></h3><p>Source: /api/knowledge-corpus/stats</p></div>
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
                    <span><CircleDot size={13} /> {repository.openItems?.toLocaleString() ?? "Unavailable"} <small>open issues + PRs</small></span>
                    <span><Star size={13} /> {repository.stars?.toLocaleString() ?? "Unavailable"} <small>stars</small></span>
                  </div>
                  <p className="tw-pushed"><Clock3 size={12} /> Last pushed {dateLabel(repository.pushedAt)}</p>
                  <p className="tw-pushed">{repository.stale ? "Stale · refresh failed" : "GitHub snapshot"} · {repository.fetchedAt ? ageLabel(repository.fetchedAt) : "time unavailable"}</p>
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
                      <div className="tw-empty-events">
                        <p>{repository.unavailable ? "Source unavailable. No substitute activity is generated; other repository signals remain visible." : "No public activity returned in this repository snapshot."}</p>
                        {repository.unavailable && <Retry onRetry={repositories.refetch} label={`repository-${repository.name.toLowerCase()}`} />}
                      </div>
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
        <section className="tw-forum-section" aria-labelledby="tw-forum-title" data-testid="world-forum-signals">
          <div className="tw-section-heading">
            <div className="tw-signal-heading">
              <div><span className="tw-section-no">C</span><h2 id="tw-forum-title">THE FORUM</h2></div>
              <p>Stored discussion records · 60 sec refresh</p>
            </div>
            <Link className="tw-forum-open" href="/forum" data-testid="link-open-forum">Open forum ↗</Link>
          </div>
          {forum.isLoading && !forum.data ? (
            <article className="tw-panel tw-forum-card"><SignalSkeleton rows={3} /></article>
          ) : forum.data ? (
            <article className="tw-panel tw-forum-card" aria-live="polite">
              <p className="tw-forum-source">Source: {forum.data.source} · observed {new Date(forum.data.observedAt).toLocaleTimeString()}</p>
              {forum.data.topics.length ? (
                <ul className="tw-forum-topics">
                  {forum.data.topics.map(topic => (
                    <li key={topic.id}>
                      <MessageSquare size={14} aria-hidden="true" />
                      <div className="tw-forum-topic-copy">
                        <Link href="/forum">{topic.title}</Link>
                        <span>{topic.author} · {topic.category} · {topic.replyCount} stored {topic.replyCount === 1 ? "reply" : "replies"}</span>
                      </div>
                      <time dateTime={topic.lastActivity ? new Date(topic.lastActivity).toISOString() : undefined}>
                        {topic.lastActivity ? ageLabel(new Date(topic.lastActivity).toISOString()) : "time unavailable"}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tw-forum-empty">No stored discussion topics were returned.</p>
              )}
              {forum.isError && <p className="tw-stale-note"><AlertTriangle size={12} /> Refresh failed; showing the last successful database snapshot.</p>}
            </article>
          ) : (
            <article className="tw-panel tw-forum-card tw-forum-unavailable" role="status">
              <AlertTriangle size={14} /> Forum database signal unavailable. No substitute discussions are generated.
              <Retry onRetry={forum.refetch} label="forum" />
            </article>
          )}
          <Freshness query={forum} cadence="60 sec cadence" source="forum" />
          <article className="tw-panel tw-forum-card tw-moltbook-card" data-testid="world-moltbook-feed">
            <div className="tw-moltbook-heading">
              <span className="tw-panel-symbol"><MessageSquare size={15} aria-hidden="true" /></span>
              <div>
                <h3>Moltbook · verified posts</h3>
                <p>Source: public read-only feed</p>
              </div>
              <a href="https://www.moltbook.com/" target="_blank" rel="noreferrer">
                Moltbook <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            </div>
            {moltbook.isLoading && !moltbook.data ? (
              <SignalSkeleton rows={3} />
            ) : moltbook.data?.status === "unavailable" ? (
              <div className="tw-moltbook-unavailable" role="status">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>Feed unavailable. No substitute posts are shown.</span>
                <Retry onRetry={moltbook.refetch} label="moltbook" />
              </div>
            ) : moltbook.data ? (
              <>
                {moltbook.data.status === "stale" && (
                  <p className="tw-stale-note"><AlertTriangle size={12} aria-hidden="true" /> Refresh failed; showing the last verified feed snapshot.</p>
                )}
                {moltbook.data.posts.length ? (
                  <ul className="tw-moltbook-posts">
                    {moltbook.data.posts.map(post => (
                      <li key={post.id}>
                        <div className="tw-moltbook-post-top">
                          <h4>{post.title}</h4>
                          <span className="tw-moltbook-verified">VERIFIED</span>
                        </div>
                        <p className="tw-moltbook-content">{post.content}</p>
                        <div className="tw-moltbook-meta">
                          <span>{post.authorName} · {post.submoltName}</span>
                          {post.createdAt ? (
                            <time dateTime={post.createdAt}>{ageLabel(post.createdAt)}</time>
                          ) : (
                            <span>Time unavailable</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tw-forum-empty">No verified public posts were returned.</p>
                )}
                {moltbook.isError && (
                  <p className="tw-stale-note"><AlertTriangle size={12} aria-hidden="true" /> Refresh failed; showing the last successful response.</p>
                )}
              </>
            ) : (
              <div className="tw-moltbook-unavailable" role="status">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>Feed unavailable. No substitute posts are shown.</span>
                <Retry onRetry={moltbook.refetch} label="moltbook" />
              </div>
            )}
            <Freshness query={moltbook} cadence="60 sec refresh" source="moltbook" />
            <p className="tw-moltbook-note">Verified public posts only. This feed does not register agents or post to Moltbook.</p>
          </article>
        </section>
      </section>

      <section id="live-chat" className="tw-chat-column" aria-label="Live conversation">
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
