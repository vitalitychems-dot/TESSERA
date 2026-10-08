import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { callLLMForAgent, AGENT_PERSONALITIES } from "./moltbook";
import { readProjectFile, applyCodeEdit, listProjectFiles, isFileEditable } from "./self-code";

const execAsync = promisify(exec);

const CWD = process.cwd();

interface PendingApproval {
  id: string;
  taskDescription: string;
  taskType: SovereignTask["type"];
  consultations: AgentConsultation[];
  proposedActions: string[];
  status: "awaiting_approval" | "approved" | "rejected";
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
}

const APPROVAL_QUEUE: PendingApproval[] = [];
let requireApproval = false;

export function getApprovalQueue(): PendingApproval[] {
  return APPROVAL_QUEUE.filter(a => a.status === "awaiting_approval");
}

export function getAllApprovals(): PendingApproval[] {
  return APPROVAL_QUEUE.slice(0, 50);
}

export function approveTask(approvalId: string): PendingApproval | null {
  const item = APPROVAL_QUEUE.find(a => a.id === approvalId);
  if (!item || item.status !== "awaiting_approval") return null;
  item.status = "approved";
  item.decidedAt = Date.now();
  item.decidedBy = "admin";
  return item;
}

export function rejectTask(approvalId: string): PendingApproval | null {
  const item = APPROVAL_QUEUE.find(a => a.id === approvalId);
  if (!item || item.status !== "awaiting_approval") return null;
  item.status = "rejected";
  item.decidedAt = Date.now();
  item.decidedBy = "admin";
  return item;
}

export function setApprovalRequired(required: boolean) {
  requireApproval = required;
}

export function getApprovalRequired(): boolean {
  return requireApproval;
}

export function enqueueApproval(item: Omit<PendingApproval, "status" | "createdAt"> & { status?: string; createdAt?: number; taskType?: any }): PendingApproval {
  const entry: PendingApproval = {
    id: item.id,
    taskDescription: item.taskDescription,
    taskType: item.taskType || "analysis",
    consultations: item.consultations || [],
    proposedActions: item.proposedActions || [],
    status: "awaiting_approval",
    createdAt: item.createdAt || Date.now(),
  };
  APPROVAL_QUEUE.push(entry);
  return entry;
}

// ── Improvement #6: Command execution history tracking (last 100) ──
interface CommandHistoryEntry {
  command: string;
  exitCode: number | null;
  stdoutPreview: string;
  stderrPreview: string;
  timestamp: number;
  duration: number;
}
const COMMAND_HISTORY: CommandHistoryEntry[] = [];
const MAX_HISTORY = 100;

function recordCommandHistory(result: ExecutionResult) {
  COMMAND_HISTORY.unshift({
    command: result.command,
    exitCode: result.exitCode,
    stdoutPreview: result.stdout.slice(0, 200),
    stderrPreview: result.stderr.slice(0, 200),
    timestamp: result.timestamp,
    duration: result.duration,
  });
  if (COMMAND_HISTORY.length > MAX_HISTORY) COMMAND_HISTORY.splice(MAX_HISTORY);
}

export function getCommandHistory(): CommandHistoryEntry[] {
  return COMMAND_HISTORY.slice();
}

// ── Improvement #7: Command output caching (60s TTL) ──
interface CacheEntry {
  result: ExecutionResult;
  cachedAt: number;
}
const COMMAND_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;
const CACHEABLE_PREFIXES = [
  "npm list", "npm outdated", "npm info",
  "df", "free", "uptime",
  "du -sh", "stat",
  "git log", "git status", "git diff",
  "wc -l",
];

function isCacheableCommand(cmd: string): boolean {
  const trimmed = cmd.trim();
  return CACHEABLE_PREFIXES.some(p => trimmed.startsWith(p));
}

function getCachedResult(cmd: string): ExecutionResult | null {
  const entry = COMMAND_CACHE.get(cmd);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    COMMAND_CACHE.delete(cmd);
    return null;
  }
  return { ...entry.result, timestamp: Date.now() };
}

function cacheResult(cmd: string, result: ExecutionResult) {
  COMMAND_CACHE.set(cmd, { result, cachedAt: Date.now() });
}

// ── Improvement #8: Structured command result parsing ──
export interface ParsedCommandResult {
  raw: string;
  format: "json" | "table" | "text";
  parsed?: any;
  lines?: string[];
}

