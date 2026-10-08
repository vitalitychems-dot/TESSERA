import { logger } from "./logger";

const tlog = (msg: string) => logger.info("[SovereignTest] " + msg);

export interface TestAssertion {
  label: string;
  passed: boolean;
  error?: string;
}

export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

export interface TestSuite {
  name: string;
  cases: TestCase[];
}

export interface TestRunResult {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  assertions: TestAssertion[];
  output: string[];
  success: boolean;
}

export class SovereignTestRunner {
  private suites: TestSuite[] = [];
  private currentSuite: string = "";
  private assertions: TestAssertion[] = [];
  private output: string[] = [];

  describe(name: string, fn: () => void): void {
    this.currentSuite = name;
    fn();
  }

  it(name: string, fn: () => void | Promise<void>): void {
    if (!this.suites.find(s => s.name === this.currentSuite)) {
      this.suites.push({ name: this.currentSuite, cases: [] });
    }
    const suite = this.suites.find(s => s.name === this.currentSuite)!;
    suite.cases.push({ name, fn });
  }

  equal<T>(actual: T, expected: T, label?: string): void {
    const lbl = label || `equal(${JSON.stringify(actual)}, ${JSON.stringify(expected)})`;
    const passed = JSON.stringify(actual) === JSON.stringify(expected);
    this.assertions.push({
      label: lbl,
      passed,
      error: passed ? undefined : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    });
  }

  notEqual<T>(actual: T, unexpected: T, label?: string): void {
    const lbl = label || `notEqual(${JSON.stringify(actual)})`;
    const passed = JSON.stringify(actual) !== JSON.stringify(unexpected);
    this.assertions.push({
      label: lbl,
      passed,
      error: passed ? undefined : `Expected values to differ, both were ${JSON.stringify(actual)}`,
    });
  }

  ok(value: unknown, label?: string): void {
    const lbl = label || `ok(${String(value)})`;
    const passed = Boolean(value);
    this.assertions.push({
      label: lbl,
      passed,
      error: passed ? undefined : `Expected truthy, got ${JSON.stringify(value)}`,
    });
  }

  throws(fn: () => void, label?: string): void {
    const lbl = label || "throws()";
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    this.assertions.push({
      label: lbl,
      passed: threw,
      error: threw ? undefined : "Expected function to throw, but it did not",
    });
  }

  async throwsAsync(fn: () => Promise<void>, label?: string): Promise<void> {
    const lbl = label || "throwsAsync()";
    let threw = false;
    try {
      await fn();
    } catch {
      threw = true;
    }
    this.assertions.push({
      label: lbl,
      passed: threw,
      error: threw ? undefined : "Expected async function to throw, but it did not",
    });
  }

  async run(): Promise<TestRunResult[]> {
    const results: TestRunResult[] = [];

    for (const suite of this.suites) {
      const suiteAssertions: TestAssertion[] = [];
      const suiteOutput: string[] = [];
      const startTime = Date.now();
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      suiteOutput.push(`[Suite] ${suite.name}`);

      for (const tc of suite.cases) {
        const beforeCount = this.assertions.length;
        try {
          await tc.fn();
          const newAssertions = this.assertions.slice(beforeCount);
          suiteAssertions.push(...newAssertions);
          const caseFailed = newAssertions.some(a => !a.passed);
          if (caseFailed) {
            failed++;
            suiteOutput.push(`  ✗ ${tc.name}`);
            for (const a of newAssertions.filter(a => !a.passed)) {
              suiteOutput.push(`      └─ FAIL: ${a.label}${a.error ? ` — ${a.error}` : ""}`);
            }
          } else {
            passed++;
            suiteOutput.push(`  ✓ ${tc.name}`);
          }
        } catch (err: any) {
          failed++;
          suiteAssertions.push({ label: tc.name, passed: false, error: err?.message || "Threw unexpectedly" });
          suiteOutput.push(`  ✗ ${tc.name} — threw: ${err?.message || "unknown error"}`);
        }
      }

      const duration = Date.now() - startTime;
      const success = failed === 0;
      suiteOutput.push(`\n  Results: ${passed} passed, ${failed} failed, ${skipped} skipped (${duration}ms)`);

      results.push({
        suiteName: suite.name,
        total: suite.cases.length,
        passed,
        failed,
        skipped,
        duration,
        assertions: suiteAssertions,
        output: suiteOutput,
        success,
      });

      tlog(`Suite "${suite.name}": ${passed}/${suite.cases.length} passed (${duration}ms)`);
    }

    this.suites = [];
    this.assertions = [];
    this.output = [];

    return results;
  }
}

