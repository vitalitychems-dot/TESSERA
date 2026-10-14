import { useQuery } from "@tanstack/react-query";

const REPOSITORIES = [
  { name: "TESSERA", slug: "vitalitychems-dot/TESSERA" },
  { name: "Gitbook", slug: "vitalitychems-dot/Gitbook" },
  { name: "box-backup-2026-10-13", slug: "vitalitychems-dot/box-backup-2026-10-13" },
] as const;

const LIVE_POLL_MS = 30_000;
const BRAIN_POLL_MS = 60_000;
const REPOSITORY_POLL_MS = 5 * 60_000;

export interface ServicePulse {
  status: "ok" | "degraded";
  database: "configured" | "not-configured" | "unknown";
}

export interface BrainPulse {
  entries: number;
  domains: number;
  crossReferences: number;
  averageConfidence: number;
}

export interface RepositoryEvent {
  id: string;
  kind: string;
  occurredAt: string;
  actor: string;
  summary: string;
  url: string;
}

export interface RepositoryPulse {
  name: "TESSERA" | "Gitbook" | "box-backup-2026-10-13";
  slug: string;
  url: string;
  openItems: number | null;
  stars: number | null;
  pushedAt: string | null;
  events: RepositoryEvent[];
  fetchedAt: string;
  stale: boolean;
  unavailable?: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const abortFromQuery = () => controller.abort();
  if (signal.aborted) abortFromQuery();
  else signal.addEventListener("abort", abortFromQuery, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abortFromQuery);
  }
}

async function readServicePulse(signal: AbortSignal): Promise<ServicePulse> {
  const body = record(await readJson("/api/healthz", signal));
  if (!body || (body.status !== "ok" && body.status !== "degraded")) {
    throw new Error("Health response did not match the service contract.");
  }
  const database = body.db === "configured" || body.db === "not-configured"
    ? body.db
    : "unknown";
  return { status: body.status, database };
}

async function readBrainPulse(signal: AbortSignal): Promise<BrainPulse> {
  const body = record(await readJson("/api/knowledge-corpus/stats", signal));
  const stats = record(body?.stats);
  const entries = nonNegativeInteger(body?.totalEntries);
  const domains = nonNegativeInteger(stats?.uniqueDomains);
  const crossReferences = nonNegativeInteger(stats?.crossReferences);
  const averageConfidence = stats?.averageConfidence;

  if (
    entries === null ||
    domains === null ||
    crossReferences === null ||
    typeof averageConfidence !== "number" ||
    !Number.isFinite(averageConfidence)
  ) {
    throw new Error("Knowledge response did not match the corpus contract.");
  }

  return { entries, domains, crossReferences, averageConfidence };
}

function validRepositoryUrl(value: unknown, slug: string): string {
  const fallback = `https://github.com/${slug}`;
  if (typeof value !== "string") return fallback;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "github.com" && url.pathname.startsWith(`/${slug}/`)) {
      return url.toString();
    }
  } catch {
    // Fall through to the fixed public repository URL.
  }
  return fallback;
}

