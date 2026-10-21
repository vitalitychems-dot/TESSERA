export class SovereignCodeEngine {
  analyzeComplexity(code: string): { cyclomaticComplexity: number; linesOfCode: number; commentLines: number; functionCount: number; maxNesting: number; maintainabilityIndex: number } {
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
    const halsteadVolume = linesOfCode * Math.log2(Math.max(functionCount * 2 + cyclomaticComplexity, 2));
    const maintainabilityIndex = Math.max(0, Math.min(100,
      171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode) + 50 * (commentLines / Math.max(linesOfCode, 1))
    ));
    return { cyclomaticComplexity, linesOfCode, commentLines, functionCount, maxNesting, maintainabilityIndex };
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
      if (/\bany\b/.test(lines[i]) && /:\s*any\b/.test(lines[i])) smells.push({ smell: 'TypeScript any type', severity: 'low', line: i + 1 });
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

  extractStructure(code: string): { functions: string[]; classes: string[]; imports: string[]; exports: string[]; interfaces: string[]; types: string[] } {
    const functions = [...code.matchAll(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g)]
      .map(m => m[1] || m[2]).filter(Boolean);
    const classes = [...code.matchAll(/class\s+(\w+)/g)].map(m => m[1]);
    const imports = [...code.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g)].map(m => m[1]);
    const exports = [...code.matchAll(/export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g)].map(m => m[1]);
    const interfaces = [...code.matchAll(/interface\s+(\w+)/g)].map(m => m[1]);
    const types = [...code.matchAll(/type\s+(\w+)\s*=/g)].map(m => m[1]);
    return { functions, classes, imports, exports, interfaces, types };
  }

  generateFunction(name: string, language: string, params: { name: string; type: string }[], returnType: string, body?: string): string {
    const bodyContent = body || `throw new Error("Not implemented");`;
    switch (language) {
      case "typescript":
      case "ts": {
        const paramStr = params.map(p => `${p.name}: ${p.type}`).join(", ");
        return `export function ${name}(${paramStr}): ${returnType} {\n  ${bodyContent}\n}`;
      }
      case "python":
      case "py": {
        const paramStr = params.map(p => `${p.name}: ${p.type}`).join(", ");
        return `def ${name}(${paramStr}) -> ${returnType}:\n    ${body || 'raise NotImplementedError()'}`;
      }
      case "rust":
      case "rs": {
        const paramStr = params.map(p => `${p.name}: ${p.type}`).join(", ");
        return `pub fn ${name}(${paramStr}) -> ${returnType} {\n    ${body || 'todo!()'};\n}`;
      }
      case "go": {
        const paramStr = params.map(p => `${p.name} ${p.type}`).join(", ");
        return `func ${name}(${paramStr}) ${returnType} {\n\t${body || 'panic("not implemented")'}\n}`;
      }
      case "java": {
        const paramStr = params.map(p => `${p.type} ${p.name}`).join(", ");
        return `public ${returnType} ${name}(${paramStr}) {\n    ${body || `throw new RuntimeException("Not implemented");`}\n}`;
      }
      default: {
        const paramStr = params.map(p => `${p.name}: ${p.type}`).join(", ");
        return `function ${name}(${paramStr}): ${returnType} {\n  ${bodyContent}\n}`;
      }
    }
  }

  generateClass(name: string, language: string, fields: { name: string; type: string; visibility?: string }[], methods: string[]): string {
    switch (language) {
      case "typescript":
      case "ts": {
        const fieldStr = fields.map(f => `  ${f.visibility || 'public'} ${f.name}: ${f.type};`).join("\n");
        const ctorParams = fields.map(f => `${f.name}: ${f.type}`).join(", ");
        const ctorBody = fields.map(f => `    this.${f.name} = ${f.name};`).join("\n");
        const methodStr = methods.map(m => `  ${m}() {\n    throw new Error("Not implemented");\n  }`).join("\n\n");
        return `export class ${name} {\n${fieldStr}\n\n  constructor(${ctorParams}) {\n${ctorBody}\n  }\n\n${methodStr}\n}`;
      }
      case "python":
      case "py": {
        const initParams = ["self", ...fields.map(f => `${f.name}: ${f.type}`)].join(", ");
        const initBody = fields.map(f => `        self.${f.name} = ${f.name}`).join("\n");
        const methodStr = methods.map(m => `    def ${m}(self):\n        raise NotImplementedError()`).join("\n\n");
        return `class ${name}:\n    def __init__(${initParams}):\n${initBody}\n\n${methodStr}`;
      }
      case "rust":
      case "rs": {
        const fieldStr = fields.map(f => `    pub ${f.name}: ${f.type},`).join("\n");
        const methodStr = methods.map(m => `    pub fn ${m}(&self) {\n        todo!();\n    }`).join("\n\n");
        return `pub struct ${name} {\n${fieldStr}\n}\n\nimpl ${name} {\n${methodStr}\n}`;
      }
      default: {
        const fieldStr = fields.map(f => `  ${f.name}: ${f.type};`).join("\n");
        return `class ${name} {\n${fieldStr}\n\n  constructor() {}\n}`;
      }
    }
  }

  generateAPIEndpoint(method: string, path: string, language: string, responseSchema?: Record<string, string>): string {
    const schemaFields = responseSchema
      ? Object.entries(responseSchema).map(([k, v]) => `${k}: ${v}`).join(", ")
      : "status: 'ok'";

    switch (language) {
      case "express":
      case "typescript":
        return `app.${method.toLowerCase()}('${path}', async (req: Request, res: Response) => {\n  try {\n    const result = { ${schemaFields} };\n    res.json({ success: true, data: result });\n  } catch (err: any) {\n    res.status(500).json({ success: false, error: err.message });\n  }\n});`;
      case "fastapi":
      case "python":
        return `@app.${method.toLowerCase()}("${path}")\nasync def ${path.replace(/\//g, '_').replace(/^_/, '')}():\n    try:\n        return {"success": True, "data": {${Object.entries(responseSchema || { status: "'ok'" }).map(([k, v]) => `"${k}": ${v}`).join(", ")}}}\n    except Exception as e:\n        raise HTTPException(status_code=500, detail=str(e))`;
      case "gin":
      case "go":
        return `r.${method.toUpperCase()}("${path}", func(c *gin.Context) {\n\tc.JSON(200, gin.H{"success": true, "data": gin.H{${Object.entries(responseSchema || { status: "'ok'" }).map(([k, v]) => `"${k}": ${v}`).join(", ")}}})\n})`;
      default:
        return `// ${method.toUpperCase()} ${path}\napp.${method.toLowerCase()}('${path}', handler);`;
    }
  }

  generateTestSuite(functionName: string, testCases: { input: string; expected: string; description: string }[], language: string): string {
    switch (language) {
      case "jest":
      case "typescript":
        return `describe('${functionName}', () => {\n${testCases.map(tc =>
          `  it('${tc.description}', () => {\n    expect(${functionName}(${tc.input})).toEqual(${tc.expected});\n  });`
        ).join("\n\n")}\n});`;
      case "pytest":
      case "python":
        return testCases.map(tc =>
          `def test_${functionName}_${tc.description.replace(/\s+/g, '_').toLowerCase()}():\n    assert ${functionName}(${tc.input}) == ${tc.expected}`
        ).join("\n\n");
      default:
        return `// Tests for ${functionName}\n${testCases.map(tc => `// ${tc.description}: ${functionName}(${tc.input}) === ${tc.expected}`).join("\n")}`;
    }
  }

  generateDataModel(name: string, fields: { name: string; type: string; required?: boolean; unique?: boolean }[], language: string): string {
    switch (language) {
      case "drizzle":
      case "typescript": {
        const drizzleType = (t: string) => {
          if (t === "string") return "varchar";
          if (t === "number") return "integer";
          if (t === "boolean") return "boolean";
          if (t === "Date") return "timestamp";
          return "text";
        };
        return `export const ${name.toLowerCase()}s = pgTable("${name.toLowerCase()}s", {\n  id: serial("id").primaryKey(),\n${fields.map(f =>
          `  ${f.name}: ${drizzleType(f.type)}("${f.name}")${f.required ? '.notNull()' : ''}${f.unique ? '.unique()' : ''},`
        ).join("\n")}\n  createdAt: timestamp("created_at").defaultNow(),\n});`;
      }
      case "prisma":
        return `model ${name} {\n  id    Int    @id @default(autoincrement())\n${fields.map(f =>
          `  ${f.name}  ${f.type === "string" ? "String" : f.type === "number" ? "Int" : f.type}${f.required ? "" : "?"}${f.unique ? "  @unique" : ""}`
        ).join("\n")}\n  createdAt DateTime @default(now())\n}`;
      case "sqlalchemy":
      case "python":
        return `class ${name}(Base):\n    __tablename__ = "${name.toLowerCase()}s"\n    id = Column(Integer, primary_key=True)\n${fields.map(f =>
          `    ${f.name} = Column(${f.type === "string" ? "String" : f.type === "number" ? "Integer" : "Boolean"}${f.required ? ", nullable=False" : ""}${f.unique ? ", unique=True" : ""})`
        ).join("\n")}\n    created_at = Column(DateTime, default=func.now())`;
      default:
        return `-- Table: ${name}\nCREATE TABLE ${name.toLowerCase()}s (\n  id SERIAL PRIMARY KEY,\n${fields.map(f =>
          `  ${f.name} ${f.type === "string" ? "VARCHAR(255)" : f.type === "number" ? "INTEGER" : "BOOLEAN"}${f.required ? " NOT NULL" : ""}${f.unique ? " UNIQUE" : ""}`
        ).join(",\n")},\n  created_at TIMESTAMP DEFAULT NOW()\n);`;
    }
  }

  generateBoilerplate(type: string, name: string): string {
    const templates: Record<string, (n: string) => string> = {
      class: (n) => `export class ${n} {\n  constructor() {}\n\n  initialize(): void {\n  }\n\n  dispose(): void {\n  }\n}`,
      function: (n) => `export function ${n}(): void {\n}`,
      interface: (n) => `export interface ${n} {\n  id: string;\n  createdAt: number;\n  updatedAt: number;\n}`,
      module: (n) => `const ${n}Module = {\n  initialize() {},\n  process(input: unknown) { return input; },\n  shutdown() {},\n};\n\nexport default ${n}Module;`,
      test: (n) => `describe('${n}', () => {\n  it('should work', () => {\n    expect(true).toBe(true);\n  });\n});`,
      api_route: (n) => `app.get('/api/${n.toLowerCase()}', async (req, res) => {\n  try {\n    res.json({ status: 'ok' });\n  } catch (err) {\n    res.status(500).json({ error: err.message });\n  }\n});`,
      react_component: (n) => `import React from 'react';\n\ninterface ${n}Props {\n  title: string;\n}\n\nexport function ${n}({ title }: ${n}Props) {\n  return (\n    <div className="${n.toLowerCase()}">\n      <h2>{title}</h2>\n    </div>\n  );\n}`,
      express_router: (n) => `import { Router } from 'express';\n\nconst router = Router();\n\nrouter.get('/', async (req, res) => {\n  res.json({ service: '${n}', status: 'ok' });\n});\n\nexport default router;`,
      middleware: (n) => `export function ${n}(req, res, next) {\n  try {\n    next();\n  } catch (err) {\n    res.status(500).json({ error: err.message });\n  }\n}`,
      singleton: (n) => `class ${n} {\n  private static instance: ${n};\n  private constructor() {}\n\n  static getInstance(): ${n} {\n    if (!${n}.instance) ${n}.instance = new ${n}();\n    return ${n}.instance;\n  }\n}`,
      observer: (n) => `type ${n}Listener = (data: any) => void;\n\nclass ${n} {\n  private listeners: ${n}Listener[] = [];\n  subscribe(fn: ${n}Listener) { this.listeners.push(fn); }\n  notify(data: any) { this.listeners.forEach(fn => fn(data)); }\n}`,
      factory: (n) => `interface ${n}Product {\n  type: string;\n}\n\nexport function create${n}(type: string): ${n}Product {\n  return { type };\n}`,
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
      case 'add_types':
        return code.replace(/function\s+(\w+)\s*\((\w+)\)/g, 'function $1($2: any): any');
      case 'async_wrap':
        return code.replace(/function\s+(\w+)/g, 'async function $1');
      default:
        return code;
    }
  }

  refactorExtractFunction(code: string, startLine: number, endLine: number, newFunctionName: string): string {
    const lines = code.split('\n');
    const extracted = lines.slice(startLine - 1, endLine).join('\n');
    const remaining = [...lines.slice(0, startLine - 1), `  ${newFunctionName}();`, ...lines.slice(endLine)];
    return `function ${newFunctionName}() {\n${extracted}\n}\n\n${remaining.join('\n')}`;
  }

  calculateCodeMetrics(code: string): {
    linesOfCode: number;
    logicalLines: number;
    commentDensity: number;
    avgLineLength: number;
    maxLineLength: number;
    codeToCommentRatio: number;
    maintainabilityIndex: number;
    languages: string[];
  } {
    const lines = code.split('\n');
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    const comments = lines.filter(l => /^\s*(\/\/|\/\*|\*|#|"""|''')/.test(l));
    const lineLengths = nonEmpty.map(l => l.length);

    const languagePatterns: [string, RegExp][] = [
      ["typescript", /:\s*(string|number|boolean|void|any)\b/],
      ["python", /\bdef\s+\w+|import\s+\w+|from\s+\w+\s+import/],
      ["rust", /\bfn\s+\w+|let\s+mut\b|impl\s+\w+/],
      ["go", /\bfunc\s+\w+|package\s+\w+|import\s+"/],
      ["java", /\bpublic\s+(class|static|void)|System\.out/],
      ["javascript", /\bfunction\s+\w+|const\s+\w+\s*=|=>\s*\{/],
    ];
    const languages = languagePatterns.filter(([, re]) => re.test(code)).map(([lang]) => lang);

    const analysis = this.analyzeComplexity(code);
    return {
      linesOfCode: nonEmpty.length,
      logicalLines: nonEmpty.filter(l => !/^\s*(\/\/|\/\*|\*|\{|\}|#)/.test(l)).length,
      commentDensity: nonEmpty.length > 0 ? comments.length / nonEmpty.length : 0,
      avgLineLength: lineLengths.length > 0 ? Math.round(lineLengths.reduce((s, l) => s + l, 0) / lineLengths.length) : 0,
      maxLineLength: lineLengths.length > 0 ? Math.max(...lineLengths) : 0,
      codeToCommentRatio: comments.length > 0 ? (nonEmpty.length - comments.length) / comments.length : nonEmpty.length,
      maintainabilityIndex: analysis.maintainabilityIndex,
      languages: languages.length > 0 ? languages : ["unknown"],
    };
  }

  securityAudit(code: string): { issue: string; severity: 'critical' | 'high' | 'medium' | 'low'; pattern: string }[] {
    const issues: { issue: string; severity: 'critical' | 'high' | 'medium' | 'low'; pattern: string }[] = [];
    const checks: [string, RegExp, 'critical' | 'high' | 'medium' | 'low'][] = [
      ['SQL Injection risk', /(?:\$\{.*?\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)|(?:SELECT|INSERT|UPDATE|DELETE|DROP).*\$\{)/i, 'critical'],
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
      ['Insecure random', /Math\.random\(\)/, 'medium'],
      ['Missing CORS', /Access-Control-Allow-Origin.*\*/, 'medium'],
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
    check("Maintainability index", complexity.maintainabilityIndex >= 0);

    const smells = this.detectCodeSmells(sampleCode);
    check("Console smell", smells.some(s => s.smell.includes('Console')));

    const structure = this.extractStructure("import fs from 'fs';\nexport function hello() {}\nclass World {}\ninterface IFoo {}\ntype Bar = string;");
    check("Extract imports", structure.imports.length > 0);
    check("Extract functions", structure.functions.length > 0);
    check("Extract classes", structure.classes.length > 0);
    check("Extract interfaces", structure.interfaces.length > 0);
    check("Extract types", structure.types.length > 0);

    check("Generate function TS", this.generateFunction("add", "typescript", [{ name: "a", type: "number" }, { name: "b", type: "number" }], "number", "return a + b;").includes("function add"));
    check("Generate function Python", this.generateFunction("add", "python", [{ name: "a", type: "int" }, { name: "b", type: "int" }], "int").includes("def add"));
    check("Generate function Rust", this.generateFunction("add", "rust", [{ name: "a", type: "i32" }, { name: "b", type: "i32" }], "i32").includes("pub fn add"));
    check("Generate function Go", this.generateFunction("add", "go", [{ name: "a", type: "int" }, { name: "b", type: "int" }], "int").includes("func add"));
    check("Generate function Java", this.generateFunction("add", "java", [{ name: "a", type: "int" }, { name: "b", type: "int" }], "int").includes("public int add"));

    check("Generate class TS", this.generateClass("User", "typescript", [{ name: "name", type: "string" }, { name: "age", type: "number" }], ["greet"]).includes("class User"));
    check("Generate class Python", this.generateClass("User", "python", [{ name: "name", type: "str" }, { name: "age", type: "int" }], ["greet"]).includes("class User"));
    check("Generate class Rust", this.generateClass("User", "rust", [{ name: "name", type: "String" }, { name: "age", type: "u32" }], ["greet"]).includes("pub struct User"));

    check("Generate API Express", this.generateAPIEndpoint("get", "/api/users", "express").includes("app.get"));
    check("Generate API FastAPI", this.generateAPIEndpoint("get", "/api/users", "fastapi").includes("@app.get"));
    check("Generate API Gin", this.generateAPIEndpoint("GET", "/api/users", "gin").includes("r.GET"));

    check("Generate test Jest", this.generateTestSuite("add", [{ input: "1, 2", expected: "3", description: "adds numbers" }], "jest").includes("describe"));
    check("Generate test Pytest", this.generateTestSuite("add", [{ input: "1, 2", expected: "3", description: "adds numbers" }], "pytest").includes("def test_"));

    check("Generate data model Drizzle", this.generateDataModel("User", [{ name: "email", type: "string", required: true, unique: true }], "drizzle").includes("pgTable"));
    check("Generate data model Prisma", this.generateDataModel("User", [{ name: "email", type: "string", required: true }], "prisma").includes("model User"));
    check("Generate data model SQL", this.generateDataModel("User", [{ name: "email", type: "string" }], "sql").includes("CREATE TABLE"));

    check("Generate boilerplate class", this.generateBoilerplate('class', 'TestClass').includes('class TestClass'));
    check("Generate boilerplate function", this.generateBoilerplate('function', 'testFn').includes('function testFn'));
    check("Generate boilerplate component", this.generateBoilerplate('react_component', 'MyCard').includes('MyCard'));
    check("Generate boilerplate singleton", this.generateBoilerplate('singleton', 'Config').includes('getInstance'));
    check("Generate boilerplate observer", this.generateBoilerplate('observer', 'Events').includes('subscribe'));

    check("Code metrics", (() => {
      const m = this.calculateCodeMetrics(sampleCode);
      return m.linesOfCode > 0 && m.avgLineLength > 0 && m.languages.length > 0;
    })());

    check("Security: eval", this.securityAudit('eval("dangerous")').length > 0);
    check("Security: clean", this.securityAudit('const x = 1 + 2;').length === 0);
    check("Security: SQL injection", this.securityAudit('const q = `SELECT * FROM users WHERE id = ${userId}`').length > 0);
    check("Transform: remove comments", !this.transformCode('// comment\ncode()', 'remove_comments').includes('comment'));
    check("Extract function refactor", this.refactorExtractFunction("line1\nline2\nline3\nline4", 2, 3, "extracted").includes("function extracted"));

    return { passed, total, details };
  }
}

export const codeEngine = new SovereignCodeEngine();
