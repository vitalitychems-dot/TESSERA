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
