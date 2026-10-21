import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import {
  readProjectFile,
  listProjectFiles,
  applyCodeEdit,
  isFileEditable,
  rollbackFile,
  generateDiff,
  validateSyntax,
  searchFilesByContent,
  generateDirectoryTree,
  getFileBackups,
  getSelfCodeState,
} from "./self-code";
import { callLLMSimple } from "./llm-helper";

const execAsync = promisify(exec);
const CWD = process.cwd();
const ilog = (msg: string) => console.log(`[SovereignIDE] ${msg}`);

interface REPLSession {
  id: string;
  language: "typescript" | "javascript" | "python" | "shell";
  history: REPLEntry[];
  variables: Record<string, string>;
  createdAt: number;
  lastActivity: number;
}

interface REPLEntry {
  input: string;
  output: string;
  error: string | null;
  duration: number;
  timestamp: number;
}

interface CodeProject {
  id: string;
  name: string;
  description: string;
  files: string[];
  createdAt: number;
  lastModified: number;
  status: "active" | "testing" | "deployed" | "archived";
  testResults: TestResult[];
}

interface TestResult {
  testId: string;
  passed: boolean;
  output: string;
  duration: number;
  timestamp: number;
}

interface IDEState {
  sessions: Map<string, REPLSession>;
  projects: CodeProject[];
  totalExecutions: number;
  totalEdits: number;
  totalTests: number;
  uptime: number;
  startedAt: number;
}

const state: IDEState = {
  sessions: new Map(),
  projects: [],
  totalExecutions: 0,
  totalEdits: 0,
  totalTests: 0,
  uptime: 0,
  startedAt: Date.now(),
};

const SANDBOX_TIMEOUT_MS = 30000;
const MAX_OUTPUT_LENGTH = 16000;
const MAX_SESSIONS = 20;
const MAX_HISTORY_PER_SESSION = 100;

const SAFE_EVAL_PATTERNS = [
  /^(node|tsx|npx)\s+/,
  /^(ls|cat|grep|find|wc|head|tail|echo|pwd|date)\b/,
  /^npm\s+(list|outdated|info|run\s+test|run\s+lint|run\s+build)/,
  /^python3?\s+/,
  /^curl\s+/,
  /^(df|free|uptime|ps\s+aux|du\s+|stat\s+)/,
  /^git\s+(log|status|diff|show)/,
];

const BLOCKED_PATTERNS = [
  /rm\s+-rf/, /rm\s+-f\s+\//, /chmod\s+777/, /chown/,
  />\s*\/etc/, /dd\s+if/, /mkfs/, /shutdown/, /reboot/,
  /kill\s+-9/, /pkill/, /killall/,
  /curl.*\|\s*sh/, /wget.*\|\s*sh/,
];

function isSafeForREPL(cmd: string): boolean {
  const normalized = cmd.trim();
  if (BLOCKED_PATTERNS.some(p => p.test(normalized))) return false;
  return SAFE_EVAL_PATTERNS.some(p => p.test(normalized));
}

