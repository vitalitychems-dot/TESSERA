import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTesseraConnections,
  useGetTesseraGithub,
  getGetTesseraConnectionsQueryKey,
  getGetTesseraGithubQueryKey,
  type GetTesseraGithubParams,
} from "@workspace/api-client-react";
import { useAdmin } from "@/lib/adminContext";
import { ArrowLeft, ExternalLink, Loader2, LogOut, RefreshCw } from "lucide-react";

type Repo = "TESSERA" | "Gitbook";

function errText(err: unknown): string {
  const e = err as { data?: { message?: unknown }; message?: unknown } | null;
  if (e && e.data && typeof e.data.message === "string") return e.data.message;
  if (e && typeof e.message === "string") return e.message;
  return "Request failed.";
}

const NAMES: Record<string, string> = { github: "GitHub", model: "Model worker", cursor: "Cursor" };

export default function ConnectionsPage() {
  const qc = useQueryClient();
  const { logout } = useAdmin();
  const [repo, setRepo] = useState<Repo>("TESSERA");
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const params: GetTesseraGithubParams = { repository: repo };

  useEffect(() => { document.title = "Connections | Tessera"; }, []);

  const conns = useGetTesseraConnections({ query: { queryKey: getGetTesseraConnectionsQueryKey() } });
  const gh = useGetTesseraGithub(params, { query: { queryKey: getGetTesseraGithubQueryKey(params) } });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([conns.refetch(), gh.refetch()]);
    setRefreshing(false);
  };

  const signOut = async () => {
    setSignOutError(null);
    try {
      await Promise.resolve(logout());
    } catch (e) {
      setSignOutError(errText(e));
    }
  };
  void qc;

  const byProvider = (p: string) => conns.data?.connections.find((c) => c.provider === p);

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-5">
      <header className="flex flex-wrap items-center gap-2 pr-28">
        <Link href="/" className="flex items-center gap-1 text-sm text-cyan-400" data-testid="link-back-chat">
          <ArrowLeft size={16} /> Chat
        </Link>
        <h1 className="text-lg font-semibold flex-1">Connections</h1>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50" data-testid="button-refresh">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
        <button type="button" onClick={() => void signOut()}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm" data-testid="button-sign-out">
          <LogOut size={14} /> Sign out
        </button>
      </header>
      {signOutError && <p role="alert" className="text-sm text-destructive" data-testid="text-signout-error">Sign-out failed: {signOutError}</p>}

      {conns.isError && (
        <div role="alert" className="hud-panel rounded-lg p-4 text-sm text-destructive" data-testid="text-connections-error">
          Could not verify connections: {errText(conns.error)}{" "}
          <button type="button" className="underline" onClick={() => void conns.refetch()}>Retry</button>
        </div>
      )}

      <section aria-label="Provider status" className="grid gap-3 sm:grid-cols-3">
        {(["github", "model", "cursor"] as const).map((p) => {
          const c = byProvider(p);
          const pending = p === "cursor";
          return (
            <div key={p} className="hud-panel rounded-lg p-4 space-y-2" data-testid={`panel-${p}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{NAMES[p]}</h2>
                {conns.isLoading ? (
                  <Loader2 size={14} className="animate-spin text-cyan-400" />
                ) : (
                  <span className={`text-[10px] font-mono ${c?.connected ? "text-emerald-400" : pending ? "text-amber-400" : "text-destructive"}`}>
                    {c?.connected ? p === "model" ? "CONFIGURED ONLY" : "CONNECTED" : pending ? "AUTHORIZATION PENDING" : "NOT CONNECTED"}
                  </span>
                )}
              </div>
              {c && <p className="text-xs text-muted-foreground break-words">{c.message} (HTTP {c.status})</p>}
              {p === "model" && conns.data && (
                <>
                  <p className="text-xs font-mono text-cyan-400">Model: {conns.data.model}</p>
                  <p className="text-xs text-muted-foreground">An attributed worker, not proof of Tessera's original identity. Configuration is not a live connection check.</p>
                </>
              )}
              {p === "github" && conns.data && <p className="text-xs font-mono text-cyan-400">Repository: {conns.data.repository}</p>}
              {pending && (
                <p className="text-xs text-muted-foreground">
                  Cursor authorization is pending. Launch controls will be enabled after the connection is authorized.
                </p>
              )}
            </div>
          );
        })}
      </section>

      <section aria-label="GitHub open pull requests" className="hud-panel rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold flex-1">Open pull requests</h2>
          <label htmlFor="repo-select" className="sr-only">Repository</label>
          <select id="repo-select" value={repo} onChange={(e) => setRepo(e.target.value as Repo)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" data-testid="select-repository">
            <option value="TESSERA">TESSERA</option>
            <option value="Gitbook">Gitbook</option>
          </select>
        </div>
        {gh.isLoading && <p className="text-xs font-mono text-muted-foreground" role="status">Loading pull requests...</p>}
        {gh.isError && (
          <p role="alert" className="text-sm text-destructive" data-testid="text-github-error">
            GitHub error: {errText(gh.error)}{" "}
            <button type="button" className="underline" onClick={() => void gh.refetch()}>Retry</button>
          </p>
        )}
        {gh.data && gh.data.pulls.length === 0 && <p className="text-sm text-muted-foreground">No open pull requests in {gh.data.repository}.</p>}
        <ul className="space-y-2">
          {gh.data?.pulls.map((pr) => (
            <li key={pr.number} className="flex items-start gap-3 rounded-md border border-border p-3" data-testid={`row-pr-${pr.number}`}>
              <span className="font-mono text-xs text-cyan-400 pt-0.5">#{pr.number}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm break-words">{pr.title}</p>
                <p className="text-xs font-mono text-muted-foreground break-all">{pr.branch}{pr.draft ? " \u00b7 draft" : ""}</p>
              </div>
              <a href={pr.url} target="_blank" rel="noopener noreferrer" aria-label={`Open pull request ${pr.number} on GitHub`} className="text-cyan-400">
                <ExternalLink size={16} />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