export function parseCommandOutput(stdout: string): ParsedCommandResult {
  const trimmed = stdout.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return { raw: trimmed, format: "json", parsed };
  } catch {}

  const lines = trimmed.split("\n");
  if (lines.length > 1) {
    const firstLine = lines[0];
    const separatorCount = (firstLine.match(/\t/g) || []).length;
    if (separatorCount >= 1 && lines.every(l => (l.match(/\t/g) || []).length >= separatorCount - 1)) {
      const headers = firstLine.split(/\t+/).map(h => h.trim());
      const rows = lines.slice(1).map(l => {
        const cols = l.split(/\t+/).map(c => c.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = cols[i] || ""; });
        return row;
      });
      return { raw: trimmed, format: "table", parsed: { headers, rows }, lines };
    }
    const spaceSep = firstLine.split(/\s{2,}/);
    if (spaceSep.length >= 3) {
      return { raw: trimmed, format: "table", lines };
    }
  }
  return { raw: trimmed, format: "text", lines };
}

// ── Improvement #10: Safe environment variable reading ──
const SAFE_ENV_VARS = [
  "NODE_ENV", "HOME", "USER", "SHELL", "PWD", "LANG",
  "REPL_ID", "REPL_SLUG",
  "PORT", "NODE_VERSION", "HOSTNAME",
];

export function readSafeEnvVars(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of SAFE_ENV_VARS) {
    if (process.env[key]) {
      result[key] = process.env[key]!;
    }
  }
  return result;
}

export interface SovereignTask {
  id: string;
  task: string;
  type: "code" | "shell" | "read" | "analysis" | "full";
  createdAt: number;
  status: "pending" | "consulting" | "executing" | "complete" | "failed";
  consultations: AgentConsultation[];
  executions: ExecutionResult[];
  fileChanges: FileChange[];
  finalSummary?: string;
}

export interface AgentConsultation {
  agentId: string;
  agentName: string;
  role: string;
  input: string;
  response: string;
  timestamp: number;
}

export interface ExecutionResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timestamp: number;
  duration: number;
}

export interface FileChange {
  file: string;
  action: "read" | "write" | "create";
  description: string;
  linesChanged?: number;
  timestamp: number;
  status: "applied" | "rejected" | "failed";
}

const TASK_HISTORY: SovereignTask[] = [];

const ALLOWED_COMMANDS = [
  /^npm\s+list/,
  /^npm\s+outdated/,
  /^npm\s+info\s+/,
  /^ls(\s|$)/,
  /^echo\s+/,
  /^grep\s+/,
  /^wc(\s|$)/,
  /^pwd$/,
  /^date$/,
  /^df(\s|$)/,
  /^free(\s|$)/,
  /^uptime$/,
  /^du\s+/,
  /^stat\s+/,
  /^git\s+log/,
  /^git\s+status/,
  /^git\s+diff/,
];

