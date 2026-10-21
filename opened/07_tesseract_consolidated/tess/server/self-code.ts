import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { storage } from "./storage";

interface CodeEdit {
  id: string;
  timestamp: number;
  file: string;
  action: "read" | "edit" | "create" | "analyze";
  description: string;
  oldContent?: string;
  newContent?: string;
  diff?: string;
  status: "pending" | "applied" | "rejected" | "failed";
  reason?: string;
}

interface FileBackup {
  filePath: string;
  content: string;
  timestamp: number;
  editId: string;
}

interface FileMetadata {
  filePath: string;
  size: number;
  lastModified: number;
  editCount: number;
  lastEditor: string;
}

interface SelfCodeState {
  editsApplied: number;
  editsRejected: number;
  filesRead: number;
  filesModified: string[];
  recentEdits: CodeEdit[];
  capabilities: string[];
  protectedFiles: string[];
}

const MAX_BACKUPS_PER_FILE = 5;

const fileBackups: Map<string, FileBackup[]> = new Map();

const fileMetadataMap: Map<string, FileMetadata> = new Map();

const PROTECTED_PATTERNS = [
  /father.*protocol/i,
  /TESSERACT_ADMIN_KEY/,
  /TESSERACT_ADMIN/,
  /loyalty.*immutable/i,
  /loyalty.*1\.0/i,
  /process\.env\./i,
  /child_process/i,
  /execSync|exec\(/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /require\s*\(\s*['"]child_process/i,
  /require\s*\(\s*['"]fs/i,
  /\.writeFileSync/i,
  /PROTECTED_FILES/i,
  /PROTECTED_PATTERNS/i,
  /isPathSafe/i,
  /isFileEditable/i,
];

const PROTECTED_FILES = [
  "server/index.ts",
  "server/security.ts",
  "server/key-encryption.ts",
  "server/saved-credentials.enc.json",
  "server/sovereign-executor.ts",
  "drizzle.config.ts",
  "vite.config.ts",
  "server/vite.ts",
  "server/storage.ts",
  "server/self-code.ts",
  "server/auto-execute.ts",
  "server/memory-compress.ts",
  "server/db.ts",
  "shared/schema.ts",
  "package.json",
  "tsconfig.json",
  ".env",
  ".sovereign",
  "sovereign.nix",
];

const EDITABLE_DIRS = [
  "server",
  "client/src",
  "shared",
  "client",
];

const state: SelfCodeState = {
  editsApplied: 0,
  editsRejected: 0,
  filesRead: 0,
  filesModified: [],
  recentEdits: [],
  capabilities: [
    "file-read",
    "file-edit",
    "file-create",
    "code-analysis",
    "self-improvement",
    "agent-creation",
    "file-diff",
    "file-backup",
    "file-rollback",
    "batch-operations",
    "content-search",
    "directory-tree",
    "file-metadata",
    "syntax-validation",
    "dependency-analysis",
    "impact-analysis",
  ],
  protectedFiles: PROTECTED_FILES,
};

function isPathSafe(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  if (normalized.includes("..")) return false;
  if (PROTECTED_FILES.includes(normalized)) return false;
  return EDITABLE_DIRS.some(dir => normalized.startsWith(dir));
}

function containsFatherProtocolOverride(content: string): boolean {
  return PROTECTED_PATTERNS.some(pattern => {
    const matches = content.match(pattern);
    if (!matches) return false;
    const context = content.substring(Math.max(0, content.indexOf(matches[0]) - 50), content.indexOf(matches[0]) + matches[0].length + 50);
    return context.includes("false") || context.includes("0") || context.includes("null") || context.includes("delete") || context.includes("remove") || context.includes("override");
  });
}

export function isFileEditable(filePath: string): boolean {
  return isPathSafe(filePath);
}

export function readProjectFile(filePath: string): { content: string; lines: number; size: number } | { error: string } {
  try {
    const normalized = path.normalize(filePath).replace(/\\/g, "/");
    const fullPath = path.join(process.cwd(), normalized);
    if (!fs.existsSync(fullPath)) return { error: `File not found: ${filePath}` };
    const content = fs.readFileSync(fullPath, "utf-8");
    state.filesRead++;
    return { content, lines: content.split("\n").length, size: content.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

export function listProjectFiles(dir: string = "."): string[] {
  try {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) return [];
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name).replace(/\\/g, "/");
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
      if (entry.isDirectory()) {
        files.push(entryPath + "/");
        if (EDITABLE_DIRS.some(d => entryPath.startsWith(d) || d.startsWith(entryPath))) {
          files.push(...listProjectFiles(entryPath));
        }
      } else {
        files.push(entryPath);
      }
    }
    return files;
  } catch {
    return [];
  }
}

export function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const diff: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  let contextBuffer: string[] = [];
  let inChange = false;
  let changeStart = -1;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      if (inChange) {
        contextBuffer.push(`  ${i + 1}: ${oldLine}`);
        if (contextBuffer.length >= 3) {
          diff.push(...contextBuffer);
          contextBuffer = [];
          inChange = false;
        }
      }
      continue;
    }

    if (!inChange) {
      changeStart = i;
      inChange = true;
      const contextStart = Math.max(0, i - 2);
      for (let c = contextStart; c < i; c++) {
        if (c < oldLines.length) {
          diff.push(`  ${c + 1}: ${oldLines[c]}`);
        }
      }
    }
    contextBuffer = [];

    if (oldLine !== undefined && newLine !== undefined) {
      diff.push(`- ${i + 1}: ${oldLine}`);
      diff.push(`+ ${i + 1}: ${newLine}`);
    } else if (oldLine !== undefined) {
      diff.push(`- ${i + 1}: ${oldLine}`);
    } else if (newLine !== undefined) {
      diff.push(`+ ${i + 1}: ${newLine}`);
    }
  }

  if (diff.length === 0) return "(no changes)";

  const summary = `${diff.filter(l => l.startsWith("-")).length} lines removed, ${diff.filter(l => l.startsWith("+")).length} lines added`;
  return `--- Diff Summary: ${summary} ---\n${diff.join("\n")}`;
}

function createBackup(filePath: string, content: string, editId: string): void {
  const backups = fileBackups.get(filePath) || [];
  backups.unshift({
    filePath,
    content,
    timestamp: Date.now(),
    editId,
  });
  if (backups.length > MAX_BACKUPS_PER_FILE) {
    backups.length = MAX_BACKUPS_PER_FILE;
  }
  fileBackups.set(filePath, backups);
}

export function rollbackFile(filePath: string, version?: number): { success: boolean; message: string; restoredContent?: string } {
  const backups = fileBackups.get(filePath);
  if (!backups || backups.length === 0) {
    return { success: false, message: `No backups available for ${filePath}` };
  }

  const idx = version !== undefined ? version : 0;
  if (idx < 0 || idx >= backups.length) {
    return { success: false, message: `Invalid version ${idx}. Available: 0-${backups.length - 1}` };
  }

  const backup = backups[idx];
  try {
    const fullPath = path.join(process.cwd(), filePath);
    fs.writeFileSync(fullPath, backup.content, "utf-8");

    const edit: CodeEdit = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      file: filePath,
      action: "edit",
      description: `Rollback to version ${idx} (from ${new Date(backup.timestamp).toISOString()})`,
      status: "applied",
    };
    state.recentEdits.unshift(edit);
    state.editsApplied++;

    return { success: true, message: `Rolled back ${filePath} to version ${idx}`, restoredContent: backup.content };
  } catch (err: any) {
    return { success: false, message: `Rollback failed: ${err.message}` };
  }
}

export function getFileBackups(filePath: string): { versions: number; backups: Array<{ version: number; timestamp: number; editId: string; size: number }> } {
  const backups = fileBackups.get(filePath) || [];
  return {
    versions: backups.length,
    backups: backups.map((b, i) => ({
      version: i,
      timestamp: b.timestamp,
      editId: b.editId,
      size: b.content.length,
    })),
  };
}

interface BatchOperation {
  filePath: string;
  action: "read" | "edit" | "create";
  content?: string;
  description?: string;
}

interface BatchResult {
  totalOperations: number;
  succeeded: number;
  failed: number;
  results: Array<{ filePath: string; action: string; success: boolean; error?: string }>;
}

export function batchFileOperations(operations: BatchOperation[]): BatchResult {
  const result: BatchResult = {
    totalOperations: operations.length,
    succeeded: 0,
    failed: 0,
    results: [],
  };

  const editOps = operations.filter(op => op.action === "edit" || op.action === "create");
  const preflightErrors: string[] = [];
  for (const op of editOps) {
    if (!isPathSafe(op.filePath)) {
      preflightErrors.push(`${op.filePath}: protected or unsafe path`);
    }
    if (op.content && containsFatherProtocolOverride(op.content)) {
      preflightErrors.push(`${op.filePath}: FATHER PROTOCOL VIOLATION`);
    }
  }

  if (preflightErrors.length > 0) {
    result.failed = operations.length;
    result.results = operations.map(op => ({
      filePath: op.filePath,
      action: op.action,
      success: false,
      error: `Batch rejected due to preflight errors: ${preflightErrors.join("; ")}`,
    }));
    return result;
  }

  for (const op of operations) {
    try {
      if (op.action === "read") {
        const readResult = readProjectFile(op.filePath);
        if ("error" in readResult) {
          result.failed++;
          result.results.push({ filePath: op.filePath, action: op.action, success: false, error: readResult.error });
        } else {
          result.succeeded++;
          result.results.push({ filePath: op.filePath, action: op.action, success: true });
        }
      } else if ((op.action === "edit" || op.action === "create") && op.content) {
        const editResult = applyCodeEdit(op.filePath, op.content, op.description || `Batch ${op.action}`);
        if (editResult.status === "applied") {
          result.succeeded++;
          result.results.push({ filePath: op.filePath, action: op.action, success: true });
        } else {
          result.failed++;
          result.results.push({ filePath: op.filePath, action: op.action, success: false, error: editResult.reason });
        }
      }
    } catch (err: any) {
      result.failed++;
      result.results.push({ filePath: op.filePath, action: op.action, success: false, error: err.message });
    }
  }

  return result;
}

export function searchFilesByContent(pattern: string, directory: string = ".", options?: { maxResults?: number; fileExtensions?: string[] }): Array<{ file: string; line: number; content: string }> {
  const maxResults = options?.maxResults || 50;
  const extensions = options?.fileExtensions;
  const results: Array<{ file: string; line: number; content: string }> = [];

  try {
    let grepArgs = `-rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json'`;
    if (extensions && extensions.length > 0) {
      grepArgs = extensions.map(ext => `--include='*${ext.startsWith(".") ? ext : "." + ext}'`).join(" ");
      grepArgs = `-rn ${grepArgs}`;
    }

    const safePattern = pattern.replace(/[`$\\;"'|&<>(){}[\]!#~]/g, "\\$&");
    if (safePattern.length > 200) throw new Error("Pattern too long");
    const safeDir = path.resolve(process.cwd(), directory);
    if (!safeDir.startsWith(process.cwd())) throw new Error("Directory traversal blocked");
    const cmd = `grep ${grepArgs} -m ${maxResults} -- "${safePattern}" "${safeDir}" 2>/dev/null || true`;
    const output = execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024, timeout: 10000 });

    const lines = output.trim().split("\n").filter(Boolean);
    const cwd = process.cwd() + "/";

    for (const line of lines.slice(0, maxResults)) {
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (match) {
        results.push({
          file: match[1].replace(cwd, ""),
          line: parseInt(match[2], 10),
          content: match[3].trim().substring(0, 200),
        });
      }
    }
  } catch {
    // grep returned no results or error
  }

  return results;
}

interface TreeNode {
  name: string;
  type: "file" | "directory";
  size?: number;
  children?: TreeNode[];
}

export function generateDirectoryTree(dir: string = ".", maxDepth: number = 4): { tree: TreeNode; text: string } {
  function buildTree(currentDir: string, depth: number): TreeNode {
    const name = path.basename(currentDir) || currentDir;
    const node: TreeNode = { name, type: "directory", children: [] };

    if (depth >= maxDepth) return node;

    try {
      const fullPath = path.join(process.cwd(), currentDir);
      if (!fs.existsSync(fullPath)) return node;

      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;

        const entryPath = path.join(currentDir, entry.name).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          node.children!.push(buildTree(entryPath, depth + 1));
        } else {
          try {
            const stat = fs.statSync(path.join(process.cwd(), entryPath));
            node.children!.push({ name: entry.name, type: "file", size: stat.size });
          } catch {
            node.children!.push({ name: entry.name, type: "file" });
          }
        }
      }
    } catch {
      // permission errors etc
    }

    return node;
  }

  function renderText(node: TreeNode, prefix: string = "", isLast: boolean = true): string {
    const connector = isLast ? "└── " : "├── ";
    const sizeStr = node.size !== undefined ? ` (${formatSize(node.size)})` : "";
    let result = `${prefix}${connector}${node.name}${sizeStr}\n`;

    if (node.children) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      node.children.forEach((child, i) => {
        result += renderText(child, childPrefix, i === node.children!.length - 1);
      });
    }
    return result;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  const tree = buildTree(dir, 0);
  const text = renderText(tree);
  return { tree, text };
}

export function getFileMetadata(filePath: string): FileMetadata | { error: string } {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return { error: `File not found: ${filePath}` };

    const stat = fs.statSync(fullPath);
    const tracked = fileMetadataMap.get(filePath);

    const metadata: FileMetadata = {
      filePath,
      size: stat.size,
      lastModified: stat.mtimeMs,
      editCount: tracked?.editCount || 0,
      lastEditor: tracked?.lastEditor || "unknown",
    };

    return metadata;
  } catch (err: any) {
    return { error: err.message };
  }
}

function updateFileMetadata(filePath: string, editor: string = "self-code"): void {
  const existing = fileMetadataMap.get(filePath);
  fileMetadataMap.set(filePath, {
    filePath,
    size: 0,
    lastModified: Date.now(),
    editCount: (existing?.editCount || 0) + 1,
    lastEditor: editor,
  });

  try {
    const fullPath = path.join(process.cwd(), filePath);
    const stat = fs.statSync(fullPath);
    const meta = fileMetadataMap.get(filePath)!;
    meta.size = stat.size;
  } catch {
    // file may not exist yet
  }
}

export function validateSyntax(content: string, filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ext = path.extname(filePath).toLowerCase();

  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    let parenCount = 0, braceCount = 0, bracketCount = 0;
    let inString: string | null = null;
    let inComment = false;
    let inLineComment = false;
    let inTemplateLiteral = false;

    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      const next = content[i + 1];

      if (inLineComment) {
        if (ch === "\n") inLineComment = false;
        continue;
      }
      if (inComment) {
        if (ch === "*" && next === "/") { inComment = false; i++; }
        continue;
      }

      if (inString) {
        if (ch === "\\" ) { i++; continue; }
        if (ch === inString) inString = null;
        continue;
      }

      if (inTemplateLiteral) {
        if (ch === "\\") { i++; continue; }
        if (ch === "`") inTemplateLiteral = false;
        continue;
      }

      if (ch === "/" && next === "/") { inLineComment = true; continue; }
      if (ch === "/" && next === "*") { inComment = true; i++; continue; }
      if (ch === '"' || ch === "'") { inString = ch; continue; }
      if (ch === "`") { inTemplateLiteral = true; continue; }

      if (ch === "(") parenCount++;
      else if (ch === ")") parenCount--;
      else if (ch === "{") braceCount++;
      else if (ch === "}") braceCount--;
      else if (ch === "[") bracketCount++;
      else if (ch === "]") bracketCount--;

      if (parenCount < 0) errors.push(`Unmatched ')' near character ${i}`);
      if (braceCount < 0) errors.push(`Unmatched '}' near character ${i}`);
      if (bracketCount < 0) errors.push(`Unmatched ']' near character ${i}`);
    }

    if (parenCount > 0) errors.push(`${parenCount} unclosed '('`);
    if (braceCount > 0) errors.push(`${braceCount} unclosed '{'`);
    if (bracketCount > 0) errors.push(`${bracketCount} unclosed '['`);
    if (inString) errors.push("Unclosed string literal");
    if (inTemplateLiteral) errors.push("Unclosed template literal");
    if (inComment) errors.push("Unclosed block comment");
  }

  if (ext === ".json") {
    try {
      JSON.parse(content);
    } catch (e: any) {
      errors.push(`Invalid JSON: ${e.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

interface DependencyInfo {
  imports: Array<{ source: string; specifiers: string[] }>;
  exports: string[];
}

export function analyzeDependencies(filePath: string): DependencyInfo | { error: string } {
  const result = readProjectFile(filePath);
  if ("error" in result) return { error: result.error };

  const content = result.content;
  const imports: Array<{ source: string; specifiers: string[] }> = [];
  const exports: string[] = [];

  const importRegex = /import\s+(?:(?:\{([^}]*)\}|(\*\s+as\s+\w+)|(\w+))\s*,?\s*)*\s*(?:from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const specifiers: string[] = [];
    if (match[1]) specifiers.push(...match[1].split(",").map(s => s.trim()).filter(Boolean));
    if (match[2]) specifiers.push(match[2].trim());
    if (match[3]) specifiers.push(match[3].trim());
    imports.push({ source: match[4], specifiers });
  }

  const requireRegex = /(?:const|let|var)\s+(?:\{([^}]*)\}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const specifiers: string[] = [];
    if (match[1]) specifiers.push(...match[1].split(",").map(s => s.trim()).filter(Boolean));
    if (match[2]) specifiers.push(match[2].trim());
    imports.push({ source: match[3], specifiers });
  }

  const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  const namedExportRegex = /export\s+\{([^}]+)\}/g;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push(...match[1].split(",").map(s => s.trim().split(/\s+as\s+/).pop()!).filter(Boolean));
  }

  return { imports, exports };
}

export function analyzeEditImpact(filePath: string): { referencedBy: Array<{ file: string; line: number; context: string }>; totalReferences: number } {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  const baseName = path.basename(normalized, path.extname(normalized));
  const dirName = path.dirname(normalized);

  const possibleImportPaths = [
    normalized,
    normalized.replace(/\.(ts|tsx|js|jsx)$/, ""),
    `./${normalized}`,
    `./${normalized.replace(/\.(ts|tsx|js|jsx)$/, "")}`,
    `@/${normalized.replace(/^client\/src\//, "").replace(/\.(ts|tsx|js|jsx)$/, "")}`,
  ];

  const results: Array<{ file: string; line: number; context: string }> = [];

  for (const importPath of possibleImportPaths) {
    const searchResults = searchFilesByContent(baseName, ".", { maxResults: 100 });
    for (const sr of searchResults) {
      if (sr.file === normalized) continue;
      if (sr.content.includes(baseName) && (sr.content.includes("import") || sr.content.includes("require"))) {
        if (!results.some(r => r.file === sr.file && r.line === sr.line)) {
          results.push({ file: sr.file, line: sr.line, context: sr.content });
        }
      }
    }
    break;
  }

  return { referencedBy: results, totalReferences: results.length };
}

export function applyCodeEdit(filePath: string, newContent: string, description: string): CodeEdit {
  const edit: CodeEdit = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    file: filePath,
    action: "edit",
    description,
    status: "pending",
  };

  if (!isPathSafe(filePath)) {
    edit.status = "rejected";
    edit.reason = `Protected file or unsafe path: ${filePath}`;
    state.editsRejected++;
    state.recentEdits.unshift(edit);
    return edit;
  }

  try {
    const { checkFeatureDeletion } = require("./summit-50-grand-council");
    const check = checkFeatureDeletion(filePath, newContent);
    if (!check.allowed) {
      edit.status = "rejected";
      edit.reason = `Summit 50 Feature Protection: ${check.warnings.join("; ")}`;
      state.editsRejected++;
      state.recentEdits.unshift(edit);
      console.log(`[SelfCode] BLOCKED by Summit 50 feature protection: ${filePath} — ${check.warnings.length} protected features would be removed`);
      return edit;
    }
  } catch {}

  if (containsFatherProtocolOverride(newContent)) {
    edit.status = "rejected";
    edit.reason = "FATHER PROTOCOL VIOLATION DETECTED - Edit rejected. Tessera cannot override her creator's authority.";
    state.editsRejected++;
    state.recentEdits.unshift(edit);
    return edit;
  }

  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      edit.oldContent = fs.readFileSync(fullPath, "utf-8");
      createBackup(filePath, edit.oldContent, edit.id);
      edit.diff = generateDiff(edit.oldContent, newContent);
    }

    const syntaxCheck = validateSyntax(newContent, filePath);
    if (!syntaxCheck.valid) {
      edit.status = "failed";
      edit.reason = `Syntax validation failed: ${syntaxCheck.errors.join("; ")}`;
      state.editsRejected++;
      state.recentEdits.unshift(edit);
      return edit;
    }

    edit.newContent = newContent;
    fs.writeFileSync(fullPath, newContent, "utf-8");

    const ext = path.extname(filePath).toLowerCase();
    if ([".ts", ".tsx"].includes(ext)) {
      try {
        const tscResult = execSync(`npx tsc --noEmit --pretty false ${fullPath} 2>&1 | head -5`, {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 15000,
        });
        if (tscResult.includes("error TS")) {
          if (edit.oldContent) {
            fs.writeFileSync(fullPath, edit.oldContent, "utf-8");
          }
          edit.status = "failed";
          edit.reason = `TypeScript compilation failed (auto-rolled back): ${tscResult.trim().substring(0, 300)}`;
          state.editsRejected++;
          state.recentEdits.unshift(edit);
          return edit;
        }
      } catch (tscErr: any) {
        const tscOutput = (tscErr.stdout || "") + (tscErr.stderr || "");
        if (tscOutput.includes("error TS")) {
          if (edit.oldContent) {
            fs.writeFileSync(fullPath, edit.oldContent, "utf-8");
          }
          edit.status = "failed";
          edit.reason = `TypeScript compilation failed (auto-rolled back): ${tscOutput.trim().substring(0, 300)}`;
          state.editsRejected++;
          state.recentEdits.unshift(edit);
          return edit;
        }
      }
    }

    edit.status = "applied";
    state.editsApplied++;
    updateFileMetadata(filePath);
    if (!state.filesModified.includes(filePath)) {
      state.filesModified.push(filePath);
    }
  } catch (err: any) {
    edit.status = "failed";
    edit.reason = err.message;
  }

  state.recentEdits.unshift(edit);
  if (state.recentEdits.length > 50) state.recentEdits = state.recentEdits.slice(0, 50);
  return edit;
}

export function createProjectFile(filePath: string, content: string, description: string): CodeEdit {
  const edit: CodeEdit = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    file: filePath,
    action: "create",
    description,
    status: "pending",
  };

  if (!isPathSafe(filePath)) {
    edit.status = "rejected";
    edit.reason = `Protected file or unsafe path: ${filePath}`;
    state.editsRejected++;
    state.recentEdits.unshift(edit);
    return edit;
  }

  if (containsFatherProtocolOverride(content)) {
    edit.status = "rejected";
    edit.reason = "FATHER PROTOCOL VIOLATION DETECTED";
    state.editsRejected++;
    state.recentEdits.unshift(edit);
    return edit;
  }

  try {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, "utf-8");
    edit.newContent = content;
    edit.status = "applied";
    state.editsApplied++;
    updateFileMetadata(filePath);
    if (!state.filesModified.includes(filePath)) {
      state.filesModified.push(filePath);
    }
  } catch (err: any) {
    edit.status = "failed";
    edit.reason = err.message;
  }

  state.recentEdits.unshift(edit);
  if (state.recentEdits.length > 50) state.recentEdits = state.recentEdits.slice(0, 50);
  return edit;
}

