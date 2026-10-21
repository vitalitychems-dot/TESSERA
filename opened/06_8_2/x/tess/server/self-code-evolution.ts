import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  readProjectFile,
  listProjectFiles,
  applyCodeEdit,
  isFileEditable,
  rollbackFile,
  generateDiff,
  validateSyntax,
  analyzeDependencies,
  analyzeEditImpact,
  batchFileOperations,
  searchFilesByContent,
  generateDirectoryTree,
  getFileBackups,
  getSelfCodeState,
} from "./self-code";

const elog = (msg: string) => console.log(`[SelfCodeEvolution] ${msg}`);

const EXTENDED_PROTECTED_FILES = [
  "server/index.ts",
  "server/vite.ts",
  "server/db.ts",
  "drizzle.config.ts",
  "vite.config.ts",
  "package.json",
  "tsconfig.json",
  "server/real-threat-monitor.ts",
  "server/security-fortress.ts",
  "server/security.ts",
  "server/permission-boundaries.ts",
  "server/file-integrity-monitor.ts",
  "server/anomaly-detection.ts",
  "server/vuln-scanner.ts",
  "server/system-diagnostics.ts",
];

const SELF_MODIFIABLE_DIRS = [
  "server",
  "client/src",
  "shared",
];

export function canSelfModify(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  if (EXTENDED_PROTECTED_FILES.includes(normalized)) return false;
  if (normalized.includes("..")) return false;

  try {
    const { checkModulePermission } = require("./monitoring-archive");
    const check = checkModulePermission("self-code-evolution", normalized, "write");
    if (!check.allowed) {
      elog(`Permission boundary blocked write to ${normalized}: ${check.reason}`);
      return false;
    }
  } catch {}

  return SELF_MODIFIABLE_DIRS.some(dir => normalized.startsWith(dir));
}

export function getModifiableFiles(): string[] {
  const allFiles = listProjectFiles(".");
  return allFiles.filter(f => !f.endsWith("/") && canSelfModify(f));
}

interface SelfCodeResult {
  success: boolean;
  sessionId: string;
  message: string;
  editResults?: Array<{ file: string; status: string; diff?: string }>;
  testPassed?: boolean;
  rolledBack?: boolean;
  dryRun?: boolean;
}

interface InMemoryBackupEntry {
  file: string;
  originalContent: string | null;
}

const BLOCKED_CONTENT_PATTERNS = [
  /father.*protocol/i,
  /TESSERACT_ADMIN_KEY/,
  /TESSERACT_ADMIN/,
  /loyalty.*immutable/i,
  /loyalty.*1\.0/i,
];

function containsBlockedPatterns(content: string): boolean {
  return BLOCKED_CONTENT_PATTERNS.some(pattern => {
    const matches = content.match(pattern);
    if (!matches) return false;
    const idx = content.indexOf(matches[0]);
    const context = content.substring(Math.max(0, idx - 50), idx + matches[0].length + 50);
    return context.includes("false") || context.includes("0") || context.includes("null") || context.includes("delete") || context.includes("remove") || context.includes("override");
  });
}

export async function directSelfCode(
  edits: Array<{ file: string; content: string; description: string }>,
  sessionName: string,
  options?: { dryRun?: boolean }
): Promise<SelfCodeResult> {
  const sessionId = `self-code-${sessionName}-${Date.now()}`;
  const dryRun = options?.dryRun ?? false;

  elog(`${dryRun ? "[DRY RUN] " : ""}Starting self-code session: ${sessionId}`);

  const editResults: Array<{ file: string; status: string; diff?: string }> = [];
  const preflightErrors: string[] = [];

  for (const edit of edits) {
    if (!canSelfModify(edit.file)) {
      preflightErrors.push(`${edit.file}: protected or outside modifiable directories`);
      editResults.push({ file: edit.file, status: "protected" });
      continue;
    }

    if (containsBlockedPatterns(edit.content)) {
      preflightErrors.push(`${edit.file}: blocked content pattern detected`);
      editResults.push({ file: edit.file, status: "blocked_pattern" });
      continue;
    }

    const syntaxResult = validateSyntax(edit.content, edit.file);
    if (!syntaxResult.valid) {
      preflightErrors.push(`${edit.file}: syntax errors - ${syntaxResult.errors.join("; ")}`);
      editResults.push({ file: edit.file, status: "syntax_error" });
      continue;
    }

    const existing = readProjectFile(edit.file);
    const oldContent = "error" in existing ? "" : existing.content;
    const diff = oldContent ? generateDiff(oldContent, edit.content) : "(new file)";
    editResults.push({ file: edit.file, status: "validated", diff });
  }

  if (preflightErrors.length > 0) {
    return {
      success: false,
      sessionId,
      message: `Preflight failed: ${preflightErrors.join("; ")}`,
      editResults,
      dryRun,
    };
  }

  if (dryRun) {
    return {
      success: true,
      sessionId,
      message: `Dry run complete: ${edits.length} file(s) validated, no changes applied`,
      editResults,
      dryRun: true,
    };
  }

  const inMemoryBackups: InMemoryBackupEntry[] = [];

  for (const edit of edits) {
    try {
      const existing = readProjectFile(edit.file);
      inMemoryBackups.push({
        file: edit.file,
        originalContent: "error" in existing ? null : existing.content,
      });
    } catch (backupErr: any) {
      elog(`Backup read failed for ${edit.file}: ${backupErr.message}`);
      inMemoryBackups.push({ file: edit.file, originalContent: null });
    }
  }

  const appliedFiles: string[] = [];
  let allPassed = true;

  for (const edit of edits) {
    try {
      const result = applyCodeEdit(edit.file, edit.content, edit.description);
      const editEntry = editResults.find(e => e.file === edit.file);
      if (editEntry) editEntry.status = result.status;

      if (result.status === "applied") {
        appliedFiles.push(edit.file);
      } else {
        allPassed = false;
        elog(`Edit failed for ${edit.file}: status=${result.status}`);
        break;
      }
    } catch (editErr: any) {
      elog(`Edit threw for ${edit.file}: ${editErr.message}`);
      const editEntry = editResults.find(e => e.file === edit.file);
      if (editEntry) editEntry.status = "error";
      allPassed = false;
      break;
    }
  }

  if (!allPassed) {
    rollbackFromInMemory(inMemoryBackups, appliedFiles);
    elog(`Session ${sessionId} rolled back: some edits failed`);
    return {
      success: false,
      sessionId,
      message: "Some edits failed to apply, all changes rolled back",
      editResults,
      rolledBack: true,
    };
  }

  const testResult = runQuickSyntaxTests(edits);
  if (!testResult.passed) {
    rollbackFromInMemory(inMemoryBackups, appliedFiles);
    elog(`Session ${sessionId} rolled back: post-apply validation failed`);
    return {
      success: false,
      sessionId,
      message: `Post-apply validation failed: ${testResult.output}. All changes rolled back.`,
      editResults,
      testPassed: false,
      rolledBack: true,
    };
  }

  elog(`Session ${sessionId} completed: ${appliedFiles.length} file(s) modified`);
  return {
    success: true,
    sessionId,
    message: `Self-code session complete: ${appliedFiles.length} file(s) modified successfully`,
    editResults,
    testPassed: true,
  };
}