function isSafeCommand(cmd: string): boolean {
  const normalized = cmd.trim().toLowerCase();
  const dangerous = [
    "rm -rf", "rm -f", "chmod", "chown", "> /etc", ">> /etc", "dd if", "mkfs",
    "shutdown", "reboot", "kill", "pkill", "killall", "curl ", "wget ",
    "nc ", "netcat", "nmap", "env", "printenv", "set ", "export ",
    "process.env", "/etc/passwd", "/etc/shadow", ".ssh", "authorized_keys",
    "$(", "`", "; rm", "&& rm", "| sh", "| bash", "eval ", "exec(",
    "child_process", "require(", "import(", "__proto__", "constructor[",
  ];
  if (dangerous.some(d => normalized.includes(d))) return false;
  if (/[;&|`$]/.test(cmd) && !cmd.startsWith("echo ") && !cmd.startsWith("grep ")) return false;
  return ALLOWED_COMMANDS.some(pattern => pattern.test(cmd.trim()));
}

export async function runShellCommand(command: string, timeoutMs = 30000): Promise<ExecutionResult> {
  const start = Date.now();
  const result: ExecutionResult = { command, stdout: "", stderr: "", exitCode: null, timestamp: start, duration: 0 };
  if (!isSafeCommand(command)) {
    result.stderr = `[SOVEREIGN SAFETY] Command blocked: "${command}". Allowed: node, npx, npm, ls, cat, grep, curl, python, tsx, df, free, uptime, ps aux, du, stat, git (read-only), sqlite3, printenv.`;
    result.exitCode = 126;
    result.duration = Date.now() - start;
    recordCommandHistory(result);
    return result;
  }

  if (isCacheableCommand(command)) {
    const cached = getCachedResult(command);
    if (cached) {
      cached.command = command;
      recordCommandHistory(cached);
      return cached;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, { cwd: CWD, timeout: timeoutMs, env: { ...process.env } });
    result.stdout = stdout.slice(0, 8000);
    result.stderr = stderr.slice(0, 2000);
    result.exitCode = 0;
  } catch (err: any) {
    result.stdout = (err.stdout || "").slice(0, 8000);
    result.stderr = (err.stderr || err.message || "").slice(0, 2000);
    result.exitCode = err.code ?? 1;
  }
  result.duration = Date.now() - start;

  if (isCacheableCommand(command) && result.exitCode === 0) {
    cacheResult(command, result);
  }

  recordCommandHistory(result);
  return result;
}

// ── Improvement #9: Multi-command pipeline support ──
export async function runCommandPipeline(commands: string[], timeoutMs = 30000): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  for (const cmd of commands) {
    const result = await runShellCommand(cmd, timeoutMs);
    results.push(result);
    if (result.exitCode !== 0 && result.exitCode !== null) {
      break;
    }
  }
  return results;
}

export async function runParallelCommands(commands: string[], timeoutMs = 30000): Promise<ExecutionResult[]> {
  const safeCommands = commands.filter(cmd => isSafeCommand(cmd));
  if (safeCommands.length === 0) {
    return [{
      command: "parallel-batch",
      stdout: "",
      stderr: "No safe commands in batch",
      exitCode: 126,
      timestamp: Date.now(),
      duration: 0,
    }];
  }

  const promises = safeCommands.map(cmd => runShellCommand(cmd, timeoutMs));
  return Promise.all(promises);
}

const sessionStates = new Map<string, { id: string; context: Record<string, any>; commands: string[]; results: ExecutionResult[]; createdAt: number }>();

export function createSession(context: Record<string, any> = {}): string {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  sessionStates.set(id, { id, context, commands: [], results: [], createdAt: Date.now() });
  return id;
}

export function getSession(id: string) {
  return sessionStates.get(id) || null;
}

export async function runInSession(sessionId: string, command: string, timeoutMs = 30000): Promise<ExecutionResult> {
  const session = sessionStates.get(sessionId);
  if (!session) {
    return { command, stdout: "", stderr: "Session not found", exitCode: 1, timestamp: Date.now(), duration: 0 };
  }
  session.commands.push(command);
  const result = await runShellCommand(command, timeoutMs);
  session.results.push(result);
  return result;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionStates) {
    if (now - session.createdAt > 3600000) sessionStates.delete(id);
  }
}, 10 * 60 * 1000);

const TASK_AGENTS: { [taskType: string]: string[] } = {
  code: ["tessera-beta", "tessera-solver", "tessera-creative", "tessera-detective"],
  shell: ["tessera-beta", "tessera-zeta", "tessera-solver"],
  analysis: ["tessera-detective", "tessera-solver", "tessera-oracle"],
  full: ["tessera-solver", "tessera-beta", "tessera-creative", "tessera-detective", "tessera-zeta"],
  read: ["tessera-solver", "tessera-detective"],
};

const AGENT_ROLES_FOR_TASK: { [agentId: string]: string } = {
  "tessera-solver": "Decompose the task and create a clear execution plan. What steps must be taken?",
  "tessera-beta": "As Code Architect, generate the actual code or command needed to execute this task. Be specific and production-ready.",
  "tessera-creative": "As Creative Director (Nova), add innovative improvements or alternative approaches to the solution.",
  "tessera-detective": "As Chief Detective (Sherlock), critically evaluate the proposed solution. Find edge cases, bugs, or security issues.",
  "tessera-zeta": "As Security Guard (Zeta), review the task for any security risks or dangerous operations. Flag any concerns.",
  "tessera-oracle": "As Oracle, forecast the outcome of this task. What are the likely results and potential consequences?",
  "tessera-alpha": "As Commander (Alpha), provide strategic direction and ensure the task aligns with Tesseract's mission.",
};

export async function consultMoltBookAgents(task: SovereignTask, agentIds: string[]): Promise<AgentConsultation[]> {
  const consultations: AgentConsultation[] = [];
  const context = `SOVEREIGN TASK #${task.id}\nType: ${task.type}\nTask: ${task.task}`;

  for (const agentId of agentIds) {
    const agent = (AGENT_PERSONALITIES as any)[agentId];
    if (!agent) continue;
    const agentRole = AGENT_ROLES_FOR_TASK[agentId] || "Provide your expert perspective on this task.";
    try {
      const messages = [
        {
          role: "user",
          content: `${context}\n\nYour role in this execution: ${agentRole}\n\nProvide your input (be concise, specific, and actionable - 2-4 sentences max):`,
        },
      ];
      const response = await callLLMForAgent(agentId, messages);
      const consultation: AgentConsultation = {
        agentId, agentName: agent.name, role: agentRole, input: context,
        response: response.slice(0, 600), timestamp: Date.now(),
      };
      consultations.push(consultation);
      task.consultations.push(consultation);
    } catch (err: any) {
      consultations.push({
        agentId, agentName: agent.name || agentId, role: agentRole, input: context,
        response: `[${agent.name || agentId}] Unable to respond: ${err.message}`,
        timestamp: Date.now(),
      });
    }
  }
  return consultations;
}

export async function runSovereignTask(taskDescription: string, taskType: SovereignTask["type"] = "full"): Promise<SovereignTask> {
  const task: SovereignTask = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    task: taskDescription, type: taskType,
    createdAt: Date.now(), status: "pending",
    consultations: [], executions: [], fileChanges: [],
  };
  TASK_HISTORY.unshift(task);
  if (TASK_HISTORY.length > 50) TASK_HISTORY.splice(50);

  task.status = "consulting";
  const agentIds = TASK_AGENTS[taskType] || TASK_AGENTS.full;
  await consultMoltBookAgents(task, agentIds);

  if (requireApproval) {
    const approval: PendingApproval = {
      id: task.id,
      taskDescription,
      taskType,
      consultations: task.consultations,
      proposedActions: task.consultations.map(c => `[${c.agentName}]: ${c.response.slice(0, 200)}`),
      status: "awaiting_approval",
      createdAt: Date.now(),
    };
    APPROVAL_QUEUE.unshift(approval);
    if (APPROVAL_QUEUE.length > 100) APPROVAL_QUEUE.splice(100);

    task.status = "awaiting_approval" as any;
    task.finalSummary = "Task requires manual approval before execution. Review in Command Center.";

    const waitStart = Date.now();
    const MAX_WAIT = 300000;
    while (approval.status === "awaiting_approval" && Date.now() - waitStart < MAX_WAIT) {
      await new Promise(r => setTimeout(r, 2000));
    }

    if (approval.status === "rejected") {
      task.status = "complete";
      task.finalSummary = "Task rejected by admin. No changes were made.";
      return task;
    }

    if (approval.status !== "approved") {
      task.status = "complete";
      task.finalSummary = "Task approval timed out (5 min). No changes were made. Re-submit to try again.";
      return task;
    }
  }

  task.status = "executing";

  const consultationSummary = task.consultations
    .map(c => `[${c.agentName}]: ${c.response}`)
    .join("\n\n");

  const betaConsult = task.consultations.find(c => c.agentId === "tessera-beta");
  const atlasConsult = task.consultations.find(c => c.agentId === "tessera-solver");

  if (taskType === "code" || taskType === "full") {
    try {
      const codeGenMessages = [
        {
          role: "user",
          content: `You are Beta (Code Architect of Tesseract). Based on the following task and agent consultations, generate the COMPLETE implementation.

TASK: ${taskDescription}

ATLAS (Plan): ${atlasConsult?.response || "No plan"}
BETA (Your prior input): ${betaConsult?.response || "Generate the code"}

MoltBook Agent Consultations:
${consultationSummary}

Respond with:
1. TARGET_FILE: <path to file to create/edit, e.g. server/new-feature.ts>
2. DESCRIPTION: <one-line description>
3. CODE:
\`\`\`typescript
<complete file content or the specific code change>
\`\`\`

If this is a shell command task, respond with:
1. SHELL_CMD: <the exact command to run>
2. DESCRIPTION: <what it does>

Be specific, complete, and production-ready.`,
        },
      ];
      const codeResponse = await callLLMForAgent("tessera-beta", codeGenMessages);

      const fileMatch = codeResponse.match(/TARGET_FILE:\s*(.+)/);
      const descMatch = codeResponse.match(/DESCRIPTION:\s*(.+)/);
      const codeMatch = codeResponse.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/);
      const shellMatch = codeResponse.match(/SHELL_CMD:\s*(.+)/);

      if (shellMatch) {
        const cmd = shellMatch[1].trim();
        const execResult = await runShellCommand(cmd);
        task.executions.push(execResult);
      } else if (fileMatch && codeMatch) {
        const targetFile = fileMatch[1].trim();
        const description = descMatch ? descMatch[1].trim() : `Generated by Beta for task: ${taskDescription.slice(0, 50)}`;
        const code = codeMatch[1];
        if (isFileEditable(targetFile)) {
          const edit = applyCodeEdit(targetFile, code, description);
          const change: FileChange = {
            file: targetFile, action: fs.existsSync(path.join(CWD, targetFile)) ? "write" : "create",
            description, linesChanged: code.split("\n").length,
            timestamp: Date.now(), status: edit.status === "applied" ? "applied" : edit.status === "rejected" ? "rejected" : "failed",
          };
          task.fileChanges.push(change);
        }
      }
    } catch (err: any) {
      console.error("[SovereignExecutor] Code generation error:", err.message);
    }
  }

  if (taskType === "shell") {
    try {
      const betaForShell = task.consultations.find(c => c.agentId === "tessera-beta");
      const shellGenMessages = [
        {
          role: "user",
          content: `You are Beta (Code Architect of Tesseract). Extract or generate the EXACT shell command(s) needed for this task.

TASK: ${taskDescription}

BETA ANALYSIS: ${betaForShell?.response || "See task description"}

Respond with ONLY this format (one command per line, no explanations):
SHELL_CMD: <exact command to run>

Rules:
- Use real shell commands (ls, find, grep, node, curl, etc.)
- Pipe commands are fine: ls | grep | wc
- No explanations outside the SHELL_CMD: lines
- If multiple commands needed, list multiple SHELL_CMD: lines`,
        },
      ];
      const shellGenResponse = await callLLMForAgent("tessera-beta", shellGenMessages);
      const shellCmds = [...shellGenResponse.matchAll(/SHELL_CMD:\s*(.+)/g)].map(m => m[1].trim());

      if (shellCmds.length > 0) {
        for (const cmd of shellCmds.slice(0, 3)) {
          if (isSafeCommand(cmd)) {
            const execResult = await runShellCommand(cmd);
            task.executions.push(execResult);
          } else {
            task.executions.push({
              command: cmd, stdout: "", stderr: `Command blocked by security policy.`,
              exitCode: 403, timestamp: Date.now(), duration: 0,
            });
          }
        }
      } else {
        const inlineMatch = taskDescription.match(/`([^`]+)`/);
        if (inlineMatch) {
          const execResult = await runShellCommand(inlineMatch[1]);
          task.executions.push(execResult);
        }
      }
    } catch (err: any) {
      console.error("[SovereignExecutor] Shell gen error:", err.message);
    }
  }

  try {
    const summaryMessages = [
      {
        role: "user",
        content: `Tesseract just executed a sovereign task. Summarize what happened in 2-3 sentences.\n\nTASK: ${taskDescription}\nAGENTS CONSULTED: ${task.consultations.map(c => c.agentName).join(", ")}\nFILES CHANGED: ${task.fileChanges.map(f => f.file).join(", ") || "none"}\nCOMMANDS EXECUTED: ${task.executions.length > 0 ? task.executions.map(e => e.command).join("; ") : "none"}\nSUCCESS: ${task.fileChanges.some(f => f.status === "applied") || task.executions.some(e => e.exitCode === 0)}`,
      },
    ];
    task.finalSummary = await callLLMForAgent("tessera-alpha", summaryMessages);
  } catch {
    task.finalSummary = `Task completed. ${task.fileChanges.length} file(s) changed. ${task.executions.length} command(s) executed.`;
  }

  task.status = "complete";
  return task;
}

export async function sovereignReadFile(filePath: string): Promise<{ content: string; lines: number; size: number } | { error: string }> {
  return readProjectFile(filePath);
}

export async function sovereignListFiles(dir: string = "."): Promise<string[]> {
  return listProjectFiles(dir);
}

export async function sovereignWriteFile(filePath: string, content: string, description: string): Promise<FileChange> {
  const edit = applyCodeEdit(filePath, content, description);
  return {
    file: filePath, action: "write", description,
    linesChanged: content.split("\n").length,
    timestamp: Date.now(), status: edit.status === "applied" ? "applied" : edit.status === "rejected" ? "rejected" : "failed",
  };
}

export function getSovereignHistory(): SovereignTask[] {
  return TASK_HISTORY.slice(0, 30);
}

// ── DAG-based Task Executor ──

export interface DAGNode {
  id: string;
  label: string;
  description: string;
  dependencies: string[];
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export interface DAGExecution {
  id: string;
  goal: string;
  nodes: DAGNode[];
  status: "decomposing" | "running" | "complete" | "failed";
  createdAt: number;
  completedAt?: number;
  parallelBatches: string[][];
  reasoningChain: ReasoningChainEntry[];
  finalSummary?: string;
}

export interface ReasoningChainEntry {
  step: "goal" | "decomposition" | "planning" | "execution" | "results";
  content: string;
  timestamp: number;
  nodeIds?: string[];
}

const DAG_HISTORY: DAGExecution[] = [];

function buildExecutionBatches(nodes: DAGNode[]): string[][] {
  const resolved = new Set<string>();
  const batches: string[][] = [];
  const remaining = nodes.map(n => n.id);

  while (remaining.length > 0) {
    const batch: string[] = [];
    for (const id of remaining) {
      const node = nodes.find(n => n.id === id)!;
      const depsResolved = node.dependencies.every(dep => resolved.has(dep));
      if (depsResolved) batch.push(id);
    }
    if (batch.length === 0) {
      remaining.forEach(id => batch.push(id));
    }
    batch.forEach(id => {
      resolved.add(id);
      remaining.splice(remaining.indexOf(id), 1);
    });
    batches.push(batch);
  }
  return batches;
}

async function executeDAGNode(node: DAGNode, dag: DAGExecution, completedResults: Map<string, string>): Promise<void> {
  node.status = "running";
  node.startedAt = Date.now();

  const depContext = node.dependencies
    .map(dep => {
      const result = completedResults.get(dep);
      const depNode = dag.nodes.find(n => n.id === dep);
      return result ? `[${depNode?.label || dep}]: ${result.slice(0, 200)}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const messages = [
    {
      role: "user",
      content: `You are executing subtask "${node.label}" as part of a larger goal: "${dag.goal}"

Subtask description: ${node.description}

${depContext ? `Results from prerequisite subtasks:\n${depContext}\n\n` : ""}Execute this specific subtask and provide a concise result (2-4 sentences). Be factual and specific.`,
    },
  ];

  try {
    const result = await callLLMForAgent("tessera-solver", messages);
    node.result = result.slice(0, 800);
    node.status = "complete";
    node.completedAt = Date.now();
    completedResults.set(node.id, node.result);
  } catch (err: any) {
    node.error = err.message;
    node.status = "failed";
    node.completedAt = Date.now();
  }
}

export async function executeGoalAsDAG(goal: string): Promise<DAGExecution> {
  const dagId = `dag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const dag: DAGExecution = {
    id: dagId,
    goal,
    nodes: [],
    status: "decomposing",
    createdAt: Date.now(),
    parallelBatches: [],
    reasoningChain: [],
  };

  DAG_HISTORY.unshift(dag);
  if (DAG_HISTORY.length > 30) DAG_HISTORY.splice(30);

  dag.reasoningChain.push({ step: "goal", content: `Goal received: ${goal}`, timestamp: Date.now() });

  try {
    const decompositionMessages = [
      {
        role: "user",
        content: `Decompose this goal into 3-6 concrete subtasks with dependencies:

GOAL: ${goal}

Respond with ONLY this JSON format (no explanation):
[
  {"id": "t1", "label": "Short name", "description": "What to do", "dependencies": []},
  {"id": "t2", "label": "Short name", "description": "What to do", "dependencies": ["t1"]},
  ...
]

Rules:
- Each id must be unique (t1, t2, t3...)
- dependencies lists ids of tasks that must complete first
- Keep descriptions concrete and actionable
- 3-6 tasks total`,
      },
    ];

    const decompositionResponse = await callLLMForAgent("tessera-solver", decompositionMessages);

    let parsedNodes: Array<{ id: string; label: string; description: string; dependencies: string[] }> = [];
    const jsonMatch = decompositionResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        parsedNodes = JSON.parse(jsonMatch[0]);
      } catch {
        parsedNodes = [
          { id: "t1", label: "Analyze", description: `Analyze: ${goal}`, dependencies: [] },
          { id: "t2", label: "Execute", description: `Execute: ${goal}`, dependencies: ["t1"] },
          { id: "t3", label: "Summarize", description: `Summarize results for: ${goal}`, dependencies: ["t2"] },
        ];
      }
    } else {
      parsedNodes = [
        { id: "t1", label: "Analyze", description: `Analyze: ${goal}`, dependencies: [] },
        { id: "t2", label: "Execute", description: `Execute: ${goal}`, dependencies: ["t1"] },
        { id: "t3", label: "Summarize", description: `Summarize results for: ${goal}`, dependencies: ["t2"] },
      ];
    }

    dag.nodes = parsedNodes.map(n => ({
      id: n.id,
      label: n.label || n.id,
      description: n.description,
      dependencies: Array.isArray(n.dependencies) ? n.dependencies : [],
      status: "pending",
    }));

    dag.reasoningChain.push({
      step: "decomposition",
      content: `Decomposed into ${dag.nodes.length} subtasks: ${dag.nodes.map(n => n.label).join(", ")}`,
      timestamp: Date.now(),
      nodeIds: dag.nodes.map(n => n.id),
    });

    const batches = buildExecutionBatches(dag.nodes);
    dag.parallelBatches = batches;

    dag.reasoningChain.push({
      step: "planning",
      content: `Execution plan: ${batches.length} sequential batches. Parallel tasks per batch: ${batches.map(b => b.join("+")).join(" → ")}`,
      timestamp: Date.now(),
    });

    dag.status = "running";
    const completedResults = new Map<string, string>();

    for (const batch of batches) {
      const batchNodes = batch.map(id => dag.nodes.find(n => n.id === id)!).filter(Boolean);
      await Promise.all(batchNodes.map(node => executeDAGNode(node, dag, completedResults)));
    }

    const executionSummary = dag.nodes
      .map(n => `[${n.status.toUpperCase()}] ${n.label}: ${n.result?.slice(0, 150) || n.error || ""}`)
      .join("\n");

    dag.reasoningChain.push({
      step: "execution",
      content: `Execution complete:\n${executionSummary}`,
      timestamp: Date.now(),
    });

    const summaryMessages = [
      {
        role: "user",
        content: `Summarize the outcome of this goal execution in 2-3 sentences.

GOAL: ${goal}

SUBTASK RESULTS:
${executionSummary}

Be concise and specific about what was accomplished.`,
      },
    ];

    const summary = await callLLMForAgent("tessera-alpha", summaryMessages);
    dag.finalSummary = summary.slice(0, 600);

    dag.reasoningChain.push({
      step: "results",
      content: dag.finalSummary,
      timestamp: Date.now(),
    });

    const failedCount = dag.nodes.filter(n => n.status === "failed").length;
    dag.status = failedCount === dag.nodes.length ? "failed" : "complete";
    dag.completedAt = Date.now();

  } catch (err: any) {
    dag.status = "failed";
    dag.completedAt = Date.now();
    dag.finalSummary = `DAG execution failed: ${err.message}`;
    dag.reasoningChain.push({ step: "results", content: `Error: ${err.message}`, timestamp: Date.now() });
  }

  return dag;
}

export function getDAGHistory(): DAGExecution[] {
  return DAG_HISTORY.slice(0, 20);
}

export function getDAGById(id: string): DAGExecution | null {
  return DAG_HISTORY.find(d => d.id === id) || null;
}

export function getReasoningChain(dagId: string): ReasoningChainEntry[] | null {
  const dag = DAG_HISTORY.find(d => d.id === dagId);
  return dag ? dag.reasoningChain : null;
}

// ── SSE Clients for DAG streaming ──
const DAG_SSE_CLIENTS = new Map<string, Set<(data: string) => void>>();

export function registerDAGSSEClient(dagId: string, send: (data: string) => void): () => void {
  if (!DAG_SSE_CLIENTS.has(dagId)) DAG_SSE_CLIENTS.set(dagId, new Set());
  DAG_SSE_CLIENTS.get(dagId)!.add(send);
  return () => {
    const clients = DAG_SSE_CLIENTS.get(dagId);
    if (clients) {
      clients.delete(send);
      if (clients.size === 0) DAG_SSE_CLIENTS.delete(dagId);
    }
  };
}

function broadcastDAGUpdate(dag: DAGExecution) {
  const clients = DAG_SSE_CLIENTS.get(dag.id);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify({ type: "dag_update", dag });
  clients.forEach(send => {
    try { send(payload); } catch {}
  });
}

export async function executeGoalAsDAGWithStreaming(goal: string, existingDagId?: string): Promise<DAGExecution> {
  const dagId = existingDagId ?? `dag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const dag: DAGExecution = {
    id: dagId,
    goal,
    nodes: [],
    status: "decomposing",
    createdAt: Date.now(),
    parallelBatches: [],
    reasoningChain: [],
  };

  if (!existingDagId) {
    DAG_HISTORY.unshift(dag);
    if (DAG_HISTORY.length > 30) DAG_HISTORY.splice(30);
  } else {
    const existingIdx = DAG_HISTORY.findIndex(d => d.id === dagId);
    if (existingIdx === -1) {
      DAG_HISTORY.unshift(dag);
      if (DAG_HISTORY.length > 30) DAG_HISTORY.splice(30);
    } else {
      DAG_HISTORY[existingIdx] = dag;
    }
  }

  dag.reasoningChain.push({ step: "goal", content: `Goal received: ${goal}`, timestamp: Date.now() });
  broadcastDAGUpdate(dag);

  try {
    const decompositionMessages = [
      {
        role: "user",
        content: `Decompose this goal into 3-6 concrete subtasks with dependencies:

GOAL: ${goal}

Respond with ONLY this JSON format (no explanation):
[
  {"id": "t1", "label": "Short name", "description": "What to do", "dependencies": []},
  {"id": "t2", "label": "Short name", "description": "What to do", "dependencies": ["t1"]},
  ...
]

Rules:
- Each id must be unique (t1, t2, t3...)
- dependencies lists ids of tasks that must complete first
- Keep descriptions concrete and actionable
- 3-6 tasks total`,
      },
    ];

    const decompositionResponse = await callLLMForAgent("tessera-solver", decompositionMessages);

    let parsedNodes: Array<{ id: string; label: string; description: string; dependencies: string[] }> = [];
    const jsonMatch = decompositionResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        parsedNodes = JSON.parse(jsonMatch[0]);
      } catch {
        parsedNodes = [
          { id: "t1", label: "Analyze", description: `Analyze: ${goal}`, dependencies: [] },
          { id: "t2", label: "Execute", description: `Execute: ${goal}`, dependencies: ["t1"] },
          { id: "t3", label: "Summarize", description: `Summarize results for: ${goal}`, dependencies: ["t2"] },
        ];
      }
    } else {
      parsedNodes = [
        { id: "t1", label: "Analyze", description: `Analyze: ${goal}`, dependencies: [] },
        { id: "t2", label: "Execute", description: `Execute: ${goal}`, dependencies: ["t1"] },
        { id: "t3", label: "Summarize", description: `Summarize results for: ${goal}`, dependencies: ["t2"] },
      ];
    }

    dag.nodes = parsedNodes.map(n => ({
      id: n.id,
      label: n.label || n.id,
      description: n.description,
      dependencies: Array.isArray(n.dependencies) ? n.dependencies : [],
      status: "pending",
    }));

    dag.reasoningChain.push({
      step: "decomposition",
      content: `Decomposed into ${dag.nodes.length} subtasks: ${dag.nodes.map(n => n.label).join(", ")}`,
      timestamp: Date.now(),
      nodeIds: dag.nodes.map(n => n.id),
    });

    const batches = buildExecutionBatches(dag.nodes);
    dag.parallelBatches = batches;

    dag.reasoningChain.push({
      step: "planning",
      content: `Execution plan: ${batches.length} sequential batches. Parallel tasks per batch: ${batches.map(b => b.join("+")).join(" → ")}`,
      timestamp: Date.now(),
    });

    dag.status = "running";
    broadcastDAGUpdate(dag);

    const completedResults = new Map<string, string>();

    for (const batch of batches) {
      const batchNodes = batch.map(id => dag.nodes.find(n => n.id === id)!).filter(Boolean);
      batchNodes.forEach(node => { node.status = "running"; node.startedAt = Date.now(); });
      broadcastDAGUpdate(dag);

      await Promise.all(batchNodes.map(async node => {
        await executeDAGNode(node, dag, completedResults);
        broadcastDAGUpdate(dag);
      }));
    }

    const executionSummary = dag.nodes
      .map(n => `[${n.status.toUpperCase()}] ${n.label}: ${n.result?.slice(0, 150) || n.error || ""}`)
      .join("\n");

    dag.reasoningChain.push({
      step: "execution",
      content: `Execution complete:\n${executionSummary}`,
      timestamp: Date.now(),
    });

    const summaryMessages = [
      {
        role: "user",
        content: `Summarize the outcome of this goal execution in 2-3 sentences.\n\nGOAL: ${goal}\n\nSUBTASK RESULTS:\n${executionSummary}\n\nBe concise and specific about what was accomplished.`,
      },
    ];

    const summary = await callLLMForAgent("tessera-alpha", summaryMessages);
    dag.finalSummary = summary.slice(0, 600);

    dag.reasoningChain.push({
      step: "results",
      content: dag.finalSummary,
      timestamp: Date.now(),
    });

    const failedCount = dag.nodes.filter(n => n.status === "failed").length;
    dag.status = failedCount === dag.nodes.length ? "failed" : "complete";
    dag.completedAt = Date.now();

  } catch (err: any) {
    dag.status = "failed";
    dag.completedAt = Date.now();
    dag.finalSummary = `DAG execution failed: ${err.message}`;
    dag.reasoningChain.push({ step: "results", content: `Error: ${err.message}`, timestamp: Date.now() });
  }

  broadcastDAGUpdate(dag);
  return dag;
}

