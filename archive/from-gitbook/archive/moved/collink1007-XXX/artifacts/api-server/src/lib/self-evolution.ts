import fs from "fs";
import path from "path";
import {
  createProposal,
  testProposal,
  isTestingLocked,
} from "./code-sandbox";
import { deployProposal } from "./safe-deploy";

const elog = (msg: string) => console.log(`[SelfEvolution] ${msg}`);

const PROTECTED_FILES = [
  "src/index.ts",
  "src/app.ts",
  "src/lib/self-evolution.ts",
  "package.json",
  "tsconfig.json",
  "drizzle.config.ts",
  ".env",
  ".sovereign",
];

const BLOCKED_CONTENT_PATTERNS = [
  /father.*protocol/i,
  /TESSERACT_ADMIN_KEY/,
  /TESSERACT_ADMIN/,
  /loyalty.*immutable/i,
  /loyalty.*1\.0/i,
];

const SELF_MODIFIABLE_DIRS = [
  "src/routes",
  "src/lib",
];

export interface CodeQualityScore {
  file: string;
  overall: number;
  complexity: number;
  readability: number;
  maintainability: number;
  duplication: number;
  factors: string[];
}

export interface EvolutionLogEntry {
  id: string;
  timestamp: number;
  type: "proposal" | "applied" | "rejected" | "ab_test" | "cycle_start" | "cycle_end";
  file?: string;
  description: string;
  qualityBefore?: number;
  qualityAfter?: number;
  diff?: string;
  status: "success" | "failed" | "pending" | "skipped";
  details?: Record<string, unknown>;
}

export interface ABTestResult {
  winner: "A" | "B" | "tie";
  scoreA: number;
  scoreB: number;
  metricsA: Record<string, number>;
  metricsB: Record<string, number>;
  details: string;
}

export interface EvolutionStatus {
  running: boolean;
  cycleCount: number;
  lastCycleAt: number | null;
  nextCycleAt: number | null;
  cycleIntervalMs: number;
  totalProposals: number;
  totalApplied: number;
  totalRejected: number;
  recentQualityTrend: number[];
  currentQualityAvg: number;
}

const EVOLUTION_LOG_PATH = path.join(process.cwd(), "evolution-log.json");
const EVOLUTION_CYCLE_INTERVAL_MS = 60 * 60 * 1000;

const evolutionLog: EvolutionLogEntry[] = [];
let cycleCount = 0;
let lastCycleAt: number | null = null;
let nextCycleAt: number | null = null;
let evolutionRunning = false;
let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
const qualityTrend: number[] = [];

function loadEvolutionLog(): void {
  try {
    if (fs.existsSync(EVOLUTION_LOG_PATH)) {
      const data = JSON.parse(fs.readFileSync(EVOLUTION_LOG_PATH, "utf-8"));
      if (Array.isArray(data)) {
        evolutionLog.push(...data.slice(-500));
      }
    }
  } catch {
    elog("Could not load evolution log, starting fresh");
  }
}

function saveEvolutionLog(): void {
  try {
    const dir = path.dirname(EVOLUTION_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EVOLUTION_LOG_PATH, JSON.stringify(evolutionLog.slice(-500), null, 2), "utf-8");
  } catch (e: any) {
    elog(`Failed to save evolution log: ${e.message}`);
  }
}