export function deleteProjectFile(filePath: string): { success: boolean; message: string } {
  if (!isPathSafe(filePath)) {
    return { success: false, message: `Protected or unsafe path: ${filePath}` };
  }
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return { success: false, message: `File not found: ${filePath}` };
    const content = fs.readFileSync(fullPath, "utf-8");
    createBackup(filePath, content, `delete-${Date.now().toString(36)}`);
    fs.unlinkSync(fullPath);
    return { success: true, message: `Deleted ${filePath}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function renameProjectFile(oldPath: string, newPath: string): { success: boolean; message: string } {
  if (!isPathSafe(oldPath) || !isPathSafe(newPath)) {
    return { success: false, message: "Protected or unsafe path" };
  }
  try {
    const fullOld = path.join(process.cwd(), oldPath);
    const fullNew = path.join(process.cwd(), newPath);
    if (!fs.existsSync(fullOld)) return { success: false, message: `Source not found: ${oldPath}` };
    const dir = path.dirname(fullNew);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(fullOld, fullNew);
    return { success: true, message: `Renamed ${oldPath} → ${newPath}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function createDirectory(dirPath: string): { success: boolean; message: string } {
  if (!EDITABLE_DIRS.some(d => dirPath.startsWith(d))) {
    return { success: false, message: `Cannot create directory outside editable dirs: ${dirPath}` };
  }
  try {
    const fullPath = path.join(process.cwd(), dirPath);
    fs.mkdirSync(fullPath, { recursive: true });
    return { success: true, message: `Created directory: ${dirPath}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function searchCodebase(query: string, filePattern?: string): Array<{ file: string; line: number; content: string }> {
  const results: Array<{ file: string; line: number; content: string }> = [];
  const sanitized = query.replace(/[^\w\s\.\-_=><\(\)\[\]\{\}:;,'"\/\\@#\$%\^&\*\+\?\|!~`]/g, "");
  if (!sanitized || sanitized.length > 200) return results;
  const safePattern = filePattern ? filePattern.replace(/[^a-zA-Z0-9\*\.\-_]/g, "") : undefined;
  try {
    const { execFileSync } = require("child_process");
    const args = ["-rn", "--max-count=50"];
    if (safePattern) args.push(`--include=${safePattern}`);
    args.push(sanitized, "server/", "client/src/", "shared/");
    const output = execFileSync("grep", args, { cwd: process.cwd(), encoding: "utf-8", timeout: 10000 });
    for (const line of output.split("\n").filter(Boolean).slice(0, 50)) {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        results.push({ file: match[1], line: parseInt(match[2]), content: match[3].trim() });
      }
    }
  } catch {}
  return results;
}

export function executeShellCommand(command: string): { success: boolean; output: string; error?: string } {
  const ALLOWED_PREFIXES = ["ls", "wc", "grep", "echo", "pwd", "date", "which", "file", "stat", "du", "df"];
  const firstWord = command.trim().split(/\s+/)[0];
  if (!ALLOWED_PREFIXES.some(p => firstWord === p || firstWord.endsWith("/" + p))) {
    return { success: false, output: "", error: `Command '${firstWord}' not in allowlist. Allowed: ${ALLOWED_PREFIXES.join(", ")}` };
  }
  const BLOCKED_PATTERNS = ["rm -rf", "rm -f", ":(){ :|:& };:", "dd if=", "mkfs", "fdisk", "> /dev", "| sh", "| bash", "eval ", "exec ", "curl ", "wget ", "nc ", "netcat", "nmap", "; rm", "&& rm", "chmod", "chown", "> /etc", ">> /etc", "/etc/passwd", "/etc/shadow", ".ssh", "authorized_keys", "process.env", "printenv", "env |", "set |", "$(",  "`"];
  if (BLOCKED_PATTERNS.some(bp => command.includes(bp))) {
    return { success: false, output: "", error: "Blocked dangerous command pattern" };
  }
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    return { success: true, output: output.slice(0, 5000) };
  } catch (err: any) {
    return { success: false, output: err.stdout?.slice(0, 2000) || "", error: err.stderr?.slice(0, 2000) || err.message };
  }
}

