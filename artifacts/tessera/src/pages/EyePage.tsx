import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Eye, GitBranch, Database } from "lucide-react";
import { useWorldPulse } from "@/hooks/use-world-pulse";
import library from "@/data/source-library.json";
import { PageHead, Panel, Skeleton, StatePill, queryState, observed } from "@/components/workspace/Surface";

const DEFENSIVE = /defen|security|privacy|foia/i;

export default function EyePage() {
  useEffect(() => { document.title = "TESSERA | Eye"; }, []);
  const { service, repositories } = useWorldPulse();
  const repos = repositories.data ?? [];
  const defensiveRefs = useMemo(() => library.records.filter(r => r.categories.some(c => DEFENSIVE.test(c))).length, []);

  return (
    <div className="ws-page" data-testid="eye-page">
      <PageHead eyebrow="Authorized observation / owner systems" title="Eye" icon={<Eye size={30} />} testId="eye"
        onRefresh={() => { void service.refetch(); void repositories.refetch(); }} refreshing={service.isFetching || repositories.isFetching}>
        Health of Tessera's own service and the owner's public repositories, each labeled with where it came from. No camera feeds, no sensors, no tracking of people.
      </PageHead>
      <div className="space-y-4">
        <Panel title="Service health" labelId="eye-service" state={queryState(service)} testId="panel-eye-service"
          source={<>Source: /api/healthz · polled every 30s<br />Observed: {observed(service.dataUpdatedAt)}</>}>
          {service.isLoading && !service.data ? <Skeleton rows={2} /> : service.data ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="ws-stat"><dt>API</dt><dd data-testid="text-eye-api">{service.data.status === "ok" ? "Responding" : "Degraded"}</dd></div>
              <div className="ws-stat"><dt><Database size={11} className="inline mr-1" aria-hidden="true" />Database URL</dt><dd className="!text-lg" data-testid="text-eye-db">{service.data.database.replace("-", " ")}</dd></div>
            </dl>
          ) : (
            <div role="status"><p className="ws-err">Health endpoint unavailable. Nothing is inferred in its place.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void service.refetch()} data-testid="button-retry-service">Retry</button></div>
          )}
          {service.isError && service.data && <p className="ws-warn mt-3">Refresh failed; showing the last successful reading.</p>}
        </Panel>

        <Panel title="Owner repositories" labelId="eye-repos" state={queryState(repositories)} testId="panel-eye-repos"
          source={<>Source: /api/world/repositories/* (GitHub public API, cached) · polled every 5 min<br />Observed: {observed(repositories.dataUpdatedAt)}</>}>
          {repositories.isLoading && !repos.length ? <Skeleton /> : repos.length ? (
            <ul className="space-y-3">
              {repos.map(r => (
                <li key={r.slug} className="ws-stat" data-testid={`card-repo-${r.name}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={r.url} target="_blank" rel="noreferrer" className="ws-link inline-flex items-center gap-2 min-h-11" data-testid={`link-repo-${r.name}`}><GitBranch size={14} aria-hidden="true" />{r.slug}</a>
                    <StatePill state={r.unavailable ? "unavailable" : r.stale ? "stale" : "live"} />
                  </div>
                  <p className="ws-note mt-1">{r.unavailable ? "Source unavailable. No substitute readings." : `${r.openItems} open issues and PRs · ${r.stars} stars · last push ${observed(r.pushedAt)}`}</p>
                  {!!r.events.length && (
                    <ul className="mt-2 space-y-1">
                      {r.events.slice(0, 3).map(e => <li key={e.id} className="ws-meta"><a href={e.url} target="_blank" rel="noreferrer" className="ws-link">{e.summary}</a> · {e.actor} · {observed(e.occurredAt)}</li>)}
                    </ul>
                  )}
                  <p className="ws-meta mt-2">Snapshot fetched {observed(r.fetchedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div role="status"><p className="ws-err">Repository source unavailable.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void repositories.refetch()} data-testid="button-retry-repos">Retry</button></div>
          )}
        </Panel>

        <Panel title="Defensive reference shelf" labelId="eye-library" state="snapshot" testId="panel-eye-library"
          source={<>Source: bundled source-library.json · captured {observed(library.capturedAt)}</>}>
          <p className="ws-note">{defensiveRefs} stored references are tagged security, privacy, defense, or FOIA. They are reading material for protecting owner systems. None are installed or run, and the Eye never points them at people. <Link href="/memory" className="ws-link" data-testid="link-eye-memory">Browse in Memory</Link></p>
        </Panel>
      </div>
    </div>
  );
}