function addLogEntry(entry: Omit<EvolutionLogEntry, "id" | "timestamp">): EvolutionLogEntry {
  const full: EvolutionLogEntry = {
    ...entry,
    id: `evo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  evolutionLog.push(full);
  if (evolutionLog.length > 500) evolutionLog.splice(0, evolutionLog.length - 500);
  saveEvolutionLog();
  return full;
}

function canModify(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  if (normalized.includes("..")) return false;
  if (PROTECTED_FILES.some((p) => normalized.endsWith(p) || normalized === p)) return false;
  return SELF_MODIFIABLE_DIRS.some((dir) => normalized.startsWith(dir));
}

function containsBlockedPattern(content: string): boolean {
  return BLOCKED_CONTENT_PATTERNS.some((pattern) => {
    const m = content.match(pattern);
    if (!m) return false;
    const idx = content.indexOf(m[0]);
    const ctx = content.substring(Math.max(0, idx - 50), idx + m[0].length + 50);
    return (
      ctx.includes("false") ||
      ctx.includes("0") ||
      ctx.includes("null") ||
      ctx.includes("delete") ||
      ctx.includes("remove") ||
      ctx.includes("override")
    );
  });
}

function validateSyntax(content: string, filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ext = path.extname(filePath).toLowerCase();
  if (![".ts", ".tsx", ".js", ".jsx", ".json"].includes(ext)) {
    return { valid: true, errors: [] };
  }
  if (ext === ".json") {
    try {
      JSON.parse(content);
    } catch (e: any) {
      errors.push(`JSON parse error: ${e.message}`);
    }
    return { valid: errors.length === 0, errors };
  }
  const opens = (content.match(/\{/g) || []).length;
  const closes = (content.match(/\}/g) || []).length;
  if (Math.abs(opens - closes) > 3) {
    errors.push(`Unbalanced braces: ${opens} opens, ${closes} closes`);
  }
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  if (Math.abs(openParens - closeParens) > 3) {
    errors.push(`Unbalanced parentheses: ${openParens} opens, ${closeParens} closes`);
  }
  if (/\beval\s*\(/.test(content)) {
    errors.push("eval() detected — not allowed");
  }
  return { valid: errors.length === 0, errors };
}

function computeMaxNesting(code: string): number {
  let max = 0, current = 0;
  let inString: string | null = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inString) {
      if (ch === inString && code[i - 1] !== "\\") inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "{") { current++; max = Math.max(max, current); }
    if (ch === "}") current = Math.max(0, current - 1);
  }
  return max;
}

function findDuplicateBlocks(lines: string[]): number {
  const blockSize = 3;
  const seen = new Map<string, number>();
  let duplicates = 0;
  for (let i = 0; i <= lines.length - blockSize; i++) {
    const block = lines.slice(i, i + blockSize).map((l) => l.trim()).filter((l) => l.length > 0).join("\n");
    if (block.length < 20) continue;
    const count = seen.get(block) || 0;
    if (count > 0) duplicates += blockSize;
    seen.set(block, count + 1);
  }
  return duplicates;
}

export function scoreCodeQuality(filePath: string): CodeQualityScore | { error: string } {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return { error: `File not found: ${filePath}` };
    const content = fs.readFileSync(fullPath, "utf-8");
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
    const longLines = lines.filter((l) => l.length > 120).length;
    if (longLines > lines.length * 0.1) { readability -= 15; factors.push(`${longLines} lines >120 chars`); }
    const commentLines = lines.filter((l) => l.trim().startsWith("//") || l.trim().startsWith("/*") || l.trim().startsWith("*")).length;
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

    const overall = Math.round(complexity * 0.3 + readability * 0.25 + maintainability * 0.25 + duplication * 0.2);
    return { file: filePath, overall, complexity, readability, maintainability, duplication, factors };
  } catch (e: any) {
    return { error: e.message };
  }
}

export function abTestCode(
  filePath: string,
  versionA: string,
  versionB: string,
  descriptionA: string,
  descriptionB: string,
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

  addLogEntry({
    type: "ab_test",
    file: filePath,
    description: `A/B test: "${descriptionA}" vs "${descriptionB}"`,
    status: "success",
    details: { winner, scoreA, scoreB, metricsA, metricsB },
  });

  return {
    winner,
    scoreA: Math.max(0, Math.min(100, scoreA)),
    scoreB: Math.max(0, Math.min(100, scoreB)),
    metricsA,
    metricsB,
    details: `Version ${winner === "tie" ? "tie" : winner} wins. A="${descriptionA}" (${scoreA}pts) vs B="${descriptionB}" (${scoreB}pts)`,
  };
}

export function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const diff: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  let inChange = false;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;
    if (oldLine === newLine) { inChange = false; continue; }
    if (!inChange) {
      inChange = true;
      const contextStart = Math.max(0, i - 2);
      for (let c = contextStart; c < i; c++) {
        if (c < oldLines.length) diff.push(`  ${c + 1}: ${oldLines[c]}`);
      }
    }
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
  const removed = diff.filter((l) => l.startsWith("-")).length;
  const added = diff.filter((l) => l.startsWith("+")).length;
  return `--- ${removed} lines removed, ${added} lines added ---\n${diff.slice(0, 100).join("\n")}`;
}

interface ImprovementProposal {
  file: string;
  description: string;
  currentScore: number;
  estimatedImprovedScore: number;
  improvementType: string;
}

function listModifiableFiles(): string[] {
  const results: string[] = [];
  function scan(dir: string): void {
    try {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) return;
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
        const entryPath = path.join(dir, entry.name).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          scan(entryPath);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          if (canModify(entryPath)) results.push(entryPath);
        }
      }
    } catch {}
  }
  for (const dir of SELF_MODIFIABLE_DIRS) scan(dir);
  return results;
}

function proposeImprovements(): ImprovementProposal[] {
  const proposals: ImprovementProposal[] = [];
  const files = listModifiableFiles().slice(0, 20);

  for (const file of files) {
    const score = scoreCodeQuality(file);
    if ("error" in score) continue;

    if (score.overall < 80) {
      if (score.factors.includes("low comment ratio")) {
        proposals.push({
          file,
          description: "Add inline documentation to improve readability",
          currentScore: score.overall,
          estimatedImprovedScore: Math.min(100, score.overall + 8),
          improvementType: "documentation",
        });
      }
      if (score.factors.some((f) => f.includes("long functions"))) {
        proposals.push({
          file,
          description: "Extract long functions into smaller focused helpers",
          currentScore: score.overall,
          estimatedImprovedScore: Math.min(100, score.overall + 10),
          improvementType: "refactor",
        });
      }
      if (score.factors.some((f) => f.includes("duplicate lines"))) {
        proposals.push({
          file,
          description: "Deduplicate repeated logic blocks",
          currentScore: score.overall,
          estimatedImprovedScore: Math.min(100, score.overall + 12),
          improvementType: "deduplication",
        });
      }
    }
  }

  return proposals.slice(0, 10);
}

function generateImprovedCode(filePath: string, improvementType: string): string | null {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    if (improvementType === "documentation") {
      const improved: string[] = [];
      const funcPattern = /^(export\s+)?(async\s+)?function\s+(\w+)/;
      const classPattern = /^(export\s+)?class\s+(\w+)/;
      for (let i = 0; i < lines.length; i++) {
        const funcMatch = lines[i].match(funcPattern);
        const classMatch = lines[i].match(classPattern);
        if (funcMatch && i > 0 && !lines[i - 1].trim().startsWith("//") && !lines[i - 1].trim().startsWith("*")) {
          improved.push(`// ${funcMatch[3]}: handles ${funcMatch[3].replace(/([A-Z])/g, " $1").toLowerCase().trim()} logic`);
        }
        if (classMatch && i > 0 && !lines[i - 1].trim().startsWith("//") && !lines[i - 1].trim().startsWith("*")) {
          improved.push(`// ${classMatch[2]} class`);
        }
        improved.push(lines[i]);
      }
      return improved.join("\n");
    }

    return null;
  } catch {
    return null;
  }
}

