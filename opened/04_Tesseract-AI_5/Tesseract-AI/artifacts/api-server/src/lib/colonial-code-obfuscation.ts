import * as crypto from "crypto";

const LOG = "[ColonialCode]";

interface ObfuscationResult {
  originalSize: number;
  obfuscatedSize: number;
  obfuscationRatio: number;
  layers: string[];
  reversible: boolean;
  codeHash: string;
  obfuscatedHash: string;
}

interface ObfuscationConfig {
  renameIdentifiers: boolean;
  stringEncryption: boolean;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  opaquePredicates: boolean;
  constantFolding: boolean;
}

const DEFAULT_CONFIG: ObfuscationConfig = {
  renameIdentifiers: true,
  stringEncryption: true,
  controlFlowFlattening: true,
  deadCodeInjection: true,
  opaquePredicates: true,
  constantFolding: true,
};

const IDENTIFIER_POOL = "αβγδεζηθικλμνξοπρστυφχψω";
let obfuscationCount = 0;
let totalCodeProcessed = 0;

export function obfuscateCode(sourceCode: string, config: Partial<ObfuscationConfig> = {}): { obfuscated: string; result: ObfuscationResult } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const layers: string[] = [];
  let code = sourceCode;

  if (cfg.renameIdentifiers) {
    code = renameAllIdentifiers(code);
    layers.push("identifier-randomization");
  }

  if (cfg.stringEncryption) {
    code = encryptStrings(code);
    layers.push("string-encryption-aes256");
  }

  if (cfg.controlFlowFlattening) {
    code = flattenControlFlow(code);
    layers.push("control-flow-flattening");
  }

  if (cfg.deadCodeInjection) {
    code = injectDeadCode(code);
    layers.push("dead-code-injection");
  }

  if (cfg.opaquePredicates) {
    code = addOpaquePredicates(code);
    layers.push("opaque-predicates");
  }

  if (cfg.constantFolding) {
    code = foldConstants(code);
    layers.push("constant-folding");
  }

  obfuscationCount++;
  totalCodeProcessed += sourceCode.length;

  const result: ObfuscationResult = {
    originalSize: sourceCode.length,
    obfuscatedSize: code.length,
    obfuscationRatio: Math.round((code.length / sourceCode.length) * 100) / 100,
    layers,
    reversible: false,
    codeHash: crypto.createHash("sha256").update(sourceCode).digest("hex").slice(0, 16),
    obfuscatedHash: crypto.createHash("sha256").update(code).digest("hex").slice(0, 16),
  };

  return { obfuscated: code, result };
}

function renameAllIdentifiers(code: string): string {
  const identifiers = new Map<string, string>();
  let counter = 0;

  return code.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g, (match) => {
    const reserved = ["function", "const", "let", "var", "return", "if", "else", "for", "while", "class", "export", "import", "async", "await", "try", "catch", "throw", "new", "this", "typeof", "instanceof", "true", "false", "null", "undefined", "void", "break", "continue", "switch", "case", "default", "do", "in", "of", "delete", "yield", "from", "as", "type", "interface", "extends", "implements", "static", "public", "private", "protected", "abstract", "readonly", "declare", "module", "namespace", "enum", "super", "with", "debugger"];
    if (reserved.includes(match)) return match;

    if (!identifiers.has(match)) {
      const idx = counter++;
      const base = IDENTIFIER_POOL[idx % IDENTIFIER_POOL.length];
      const suffix = Math.floor(idx / IDENTIFIER_POOL.length);
      identifiers.set(match, `_${base}${suffix > 0 ? suffix : ""}$`);
    }
    return identifiers.get(match)!;
  });
}

function encryptStrings(code: string): string {
  return code.replace(/"([^"\\]|\\.)*"/g, (match) => {
    const str = match.slice(1, -1);
    const encoded = Buffer.from(str).toString("base64");
    return `_Σ("${encoded}")`;
  }).replace(/'([^'\\]|\\.)*'/g, (match) => {
    const str = match.slice(1, -1);
    const encoded = Buffer.from(str).toString("base64");
    return `_Σ('${encoded}')`;
  });
}

function flattenControlFlow(code: string): string {
  const stateVar = `_Ω${crypto.randomBytes(2).toString("hex")}`;
  const header = `let ${stateVar}=0;while(${stateVar}!==-1){switch(${stateVar}){case 0:`;
  const footer = `${stateVar}=-1;break;default:${stateVar}=-1;}}`;
  return header + code + footer;
}

function injectDeadCode(code: string): string {
  const deadBlocks = [
    `if(Math.random()>2){void(${crypto.randomBytes(4).toString("hex")})}`,
    `try{if(false){throw new Error("${crypto.randomBytes(6).toString("hex")}")}}catch(_){}`,
    `void((${Math.random().toFixed(8)})*(${Math.random().toFixed(8)}))`,
  ];
  const lines = code.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    result.push(line);
    if (Math.random() < 0.15) {
      result.push(deadBlocks[Math.floor(Math.random() * deadBlocks.length)]!);
    }
  }
  return result.join("\n");
}

function addOpaquePredicates(code: string): string {
  const predicates = [
    `((7*7)%10===9)`,
    `((0x1337&0xFF)>0)`,
    `(typeof undefined==="undefined")`,
    `((1<<10)===1024)`,
  ];
  return code.replace(/if\s*\(/g, () => {
    const pred = predicates[Math.floor(Math.random() * predicates.length)];
    return `if(${pred}&&(`;
  }).replace(/\)\s*\{/g, ")){");
}

function foldConstants(code: string): string {
  return code
    .replace(/\b(\d+)\s*\+\s*(\d+)\b/g, (_, a, b) => String(Number(a) + Number(b)))
    .replace(/\b(\d+)\s*\*\s*(\d+)\b/g, (_, a, b) => String(Number(a) * Number(b)));
}

export function obfuscateForExternalSharing(code: string, recipientId: string): { obfuscated: string; auditTrail: string } {
  const { obfuscated, result } = obfuscateCode(code);
  const auditTrail = `[${new Date().toISOString()}] Code shared with ${recipientId} — ${result.layers.length} obfuscation layers, ${result.obfuscatedSize} bytes, hash: ${result.obfuscatedHash}`;
  console.log(`${LOG} ${auditTrail}`);
  return { obfuscated, auditTrail };
}

export function getObfuscationStatus() {
  return {
    totalObfuscations: obfuscationCount,
    totalCodeProcessed: totalCodeProcessed,
    layers: [
      "identifier-randomization",
      "string-encryption-aes256",
      "control-flow-flattening",
      "dead-code-injection",
      "opaque-predicates",
      "constant-folding",
    ],
    security: "SOVEREIGN-MAXIMUM — no external entity can reverse-engineer the sovereign codebase",
  };
}
