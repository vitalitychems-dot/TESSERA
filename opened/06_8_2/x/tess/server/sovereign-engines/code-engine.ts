export class SovereignCodeEngine {
  analyzeComplexity(code: string): { cyclomaticComplexity: number; linesOfCode: number; commentLines: number; functionCount: number; maxNesting: number } {
    const lines = code.split('\n');
    const linesOfCode = lines.filter(l => l.trim().length > 0).length;
    const commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*|#)/.test(l)).length;
    const branchPatterns = /\b(if|else if|elif|while|for|case|catch|&&|\|\||\?)\b/g;
    const matches = code.match(branchPatterns);
    const cyclomaticComplexity = 1 + (matches?.length || 0);
    const functionPatterns = /\b(function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|def\s+\w+|fn\s+\w+|func\s+\w+|public\s+\w+\s*\(|private\s+\w+\s*\(|class\s+\w+)/g;
    const functionCount = (code.match(functionPatterns) || []).length;
    let maxNesting = 0, currentNesting = 0;
    for (const char of code) {
      if (char === '{' || char === '(') { currentNesting++; maxNesting = Math.max(maxNesting, currentNesting); }
      else if (char === '}' || char === ')') currentNesting = Math.max(0, currentNesting - 1);
    }
    return { cyclomaticComplexity, linesOfCode, commentLines, functionCount, maxNesting };
  }

  detectCodeSmells(code: string): { smell: string; severity: string; line?: number }[] {
    const smells: { smell: string; severity: string; line?: number }[] = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 120) smells.push({ smell: 'Long line (>120 chars)', severity: 'low', line: i + 1 });
      if (/console\.(log|debug|info)\s*\(/.test(lines[i])) smells.push({ smell: 'Console statement', severity: 'low', line: i + 1 });
      if (/TODO|FIXME|HACK|XXX/i.test(lines[i])) smells.push({ smell: 'TODO/FIXME marker', severity: 'medium', line: i + 1 });
      if (/eval\s*\(/.test(lines[i])) smells.push({ smell: 'eval() usage - security risk', severity: 'critical', line: i + 1 });
      if (/password\s*=\s*['"][^'"]+['"]/i.test(lines[i])) smells.push({ smell: 'Hardcoded password', severity: 'critical', line: i + 1 });
      if (/api[_-]?key\s*=\s*['"][^'"]+['"]/i.test(lines[i])) smells.push({ smell: 'Hardcoded API key', severity: 'critical', line: i + 1 });
    }
    if (lines.length > 500) smells.push({ smell: 'File too large (>500 lines)', severity: 'medium' });
    const analysis = this.analyzeComplexity(code);
    if (analysis.cyclomaticComplexity > 20) smells.push({ smell: `High cyclomatic complexity: ${analysis.cyclomaticComplexity}`, severity: 'high' });
    if (analysis.maxNesting > 5) smells.push({ smell: `Deep nesting: ${analysis.maxNesting} levels`, severity: 'high' });
    const duplicates = this.detectDuplicateBlocks(lines);
    if (duplicates > 0) smells.push({ smell: `${duplicates} duplicate code blocks detected`, severity: 'medium' });
    return smells;
  }

  private detectDuplicateBlocks(lines: string[], blockSize = 4): number {
    const blocks = new Map<string, number>();
    let duplicates = 0;
    for (let i = 0; i <= lines.length - blockSize; i++) {
      const block = lines.slice(i, i + blockSize).map(l => l.trim()).filter(l => l.length > 0).join('\n');
      if (block.length > 20) {
        const count = (blocks.get(block) || 0) + 1;
        blocks.set(block, count);
        if (count === 2) duplicates++;
      }
    }
    return duplicates;
  }

  extractStructure(code: string): { functions: string[]; classes: string[]; imports: string[]; exports: string[] } {
    const functions = [...code.matchAll(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g)]
      .map(m => m[1] || m[2]).filter(Boolean);
    const classes = [...code.matchAll(/class\s+(\w+)/g)].map(m => m[1]);
    const imports = [...code.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g)].map(m => m[1]);
    const exports = [...code.matchAll(/export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g)].map(m => m[1]);
    return { functions, classes, imports, exports };
  }

  generateBoilerplate(type: string, name: string): string {
    const templates: Record<string, (n: string) => string> = {
      class: (n) => `export class ${n} {\n  constructor() {}\n\n  initialize(): void {\n  }\n\n  dispose(): void {\n  }\n}`,
      function: (n) => `export function ${n}(): void {\n}`,
      interface: (n) => `export interface ${n} {\n  id: string;\n  createdAt: number;\n  updatedAt: number;\n}`,
      module: (n) => `const ${n}Module = {\n  initialize() {},\n  process(input: unknown) { return input; },\n  shutdown() {},\n};\n\nexport default ${n}Module;`,
      test: (n) => `describe('${n}', () => {\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});`,
      api_route: (n) => `app.get('/api/${n.toLowerCase()}', async (req, res) => {\n  try {\n    res.json({ status: 'ok' });\n  } catch (err) {\n    res.status(500).json({ error: err.message });\n  }\n});`,
    };
    const generator = templates[type];
    return generator ? generator(name) : `// Unknown template type: ${type}`;
  }

  transformCode(code: string, transformation: string): string {
    switch (transformation) {
      case 'add_error_handling':
        return code.replace(
          /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
          (_, name, params) => `async function ${name}(${params}) {\n  try {`
        );
      case 'add_logging':
        return code.replace(
          /(?:function|const)\s+(\w+)/g,
          (match, name) => `${match}\n  // [LOG] ${name} called`
        );
      case 'remove_comments':
        return code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      case 'minify':
        return code.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//')).join(' ');
      default:
        return code;
    }
  }

  securityAudit(code: string): { issue: string; severity: 'critical' | 'high' | 'medium' | 'low'; pattern: string }[] {
    const issues: { issue: string; severity: 'critical' | 'high' | 'medium' | 'low'; pattern: string }[] = [];
    const checks: [string, RegExp, 'critical' | 'high' | 'medium' | 'low'][] = [
      ['SQL Injection risk', /\$\{.*?\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/i, 'critical'],
      ['eval() usage', /\beval\s*\(/, 'critical'],
      ['Function constructor', /new\s+Function\s*\(/, 'critical'],
      ['innerHTML assignment', /\.innerHTML\s*=/, 'high'],
      ['document.write', /document\.write\s*\(/, 'high'],
      ['Hardcoded secret', /(?:password|secret|api_key|token)\s*[:=]\s*['"][^'"]{8,}['"]/i, 'critical'],
      ['Process.env direct', /process\.env\.\w+/, 'low'],
      ['Unsafe regex', /new\s+RegExp\s*\(\s*(?:req|input|user|data)/, 'high'],
      ['Path traversal risk', /\.\.\//g, 'medium'],
      ['Command injection', /child_process|exec\s*\(|spawn\s*\(/, 'critical'],
      ['Prototype pollution', /__proto__|constructor\.prototype/, 'critical'],
      ['Unvalidated redirect', /res\.redirect\s*\(\s*(?:req|input)/, 'high'],
    ];
    for (const [issue, pattern, severity] of checks) {
      if (pattern.test(code)) issues.push({ issue, severity, pattern: pattern.source });
    }
    return issues;
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    const sampleCode = `
function processData(input) {
  if (input.length > 0) {
    for (const item of input) {
      if (item.valid) {
        console.log(item);
      }
    }
  }
  return input;
}
const helper = (x) => x * 2;
`;
    const complexity = this.analyzeComplexity(sampleCode);
    check("Complexity > 1", complexity.cyclomaticComplexity > 1);
    check("Lines counted", complexity.linesOfCode > 5);
    check("Functions found", complexity.functionCount >= 1);
    check("Nesting detected", complexity.maxNesting > 0);

    const smells = this.detectCodeSmells(sampleCode);
    check("Console smell", smells.some(s => s.smell.includes('Console')));

    const structure = this.extractStructure("import fs from 'fs';\nexport function hello() {}\nclass World {}");
    check("Extract imports", structure.imports.length > 0);
    check("Extract functions", structure.functions.length > 0);
    check("Extract classes", structure.classes.length > 0);

    check("Generate class", this.generateBoilerplate('class', 'TestClass').includes('class TestClass'));
    check("Generate function", this.generateBoilerplate('function', 'testFn').includes('function testFn'));

    check("Security: eval", this.securityAudit('eval("dangerous")').length > 0);
    check("Security: clean", this.securityAudit('const x = 1 + 2;').length === 0);
    check("Transform: remove comments", !this.transformCode('// comment\ncode()', 'remove_comments').includes('comment'));

    return { passed, total, details };
  }
}

export const codeEngine = new SovereignCodeEngine();