function eventSummary(type: string, payload: Record<string, unknown>): string {
  const action = typeof payload.action === "string" ? payload.action.slice(0, 64) : "";
  const issue = record(payload.issue);
  const pullRequest = record(payload.pull_request);
  const title = typeof issue?.title === "string"
    ? issue.title
    : typeof pullRequest?.title === "string"
      ? pullRequest.title
      : "";

  if (type === "PushEvent") {
    const commits = Array.isArray(payload.commits) ? payload.commits.length : 0;
    return commits > 0 ? `Pushed ${commits} commit${commits === 1 ? "" : "s"}` : "Pushed a commit";
  }
  if (type === "PullRequestEvent") return `Pull request ${action || "updated"}${title ? ` · ${title.slice(0, 120)}` : ""}`;
  if (type === "IssuesEvent") return `Issue ${action || "updated"}${title ? ` · ${title.slice(0, 120)}` : ""}`;
  if (type === "IssueCommentEvent") return "Comment added to an issue";
  if (type === "ReleaseEvent") return `Release ${action || "updated"}`;
  return type.replace(/Event$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").slice(0, 80) || "Repository activity";
}

function parseEvents(value: unknown, slug: string): RepositoryEvent[] {
  if (!Array.isArray(value)) throw new Error("GitHub events response was not a list.");
  const baseUrl = `https://github.com/${slug}`;

  return value.flatMap((candidate): RepositoryEvent[] => {
    const event = record(candidate);
    const payload = record(event?.payload);
    const actor = record(event?.actor);
    if (
      typeof event?.id !== "string" ||
      typeof event.type !== "string" ||
      !safeDate(event.created_at) ||
      typeof actor?.login !== "string" ||
      !payload
    ) return [];

    let eventUrl = baseUrl;
    const issue = record(payload.issue);
    const pullRequest = record(payload.pull_request);
    const candidateUrl = issue?.html_url ?? pullRequest?.html_url;
    if (candidateUrl !== undefined) {
      eventUrl = validRepositoryUrl(candidateUrl, slug);
    } else if (event.type === "PushEvent" && Array.isArray(payload.commits)) {
      const firstCommit = record(payload.commits[0]);
      if (typeof firstCommit?.sha === "string" && /^[a-f0-9]{7,40}$/i.test(firstCommit.sha)) {
        eventUrl = `${baseUrl}/commit/${firstCommit.sha}`;
      }
    }

    return [{
      id: event.id.slice(0, 80),
      kind: event.type.slice(0, 80),
      occurredAt: event.created_at as string,
      actor: actor.login.slice(0, 80),
      summary: eventSummary(event.type, payload),
      url: eventUrl,
    }];
  }).slice(0, 8);
}

async function readRepositoryPulse(
  repository: (typeof REPOSITORIES)[number],
  signal: AbortSignal,
): Promise<RepositoryPulse> {
  const snapshot = record(await readJson(`/api/world/repositories/${repository.name}`, signal));
  const metadata = record(snapshot?.metadata);
  const openItems = nonNegativeInteger(metadata?.open_issues_count);
  const stars = nonNegativeInteger(metadata?.stargazers_count);
  if (!metadata || openItems === null || stars === null) {
    throw new Error(`GitHub metadata for ${repository.name} was incomplete.`);
  }

  return {
    name: repository.name,
    slug: repository.slug,
    url: `https://github.com/${repository.slug}`,
    openItems,
    stars,
    pushedAt: safeDate(metadata.pushed_at),
    events: parseEvents(snapshot?.events, repository.slug),
    fetchedAt: safeDate(snapshot?.fetchedAt) ?? "",
    stale: snapshot?.stale === true,
  };
}

async function readRepositoryPulses(signal: AbortSignal): Promise<RepositoryPulse[]> {
  return Promise.all(REPOSITORIES.map(async repository => {
    try { return await readRepositoryPulse(repository, signal); }
    catch (error) {
      if (signal.aborted) throw error;
      return {
        ...repository, url: `https://github.com/${repository.slug}`, openItems: null, stars: null,
        pushedAt: null, events: [], fetchedAt: "", stale: true, unavailable: true,
      };
    }
  }));
}

export function useWorldPulse() {
  const service = useQuery({
    queryKey: ["tessera-world", "service"],
    queryFn: ({ signal }) => readServicePulse(signal),
    staleTime: LIVE_POLL_MS - 5_000,
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const brain = useQuery({
    queryKey: ["tessera-world", "brain"],
    queryFn: ({ signal }) => readBrainPulse(signal),
    staleTime: BRAIN_POLL_MS - 5_000,
    refetchInterval: BRAIN_POLL_MS,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const repositories = useQuery({
    queryKey: ["tessera-world", "repositories"],
    queryFn: ({ signal }) => readRepositoryPulses(signal),
    staleTime: REPOSITORY_POLL_MS - 10_000,
    refetchInterval: REPOSITORY_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  return { service, brain, repositories };
}
