import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, BookOpen, ExternalLink, RefreshCw, Send, ShieldCheck } from "lucide-react";
import SourceLibrary from "@/components/SourceLibrary";

type GitbookTask = {
  id: string;
  owner: string;
  status: string;
  deliverable: string;
  acceptanceTest: string;
};

type GitbookRoadmap = {
  tasks: GitbookTask[];
  rules: string[];
  conferenceRules: string[];
  activeClaims: string[];
  observedAt: string;
  stale: boolean;
  sources: {
    backlog: { url: string; revision: string };
    handoff: { url: string; updatedAt: string };
    conference: { url: string; revision: string };
    checkins: { url: string; revision: string };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getRoadmap(signal: AbortSignal): Promise<GitbookRoadmap> {
  const response = await fetch("/api/gitbook/roadmap", {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in to read the owner ledger." : "Gitbook could not be reached.");
  const body: unknown = await response.json();
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.tasks) || !Array.isArray(body.rules) || !isRecord(body.sources)) {
    throw new Error("Gitbook returned an unexpected response.");
  }
  return body as unknown as GitbookRoadmap;
}

export default function GitbookRoadmapPage() {
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [taskId, setTaskId] = useState("");
  const [note, setNote] = useState("");
  const [publicConfirmation, setPublicConfirmation] = useState(false);
  const [postedUrl, setPostedUrl] = useState("");
  const [writeError, setWriteError] = useState("");

  const roadmap = useQuery({
    queryKey: ["gitbook", "roadmap"],
    queryFn: ({ signal }) => getRoadmap(signal),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const progress = useMutation({
    mutationFn: async (payload: { taskId: string; note: string; publicConfirmation: boolean }) => {
      const response = await fetch("/api/gitbook/progress", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(result) || result.ok !== true || typeof result.commentUrl !== "string") {
        throw new Error(response.status === 503
          ? "Gitbook writing is unavailable. Check the server's GitHub issue permission."
          : response.status === 429
            ? "Progress notes are temporarily rate-limited."
            : "Gitbook did not accept this progress note.");
      }
      return result as { ok: true; commentUrl: string; taskId: string };
    },
    onSuccess: result => {
      setPostedUrl(result.commentUrl);
      setNote("");
      setPublicConfirmation(false);
      setWriteError("");
    },
    onError: error => {
      setWriteError(error instanceof Error ? error.message : "Gitbook write failed.");
    },
  });

  const tasks = roadmap.data?.tasks ?? [];
  const openTasks = useMemo(() => tasks.filter(task => !task.status.toUpperCase().startsWith("DONE")), [tasks]);
  const filtered = useMemo(() => {
    const source = filter === "active" ? openTasks : tasks;
    const needle = search.trim().toLowerCase();
    return needle
      ? source.filter(task => `${task.id} ${task.owner} ${task.status} ${task.deliverable} ${task.acceptanceTest}`.toLowerCase().includes(needle))
      : source;
  }, [filter, openTasks, search, tasks]);

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-background px-4 pb-24 pt-5 sm:px-6" data-testid="gitbook-roadmap-page">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">TESSERA NEXT · Canonical work source</p>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-foreground sm:text-3xl">
              <span className="next-mosaic shrink-0" aria-hidden="true"><span /><span /><span /><span /></span>
              Gitbook ledger
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Live read-through from the public Gitbook repository. Gitbook remains the canonical rules and task source; Tessera does not copy or silently rewrite its backlog.
            </p>
          </div>
          <button type="button" onClick={() => void roadmap.refetch()} disabled={roadmap.isFetching}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 px-3 py-2 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            aria-label="Refresh Gitbook data">
            <RefreshCw aria-hidden="true" size={16} className={roadmap.isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Gitbook sources and status">
          {roadmap.isLoading ? <p role="status" className="text-sm text-muted-foreground">Reading the canonical Gitbook backlog…</p> : null}
          {roadmap.isError && !roadmap.data ? (
            <div role="alert" className="flex items-start gap-3 text-sm text-destructive">
              <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
              <span>{roadmap.error instanceof Error ? roadmap.error.message : "Gitbook is unavailable. No task state was substituted."}</span>
            </div>
          ) : null}
          {roadmap.data ? (
            <>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{openTasks.length} active / {tasks.length} recorded tasks</span>
                <span>Read at {new Date(roadmap.data.observedAt).toLocaleString()}</span>
                <span>{roadmap.data.stale ? "Cached source — last refresh failed" : "Source reachable"}</span>
              </div>
              {roadmap.data.stale ? <p role="status" className="mt-3 text-sm text-destructive">Showing the last successful Gitbook snapshot; it may be out of date.</p> : null}
              {roadmap.isError ? <p role="status" className="mt-3 text-sm text-destructive">Refresh failed; the displayed snapshot is unchanged.</p> : null}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a href="https://github.com/vitalitychems-dot/Gitbook/blob/main/intake/HYBRID-CONSOLIDATION-BACKLOG.md" target="_blank" rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  Backlog <ExternalLink aria-hidden="true" size={14} />
                </a>
                <a href={roadmap.data.sources.handoff.url} target="_blank" rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  Merge and safety rules <ExternalLink aria-hidden="true" size={14} />
                </a>
                <a href="https://github.com/vitalitychems-dot/Gitbook/issues/2" target="_blank" rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  Cursor / agent coordination <ExternalLink aria-hidden="true" size={14} />
                </a>
                <a href={roadmap.data.sources.conference.url} target="_blank" rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  Conference instructions <ExternalLink aria-hidden="true" size={14} />
                </a>
              </div>
              <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">
                Backlog revision {roadmap.data.sources.backlog.revision.slice(0, 12)} · Handoff updated {new Date(roadmap.data.sources.handoff.updatedAt).toLocaleString()}
              </p>
            </>
          ) : null}
        </section>

        <SourceLibrary />

        {roadmap.data ? (
          <>
            <section className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-5" aria-labelledby="gitbook-rules-heading">
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <h2 id="gitbook-rules-heading" className="font-semibold text-foreground">Rules for work and release</h2>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {roadmap.data.rules.map((rule, index) => <li key={`${index}-${rule}`} className="list-inside list-disc">{rule}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    These rules come from Gitbook issue #67. A status comment never grants a merge or changes a task's canonical state.
                  </p>
                  <details className="mt-3 text-sm">
                    <summary className="min-h-11 cursor-pointer py-3 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Agent conference rules</summary>
                    <ul className="space-y-2 pb-2 text-muted-foreground">
                      {roadmap.data.conferenceRules.map((rule, index) => <li key={`${index}-${rule}`} className="list-inside list-disc">{rule}</li>)}
                    </ul>
                    <a className="text-primary underline" href={roadmap.data.sources.conference.url} target="_blank" rel="noreferrer">Open the full Gitbook instructions</a>
                  </details>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="gitbook-claims-heading">
              <h2 id="gitbook-claims-heading" className="font-semibold">Reported agent claims</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Read from Gitbook's check-in ledger; these are recorded claims, not a live signal that Cursor or another agent is running.
              </p>
              {roadmap.data.activeClaims.length ? (
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {roadmap.data.activeClaims.map((claim, index) => <li key={`${index}-${claim}`} className="list-inside list-disc">{claim}</li>)}
                </ul>
              ) : <p className="mt-3 text-sm text-muted-foreground">Gitbook records no active claims.</p>}
              <a href={roadmap.data.sources.checkins.url} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Open check-in ledger <ExternalLink aria-hidden="true" size={14} />
              </a>
            </section>

            <section aria-labelledby="gitbook-tasks-heading" className="space-y-3">
              <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="gitbook-tasks-heading" className="flex items-center gap-2 text-xl font-bold">
                    <BookOpen aria-hidden="true" size={19} className="text-primary" /> Work list
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">Owner, current state and acceptance test are read from Gitbook.</p>
                </div>
                <div className="flex gap-2" aria-label="Filter task list">
                  <button type="button" onClick={() => setFilter("active")} aria-pressed={filter === "active"}
                    className="min-h-11 rounded-lg border border-border px-3 text-sm aria-pressed:border-primary aria-pressed:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Active</button>
                  <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"}
                    className="min-h-11 rounded-lg border border-border px-3 text-sm aria-pressed:border-primary aria-pressed:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">All</button>
                </div>
              </header>
              <label htmlFor="gitbook-task-search" className="sr-only">Search Gitbook tasks</label>
              <input id="gitbook-task-search" value={search} onChange={event => setSearch(event.target.value)}
                placeholder="Search task, owner, status or acceptance test"
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
              <p className="text-xs text-muted-foreground" role="status">{filtered.length} tasks shown</p>
              <div className="space-y-3">
                {filtered.map(task => (
                  <article key={task.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-mono text-sm font-semibold text-primary">{task.id}</h3>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">{task.status}</span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">{task.deliverable}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Owner: {task.owner}</p>
                    <details className="mt-3 text-sm">
                      <summary className="min-h-11 cursor-pointer py-3 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Acceptance test</summary>
                      <p className="pb-2 text-muted-foreground">{task.acceptanceTest}</p>
                    </details>
                  </article>
                ))}
                {!filtered.length ? <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">No matching tasks in this Gitbook view.</p> : null}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="gitbook-progress-heading">
              <div>
                <h2 id="gitbook-progress-heading" className="font-semibold">Post a progress note to Gitbook</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This writes a public comment to the Gitbook coordination issue. It does not edit the authoritative backlog or mark work done; those changes still need a reviewed Gitbook update.
                </p>
              </div>
              <label htmlFor="gitbook-progress-task" className="block text-sm">Task</label>
              <select id="gitbook-progress-task" value={taskId} onChange={event => setTaskId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <option value="">Select a current Gitbook task</option>
                {tasks.map(task => <option key={task.id} value={task.id}>{task.id} · {task.status}</option>)}
              </select>
              <label htmlFor="gitbook-progress-note" className="block text-sm">Progress note (max 2,000 characters)</label>
              <textarea id="gitbook-progress-note" value={note} onChange={event => setNote(event.target.value)}
                maxLength={2_000} rows={4} placeholder="State what changed and include the checks or links that prove it."
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
              <label className="flex min-h-11 items-start gap-3 text-sm text-muted-foreground">
                <input type="checkbox" checked={publicConfirmation} onChange={event => setPublicConfirmation(event.target.checked)}
                  className="mt-1 size-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
                I confirm this note is safe to publish and contains no credentials, private data, or secrets.
              </label>
              <button type="button" onClick={() => {
                setPostedUrl("");
                setWriteError("");
                progress.mutate({ taskId, note, publicConfirmation });
              }} disabled={progress.isPending || !taskId || !note.trim() || !publicConfirmation}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                <Send aria-hidden="true" size={15} /> {progress.isPending ? "Posting…" : "Post public progress note"}
              </button>
              {writeError ? <p role="alert" className="text-sm text-destructive">{writeError}</p> : null}
              {postedUrl ? <p role="status" className="text-sm text-primary">Posted successfully. <a className="underline" href={postedUrl} target="_blank" rel="noreferrer">View public note</a></p> : null}
              <p className="text-xs text-muted-foreground">
                If the source or write permission is unavailable, Tessera reports it and does not substitute simulated status. <Link href="/forum" className="text-primary underline">Return to the Forum</Link>
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
