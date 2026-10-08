/**
 * Dev Studio — Parallel Agent Session Manager
 * Manages isolated per-project development sessions with SSE streaming.
 */

import fs from "fs";
import path from "path";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";
import { callLLMSimple } from "./llm-helper";
import { storage } from "./storage";
import type { Request, Response } from "express";

const execAsync = promisify(exec);
const CWD = process.cwd();
const dlog = (msg: string) => console.log(`[DevStudio] ${msg}`);

const SESSIONS_BASE = "/tmp/dev-sessions";

export type ProjectStatus = "planning" | "coding" | "testing" | "done" | "failed" | "paused";

interface AgentStep {
  id: string;
  type: "think" | "write" | "bash" | "install" | "edit" | "read" | "done" | "error";
  message: string;
  detail?: string;
  timestamp: number;
}

interface FileDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  status: "pending" | "accepted" | "rejected";
}

interface ActiveSession {
  projectId: number;
  sessionId: number;
  status: ProjectStatus;
  steps: AgentStep[];
  pendingDiffs: FileDiff[];
  previewPort: number | null;
  serverProcess: ChildProcess | null;
  abortController: AbortController;
  paused: boolean;
  workDir: string;
}

const activeSessions = new Map<number, ActiveSession>();
const sseClients = new Map<number, Set<Response>>();

function emitSSE(projectId: number, data: object) {
  const clients = sseClients.get(projectId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

export function registerSSEClient(projectId: number, res: Response) {
  if (!sseClients.has(projectId)) sseClients.set(projectId, new Set());
  sseClients.get(projectId)!.add(res);
  res.on("close", () => {
    sseClients.get(projectId)?.delete(res);
  });
}

function addStep(session: ActiveSession, type: AgentStep["type"], message: string, detail?: string): AgentStep {
  const step: AgentStep = {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    message,
    detail,
    timestamp: Date.now(),
  };
  session.steps.push(step);
  if (session.steps.length > 200) session.steps = session.steps.slice(-200);
  emitSSE(session.projectId, { type: "step", step });
  storage.appendDevSessionLog(session.sessionId, `[${type.toUpperCase()}] ${message}${detail ? ": " + detail : ""}`).catch(() => {});
  return step;
}

async function ensureWorkDir(workDir: string) {
  fs.mkdirSync(workDir, { recursive: true });
}

async function runBash(session: ActiveSession, command: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  if (session.abortController.signal.aborted) return { stdout: "", stderr: "Aborted", ok: false };
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: session.workDir,
      timeout: timeoutMs,
      env: { ...process.env, HOME: session.workDir },
    });
    return { stdout: (stdout || "").slice(0, 4000), stderr: (stderr || "").slice(0, 1000), ok: true };
  } catch (err: any) {
    return { stdout: (err.stdout || "").slice(0, 4000), stderr: (err.stderr || err.message || "").slice(0, 1000), ok: false };
  }
}

async function writeFile(session: ActiveSession, filePath: string, content: string, withDiff = false): Promise<void> {
  const absPath = path.resolve(session.workDir, filePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  if (withDiff) {
    let oldContent = "";
    if (fs.existsSync(absPath)) oldContent = fs.readFileSync(absPath, "utf-8");
    const diff: FileDiff = { filePath, oldContent, newContent: content, status: "pending" };
    session.pendingDiffs.push(diff);
    emitSSE(session.projectId, { type: "diff", diff });
    addStep(session, "write", `Proposed: ${filePath}`, `${content.length} chars`);
    return;
  }

  fs.writeFileSync(absPath, content, "utf-8");
  addStep(session, "write", `Wrote: ${filePath}`, `${content.length} chars`);

  const files = getProjectFiles(session.workDir);
  emitSSE(session.projectId, { type: "files", files });
  storage.updateDevSession(session.sessionId, { files: JSON.stringify(files) }).catch(() => {});
}

function getProjectFiles(workDir: string): Array<{ name: string; path: string; size: number; isDir: boolean }> {
  const results: Array<{ name: string; path: string; size: number; isDir: boolean }> = [];
  function walk(dir: string, rel = "") {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        const absPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push({ name: entry.name, path: relPath, size: 0, isDir: true });
          if (results.length < 500) walk(absPath, relPath);
        } else {
          const stat = fs.statSync(absPath);
          results.push({ name: entry.name, path: relPath, size: stat.size, isDir: false });
        }
      }
    } catch {}
  }
  walk(workDir);
  return results;
}

async function detectListeningPort(pid: number): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`ss -tlnp 2>/dev/null | grep "${pid}" | awk '{print $4}' | cut -d: -f2 | head -1`);
    const port = parseInt(stdout.trim());
    if (port && port > 1000) return port;
  } catch {}
  return null;
}