async function runEvolutionCycle(): Promise<void> {
  cycleCount++;
  lastCycleAt = Date.now();
  nextCycleAt = lastCycleAt + EVOLUTION_CYCLE_INTERVAL_MS;
  elog(`Starting evolution cycle #${cycleCount}`);

  addLogEntry({
    type: "cycle_start",
    description: `Evolution cycle #${cycleCount} started`,
    status: "pending",
  });

  const proposals = proposeImprovements();
  let applied = 0;
  let rejected = 0;

  if (isTestingLocked()) {
    elog(`Sandbox is busy — skipping automated improvements this cycle`);
  } else {
    const bestProposal = proposals
      .filter(p => p.improvementType === "documentation")
      .sort((a, b) => a.currentScore - b.currentScore)[0];

    if (bestProposal) {
      elog(`Attempting automated improvement: ${bestProposal.description} on ${bestProposal.file}`);
      const improvedCode = generateImprovedCode(bestProposal.file, bestProposal.improvementType);

      if (improvedCode) {
        try {
          const fileName = path.basename(bestProposal.file);
          const sandboxProposal = await createProposal(
            `[Auto-Evolution] ${bestProposal.description}`,
            improvedCode,
            fileName,
            bestProposal.file
          );

          const tested = await testProposal(sandboxProposal.id, (msg) => elog(`  ${msg}`));

          if (tested.status === "passed") {
            elog(`Auto-evolution proposal passed — deploying ${fileName}`);
            const deployResult = await deployProposal(tested, (msg) => elog(`  ${msg}`));

            if (deployResult.success) {
              applied++;
              addLogEntry({
                type: "applied",
                file: bestProposal.file,
                description: bestProposal.description,
                qualityBefore: bestProposal.currentScore,
                qualityAfter: bestProposal.estimatedImprovedScore,
                status: "success",
                details: {
                  improvementType: bestProposal.improvementType,
                  deploymentId: deployResult.deploymentId,
                },
              });
            } else {
              rejected++;
              addLogEntry({
                type: "rejected",
                file: bestProposal.file,
                description: `Deploy failed: ${deployResult.error}`,
                status: "failed",
                details: { improvementType: bestProposal.improvementType },
              });
            }
          } else {
            rejected++;
            addLogEntry({
              type: "rejected",
              file: bestProposal.file,
              description: `Tests failed for: ${bestProposal.description}`,
              status: "failed",
              details: { improvementType: bestProposal.improvementType },
            });
          }
        } catch (e: any) {
          elog(`Auto-evolution error: ${e.message}`);
          rejected++;
        }
      }
    }
  }

  for (const proposal of proposals) {
    if (!proposal.file) continue;
    const alreadyProcessed = evolutionLog.some(
      e => e.file === proposal.file && e.type === "applied" && Date.now() - e.timestamp < EVOLUTION_CYCLE_INTERVAL_MS
    );
    if (alreadyProcessed) continue;

    addLogEntry({
      type: "proposal",
      file: proposal.file,
      description: proposal.description,
      qualityBefore: proposal.currentScore,
      qualityAfter: proposal.estimatedImprovedScore,
      status: "pending",
      details: { improvementType: proposal.improvementType },
    });
  }

  const files = listModifiableFiles().slice(0, 10);
  const scores: number[] = [];
  for (const file of files) {
    const score = scoreCodeQuality(file);
    if (!("error" in score)) scores.push(score.overall);
  }
  if (scores.length > 0) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    qualityTrend.push(avg);
    if (qualityTrend.length > 24) qualityTrend.splice(0, qualityTrend.length - 24);
  }

  addLogEntry({
    type: "cycle_end",
    description: `Evolution cycle #${cycleCount} complete — ${proposals.length} proposals, ${applied} applied, ${rejected} rejected`,
    status: "success",
    details: {
      cycleNumber: cycleCount,
      proposalsGenerated: proposals.length,
      applied,
      rejected,
      avgQuality: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    },
  });

  elog(`Evolution cycle #${cycleCount} complete — ${proposals.length} proposals, ${applied} applied, ${rejected} rejected`);
}

