import type { GitHubClient } from "./github.js";
import { GitHubApiError } from "./github.js";
import { assertAgentName, assertOptionalDir, assertRepoPath, branchName, isMarkdownPath } from "./paths.js";
import { findLane, loadLanes, routeTask, type Lane, type RouteDecision } from "./routing.js";

interface ContentResponse {
  type?: string;
  encoding?: string;
  content?: string;
  sha?: string;
  path?: string;
  size?: number;
  name?: string;
  html_url?: string;
}

interface ContentEntry {
  type?: string;
  name?: string;
  path?: string;
  sha?: string;
  html_url?: string;
}

interface TreeResponse {
  tree?: Array<{ path?: string; type?: string }>;
}

interface SearchResponse {
  items?: Array<{
    name?: string;
    path?: string;
    html_url?: string;
    text_matches?: Array<{ fragment?: string }>;
  }>;
}

interface CommentResponse {
  id?: number;
  body?: string;
  html_url?: string;
  created_at?: string;
  user?: { login?: string | null } | null;
}

interface RefResponse {
  object?: { sha?: string };
  ref?: string;
}

interface PutContentResponse {
  commit?: { sha?: string };
  content?: { path?: string; sha?: string };
}

interface PullResponse {
  number?: number;
  html_url?: string;
  draft?: boolean;
  title?: string;
  head?: { ref?: string; sha?: string };
  user?: { login?: string | null } | null;
}

interface CommitResponse {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { name?: string | null; date?: string | null } | null;
  };
}

export interface GitbookServiceOptions {
  client?: GitHubClient;
  owner: string;
  repo: string;
  branch: string;
  boardIssue: number;
  handoffPath: string;
  agentLane?: string;
  lanes?: Lane[];
  now?: () => Date;
}

export interface DocHit {
  path: string;
  name: string;
  htmlUrl: string | null;
  snippet: string;
  score: number;
  source: "github-code-search" | "tree-scan";
}

export interface DraftChange {
  branch: string;
  base: string;
  path: string;
  commitSha: string | null;
  pullRequest: {
    number: number;
    url: string | null;
    draft: true;
    base: string;
    head: string;
  };
}

function requireClient(client: GitHubClient | undefined): GitHubClient {
  if (!client) {
    throw new Error("GITBOOK_GITHUB_TOKEN is not set. Put the token in the environment, never in source control.");
  }
  return client;
}

function decodeContent(payload: ContentResponse): string {
  const raw = payload.content ?? "";
  if (payload.encoding === "none") return raw;
  if (!raw) return "";
  return Buffer.from(raw.replace(/\s/g, ""), "base64").toString("utf8");
}

function snippetAround(text: string, query: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const needle = query.trim().toLowerCase();
  const index = needle ? flat.toLowerCase().indexOf(needle.split(/\s+/)[0] ?? needle) : 0;
  const start = Math.max(0, index - 80);
  const slice = flat.slice(start, start + 240);
  return start > 0 ? `…${slice}` : slice;
}

