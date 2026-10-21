import { Worker } from "worker_threads";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { recordCodeExecutionViolation } from "./sovereign-operations";

const MAX_CODE_SIZE = 100_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_SIZE = 50_000;
const MAX_HISTORY = 200;
const MAX_MEMORY_MB = 64;
const AUDIT_LOG_PATH = path.join(process.cwd(), "data", "live-code-audit.jsonl");
const WORKER_SCRIPT_PATH = path.join(__dirname, "live-code-worker.js");

export interface CodeExecutionRequest {
  code: string;
  language?: "javascript" | "typescript";
  timeoutMs?: number;
  conversationId?: number;
  agentId?: string;
}

export interface CodeExecutionResult {
  id: string;
  success: boolean;
  code: string;
  language: string;
  stdout: string;
  stderr: string;
  returnValue: string | null;
  error: string | null;
  durationMs: number;
  executedAt: string;
  conversationId?: number;
  agentId?: string;
  securityViolations: string[];
  truncated: boolean;
}

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\brequire\s*\(/g, label: "require() calls blocked" },
  { pattern: /\bimport\s*\(/g, label: "dynamic import() blocked" },
  { pattern: /\bimport\s+.+from\s+/g, label: "static import blocked" },
  { pattern: /\bprocess\s*\./g, label: "process access blocked" },
  { pattern: /\bglobalThis\s*\.\s*(process|require|Buffer)/g, label: "globalThis escape blocked" },
  { pattern: /\bchild_process\b/g, label: "child_process access blocked" },
  { pattern: /\b__dirname\b/g, label: "__dirname access blocked" },
  { pattern: /\b__filename\b/g, label: "__filename access blocked" },
];

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /while\s*\(\s*true\s*\)/g, label: "infinite loop detected (while(true))" },
  { pattern: /for\s*\(\s*;\s*;\s*\)/g, label: "infinite loop detected (for(;;))" },
  { pattern: /\.constructor\s*\(\s*['"]return this['"]\s*\)\s*\(\s*\)/g, label: "sandbox escape attempt via constructor" },
  { pattern: /Function\s*\(/g, label: "Function constructor blocked" },
  { pattern: /eval\s*\(/g, label: "eval() blocked" },
];

function generateId(): string {
  return `exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateCode(code: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (code.length > MAX_CODE_SIZE) {
    violations.push(`Code exceeds size limit (${code.length} > ${MAX_CODE_SIZE} bytes)`);
    return { valid: false, violations };
  }

  for (const { pattern, label } of BLOCKED_PATTERNS) {
    const fresh = new RegExp(pattern.source, pattern.flags);
    if (fresh.test(code)) {
      violations.push(label);
    }
  }

  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    const fresh = new RegExp(pattern.source, pattern.flags);
    if (fresh.test(code)) {
      violations.push(label);
    }
  }

  return { valid: violations.length === 0, violations };
}

async function transpileTypeScript(code: string): Promise<string> {
  try {
    const esbuild = await import("esbuild");
    const result = await esbuild.transform(code, {
      loader: "ts",
      target: "es2022",
      format: "esm",
    });
    let js = result.code;
    js = js.replace(/^export\s+/gm, "");
    js = js.replace(/^import\s+.*;\s*$/gm, "");
    return js;
  } catch (err: any) {
    throw new Error(`TypeScript transpilation failed: ${err.message}`);
  }
}

function truncateOutput(text: string, maxLen: number): { text: string; truncated: boolean } {
  if (text.length <= maxLen) return { text, truncated: false };
  return {
    text: text.slice(0, maxLen) + `\n... [truncated, ${text.length - maxLen} chars omitted]`,
    truncated: true,
  };
}

function ensureWorkerScript() {
  if (fs.existsSync(WORKER_SCRIPT_PATH)) return;

  const workerCode = `
const { parentPort, workerData } = require("worker_threads");
const vm = require("vm");

const { code, timeoutMs } = workerData;
const stdoutLines = [];
const stderrLines = [];

const consoleMock = {
  log: (...args) => { stdoutLines.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")); },
  error: (...args) => { stderrLines.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")); },
  warn: (...args) => { stderrLines.push("[warn] " + args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")); },
  info: (...args) => { stdoutLines.push("[info] " + args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")); },
  debug: (...args) => { stdoutLines.push("[debug] " + args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ")); },
  table: (data) => { stdoutLines.push(JSON.stringify(data, null, 2)); },
  dir: (obj) => { stdoutLines.push(JSON.stringify(obj, null, 2)); },
  time: () => {}, timeEnd: () => {}, timeLog: () => {}, clear: () => {},
  count: () => {}, countReset: () => {}, group: () => {}, groupEnd: () => {},
  assert: (cond, ...args) => { if (!cond) stderrLines.push("Assertion failed: " + args.join(" ")); },
};

const sandbox = {
  console: consoleMock,
  JSON, Math, Date, parseInt, parseFloat, isNaN, isFinite,
  encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
  Array, Object, String, Number, Boolean, RegExp,
  Error, TypeError, RangeError, SyntaxError,
  Map, Set, WeakMap, WeakSet, Promise, Symbol, Proxy, Reflect,
  ArrayBuffer, DataView,
  Float32Array, Float64Array, Int8Array, Int16Array, Int32Array,
  Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray,
  BigInt, BigInt64Array, BigUint64Array,
  TextEncoder, TextDecoder, URL, URLSearchParams,
  atob: typeof atob !== "undefined" ? atob : undefined,
  btoa: typeof btoa !== "undefined" ? btoa : undefined,
  structuredClone: typeof structuredClone !== "undefined" ? structuredClone : undefined,
  setTimeout: () => { throw new Error("setTimeout is not available in sandbox"); },
  clearTimeout: () => {},
  setInterval: () => { throw new Error("setInterval is not available in sandbox"); },
  clearInterval: () => {},
  undefined, NaN, Infinity,
  fetch: () => { throw new Error("Network access is not available in sandbox"); },
  XMLHttpRequest: undefined,
  WebSocket: undefined,
  require: undefined,
  process: undefined,
  global: undefined,
  globalThis: undefined,
  queueMicrotask: undefined,
};

try {
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });

  const wrappedCode = "(function() {\\n" + code + "\\n})();";
  const script = new vm.Script(wrappedCode, { filename: "sandbox.js" });
  const returnVal = script.runInContext(context, {
    timeout: timeoutMs,
    breakOnSigint: true,
  });

  let returnValue = null;
  if (returnVal !== undefined) {
    try {
      returnValue = typeof returnVal === "object" ? JSON.stringify(returnVal, null, 2) : String(returnVal);
    } catch {
      returnValue = String(returnVal);
    }
  }

  parentPort.postMessage({
    success: true,
    stdout: stdoutLines.join("\\n"),
    stderr: stderrLines.join("\\n"),
    returnValue,
    error: null,
  });
} catch (err) {
  const isTimeout = err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT" || (err.message && err.message.includes("Script execution timed out"));
  parentPort.postMessage({
    success: false,
    stdout: stdoutLines.join("\\n"),
    stderr: stderrLines.join("\\n"),
    returnValue: null,
    error: isTimeout ? "Execution timed out after " + timeoutMs + "ms" : (err.message || String(err)),
  });
}
`;
  const dir = path.dirname(WORKER_SCRIPT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WORKER_SCRIPT_PATH, workerCode);
}

function executeInWorker(code: string, timeoutMs: number): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  returnValue: string | null;
  error: string | null;
}> {
  ensureWorkerScript();

  return new Promise((resolve) => {
    const hardTimeout = timeoutMs + 2000;
    let resolved = false;

    const worker = new Worker(WORKER_SCRIPT_PATH, {
      workerData: { code, timeoutMs },
      resourceLimits: {
        maxOldGenerationSizeMb: MAX_MEMORY_MB,
        maxYoungGenerationSizeMb: MAX_MEMORY_MB / 4,
        codeRangeSizeMb: 16,
        stackSizeMb: 4,
      },
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        worker.terminate();
        resolve({
          success: false,
          stdout: "",
          stderr: `TimeoutError: Worker execution exceeded ${hardTimeout}ms hard limit`,
          returnValue: null,
          error: `Execution timed out after ${timeoutMs}ms (hard kill)`,
        });
      }
    }, hardTimeout);

    worker.on("message", (msg) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(msg);
      }
    });

    worker.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const isOOM = err.message?.includes("out of memory") || err.message?.includes("allocation failed");
        resolve({
          success: false,
          stdout: "",
          stderr: isOOM ? `MemoryError: Worker exceeded ${MAX_MEMORY_MB}MB memory limit` : err.message,
          returnValue: null,
          error: isOOM ? `Memory limit exceeded (${MAX_MEMORY_MB}MB)` : err.message,
        });
      }
    });

    worker.on("exit", (exitCode) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          success: false,
          stdout: "",
          stderr: `Worker exited with code ${exitCode}`,
          returnValue: null,
          error: `Worker process terminated unexpectedly (exit code ${exitCode})`,
        });
      }
    });
  });
}

export async function executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
  const id = generateId();
  const startTime = Date.now();
  const language = request.language || (request.code.match(/:\s*(string|number|boolean|any|void)\b/) ? "typescript" : "javascript");
  const timeoutMs = Math.min(request.timeoutMs || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

  const result: CodeExecutionResult = {
    id,
    success: false,
    code: request.code,
    language,
    stdout: "",
    stderr: "",
    returnValue: null,
    error: null,
    durationMs: 0,
    executedAt: new Date().toISOString(),
    conversationId: request.conversationId,
    agentId: request.agentId,
    securityViolations: [],
    truncated: false,
  };

  const validation = validateCode(request.code);
  if (!validation.valid) {
    result.securityViolations = validation.violations;
    result.error = `Security validation failed: ${validation.violations.join("; ")}`;
    result.durationMs = Date.now() - startTime;
    try { recordCodeExecutionViolation(validation.violations, request.code, request.agentId); } catch {}
    logExecution(result);
    return result;
  }

  let codeToRun = request.code;
  if (language === "typescript") {
    try {
      codeToRun = await transpileTypeScript(codeToRun);
    } catch (err: any) {
      result.error = err.message;
      result.durationMs = Date.now() - startTime;
      logExecution(result);
      return result;
    }
  }

  const workerResult = await executeInWorker(codeToRun, timeoutMs);

  const stdoutResult = truncateOutput(workerResult.stdout, MAX_OUTPUT_SIZE);
  const stderrResult = truncateOutput(workerResult.stderr, MAX_OUTPUT_SIZE);

  result.success = workerResult.success;
  result.stdout = stdoutResult.text;
  result.stderr = stderrResult.text;
  result.returnValue = workerResult.returnValue;
  result.error = workerResult.error;
  result.truncated = stdoutResult.truncated || stderrResult.truncated;
  result.durationMs = Date.now() - startTime;

  if (workerResult.error?.includes("Memory limit") || workerResult.error?.includes("out of memory")) {
    result.securityViolations.push("memory_limit_exceeded");
    try { recordCodeExecutionViolation(["memory_limit_exceeded"], request.code, request.agentId); } catch {}
  }

  logExecution(result);
  return result;
}

const executionHistory: CodeExecutionResult[] = [];

function logExecution(result: CodeExecutionResult) {
  executionHistory.push(result);
  if (executionHistory.length > MAX_HISTORY) {
    executionHistory.splice(0, executionHistory.length - MAX_HISTORY);
  }

  const status = result.success ? "SUCCESS" : "FAILED";
  const violations = result.securityViolations.length > 0 ? ` [VIOLATIONS: ${result.securityViolations.join(", ")}]` : "";
  logger.info(
    "LiveCodeExecutor",
    `${status} id=${result.id} lang=${result.language} duration=${result.durationMs}ms conv=${result.conversationId || "none"}${violations}`
  );

  try {
    const dir = path.dirname(AUDIT_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const auditEntry = {
      id: result.id,
      timestamp: result.executedAt,
      success: result.success,
      language: result.language,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      returnValue: result.returnValue,
      error: result.error,
      durationMs: result.durationMs,
      conversationId: result.conversationId,
      agentId: result.agentId,
      securityViolations: result.securityViolations,
      truncated: result.truncated,
    };
    fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(auditEntry) + "\n");
  } catch (auditErr: any) {
    logger.info("LiveCodeExecutor", `Audit log write failed: ${auditErr.message}`);
  }
}

export function getExecutionHistory(conversationId?: number, limit: number = 50): CodeExecutionResult[] {
  let history = executionHistory;

  if (history.length === 0 || (conversationId && !history.some(e => e.conversationId === conversationId))) {
    try {
      if (fs.existsSync(AUDIT_LOG_PATH)) {
        const lines = fs.readFileSync(AUDIT_LOG_PATH, "utf-8").trim().split("\n");
        const persisted: CodeExecutionResult[] = [];
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.id && typeof entry.success === "boolean") {
              persisted.push(entry);
            }
          } catch {}
        }
        if (persisted.length > 0) {
          const inMemoryIds = new Set(executionHistory.map(e => e.id));
          for (const p of persisted) {
            if (!inMemoryIds.has(p.id)) {
              history = [...persisted.filter(p2 => !inMemoryIds.has(p2.id)), ...history];
              break;
            }
          }
        }
      }
    } catch {}
  }

  if (conversationId) {
    history = history.filter(e => e.conversationId === conversationId);
  }
  return history.slice(-limit).map(e => ({
    ...e,
    code: e.code.length > 500 ? e.code.slice(0, 500) + "..." : e.code,
  }));
}

export function getExecutionStats(): {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  securityViolationCount: number;
  avgDurationMs: number;
  recentExecutions: number;
} {
  const total = executionHistory.length;
  const successes = executionHistory.filter(e => e.success).length;
  const violations = executionHistory.filter(e => e.securityViolations.length > 0).length;
  const avgDuration = total > 0 ? Math.round(executionHistory.reduce((s, e) => s + e.durationMs, 0) / total) : 0;
  const recentCutoff = Date.now() - 3600_000;
  const recent = executionHistory.filter(e => new Date(e.executedAt).getTime() > recentCutoff).length;

  return {
    totalExecutions: total,
    successCount: successes,
    failureCount: total - successes,
    securityViolationCount: violations,
    avgDurationMs: avgDuration,
    recentExecutions: recent,
  };
}

export function parseExecuteCodeTags(text: string): Array<{ code: string; language: string; fullMatch: string }> {
  const results: Array<{ code: string; language: string; fullMatch: string }> = [];
  const tagRegex = /<execute-code(?:\s+lang(?:uage)?=["']?(typescript|javascript|ts|js)["']?)?\s*>([\s\S]*?)<\/execute-code>/gi;
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const langRaw = (match[1] || "javascript").toLowerCase();
    const language = (langRaw === "ts" || langRaw === "typescript") ? "typescript" : "javascript";
    results.push({
      code: match[2].trim(),
      language,
      fullMatch: match[0],
    });
  }
  return results;
}

export function formatExecutionResult(result: CodeExecutionResult): string {
  const parts: string[] = [];
  const statusIcon = result.success ? "✓" : "✗";
  parts.push(`\n\n---\n**Code Execution ${statusIcon}** *(${result.language}, ${result.durationMs}ms)*\n`);

  if (result.code) {
    const codeLang = result.language === "typescript" ? "ts" : "js";
    parts.push(`**Source:**\n\`\`\`${codeLang}\n${result.code.slice(0, 2000)}\n\`\`\`\n`);
  }

  if (result.stdout) {
    parts.push("**Output:**\n```\n" + result.stdout + "\n```\n");
  }

  if (result.returnValue !== null) {
    parts.push("**Return value:**\n```\n" + result.returnValue + "\n```\n");
  }

  if (result.stderr) {
    parts.push("**Errors:**\n```\n" + result.stderr + "\n```\n");
  }

  if (result.error && !result.securityViolations.length) {
    parts.push("**Error:** " + result.error + "\n");
  }

  if (result.securityViolations.length > 0) {
    parts.push("**Security violations:** " + result.securityViolations.join(", ") + "\n");
  }

  parts.push("---\n");
  return parts.join("\n");
}

logger.info("LiveCodeExecutor", "Live code execution engine initialized (worker thread isolation, esbuild TS transpilation)");