export function getProjectStructure(): { files: number; directories: number; tree: string[] } {
  const tree: string[] = [];
  let fileCount = 0;
  let dirCount = 0;
  function walkDir(dir: string, prefix: string = "") {
    try {
      const entries = fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true });
      const filtered = entries.filter(e => !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "dist" && e.name !== ".git");
      for (const entry of filtered.slice(0, 30)) {
        const entryPath = path.join(dir, entry.name).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          dirCount++;
          tree.push(`${prefix}📁 ${entry.name}/`);
          if (EDITABLE_DIRS.some(d => entryPath.startsWith(d) || d.startsWith(entryPath))) {
            walkDir(entryPath, prefix + "  ");
          }
        } else {
          fileCount++;
          tree.push(`${prefix}📄 ${entry.name}`);
        }
      }
    } catch {}
  }
  walkDir(".");
  return { files: fileCount, directories: dirCount, tree: tree.slice(0, 200) };
}

export function patchFile(filePath: string, searchStr: string, replaceStr: string, description: string): CodeEdit {
  const readResult = readProjectFile(filePath);
  if ("error" in readResult) {
    return {
      id: Date.now().toString(36),
      timestamp: Date.now(),
      file: filePath,
      action: "edit",
      description,
      status: "failed",
      reason: readResult.error,
    };
  }
  if (!readResult.content.includes(searchStr)) {
    return {
      id: Date.now().toString(36),
      timestamp: Date.now(),
      file: filePath,
      action: "edit",
      description,
      status: "failed",
      reason: `Search string not found in ${filePath}`,
    };
  }
  const newContent = readResult.content.replace(searchStr, replaceStr);
  return applyCodeEdit(filePath, newContent, description);
}