function repoPath(owner: string, repo: string, suffix: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

export function createGitbookService(options: GitbookServiceOptions) {
  const now = options.now ?? (() => new Date());
  const lanes = options.lanes ?? loadLanes();
  const owner = options.owner;
  const repo = options.repo;

  function assertFileWrite(explicitLane: string | undefined): void {
    const rawEnvLane = options.agentLane?.trim() ?? "";
    if (!rawEnvLane) {
      throw new Error(
        "GITBOOK_AGENT_LANE is not set. This process is read-only and cannot open draft pull requests.",
      );
    }
    const envLane = findLane(lanes, rawEnvLane);
    if (!envLane) {
      throw new Error(
        `GITBOOK_AGENT_LANE "${rawEnvLane}" is not a lane in agents.json. File changes are denied.`,
      );
    }
    const requested = explicitLane?.trim();
    if (requested) {
      const requestedLane = findLane(lanes, requested);
      if (!requestedLane || requestedLane.id !== envLane.id) {
        throw new Error(
          `lane "${requested}" cannot override GITBOOK_AGENT_LANE ${envLane.id}. A per-call lane cannot escalate this process.`,
        );
      }
    }
    if (envLane.fileWrites === false) {
      throw new Error(
        `${envLane.name} is ${envLane.mode} and cannot open draft pull requests or change files through this connector`,
      );
    }
  }

  async function getMainSha(client: GitHubClient): Promise<string> {
    const ref = await client.request<RefResponse>(
      "GET",
      repoPath(owner, repo, `/git/ref/heads/${encodeURIComponent(options.branch)}`),
    );
    const sha = ref.object?.sha;
    if (!sha) throw new Error(`main ref ${options.branch} did not include a commit sha`);
    return sha;
  }

  async function createBranch(client: GitHubClient, branch: string, sha: string): Promise<void> {
    if (branch === options.branch || branch === "main") {
      throw new Error("refusing to create a branch that targets main directly");
    }
    await client.request("POST", repoPath(owner, repo, "/git/refs"), {
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  async function readContent(client: GitHubClient, filePath: string, ref: string): Promise<ContentResponse | null> {
    try {
      return await client.request<ContentResponse>(
        "GET",
        repoPath(owner, repo, `/contents/${encodePath(filePath)}?ref=${encodeURIComponent(ref)}`),
      );
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return null;
      throw error;
    }
  }

  async function openDraftPull(client: GitHubClient, branch: string, title: string, body: string): Promise<PullResponse> {
    if (branch === options.branch) {
      throw new Error("refusing to open a pull request whose head is the default branch");
    }
    const pull = await client.request<PullResponse>("POST", repoPath(owner, repo, "/pulls"), {
      title,
      head: branch,
      base: options.branch,
      draft: true,
      body,
    });
    if (pull.draft !== true) {
      if (pull.number) {
        await client.request("PATCH", repoPath(owner, repo, `/pulls/${pull.number}`), { state: "closed" });
      }
      throw new Error("GitHub did not open the pull request as a draft, so it was closed. No merge was attempted.");
    }
    return pull;
  }

  async function commitFile(input: {
    client: GitHubClient;
    branch: string;
    filePath: string;
    content: string;
    message: string;
    existingSha: string | undefined;
  }): Promise<string | null> {
    if (input.branch === "main" || input.branch === options.branch) {
      throw new Error("refusing a direct commit to the default branch");
    }
    const result = await input.client.request<PutContentResponse>(
      "PUT",
      repoPath(owner, repo, `/contents/${encodePath(input.filePath)}`),
      {
        message: input.message,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: input.branch,
        ...(input.existingSha ? { sha: input.existingSha } : {}),
      },
    );
    return result.commit?.sha ?? null;
  }

  function draftResult(branch: string, filePath: string, commitSha: string | null, pull: PullResponse): DraftChange {
    return {
      branch,
      base: options.branch,
      path: filePath,
      commitSha,
      pullRequest: {
        number: pull.number ?? 0,
        url: pull.html_url ?? null,
        draft: true,
        base: options.branch,
        head: branch,
      },
    };
  }

  return {
    lanes,

    async searchDocs(query: string): Promise<{ query: string; hits: DocHit[] }> {
      const text = query.trim();
      if (!text) throw new Error("query is required");
      const client = requireClient(options.client);
      try {
        const hits = await searchViaCodeSearch(client, owner, repo, text);
        return { query: text, hits };
      } catch (error) {
        if (error instanceof GitHubApiError && (error.status === 403 || error.status === 422 || error.status === 503)) {
          const hits = await searchViaTree(client, owner, repo, options.branch, text);
          return { query: text, hits };
        }
        throw error;
      }
    },

    async readPage(filePath: string): Promise<{ path: string; sha: string | null; size: number; content: string }> {
      const safe = assertRepoPath(filePath);
      const client = requireClient(options.client);
      const payload = await client.request<ContentResponse | ContentEntry[]>(
        "GET",
        repoPath(owner, repo, `/contents/${encodePath(safe)}?ref=${encodeURIComponent(options.branch)}`),
      );
      if (Array.isArray(payload)) {
        throw new Error(`${safe} is a directory. Use list_pages.`);
      }
      if (payload.type === "dir") {
        throw new Error(`${safe} is a directory. Use list_pages.`);
      }
      const content = decodeContent(payload);
      return {
        path: payload.path ?? safe,
        sha: payload.sha ?? null,
        size: payload.size ?? Buffer.byteLength(content, "utf8"),
        content,
      };
    },

    async listPages(dir: string | undefined): Promise<{
      dir: string;
      entries: Array<{ type: string; name: string; path: string }>;
    }> {
      const safe = assertOptionalDir(dir);
      const client = requireClient(options.client);
      const suffix = safe ? `/contents/${encodePath(safe)}` : "/contents";
      const payload = await client.request<ContentEntry[] | ContentResponse>(
        "GET",
        repoPath(owner, repo, `${suffix}?ref=${encodeURIComponent(options.branch)}`),
      );
      if (!Array.isArray(payload)) {
        throw new Error(`${safe || "/"} is not a directory`);
      }
      const entries = payload
        .filter((entry) => entry.type === "dir" || (entry.type === "file" && isMarkdownPath(entry.path ?? entry.name ?? "")))
        .map((entry) => ({
          type: entry.type ?? "file",
          name: entry.name ?? "",
          path: entry.path ?? "",
        }))
        .sort((a, b) => a.path.localeCompare(b.path));
      return { dir: safe, entries };
    },

    async getBoard(): Promise<{
      owner: string;
      repo: string;
      issue: number;
      url: string;
      comments: Array<{ id: number; author: string | null; createdAt: string | null; body: string; url: string | null }>;
    }> {
      const client = requireClient(options.client);
      const comments: CommentResponse[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const batch = await client.request<CommentResponse[]>(
          "GET",
          repoPath(owner, repo, `/issues/${options.boardIssue}/comments?per_page=100&page=${page}`),
        );
        comments.push(...batch);
        if (batch.length < 100) break;
      }
      return {
        owner,
        repo,
        issue: options.boardIssue,
        url: `https://github.com/${owner}/${repo}/issues/${options.boardIssue}`,
        comments: comments.map((comment) => ({
          id: comment.id ?? 0,
          author: comment.user?.login ?? null,
          createdAt: comment.created_at ?? null,
          body: comment.body ?? "",
          url: comment.html_url ?? null,
        })),
      };
    },

    async postBoardUpdate(agent: string, text: string): Promise<{ id: number | null; url: string | null; body: string }> {
      const name = assertAgentName(agent);
      const note = text.trim();
      if (!note) throw new Error("text is required");
      const body = `AGENT: ${name}\n\n${note}`;
      const client = requireClient(options.client);
      const comment = await client.request<CommentResponse>(
        "POST",
        repoPath(owner, repo, `/issues/${options.boardIssue}/comments`),
        { body },
      );
      return { id: comment.id ?? null, url: comment.html_url ?? null, body };
    },

    async readHandoff(): Promise<{ path: string; sha: string | null; content: string }> {
      const page = await this.readPage(options.handoffPath);
      return page;
    },

    async writeHandoff(agent: string, note: string, lane?: string): Promise<DraftChange> {
      assertFileWrite(lane);
      const name = assertAgentName(agent);
      const text = note.trim();
      if (!text) throw new Error("note is required");
      const client = requireClient(options.client);
      const filePath = assertRepoPath(options.handoffPath);
      const branch = branchName("handoff", name, now());
      const baseSha = await getMainSha(client);
      await createBranch(client, branch, baseSha);
      const existing = await readContent(client, filePath, branch);
      const previous = existing ? decodeContent(existing) : "";
      const next = appendHandoff(previous, name, text, now());
      const commitSha = await commitFile({
        client,
        branch,
        filePath,
        content: next,
        message: `docs: handoff note from ${name}`,
        existingSha: existing?.sha,
      });
      const pull = await openDraftPull(
        client,
        branch,
        `Handoff note from ${name}`,
        [
          `Draft handoff note for \`${filePath}\`.`,
          "This connector does not push to main and does not merge.",
          "Run recent_changes before claiming related work.",
          "",
          `Agent: ${name}`,
        ].join("\n"),
      );
      return draftResult(branch, filePath, commitSha, pull);
    },

    async proposePageChange(filePath: string, content: string, summary: string, lane?: string): Promise<DraftChange> {
      assertFileWrite(lane);
      const safe = assertRepoPath(filePath);
      const next = content;
      const title = summary.trim();
      if (!title) throw new Error("summary is required");
      if (!next.trim()) throw new Error("content is required");
      if (next.includes("\0")) throw new Error("content must be text");
      const client = requireClient(options.client);
      const branch = branchName("page", safe, now());
      const baseSha = await getMainSha(client);
      await createBranch(client, branch, baseSha);
      const existing = await readContent(client, safe, branch);
      if (existing?.type === "dir") throw new Error(`${safe} is a directory`);
      const commitSha = await commitFile({
        client,
        branch,
        filePath: safe,
        content: next.endsWith("\n") ? next : `${next}\n`,
        message: `docs: ${title}`,
        existingSha: existing?.sha,
      });
      const pull = await openDraftPull(
        client,
        branch,
        title,
        [
          `Draft proposal for \`${safe}\`.`,
          "The file on this branch is the proposed content. main is not modified.",
          "This connector does not merge.",
          "Run recent_changes before claiming related work.",
        ].join("\n"),
      );
      return draftResult(branch, safe, commitSha, pull);
    },

    async recentChanges(): Promise<{
      owner: string;
      repo: string;
      branch: string;
      headSha: string | null;
      commits: Array<{ sha: string; message: string; date: string | null; author: string | null; url: string | null }>;
      openPullRequests: Array<{
        number: number;
        title: string;
        draft: boolean;
        url: string | null;
        headRef: string;
        headSha: string;
        author: string | null;
      }>;
      overlapCheck: string;
    }> {
      const client = requireClient(options.client);
      const [commits, pulls] = await Promise.all([
        client.request<CommitResponse[]>(
          "GET",
          repoPath(owner, repo, `/commits?sha=${encodeURIComponent(options.branch)}&per_page=20`),
        ),
        client.request<PullResponse[]>(
          "GET",
          repoPath(owner, repo, "/pulls?state=open&per_page=30"),
        ),
      ]);
      return {
        owner,
        repo,
        branch: options.branch,
        headSha: commits[0]?.sha ?? null,
        commits: commits.map((commit) => ({
          sha: commit.sha ?? "",
          message: (commit.commit?.message ?? "").split("\n")[0] ?? "",
          date: commit.commit?.author?.date ?? null,
          author: commit.commit?.author?.name ?? null,
          url: commit.html_url ?? null,
        })),
        openPullRequests: pulls.map((pull) => ({
          number: pull.number ?? 0,
          title: pull.title ?? "",
          draft: pull.draft === true,
          url: pull.html_url ?? null,
          headRef: pull.head?.ref ?? "",
          headSha: pull.head?.sha ?? "",
          author: pull.user?.login ?? null,
        })),
        overlapCheck:
          "Compare this main head and these open pull requests before claiming work. Do not start a task whose paths already appear here.",
      };
    },

    routeTask(description: string): RouteDecision {
      return routeTask(description, lanes);
    },
  };
}

export type GitbookService = ReturnType<typeof createGitbookService>;

function encodePath(filePath: string): string {
  return filePath.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function appendHandoff(existing: string, agent: string, note: string, at: Date): string {
  const block = ["## Handoff note", "", `AGENT: ${agent}`, "", `- At: ${at.toISOString()}`, `- Note: ${note}`, ""].join("\n");
  if (!existing) return `${block}\n`;
  const base = existing.endsWith("\n") ? existing : `${existing}\n`;
  return `${base}\n${block}\n`;
}

async function searchViaCodeSearch(client: GitHubClient, owner: string, repo: string, query: string): Promise<DocHit[]> {
  const q = `${query} repo:${owner}/${repo} extension:md`;
  const result = await client.request<SearchResponse>(
    "GET",
    `/search/code?q=${encodeURIComponent(q)}&per_page=20`,
    undefined,
    { Accept: "application/vnd.github.text-match+json" },
  );
  return (result.items ?? []).map((item) => {
    const fragment = item.text_matches?.map((match) => match.fragment ?? "").find(Boolean) ?? "";
    return {
      path: item.path ?? "",
      name: item.name ?? "",
      htmlUrl: item.html_url ?? null,
      snippet: fragment.replace(/\s+/g, " ").trim(),
      score: fragment ? 1 : 0,
      source: "github-code-search" as const,
    };
  });
}

async function searchViaTree(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
  query: string,
): Promise<DocHit[]> {
  const tree = await client.request<TreeResponse>(
    "GET",
    repoPath(owner, repo, `/git/trees/${encodeURIComponent(branch)}?recursive=1`),
  );
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  const markdown = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob" && isMarkdownPath(entry.path ?? ""))
    .map((entry) => entry.path ?? "");
  const pathMatches = markdown.filter((filePath) => terms.some((term) => filePath.toLowerCase().includes(term)));
  const rest = markdown.filter((filePath) => !pathMatches.includes(filePath));
  const candidates = [...pathMatches, ...rest].slice(0, 40);
  const hits: DocHit[] = [];
  for (const filePath of candidates) {
    const payload = await client.request<ContentResponse>(
      "GET",
      repoPath(owner, repo, `/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`),
    );
    const content = decodeContent(payload);
    const haystack = `${filePath}\n${content}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (score === 0) continue;
    hits.push({
      path: filePath,
      name: filePath.split("/").pop() ?? filePath,
      htmlUrl: payload.html_url ?? null,
      snippet: snippetAround(content, query),
      score,
      source: "tree-scan",
    });
  }
  return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 20);
}

export async function invokeTool(
  service: GitbookService,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_docs":
      return service.searchDocs(requiredString(args, "query"));
    case "read_page":
      return service.readPage(requiredString(args, "path"));
    case "list_pages":
      return service.listPages(optionalString(args, "dir"));
    case "get_board":
      return service.getBoard();
    case "post_board_update":
      return service.postBoardUpdate(requiredString(args, "agent"), requiredString(args, "text"));
    case "read_handoff":
      return service.readHandoff();
    case "write_handoff":
      return service.writeHandoff(requiredString(args, "agent"), requiredString(args, "note"), optionalString(args, "lane"));
    case "propose_page_change":
      return service.proposePageChange(
        requiredString(args, "path"),
        requiredString(args, "content"),
        requiredString(args, "summary"),
        optionalString(args, "lane"),
      );
    case "recent_changes":
      return service.recentChanges();
    case "route_task":
      return service.routeTask(requiredString(args, "description"));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

export const TOOL_DEFINITIONS = [
  {
    name: "search_docs",
    description: "Search Gitbook markdown. Falls back to a tree scan when GitHub code search is unavailable.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "read_page",
    description: "Read one Gitbook file from the default branch.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "list_pages",
    description: "List markdown files and directories under a Gitbook path. Omit dir for the repository root.",
    inputSchema: {
      type: "object",
      properties: { dir: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_board",
    description: "Read comments on Gitbook issue #2, the mesh coordination board.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "post_board_update",
    description: "Comment on Gitbook issue #2. Every comment is prefixed with AGENT: <name>.",
    inputSchema: {
      type: "object",
      properties: { agent: { type: "string" }, text: { type: "string" } },
      required: ["agent", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "read_handoff",
    description: "Read mesh/HANDOFF.md from the default branch.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "write_handoff",
    description: "Append a handoff note by opening a draft pull request. Never pushes to main.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string" },
        note: { type: "string" },
        lane: {
          type: "string",
          description: "Must match GITBOOK_AGENT_LANE. It cannot override or escalate the process lane.",
        },
      },
      required: ["agent", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_page_change",
    description: "Propose a page change as a draft pull request. Never pushes to main.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        summary: { type: "string" },
        lane: {
          type: "string",
          description: "Must match GITBOOK_AGENT_LANE. It cannot override or escalate the process lane.",
        },
      },
      required: ["path", "content", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "recent_changes",
    description: "Latest commits on main and open pull requests. Run this overlap check before claiming work.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "route_task",
    description: "Suggest a mesh lane from keyword and specialty matching. Deterministic and explainable. Does not claim the task.",
    inputSchema: {
      type: "object",
      properties: { description: { type: "string" } },
      required: ["description"],
      additionalProperties: false,
    },
  },
] as const;
