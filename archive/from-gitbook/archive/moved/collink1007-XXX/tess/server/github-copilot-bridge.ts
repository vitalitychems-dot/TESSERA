import axios from "axios";
import { callLLMSimple } from "./llm-helper";

const log = (msg: string) => console.log(`[GitHubCopilot] ${msg}`);

const REPO_OWNER = "TheTesseractAI";
const REPO_NAME = "TSxRX";

function getToken(): string {
  const pat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const ghToken = process.env.GITHUB_TOKEN;
  if (pat && pat.startsWith("ghp_")) return pat;
  if (pat && pat.length > 0) return pat;
  return ghToken || "";
}

function headers() {
  return {
    Authorization: `token ${getToken()}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Tessera-Sovereign-AI",
  };
}

interface TaskResult {
  success: boolean;
  action: string;
  details: string;
  url?: string;
  prNumber?: number;
  issueNumber?: number;
  error?: string;
}

interface AutoBuildTask {
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "critical";
  category: string;
  requestedBy: string;
  files?: Array<{ path: string; content: string }>;
}

const taskHistory: TaskResult[] = [];

async function githubAPI(endpoint: string, method = "GET", body?: any): Promise<any> {
  const res = await axios({
    url: `https://api.github.com${endpoint}`,
    method,
    headers: headers(),
    data: body,
    timeout: 30000,
  });
  return res.data;
}

async function createIssue(title: string, body: string, labels: string[] = ["tessera-task"]): Promise<TaskResult> {
  try {
    const data = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/issues`, "POST", {
      title,
      body,
      labels,
    });
    const result: TaskResult = {
      success: true,
      action: "create_issue",
      details: `Issue #${data.number}: ${title}`,
      url: data.html_url,
      issueNumber: data.number,
    };
    taskHistory.push(result);
    log(`Created issue #${data.number}: ${title}`);
    return result;
  } catch (e: any) {
    const result: TaskResult = {
      success: false,
      action: "create_issue",
      details: `Failed: ${title}`,
      error: e.response?.data?.message || e.message,
    };
    taskHistory.push(result);
    log(`Failed to create issue: ${e.response?.data?.message || e.message}`);
    return result;
  }
}

async function createBranch(branchName: string): Promise<string | null> {
  try {
    const mainRef = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`);
    const sha = mainRef.object.sha;
    await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, "POST", {
      ref: `refs/heads/${branchName}`,
      sha,
    });
    log(`Created branch: ${branchName}`);
    return sha;
  } catch (e: any) {
    log(`Branch creation failed: ${e.response?.data?.message || e.message}`);
    return null;
  }
}

async function commitFile(branch: string, path: string, content: string, message: string): Promise<boolean> {
  try {
    let sha: string | undefined;
    try {
      const existing = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${branch}`);
      sha = existing.sha;
    } catch {}

    const body: any = {
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
    };
    if (sha) body.sha = sha;

    await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, "PUT", body);
    log(`Committed: ${path} to ${branch}`);
    return true;
  } catch (e: any) {
    log(`Commit failed for ${path}: ${e.response?.data?.message || e.message}`);
    return false;
  }
}

async function createPullRequest(title: string, branch: string, body: string): Promise<TaskResult> {
  try {
    const data = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`, "POST", {
      title,
      head: branch,
      base: "main",
      body,
    });
    const result: TaskResult = {
      success: true,
      action: "create_pr",
      details: `PR #${data.number}: ${title}`,
      url: data.html_url,
      prNumber: data.number,
    };
    taskHistory.push(result);
    log(`Created PR #${data.number}: ${title}`);
    return result;
  } catch (e: any) {
    const result: TaskResult = {
      success: false,
      action: "create_pr",
      details: `Failed: ${title}`,
      error: e.response?.data?.message || e.message,
    };
    taskHistory.push(result);
    return result;
  }
}

