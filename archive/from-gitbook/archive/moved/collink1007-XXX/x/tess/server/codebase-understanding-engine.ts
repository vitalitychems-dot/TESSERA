/**
 * Codebase Understanding Engine — Real AST Implementation
 * Parses project TypeScript/JS files using the TypeScript compiler API
 * to provide structural awareness: functions, classes, imports, dependencies.
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const log = (msg: string) => console.log(`[CodebaseEngine] ${msg}`);

export interface FunctionSignature {
  name: string;
  parameters: Array<{ name: string; type: string }>;
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  line: number;
}

export interface ClassDefinition {
  name: string;
  methods: FunctionSignature[];
  properties: string[];
  isExported: boolean;
  extends?: string;
  implements: string[];
  line: number;
}

export interface ImportInfo {
  from: string;
  named: string[];
  default?: string;
  isRelative: boolean;
  isTypeOnly: boolean;
}

export interface FileAnalysis {
  filePath: string;
  relativePath: string;
  functions: FunctionSignature[];
  classes: ClassDefinition[];
  imports: ImportInfo[];
  exports: string[];
  linesOfCode: number;
  analyzedAt: number;
  hasErrors: boolean;
  errorCount: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  importedSymbols: string[];
}

export interface ProjectStructure {
  files: FileAnalysis[];
  dependencyGraph: DependencyEdge[];
  totalFiles: number;
  totalFunctions: number;
  totalClasses: number;
  totalLines: number;
  topImports: Array<{ module: string; count: number }>;
  mostComplexFiles: Array<{ path: string; functions: number; classes: number }>;
  analyzedAt: number;
}

const analysisCache = new Map<string, FileAnalysis>();
let lastFullAnalysis: ProjectStructure | null = null;
let lastAnalysisTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getTypeString(node: ts.TypeNode | undefined, checker?: ts.TypeChecker): string {
  if (!node) return "unknown";
  return node.getText ? node.getText() : "unknown";
}

function extractFunctionSignature(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
  isExported: boolean = false
): FunctionSignature {
  const name = (node as ts.FunctionDeclaration | ts.MethodDeclaration).name?.getText(sourceFile) || "anonymous";
  const isAsync = !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
  const params = node.parameters.map(p => ({
    name: p.name.getText(sourceFile),
    type: p.type ? getTypeString(p.type) : "any",
  }));
  const returnType = node.type ? getTypeString(node.type) : "void";
  const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;

  return { name, parameters: params, returnType, isAsync, isExported, line };
}

function analyzeFile(filePath: string): FileAnalysis {
  const cached = analysisCache.get(filePath);
  if (cached && Date.now() - cached.analyzedAt < CACHE_TTL_MS) return cached;

  const relativePath = path.relative(process.cwd(), filePath);
  const analysis: FileAnalysis = {
    filePath,
    relativePath,
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    linesOfCode: 0,
    analyzedAt: Date.now(),
    hasErrors: false,
    errorCount: 0,
  };

  try {
    const sourceCode = fs.readFileSync(filePath, "utf-8");
    analysis.linesOfCode = sourceCode.split("\n").length;

    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const isExported = !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
        analysis.functions.push(extractFunctionSignature(node, sourceFile, isExported));
        if (isExported) analysis.exports.push(node.name.getText(sourceFile));
      }

      else if (ts.isClassDeclaration(node) && node.name) {
        const isExported = !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
        const className = node.name.getText(sourceFile);
        const extClause = node.heritageClauses?.find(h => h.token === ts.SyntaxKind.ExtendsKeyword);
        const implClause = node.heritageClauses?.find(h => h.token === ts.SyntaxKind.ImplementsKeyword);
        const methods: FunctionSignature[] = [];
        const properties: string[] = [];

        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            methods.push(extractFunctionSignature(member, sourceFile, isExported));
          } else if (ts.isPropertyDeclaration(member) && member.name) {
            properties.push(member.name.getText(sourceFile));
          }
        }

        analysis.classes.push({
          name: className,
          methods,
          properties,
          isExported,
          extends: extClause?.types[0]?.expression?.getText(sourceFile),
          implements: implClause?.types.map(t => t.expression?.getText(sourceFile) || "") || [],
          line: sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
        });

        if (isExported) analysis.exports.push(className);
      }

      else if (ts.isImportDeclaration(node)) {
        const moduleSpec = (node.moduleSpecifier as ts.StringLiteral).text;
        const isRelative = moduleSpec.startsWith(".");
        const isTypeOnly = !!(node.importClause?.isTypeOnly);
        const named: string[] = [];
        let defaultImport: string | undefined;

        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            named.push(element.name.getText(sourceFile));
          }
        }

        if (node.importClause?.name) {
          defaultImport = node.importClause.name.getText(sourceFile);
        }

        if (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
          named.push("* as " + node.importClause.namedBindings.name.getText(sourceFile));
        }

        analysis.imports.push({
          from: moduleSpec,
          named,
          default: defaultImport,
          isRelative,
          isTypeOnly,
        });
      }

      else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const elem of node.exportClause.elements) {
            analysis.exports.push(elem.name.getText(sourceFile));
          }
        }
      }

      else if (ts.isVariableStatement(node)) {
        const isExported = !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
        if (isExported) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              analysis.exports.push(decl.name.getText(sourceFile));
            }
            if (decl.initializer && (
              ts.isArrowFunction(decl.initializer) ||
              ts.isFunctionExpression(decl.initializer)
            )) {
              const name = ts.isIdentifier(decl.name) ? decl.name.getText(sourceFile) : "anonymous";
              const sig = extractFunctionSignature(decl.initializer, sourceFile, isExported);
              sig.name = name;
              analysis.functions.push(sig);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    const diagnostics = ts.createProgram([filePath], { strict: false, noEmit: true, allowJs: true })
      .getSyntacticDiagnostics(sourceFile);
    analysis.errorCount = diagnostics.length;
    analysis.hasErrors = diagnostics.length > 0;

  } catch (err: any) {
    analysis.hasErrors = true;
    analysis.errorCount = 1;
  }

  analysisCache.set(filePath, analysis);
  return analysis;
}

function buildDependencyGraph(files: FileAnalysis[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const fileMap = new Map<string, string>();

  for (const f of files) {
    fileMap.set(f.relativePath, f.filePath);
    const base = path.basename(f.filePath, path.extname(f.filePath));
    fileMap.set(base, f.filePath);
  }

  for (const f of files) {
    for (const imp of f.imports) {
      if (!imp.isRelative) continue;

      const resolved = path.resolve(path.dirname(f.filePath), imp.from);
      const candidates = [
        resolved,
        resolved + ".ts",
        resolved + ".tsx",
        resolved + ".js",
        path.join(resolved, "index.ts"),
        path.join(resolved, "index.tsx"),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const toRelative = path.relative(process.cwd(), candidate);
          edges.push({
            from: f.relativePath,
            to: toRelative,
            importedSymbols: [...imp.named, ...(imp.default ? [imp.default] : [])],
          });
          break;
        }
      }
    }
  }

  return edges;
}

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache", "coverage", "__pycache__"]);
const IGNORED_FILE_SUFFIXES = [".d.ts", ".test.ts", ".spec.ts", ".min.js"];

function collectTsFilesRecursive(dir: string, results: string[] = [], depth = 0, maxDepth = 4): string[] {
  if (depth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          collectTsFilesRecursive(path.join(dir, entry.name), results, depth + 1, maxDepth);
        }
      } else if (entry.isFile()) {
        const name = entry.name;
        const isTs = name.endsWith(".ts") || name.endsWith(".tsx");
        if (isTs && !IGNORED_FILE_SUFFIXES.some(s => name.endsWith(s))) {
          results.push(path.join(dir, name));
        }
      }
    }
  } catch {}
  return results;
}

function getServerFiles(): string[] {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "server"),
    path.join(cwd, "src"),
    path.join(cwd, "shared"),
    path.join(cwd, "lib"),
  ].filter(d => fs.existsSync(d));

  if (candidates.length === 0) return [];

  const files: string[] = [];
  for (const dir of candidates) {
    collectTsFilesRecursive(dir, files, 0, 3);
  }
  return files;
}

export function analyzeProjectStructure(options?: {
  maxFiles?: number;
  includeClient?: boolean;
  forceRefresh?: boolean;
}): ProjectStructure {
  const now = Date.now();
  if (!options?.forceRefresh && lastFullAnalysis && now - lastAnalysisTime < CACHE_TTL_MS) {
    return lastFullAnalysis;
  }

  log("Starting project structure analysis...");
  const startTime = Date.now();

  const filePaths = getServerFiles().slice(0, options?.maxFiles || 80);
  const files: FileAnalysis[] = [];

  for (const fp of filePaths) {
    try {
      files.push(analyzeFile(fp));
    } catch {}
  }

  const dependencyGraph = buildDependencyGraph(files);

  const importCounts = new Map<string, number>();
  for (const f of files) {
    for (const imp of f.imports) {
      if (!imp.isRelative) {
        const count = importCounts.get(imp.from) || 0;
        importCounts.set(imp.from, count + 1);
      }
    }
  }

  const topImports = Array.from(importCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([module, count]) => ({ module, count }));

  const mostComplexFiles = files
    .map(f => ({ path: f.relativePath, functions: f.functions.length, classes: f.classes.length }))
    .sort((a, b) => (b.functions + b.classes * 3) - (a.functions + a.classes * 3))
    .slice(0, 10);

  const structure: ProjectStructure = {
    files,
    dependencyGraph,
    totalFiles: files.length,
    totalFunctions: files.reduce((s, f) => s + f.functions.length, 0),
    totalClasses: files.reduce((s, f) => s + f.classes.length, 0),
    totalLines: files.reduce((s, f) => s + f.linesOfCode, 0),
    topImports,
    mostComplexFiles,
    analyzedAt: now,
  };

  lastFullAnalysis = structure;
  lastAnalysisTime = now;

  const elapsed = Date.now() - startTime;
  log(`Analysis complete: ${files.length} files, ${structure.totalFunctions} functions, ${structure.totalClasses} classes in ${elapsed}ms`);

  return structure;
}

export function analyzeSpecificFile(filePath: string): FileAnalysis | null {
  try {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(abs)) return null;
    return analyzeFile(abs);
  } catch {
    return null;
  }
}

export function findFunctionDefinition(functionName: string): Array<{ file: string; signature: FunctionSignature }> {
  const structure = analyzeProjectStructure();
  const results: Array<{ file: string; signature: FunctionSignature }> = [];

  for (const f of structure.files) {
    for (const fn of f.functions) {
      if (fn.name === functionName || fn.name.includes(functionName)) {
        results.push({ file: f.relativePath, signature: fn });
      }
    }
    for (const cls of f.classes) {
      for (const method of cls.methods) {
        if (method.name === functionName || method.name.includes(functionName)) {
          results.push({ file: f.relativePath, signature: method });
        }
      }
    }
  }

  return results;
}

export function getDependencyChain(filePath: string, depth: number = 3): string[] {
  const structure = analyzeProjectStructure();
  const relative = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;

  const visited = new Set<string>();
  const queue = [relative];
  const chain: string[] = [];
  let currentDepth = 0;

  while (queue.length > 0 && currentDepth < depth) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    chain.push(current);

    const deps = structure.dependencyGraph
      .filter(e => e.from === current)
      .map(e => e.to);

    queue.push(...deps);
    currentDepth++;
  }

  return chain;
}

export function getImpactAnalysis(filePath: string): {
  directImporters: string[];
  transitiveImporters: string[];
  totalImpact: number;
} {
  const structure = analyzeProjectStructure();
  const relative = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;

  const directImporters = structure.dependencyGraph
    .filter(e => e.to === relative)
    .map(e => e.from);

  const visited = new Set<string>(directImporters);
  const transitiveQueue = [...directImporters];
  const transitiveImporters: string[] = [];

  while (transitiveQueue.length > 0) {
    const current = transitiveQueue.shift()!;
    const parents = structure.dependencyGraph
      .filter(e => e.to === current && !visited.has(e.from))
      .map(e => e.from);

    for (const p of parents) {
      visited.add(p);
      transitiveImporters.push(p);
      transitiveQueue.push(p);
    }
  }

  return {
    directImporters,
    transitiveImporters,
    totalImpact: directImporters.length + transitiveImporters.length,
  };
}

export function clearAnalysisCache(): void {
  analysisCache.clear();
  lastFullAnalysis = null;
  lastAnalysisTime = 0;
  log("Analysis cache cleared");
}

log("Codebase Understanding Engine initialized — TypeScript AST analysis ready");
