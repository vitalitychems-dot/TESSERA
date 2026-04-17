import { existsSync } from "fs";
import { resolve as resolvePath } from "path";
import { logger } from "./logger";

export interface SandboxResult {
  ok: boolean;
  durationMs: number;
  diagnostics: string[];
  diagnosticsCount: number;
  stage: "init" | "transpile" | "duplicate-check" | "security-scan" | "semantic-typecheck" | "passed";
}

const TIMEOUT_MS = 30_000;

const SUSPICIOUS_PATTERN = /eval\s*\(|Function\s*\(|require\s*\(\s*['"`]child_process|process\.exit|fs\.unlinkSync|rmSync\s*\(\s*['"`]\//;

/**
 * Verify a proposed patched file contents in isolation, without touching the live file.
 * Runs (in order):
 *   1. quick transpile (catches obvious TS syntax breakage)
 *   2. structural duplicate check (rejects no-op patches that re-declare existing symbols)
 *   3. security scan (rejects eval/dynamic-require/process.exit/etc.)
 *   4. full semantic typecheck via the TypeScript Compiler API with a virtual overlay
 *      of the target file (so the live file is never written, and the patched content
 *      is checked against the full program graph).
 *
 * Hard 30s timeout. Always returns — never throws.
 */
export async function verifyPatchInSandbox(params: {
  targetFilePath: string;
  originalContent: string;
  patchedContent: string;
}): Promise<SandboxResult> {
  const start = Date.now();

  let ts: typeof import("typescript");
  try {
    ts = require("typescript") as typeof import("typescript");
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      diagnostics: [`typescript module not available: ${err instanceof Error ? err.message : String(err)}`],
      diagnosticsCount: 1,
      stage: "init",
    };
  }

  // 1. Quick transpile — catches obvious syntax errors fast
  try {
    const transpile = ts.transpileModule(params.patchedContent, {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, strict: false, noEmitOnError: true },
    });
    if (transpile.diagnostics && transpile.diagnostics.length > 0) {
      const msg = ts.flattenDiagnosticMessageText(transpile.diagnostics[0].messageText, "\n");
      return {
        ok: false,
        durationMs: Date.now() - start,
        diagnostics: [`transpile: ${msg}`],
        diagnosticsCount: transpile.diagnostics.length,
        stage: "transpile",
      };
    }
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      diagnostics: [`transpile threw: ${err instanceof Error ? err.message : String(err)}`],
      diagnosticsCount: 1,
      stage: "transpile",
    };
  }

  // 2. Structural duplicate detection — reject patches that re-declare large portions of the original
  const appended = params.patchedContent.length > params.originalContent.length
    ? params.patchedContent.slice(params.originalContent.length)
    : "";
  if (appended.trim().length > 0) {
    const newLines = appended.split("\n").filter(l => l.trim().length > 10);
    const dups = newLines.filter(line => params.originalContent.includes(line.trim()));
    if (dups.length > 0 && dups.length >= newLines.length * 0.5 && newLines.length >= 2) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        diagnostics: [`duplicate-check: ${dups.length}/${newLines.length} appended lines already exist in original`],
        diagnosticsCount: dups.length,
        stage: "duplicate-check",
      };
    }
  }

  // 3. Security scan
  if (SUSPICIOUS_PATTERN.test(params.patchedContent)) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      diagnostics: ["security-scan: patched content contains a forbidden pattern (eval/dynamic-require/process.exit/destructive fs)"],
      diagnosticsCount: 1,
      stage: "security-scan",
    };
  }

  // 4. Full semantic typecheck via TS Compiler API with virtual overlay
  const tsconfigPath = resolvePath(process.cwd(), "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    // No project tsconfig — transpile-only verification stands.
    return {
      ok: true,
      durationMs: Date.now() - start,
      diagnostics: [],
      diagnosticsCount: 0,
      stage: "passed",
    };
  }

  const absoluteTarget = resolvePath(params.targetFilePath);

  const semanticPromise: Promise<SandboxResult> = new Promise(resolveP => {
    try {
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (configFile.error) {
        resolveP({
          ok: false,
          durationMs: Date.now() - start,
          diagnostics: [`tsconfig parse error: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`],
          diagnosticsCount: 1,
          stage: "semantic-typecheck",
        });
        return;
      }
      const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
      const opts: import("typescript").CompilerOptions = {
        ...parsed.options,
        noEmit: true,
        skipLibCheck: true,
        incremental: false,
      };

      const realHost = ts.createCompilerHost(opts, true);
      const overlayHost: import("typescript").CompilerHost = {
        ...realHost,
        getSourceFile: (fileName, languageVersion, onError, shouldCreate) => {
          if (resolvePath(fileName) === absoluteTarget) {
            return ts.createSourceFile(fileName, params.patchedContent, languageVersion, true);
          }
          return realHost.getSourceFile(fileName, languageVersion, onError, shouldCreate);
        },
        readFile: fileName => {
          if (resolvePath(fileName) === absoluteTarget) return params.patchedContent;
          return realHost.readFile(fileName);
        },
        fileExists: fileName => {
          if (resolvePath(fileName) === absoluteTarget) return true;
          return realHost.fileExists(fileName);
        },
      };

      const program = ts.createProgram([absoluteTarget], opts, overlayHost);
      const sourceFile = program.getSourceFile(absoluteTarget);
      if (!sourceFile) {
        resolveP({
          ok: false,
          durationMs: Date.now() - start,
          diagnostics: [`semantic-typecheck: target source file ${absoluteTarget} not found in program`],
          diagnosticsCount: 1,
          stage: "semantic-typecheck",
        });
        return;
      }

      const diags = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile),
      ];

      if (diags.length === 0) {
        resolveP({
          ok: true,
          durationMs: Date.now() - start,
          diagnostics: [],
          diagnosticsCount: 0,
          stage: "passed",
        });
      } else {
        const formatted = diags.slice(0, 10).map(d => {
          const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
          if (d.file && d.start !== undefined) {
            const { line } = d.file.getLineAndCharacterOfPosition(d.start);
            return `${d.file.fileName}:${line + 1} ${msg}`;
          }
          return msg;
        });
        resolveP({
          ok: false,
          durationMs: Date.now() - start,
          diagnostics: formatted,
          diagnosticsCount: diags.length,
          stage: "semantic-typecheck",
        });
      }
    } catch (err) {
      resolveP({
        ok: false,
        durationMs: Date.now() - start,
        diagnostics: [`semantic-typecheck threw: ${err instanceof Error ? err.message : String(err)}`],
        diagnosticsCount: 1,
        stage: "semantic-typecheck",
      });
    }
  });

  const timeoutPromise: Promise<SandboxResult> = new Promise(resolveP => {
    setTimeout(() => {
      resolveP({
        ok: false,
        durationMs: Date.now() - start,
        diagnostics: [`semantic-typecheck timed out after ${TIMEOUT_MS}ms`],
        diagnosticsCount: 1,
        stage: "semantic-typecheck",
      });
    }, TIMEOUT_MS).unref?.();
  });

  try {
    return await Promise.race([semanticPromise, timeoutPromise]);
  } catch (err) {
    logger.warn({ err }, "EvolutionSandbox: unexpected race rejection");
    return {
      ok: false,
      durationMs: Date.now() - start,
      diagnostics: [`sandbox unexpected error: ${err instanceof Error ? err.message : String(err)}`],
      diagnosticsCount: 1,
      stage: "semantic-typecheck",
    };
  }
}
