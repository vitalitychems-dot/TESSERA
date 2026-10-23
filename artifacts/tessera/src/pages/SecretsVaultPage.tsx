import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { PageHead, Panel, Skeleton, queryState, observed } from "@/components/workspace/Surface";

type Credential = { name: string; purpose: string; configured: boolean };
type Entry = { id: string; text: string; source: string; url: string | null; category: string };

const CRED_ENDPOINT = "/api/owner/credentials/status";

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const r = await fetch(url, { signal, credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** Only name, purpose, and a boolean are ever read. Any other field (including values) is discarded. */
async function readCredentials(signal: AbortSignal): Promise<Credential[]> {
  const body = rec(await getJson(CRED_ENDPOINT, signal));
  if (!body || !Array.isArray(body.credentials)) throw new Error("contract");
  return body.credentials.flatMap(c => {
    const o = rec(c);
    if (!o || typeof o.name !== "string" || typeof o.configured !== "boolean") return [];
    return [{ name: o.name.slice(0, 64), purpose: typeof o.purpose === "string" ? o.purpose.slice(0, 160) : "Purpose not described", configured: o.configured }];
  });
}

async function readKnowledge(url: string, signal: AbortSignal): Promise<Entry[]> {
  const body = rec(await getJson(url, signal));
  const list = Array.isArray(body?.knowledge) ? body!.knowledge as unknown[] : Array.isArray(body?.entries) ? body!.entries as unknown[] : null;
  if (!list) throw new Error("contract");
  return list.flatMap((c, i) => {
    const o = rec(c);
    const text = typeof o?.text === "string" ? o.text : typeof o?.content === "string" ? o.content : "";
    if (!o || !text) return [];
    const url = typeof o.url === "string" && /^https?:\/\//.test(o.url) ? o.url : null;
    return [{ id: String(o.id ?? i), text: text.slice(0, 600), source: typeof o.agent === "string" ? o.agent : "Unknown source", url, category: typeof o.category === "string" ? o.category : "knowledge" }];
  });
}

export default function SecretsVaultPage() {
  useEffect(() => { document.title = "TESSERA | Secrets"; }, []);
  const [q, setQ] = useState("");
  const [sourcedOnly, setSourcedOnly] = useState(true);
  const creds = useQuery({ queryKey: ["owner-credentials-status"], queryFn: ({ signal }) => readCredentials(signal), retry: false, staleTime: 60_000 });
  const archive = useQuery({ queryKey: ["secrets-vault", "all"], queryFn: ({ signal }) => readKnowledge("/api/secret-knowledge/all", signal), staleTime: 55_000, refetchInterval: 60_000, retry: 1 });

  const entries = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (archive.data ?? []).filter(e => (!sourcedOnly || e.url) && (!n || `${e.text} ${e.source} ${e.category}`.toLowerCase().includes(n)));
  }, [archive.data, q, sourcedOnly]);

  return (
    <div className="ws-page" data-testid="secrets-vault-page">
      <PageHead eyebrow="Owner credentials / sourced knowledge" title="Secrets" icon={<KeyRound size={30} />} testId="secrets"
        onRefresh={() => { void creds.refetch(); void archive.refetch(); }} refreshing={creds.isFetching || archive.isFetching}>
        Which credentials are configured and what they are for. Values are never requested, stored in the browser, or displayed.
      </PageHead>
      <div className="space-y-4">
        <Panel title="Credential status" labelId="secrets-creds" state={queryState(creds)} testId="panel-secrets-creds"
          source={<>Source: {CRED_ENDPOINT} · observed {observed(creds.dataUpdatedAt)}</>}>
          {creds.isLoading ? <Skeleton rows={2} /> : creds.data ? (
            creds.data.length ? (
              <ul className="space-y-2">
                {creds.data.map(c => (
                  <li key={c.name} className="ws-stat flex items-start justify-between gap-3" data-testid={`row-cred-${c.name}`}>
                    <div className="min-w-0"><p className="font-mono text-sm break-all">{c.name}</p><p className="ws-note">{c.purpose}</p></div>
                    <span className="ws-pill shrink-0" data-state={c.configured ? "live" : "unavailable"}>{c.configured ? "Set" : "Missing"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="ws-note">The endpoint reported no tracked credentials.</p>
          ) : (
            <div role="status" data-testid="status-creds-unavailable">
              <p className="ws-note">No owner-safe credential status endpoint is available on this server. Tessera does not guess which keys exist, and shows nothing in their place.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void creds.refetch()} data-testid="button-retry-creds">Check again</button>
            </div>
          )}
        </Panel>

        <Panel title="Sourced knowledge" labelId="secrets-knowledge" state={queryState(archive)} testId="panel-secrets-knowledge"
          source={<>Source: /api/secret-knowledge/all (ingested records) · polled every 60s<br />Observed: {observed(archive.dataUpdatedAt)}</>}>
          <label htmlFor="secrets-search" className="block text-sm mb-1.5">Search entries</label>
          <input id="secrets-search" type="search" className="ws-input" value={q} onChange={e => setQ(e.target.value)} placeholder="source, topic, phrase…" data-testid="input-secrets-search" />
          <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--next-glass)]" checked={sourcedOnly} onChange={e => setSourcedOnly(e.target.checked)} data-testid="checkbox-sourced-only" />
            Only entries with a source link
          </label>
          {archive.isLoading ? <Skeleton /> : archive.data ? (
            <>
              <p className="ws-meta mt-2" aria-live="polite">{entries.length} of {archive.data.length} entries shown</p>
              {entries.length ? (
                <ul className="mt-3 space-y-3">
                  {entries.slice(0, 40).map(e => (
                    <li key={e.id} className="ws-stat" data-testid={`card-knowledge-${e.id}`}>
                      <p className="ws-meta">{e.source} · {e.category}</p>
                      <p className="ws-note mt-1 !text-[var(--next-bone)]">{e.text}</p>
                      {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="ws-link text-xs mt-2 inline-block">{e.url}</a> : <p className="ws-warn mt-2 text-xs">No source link recorded.</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="ws-note mt-3">No entries match these filters.</p>}
              {archive.isError && <p className="ws-warn mt-3">Refresh failed; showing the last successful list.</p>}
            </>
          ) : (
            <div role="status"><p className="ws-err mt-3">Knowledge endpoint unavailable. No substitute entries are generated.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void archive.refetch()} data-testid="button-retry-knowledge">Retry</button></div>
          )}
        </Panel>
      </div>
    </div>
  );
}