export function createREPLSession(language: REPLSession["language"] = "typescript"): REPLSession {
  if (state.sessions.size >= MAX_SESSIONS) {
    const oldest = [...state.sessions.entries()]
      .sort((a, b) => a[1].lastActivity - b[1].lastActivity)[0];
    if (oldest) state.sessions.delete(oldest[0]);
  }

  const session: REPLSession = {
    id: `repl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    language,
    history: [],
    variables: {},
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  state.sessions.set(session.id, session);
  ilog(`REPL session created: ${session.id} (${language})`);
  return session;
}

export async function executeInREPL(
  sessionId: string,
  code: string
): Promise<REPLEntry> {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return {
      input: code,
      output: "",
      error: `Session ${sessionId} not found. Create a new session first.`,
      duration: 0,
      timestamp: Date.now(),
    };
  }

  const start = Date.now();
  let output = "";
  let error: string | null = null;

  try {
    if (session.language === "shell") {
      if (!isSafeForREPL(code)) {
        error = `Command blocked by safety policy: ${code}`;
      } else {
        const { stdout, stderr } = await execAsync(code, {
          cwd: CWD,
          timeout: SANDBOX_TIMEOUT_MS,
          env: { ...process.env },
        });
        output = (stdout || "").slice(0, MAX_OUTPUT_LENGTH);
        if (stderr) error = stderr.slice(0, 4000);
      }
    } else if (session.language === "typescript" || session.language === "javascript") {
      const tmpFile = path.join(CWD, `.repl-tmp-${session.id}.${session.language === "typescript" ? "ts" : "js"}`);
      const wrappedCode = session.language === "typescript"
        ? code
        : code;

      fs.writeFileSync(tmpFile, wrappedCode, "utf-8");
      try {
        const runner = session.language === "typescript" ? "tsx" : "node";
        const { stdout, stderr } = await execAsync(`${runner} "${tmpFile}" 2>&1`, {
          cwd: CWD,
          timeout: SANDBOX_TIMEOUT_MS,
          env: { ...process.env },
        });
        output = (stdout || "").slice(0, MAX_OUTPUT_LENGTH);
        if (stderr && !stderr.includes("ExperimentalWarning")) {
          error = stderr.slice(0, 4000);
        }
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    } else if (session.language === "python") {
      const tmpFile = path.join(CWD, `.repl-tmp-${session.id}.py`);
      fs.writeFileSync(tmpFile, code, "utf-8");
      try {
        const { stdout, stderr } = await execAsync(`python3 "${tmpFile}" 2>&1`, {
          cwd: CWD,
          timeout: SANDBOX_TIMEOUT_MS,
          env: { ...process.env },
        });
        output = (stdout || "").slice(0, MAX_OUTPUT_LENGTH);
        if (stderr) error = stderr.slice(0, 4000);
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }
  } catch (err: any) {
    error = (err.stderr || err.message || "Execution failed").slice(0, 4000);
    output = (err.stdout || "").slice(0, MAX_OUTPUT_LENGTH);
  }

  const entry: REPLEntry = {
    input: code,
    output,
    error,
    duration: Date.now() - start,
    timestamp: Date.now(),
  };

  session.history.push(entry);
  if (session.history.length > MAX_HISTORY_PER_SESSION) {
    session.history = session.history.slice(-MAX_HISTORY_PER_SESSION);
  }
  session.lastActivity = Date.now();
  state.totalExecutions++;

  return entry;
}

export async function smartEdit(
  filePath: string,
  instruction: string
): Promise<{
  success: boolean;
  message: string;
  diff?: string;
  fileContent?: string;
}> {
  if (!isFileEditable(filePath)) {
    return { success: false, message: `File ${filePath} is not editable (protected or outside editable dirs)` };
  }

  const fileResult = readProjectFile(filePath);
  if ("error" in fileResult) {
    return { success: false, message: fileResult.error };
  }

  const currentContent = fileResult.content;

  const prompt = `You are a code editor. Given the following file and instruction, output ONLY the complete modified file content with the changes applied. No explanations, no markdown fences, just the raw file content.

FILE: ${filePath}
CURRENT CONTENT:
${currentContent.slice(0, 8000)}

INSTRUCTION: ${instruction}

Output the complete modified file:`;

  try {
    const newContent = await callLLMSimple(prompt, 4096, {}, "You are a precise code editor. Output only the modified file content, no explanations or markdown.");

    if (!newContent || newContent.length < 10) {
      return { success: false, message: "LLM returned empty or too-short response" };
    }

    let cleanContent = newContent;
    const fenceMatch = newContent.match(/```(?:typescript|javascript|python|ts|js|py)?\n([\s\S]*?)```/);
    if (fenceMatch) {
      cleanContent = fenceMatch[1];
    }

    const ext = path.extname(filePath);
    if ([".ts", ".js", ".json"].includes(ext)) {
      const syntaxResult = validateSyntax(cleanContent, ext.slice(1) as any);
      if (!syntaxResult.valid) {
        return {
          success: false,
          message: `Syntax validation failed: ${syntaxResult.errors.join(", ")}`,
          diff: generateDiff(currentContent, cleanContent),
        };
      }
    }

    const editResult = applyCodeEdit(filePath, cleanContent, `Smart edit: ${instruction.slice(0, 100)}`);

    if (editResult.status === "applied") {
      state.totalEdits++;
      return {
        success: true,
        message: `Applied edit to ${filePath}: ${instruction.slice(0, 100)}`,
        diff: generateDiff(currentContent, cleanContent),
        fileContent: cleanContent,
      };
    } else {
      return {
        success: false,
        message: `Edit rejected: ${editResult.reason || "unknown reason"}`,
        diff: generateDiff(currentContent, cleanContent),
      };
    }
  } catch (err: any) {
    return { success: false, message: `Smart edit failed: ${err.message}` };
  }
}

export async function runTests(
  testCommand: string = "npm run test",
  projectId?: string
): Promise<TestResult> {
  const start = Date.now();
  let output = "";
  let passed = false;

  try {
    const { stdout, stderr } = await execAsync(testCommand, {
      cwd: CWD,
      timeout: 60000,
      env: { ...process.env },
    });
    output = `${stdout}\n${stderr}`.slice(0, MAX_OUTPUT_LENGTH);
    passed = !stderr.includes("FAIL") && !stderr.includes("Error");
  } catch (err: any) {
    output = `${err.stdout || ""}\n${err.stderr || err.message}`.slice(0, MAX_OUTPUT_LENGTH);
    passed = false;
  }

  const result: TestResult = {
    testId: `test-${Date.now().toString(36)}`,
    passed,
    output,
    duration: Date.now() - start,
    timestamp: Date.now(),
  };

  state.totalTests++;

  if (projectId) {
    const project = state.projects.find(p => p.id === projectId);
    if (project) {
      project.testResults.push(result);
      if (project.testResults.length > 20) {
        project.testResults = project.testResults.slice(-20);
      }
    }
  }

  return result;
}

export async function codeFromChat(
  instruction: string,
  targetFile?: string,
  context?: string
): Promise<{
  success: boolean;
  action: "created" | "edited" | "executed" | "analyzed";
  result: string;
  file?: string;
  diff?: string;
}> {
  const isAnalysis = /analyze|review|explain|what does|how does|find bugs|audit/i.test(instruction);
  const isExec = /run|execute|test|check|try/i.test(instruction) && !targetFile;
  const isCreate = /create|new file|add file|scaffold|generate/i.test(instruction) && !targetFile;

  if (isAnalysis && targetFile) {
    const fileResult = readProjectFile(targetFile);
    if ("error" in fileResult) {
      return { success: false, action: "analyzed", result: fileResult.error };
    }

    const analysis = await callLLMSimple(
      `Analyze this code file and ${instruction}:\n\nFILE: ${targetFile}\n${fileResult.content.slice(0, 6000)}`,
      2048,
      {},
      "You are an expert code reviewer. Be specific and actionable."
    );

    return {
      success: true,
      action: "analyzed",
      result: analysis,
      file: targetFile,
    };
  }

  if (isExec) {
    const session = createREPLSession("shell");
    const result = await executeInREPL(session.id, instruction.replace(/^(run|execute|try)\s+/i, ""));
    return {
      success: !result.error,
      action: "executed",
      result: result.output || result.error || "No output",
    };
  }

  if (targetFile || isCreate) {
    const file = targetFile || await inferTargetFile(instruction);
    if (!file) {
      return { success: false, action: "created", result: "Could not determine target file. Please specify a file path." };
    }

    const editResult = await smartEdit(file, instruction);
    return {
      success: editResult.success,
      action: fs.existsSync(path.join(CWD, file)) ? "edited" : "created",
      result: editResult.message,
      file,
      diff: editResult.diff,
    };
  }

  const editResult = await smartEdit(targetFile || "server/routes.ts", instruction);
  return {
    success: editResult.success,
    action: "edited",
    result: editResult.message,
    file: targetFile,
    diff: editResult.diff,
  };
}

async function inferTargetFile(instruction: string): Promise<string | null> {
  const fileMatch = instruction.match(/(?:in|to|for|file)\s+["`']?([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)["`']?/i);
  if (fileMatch) return fileMatch[1];

  if (/route|endpoint|api/i.test(instruction)) return "server/routes.ts";
  if (/component|page|ui|frontend/i.test(instruction)) return "client/src/App.tsx";
  if (/schema|model|type/i.test(instruction)) return "shared/schema.ts";
  if (/storage|database|db/i.test(instruction)) return "server/storage.ts";

  return null;
}