async function runAgentLoop(session: ActiveSession, goal: string) {
  await ensureWorkDir(session.workDir);

  addStep(session, "think", `Starting work on: ${goal}`);
  await storage.updateDevProject(session.projectId, { status: "planning" });
  emitSSE(session.projectId, { type: "status", status: "planning" });

  const planPrompt = `You are an autonomous software developer. Your goal: "${goal}"
  
Create a concise step-by-step implementation plan. Return a JSON array of steps like:
[
  {"step": 1, "action": "scaffold", "description": "Initialize project structure"},
  {"step": 2, "action": "write", "file": "index.html", "description": "Create HTML entry point"},
  ...
]

Keep it under 10 steps. Focus on creating a working, runnable result.`;

  addStep(session, "think", "Planning implementation...");
  let plan: any[] = [];
  try {
    const planText = await callLLMSimple(planPrompt, 2048, { skipCache: true }, "You are a senior software engineer. Return only valid JSON.");
    const jsonMatch = planText.match(/\[[\s\S]*\]/);
    if (jsonMatch) plan = JSON.parse(jsonMatch[0]);
  } catch {}

  if (!plan.length) {
    plan = [
      { step: 1, action: "scaffold", description: "Set up project" },
      { step: 2, action: "implement", description: "Implement the goal: " + goal },
    ];
  }

  addStep(session, "think", `Plan ready: ${plan.length} steps`, plan.map(p => p.description).join(", "));
  await storage.updateDevProject(session.projectId, { status: "coding" });
  emitSSE(session.projectId, { type: "status", status: "coding" });

  for (const step of plan) {
    if (session.abortController.signal.aborted || session.status === "paused") break;

    addStep(session, "think", `Step ${step.step}: ${step.description}`);

    if (step.action === "scaffold" || step.action === "implement" || !step.file) {
      const codePrompt = `You are building: "${goal}"
Working directory: ${session.workDir}
Current step: ${step.description}
Previous steps: ${session.steps.slice(-5).map(s => s.message).join(", ")}

Generate the files needed for this step. Return a JSON object with:
{
  "files": [{"path": "relative/path/to/file", "content": "file content here"}],
  "bash": ["optional shell commands to run"],
  "explanation": "what you're doing"
}

Make real, working code. Keep files simple and functional.`;

      addStep(session, "think", `Generating code for: ${step.description}`);
      try {
        const codeText = await callLLMSimple(codePrompt, 4096, { skipCache: true }, "You are an expert coder. Return only valid JSON with working code.");
        const jsonMatch = codeText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          if (result.files) {
            for (const f of result.files) {
              if (f.path && f.content) {
                await writeFile(session, f.path, f.content, false);
              }
            }
          }
          if (result.explanation) {
            addStep(session, "think", result.explanation);
          }
          if (result.bash) {
            for (const cmd of result.bash.slice(0, 3)) {
              addStep(session, "bash", `Running: ${cmd}`);
              const r = await runBash(session, cmd, 60000);
              addStep(session, r.ok ? "bash" : "error", r.ok ? `Done: ${cmd}` : `Failed: ${cmd}`, r.stdout || r.stderr);
            }
          }
        }
      } catch (err: any) {
        addStep(session, "error", `Failed to generate code: ${err.message}`);
      }
    } else if (step.action === "write" && step.file) {
      const filePrompt = `You are building: "${goal}"
Create the file "${step.file}" for: ${step.description}
Return ONLY the raw file content, no markdown, no explanation.`;

      addStep(session, "write", `Creating ${step.file}`);
      try {
        const content = await callLLMSimple(filePrompt, 3000, { skipCache: true }, "Output only the file content.");
        const clean = content.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "");
        await writeFile(session, step.file, clean, false);
      } catch (err: any) {
        addStep(session, "error", `Failed: ${err.message}`);
      }
    } else if (step.action === "bash" && step.command) {
      addStep(session, "bash", `Running: ${step.command}`);
      const r = await runBash(session, step.command, 60000);
      addStep(session, r.ok ? "bash" : "error", r.ok ? `Done` : `Failed: ${step.command}`, r.stdout || r.stderr);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  if (!session.abortController.signal.aborted) {
    addStep(session, "done", "Implementation complete!");
    await storage.updateDevProject(session.projectId, { status: "done" });
    session.status = "done";
    emitSSE(session.projectId, { type: "status", status: "done" });
  }

  await storage.updateDevSession(session.sessionId, {
    status: session.status,
    files: JSON.stringify(getProjectFiles(session.workDir)),
  });
}