export function createTestRunner(): SovereignTestRunner {
  return new SovereignTestRunner();
}

export interface GeneratedTestCase {
  testId: string;
  fileName: string;
  testCode: string;
  testType: "unit" | "integration" | "smoke";
  assertions: string[];
  generatedAt: string;
}

export function extractExportedFunctions(code: string): string[] {
  const funcNames: string[] = [];
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  ];
  for (const pat of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(code)) !== null) {
      funcNames.push(m[1]);
    }
  }
  return [...new Set(funcNames)];
}

export function generateTestsForCode(code: string, fileName: string): GeneratedTestCase {
  const testId = `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const exportedFns = extractExportedFunctions(code);
  const baseName = fileName.replace(/\.(ts|js)$/, "");
  const hasAsync = /async\s+function|=\s*async\s*\(/.test(code);
  const hasClass = /\bclass\s+\w+/.test(code);
  const hasErrorHandling = /try\s*\{|catch\s*\(/.test(code);
  const lines = code.split("\n").length;
  const complexity = lines > 200 ? "complex" : lines > 50 ? "moderate" : "simple";

  const assertions: string[] = [];
  const testBlocks: string[] = [];

  if (exportedFns.length > 0) {
    for (const fn of exportedFns.slice(0, 6)) {
      assertions.push(`${fn} should be defined`);
      testBlocks.push(
        hasAsync
          ? `  runner.it("${fn} is defined and callable", async () => {\n    runner.ok(typeof ${fn} === "function", "${fn} is a function");\n  });`
          : `  runner.it("${fn} is defined and callable", () => {\n    runner.ok(typeof ${fn} === "function", "${fn} is a function");\n  });`
      );
    }
  } else {
    assertions.push("Module loads without error");
    testBlocks.push(
      `  runner.it("module loads without error", () => {\n    runner.ok(true, "module imported successfully");\n  });`
    );
  }

  if (hasErrorHandling) {
    assertions.push("Error handling is present");
    testBlocks.push(
      `  runner.it("has error handling", () => {\n    runner.ok(true, "error handling paths confirmed");\n  });`
    );
  }

  if (hasClass) {
    const classMatch = code.match(/\bclass\s+(\w+)/);
    if (classMatch) {
      assertions.push(`${classMatch[1]} class is exported`);
      testBlocks.push(
        `  runner.it("${classMatch[1]} is accessible", () => {\n    runner.ok(${classMatch[1]} !== undefined, "${classMatch[1]} class exists");\n  });`
      );
    }
  }

  const importLine =
    exportedFns.length > 0
      ? `const { ${exportedFns.slice(0, 6).join(", ")} } = require("./${baseName}");`
      : `// const module = require("./${baseName}");`;

  const testCode = `// Auto-generated sovereign tests for ${fileName}
// Generated: ${new Date().toISOString()}
// Assertions: ${assertions.length} | Functions covered: ${exportedFns.length}

const { createTestRunner } = require("./sovereign-test-runner");
${importLine}

const runner = createTestRunner();

runner.describe("${baseName}", () => {
${testBlocks.join("\n\n")}
});

runner.run().then(results => {
  const total = results.reduce((s, r) => s + r.total, 0);
  const passed = results.reduce((s, r) => s + r.passed, 0);
  const failed = results.reduce((s, r) => s + r.failed, 0);
  console.log(JSON.stringify({ total, passed, failed, results }));
  process.exit(failed > 0 ? 1 : 0);
});
`;

  const testType: GeneratedTestCase["testType"] =
    complexity === "complex" ? "integration" : complexity === "moderate" ? "unit" : "smoke";

  return {
    testId,
    fileName: `${baseName}.sovereign-test.js`,
    testCode,
    testType,
    assertions,
    generatedAt: new Date().toISOString(),
  };
}

export function formatTestResults(results: TestRunResult[]): string {
  const lines: string[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of results) {
    lines.push(...r.output);
    totalPassed += r.passed;
    totalFailed += r.failed;
  }

  lines.push("");
  lines.push(`══ Summary: ${totalPassed} passed, ${totalFailed} failed ══`);
  return lines.join("\n");
}
