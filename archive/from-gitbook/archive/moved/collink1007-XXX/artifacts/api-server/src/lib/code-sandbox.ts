import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { logger } from "./logger";
import {
  generateTestsForCode,
  type GeneratedTestCase,
} from "./sovereign-test-runner";

const slog = (msg: string) => logger.info("[CodeSandbox] " + msg);

const SANDBOX_DIR = path.join(process.cwd(), ".sandbox");
const SANDBOX_BACKUP_DIR = path.join(process.cwd(), ".sandbox-backups");
const PROPOSALS_LOG_PATH = path.join(process.cwd(), "proposals-log.json");

if (!fs.existsSync(SANDBOX_DIR)) fs.mkdirSync(SANDBOX_DIR, { recursive: true });
if (!fs.existsSync(SANDBOX_BACKUP_DIR)) fs.mkdirSync(SANDBOX_BACKUP_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 100_000;
const EXECUTION_TIMEOUT_MS = 20_000;
const TEST_EXECUTION_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;

const ALLOWED_WRITE_DIRS = ["src/routes", "src/lib"];

const PROTECTED_FILES = [
  "src/index.ts",
  "src/app.ts",
  "src/lib/self-evolution.ts",
  "src/lib/code-sandbox.ts",
  "src/lib/safe-deploy.ts",
  "src/lib/sovereign-test-runner.ts",
  "package.json",
  "tsconfig.json",
  "drizzle.config.ts",
  ".env",
];

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /process\.exit\s*\(/, reason: "process.exit() is forbidden" },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, reason: "child_process require is forbidden" },
  { pattern: /import\s+.*['"]child_process['"]/, reason: "child_process import is forbidden" },
  { pattern: /import\s*\(\s*['"]child_process['"]\s*\)/, reason: "dynamic child_process import is forbidden" },
  { pattern: /require\s*\(\s*['"]cluster['"]\s*\)/, reason: "cluster module is forbidden" },
  { pattern: /fs\.(rm|unlink|rmdir)Sync\s*\(\s*['"]\//, reason: "Absolute path deletion is forbidden" },
  { pattern: /fs\.(writeFile|appendFile)Sync\s*\(\s*['"]\/etc/, reason: "Writing to /etc is forbidden" },
  { pattern: /\beval\s*\(/, reason: "eval() is forbidden" },
  { pattern: /new\s+Function\s*\(/, reason: "new Function() is forbidden" },
  { pattern: /process\.env\.(TESSERACT_ADMIN|ADMIN_KEY|SECRET|PASSWORD|TOKEN|PRIVATE)/i, reason: "Accessing sensitive env vars is forbidden" },
  { pattern: /DROP\s+TABLE/i, reason: "SQL DROP TABLE is forbidden" },
  { pattern: /DELETE\s+FROM/i, reason: "SQL DELETE FROM is forbidden" },
  { pattern: /TRUNCATE\s+/i, reason: "SQL TRUNCATE is forbidden" },
  { pattern: /\.\.\/\.\.\/\.\./, reason: "Deep relative path traversal is forbidden" },
  { pattern: /globalThis\s*\.\s*\w+\s*=/, reason: "globalThis mutation is forbidden" },
  { pattern: /Object\.(defineProperty|setPrototypeOf)\s*\(\s*global/, reason: "Global prototype mutation is forbidden" },
  { pattern: /require\s*\(\s*['"]worker_threads['"]\s*\)/, reason: "worker_threads module is forbidden" },
  { pattern: /require\s*\(\s*['"]vm['"]\s*\)/, reason: "vm module is forbidden" },
  { pattern: /import\s*\(\s*['"]vm['"]\s*\)/, reason: "dynamic vm import is forbidden" },
];

export interface SandboxValidation {
  valid: boolean;
  errors: string[];
}

export interface SandboxTestResult {
  sandboxId: string;
  fileName: string;
  description: string;
  passed: boolean;
  validationErrors: string[];
  tsErrors: string[];
  testOutput: string;
  generatedTest: GeneratedTestCase | null;
  testsPassed: boolean;
  testsRan: boolean;
  testTotal: number;
  testPassed: number;
  testFailed: number;
  duration: number;
  attempt: number;
  testedAt: string;
}

export interface SandboxProposal {
  id: string;
  description: string;
  fileName: string;
  targetPath: string;
  code: string;
  createdAt: string;
  status: "pending" | "testing" | "passed" | "failed" | "deployed" | "rejected";
  testResults: SandboxTestResult[];
  diffPreview?: string;
  retryCount: number;
  deployedAt?: string;
}

const activeProposals = new Map<string, SandboxProposal>();

function loadProposalLog(): void {
  try {
    if (fs.existsSync(PROPOSALS_LOG_PATH)) {
      const data = JSON.parse(fs.readFileSync(PROPOSALS_LOG_PATH, "utf-8"));
      if (Array.isArray(data)) {
        for (const p of data.slice(-100)) {
          activeProposals.set(p.id, p);
        }
        slog(`Loaded ${data.length} proposals from disk`);
      }
    }
  } catch {
    slog("Could not load proposals log, starting fresh");
  }
}

function saveProposalLog(): void {
  try {
    const all = Array.from(activeProposals.values()).slice(-100);
    fs.writeFileSync(PROPOSALS_LOG_PATH, JSON.stringify(all, null, 2), "utf-8");
  } catch (e: any) {
    slog(`Failed to save proposals log: ${e.message}`);
  }
}

loadProposalLog();

export function getProposal(id: string): SandboxProposal | undefined {
  return activeProposals.get(id);
}

export function getAllProposals(): SandboxProposal[] {
  return Array.from(activeProposals.values()).slice(-50);
}

function validateFilePath(filePath: string): { valid: boolean; reason?: string } {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    return { valid: false, reason: `Path traversal detected in: ${filePath}` };
  }
  if (PROTECTED_FILES.some(p => normalized.endsWith(p) || normalized === p)) {
    return { valid: false, reason: `${filePath} is a protected file and cannot be modified` };
  }
  if (!ALLOWED_WRITE_DIRS.some(d => normalized.startsWith(d))) {
    return { valid: false, reason: `${filePath} is outside allowed directories (${ALLOWED_WRITE_DIRS.join(", ")})` };
  }
  return { valid: true };
}

function validateCode(code: string): SandboxValidation {
  const errors: string[] = [];

  if (code.length > MAX_FILE_SIZE_BYTES) {
    errors.push(`Code exceeds max size of ${MAX_FILE_SIZE_BYTES / 1000}KB (got ${Math.round(code.length / 1000)}KB)`);
  }

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(reason);
    }
  }

  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  if (Math.abs(opens - closes) > 5) {
    errors.push(`Severely unbalanced braces: ${opens} opens vs ${closes} closes`);
  }

  return { valid: errors.length === 0, errors };
}

function runTypeScriptCheck(filePath: string): { passed: boolean; errors: string[] } {
  try {
    execSync(
      `npx tsc --noEmit --strict --esModuleInterop --target es2022 --module commonjs --moduleResolution node --skipLibCheck "${filePath}" 2>&1`,
      { timeout: EXECUTION_TIMEOUT_MS, encoding: "utf8", cwd: process.cwd() }
    );
    return { passed: true, errors: [] };
  } catch (err: any) {
    const output: string = err.stdout || err.stderr || err.message || "";
    const tsErrors = output
      .split("\n")
      .filter((l: string) => l.includes("error TS") || l.includes(": error"))
      .slice(0, 15);
    return { passed: tsErrors.length === 0, errors: tsErrors };
  }
}

interface ExecutedTestResult {
  total: number;
  passed: number;
  failed: number;
  output: string;
  success: boolean;
}

function executeGeneratedTests(
  testCode: string,
  testFileName: string,
  sandboxCodeFile: string
): ExecutedTestResult {
  const testFile = path.join(SANDBOX_DIR, testFileName);
  const testRunnerSrc = path.join(process.cwd(), "src/lib/sovereign-test-runner.ts");
  const testRunnerJs = path.join(SANDBOX_DIR, "sovereign-test-runner.js");

  try {
    fs.writeFileSync(testFile, testCode, "utf-8");

    if (!fs.existsSync(testRunnerJs)) {
      const runnerSrc = fs.readFileSync(testRunnerSrc, "utf-8");
      const strippedRunner = runnerSrc
        .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, "")
        .replace(/^export\s+/gm, "module.exports.");
      const cjsRunner = `
const module_exports = {};
${strippedRunner
  .replace(/module\.exports\./g, "const __exported_ = ")
  .replace(/const __exported_ /g, "module.exports.")}
`;
      try {
        fs.writeFileSync(testRunnerJs, `
const logger = { info: () => {} };
${cjsRunner}
`, "utf-8");
      } catch {
        fs.writeFileSync(testRunnerJs, `
// minimal sovereign test runner stub
function createTestRunner() {
  const assertions = [];
  const suites = [];
  let currentSuite = '';
  return {
    describe(name, fn) { currentSuite = name; fn(); },
    it(name, fn) { suites.push({ name, fn, suite: currentSuite }); },
    ok(val, label) { assertions.push({ label: label || 'ok', passed: !!val }); },
    equal(a, b, label) { assertions.push({ label: label || 'equal', passed: JSON.stringify(a) === JSON.stringify(b) }); },
    notEqual(a, b, label) { assertions.push({ label: label || 'notEqual', passed: JSON.stringify(a) !== JSON.stringify(b) }); },
    throws(fn, label) {
      let threw = false;
      try { fn(); } catch { threw = true; }
      assertions.push({ label: label || 'throws', passed: threw });
    },
    async run() {
      let passed = 0, failed = 0;
      for (const s of suites) {
        try { await s.fn(); } catch(e) { assertions.push({ label: s.name, passed: false, error: e.message }); }
      }
      for (const a of assertions) { if (a.passed) passed++; else failed++; }
      const total = passed + failed;
      const results = [{ suiteName: 'suite', total, passed, failed, skipped: 0, duration: 0, assertions, output: [], success: failed === 0 }];
      return results;
    }
  };
}
module.exports = { createTestRunner };
`, "utf-8");
      }
    }

    const raw = execSync(`node "${testFile}"`, {
      timeout: TEST_EXECUTION_TIMEOUT_MS,
      encoding: "utf8",
      cwd: SANDBOX_DIR,
    });

    try {
      const lastLine = raw.trim().split("\n").reverse().find(l => l.startsWith("{"));
      if (lastLine) {
        const parsed = JSON.parse(lastLine) as { total: number; passed: number; failed: number };
        return {
          total: parsed.total ?? 0,
          passed: parsed.passed ?? 0,
          failed: parsed.failed ?? 0,
          output: raw,
          success: (parsed.failed ?? 1) === 0,
        };
      }
    } catch {}

    return { total: 1, passed: 1, failed: 0, output: raw, success: true };
  } catch (err: any) {
    const output = err.stdout || err.stderr || err.message || "Test execution failed";
    const exitCode = err.status ?? 1;
    return { total: 1, passed: 0, failed: 1, output, success: exitCode === 0 };
  } finally {
    try { fs.unlinkSync(testFile); } catch {}
  }
}

function generateDiff(existingPath: string, newCode: string): string {
  try {
    const fullPath = path.join(process.cwd(), existingPath);
    if (!fs.existsSync(fullPath)) {
      const preview = newCode.slice(0, 500).split("\n").slice(0, 20).map((l, i) => `+ ${i + 1}: ${l}`).join("\n");
      return `--- New file ---\n${preview}${newCode.split("\n").length > 20 ? "\n... (truncated)" : ""}`;
    }

    const oldLines = fs.readFileSync(fullPath, "utf-8").split("\n");
    const newLines = newCode.split("\n");
    const diff: string[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen && diff.length < 80; i++) {
      const ol = oldLines[i];
      const nl = newLines[i];
      if (ol !== nl) {
        if (ol !== undefined) diff.push(`- ${i + 1}: ${ol}`);
        if (nl !== undefined) diff.push(`+ ${i + 1}: ${nl}`);
      }
    }

    if (diff.length === 0) return "(no changes)";
    const removed = diff.filter(l => l.startsWith("-")).length;
    const added = diff.filter(l => l.startsWith("+")).length;
    return `--- ${removed} lines removed, ${added} lines added ---\n${diff.join("\n")}`;
  } catch {
    return "(diff unavailable)";
  }
}

function stripTypeAnnotations(code: string): string {
  const lines = code.split("\n");
  const output: string[] = [];
  let inInterfaceOrType = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^(export\s+)?(interface|type)\s+\w+/.test(trimmed)) {
      if (trimmed.includes("{")) {
        inInterfaceOrType = true;
        braceDepth = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
        if (braceDepth <= 0) inInterfaceOrType = false;
      } else if (trimmed.includes("=") && trimmed.endsWith(";")) {
        continue;
      } else {
        inInterfaceOrType = true;
        braceDepth = 0;
      }
      continue;
    }

    if (inInterfaceOrType) {
      braceDepth += (trimmed.match(/\{/g) || []).length;
      braceDepth -= (trimmed.match(/\}/g) || []).length;
      if (braceDepth <= 0) inInterfaceOrType = false;
      continue;
    }

    if (/^(export\s+)?enum\s+\w+/.test(trimmed)) {
      inInterfaceOrType = true;
      braceDepth = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
      if (braceDepth <= 0) inInterfaceOrType = false;
      continue;
    }

    let line = lines[i];
    line = line.replace(/\bas\s+(?:const|any|unknown|string|number|boolean)\b/g, "");
    line = line.replace(/\bas\s+\w+(?:\[\])?/g, "");
    line = line.replace(/!\./g, ".");
    output.push(line);
  }

  return output.join("\n");
}

export async function runSandboxTest(
  description: string,
  code: string,
  fileName: string,
  targetPath: string,
  attempt = 1
): Promise<SandboxTestResult> {
  const sandboxId = `sbx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const start = Date.now();
  const sandboxFile = path.join(SANDBOX_DIR, fileName);

  slog(`Testing ${fileName} (attempt ${attempt}) — ${description.slice(0, 60)}`);

  const validation = validateCode(code);
  const pathValidation = validateFilePath(targetPath);

  if (!pathValidation.valid) {
    validation.errors.push(pathValidation.reason!);
    validation.valid = false;
  }

  if (!validation.valid) {
    return {
      sandboxId,
      fileName,
      description,
      passed: false,
      validationErrors: validation.errors,
      tsErrors: [],
      testOutput: `Validation failed:\n${validation.errors.join("\n")}`,
      generatedTest: null,
      testsPassed: false,
      testsRan: false,
      testTotal: 0,
      testPassed: 0,
      testFailed: 0,
      duration: Date.now() - start,
      attempt,
      testedAt: new Date().toISOString(),
    };
  }

  try {
    fs.writeFileSync(sandboxFile, code, "utf-8");
  } catch (err: any) {
    return {
      sandboxId,
      fileName,
      description,
      passed: false,
      validationErrors: [`Failed to write sandbox file: ${err.message}`],
      tsErrors: [],
      testOutput: "Sandbox write error",
      generatedTest: null,
      testsPassed: false,
      testsRan: false,
      testTotal: 0,
      testPassed: 0,
      testFailed: 0,
      duration: Date.now() - start,
      attempt,
      testedAt: new Date().toISOString(),
    };
  }

  let tsErrors: string[] = [];
  let tsCheck = { passed: true, errors: [] as string[] };

  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
    tsCheck = runTypeScriptCheck(sandboxFile);
    tsErrors = tsCheck.errors;
  }

  const generatedTest = generateTestsForCode(code, fileName);

  let execResult: ExecutedTestResult = {
    total: 0,
    passed: 0,
    failed: 1,
    output: "Tests not yet executed",
    success: false,
  };

  let testsRan = false;
  let testSetupError: string | undefined;

  if (tsCheck.passed) {
    try {
      const jsCode = stripTypeAnnotations(code)
        .replace(/^import\s+type\s+.*?;\s*$/gm, "")
        .replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];\s*$/gm, "")
        .replace(/^import\s+\w+\s+from\s+['"][^'"]+['"];\s*$/gm, "")
        .replace(/^import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"];\s*$/gm, "")
        .replace(/^export\s+async\s+function\s+(\w+)/gm, "module.exports.$1 = async function $1")
        .replace(/^export\s+function\s+(\w+)/gm, "module.exports.$1 = function $1")
        .replace(/^export\s+const\s+(\w+)/gm, "module.exports.$1 = ")
        .replace(/^export\s+class\s+(\w+)/gm, "module.exports.$1 = class $1")
        .replace(/^export\s+\{[^}]+\};\s*$/gm, "")
        .replace(/^export\s+default\s+/gm, "module.exports.default = ");

      const jsSandboxFile = path.join(SANDBOX_DIR, fileName.replace(/\.(ts|tsx)$/, ".js"));
      fs.writeFileSync(jsSandboxFile, jsCode, "utf-8");

      execResult = executeGeneratedTests(
        generatedTest.testCode,
        generatedTest.fileName,
        jsSandboxFile
      );
      testsRan = true;

      try { fs.unlinkSync(jsSandboxFile); } catch {}
    } catch (e: any) {
      testSetupError = e.message;
      slog(`Test execution setup failed: ${e.message} — marking as FAILED`);
      execResult = {
        total: 1,
        passed: 0,
        failed: 1,
        output: `Test execution setup failed: ${e.message}`,
        success: false,
      };
      testsRan = false;
    }
  }

  const testsPassed = tsCheck.passed && testsRan && execResult.success;
  const passed = validation.valid && testsPassed;

  let testOutput = "";
  if (!tsCheck.passed) {
    testOutput = `TypeScript check: FAILED\n${tsErrors.slice(0, 10).join("\n")}`;
  } else if (!testsRan && testSetupError) {
    testOutput = `TypeScript check: PASSED\nTest execution setup FAILED: ${testSetupError}\nProposal rejected — tests must run to pass.`;
  } else if (testsRan) {
    testOutput = `TypeScript check: PASSED\nTest execution: ${execResult.success ? "PASSED" : "FAILED"}\n`;
    testOutput += `Tests: ${execResult.passed}/${execResult.total} passed\n`;
    if (execResult.output) {
      testOutput += `\n--- Output ---\n${execResult.output.slice(0, 1500)}`;
    }
  } else {
    testOutput = `TypeScript check: PASSED\nTest execution: SKIPPED (non-TS file)\n`;
    testOutput += `Note: Non-TypeScript files require manual review before approval.`;
  }

  try {
    fs.unlinkSync(sandboxFile);
  } catch {}

  const result: SandboxTestResult = {
    sandboxId,
    fileName,
    description,
    passed,
    validationErrors: validation.errors,
    tsErrors,
    testOutput,
    generatedTest,
    testsPassed,
    testsRan,
    testTotal: execResult.total,
    testPassed: execResult.passed,
    testFailed: execResult.failed,
    duration: Date.now() - start,
    attempt,
    testedAt: new Date().toISOString(),
  };

  slog(`Test ${passed ? "PASSED" : "FAILED"} for ${fileName} — ts:${tsCheck.passed} tests:${execResult.passed}/${execResult.total} (${result.duration}ms)`);
  return result;
}

export async function createProposal(
  description: string,
  code: string,
  fileName: string,
  targetPath: string
): Promise<SandboxProposal> {
  const id = `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const diffPreview = generateDiff(targetPath, code);

  const proposal: SandboxProposal = {
    id,
    description,
    fileName,
    targetPath,
    code,
    createdAt: new Date().toISOString(),
    status: "pending",
    testResults: [],
    diffPreview,
    retryCount: 0,
  };

  activeProposals.set(id, proposal);
  saveProposalLog();
  slog(`Proposal created: ${id} — ${description.slice(0, 60)}`);
  return proposal;
}

export async function testProposal(
  proposalId: string,
  onProgress?: (msg: string) => void
): Promise<SandboxProposal> {
  const proposal = activeProposals.get(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

  if (testingLock) {
    const waitStart = Date.now();
    onProgress?.(`Waiting for previous test to complete...`);
    while (testingLock && Date.now() - waitStart < 60_000) {
      await new Promise(r => setTimeout(r, 500));
    }
    if (testingLock) throw new Error("Test queue timeout — another test is still running");
  }

  testingLock = true;
  proposal.status = "testing";
  onProgress?.(`Starting sandbox test for ${proposal.fileName}...`);

  try {
    const result = await runSandboxTest(
      proposal.description,
      proposal.code,
      proposal.fileName,
      proposal.targetPath,
      proposal.retryCount + 1
    );

    proposal.testResults.push(result);

    if (result.passed) {
      proposal.status = "passed";
      onProgress?.(`Tests PASSED — ${result.testOutput.split("\n")[0]}`);
    } else {
      proposal.status = "failed";
      const errors = [...result.validationErrors, ...result.tsErrors].slice(0, 5).join("; ");
      onProgress?.(`Tests FAILED — ${errors}`);
    }

    saveProposalLog();
    return proposal;
  } finally {
    testingLock = false;
  }
}

export async function retryProposal(
  proposalId: string,
  correctedCode: string,
  onProgress?: (msg: string) => void
): Promise<SandboxProposal> {
  const proposal = activeProposals.get(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

  proposal.retryCount++;
  proposal.code = correctedCode;
  proposal.diffPreview = generateDiff(proposal.targetPath, correctedCode);
  onProgress?.(`Retry attempt ${proposal.retryCount} for ${proposal.fileName}...`);

  return testProposal(proposalId, onProgress);
}

export async function runAutoDebugLoop(
  proposalId: string,
  generateFix: (errors: string[], currentCode: string, attempt: number) => Promise<string>,
  onProgress?: (msg: string) => void,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<SandboxProposal> {
  let proposal = await testProposal(proposalId, onProgress);

  while (proposal.status === "failed" && proposal.retryCount < maxRetries) {
    const lastResult = proposal.testResults[proposal.testResults.length - 1];
    const allErrors = [...lastResult.validationErrors, ...lastResult.tsErrors];

    if (allErrors.some(e => e.includes("protected") || e.includes("forbidden") || e.includes("traversal"))) {
      onProgress?.(`Security violation — auto-debug stopped`);
      break;
    }

    onProgress?.(`Auto-debug attempt ${proposal.retryCount + 1}/${maxRetries}: analyzing ${allErrors.length} error(s)...`);

    try {
      const correctedCode = await generateFix(allErrors, proposal.code, proposal.retryCount + 1);
      proposal = await retryProposal(proposalId, correctedCode, onProgress);
    } catch (err: any) {
      onProgress?.(`Auto-debug failed to generate fix: ${err.message}`);
      break;
    }
  }

  if (proposal.status === "failed" && proposal.retryCount >= maxRetries) {
    onProgress?.(`Max retries (${maxRetries}) reached — proposal rejected`);
    proposal.status = "rejected";
    saveProposalLog();
  }

  return proposal;
}

let testingLock = false;

export function isTestingLocked(): boolean {
  return testingLock;
}

function cleanupOldSandboxFiles(): void {
  try {
    const entries = fs.readdirSync(SANDBOX_DIR);
    const now = Date.now();
    for (const entry of entries) {
      const fullPath = path.join(SANDBOX_DIR, entry);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > 3600_000) {
        try { fs.unlinkSync(fullPath); } catch {}
      }
    }
  } catch {}
}

setInterval(cleanupOldSandboxFiles, 30 * 60_000);

export function getSandboxStatus() {
  const proposals = getAllProposals();
  return {
    sandboxDir: SANDBOX_DIR,
    totalProposals: proposals.length,
    pending: proposals.filter(p => p.status === "pending").length,
    testing: proposals.filter(p => p.status === "testing").length,
    passed: proposals.filter(p => p.status === "passed").length,
    failed: proposals.filter(p => p.status === "failed").length,
    deployed: proposals.filter(p => p.status === "deployed").length,
    rejected: proposals.filter(p => p.status === "rejected").length,
  };
}

slog(`Code sandbox engine initialized — sandbox dir: ${SANDBOX_DIR}`);
