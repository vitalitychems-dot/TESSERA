import { redactSecret } from "./config.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export interface GitHubClient {
  request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
}

export function createGitHubClient(options: {
  token: string;
  apiBase: string;
  fetchImpl?: FetchLike;
}): GitHubClient {
  const token = options.token.trim();
  if (!token) {
    throw new Error("GITBOOK_GITHUB_TOKEN is not set. Put the token in the environment, never in source control.");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = options.apiBase.replace(/\/$/, "");

  return {
    async request<T>(method: string, requestPath: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
      const response = await fetchImpl(`${apiBase}${requestPath}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "tessera-gitbook-mcp",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
      if (!response.ok) {
        const detail =
          typeof parsed === "object" && parsed !== null && "message" in parsed
            ? String((parsed as { message: unknown }).message)
            : text.slice(0, 300);
        throw new GitHubApiError(
          response.status,
          redactSecret(`GitHub ${method} ${requestPath} failed (${response.status}): ${detail}`, token),
        );
      }
      return parsed as T;
    },
  };
}