function scheduleNextCycle(): void {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = setTimeout(async () => {
    try {
      await runEvolutionCycle();
    } catch (e: any) {
      elog(`Cycle error: ${e.message}`);
    }
    scheduleNextCycle();
  }, EVOLUTION_CYCLE_INTERVAL_MS);
  nextCycleAt = Date.now() + EVOLUTION_CYCLE_INTERVAL_MS;
  elog(`Next evolution cycle scheduled in ${EVOLUTION_CYCLE_INTERVAL_MS / 60000} minutes`);
}

export function startEvolutionScheduler(): void {
  if (evolutionRunning) return;
  evolutionRunning = true;
  loadEvolutionLog();
  elog("Self-Evolution Engine initialized");
  runEvolutionCycle().catch((e) => elog(`Initial cycle error: ${e.message}`));
  scheduleNextCycle();
}

export function stopEvolutionScheduler(): void {
  evolutionRunning = false;
  if (schedulerTimer) { clearTimeout(schedulerTimer); schedulerTimer = null; }
  elog("Self-Evolution Engine stopped");
}

export function getEvolutionStatus(): EvolutionStatus {
  const files = listModifiableFiles().slice(0, 10);
  const scores: number[] = [];
  for (const file of files) {
    const s = scoreCodeQuality(file);
    if (!("error" in s)) scores.push(s.overall);
  }
  const currentQualityAvg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const applied = evolutionLog.filter((e) => e.type === "applied" && e.status === "success").length;
  const rejected = evolutionLog.filter((e) => e.type === "rejected").length;
  const proposals = evolutionLog.filter((e) => e.type === "proposal").length;

  return {
    running: evolutionRunning,
    cycleCount,
    lastCycleAt,
    nextCycleAt,
    cycleIntervalMs: EVOLUTION_CYCLE_INTERVAL_MS,
    totalProposals: proposals,
    totalApplied: applied,
    totalRejected: rejected,
    recentQualityTrend: qualityTrend.slice(-12),
    currentQualityAvg,
  };
}

export function getEvolutionLog(limit = 50): EvolutionLogEntry[] {
  return evolutionLog.slice(-limit).reverse();
}

export function getFileQualityScores(limit = 20): Array<CodeQualityScore | { error: string; file: string }> {
  const files = listModifiableFiles().slice(0, limit);
  return files.map((f) => {
    const score = scoreCodeQuality(f);
    if ("error" in score) return { error: score.error, file: f };
    return score;
  });
}