export function createProject(name: string, description: string, files: string[] = []): CodeProject {
  const project: CodeProject = {
    id: `proj-${Date.now().toString(36)}`,
    name,
    description,
    files,
    createdAt: Date.now(),
    lastModified: Date.now(),
    status: "active",
    testResults: [],
  };

  state.projects.push(project);
  if (state.projects.length > 50) {
    state.projects = state.projects.filter(p => p.status !== "archived").concat(
      state.projects.filter(p => p.status === "archived").slice(-10)
    );
  }

  ilog(`Project created: ${name} (${project.id})`);
  return project;
}

export async function iterativeImprove(
  filePath: string,
  goal: string,
  maxIterations: number = 3
): Promise<{
  success: boolean;
  iterations: number;
  improvements: string[];
  finalScore: number;
}> {
  const improvements: string[] = [];
  let currentScore = 0;

  for (let i = 0; i < maxIterations; i++) {
    const fileResult = readProjectFile(filePath);
    if ("error" in fileResult) {
      return { success: false, iterations: i, improvements, finalScore: 0 };
    }

    const evaluationPrompt = `Rate this code for: ${goal}\n\nFILE: ${filePath}\n${fileResult.content.slice(0, 6000)}\n\nRespond with:\nSCORE: <1-10>\nISSUES: <list specific issues>\nFIX: <specific improvement to make>`;

    const evaluation = await callLLMSimple(evaluationPrompt, 1024, {}, "You are a strict code reviewer. Be specific.");
    const scoreMatch = evaluation.match(/SCORE:\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
    const fixMatch = evaluation.match(/FIX:\s*([\s\S]+?)(?:\n\n|$)/);
    const fix = fixMatch ? fixMatch[1].trim() : null;

    currentScore = score;

    if (score >= 8 || !fix) {
      improvements.push(`Iteration ${i + 1}: Score ${score}/10 — meets quality threshold`);
      break;
    }

    const editResult = await smartEdit(filePath, fix);
    if (editResult.success) {
      improvements.push(`Iteration ${i + 1}: Score ${score}/10 — applied: ${fix.slice(0, 100)}`);
    } else {
      improvements.push(`Iteration ${i + 1}: Score ${score}/10 — edit failed: ${editResult.message}`);
      break;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  return {
    success: currentScore >= 7,
    iterations: improvements.length,
    improvements,
    finalScore: currentScore,
  };
}

export function getIDEState(): {
  activeSessions: number;
  totalExecutions: number;
  totalEdits: number;
  totalTests: number;
  projects: number;
  activeProjects: number;
  uptimeMs: number;
  sessions: Array<{ id: string; language: string; historyLength: number; lastActivity: number }>;
  recentProjects: CodeProject[];
} {
  return {
    activeSessions: state.sessions.size,
    totalExecutions: state.totalExecutions,
    totalEdits: state.totalEdits,
    totalTests: state.totalTests,
    projects: state.projects.length,
    activeProjects: state.projects.filter(p => p.status === "active").length,
    uptimeMs: Date.now() - state.startedAt,
    sessions: [...state.sessions.values()].map(s => ({
      id: s.id,
      language: s.language,
      historyLength: s.history.length,
      lastActivity: s.lastActivity,
    })),
    recentProjects: state.projects.slice(-10),
  };
}

export function getSession(sessionId: string): REPLSession | undefined {
  return state.sessions.get(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  return state.sessions.delete(sessionId);
}

export function getProjectTree(): string {
  return generateDirectoryTree(".");
}

export function searchCode(query: string, dir: string = "server"): Array<{ file: string; line: number; content: string }> {
  const results = searchFilesByContent(query, dir);
  if ("error" in results) return [];
  return (results as any).matches || [];
}

ilog("Sovereign IDE initialized — self-hosted development environment active");
