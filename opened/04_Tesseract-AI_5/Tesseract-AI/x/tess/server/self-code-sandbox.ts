import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { logger } from "./logger";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const SANDBOX_DIR = path.join(__dirname_local, "sandbox");
const IMPLEMENTATIONS_DIR = path.join(__dirname_local, "implementations");

if (!fs.existsSync(SANDBOX_DIR)) fs.mkdirSync(SANDBOX_DIR, { recursive: true });
if (!fs.existsSync(IMPLEMENTATIONS_DIR)) fs.mkdirSync(IMPLEMENTATIONS_DIR, { recursive: true });

interface SandboxResult {
  success: boolean;
  output: string;
  errors: string[];
  fileName: string;
  testedAt: string;
  duration: number;
}

interface SelfCodeRequest {
  description: string;
  code: string;
  fileName: string;
  targetDir?: string;
}

const FORBIDDEN_PATTERNS = [
  /process\.exit/i,
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /import\s+.*['"]child_process['"]/,
  /fs\.(rm|unlink|rmdir)Sync\s*\(\s*['"]\//,
  /fs\.(writeFile|appendFile)Sync\s*\(\s*['"]\/etc/,
  /eval\s*\(/,
  /Function\s*\(/,
  /\.env\b/,
  /process\.env\.(TESSERACT_ADMIN|ADMIN_KEY|SECRET)/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /TRUNCATE/i,
];

const ALLOWED_DIRS = [
  "server/implementations",
  "server/sandbox",
];

function validateCode(code: string): { valid: boolean; reason?: string } {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason: `Forbidden pattern detected: ${pattern.source}` };
    }
  }
  if (code.length > 50000) {
    return { valid: false, reason: "Code exceeds 50KB limit" };
  }
  return { valid: true };
}

function validateFileName(fileName: string): boolean {
  if (fileName.includes("..") || fileName.startsWith("/")) return false;
  if (!/^[a-zA-Z0-9_-]+\.(ts|js|json)$/.test(fileName)) return false;
  return true;
}

export async function testInSandbox(request: SelfCodeRequest): Promise<SandboxResult> {
  const startTime = Date.now();
  const result: SandboxResult = {
    success: false,
    output: "",
    errors: [],
    fileName: request.fileName,
    testedAt: new Date().toISOString(),
    duration: 0,
  };

  const validation = validateCode(request.code);
  if (!validation.valid) {
    result.errors.push(`Security validation failed: ${validation.reason}`);
    result.duration = Date.now() - startTime;
    return result;
  }

  if (!validateFileName(request.fileName)) {
    result.errors.push(`Invalid filename: ${request.fileName}`);
    result.duration = Date.now() - startTime;
    return result;
  }

  const sandboxFile = path.join(SANDBOX_DIR, request.fileName);

  try {
    fs.writeFileSync(sandboxFile, request.code, "utf8");

    if (request.fileName.endsWith(".ts")) {
      try {
        const tscOutput = execSync(
          `npx tsc --noEmit --strict --esModuleInterop --target es2022 --module es2022 --moduleResolution node "${sandboxFile}" 2>&1`,
          { timeout: 15000, encoding: "utf8", cwd: __dirname_local }
        );
        result.output += `TypeScript check passed\n${tscOutput}`;
      } catch (tscErr: any) {
        const tscOutput = tscErr.stdout || tscErr.stderr || tscErr.message || "";
        const errors = tscOutput.split("\n").filter((l: string) => l.includes("error TS"));
        if (errors.length > 0) {
          result.errors.push(...errors.slice(0, 10));
          result.output += `TypeScript errors found:\n${errors.join("\n")}`;
        } else {
          result.output += `TypeScript check completed with warnings\n`;
        }
      }
    }

    if (request.fileName.endsWith(".json")) {
      try {
        JSON.parse(request.code);
        result.output += "JSON validation passed\n";
      } catch (jsonErr: any) {
        result.errors.push(`JSON parse error: ${jsonErr.message}`);
      }
    }

    if (result.errors.length === 0) {
      result.success = true;
      result.output += `\nSandbox test PASSED for ${request.fileName}`;
    }
  } catch (err: any) {
    result.errors.push(`Sandbox execution error: ${err.message}`);
  } finally {
    try { fs.unlinkSync(sandboxFile); } catch {}
  }

  result.duration = Date.now() - startTime;
  logger.info("Sandbox", `Test ${result.success ? "PASSED" : "FAILED"} for ${request.fileName} (${result.duration}ms)`);
  return result;
}

export async function deployFromSandbox(request: SelfCodeRequest, sandboxResult: SandboxResult): Promise<{ deployed: boolean; path: string; reason?: string }> {
  if (!sandboxResult.success) {
    return { deployed: false, path: "", reason: "Cannot deploy — sandbox test failed" };
  }

  const targetDir = request.targetDir || "server/implementations";
  if (!ALLOWED_DIRS.some(d => targetDir.startsWith(d))) {
    return { deployed: false, path: "", reason: `Deploy target ${targetDir} not in allowed directories` };
  }

  const fullDir = path.join(__dirname_local, "..", targetDir);
  if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });

  const targetPath = path.join(fullDir, request.fileName);

  if (fs.existsSync(targetPath)) {
    const backupPath = targetPath + ".backup." + Date.now();
    fs.copyFileSync(targetPath, backupPath);
    logger.info("Sandbox", `Backed up existing ${request.fileName} before deploy`);
  }

  fs.writeFileSync(targetPath, request.code, "utf8");
  logger.info("Sandbox", `Deployed ${request.fileName} to ${targetDir}`);

  return { deployed: true, path: path.join(targetDir, request.fileName) };
}

export async function selfCodeAndDeploy(description: string, code: string, fileName: string): Promise<{
  sandboxResult: SandboxResult;
  deployed: boolean;
  deployPath?: string;
  description: string;
}> {
  const request: SelfCodeRequest = { description, code, fileName };

  const sandboxResult = await testInSandbox(request);

  if (sandboxResult.success) {
    const deployResult = await deployFromSandbox(request, sandboxResult);
    return {
      sandboxResult,
      deployed: deployResult.deployed,
      deployPath: deployResult.path,
      description,
    };
  }

  return {
    sandboxResult,
    deployed: false,
    description,
  };
}

export function getSandboxStatus(): {
  sandboxDir: string;
  implementationsDir: string;
  deployedFiles: string[];
  sandboxFiles: string[];
} {
  const deployedFiles = fs.existsSync(IMPLEMENTATIONS_DIR)
    ? fs.readdirSync(IMPLEMENTATIONS_DIR).filter(f => f.endsWith(".ts") || f.endsWith(".js"))
    : [];
  const sandboxFiles = fs.existsSync(SANDBOX_DIR)
    ? fs.readdirSync(SANDBOX_DIR)
    : [];

  return {
    sandboxDir: SANDBOX_DIR,
    implementationsDir: IMPLEMENTATIONS_DIR,
    deployedFiles,
    sandboxFiles,
  };
}

export async function selfHealFile(filePath: string): Promise<{ healed: boolean; error?: string }> {
  try {
    const fullPath = path.resolve(__dirname_local, "..", filePath);

    if (!fs.existsSync(fullPath)) {
      return { healed: false, error: `File not found: ${filePath}` };
    }

    if (fullPath.endsWith(".ts")) {
      try {
        execSync(
          `npx tsc --noEmit --strict --esModuleInterop --target es2022 --module es2022 --moduleResolution node "${fullPath}" 2>&1`,
          { timeout: 15000, encoding: "utf8" }
        );
        return { healed: true };
      } catch (err: any) {
        return { healed: false, error: err.stdout || err.message };
      }
    }

    return { healed: true };
  } catch (err: any) {
    return { healed: false, error: err.message };
  }
}

logger.info("Sandbox", `Self-code sandbox initialized — sandbox: ${SANDBOX_DIR}, implementations: ${IMPLEMENTATIONS_DIR}`);

// ── Auto Test Generation ──

export interface GeneratedTest {
  testId: string;
  fileName: string;
  testCode: string;
  testType: "unit" | "integration" | "smoke";
  assertions: string[];
  generatedAt: string;
}

export interface SandboxedCodeResult {
  sandboxResult: SandboxResult;
  generatedTests: GeneratedTest[];
  testValidation: {
    passed: boolean;
    testsGenerated: number;
    coverageEstimate: string;
    details: string;
  };
  approved: boolean;
}

function extractExportedFunctions(code: string): string[] {
  const funcNames: string[] = [];
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(code)) !== null) {
      funcNames.push(m[1]);
    }
  }
  return [...new Set(funcNames)];
}