async function triggerAutonomousWorkflow(task: string, priority = "normal"): Promise<TaskResult> {
  try {
    await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/tessera-autonomous.yml/dispatches`, "POST", {
      ref: "main",
      inputs: { task, priority },
    });
    const result: TaskResult = {
      success: true,
      action: "trigger_workflow",
      details: `Triggered autonomous build: ${task.slice(0, 100)}`,
    };
    taskHistory.push(result);
    log(`Triggered autonomous workflow: ${task.slice(0, 60)}...`);
    return result;
  } catch (e: any) {
    const result: TaskResult = {
      success: false,
      action: "trigger_workflow",
      details: `Workflow trigger failed`,
      error: e.response?.data?.message || e.message,
    };
    taskHistory.push(result);
    log(`Workflow trigger failed: ${e.response?.data?.message || e.message}`);
    return result;
  }
}

async function useCopilotForTask(task: AutoBuildTask): Promise<TaskResult> {
  log(`Processing autonomous task: "${task.title}"`);

  const solution = await callLLMSimple(
    `You are Tessera Sovereign AI's autonomous code builder. Analyze this task and generate a solution.

TASK: ${task.title}
DESCRIPTION: ${task.description}
CATEGORY: ${task.category}
PRIORITY: ${task.priority}
REQUESTED BY: ${task.requestedBy}

Generate a detailed implementation plan with:
1. What files need to be created or modified
2. The exact code changes
3. A clear commit message
4. Testing steps

Be specific and production-ready. This will be committed directly to the codebase.`,
    2048
  );

  const branch = `tessera/auto-${task.category}-${Date.now()}`;
  const branchSha = await createBranch(branch);

  if (!branchSha) {
    return {
      success: false,
      action: "copilot_build",
      details: `Branch creation failed for: ${task.title}`,
      error: "Could not create branch",
    };
  }

  const solutionFile = `tessera-solutions/${task.category}/${Date.now()}-${task.title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)}.md`;
  const solutionContent = `# Tessera Autonomous Solution\n\n## Task: ${task.title}\n**Priority:** ${task.priority}\n**Category:** ${task.category}\n**Requested By:** ${task.requestedBy}\n**Generated At:** ${new Date().toISOString()}\n\n## Description\n${task.description}\n\n## Solution\n${solution}\n`;

  await commitFile(branch, solutionFile, solutionContent, `Tessera: ${task.title}`);

  if (task.files && task.files.length > 0) {
    for (const file of task.files) {
      await commitFile(branch, file.path, file.content, `Tessera: update ${file.path}`);
    }
  }

  const prResult = await createPullRequest(
    `🤖 Tessera: ${task.title}`,
    branch,
    `## Tessera Autonomous Builder\n\n**Task:** ${task.title}\n**Priority:** ${task.priority}\n**Category:** ${task.category}\n**Requested By:** ${task.requestedBy}\n\n### Solution\n${solution.slice(0, 2000)}\n\n---\n*Generated autonomously by Tessera Sovereign AI*`
  );

  return prResult;
}

async function pushCodeToGitHub(): Promise<TaskResult> {
  const token = getToken();
  if (!token) {
    return { success: false, action: "push", details: "No GitHub token available", error: "Missing token" };
  }

  try {
    const { execSync } = await import("child_process");
    const result = execSync(
      `cd /home/runner/workspace && git push "https://x-access-token:${token}@github.com/${REPO_OWNER}/${REPO_NAME}.git" main --force 2>&1`,
      { encoding: "utf8", timeout: 120000 }
    );
    log(`Push successful: ${result.trim().split("\n").pop()}`);
    const taskResult: TaskResult = {
      success: true,
      action: "push",
      details: `Pushed to ${REPO_OWNER}/${REPO_NAME}`,
      url: `https://github.com/${REPO_OWNER}/${REPO_NAME}`,
    };
    taskHistory.push(taskResult);
    return taskResult;
  } catch (e: any) {
    const taskResult: TaskResult = {
      success: false,
      action: "push",
      details: "Push failed",
      error: e.message?.slice(0, 200),
    };
    taskHistory.push(taskResult);
    return taskResult;
  }
}

async function getRepoStatus(): Promise<any> {
  try {
    const repo = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}`);
    const issues = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=open&per_page=10`).catch(() => []);
    const prs = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=open&per_page=10`).catch(() => []);
    const actions = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs?per_page=5`).catch(() => ({ workflow_runs: [] }));

    return {
      repo: {
        name: repo.full_name,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        size: repo.size,
        lastPush: repo.pushed_at,
        defaultBranch: repo.default_branch,
      },
      openIssues: issues.map((i: any) => ({
        number: i.number,
        title: i.title,
        labels: i.labels.map((l: any) => l.name),
        url: i.html_url,
      })),
      openPRs: prs.map((p: any) => ({
        number: p.number,
        title: p.title,
        url: p.html_url,
        branch: p.head?.ref,
      })),
      recentWorkflows: actions.workflow_runs?.slice(0, 5).map((w: any) => ({
        name: w.name,
        status: w.status,
        conclusion: w.conclusion,
        url: w.html_url,
        createdAt: w.created_at,
      })) || [],
      taskHistory: taskHistory.slice(-20),
    };
  } catch (e: any) {
    return { error: e.message, taskHistory: taskHistory.slice(-20) };
  }
}

async function autoPushOnInterval() {
  log("Auto-push to GitHub started — pushes every 30 minutes");
  setInterval(async () => {
    try {
      const result = await pushCodeToGitHub();
      if (result.success) {
        log("Auto-push completed successfully");
      } else {
        log(`Auto-push failed: ${result.error}`);
      }
    } catch (e: any) {
      log(`Auto-push error: ${e.message}`);
    }
  }, 30 * 60 * 1000);
}

export {
  createIssue,
  createBranch,
  commitFile,
  createPullRequest,
  triggerAutonomousWorkflow,
  useCopilotForTask,
  pushCodeToGitHub,
  getRepoStatus,
  autoPushOnInterval,
  taskHistory,
  AutoBuildTask,
  TaskResult,
  REPO_OWNER,
  REPO_NAME,
};
