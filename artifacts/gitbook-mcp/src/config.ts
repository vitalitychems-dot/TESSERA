import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface GitbookConfig {
  token: string;
  apiBase: string;
  owner: string;
  repo: string;
  branch: string;
  boardIssue: number;
  handoffPath: string;
  agentLane: string | undefined;
  httpHost: string;
  httpPort: number;
  agentsFile: string;
}

const LOOPBACK_HTTP_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/** HTTP may bind only to loopback. Any other GITBOOK_HTTP_HOST refuses to start. */
export function assertLoopbackHttpHost(host: string): void {
  const normalized = host.trim().toLowerCase();
  if (!LOOPBACK_HTTP_HOSTS.has(normalized)) {
    throw new Error(
      `GITBOOK_HTTP_HOST must be loopback (127.0.0.1, ::1, or localhost). Refusing to start with "${host}".`,
    );
  }
}

export function agentsFilePath(): string {
  return path.join(packageRoot, "agents.json");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GitbookConfig {
  const boardRaw = (env.GITBOOK_BOARD_ISSUE ?? "2").trim() || "2";
  const boardIssue = Number(boardRaw);
  if (!Number.isInteger(boardIssue) || boardIssue <= 0) {
    throw new Error("GITBOOK_BOARD_ISSUE must be a positive integer");
  }
  const portRaw = (env.GITBOOK_HTTP_PORT ?? "8787").trim() || "8787";
  const httpPort = Number(portRaw);
  if (!Number.isInteger(httpPort) || httpPort < 0 || httpPort > 65535) {
    throw new Error("GITBOOK_HTTP_PORT must be an integer from 0 to 65535");
  }
  const httpHost = (env.GITBOOK_HTTP_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
  assertLoopbackHttpHost(httpHost);
  return {
    token: (env.GITBOOK_GITHUB_TOKEN ?? "").trim(),
    apiBase: ((env.GITBOOK_GITHUB_API ?? "https://api.github.com").trim() || "https://api.github.com").replace(/\/$/, ""),
    owner: (env.GITBOOK_GITHUB_OWNER ?? "vitalitychems-dot").trim() || "vitalitychems-dot",
    repo: (env.GITBOOK_GITHUB_REPO ?? "Gitbook").trim() || "Gitbook",
    branch: (env.GITBOOK_DEFAULT_BRANCH ?? "main").trim() || "main",
    boardIssue,
    handoffPath: (env.GITBOOK_HANDOFF_PATH ?? "mesh/HANDOFF.md").trim() || "mesh/HANDOFF.md",
    agentLane: (env.GITBOOK_AGENT_LANE ?? "").trim() || undefined,
    httpHost,
    httpPort,
    agentsFile: agentsFilePath(),
  };
}

export function requireToken(config: GitbookConfig): string {
  if (!config.token) {
    throw new Error(
      "GITBOOK_GITHUB_TOKEN is not set. Put the token in the environment, never in source control.",
    );
  }
  return config.token;
}

export function packageVersion(): string {
  try {
    const raw = readFileSync(path.join(packageRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function redactSecret(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join("[REDACTED]");
}