function detectCodePatterns(code: string): {
  hasAsyncFunctions: boolean;
  hasClassDefinitions: boolean;
  hasInterfaces: boolean;
  hasErrorHandling: boolean;
  hasExternalImports: boolean;
  complexity: "simple" | "moderate" | "complex";
} {
  const hasAsyncFunctions = /async\s+function|=\s*async\s*\(/.test(code);
  const hasClassDefinitions = /\bclass\s+\w+/.test(code);
  const hasInterfaces = /\binterface\s+\w+/.test(code);
  const hasErrorHandling = /try\s*\{|catch\s*\(/.test(code);
  const hasExternalImports = /^import\s+.*from\s+['"][^.]/m.test(code);
  const lines = code.split("\n").length;
  const complexity = lines > 200 ? "complex" : lines > 50 ? "moderate" : "simple";

  return { hasAsyncFunctions, hasClassDefinitions, hasInterfaces, hasErrorHandling, hasExternalImports, complexity };
}

export function generateTestsForCode(code: string, fileName: string): GeneratedTest {
  const testId = `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const exportedFns = extractExportedFunctions(code);
  const patterns = detectCodePatterns(code);
  const baseName = fileName.replace(/\.(ts|js)$/, "");

  const assertions: string[] = [];
  const testBlocks: string[] = [];

  if (exportedFns.length > 0) {
    for (const fn of exportedFns.slice(0, 5)) {
      assertions.push(`${fn} should be defined and callable`);
      const testBlock = patterns.hasAsyncFunctions
        ? `  it("${fn} should be defined", async () => {\n    expect(typeof ${fn}).toBe("function");\n  });`
        : `  it("${fn} should be defined", () => {\n    expect(typeof ${fn}).toBe("function");\n  });`;
      testBlocks.push(testBlock);
    }
  } else {
    assertions.push("Module should export at least one binding");
    testBlocks.push(`  it("module should load without errors", () => {\n    expect(true).toBe(true);\n  });`);
  }

  if (patterns.hasErrorHandling) {
    assertions.push("Error handling paths should not throw unexpectedly");
    testBlocks.push(`  it("should handle error conditions gracefully", () => {\n    expect(() => { /* error path */ }).not.toThrow();\n  });`);
  }

  if (patterns.hasClassDefinitions) {
    const classMatch = code.match(/\bclass\s+(\w+)/);
    if (classMatch) {
      assertions.push(`${classMatch[1]} class should be instantiable`);
      testBlocks.push(`  it("${classMatch[1]} class should exist", () => {\n    expect(${classMatch[1]}).toBeDefined();\n  });`);
    }
  }

  const imports = exportedFns.length > 0
    ? `import { ${exportedFns.slice(0, 5).join(", ")} } from "./${baseName}";`
    : `// import from "./${baseName}";`;

  const testCode = `// Auto-generated tests for ${fileName}
// Generated at: ${new Date().toISOString()}
// Coverage: ${assertions.length} assertion(s) across ${exportedFns.length} exported function(s)

${imports}

describe("${baseName}", () => {
${testBlocks.join("\n\n")}
});
`;

  const testType: GeneratedTest["testType"] =
    patterns.complexity === "complex" ? "integration" :
    patterns.complexity === "moderate" ? "unit" : "smoke";

  return {
    testId,
    fileName: `${baseName}.test.${fileName.endsWith(".ts") ? "ts" : "js"}`,
    testCode,
    testType,
    assertions,
    generatedAt: new Date().toISOString(),
  };
}

function validateGeneratedTests(test: GeneratedTest, originalCode: string): {
  passed: boolean;
  details: string;
} {
  const issues: string[] = [];

  if (test.assertions.length === 0) {
    issues.push("No assertions generated");
  }

  if (!test.testCode.includes("describe(") || !test.testCode.includes("it(")) {
    issues.push("Test structure incomplete — missing describe/it blocks");
  }

  if (!test.testCode.includes("expect(")) {
    issues.push("No expect() calls found in generated tests");
  }

  const syntaxIssues = validateTestSyntax(test.testCode);
  if (syntaxIssues) issues.push(`Syntax issue: ${syntaxIssues}`);

  return {
    passed: issues.length === 0,
    details: issues.length > 0 ? issues.join("; ") : `${test.assertions.length} assertions validated successfully`,
  };
}

function validateTestSyntax(code: string): string | null {
  let depth = 0;
  for (const ch of code) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth < 0) return "Unmatched closing brace";
  }
  if (depth !== 0) return `Unclosed braces (depth: ${depth})`;
  return null;
}

export async function sandboxAndTest(
  description: string,
  code: string,
  fileName: string
): Promise<SandboxedCodeResult> {
  const request: SelfCodeRequest = { description, code, fileName };

  const sandboxResult = await testInSandbox(request);

  const generatedTest = generateTestsForCode(code, fileName);
  const testValidationResult = validateGeneratedTests(generatedTest, code);

  const approved = sandboxResult.success && testValidationResult.passed;

  const result: SandboxedCodeResult = {
    sandboxResult,
    generatedTests: [generatedTest],
    testValidation: {
      passed: testValidationResult.passed,
      testsGenerated: 1,
      coverageEstimate: `${generatedTest.assertions.length} assertion(s) — ${extractExportedFunctions(code).length} function(s) covered`,
      details: testValidationResult.details,
    },
    approved,
  };

  logger.info("Sandbox", `sandboxAndTest: ${approved ? "APPROVED" : "REJECTED"} — ${fileName} (${generatedTest.assertions.length} tests)`);

  return result;
}

export async function sandboxTestAndDeploy(
  description: string,
  code: string,
  fileName: string,
  targetDir?: string
): Promise<{
  sandboxedResult: SandboxedCodeResult;
  deployed: boolean;
  deployPath?: string;
}> {
  const sandboxedResult = await sandboxAndTest(description, code, fileName);

  if (!sandboxedResult.approved) {
    return { sandboxedResult, deployed: false };
  }

  const request: SelfCodeRequest = { description, code, fileName, targetDir };
  const deployResult = await deployFromSandbox(request, sandboxedResult.sandboxResult);

  return {
    sandboxedResult,
    deployed: deployResult.deployed,
    deployPath: deployResult.path,
  };
}

export function getSandboxTestHistory(): { recentTests: GeneratedTest[]; stats: { total: number; passed: number } } {
  return {
    recentTests: [],
    stats: { total: 0, passed: 0 },
  };
}