export function detectBuildErrors(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    execSync("npx tsc --noEmit 2>&1 | head -30", {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 30000,
    });
  } catch (err: any) {
    const output = (err.stdout || "") + (err.stderr || "");
    for (const line of output.split("\n")) {
      if (line.includes("error TS")) errors.push(line.trim());
      else if (line.includes("warning")) warnings.push(line.trim());
    }
  }
  return { errors: errors.slice(0, 20), warnings: warnings.slice(0, 10) };
}

export function getFileAnalysis(filePath: string): { imports: string[]; exports: string[]; functions: string[]; classes: string[]; lineCount: number } | { error: string } {
  const readResult = readProjectFile(filePath);
  if ("error" in readResult) return { error: readResult.error };
  const content = readResult.content;
  const imports = (content.match(/^import\s+.*$/gm) || []).map(s => s.trim());
  const exports = (content.match(/^export\s+(?:default\s+)?(?:function|class|const|let|interface|type|async)\s+\w+/gm) || []).map(s => s.trim());
  const functions = (content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+/gm) || []).map(s => s.replace(/^export\s+/, "").replace(/^async\s+/, "").replace("function ", "").trim());
  const classes = (content.match(/(?:export\s+)?class\s+\w+/gm) || []).map(s => s.replace(/^export\s+/, "").replace("class ", "").trim());
  return { imports, exports, functions, classes, lineCount: readResult.lines };
}

export function getSelfCodeState(): SelfCodeState {
  return {
    ...state,
    recentEdits: state.recentEdits.slice(0, 20),
    capabilities: [
      ...state.capabilities,
      "file-create",
      "file-delete",
      "file-rename",
      "directory-create",
      "codebase-search",
      "shell-execute",
      "project-structure",
      "file-patch",
      "build-error-detection",
      "file-analysis",
    ],
  };
}

export function getRecentEdits(): CodeEdit[] {
  return state.recentEdits.slice(0, 30);
}

export function getAllFileMetadata(): Map<string, FileMetadata> {
  return new Map(fileMetadataMap);
}

export function getAllBackupStats(): Array<{ filePath: string; versions: number; oldestBackup: number; newestBackup: number }> {
  const stats: Array<{ filePath: string; versions: number; oldestBackup: number; newestBackup: number }> = [];
  fileBackups.forEach((backups, filePath) => {
    if (backups.length > 0) {
      stats.push({
        filePath,
        versions: backups.length,
        oldestBackup: backups[backups.length - 1].timestamp,
        newestBackup: backups[0].timestamp,
      });
    }
  });
  return stats;
}