export async function createAndStartSession(projectId: number, goal: string): Promise<ActiveSession> {
  const project = await storage.getDevProject(projectId);
  if (!project) throw new Error("Project not found");

  const workDir = project.workDir || path.join(SESSIONS_BASE, `proj-${projectId}`);
  const dbSession = await storage.createDevSession({
    projectId,
    logs: "",
    files: "[]",
    status: "running",
    currentStep: "Initializing",
  });

  const session: ActiveSession = {
    projectId,
    sessionId: dbSession.id,
    status: "planning",
    steps: [],
    pendingDiffs: [],
    previewPort: null,
    serverProcess: null,
    abortController: new AbortController(),
    paused: false,
    workDir,
  };

  activeSessions.set(projectId, session);
  dlog(`Session started for project ${projectId}: ${goal}`);

  runAgentLoop(session, goal).catch(err => {
    addStep(session, "error", `Agent loop error: ${err.message}`);
    session.status = "failed";
    storage.updateDevProject(projectId, { status: "failed" }).catch(() => {});
    emitSSE(projectId, { type: "status", status: "failed" });
  });

  return session;
}

export function getActiveSession(projectId: number): ActiveSession | undefined {
  return activeSessions.get(projectId);
}

export function pauseSession(projectId: number): boolean {
  const session = activeSessions.get(projectId);
  if (!session) return false;
  session.paused = true;
  session.status = "paused";
  storage.updateDevProject(projectId, { status: "paused" }).catch(() => {});
  emitSSE(projectId, { type: "status", status: "paused" });
  addStep(session, "think", "Session paused by user");
  return true;
}

export function resumeSession(projectId: number): boolean {
  const session = activeSessions.get(projectId);
  if (!session) return false;
  session.paused = false;
  session.status = "coding";
  storage.updateDevProject(projectId, { status: "coding" }).catch(() => {});
  emitSSE(projectId, { type: "status", status: "coding" });
  addStep(session, "think", "Session resumed by user");
  return true;
}

export function cancelSession(projectId: number): boolean {
  const session = activeSessions.get(projectId);
  if (!session) return false;
  session.abortController.abort();
  session.serverProcess?.kill("SIGTERM");
  session.status = "failed";
  activeSessions.delete(projectId);
  storage.updateDevProject(projectId, { status: "failed" }).catch(() => {});
  emitSSE(projectId, { type: "status", status: "failed" });
  return true;
}

export function acceptDiff(projectId: number, filePath: string): boolean {
  const session = activeSessions.get(projectId);
  if (!session) return false;
  const diff = session.pendingDiffs.find(d => d.filePath === filePath && d.status === "pending");
  if (!diff) return false;
  diff.status = "accepted";
  const absPath = path.resolve(session.workDir, diff.filePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, diff.newContent, "utf-8");
  addStep(session, "write", `Accepted: ${filePath}`);
  emitSSE(projectId, { type: "diff_resolved", filePath, status: "accepted" });
  return true;
}

export function rejectDiff(projectId: number, filePath: string): boolean {
  const session = activeSessions.get(projectId);
  if (!session) return false;
  const diff = session.pendingDiffs.find(d => d.filePath === filePath && d.status === "pending");
  if (!diff) return false;
  diff.status = "rejected";
  addStep(session, "think", `Rejected: ${filePath} — keeping original`);
  emitSSE(projectId, { type: "diff_resolved", filePath, status: "rejected" });
  return true;
}

export function getSessionState(projectId: number): {
  active: boolean;
  status: ProjectStatus | null;
  steps: AgentStep[];
  pendingDiffs: FileDiff[];
  files: Array<{ name: string; path: string; size: number; isDir: boolean }>;
  previewPort: number | null;
} {
  const session = activeSessions.get(projectId);
  if (!session) {
    return { active: false, status: null, steps: [], pendingDiffs: [], files: [], previewPort: null };
  }
  return {
    active: true,
    status: session.status,
    steps: session.steps.slice(-100),
    pendingDiffs: session.pendingDiffs.filter(d => d.status === "pending"),
    files: getProjectFiles(session.workDir),
    previewPort: session.previewPort,
  };
}

export function readSessionFile(projectId: number, filePath: string): string | null {
  const session = activeSessions.get(projectId);
  if (!session) return null;
  const absPath = path.resolve(session.workDir, filePath);
  if (!fs.existsSync(absPath)) return null;
  return fs.readFileSync(absPath, "utf-8").slice(0, 50000);
}

dlog("Dev Studio initialized — parallel agent session manager active");