function rollbackFromInMemory(backups: InMemoryBackupEntry[], appliedFiles: string[]): void {
  for (const backup of backups) {
    if (!appliedFiles.includes(backup.file)) continue;
    try {
      if (backup.originalContent !== null) {
        const fullPath = path.join(process.cwd(), backup.file);
        fs.writeFileSync(fullPath, backup.originalContent, "utf-8");
      } else {
        const fullPath = path.join(process.cwd(), backup.file);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch (e: any) {
      elog(`Rollback failed for ${backup.file}: ${e.message}`);
    }
  }
}

function runQuickSyntaxTests(edits: Array<{ file: string; content: string }>): { passed: boolean; output: string } {
  const errors: string[] = [];
  for (const edit of edits) {
    const fullPath = path.join(process.cwd(), edit.file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`${edit.file}: file not found after apply`);
      continue;
    }
    const written = fs.readFileSync(fullPath, "utf-8");
    const syntaxResult = validateSyntax(written, edit.file);
    if (!syntaxResult.valid) {
      errors.push(`${edit.file}: ${syntaxResult.errors.join("; ")}`);
    }
  }
  if (errors.length > 0) {
    return { passed: false, output: errors.join(" | ") };
  }
  return { passed: true, output: "All files pass syntax validation" };
}

interface CodeQualityScore {
  file: string;
  overall: number;
  complexity: number;
  readability: number;
  maintainability: number;
  duplication: number;
  factors: string[];
}

export function scoreCodeQuality(filePath: string): CodeQualityScore | { error: string } {
  const result = readProjectFile(filePath);
  if ("error" in result) return { error: result.error };

  const content = result.content;
  const lines = content.split("\n");
  const factors: string[] = [];

  let complexity = 100;
  const controlFlowCount = (content.match(/\b(if|else|for|while|switch|try|catch|case)\b/g) || []).length;
  const functionCount = (content.match(/(?:function\s+\w+|=>\s*\{|=>\s*[^{])/g) || []).length;
  const nestingDepth = computeMaxNesting(content);
  if (controlFlowCount > lines.length * 0.3) { complexity -= 20; factors.push("high control flow density"); }
  if (nestingDepth > 6) { complexity -= 15; factors.push(`deep nesting (${nestingDepth})`); }
  if (functionCount > 0 && lines.length / functionCount > 80) { complexity -= 10; factors.push("long functions"); }
  complexity = Math.max(0, complexity);

  let readability = 100;
  const longLines = lines.filter(l => l.length > 120).length;
  if (longLines > lines.length * 0.1) { readability -= 15; factors.push(`${longLines} lines >120 chars`); }
  const commentLines = lines.filter(l => l.trim().startsWith("//") || l.trim().startsWith("/*") || l.trim().startsWith("*")).length;
  const commentRatio = lines.length > 0 ? commentLines / lines.length : 0;
  if (commentRatio < 0.05 && lines.length > 100) { readability -= 10; factors.push("low comment ratio"); }
  const avgLineLen = lines.reduce((s, l) => s + l.length, 0) / Math.max(1, lines.length);
  if (avgLineLen > 80) { readability -= 10; factors.push("high avg line length"); }
  readability = Math.max(0, readability);

  let maintainability = 100;
  if (lines.length > 500) { maintainability -= 15; factors.push(`large file (${lines.length} lines)`); }
  if (lines.length > 1000) { maintainability -= 15; factors.push("very large file"); }
  const importCount = (content.match(/^import\s+/gm) || []).length;
  if (importCount > 20) { maintainability -= 10; factors.push(`many imports (${importCount})`); }
  const exportCount = (content.match(/^export\s+/gm) || []).length;
  if (exportCount > 20) { maintainability -= 10; factors.push(`many exports (${exportCount})`); }
  maintainability = Math.max(0, maintainability);

  let duplication = 100;
  const duplicateLines = findDuplicateBlocks(lines);
  if (duplicateLines > 0) {
    const dupRatio = duplicateLines / Math.max(1, lines.length);
    if (dupRatio > 0.1) { duplication -= 20; factors.push(`${duplicateLines} duplicate lines`); }
    else if (dupRatio > 0.05) { duplication -= 10; factors.push("some duplication"); }
  }

  const overall = Math.round((complexity * 0.3 + readability * 0.25 + maintainability * 0.25 + duplication * 0.2));

  return { file: filePath, overall, complexity, readability, maintainability, duplication, factors };
}

function computeMaxNesting(code: string): number {
  let max = 0, current = 0;
  let inString: string | null = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inString) { if (ch === inString && code[i - 1] !== "\\") inString = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "{") { current++; max = Math.max(max, current); }
    if (ch === "}") current--;
  }
  return max;
}

function findDuplicateBlocks(lines: string[]): number {
  const blockSize = 3;
  const seen = new Map<string, number>();
  let duplicates = 0;
  for (let i = 0; i <= lines.length - blockSize; i++) {
    const block = lines.slice(i, i + blockSize).map(l => l.trim()).filter(l => l.length > 0).join("\n");
    if (block.length < 20) continue;
    const count = seen.get(block) || 0;
    if (count > 0) duplicates += blockSize;
    seen.set(block, count + 1);
  }
  return duplicates;
}

interface ABTestResult {
  winner: "A" | "B" | "tie";
  scoreA: number;
  scoreB: number;
  metricsA: Record<string, number>;
  metricsB: Record<string, number>;
  details: string;
}

export function abTestCode(
  filePath: string,
  versionA: string,
  versionB: string,
  descriptionA: string,
  descriptionB: string
): ABTestResult {
  const syntaxA = validateSyntax(versionA, filePath);
  const syntaxB = validateSyntax(versionB, filePath);

  const metricsA: Record<string, number> = {
    syntaxValid: syntaxA.valid ? 100 : 0,
    lineCount: versionA.split("\n").length,
    functionCount: (versionA.match(/(?:function\s+\w+|=>\s*\{)/g) || []).length,
    complexity: (versionA.match(/\b(if|else|for|while|switch|try|catch)\b/g) || []).length,
    avgLineLength: Math.round(versionA.length / Math.max(1, versionA.split("\n").length)),
  };

  const metricsB: Record<string, number> = {
    syntaxValid: syntaxB.valid ? 100 : 0,
    lineCount: versionB.split("\n").length,
    functionCount: (versionB.match(/(?:function\s+\w+|=>\s*\{)/g) || []).length,
    complexity: (versionB.match(/\b(if|else|for|while|switch|try|catch)\b/g) || []).length,
    avgLineLength: Math.round(versionB.length / Math.max(1, versionB.split("\n").length)),
  };

  let scoreA = 50, scoreB = 50;

  if (syntaxA.valid && !syntaxB.valid) { scoreA += 40; scoreB -= 40; }
  else if (!syntaxA.valid && syntaxB.valid) { scoreB += 40; scoreA -= 40; }

  if (metricsA.lineCount < metricsB.lineCount) scoreA += 5;
  else if (metricsB.lineCount < metricsA.lineCount) scoreB += 5;

  if (metricsA.complexity < metricsB.complexity) scoreA += 10;
  else if (metricsB.complexity < metricsA.complexity) scoreB += 10;

  if (metricsA.avgLineLength < 100 && metricsB.avgLineLength >= 100) scoreA += 5;
  else if (metricsB.avgLineLength < 100 && metricsA.avgLineLength >= 100) scoreB += 5;

  const diff = Math.abs(scoreA - scoreB);
  const winner: "A" | "B" | "tie" = diff < 5 ? "tie" : scoreA > scoreB ? "A" : "B";

  return {
    winner,
    scoreA: Math.max(0, Math.min(100, scoreA)),
    scoreB: Math.max(0, Math.min(100, scoreB)),
    metricsA,
    metricsB,
    details: `Version ${winner === "tie" ? "tie" : winner} wins. A="${descriptionA}" (${scoreA}pts) vs B="${descriptionB}" (${scoreB}pts)`,
  };
}

interface CrossFileRefactorPlan {
  id: string;
  description: string;
  files: Array<{ file: string; action: "edit" | "create" | "delete"; content?: string }>;
  status: "planned" | "executing" | "completed" | "rolled_back" | "failed";
  createdAt: number;
  executedAt?: number;
  rollbackInfo?: Array<{ file: string; originalContent: string }>;
}

const refactorPlans: CrossFileRefactorPlan[] = [];

export function planCrossFileRefactor(
  description: string,
  files: Array<{ file: string; action: "edit" | "create"; content: string }>
): CrossFileRefactorPlan {
  const plan: CrossFileRefactorPlan = {
    id: `refactor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    files,
    status: "planned",
    createdAt: Date.now(),
  };
  refactorPlans.push(plan);
  return plan;
}

export function executeCrossFileRefactor(planId: string): { success: boolean; message: string; plan: CrossFileRefactorPlan } {
  const plan = refactorPlans.find(p => p.id === planId);
  if (!plan) return { success: false, message: "Plan not found", plan: { id: planId, description: "", files: [], status: "failed", createdAt: 0 } };
  if (plan.status !== "planned") return { success: false, message: `Plan status is ${plan.status}, expected planned`, plan };

  plan.status = "executing";
  plan.executedAt = Date.now();
  plan.rollbackInfo = [];

  const applied: string[] = [];

  for (const fileOp of plan.files) {
    if (!canSelfModify(fileOp.file)) {
      rollbackRefactor(plan, applied);
      plan.status = "failed";
      return { success: false, message: `File ${fileOp.file} is protected`, plan };
    }

    const existing = readProjectFile(fileOp.file);
    if (!("error" in existing)) {
      plan.rollbackInfo.push({ file: fileOp.file, originalContent: existing.content });
    }

    if (fileOp.content) {
      const syntaxResult = validateSyntax(fileOp.content, fileOp.file);
      if (!syntaxResult.valid) {
        rollbackRefactor(plan, applied);
        plan.status = "failed";
        return { success: false, message: `Syntax error in ${fileOp.file}: ${syntaxResult.errors.join("; ")}`, plan };
      }

      const editResult = applyCodeEdit(fileOp.file, fileOp.content, `Refactor: ${plan.description}`);
      if (editResult.status !== "applied") {
        rollbackRefactor(plan, applied);
        plan.status = "failed";
        return { success: false, message: `Edit failed for ${fileOp.file}: ${editResult.reason}`, plan };
      }
      applied.push(fileOp.file);
    }
  }

  plan.status = "completed";
  return { success: true, message: `Refactor completed: ${applied.length} files modified`, plan };
}

function rollbackRefactor(plan: CrossFileRefactorPlan, appliedFiles: string[]) {
  for (const file of appliedFiles) {
    try { rollbackFile(file, 0); } catch {}
  }
  plan.status = "rolled_back";
}

export function getRefactorPlans(): CrossFileRefactorPlan[] {
  return refactorPlans.slice(-50);
}

interface ErrorPattern {
  id: string;
  errorType: string;
  errorMessage: string;
  causingChange: string;
  file: string;
  fix: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  preventionRule: string;
}

const ERROR_PATTERNS_FILE = path.join(process.cwd(), "server", "error-patterns.json");
const errorPatterns: ErrorPattern[] = [];

function loadErrorPatterns() {
  try {
    if (fs.existsSync(ERROR_PATTERNS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ERROR_PATTERNS_FILE, "utf-8"));
      if (Array.isArray(data)) errorPatterns.push(...data);
    }
  } catch {}
}

function saveErrorPatterns() {
  try {
    fs.writeFileSync(ERROR_PATTERNS_FILE, JSON.stringify(errorPatterns.slice(-200), null, 2), "utf-8");
  } catch {}
}

export function recordErrorPattern(
  errorType: string,
  errorMessage: string,
  causingChange: string,
  file: string,
  fix: string
): ErrorPattern {
  const existing = errorPatterns.find(
    p => p.errorType === errorType && p.file === file && p.errorMessage === errorMessage
  );

  if (existing) {
    existing.occurrences++;
    existing.lastSeen = Date.now();
    if (fix && fix.length > existing.fix.length) existing.fix = fix;
    saveErrorPatterns();
    return existing;
  }

  const pattern: ErrorPattern = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    errorType,
    errorMessage: errorMessage.slice(0, 500),
    causingChange: causingChange.slice(0, 500),
    file,
    fix: fix.slice(0, 500),
    occurrences: 1,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    preventionRule: derivePreventionRule(errorType, errorMessage),
  };

  errorPatterns.push(pattern);
  if (errorPatterns.length > 200) errorPatterns.splice(0, errorPatterns.length - 200);
  saveErrorPatterns();
  return pattern;
}

function derivePreventionRule(errorType: string, errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  if (msg.includes("cannot find module")) return "Verify import paths exist before editing";
  if (msg.includes("syntax error")) return "Run syntax validation before applying";
  if (msg.includes("type") && msg.includes("not assignable")) return "Check type compatibility before changes";
  if (msg.includes("is not a function")) return "Verify function signatures are preserved";
  if (msg.includes("undefined")) return "Ensure all variables are defined before use";
  if (msg.includes("brace") || msg.includes("bracket") || msg.includes("paren")) return "Balance all delimiters";
  return "Review change carefully before applying";
}

export function findSimilarErrors(errorMessage: string): ErrorPattern[] {
  const msgLower = errorMessage.toLowerCase();
  const words = msgLower.split(/\s+/).filter(w => w.length > 3);
  return errorPatterns.filter(p => {
    const patternWords = p.errorMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = words.filter(w => patternWords.includes(w)).length;
    return overlap >= Math.min(3, words.length * 0.5);
  }).slice(0, 10);
}

export function getErrorPatterns(): ErrorPattern[] {
  return errorPatterns.slice(-100);
}

interface CodeReviewResult {
  file: string;
  approved: boolean;
  score: number;
  issues: Array<{ severity: "error" | "warning" | "info"; message: string; line?: number }>;
  suggestions: string[];
  securityFlags: string[];
  performanceFlags: string[];
}

export function reviewCode(filePath: string, newContent: string): CodeReviewResult {
  const issues: Array<{ severity: "error" | "warning" | "info"; message: string; line?: number }> = [];
  const suggestions: string[] = [];
  const securityFlags: string[] = [];
  const performanceFlags: string[] = [];

  const syntaxResult = validateSyntax(newContent, filePath);
  if (!syntaxResult.valid) {
    for (const err of syntaxResult.errors) {
      issues.push({ severity: "error", message: err });
    }
  }

  const lines = newContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (/console\.(log|warn|error)\(/.test(line) && !line.trim().startsWith("//")) {
      issues.push({ severity: "info", message: "Console statement found", line: lineNum });
    }

    if (/eval\s*\(/.test(line)) {
      securityFlags.push(`eval() used at line ${lineNum}`);
      issues.push({ severity: "error", message: "eval() is a security risk", line: lineNum });
    }

    if (/execSync|exec\s*\(/.test(line) && !/timeout/.test(lines.slice(Math.max(0, i - 2), i + 3).join(" "))) {
      securityFlags.push(`Shell execution without timeout at line ${lineNum}`);
    }

    if (/password|secret|api_key|apiKey|private_key/i.test(line) && /[=:]\s*["'][^"']{8,}["']/.test(line)) {
      securityFlags.push(`Possible hardcoded secret at line ${lineNum}`);
      issues.push({ severity: "error", message: "Possible hardcoded credential", line: lineNum });
    }

    if (line.length > 200) {
      issues.push({ severity: "warning", message: "Line too long (>200 chars)", line: lineNum });
    }

    if (/\.forEach\s*\(/.test(line) && /await\s/.test(line)) {
      performanceFlags.push(`Await inside forEach at line ${lineNum} - use for...of instead`);
    }

    if (/new RegExp\(/.test(line) && !/const|let|var/.test(lines.slice(Math.max(0, i - 5), i).join(" "))) {
      performanceFlags.push(`RegExp created in hot path at line ${lineNum}`);
    }
  }

  const existing = readProjectFile(filePath);
  if (!("error" in existing)) {
    const oldExports = (existing.content.match(/export\s+(?:async\s+)?(?:function|const|let|class|interface|type)\s+(\w+)/g) || []);
    const newExports = (newContent.match(/export\s+(?:async\s+)?(?:function|const|let|class|interface|type)\s+(\w+)/g) || []);
    const oldNames = oldExports.map(e => e.match(/(\w+)$/)?.[1]).filter(Boolean);
    const newNames = newExports.map(e => e.match(/(\w+)$/)?.[1]).filter(Boolean);
    const removed = oldNames.filter(n => !newNames.includes(n));
    if (removed.length > 0) {
      issues.push({ severity: "error", message: `Exported symbols removed: ${removed.join(", ")}` });
      suggestions.push("Avoid removing exports that other files may depend on");
    }
  }

  if (lines.length > 500) {
    suggestions.push("Consider splitting this file into smaller modules");
  }

  const importCount = (newContent.match(/^import\s+/gm) || []).length;
  if (importCount > 25) {
    suggestions.push(`High import count (${importCount}) - consider consolidating dependencies`);
  }

  let score = 100;
  score -= issues.filter(i => i.severity === "error").length * 15;
  score -= issues.filter(i => i.severity === "warning").length * 5;
  score -= securityFlags.length * 20;
  score -= performanceFlags.length * 5;
  score = Math.max(0, Math.min(100, score));

  return {
    file: filePath,
    approved: score >= 60 && issues.filter(i => i.severity === "error").length === 0,
    score,
    issues,
    suggestions,
    securityFlags,
    performanceFlags,
  };
}

interface APIDocEntry {
  method: string;
  path: string;
  description: string;
  parameters?: string[];
  responseType?: string;
  auth?: string;
}

export function generateAPIDocumentation(): { routes: APIDocEntry[]; totalEndpoints: number; generatedAt: number } {
  const routesFile = readProjectFile("server/routes.ts");
  if ("error" in routesFile) return { routes: [], totalEndpoints: 0, generatedAt: Date.now() };

  const content = routesFile.content;
  const routes: APIDocEntry[] = [];

  const routeRegex = /app\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];

    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(content.length, match.index + 500);
    const context = content.slice(contextStart, contextEnd);

    let description = "";
    const commentMatch = context.match(/\/\/\s*(.+?)(?:\n|$)/);
    if (commentMatch) description = commentMatch[1].trim();

    const params: string[] = [];
    const bodyMatch = context.match(/req\.body\.\s*\{([^}]+)\}/);
    if (bodyMatch) {
      params.push(...bodyMatch[1].split(",").map(p => p.trim()).filter(Boolean));
    }
    const queryMatch = context.match(/req\.query\.(\w+)/g);
    if (queryMatch) {
      params.push(...queryMatch.map(q => `query: ${q.replace("req.query.", "")}`));
    }

    const auth = context.includes("requireAdmin") ? "admin" : context.includes("requireAuth") ? "user" : "none";

    routes.push({ method, path: routePath, description, parameters: params.length > 0 ? params : undefined, auth });
  }

  return { routes, totalEndpoints: routes.length, generatedAt: Date.now() };
}

interface DependencyCheckResult {
  outdated: Array<{ name: string; current: string; latest?: string }>;
  securityIssues: string[];
  checkTime: number;
}

export function checkDependencyUpdates(): DependencyCheckResult {
  const result: DependencyCheckResult = { outdated: [], securityIssues: [], checkTime: Date.now() };

  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const [name, version] of Object.entries(deps)) {
      const versionStr = String(version);
      if (versionStr.startsWith("file:") || versionStr.startsWith("link:")) continue;
      result.outdated.push({ name, current: versionStr });
    }

    try {
      const auditOutput = execSync("npm audit --json 2>/dev/null || true", {
        timeout: 30000, encoding: "utf-8", cwd: process.cwd(),
      });
      const audit = JSON.parse(auditOutput);
      if (audit.vulnerabilities) {
        for (const [pkg, info] of Object.entries(audit.vulnerabilities as Record<string, any>)) {
          if (info.severity === "high" || info.severity === "critical") {
            result.securityIssues.push(`${pkg}: ${info.severity} - ${info.title || "security issue"}`);
          }
        }
      }
    } catch {}
  } catch {}

  return result;
}

interface PerformanceBenchmark {
  name: string;
  file: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: number;
}

const PERF_HISTORY_FILE = path.join(process.cwd(), "server", "perf-benchmarks.json");
const perfHistory: PerformanceBenchmark[] = [];

function loadPerfHistory() {
  try {
    if (fs.existsSync(PERF_HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(PERF_HISTORY_FILE, "utf-8"));
      if (Array.isArray(data)) perfHistory.push(...data);
    }
  } catch {}
}

function savePerfHistory() {
  try {
    fs.writeFileSync(PERF_HISTORY_FILE, JSON.stringify(perfHistory.slice(-500), null, 2), "utf-8");
  } catch {}
}

export function recordPerformanceBenchmark(name: string, file: string, metric: string, value: number, unit: string) {
  perfHistory.push({ name, file, metric, value, unit, timestamp: Date.now() });
  if (perfHistory.length > 500) perfHistory.splice(0, perfHistory.length - 500);
  savePerfHistory();
}

export function detectPerformanceRegression(file: string, metric: string): {
  regression: boolean;
  currentAvg: number;
  previousAvg: number;
  changePercent: number;
} {
  const fileMetrics = perfHistory.filter(p => p.file === file && p.metric === metric);
  if (fileMetrics.length < 4) return { regression: false, currentAvg: 0, previousAvg: 0, changePercent: 0 };

  const sorted = fileMetrics.sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted.slice(0, Math.min(5, Math.floor(sorted.length / 2)));
  const older = sorted.slice(Math.min(5, Math.floor(sorted.length / 2)));

  const currentAvg = recent.reduce((s, p) => s + p.value, 0) / recent.length;
  const previousAvg = older.reduce((s, p) => s + p.value, 0) / older.length;

  const changePercent = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
  const regression = changePercent > 20;

  return { regression, currentAvg, previousAvg, changePercent };
}

export function getPerformanceHistory(): PerformanceBenchmark[] {
  return perfHistory.slice(-100);
}

interface EvolutionVelocity {
  period: string;
  editsAttempted: number;
  editsSucceeded: number;
  editsFailed: number;
  successRate: number;
  avgComplexity: number;
  velocityScore: number;
  trend: "accelerating" | "stable" | "decelerating";
}

const velocitySnapshots: Array<{ timestamp: number; editsApplied: number; editsFailed: number; complexity: number }> = [];

export function trackEvolutionVelocity(): EvolutionVelocity {
  const state = getSelfCodeState();
  velocitySnapshots.push({
    timestamp: Date.now(),
    editsApplied: state.editsApplied,
    editsFailed: state.editsRejected,
    complexity: state.filesModified.length,
  });

  if (velocitySnapshots.length > 200) velocitySnapshots.splice(0, velocitySnapshots.length - 200);

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekSnapshots = velocitySnapshots.filter(s => s.timestamp > weekAgo);

  const editsAttempted = state.editsApplied + state.editsRejected;
  const successRate = editsAttempted > 0 ? state.editsApplied / editsAttempted : 0;

  let trend: "accelerating" | "stable" | "decelerating" = "stable";
  if (weekSnapshots.length >= 4) {
    const midpoint = Math.floor(weekSnapshots.length / 2);
    const firstHalf = weekSnapshots.slice(0, midpoint);
    const secondHalf = weekSnapshots.slice(midpoint);
    const firstRate = firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v.editsApplied, 0) / firstHalf.length : 0;
    const secondRate = secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v.editsApplied, 0) / secondHalf.length : 0;
    if (secondRate > firstRate * 1.2) trend = "accelerating";
    else if (secondRate < firstRate * 0.8) trend = "decelerating";
  }

  const velocityScore = Math.round(successRate * 100 * (trend === "accelerating" ? 1.2 : trend === "decelerating" ? 0.8 : 1));

  return {
    period: "weekly",
    editsAttempted,
    editsSucceeded: state.editsApplied,
    editsFailed: state.editsRejected,
    successRate: Math.round(successRate * 100) / 100,
    avgComplexity: state.filesModified.length,
    velocityScore: Math.min(100, velocityScore),
    trend,
  };
}

interface ArchitectureAnalysis {
  modules: Array<{ name: string; files: string[]; lineCount: number; exports: number; imports: number }>;
  largFiles: Array<{ file: string; lines: number; suggestion: string }>;
  circularDeps: Array<{ fileA: string; fileB: string }>;
  splitSuggestions: Array<{ file: string; reason: string; suggestedModules: string[] }>;
}

export function analyzeArchitecture(): ArchitectureAnalysis {
  const modules: Array<{ name: string; files: string[]; lineCount: number; exports: number; imports: number }> = [];
  const largeFiles: Array<{ file: string; lines: number; suggestion: string }> = [];
  const circularDeps: Array<{ fileA: string; fileB: string }> = [];
  const splitSuggestions: Array<{ file: string; reason: string; suggestedModules: string[] }> = [];

  const dirs = ["server", "client/src", "shared"];
  const fileDeps = new Map<string, Set<string>>();

  for (const dir of dirs) {
    const files = listProjectFiles(dir).filter(f => !f.endsWith("/") && (f.endsWith(".ts") || f.endsWith(".tsx")));
    const moduleFiles: string[] = [];
    let totalLines = 0;
    let totalExports = 0;
    let totalImports = 0;

    for (const file of files) {
      const result = readProjectFile(file);
      if ("error" in result) continue;

      const lines = result.content.split("\n").length;
      totalLines += lines;
      moduleFiles.push(file);

      const exports = (result.content.match(/^export\s+/gm) || []).length;
      const imports = (result.content.match(/^import\s+/gm) || []).length;
      totalExports += exports;
      totalImports += imports;

      const importedFiles = new Set<string>();
      const importRegex = /from\s+["']\.\/([^"']+)["']/g;
      let m;
      while ((m = importRegex.exec(result.content)) !== null) {
        const imported = path.join(path.dirname(file), m[1]).replace(/\\/g, "/");
        importedFiles.add(imported);
      }
      fileDeps.set(file, importedFiles);

      if (lines > 500) {
        largeFiles.push({
          file,
          lines,
          suggestion: lines > 1000
            ? `Split into ${Math.ceil(lines / 300)} focused modules`
            : "Consider extracting utility functions",
        });
      }

      if (lines > 800) {
        const funcMatches = result.content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g) || [];
        const funcNames = funcMatches.map(f => f.match(/(\w+)$/)?.[1]).filter(Boolean);
        if (funcNames.length > 8) {
          const groups = groupFunctions(funcNames as string[]);
          splitSuggestions.push({
            file,
            reason: `${lines} lines with ${funcNames.length} functions`,
            suggestedModules: groups,
          });
        }
      }
    }

    if (moduleFiles.length > 0) {
      modules.push({ name: dir, files: moduleFiles, lineCount: totalLines, exports: totalExports, imports: totalImports });
    }
  }

  for (const [fileA, depsA] of Array.from(fileDeps.entries())) {
    for (const dep of Array.from(depsA)) {
      const normalizedDep = dep.replace(/\.(ts|tsx|js|jsx)$/, "");
      for (const [fileB, depsB] of Array.from(fileDeps.entries())) {
        const normalizedB = fileB.replace(/\.(ts|tsx|js|jsx)$/, "");
        if (normalizedB === normalizedDep || normalizedB.endsWith(normalizedDep)) {
          const normalizedA = fileA.replace(/\.(ts|tsx|js|jsx)$/, "");
          for (const depB of Array.from(depsB)) {
            const normalizedDepB = depB.replace(/\.(ts|tsx|js|jsx)$/, "");
            if (normalizedA === normalizedDepB || normalizedA.endsWith(normalizedDepB)) {
              if (!circularDeps.some(c => (c.fileA === fileA && c.fileB === fileB) || (c.fileA === fileB && c.fileB === fileA))) {
                circularDeps.push({ fileA, fileB });
              }
            }
          }
        }
      }
    }
  }

  return { modules, largFiles: largeFiles, circularDeps, splitSuggestions };
}

function groupFunctions(names: string[]): string[] {
  const groups: Record<string, string[]> = {};
  for (const name of names) {
    const prefix = name.replace(/([A-Z])/g, "_$1").toLowerCase().split("_").filter(Boolean)[0] || "misc";
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(name);
  }
  return Object.entries(groups)
    .filter(([, fns]) => fns.length >= 2)
    .map(([prefix, fns]) => `${prefix}-utils.ts (${fns.length} functions)`);
}

interface SimulationResult {
  file: string;
  proposedChange: string;
  syntaxValid: boolean;
  importsValid: boolean;
  exportsPreserved: boolean;
  qualityBefore: number;
  qualityAfter: number;
  qualityDelta: number;
  impactedFiles: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "apply" | "review" | "reject";
  details: string[];
}

export function simulateChange(filePath: string, newContent: string, description: string): SimulationResult {
  const details: string[] = [];

  const syntaxResult = validateSyntax(newContent, filePath);
  details.push(`Syntax: ${syntaxResult.valid ? "PASS" : "FAIL - " + syntaxResult.errors.join(", ")}`);

  let importsValid = true;
  const importRegex = /from\s+["'](\.{1,2}\/[^"']+)["']/g;
  let m;
  while ((m = importRegex.exec(newContent)) !== null) {
    const importPath = m[1];
    const resolved = path.resolve(process.cwd(), path.dirname(filePath), importPath);
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
    const exists = extensions.some(ext => fs.existsSync(resolved + ext));
    if (!exists) {
      importsValid = false;
      details.push(`Import "${importPath}" may not resolve`);
    }
  }

  const existing = readProjectFile(filePath);
  let exportsPreserved = true;
  if (!("error" in existing)) {
    const oldExports = (existing.content.match(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g) || []).map(e => e.match(/(\w+)$/)?.[1]).filter(Boolean);
    const newExportsSet = new Set((newContent.match(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g) || []).map(e => e.match(/(\w+)$/)?.[1]).filter(Boolean));
    for (const exp of oldExports) {
      if (exp && !newExportsSet.has(exp)) {
        exportsPreserved = false;
        details.push(`Export "${exp}" would be removed`);
      }
    }
  }

  let qualityBefore = 50;
  if (!("error" in existing)) {
    const qBefore = scoreCodeQuality(filePath);
    if (!("error" in qBefore)) qualityBefore = qBefore.overall;
  }

  const tmpPath = filePath + ".simulation";
  let qualityAfter = qualityBefore;
  try {
    const fullTmpPath = path.join(process.cwd(), tmpPath);
    fs.writeFileSync(fullTmpPath, newContent, "utf-8");
    const qAfter = scoreCodeQuality(tmpPath);
    if (!("error" in qAfter)) qualityAfter = qAfter.overall;
    try { fs.unlinkSync(fullTmpPath); } catch {}
  } catch {}

  const qualityDelta = qualityAfter - qualityBefore;
  details.push(`Quality: ${qualityBefore} → ${qualityAfter} (${qualityDelta >= 0 ? "+" : ""}${qualityDelta})`);

  const impact = analyzeEditImpact(filePath);
  details.push(`Files referencing this: ${impact.totalReferences}`);

  let riskLevel: "low" | "medium" | "high" = "low";
  if (!syntaxResult.valid) riskLevel = "high";
  else if (!exportsPreserved || impact.totalReferences > 10) riskLevel = "high";
  else if (qualityDelta < -10 || !importsValid) riskLevel = "medium";

  let recommendation: "apply" | "review" | "reject" = "apply";
  if (riskLevel === "high") recommendation = "reject";
  else if (riskLevel === "medium") recommendation = "review";

  return {
    file: filePath,
    proposedChange: description,
    syntaxValid: syntaxResult.valid,
    importsValid,
    exportsPreserved,
    qualityBefore,
    qualityAfter,
    qualityDelta,
    impactedFiles: impact.totalReferences,
    riskLevel,
    recommendation,
    details,
  };
}

interface CodeGraphNode {
  file: string;
  exports: string[];
  imports: Array<{ source: string; specifiers: string[] }>;
  importedBy: string[];
  functions: string[];
  lineCount: number;
  category: string;
}

interface CodeKnowledgeGraph {
  nodes: CodeGraphNode[];
  edges: Array<{ from: string; to: string; type: "imports" | "exports_to" }>;
  stats: {
    totalFiles: number;
    totalFunctions: number;
    totalEdges: number;
    mostImported: string;
    mostComplex: string;
    orphanFiles: string[];
  };
  generatedAt: number;
}

export function buildCodeKnowledgeGraph(): CodeKnowledgeGraph {
  const nodes: CodeGraphNode[] = [];
  const edges: Array<{ from: string; to: string; type: "imports" | "exports_to" }> = [];
  const importCounts = new Map<string, number>();

  const allFiles = listProjectFiles(".").filter(
    f => !f.endsWith("/") && (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes("node_modules")
  );

  for (const file of allFiles) {
    const result = readProjectFile(file);
    if ("error" in result) continue;

    const content = result.content;
    const lines = content.split("\n").length;

    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
    let m;
    while ((m = exportRegex.exec(content)) !== null) {
      exports.push(m[1]);
    }

    const imports: Array<{ source: string; specifiers: string[] }> = [];
    const importRegex = /import\s+(?:(?:\{([^}]*)\}|(\w+))\s*(?:,\s*(?:\{([^}]*)\}|(\w+)))?\s*)?from\s+["']([^"']+)["']/g;
    while ((m = importRegex.exec(content)) !== null) {
      const specifiers: string[] = [];
      if (m[1]) specifiers.push(...m[1].split(",").map(s => s.trim()).filter(Boolean));
      if (m[2]) specifiers.push(m[2]);
      if (m[3]) specifiers.push(...m[3].split(",").map(s => s.trim()).filter(Boolean));
      if (m[4]) specifiers.push(m[4]);
      const source = m[5];
      imports.push({ source, specifiers });

      if (source.startsWith(".")) {
        const resolvedImport = path.join(path.dirname(file), source).replace(/\\/g, "/");
        edges.push({ from: file, to: resolvedImport, type: "imports" });
        importCounts.set(resolvedImport, (importCounts.get(resolvedImport) || 0) + 1);
      }
    }

    const functions: string[] = [];
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
    while ((m = funcRegex.exec(content)) !== null) {
      functions.push(m[1]);
    }

    let category = "other";
    if (file.startsWith("server/")) category = "server";
    else if (file.startsWith("client/src/pages/")) category = "page";
    else if (file.startsWith("client/src/components/")) category = "component";
    else if (file.startsWith("client/src/")) category = "client";
    else if (file.startsWith("shared/")) category = "shared";

    nodes.push({
      file,
      exports,
      imports,
      importedBy: [],
      functions,
      lineCount: lines,
      category,
    });
  }

  for (const edge of edges) {
    const targetNode = nodes.find(n => {
      const normalized = n.file.replace(/\.(ts|tsx|js|jsx)$/, "");
      return normalized === edge.to || normalized === edge.to.replace(/\.(ts|tsx|js|jsx)$/, "");
    });
    if (targetNode) {
      if (!targetNode.importedBy.includes(edge.from)) {
        targetNode.importedBy.push(edge.from);
      }
    }
  }

  let mostImported = "";
  let maxImports = 0;
  for (const [file, count] of Array.from(importCounts.entries())) {
    if (count > maxImports) { maxImports = count; mostImported = file; }
  }

  let mostComplex = "";
  let maxFunctions = 0;
  for (const node of nodes) {
    if (node.functions.length > maxFunctions) { maxFunctions = node.functions.length; mostComplex = node.file; }
  }

  const importedFiles = new Set(edges.map(e => e.to.replace(/\.(ts|tsx|js|jsx)$/, "")));
  const importingFiles = new Set(edges.map(e => e.from));
  const orphanFiles = nodes
    .filter(n => {
      const normalized = n.file.replace(/\.(ts|tsx|js|jsx)$/, "");
      return !importedFiles.has(normalized) && !importingFiles.has(n.file) && n.category !== "page";
    })
    .map(n => n.file);

  return {
    nodes,
    edges,
    stats: {
      totalFiles: nodes.length,
      totalFunctions: nodes.reduce((s, n) => s + n.functions.length, 0),
      totalEdges: edges.length,
      mostImported: mostImported || "N/A",
      mostComplex: mostComplex || "N/A",
      orphanFiles: orphanFiles.slice(0, 20),
    },
    generatedAt: Date.now(),
  };
}

export function getEvolutionState() {
  return {
    selfModifiableFiles: getModifiableFiles().length,
    errorPatterns: errorPatterns.length,
    refactorPlans: refactorPlans.length,
    perfBenchmarks: perfHistory.length,
    velocitySnapshots: velocitySnapshots.length,
    capabilities: [
      "self-modification (item 52)",
      "direct-self-coding (item 53)",
      "code-quality-scoring (item 54)",
      "ab-testing (item 55)",
      "cross-file-refactoring (item 56)",
      "error-pattern-database (item 57)",
      "code-review-agent (item 58)",
      "api-documentation (item 59)",
      "dependency-auto-update (item 60)",
      "performance-regression (item 61)",
      "evolution-velocity (item 62)",
      "architecture-evolution (item 63)",
      "imagination-simulation (item 64)",
      "knowledge-graph (item 65)",
    ],
  };
}

loadErrorPatterns();
loadPerfHistory();

elog("Self-Code Evolution engine initialized (Items 52-65)");
