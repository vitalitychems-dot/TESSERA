import type { GitbookConfig } from "./config.js";
import type { GitHubClient } from "./github.js";
import { createGitbookService, type GitbookService } from "./service.js";

export function createHttpBoundService(config: GitbookConfig, client: GitHubClient | undefined): GitbookService {
  return createGitbookService({
    client,
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    boardIssue: config.boardIssue,
    handoffPath: config.handoffPath,
    agentLane: config.agentLane,
  });
}