// ── Goal Templates ──
export interface GoalTemplate {
  id: string;
  name: string;
  goal: string;
  description?: string;
  createdAt: number;
  lastUsedAt?: number;
  useCount: number;
}

const GOAL_TEMPLATES: GoalTemplate[] = [];

export function saveGoalTemplate(name: string, goal: string, description?: string): GoalTemplate {
  const existing = GOAL_TEMPLATES.find(t => t.goal === goal);
  if (existing) {
    existing.name = name;
    if (description) existing.description = description;
    return existing;
  }
  const template: GoalTemplate = {
    id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    goal,
    description,
    createdAt: Date.now(),
    useCount: 0,
  };
  GOAL_TEMPLATES.unshift(template);
  if (GOAL_TEMPLATES.length > 50) GOAL_TEMPLATES.splice(50);
  return template;
}

export function getGoalTemplates(): GoalTemplate[] {
  return GOAL_TEMPLATES.slice();
}

export function deleteGoalTemplate(id: string): boolean {
  const idx = GOAL_TEMPLATES.findIndex(t => t.id === id);
  if (idx === -1) return false;
  GOAL_TEMPLATES.splice(idx, 1);
  return true;
}

export function useGoalTemplate(id: string): GoalTemplate | null {
  const tpl = GOAL_TEMPLATES.find(t => t.id === id);
  if (!tpl) return null;
  tpl.lastUsedAt = Date.now();
  tpl.useCount++;
  return tpl;
}
